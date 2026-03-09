import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field
import random
import math

from .fleet_opt.data_loader import load_hackathon_data
from .fleet_opt.config import START_DATE, END_DATE
from .models import Location
from sqlalchemy.orm import Session


@dataclass
class TruckPosition:
    truck_id: int
    registration_number: str
    brand: str
    latitude: float
    longitude: float
    speed_kmh: float
    heading: float
    status: str
    current_route_index: int
    location_sequence: List[int]
    segment_progress: float
    start_time: datetime
    end_time: datetime
    odometer_km: int
    initial_odometer_km: int = 0

    def to_dict(self):
        return {
            'truck_id': self.truck_id,
            'registration_number': self.registration_number,
            'brand': self.brand,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'speed_kmh': self.speed_kmh,
            'heading': self.heading,
            'status': self.status,
            'current_route_index': self.current_route_index,
            'location_sequence': self.location_sequence,
            'segment_progress': self.segment_progress,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat(),
            'odometer_km': self.odometer_km,
        }


@dataclass
class SimulationState:
    positions: Dict[int, TruckPosition] = field(default_factory=dict)
    location_cache: Dict[int, tuple] = field(default_factory=dict)
    speed_multiplier: float = 1.0
    last_update: datetime = field(default_factory=datetime.now)
    connected_clients: Set = field(default_factory=set)


