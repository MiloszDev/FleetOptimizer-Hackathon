import type React from 'react';
import { useEffect, useRef } from 'react';
import L, { type LatLng, type Polyline, type PolylineOptions } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

type LeafletRoutingControl = any;

type RouteAnimation = {
    marker: L.Marker;
    start(): void;
    pause(): void;
    stop(): void;
    isRunning(): boolean;
    hasStarted(): boolean;
    setOnEnd(cb: (() => void) | null): void;
    updateIcon(icon: L.DivIcon): void;
};

export type VehicleBrand = 'DAF' | 'SCANIA' | 'VOLVO';

export interface RouteStatusMessage {
    type: 'info' | 'warning' | 'error';
    message: string;
    error?: unknown;
}

export interface RouteAnimationControls {
    start(): void;
    pause(): void;
    resume(): void;
    stop(): void;
    isRunning(): boolean;
    hasStarted(): boolean;
    setVehicleBrand(brand: VehicleBrand): void;
    setSpeed(kmh: number): void;
    refresh(): void;
}

export type LocationInput = 
    | { type: 'address'; address: string }
    | { type: 'coords'; lat: number; lng: number };

export interface RouteAnimatorProps {
    map: L.Map;
    from: LocationInput;
    to: LocationInput;
    speedKmh?: number;
    vehicleBrand?: VehicleBrand;
    autoStart?: boolean;
    onStatus?: (status: RouteStatusMessage) => void;
    onReady?: (controls: RouteAnimationControls) => void;
}

const OSRM_ENDPOINTS = [
    'https://router.project-osrm.org/route/v1',
    'https://routing.openstreetmap.de/routed-car/route/v1',
    'https://osrm-demo.kumi.systems/route/v1'
];

const DEFAULT_SPEED_KMH = 30;
const ICON_ROTATION_OFFSET = -90;
const ICON_SIZE: [number, number] = [42, 24];
const ICON_ANCHOR: [number, number] = [21, 12];

const sanitizeSpeed = (value?: number) => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value;
    }
    return DEFAULT_SPEED_KMH;
};

const sanitizeBrand = (value?: VehicleBrand): VehicleBrand => {
    if (value === 'SCANIA' || value === 'VOLVO' || value === 'DAF') {
        return value;
    }
    return 'DAF';
};

