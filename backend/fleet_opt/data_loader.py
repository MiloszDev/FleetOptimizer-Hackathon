import pandas as pd
from .config import INPUT_FILES


def load_hackathon_data(start_date_filter=None, end_date_filter=None):
    print("Loading data...")
    
    try:
        # Load all CSV files
        vehicles = pd.read_csv(INPUT_FILES['vehicles'])
        locations = pd.read_csv(INPUT_FILES['locations'])
        routes_all = pd.read_csv(INPUT_FILES['routes'])
        segments = pd.read_csv(INPUT_FILES['segments'])
        relations = pd.read_csv(INPUT_FILES['relations'])

        # Convert datetime columns
        routes_all['start_datetime'] = pd.to_datetime(routes_all['start_datetime'])
        routes_all['end_datetime'] = pd.to_datetime(routes_all['end_datetime'])

        routes = routes_all.copy()
        
        if start_date_filter:
            routes = routes[routes['start_datetime'] >= pd.to_datetime(start_date_filter)]
        if end_date_filter:
            routes = routes[routes['start_datetime'] < pd.to_datetime(end_date_filter)]
        
        if len(routes) == 0:
            print(f"✗ ERROR: No routes found in date range {start_date_filter} - {end_date_filter}.")
            return None, None, None, None, None
            
        # Print summary
        print(f"✓ Vehicles: {len(vehicles)}")
        print(f"✓ Locations: {len(locations)}")
        print(f"✓ Routes: {len(routes)} (from {len(routes_all)} total) in date range")
        print(f"✓ Route segments: {len(segments)}")
        print(f"✓ Location relations: {len(relations)}")
        
        return vehicles, locations, routes, segments, relations
        
    except FileNotFoundError as e:
        print(f"✗ Error: File not found - {e.filename}")
        return None, None, None, None, None
    except Exception as e:
        print(f"✗ Error loading data: {str(e)}")
        return None, None, None, None, None