class SimulationCoordinator:
    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory
        self.state = SimulationState()
        self.running = False
        self.update_task: Optional[asyncio.Task] = None

    def _load_location_cache(self, db: Session):
        locations = db.query(Location).all()
        for loc in locations:
            self.state.location_cache[loc.id] = (loc.lat, loc.long, loc.name)

    def _initialize_trucks(self):
        from .fleet_opt.data_loader import load_hackathon_data
        from .fleet_opt.config import START_DATE, END_DATE

        data = load_hackathon_data(START_DATE, END_DATE)
        if data[0] is None:
            return

        vehicles, locations, routes, segments, _ = data

        for loc_row in locations.itertuples():
            self.state.location_cache[loc_row.id] = (loc_row.lat, loc_row.long, loc_row.name)

        vehicle_cache = {}
        for v in vehicles.itertuples():
            vehicle_cache[v.Id] = {
                'registration': v.registration_number,
                'brand': v.brand,
                'odometer': int(v.current_odometer_km),
            }

        from .fleet_opt.preprocessing import prepare_simulation_data
        from .fleet_opt.simulator import run_simulation
        from .fleet_opt.config import SIM_START_DATE

        distance_map, route_info_map = prepare_simulation_data(
            vehicles, locations, routes, segments, data[4]
        )

        assignments, vehicle_states = run_simulation(
            vehicles, locations, route_info_map, distance_map, SIM_START_DATE
        )

        truck_routes = {}
        truck_route_times = {}

        for assignment in assignments:
            vehicle_id = int(assignment['vehicle_id'])
            route_id = assignment['route_id']

            if vehicle_id not in truck_routes:
                truck_routes[vehicle_id] = []
                truck_route_times[vehicle_id] = {'start': None, 'end': None}

            if route_id in route_info_map:
                route_info = route_info_map[route_id]
                locations_list = route_info.get('locations', [])
                if locations_list:
                    truck_routes[vehicle_id].extend([int(loc) for loc in locations_list])

                if truck_route_times[vehicle_id]['start'] is None:
                    truck_route_times[vehicle_id]['start'] = route_info.get('start_time')
                truck_route_times[vehicle_id]['end'] = route_info.get('end_time')

        base_time = datetime.now()

        for truck_id, location_seq in truck_routes.items():
            if len(location_seq) < 2:
                continue

            vehicle_info = vehicle_cache.get(truck_id)
            if not vehicle_info:
                continue

            start_location = self.state.location_cache.get(
                location_seq[0], (52.2, 19.0, 'Unknown')
            )

            route_times = truck_route_times.get(truck_id, {})
            route_start = route_times.get('start')
            route_end = route_times.get('end')

            if route_start and route_end:
                duration = (route_end - route_start).total_seconds()
                duration_hours = duration / 3600
            else:
                total_distance = len(location_seq) * 50
                avg_speed = 70
                duration_hours = max(0.5, total_distance / avg_speed)

            start_time = base_time - timedelta(seconds=random.randint(0, 60))

            self.state.positions[truck_id] = TruckPosition(
                truck_id=truck_id,
                registration_number=vehicle_info['registration'],
                brand=vehicle_info['brand'],
                latitude=start_location[0],
                longitude=start_location[1],
                speed_kmh=random.uniform(60, 90),
                heading=0.0,
                status='in_transit',
                current_route_index=0,
                location_sequence=location_seq,
                segment_progress=0.0,
                start_time=start_time,
                end_time=start_time + timedelta(hours=duration_hours),
                odometer_km=vehicle_info['odometer'],
                initial_odometer_km=vehicle_info['odometer'],
            )

    def _calculate_bearing(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        dlon = math.radians(lon2 - lon1)

        y = math.sin(dlon) * math.cos(lat2_rad)
        x = math.cos(lat1_rad) * math.sin(lat2_rad) - math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlon)
        bearing = math.atan2(y, x)
        return (math.degrees(bearing) + 360) % 360

    def _update_positions(self, time_step: float):
        for truck_id, pos in self.state.positions.items():
            if pos.status == 'completed':
                continue

            simulated_time = self.state.last_update + timedelta(seconds=time_step)

            if simulated_time < pos.start_time:
                pos.status = 'idle'
                continue

            if simulated_time >= pos.end_time:
                pos.status = 'completed'
                pos.speed_kmh = 0.0
                last_loc = pos.location_sequence[-1]
                if last_loc in self.state.location_cache:
                    coords = self.state.location_cache[last_loc]
                    pos.latitude = coords[0]
                    pos.longitude = coords[1]
                continue

            pos.status = 'in_transit'

            total_duration = (pos.end_time - pos.start_time).total_seconds()
            elapsed = (simulated_time - pos.start_time).total_seconds()
            overall_progress = min(1.0, elapsed / total_duration)

            num_segments = len(pos.location_sequence) - 1
            if num_segments <= 0:
                continue

            segment_float = overall_progress * num_segments
            segment_index = min(int(segment_float), num_segments - 1)
            segment_progress = segment_float - segment_index

            pos.current_route_index = segment_index
            pos.segment_progress = segment_progress

            loc_a_id = pos.location_sequence[segment_index]
            loc_b_id = pos.location_sequence[segment_index + 1]

            if loc_a_id not in self.state.location_cache or loc_b_id not in self.state.location_cache:
                continue

            loc_a = self.state.location_cache[loc_a_id]
            loc_b = self.state.location_cache[loc_b_id]

            pos.latitude = loc_a[0] + (loc_b[0] - loc_a[0]) * segment_progress
            pos.longitude = loc_a[1] + (loc_b[1] - loc_a[1]) * segment_progress

            pos.heading = self._calculate_bearing(loc_a[0], loc_a[1], loc_b[0], loc_b[1])

            total_segment_distance = math.hypot(
                (loc_b[0] - loc_a[0]) * 111,
                (loc_b[1] - loc_a[1]) * 111 * math.cos(math.radians(loc_a[0]))
            )
            segment_duration = total_duration / num_segments if num_segments > 0 else 1
            pos.speed_kmh = (total_segment_distance / segment_duration) * 3600 if segment_duration > 0 else 0

            # Update odometer based on current speed and timestep
            distance_this_tick = pos.speed_kmh * (time_step / 3600.0)
            pos.odometer_km += int(distance_this_tick)

    async def update_loop(self):
        stats_counter = 0
        while self.running:
            time_step = 1.0 * self.state.speed_multiplier
            self._update_positions(time_step)
            self.state.last_update = self.state.last_update + timedelta(seconds=time_step)

            update_data = {
                'type': 'positions_update',
                'positions': [pos.to_dict() for pos in self.state.positions.values()],
                'timestamp': datetime.now().isoformat(),
                'simulation_time': self.state.last_update.isoformat(),
                'speed_multiplier': self.state.speed_multiplier
            }

            # Send stats bundle roughly every 4 seconds (~40 ticks at 0.1s)
            stats_counter += 1
            if stats_counter >= 40:
                stats_counter = 0
                from .fleet_opt.config import SIM_START_DATE
                elapsed = (self.state.last_update - SIM_START_DATE).days
                try:
                    from .database import SessionLocal
                    from .models import Vehicle
                    from .routers.simulation import get_financial_stats_data

                    db = SessionLocal()
                    try:
                        vehicles = db.query(Vehicle).all()
                        vehicle_by_id = {v.id: v for v in vehicles}

                        # Quick stats computed live from positions and simulation time
                        lease_entries = []
                        service_entries = []
                        total_km = 0
                        total_days_to_lease = 0
                        valid_lease_count = 0
                        vehicles_over_limit = 0
                        vehicles_needing_replacement = 0
                        services_needed_soon = 0

                        for truck_id, pos in self.state.positions.items():
                            v = vehicle_by_id.get(truck_id)
                            if not v:
                                continue

                            # Days to lease end based on simulation time
                            if v.leasing_end_date:
                                days_remaining = (v.leasing_end_date - self.state.last_update).days
                                if days_remaining > 0:
                                    lease_entries.append((v, days_remaining))
                                    total_days_to_lease += days_remaining
                                    valid_lease_count += 1

                            # Km to next service based on live odometer
                            km_until_service = None
                            if v.service_interval_km and pos.odometer_km is not None:
                                km_until_service = v.service_interval_km - (pos.odometer_km % v.service_interval_km)
                                service_entries.append((v, km_until_service))
                                if km_until_service < 500:
                                    services_needed_soon += 1

                            # Over limit and replacement
                            if v.leasing_limit_km and pos.odometer_km is not None:
                                total_driven = pos.odometer_km - (v.leasing_start_km or 0)
                                if total_driven > v.leasing_limit_km:
                                    vehicles_over_limit += 1
                                    if total_driven > v.leasing_limit_km * 1.2 or (
                                        v.leasing_end_date and (v.leasing_end_date - self.state.last_update).days < 0
                                    ):
                                        vehicles_needing_replacement += 1

                            total_km += pos.odometer_km

                        lease_entries.sort(key=lambda x: x[1])
                        service_entries.sort(key=lambda x: x[1] if x[1] is not None else 10**9)

                        quick_stats = {
                            'top_3_lease_ending': [
                                {
                                    'id': v.id,
                                    'registration_number': v.registration_number,
                                    'brand': v.brand,
                                    'leasing_end_date': v.leasing_end_date.isoformat() if v.leasing_end_date else None,
                                    'days_remaining': days
                                }
                                for v, days in lease_entries[:3]
                            ],
                            'top_3_service_needed': [
                                {
                                    'id': v.id,
                                    'registration_number': v.registration_number,
                                    'brand': v.brand,
                                    'current_odometer_km': pos.odometer_km if (pos := self.state.positions.get(v.id)) else None,
                                    'service_interval_km': v.service_interval_km,
                                    'km_until_service': km
                                }
                                for v, km in service_entries[:3]
                            ],
                            'vehicles_over_limit': vehicles_over_limit,
                            'total_services_needed': services_needed_soon,
                            'average_odometer': (total_km / len(self.state.positions)) if self.state.positions else 0,
                            'total_km_driven': total_km,
                            'vehicles_needing_replacement': vehicles_needing_replacement,
                            'average_days_to_lease_end': (total_days_to_lease / valid_lease_count) if valid_lease_count > 0 else 0
                        }

                        # Financial stats: base from CSV + live adjustments
                        base_fin = get_financial_stats_data()
                        live_service_cost = 0.0
                        live_penalty_cost = 0.0
                        traveled_km = 0.0
                        for truck_id, pos in self.state.positions.items():
                            v = vehicle_by_id.get(truck_id)
                            if not v:
                                continue
                            if v.service_interval_km and pos.odometer_km is not None:
                                services_taken = int(pos.odometer_km / v.service_interval_km)
                                live_service_cost += services_taken * 9600
                            if v.leasing_limit_km is not None:
                                excess_km = (pos.odometer_km - (v.leasing_start_km or 0)) - v.leasing_limit_km
                                if excess_km > 0:
                                    live_penalty_cost += excess_km * 0.92
                            traveled_km += max(0, pos.odometer_km - pos.initial_odometer_km)

                        financial_stats = {
                            'relocation_cost_pln': base_fin['relocation_cost_pln'],
                            'service_cost_pln': live_service_cost,
                            'penalty_cost_pln': live_penalty_cost,
                            'total_cost_pln': base_fin['relocation_cost_pln'] + live_service_cost + live_penalty_cost,
                            'routes_assigned': base_fin['routes_assigned'],
                            'vehicles_used': len(self.state.positions),
                            'total_services': int(live_service_cost / 9600) if live_service_cost else 0,
                            'total_distance_km': traveled_km,
                            'data_available': base_fin['data_available']
                        }

                        update_data['stats'] = {
                            'elapsed_days': elapsed,
                            'is_running': self.running,
                            'vehicle_count': len(self.state.positions),
                            'quick_stats': quick_stats,
                            'financial_stats': financial_stats
                        }
                    finally:
                        db.close()
                except Exception as e:
                    print(f"Error loading stats: {e}")
                    update_data['stats'] = {
                        'elapsed_days': elapsed,
                        'is_running': self.running,
                        'vehicle_count': len(self.state.positions)
                    }

            for client in list(self.state.connected_clients):
                try:
                    await client.send_json(update_data)
                except Exception:
                    self.state.connected_clients.discard(client)

            await asyncio.sleep(0.1)

    async def start(self):
        if self.running:
            return

        db = self.db_session_factory()
        self._load_location_cache(db)
        db.close()

        self._initialize_trucks()

        self.running = True
        self.state.last_update = datetime.now()
        self.update_task = asyncio.create_task(self.update_loop())

    async def stop(self):
        self.running = False
        if self.update_task:
            self.update_task.cancel()
            try:
                await self.update_task
            except asyncio.CancelledError:
                pass

    def set_speed(self, multiplier: float):
        self.state.speed_multiplier = max(1.0, min(10000.0, multiplier))

    def recalculate_truck(self, truck_id: int):
        if truck_id not in self.state.positions:
            return False

        pos = self.state.positions[truck_id]
        pos.location_sequence = list(reversed(pos.location_sequence))
        pos.current_route_index = 0
        pos.segment_progress = 0.0
        pos.start_time = datetime.now()

        total_distance = len(pos.location_sequence) * 50
        duration_hours = max(0.5, total_distance / 70)
        pos.end_time = datetime.now() + timedelta(hours=duration_hours)
        pos.status = 'idle'

        if pos.location_sequence and pos.location_sequence[0] in self.state.location_cache:
            start_loc = self.state.location_cache[pos.location_sequence[0]]
            pos.latitude = start_loc[0]
            pos.longitude = start_loc[1]

        return True

    def get_all_positions(self) -> List[dict]:
        return [pos.to_dict() for pos in self.state.positions.values()]

    def add_client(self, client):
        self.state.connected_clients.add(client)

    def remove_client(self, client):
        self.state.connected_clients.discard(client)