export const RouteAnimator: React.FC<RouteAnimatorProps> = ({
    map,
    from,
    to,
    speedKmh,
    vehicleBrand,
    autoStart = true,
    onStatus,
    onReady
}) => {
    const mapRef = useRef<L.Map | null>(map);
    const routingControlRef = useRef<LeafletRoutingControl | null>(null);
    const animationRef = useRef<RouteAnimation | null>(null);
    const routeLineRef = useRef<Polyline | null>(null);
    const routerIndexRef = useRef(0);
    const fallbackAttemptsRef = useRef(0);
    const lastCoordsRef = useRef<LatLng[]>([]);
    const brandRef = useRef<VehicleBrand>(sanitizeBrand(vehicleBrand));
    const speedRef = useRef<number>(sanitizeSpeed(speedKmh));
    const autoStartRef = useRef<boolean>(autoStart !== false);
    const controlsRef = useRef<RouteAnimationControls | null>(null);
    const osrmRoutersRef = useRef<any[]>([]);

    const createVehicleIcon = (brand: VehicleBrand) => {    
        const url = `/img/${brand.toLowerCase()}.svg`;
        return L.divIcon({
            className: 'vehicle-marker',
            html: `<img src="${url}" alt="${brand}" style="width:${ICON_SIZE[0]}px;height:${ICON_SIZE[1]}px;" />`,
            iconSize: ICON_SIZE,
            iconAnchor: ICON_ANCHOR
        });
    };

    const applyHeading = (marker: L.Marker, angleDeg: number) => {
        const img = (marker as any)._icon?.querySelector('img') as HTMLImageElement | null;
        if (img) {
            img.style.transformOrigin = '50% 50%';
            img.style.transform = `rotate(${angleDeg + ICON_ROTATION_OFFSET}deg)`;
        }
    };

    const clearAnimation = (preserveLine = false) => {
        if (animationRef.current) {
            animationRef.current.stop();
            if (mapRef.current) {
                mapRef.current.removeLayer(animationRef.current.marker);
            }
            animationRef.current = null;
        }
        if (!preserveLine && routeLineRef.current && mapRef.current) {
            mapRef.current.removeLayer(routeLineRef.current);
            routeLineRef.current = null;
        }
    };

    const geocodeOnce = async (query: string): Promise<LatLng> => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}&addressdetails=1`;
        const response = await fetch(url, { headers: { 'Accept-Language': 'pl' } });
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error(`Nie znaleziono: ${query}`);
        }
        return L.latLng(Number.parseFloat(data[0].lat), Number.parseFloat(data[0].lon));
    };

    const createAnimation = (coords: LatLng[], icon: L.DivIcon): RouteAnimation | null => {
        if (!mapRef.current || coords.length < 2) {
            return null;
        }

        const marker = L.marker(coords[0], { icon }).addTo(mapRef.current);

        const segments = coords.slice(1).map((point, idx) => {
            const fromPoint = coords[idx];
            const length = fromPoint.distanceTo(point);
            return {
                from: fromPoint,
                to: point,
                length,
                bearing: length === 0 ? 0 : bearingDegrees(fromPoint, point)
            };
        });

        const totalDistance = segments.reduce((acc, seg) => acc + seg.length, 0);
        if (totalDistance === 0) {
            if (mapRef.current) {
                mapRef.current.removeLayer(marker);
            }
            return null;
        }

        const speedMetersPerSecond = sanitizeSpeed(speedRef.current) / 3.6;
        const totalDuration = Math.max(5000, (totalDistance / speedMetersPerSecond) * 1000);

        let frameId: number | null = null;
        let startTimestamp = 0;
        let elapsed = 0;
        let running = false;
        let started = false;
        let onEnd: (() => void) | null = null;
        let currentHeading = segments[0]?.bearing ?? 0;
        applyHeading(marker, currentHeading);

        const pointAt = (distance: number) => {
            let remaining = distance;
            for (const segment of segments) {
                if (remaining <= segment.length) {
                    const ratio = segment.length === 0 ? 0 : remaining / segment.length;
                    const lat = segment.from.lat + (segment.to.lat - segment.from.lat) * ratio;
                    const lng = segment.from.lng + (segment.to.lng - segment.from.lng) * ratio;
                    return {
                        point: L.latLng(lat, lng),
                        bearing: segment.length === 0 ? currentHeading : segment.bearing
                    };
                }
                remaining -= segment.length;
            }
            const lastSegment = segments[segments.length - 1];
            return {
                point: coords[coords.length - 1],
                bearing: lastSegment?.bearing ?? currentHeading
            };
        };

        const step = (timestamp: number) => {
            if (!running) {
                return;
            }
            elapsed = timestamp - startTimestamp;
            const progress = Math.min(elapsed / totalDuration, 1);
            const distance = totalDistance * progress;
            const { point, bearing } = pointAt(distance);
            marker.setLatLng(point);
            currentHeading = bearing;
            applyHeading(marker, currentHeading);

            // Follow pojazdu z zoomem
            if (mapRef.current) {
                mapRef.current.setView(point, 16, { animate: true, duration: 0.25 });
            }

            if (progress >= 1) {
                running = false;
                frameId = null;
                elapsed = totalDuration;
                marker.setLatLng(coords[coords.length - 1]);
                applyHeading(marker, currentHeading);
                onEnd?.();
                return;
            }

            frameId = requestAnimationFrame(step);
        };

        const start = () => {
            if (running) {
                return;
            }
            if (!started || elapsed >= totalDuration) {
                marker.setLatLng(coords[0]);
                elapsed = 0;
                currentHeading = segments[0]?.bearing ?? currentHeading;
                applyHeading(marker, currentHeading);
                // Zoom do punktu startowego
                if (mapRef.current) {
                    mapRef.current.setView(coords[0], 16, { animate: true, duration: 1 });
                }
            }
            started = true;
            running = true;
            startTimestamp = performance.now() - elapsed;
            frameId = requestAnimationFrame(step);
        };

        return {
            marker,
            start,
            pause() {
                if (!running) {
                    return;
                }
                running = false;
                if (frameId) {
                    cancelAnimationFrame(frameId);
                    frameId = null;
                }
                elapsed = performance.now() - startTimestamp;
            },
            stop() {
                if (frameId) {
                    cancelAnimationFrame(frameId);
                    frameId = null;
                }
                running = false;
                elapsed = 0;
                started = false;
                marker.setLatLng(coords[0]);
                currentHeading = segments[0]?.bearing ?? currentHeading;
                applyHeading(marker, currentHeading);
            },
            isRunning() {
                return running;
            },
            hasStarted() {
                return started;
            },
            setOnEnd(cb) {
                onEnd = cb;
            },
            updateIcon(newIcon: L.DivIcon) {
                marker.setIcon(newIcon);
                requestAnimationFrame(() => applyHeading(marker, currentHeading));
            }
        };
    };

    const bearingDegrees = (from: LatLng, to: LatLng) => {
        const rad = Math.PI / 180;
        const lat1 = from.lat * rad;
        const lat2 = to.lat * rad;
        const dLon = (to.lng - from.lng) * rad;
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        const brng = Math.atan2(y, x) * (180 / Math.PI);
        return (brng + 360) % 360;
    };

    const buildAnimation = (coords: LatLng[], lineOptions?: PolylineOptions) => {
        clearAnimation();
        if (!mapRef.current) {
            return false;
        }
        routeLineRef.current = L.polyline(coords, lineOptions ?? { color: '#5ab2ff', weight: 6, opacity: 0.2 }).addTo(mapRef.current);
        lastCoordsRef.current = coords;
        const icon = createVehicleIcon(brandRef.current);
        const animation = createAnimation(coords, icon);
        if (!animation) {
            return false;
        }
        animation.setOnEnd(() => {
            animationRef.current?.stop();
        });
        animationRef.current = animation;
        if (autoStartRef.current) {
            animation.start();
        }
        return true;
    };

    const rebuildAnimation = () => {
        if (!lastCoordsRef.current.length) {
            return;
        }
        clearAnimation(true);
        const icon = createVehicleIcon(brandRef.current);
        const animation = createAnimation(lastCoordsRef.current, icon);
        if (!animation) {
            return;
        }
        animation.setOnEnd(() => {
            animationRef.current?.stop();
        });
        animationRef.current = animation;
        if (autoStartRef.current) {
            animation.start();
        }
    };

    const buildDirectFallback = (coords: LatLng[]) => buildAnimation(coords, { color: '#8c7aff', weight: 4, opacity: 0.6, dashArray: '10,8' });

    const handleStatus = (status: RouteStatusMessage) => {
        if (onStatus) {
            onStatus(status);
        } else if (status.type === 'error') {
            console.error(status.message, status.error);
        } else if (status.type === 'warning') {
            console.warn(status.message);
        } else {
            console.info(status.message);
        }
    };

    const resolveLocation = async (location: LocationInput): Promise<LatLng> => {
        if (location.type === 'coords') {
            return L.latLng(location.lat, location.lng);
        }
        return await geocodeOnce(location.address);
    };

    useEffect(() => {
        mapRef.current = map;
        
        if (!map) return;

        // Sprawdź czy routing control już istnieje
        if (routingControlRef.current) {
            return;
        }

        const routingNamespace = (L as unknown as { Routing?: any }).Routing;
        if (!routingNamespace) {
            handleStatus({ type: 'error', message: 'Leaflet Routing Machine nie jest dostępna.' });
            return;
        }

        // Inicjalizuj OSRM routery
        osrmRoutersRef.current = OSRM_ENDPOINTS.map(endpointUrl => {
            // Sprawdź różne możliwe warianty API
            if (routingNamespace.osrmv1) {
                return routingNamespace.osrmv1({
                    serviceUrl: endpointUrl,
                    profile: 'driving'
                });
            }
            if (routingNamespace.OSRMv1) {
                return new routingNamespace.OSRMv1({
                    serviceUrl: endpointUrl,
                    profile: 'driving'
                });
            }
            // Fallback - utwórz prosty router z URL korzystając z OSRM API
            return {
                route(waypoints: any[], callback: Function, context: any, options: any) {
                    const points = waypoints.map((w: any) => {
                        const latLng = w.latLng || w;
                        return [latLng.lng, latLng.lat];
                    });
                    const requestUrl = `${endpointUrl}/driving/${points.map((p: number[]) => p.join(',')).join(';')}?overview=full&geometries=geojson`;
                    fetch(requestUrl)
                        .then(res => res.json())
                        .then(data => {
                            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                                const route = data.routes[0];
                                const coordinates = route.geometry.coordinates.map((c: number[]) => L.latLng(c[1], c[0]));
                                callback.call(context, null, [{
                                    name: '',
                                    summary: { totalDistance: route.distance, totalTime: route.duration },
                                    coordinates,
                                    instructions: []
                                }]);
                            } else {
                                callback.call(context, new Error('No route found'), null);
                            }
                        })
                        .catch(err => callback.call(context, err, null));
                }
            };
        });

        let routingControl: LeafletRoutingControl | null = null;

        const handleRoutesFound = (event: any) => {
            if (event.routes && event.routes.length > 0) {
                fallbackAttemptsRef.current = 0;
                buildAnimation(event.routes[0].coordinates.map((c: { lat: number; lng: number }) => L.latLng(c.lat, c.lng)));
            }
        };

        const handleRouteSelected = (event: any) => {
            if (event.route && event.route.coordinates) {
                fallbackAttemptsRef.current = 0;
                buildAnimation(event.route.coordinates.map((c: { lat: number; lng: number }) => L.latLng(c.lat, c.lng)));
            }
        };

        const handleRoutingStart = () => {
            // Routing rozpoczęty
        };

        const handleRoutingError = (event: any) => {
            fallbackAttemptsRef.current++;
            if (fallbackAttemptsRef.current < OSRM_ENDPOINTS.length) {
                handleStatus({ type: 'warning', message: 'Problem z serwerem trasowania. Przełączam na inny.' });
                routerIndexRef.current = (routerIndexRef.current + 1) % OSRM_ENDPOINTS.length;
                if (routingControl) {
                    routingControl.options.router = osrmRoutersRef.current[routerIndexRef.current];
                    routingControl._router = routingControl.options.router;
                    const waypoints = routingControl.getWaypoints()
                        .map((w: any) => w.latLng as LatLng);
                    routingControl.setWaypoints(waypoints);
                }
                return;
            }
            // Fallback do bezpośredniej linii
            if (routingControl) {
                const waypoints = routingControl.getWaypoints()
                    .map((w: any) => w.latLng as LatLng);
                if (waypoints.length >= 2) {
                    buildDirectFallback(waypoints);
                }
            }
        };

        const init = () => {
            routingControl = routingNamespace.control({
                router: osrmRoutersRef.current[routerIndexRef.current],
                geocoder: null,
                waypoints: [],
                show: false,
                lineOptions: { styles: [{ color: '#5ab2ff', opacity: 0.95, weight: 6 }] },
            }).addTo(mapRef.current!);

            routingControl.on('routesfound', handleRoutesFound);
            routingControl.on('routeselected', handleRouteSelected);
            routingControl.on('routingstart', handleRoutingStart);
            routingControl.on('routingerror', handleRoutingError);

            routingControlRef.current = routingControl;
        };

        if (mapRef.current) {
            if ((mapRef.current as any).whenReady) {
                mapRef.current.whenReady(init);
            } else {
                init();
            }
        }

        return () => {
            if (routingControl) {
                routingControl.off('routesfound', handleRoutesFound);
                routingControl.off('routeselected', handleRouteSelected);
                routingControl.off('routingstart', handleRoutingStart);
                routingControl.off('routingerror', handleRoutingError);
                routingControl.remove();
            }
            routingControlRef.current = null;
            clearAnimation();
        };
    }, [map]);

    useEffect(() => {
        brandRef.current = sanitizeBrand(vehicleBrand);
        if (animationRef.current) {
            animationRef.current.updateIcon(createVehicleIcon(brandRef.current));
        }
    }, [vehicleBrand]);

    useEffect(() => {
        speedRef.current = sanitizeSpeed(speedKmh);
        rebuildAnimation();
    }, [speedKmh]);

    useEffect(() => {
        autoStartRef.current = autoStart !== false;
    }, [autoStart]);

    useEffect(() => {
        let cancelled = false;
        const routingControl = routingControlRef.current;
        if (!routingControl) {
            return;
        }

        (async () => {
            try {
                const [start, end] = await Promise.all([resolveLocation(from), resolveLocation(to)]);
                if (cancelled) {
                    return;
                }
                routingControl.setWaypoints([start, end]);
                mapRef.current?.fitBounds(L.latLngBounds([start, end]), { padding: [40, 40] });
            } catch (error) {
                handleStatus({ type: 'error', message: 'Nie udało się pobrać współrzędnych.', error });
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [from, to]);

    useEffect(() => {
        if (!controlsRef.current) {
            controlsRef.current = {
                start() {
                    animationRef.current?.start();
                },
                pause() {
                    animationRef.current?.pause();
                },
                resume() {
                    animationRef.current?.start();
                },
                stop() {
                    animationRef.current?.stop();
                },
                isRunning() {
                    return animationRef.current?.isRunning() ?? false;
                },
                hasStarted() {
                    return animationRef.current?.hasStarted() ?? false;
                },
                setVehicleBrand(brand: VehicleBrand) {
                    brandRef.current = sanitizeBrand(brand);
                    if (animationRef.current) {
                        animationRef.current.updateIcon(createVehicleIcon(brandRef.current));
                    }
                },
                setSpeed(kmh: number) {
                    speedRef.current = sanitizeSpeed(kmh);
                    rebuildAnimation();
                },
                refresh() {
                    rebuildAnimation();
                }
            };
        }
        if (onReady && controlsRef.current) {
            onReady(controlsRef.current);
        }
    }, [onReady]);

    return null;
};
