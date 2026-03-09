import warnings

from typing import List, Dict, Any

warnings.filterwarnings('ignore')

from .config import START_DATE, END_DATE, SIM_START_DATE
from .data_loader import load_hackathon_data
from .preprocessing import prepare_simulation_data
from .simulator import run_simulation


def predict() -> List[Dict[str, Any]]:
    # Step 1: Load data (from main.py)
    data = load_hackathon_data(START_DATE, END_DATE)
    if data[0] is None:
        return []
    
    vehicles, locations, routes, segments, relations = data
    
    # Validate data (from main.py)
    if not validate_data(vehicles, locations, routes, segments, relations):
        return []
    
    # Step 2: Preprocessing (from main.py)
    distance_map, route_info_map = prepare_simulation_data(
        vehicles, locations, routes, segments, relations
    )
    
    if not distance_map or not route_info_map:
        return []
    
    # Step 3: Run simulation (from main.py)
    assignments, vehicle_states = run_simulation(
        vehicles, locations, route_info_map, distance_map, SIM_START_DATE
    )
    
    print(f"DEBUG: Got {len(assignments)} assignments")
    print(f"DEBUG: Sample assignment: {assignments[0] if assignments else 'None'}")
    print(f"DEBUG: Sample route_info: {list(route_info_map.items())[0] if route_info_map else 'None'}")
    
    # Step 4: Format results for production output
    results = format_results(assignments, route_info_map)
    
    return results


def format_results(assignments: List[Dict], route_info_map: Dict) -> List[Dict[str, Any]]:
    if not assignments:
        print("WARNING: No assignments to format")
        return []
    
    # Group assignments by vehicle (maintaining order)
    vehicle_routes = {}
    
    for assignment in assignments:
        try:
            vehicle_id = int(assignment['vehicle_id'])  # Convert to native Python int
            route_id = assignment['route_id']
            
            if vehicle_id not in vehicle_routes:
                vehicle_routes[vehicle_id] = []
            
            # Get the locations visited for this route
            if route_id in route_info_map:
                route_info = route_info_map[route_id]
                
                # Handle different possible structures
                locations = []
                if isinstance(route_info, dict):
                    # Check for various possible keys
                    locations = route_info.get('locations', 
                               route_info.get('location_ids',
                               route_info.get('stops', [])))
                elif isinstance(route_info, (list, tuple)):
                    # If route_info is the locations list directly
                    locations = route_info
                
                # Convert all location IDs to native Python ints
                locations = [int(loc) for loc in locations]
                
                if locations:
                    vehicle_routes[vehicle_id].extend(locations)
                else:
                    print(f"WARNING: No locations found for route {route_id}")
                    print(f"  route_info structure: {type(route_info)}")
                    if isinstance(route_info, dict):
                        print(f"  route_info keys: {route_info.keys()}")
            else:
                print(f"WARNING: Route {route_id} not found in route_info_map")
        
        except Exception as e:
            print(f"ERROR processing assignment: {e}")
            print(f"  assignment: {assignment}")
            continue
    
    # Format into required output structure
    results = []
    for truck_id in sorted(vehicle_routes.keys()):
        routes = vehicle_routes[truck_id]
        
        # Ensure we have valid routes
        if not routes:
            print(f"WARNING: Truck {truck_id} has no routes")
            continue
        
        results.append({
            "truck_id": int(truck_id),  # Ensure native Python int
            "routes": routes
        })
    
    print(f"INFO: Formatted {len(results)} trucks with routes")
    return results


def format_results_alternative(assignments: List[Dict], route_info_map: Dict) -> List[Dict[str, Any]]:
    results = []
    
    for assignment in assignments:
        try:
            vehicle_id = int(assignment['vehicle_id'])
            route_id = assignment['route_id']
            
            if route_id in route_info_map:
                route_info = route_info_map[route_id]
                
                locations = []
                if isinstance(route_info, dict):
                    locations = route_info.get('locations', [])
                    
                elif isinstance(route_info, list):
                    locations = route_info
                
                locations = [int(loc) for loc in locations]
                
                if locations:
                    results.append({
                        "truck_id": vehicle_id,
                        "routes": locations
                    })
        except Exception as e:
            print(f"ERROR: {e}")
            continue
    
    return results