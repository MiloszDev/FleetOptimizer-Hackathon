"""
Routes API - Prediction and route management
"""
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from ..database import get_db
from ..fleet_opt.predict import (
    predict,
    compute_routes_for_simulation,
    get_route_locations_from_db,
    get_location_by_id,
    haversine_distance,
    create_straight_line_polyline
)
from ..simulator import get_simulator
from ..models import Vehicle, ComputedRoute, Location


router = APIRouter(prefix="/api/routes", tags=["routes"])


class Waypoint(BaseModel):
    """A waypoint on a route"""
    id: int
    name: str
    lat: float
    lng: float


class RouteLeg(BaseModel):
    """A leg of a route between two waypoints"""
    from_id: int
    to_id: int
    distance_m: float
    duration_s: float
    speed_kmh: float


class TruckRoute(BaseModel):
    """Complete route information for a truck"""
    truck_id: int
    waypoints: List[Waypoint]
    polyline: List[List[float]]  # [[lat, lng], ...]
    legs: List[RouteLeg]
    start_time_iso: str
    total_duration_s: float
    total_distance_m: float


class PredictAllResponse(BaseModel):
    """Response for predict all trucks"""
    routes: List[TruckRoute]
    total_trucks: int
    prediction_time_iso: str


class PredictSingleResponse(BaseModel):
    """Response for predict single truck"""
    route: TruckRoute
    prediction_time_iso: str


@router.post("/load-persisted")
async def load_persisted_routes(db: Session = Depends(get_db)):
    """
    Load all persisted routes from database into the simulator.
    Useful for restoring state after server restart.
    """
    try:
        computed_routes = db.query(ComputedRoute).all()
        
        if not computed_routes:
            return {"message": "No persisted routes found", "loaded": 0}
        
        simulator = get_simulator()
        loaded_count = 0
        
        for computed_route in computed_routes:
            # Get waypoint details from database
            waypoints = []
            for loc_id in computed_route.waypoint_ids:
                loc = db.query(Location).filter(Location.id == loc_id).first()
                if loc:
                    waypoints.append({
                        'id': loc.id,
                        'name': loc.name,
                        'lat': loc.lat,
                        'lng': loc.long
                    })
            
            if len(waypoints) < 2:
                continue
            
            # Add to simulator
            simulator.add_truck_route(
                truck_id=computed_route.truck_id,
                waypoints=waypoints,
                polyline=[(p[0], p[1]) for p in computed_route.polyline],
                leg_speeds=computed_route.leg_speeds,
                start_time=datetime.now(timezone.utc)  # Start now
            )
            loaded_count += 1
        
        return {"message": f"Loaded {loaded_count} routes from database", "loaded": loaded_count}
    
    except Exception as e:
        print(f"Error loading persisted routes: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to load routes: {str(e)}")


