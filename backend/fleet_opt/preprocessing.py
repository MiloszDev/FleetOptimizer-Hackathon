from tqdm import tqdm


def build_distance_time_map(relations):
    print("\nBuilding distance and time map...")
    
    distance_map = {}
    
    for _, row in tqdm(relations.iterrows(), total=len(relations), 
                      desc="Processing relations", unit="rel"):
        loc1, loc2 = row['id_loc_1'], row['id_loc_2']
        
        info = {
            "dist": row['dist'],
            "hours": row['time'] / 60.0  # Convert minutes to hours
        }
        
        # Assume symmetric relations
        distance_map[(loc1, loc2)] = info
        distance_map[(loc2, loc1)] = info
    
    print(f"✓ Built map with {len(distance_map)} connections.")
    return distance_map


def build_route_info_map(routes, segments):
    print("\nMapping start/end locations for all routes...")
    
    # Filter segments to only those needed
    relevant_route_ids = set(routes['id'])
    segments_filtered = segments[segments['route_id'].isin(relevant_route_ids)]
    
    if segments_filtered.empty:
        print("✗ ERROR: No matching segments for selected routes.")
        return {}

    # Map start locations (first segment)
    segments_sorted = segments_filtered.sort_values(['route_id', 'seq'])
    first_segments = segments_sorted.groupby('route_id').first()
    route_to_start_loc = dict(zip(first_segments.index, first_segments['start_loc_id']))
    
    # Map end locations (last segment)
    last_segments = segments_sorted.groupby('route_id').last()
    route_to_end_loc = dict(zip(last_segments.index, last_segments['end_loc_id']))
    
    # Build location sequences for each route
    route_locations = {}
    for route_id in segments_sorted['route_id'].unique():
        route_segs = segments_sorted[segments_sorted['route_id'] == route_id]
        location_seq = [route_segs.iloc[0]['start_loc_id']]
        for _, seg in route_segs.iterrows():
            location_seq.append(seg['end_loc_id'])
        route_locations[route_id] = location_seq

    # Build comprehensive route information map
    route_info_map = {}

    print("Building final route information map...")
    for _, row in tqdm(routes.iterrows(), total=len(routes),
                      desc="Processing routes", unit="route"):
        route_id = row['id']
        route_info_map[route_id] = {
            "id": route_id,
            "start_time": row['start_datetime'],
            "end_time": row['end_datetime'],
            "distance_km": row['distance_km'],
            "start_location": route_to_start_loc.get(route_id),
            "end_location": route_to_end_loc.get(route_id),
            "locations": route_locations.get(route_id, [])
        }
    
    print(f"✓ Built information map for {len(route_info_map)} routes.")
    return route_info_map


def prepare_simulation_data(vehicles, locations, routes, segments, relations):
    distance_map = build_distance_time_map(relations)
    route_info_map = build_route_info_map(routes, segments)
    
    return distance_map, route_info_map