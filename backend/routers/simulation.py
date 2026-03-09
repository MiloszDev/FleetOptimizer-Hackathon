from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import random
import os
import pandas as pd

from ..database import get_db
from ..models import Vehicle, Location

router = APIRouter(prefix="/api/simulation", tags=["simulation"])


class VehiclePosition(BaseModel):
    id: int
    registration_number: str
    brand: str
    latitude: float
    longitude: float
    location_name: str
    current_odometer_km: int
    service_interval_km: int


class VehiclePositionsResponse(BaseModel):
    vehicles: List[VehiclePosition]
    total_count: int


@router.get("/vehicles/positions", response_model=VehiclePositionsResponse)
def get_vehicle_positions(db: Session = Depends(get_db)):
    """
    Get all vehicles with randomly assigned positions from the locations database.
    Each call randomly assigns vehicles to locations to simulate movement.
    """
    # Get all vehicles
    vehicles = db.query(Vehicle).all()

    # Get all locations (for random assignment)
    locations = db.query(Location).all()

    if not locations:
        return VehiclePositionsResponse(vehicles=[], total_count=0)

    vehicle_positions = []

    for vehicle in vehicles:
        # Randomly assign a location to each vehicle
        random_location = random.choice(locations)

        vehicle_positions.append(VehiclePosition(
            id=vehicle.id,
            registration_number=vehicle.registration_number,
            brand=vehicle.brand,
            latitude=random_location.lat,
            longitude=random_location.long,
            location_name=random_location.name,
            current_odometer_km=vehicle.current_odometer_km,
            service_interval_km=vehicle.service_interval_km
        ))

    return VehiclePositionsResponse(
        vehicles=vehicle_positions,
        total_count=len(vehicle_positions)
    )


class LocationData(BaseModel):
    id: int
    name: str
    lat: float
    long: float
    is_hub: bool


class LocationsResponse(BaseModel):
    locations: List[LocationData]
    total_count: int


@router.get("/locations", response_model=LocationsResponse)
def get_locations(db: Session = Depends(get_db)):
    locations = db.query(Location).all()

    location_list = [
        LocationData(
            id=loc.id,
            name=loc.name,
            lat=loc.lat,
            long=loc.long,
            is_hub=loc.is_hub
        )
        for loc in locations
    ]

    return LocationsResponse(
        locations=location_list,
        total_count=len(location_list)
    )


class FinancialStatsResponse(BaseModel):
    relocation_cost_pln: float
    service_cost_pln: float
    penalty_cost_pln: float
    total_cost_pln: float
    routes_assigned: int
    vehicles_used: int
    total_services: int
    total_distance_km: float
    data_available: bool


def get_financial_stats_data():
    """Internal function to get financial stats as dict"""
    stats_file = os.path.join(os.path.dirname(__file__), '..', 'output_merged', 'merged_vehicle_stats.csv')
    
    if not os.path.exists(stats_file):
        return {
            'relocation_cost_pln': 0.0,
            'service_cost_pln': 0.0,
            'penalty_cost_pln': 0.0,
            'total_cost_pln': 0.0,
            'routes_assigned': 0,
            'vehicles_used': 0,
            'total_services': 0,
            'total_distance_km': 0.0,
            'data_available': False
        }
    
    try:
        df = pd.read_csv(stats_file)
        
        if df.empty:
            return {
                'relocation_cost_pln': 0.0,
                'service_cost_pln': 0.0,
                'penalty_cost_pln': 0.0,
                'total_cost_pln': 0.0,
                'routes_assigned': 0,
                'vehicles_used': 0,
                'total_services': 0,
                'total_distance_km': 0.0,
                'data_available': False
            }
        
        relocation_cost = float(df['relocation_cost_pln'].sum())
        service_cost = float(df['service_cost_pln'].sum())
        penalty_cost = float(df['penalty_cost_pln'].sum())
        total_cost = relocation_cost + service_cost + penalty_cost
        
        vehicles_used = int((df['assigned_routes_count'] > 0).sum())
        routes_assigned = int(df['assigned_routes_count'].sum())
        total_services = int(df['services_taken'].sum())
        total_distance = float(df['total_distance_km'].sum())
        
        return {
            'relocation_cost_pln': relocation_cost,
            'service_cost_pln': service_cost,
            'penalty_cost_pln': penalty_cost,
            'total_cost_pln': total_cost,
            'routes_assigned': routes_assigned,
            'vehicles_used': vehicles_used,
            'total_services': total_services,
            'total_distance_km': total_distance,
            'data_available': True
        }
    except Exception as e:
        print(f"Error reading financial stats: {e}")
        return {
            'relocation_cost_pln': 0.0,
            'service_cost_pln': 0.0,
            'penalty_cost_pln': 0.0,
            'total_cost_pln': 0.0,
            'routes_assigned': 0,
            'vehicles_used': 0,
            'total_services': 0,
            'total_distance_km': 0.0,
            'data_available': False
        }


@router.get("/financial-stats", response_model=FinancialStatsResponse)
def get_financial_stats():
    """Get financial statistics from the simulation results"""
    return FinancialStatsResponse(**get_financial_stats_data())


class SimulationTimeResponse(BaseModel):
    current_time: datetime
    simulation_start: datetime
    simulation_speed: float
    is_running: bool
    elapsed_days: int


@router.get("/time", response_model=SimulationTimeResponse)
def get_simulation_time():
    """Get current simulation time and status from the coordinator"""
    from ..routers.tracking import get_coordinator
    from ..fleet_opt.config import SIM_START_DATE
    
    coordinator = get_coordinator()
    
    # Get the actual simulation time from coordinator
    current_sim_time = coordinator.state.last_update if coordinator.running else datetime.now()
    elapsed = (current_sim_time - SIM_START_DATE).days if coordinator.running else 0
    
    return SimulationTimeResponse(
        current_time=current_sim_time,
        simulation_start=SIM_START_DATE,
        simulation_speed=coordinator.state.speed_multiplier,
        is_running=coordinator.running,
        elapsed_days=elapsed
    )