@router.post("/predict-optimized")
async def predict_all_routes_optimized(db: Session = Depends(get_db)):
    """
    Run optimized prediction with pre-computed routes from fleet optimization.
    This is faster and doesn't rely on OSRM.
    """
    try:
        # Compute routes using the fleet optimization algorithm
        computed_routes = compute_routes_for_simulation()

        if not computed_routes:
            raise HTTPException(status_code=500, detail="No routes computed")

        # Get simulator instance
        simulator = get_simulator()

        # Load each route into simulator
        for route_data in computed_routes:
            truck_id = route_data['truck_id']
            waypoints = route_data['waypoints']
            polyline = route_data['polyline']
            leg_speeds = route_data['leg_speeds']
            start_time = route_data['start_time']

            # Add to simulator
            simulator.add_truck_route(
                truck_id=truck_id,
                waypoints=waypoints,
                polyline=polyline,
                leg_speeds=leg_speeds,
                start_time=start_time
            )

            # Save to database
            now = datetime.now(timezone.utc)
            waypoint_ids = [w['id'] for w in waypoints]

            computed_route = db.query(ComputedRoute).filter(ComputedRoute.truck_id == truck_id).first()

            if computed_route:
                # Update existing
                computed_route.waypoint_ids = waypoint_ids
                computed_route.polyline = [[lat, lng] for lat, lng in polyline]
                computed_route.leg_speeds = leg_speeds
                computed_route.total_distance_m = sum([
                    haversine_distance(polyline[i][0], polyline[i][1], polyline[i+1][0], polyline[i+1][1]) * 1000
                    for i in range(len(polyline) - 1)
                ])
                computed_route.updated_at = now
            else:
                # Create new
                total_distance_m = sum([
                    haversine_distance(polyline[i][0], polyline[i][1], polyline[i+1][0], polyline[i+1][1]) * 1000
                    for i in range(len(polyline) - 1)
                ])
                computed_route = ComputedRoute(
                    truck_id=truck_id,
                    waypoint_ids=waypoint_ids,
                    polyline=[[lat, lng] for lat, lng in polyline],
                    leg_speeds=leg_speeds,
                    total_distance_m=total_distance_m,
                    created_at=now,
                    updated_at=now
                )
                db.add(computed_route)

            db.commit()

        return {
            "message": f"Loaded {len(computed_routes)} optimized routes",
            "total_trucks": len(computed_routes)
        }

    except Exception as e:
        print(f"Error in predict_all_routes_optimized: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.post("/predict", response_model=PredictAllResponse)
async def predict_all_routes(db: Session = Depends(get_db)):
    """
    Run prediction for all trucks and generate optimized routes.
    This will update the simulation with new routes.
    """
    try:
        # Run the prediction algorithm
        prediction_results = predict()
        
        if not prediction_results:
            raise HTTPException(status_code=500, detail="Prediction failed - no results")
        
        # Get simulator instance
        simulator = get_simulator()
        
        # Process each truck's prediction
        truck_routes = []
        
        for result in prediction_results:
            truck_id = result['truck_id']
            location_ids = result['routes']
            
            if not location_ids:
                continue
            
            # Get location details from database
            waypoints = []
            for loc_id in location_ids:
                loc = get_location_by_id(loc_id, db)
                if loc:
                    waypoints.append(loc)
            
            if len(waypoints) < 2:
                print(f"Warning: Truck {truck_id} has less than 2 waypoints, skipping")
                continue
            
            # Build route with OSRM
            route_data = await _build_route_for_truck(truck_id, waypoints)
            
            if route_data:
                truck_routes.append(route_data)
                
                # Save to database
                now = datetime.now(timezone.utc)
                computed_route = db.query(ComputedRoute).filter(ComputedRoute.truck_id == truck_id).first()
                
                if computed_route:
                    # Update existing
                    computed_route.waypoint_ids = location_ids
                    computed_route.polyline = route_data['polyline']
                    computed_route.leg_speeds = [leg['speed_kmh'] for leg in route_data['legs']]
                    computed_route.total_distance_m = route_data['total_distance_m']
                    computed_route.updated_at = now
                else:
                    # Create new
                    computed_route = ComputedRoute(
                        truck_id=truck_id,
                        waypoint_ids=location_ids,
                        polyline=route_data['polyline'],
                        leg_speeds=[leg['speed_kmh'] for leg in route_data['legs']],
                        total_distance_m=route_data['total_distance_m'],
                        created_at=now,
                        updated_at=now
                    )
                    db.add(computed_route)
                
                db.commit()
                
                # Add to simulator
                simulator.add_truck_route(
                    truck_id=truck_id,
                    waypoints=[{
                        'id': w['id'],
                        'name': w['name'],
                        'lat': w['lat'],
                        'lng': w['lng']
                    } for w in waypoints],
                    polyline=[(p[0], p[1]) for p in route_data['polyline']],
                    leg_speeds=[leg['speed_kmh'] for leg in route_data['legs']],
                    start_time=datetime.fromisoformat(route_data['start_time_iso'])
                )
        
        return PredictAllResponse(
            routes=[TruckRoute(**route) for route in truck_routes],
            total_trucks=len(truck_routes),
            prediction_time_iso=datetime.now(timezone.utc).isoformat()
        )
    
    except Exception as e:
        print(f"Error in predict_all_routes: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.post("/predict/{truck_id}", response_model=PredictSingleResponse)
async def predict_single_route(truck_id: int, db: Session = Depends(get_db)):
    """
    Re-predict route for a single truck.
    This will update that truck's route in the simulation.
    """
    try:
        # Get truck from database
        vehicle = db.query(Vehicle).filter(Vehicle.id == truck_id).first()
        
        if not vehicle:
            raise HTTPException(status_code=404, detail=f"Truck {truck_id} not found")
        
        # For now, use the same prediction logic
        # In a real system, you might want truck-specific prediction
        prediction_results = predict()
        
        # Find this truck's prediction
        truck_prediction = None
        for result in prediction_results:
            if result['truck_id'] == truck_id:
                truck_prediction = result
                break
        
        if not truck_prediction:
            raise HTTPException(status_code=404, detail=f"No prediction found for truck {truck_id}")
        
        location_ids = truck_prediction['routes']
        
        # Get location details
        waypoints = []
        for loc_id in location_ids:
            loc = get_location_by_id(loc_id, db)
            if loc:
                waypoints.append(loc)
        
        if len(waypoints) < 2:
            raise HTTPException(status_code=400, detail="Not enough waypoints for route")
        
        # Build route
        route_data = await _build_route_for_truck(truck_id, waypoints)
        
        if not route_data:
            raise HTTPException(status_code=500, detail="Failed to build route")
        
        # Save to database
        now = datetime.now(timezone.utc)
        computed_route = db.query(ComputedRoute).filter(ComputedRoute.truck_id == truck_id).first()
        
        if computed_route:
            # Update existing
            computed_route.waypoint_ids = location_ids
            computed_route.polyline = route_data['polyline']
            computed_route.leg_speeds = [leg['speed_kmh'] for leg in route_data['legs']]
            computed_route.total_distance_m = route_data['total_distance_m']
            computed_route.updated_at = now
        else:
            # Create new
            computed_route = ComputedRoute(
                truck_id=truck_id,
                waypoint_ids=location_ids,
                polyline=route_data['polyline'],
                leg_speeds=[leg['speed_kmh'] for leg in route_data['legs']],
                total_distance_m=route_data['total_distance_m'],
                created_at=now,
                updated_at=now
            )
            db.add(computed_route)
        
        db.commit()
        
        # Update simulator
        simulator = get_simulator()
        simulator.add_truck_route(
            truck_id=truck_id,
            waypoints=[{
                'id': w['id'],
                'name': w['name'],
                'lat': w['lat'],
                'lng': w['lng']
            } for w in waypoints],
            polyline=[(p[0], p[1]) for p in route_data['polyline']],
            leg_speeds=[leg['speed_kmh'] for leg in route_data['legs']],
            start_time=datetime.fromisoformat(route_data['start_time_iso'])
        )
        
        return PredictSingleResponse(
            route=TruckRoute(**route_data),
            prediction_time_iso=datetime.now(timezone.utc).isoformat()
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in predict_single_route: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.get("/{truck_id}", response_model=TruckRoute)
async def get_truck_route(truck_id: int):
    """
    Get current route for a specific truck.
    """
    simulator = get_simulator()
    truck_state = simulator.get_truck_state(truck_id)
    
    if not truck_state:
        raise HTTPException(status_code=404, detail=f"No active route for truck {truck_id}")
    
    # Convert to response format
    waypoints = [Waypoint(**w) for w in truck_state.waypoints]
    polyline = [[lat, lng] for lat, lng in truck_state.polyline]
    
    # Reconstruct legs from waypoints and speeds
    legs = []
    for i in range(len(waypoints) - 1):
        # Calculate distance for this leg
        leg_start_idx = i * (len(truck_state.polyline) // max(len(waypoints) - 1, 1))
        leg_end_idx = (i + 1) * (len(truck_state.polyline) // max(len(waypoints) - 1, 1))
        
        leg_distance = 0.0
        if leg_end_idx < len(truck_state.cumulative_distances):
            leg_distance = truck_state.cumulative_distances[leg_end_idx] - truck_state.cumulative_distances[leg_start_idx]
        
        speed_kmh = truck_state.leg_speeds[i] if i < len(truck_state.leg_speeds) else 0
        duration_s = (leg_distance / 1000 / speed_kmh * 3600) if speed_kmh > 0 else 0
        
        legs.append(RouteLeg(
            from_id=waypoints[i].id,
            to_id=waypoints[i + 1].id,
            distance_m=leg_distance,
            duration_s=duration_s,
            speed_kmh=speed_kmh
        ))
    
    return TruckRoute(
        truck_id=truck_id,
        waypoints=waypoints,
        polyline=polyline,
        legs=legs,
        start_time_iso=truck_state.start_time.isoformat(),
        total_duration_s=sum(leg.duration_s for leg in legs),
        total_distance_m=truck_state.total_distance
    )


@router.get("", response_model=List[TruckRoute])
async def get_all_routes():
    """
    Get all active truck routes.
    """
    simulator = get_simulator()
    trucks = simulator.get_all_trucks()
    
    routes = []
    for truck_state in trucks:
        waypoints = [Waypoint(**w) for w in truck_state.waypoints]
        polyline = [[lat, lng] for lat, lng in truck_state.polyline]
        
        # Reconstruct legs
        legs = []
        for i in range(len(waypoints) - 1):
            leg_start_idx = i * (len(truck_state.polyline) // max(len(waypoints) - 1, 1))
            leg_end_idx = (i + 1) * (len(truck_state.polyline) // max(len(waypoints) - 1, 1))
            
            leg_distance = 0.0
            if leg_end_idx < len(truck_state.cumulative_distances):
                leg_distance = truck_state.cumulative_distances[leg_end_idx] - truck_state.cumulative_distances[leg_start_idx]
            
            speed_kmh = truck_state.leg_speeds[i] if i < len(truck_state.leg_speeds) else 0
            duration_s = (leg_distance / 1000 / speed_kmh * 3600) if speed_kmh > 0 else 0
            
            legs.append(RouteLeg(
                from_id=waypoints[i].id,
                to_id=waypoints[i + 1].id,
                distance_m=leg_distance,
                duration_s=duration_s,
                speed_kmh=speed_kmh
            ))
        
        routes.append(TruckRoute(
            truck_id=truck_state.truck_id,
            waypoints=waypoints,
            polyline=polyline,
            legs=legs,
            start_time_iso=truck_state.start_time.isoformat(),
            total_duration_s=sum(leg.duration_s for leg in legs),
            total_distance_m=truck_state.total_distance
        ))
    
    return routes


async def _build_route_for_truck(truck_id: int, waypoints: List[dict], start_time: Optional[datetime] = None, end_time: Optional[datetime] = None) -> Optional[dict]:
    """
    Build a complete route with straight-line polylines and speed calculations.

    Args:
        truck_id: Truck ID
        waypoints: List of waypoint dicts with id, name, lat, lng
        start_time: Optional start time for the route
        end_time: Optional end time for the route

    Returns:
        Route data dict or None
    """
    if len(waypoints) < 2:
        return None

    # Build complete polyline and calculate distances
    complete_polyline = []
    leg_distances = []
    total_distance_km = 0.0

    for i in range(len(waypoints) - 1):
        from_wp = waypoints[i]
        to_wp = waypoints[i + 1]

        # Calculate distance
        distance_km = haversine_distance(
            from_wp['lat'], from_wp['lng'],
            to_wp['lat'], to_wp['lng']
        )
        leg_distances.append(distance_km)
        total_distance_km += distance_km

        # Create straight line segment
        segment = create_straight_line_polyline(
            from_wp['lat'], from_wp['lng'],
            to_wp['lat'], to_wp['lng'],
            num_points=20
        )

        if i == 0:
            complete_polyline.extend(segment)
        else:
            # Skip first point to avoid duplication
            complete_polyline.extend(segment[1:])

    # Calculate speeds
    if start_time and end_time:
        total_time_hours = (end_time - start_time).total_seconds() / 3600.0
        if total_time_hours > 0:
            avg_speed_kmh = total_distance_km / total_time_hours
            avg_speed_kmh = max(20.0, min(avg_speed_kmh, 90.0))  # Clamp to reasonable range
        else:
            avg_speed_kmh = 60.0  # Default
    else:
        avg_speed_kmh = 60.0  # Default speed

    # Build legs with calculated speed
    legs = []
    total_duration = 0.0

    for i in range(len(waypoints) - 1):
        from_wp = waypoints[i]
        to_wp = waypoints[i + 1]
        distance_km = leg_distances[i]

        # Use the average speed for all legs
        speed_kmh = avg_speed_kmh
        duration_s = (distance_km / speed_kmh) * 3600 if speed_kmh > 0 else 0

        legs.append({
            'from_id': from_wp['id'],
            'to_id': to_wp['id'],
            'distance_m': distance_km * 1000,
            'duration_s': duration_s,
            'speed_kmh': speed_kmh
        })

        total_duration += duration_s

    if not start_time:
        start_time = datetime.now(timezone.utc)

    return {
        'truck_id': truck_id,
        'waypoints': [
            {
                'id': w['id'],
                'name': w['name'],
                'lat': w['lat'],
                'lng': w['lng']
            }
            for w in waypoints
        ],
        'polyline': [[lat, lng] for lat, lng in complete_polyline],
        'legs': legs,
        'start_time_iso': start_time.isoformat(),
        'total_duration_s': total_duration,
        'total_distance_m': sum(leg['distance_m'] for leg in legs)
    }


