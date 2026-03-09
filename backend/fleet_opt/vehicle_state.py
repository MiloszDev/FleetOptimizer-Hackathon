"""
Fleet Optimization System - Vehicle State Management
Tracks vehicle state including location, mileage, services, and costs
"""
from datetime import timedelta
from .config import (PENALTY_RATE, SERVICE_COST, SERVICE_HOURS,
                   EMPTY_FIXED_COST, EMPTY_KM_COST, EMPTY_HOUR_COST)


class VehicleState:
    
    def __init__(self, vehicle_row, start_location, sim_start_date):
        # Basic info
        self.vehicle_id = vehicle_row['Id']
        self.registration = vehicle_row['registration_number']
        
        # Leasing model (annual limits)
        self.annual_limit = vehicle_row['leasing_limit_km']
        self.total_distance = 0.0  # Distance traveled this year
        
        # Service model
        self.service_interval = vehicle_row['service_interval_km']
        self.current_odometer = vehicle_row['current_odometer_km']
        km_since_service = self.current_odometer % self.service_interval
        self.km_until_service = self.service_interval - km_since_service
        self.services_taken = 0
        
        # Location and time tracking
        self.current_location = start_location
        self.available_from = sim_start_date
        
        # Cost tracking
        self.assigned_routes = []
        self.total_relocation_cost = 0.0
        self.total_service_cost = 0.0
        self.total_penalty_cost = 0.0

    def get_overage_km(self):
        return max(0, self.total_distance - self.annual_limit)

    def get_total_cost(self):
        return (self.total_relocation_cost + 
                self.total_service_cost + 
                self.total_penalty_cost)

    def calculate_assignment_cost(self, route_info, distance_map):
        costs = {
            "relocation": 0.0,
            "service": 0.0,
            "penalty": 0.0,
            "total": 0.0
        }
        
        reloc_dist = 0.0
        reloc_hours = 0.0
        
        if self.current_location != route_info['start_location']:
            reloc_info = distance_map.get(
                (self.current_location, route_info['start_location'])
            )
            
            if reloc_info is None:
                return float('inf'), costs, {}
                
            reloc_dist = reloc_info['dist']
            reloc_hours = reloc_info['hours']
            
            costs['relocation'] = (EMPTY_FIXED_COST + 
                                  (reloc_dist * EMPTY_KM_COST) + 
                                  (reloc_hours * EMPTY_HOUR_COST))
        
        vehicle_arrival_time = self.available_from + timedelta(hours=reloc_hours)
        
        if vehicle_arrival_time > route_info['start_time']:
            return float('inf'), costs, {}

        route_dist = route_info['distance_km']
        if route_dist > self.km_until_service:
            costs['service'] = SERVICE_COST

        current_overage = self.get_overage_km()
        new_total_dist = self.total_distance + route_dist + reloc_dist
        new_overage = max(0, new_total_dist - self.annual_limit)
        
        additional_overage = new_overage - current_overage
        if additional_overage > 0:
            costs['penalty'] = additional_overage * PENALTY_RATE

        costs['total'] = (costs['relocation'] + 
                         costs['service'] + 
                         costs['penalty'])
        
        update_info = {
            "reloc_dist": reloc_dist,
            "reloc_hours": reloc_hours,
            "route_dist": route_dist,
            "service_needed": (costs['service'] > 0)
        }
        
        return costs['total'], costs, update_info

    def assign_route(self, route_info, cost_breakdown, update_info):

        route_dist = update_info['route_dist']
        reloc_dist = update_info['reloc_dist']
        
        self.assigned_routes.append(route_info['id'])
        
        self.current_location = route_info['end_location']
        
        arrival_time = self.available_from + timedelta(hours=update_info['reloc_hours'])
        self.available_from = max(arrival_time, route_info['end_time'])
         
        self.total_distance += route_dist + reloc_dist
        
        self.total_relocation_cost += cost_breakdown['relocation']
        self.total_penalty_cost += cost_breakdown['penalty']
        
        if update_info['service_needed']:
            self.services_taken += 1
            self.total_service_cost += cost_breakdown['service']
            self.km_until_service = self.service_interval
            self.available_from += timedelta(hours=SERVICE_HOURS)
        else:
            self.km_until_service -= route_dist

    def to_dict(self):
        return {
            'vehicle_id': self.vehicle_id,
            'vehicle_registration': self.registration,
            'assigned_routes_count': len(self.assigned_routes),
            'total_distance_km': self.total_distance,
            'annual_limit_km': self.annual_limit,
            'overage_km': self.get_overage_km(),
            'services_taken': self.services_taken,
            'relocation_cost_pln': self.total_relocation_cost,
            'service_cost_pln': self.total_service_cost,
            'penalty_cost_pln': self.total_penalty_cost,
            'total_vehicle_cost': self.get_total_cost()
        }