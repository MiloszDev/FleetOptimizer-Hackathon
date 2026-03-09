"""
OSRM routing client with caching and fallback
"""
import asyncio
import aiohttp
from typing import List, Tuple, Optional, Dict
from functools import lru_cache
from datetime import datetime, timedelta
import math

from ..config import POLYLINE_POINTS_PER_LEG


OSRM_ENDPOINTS = []  # Disabled
ROUTE_CACHE_MAX_SIZE = 0  # Disabled


class RoutingCache:

    def __init__(self, max_size: int = ROUTE_CACHE_MAX_SIZE, ttl_seconds: int = 3600):
        self.cache: Dict[str, Tuple[List[Tuple[float, float]], float, datetime]] = {}
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
    
    def _make_key(self, from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> str:

        return f"{from_lat:.6f},{from_lng:.6f}|{to_lat:.6f},{to_lng:.6f}"
    
    def get(self, from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> Optional[Tuple[List[Tuple[float, float]], float]]:

        key = self._make_key(from_lat, from_lng, to_lat, to_lng)
        
        if key in self.cache:
            polyline, distance, timestamp = self.cache[key]
            if datetime.utcnow() - timestamp < timedelta(seconds=self.ttl_seconds):
                return polyline, distance
            else:
                del self.cache[key]
        
        return None
    
    def set(self, from_lat: float, from_lng: float, to_lat: float, to_lng: float, 
            polyline: List[Tuple[float, float]], distance: float):

        # Simple eviction: remove oldest if at max size
        if len(self.cache) >= self.max_size:
            oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k][2])
            del self.cache[oldest_key]
        
        key = self._make_key(from_lat, from_lng, to_lat, to_lng)
        self.cache[key] = (polyline, distance, datetime.utcnow())


# Global cache instance
_route_cache = RoutingCache()


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:

    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c


def create_straight_line_polyline(from_lat: float, from_lng: float, 
                                   to_lat: float, to_lng: float,
                                   num_points: int = 10) -> List[Tuple[float, float]]:

    polyline = []
    for i in range(num_points + 1):
        t = i / num_points
        lat = from_lat + (to_lat - from_lat) * t
        lng = from_lng + (to_lng - from_lng) * t
        polyline.append((lat, lng))
    
    return polyline


async def get_route_polyline(
    from_lat: float,
    from_lng: float,
    to_lat: float,
    to_lng: float,
    use_cache: bool = True
) -> Tuple[List[Tuple[float, float]], float]:

    # Check cache first
    if use_cache:
        cached = _route_cache.get(from_lat, from_lng, to_lat, to_lng)
        if cached:
            return cached
 

    print(f"All OSRM endpoints failed, using straight line fallback for {from_lat},{from_lng} -> {to_lat},{to_lng}")
    polyline = create_straight_line_polyline(from_lat, from_lng, to_lat, to_lng)
    distance = haversine_distance(from_lat, from_lng, to_lat, to_lng)
    
    # Cache the fallback too
    _route_cache.set(from_lat, from_lng, to_lat, to_lng, polyline, distance)
    
    return polyline, distance


async def get_multi_leg_route(
    waypoints: List[Tuple[float, float]]
) -> Tuple[List[Tuple[float, float]], List[float]]:
    """
    Get route through multiple waypoints.
    
    Args:
        waypoints: List of (lat, lng) tuples
        
    Returns:
        Tuple of (combined polyline, list of leg distances in km)
    """
    if len(waypoints) < 2:
        return [], []
    
    # Fetch all legs concurrently
    tasks = []
    for i in range(len(waypoints) - 1):
        from_lat, from_lng = waypoints[i]
        to_lat, to_lng = waypoints[i + 1]
        tasks.append(get_route_polyline(from_lat, from_lng, to_lat, to_lng))
    
    results = await asyncio.gather(*tasks)
    
    # Combine polylines and collect distances
    combined_polyline = []
    leg_distances = []
    
    for i, (polyline, distance) in enumerate(results):
        if i == 0:
            combined_polyline.extend(polyline)
        else:
            # Skip first point of subsequent legs to avoid duplication
            combined_polyline.extend(polyline[1:])
        
        leg_distances.append(distance)
    
    return combined_polyline, leg_distances


