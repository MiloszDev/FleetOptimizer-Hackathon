"""
Fleet Optimization System - Simulation Engine
Main algorithm for time-based route assignment with realistic costs
"""
import random
import pandas as pd
from tqdm import tqdm
from .vehicle_state import VehicleState


class FleetSimulator:
    """
    Time-based fleet simulation with realistic cost modeling
    """
    
    def __init__(self, vehicles, locations, route_info_map, distance_map, sim_start_date):
        """
        Initialize simulator
        
        Args:
            vehicles: DataFrame with vehicle data
            locations: DataFrame with location data
            route_info_map: Dictionary with route information
            distance_map: Dictionary with distances and times
            sim_start_date: Simulation start date
        """
        self.vehicles_df = vehicles
        self.locations = locations
        self.route_info_map = route_info_map
        self.distance_map = distance_map
        self.sim_start_date = sim_start_date
        
        self.vehicle_states = []
        self.assignments = []
        self.unassigned_count = 0

    def initialize_vehicles(self):
        """Initialize vehicle states with starting locations"""
        print("Initializing vehicle states...")
        
        # Get hub locations for random assignment
        hub_ids = self.locations[self.locations['is_hub'] == 1]['id'].tolist()
        if not hub_ids:
            hub_ids = self.locations.sample(
                min(20, len(self.locations))
            )['id'].tolist()
        
        # Create vehicle state for each vehicle
        for _, v_row in self.vehicles_df.iterrows():
            start_loc_from_csv = v_row['Current_location_id']
            
            # Handle N/A or missing locations
            if pd.isna(start_loc_from_csv) or str(start_loc_from_csv).strip() == 'N/A':
                final_start_loc = random.choice(hub_ids)
            else:
                final_start_loc = start_loc_from_csv
                
            self.vehicle_states.append(
                VehicleState(v_row, final_start_loc, self.sim_start_date)
            )
        
        print(f"✓ {len(self.vehicle_states)} vehicles ready (virtually positioned).")

    def run(self):
        """
        Execute main simulation algorithm
        
        Returns:
            tuple: (assignments, vehicle_states)
        """
  
        # Initialize vehicles
        self.initialize_vehicles()
        
        # Sort routes chronologically
        print("Sorting routes chronologically...")
        sorted_route_ids = sorted(
            self.route_info_map.keys(), 
            key=lambda rid: self.route_info_map[rid]['start_time']
        )
        
        print(f"✓ {len(sorted_route_ids)} routes ready for assignment.")
        
        if not sorted_route_ids:
            print("⚠️ No routes to process in selected date range.")
            return self.assignments, self.vehicle_states
        
     
        
        for route_id in tqdm(sorted_route_ids, desc="Processing routes", unit="route"):
            self._process_route(route_id)
        
        # Print summary
        print(f"\n✅ COMPLETE!")
        print(f"📦 Assigned {len(self.assignments)} routes.")
        
        return self.assignments, self.vehicle_states

    def _process_route(self, route_id):
        route_info = self.route_info_map[route_id]
        
        # Skip routes with missing location data
        if route_info['start_location'] is None or route_info['end_location'] is None:
            self.unassigned_count += 1
            return

        # Find best vehicle for this route
        best_vehicle = None
        best_cost = float('inf')
        best_cost_breakdown = {}
        best_update_info = {}

        for vehicle_state in self.vehicle_states:
            cost, cost_breakdown, update_info = vehicle_state.calculate_assignment_cost(
                route_info, self.distance_map
            )
            
            if cost < best_cost:
                best_cost = cost
                best_vehicle = vehicle_state
                best_cost_breakdown = cost_breakdown
                best_update_info = update_info

        # Assign route if vehicle found
        if best_vehicle is not None:
            # Record assignment
            self.assignments.append({
                'route_id': route_id,
                'vehicle_id': best_vehicle.vehicle_id,
                'vehicle_registration': best_vehicle.registration,
                'relocation_cost_pln': best_cost_breakdown['relocation'],
                'service_cost_pln': best_cost_breakdown['service'],
                'penalty_cost_pln': best_cost_breakdown['penalty'],
                'total_assignment_cost': best_cost
            })
            
            # Update vehicle state
            best_vehicle.assign_route(route_info, best_cost_breakdown, best_update_info)
        else:
            # No vehicle available
            self.unassigned_count += 1


def run_simulation(vehicles, locations, route_info_map, distance_map, sim_start_date):
    return FleetSimulator(vehicles, locations, route_info_map, distance_map, sim_start_date).run()