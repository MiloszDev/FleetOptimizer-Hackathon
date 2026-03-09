from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta

from ..database import get_db
from ..models import Vehicle


router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])

# In-memory event log
_event_log: List[dict] = []
_last_event_time = {}
MAX_EVENTS = 1000
EVENT_COOLDOWN = 60


def add_event(event_type: str, message: str, vehicle_id: Optional[int] = None, 
              registration_number: Optional[str] = None, severity: str = "info"):
    global _event_log, _last_event_time
    
    event_key = f"{event_type}_{vehicle_id}_{registration_number}"
    now = datetime.now()
    
    if event_key in _last_event_time:
        elapsed = (now - _last_event_time[event_key]).seconds
        if elapsed < EVENT_COOLDOWN:
            return
    
    _last_event_time[event_key] = now
    
    event = {
        "timestamp": now.isoformat(),
        "type": event_type,
        "message": message,
        "vehicle_id": vehicle_id,
        "registration_number": registration_number,
        "severity": severity
    }
    _event_log.append(event)
    
    if len(_event_log) > MAX_EVENTS:
        _event_log = _event_log[-MAX_EVENTS:]


class VehicleCountResponse(BaseModel):
    count: int

@router.get("/count", response_model=VehicleCountResponse)
def get_vehicle_count(db: Session = Depends(get_db)):
    """Get total count of vehicles"""
    count = db.query(Vehicle).count()
    return {"count": count}


class VehicleLeaseInfo(BaseModel):
    id: int
    registration_number: str
    brand: str
    leasing_end_date: datetime
    days_remaining: int


class VehicleServiceInfo(BaseModel):
    id: int
    registration_number: str
    brand: str
    current_odometer_km: int
    service_interval_km: int
    km_until_service: int


class QuickStatsResponse(BaseModel):
    top_3_lease_ending: List[VehicleLeaseInfo]
    top_3_service_needed: List[VehicleServiceInfo]
    vehicles_over_limit: int
    total_services_needed: int
    average_odometer: float
    total_km_driven: float
    vehicles_needing_replacement: int
    average_days_to_lease_end: float


def get_quick_stats_data(db: Session):
    """Internal function to get quick stats as dict"""
    
    # Get all vehicles
    vehicles_all = db.query(Vehicle).all()
    
    # TOP 3 vehicles closest to lease end (only with positive days remaining)
    vehicles_lease = db.query(Vehicle).filter(
        Vehicle.leasing_end_date.isnot(None)
    ).all()
    
    lease_list = []
    total_days_to_lease = 0
    valid_lease_count = 0
    
    for v in vehicles_lease:
        if v.leasing_end_date:
            days_remaining = (v.leasing_end_date - datetime.now()).days
            if days_remaining > 0:  # Only include vehicles with positive days
                lease_list.append((v, days_remaining))
                total_days_to_lease += days_remaining
                valid_lease_count += 1
    
    lease_list.sort(key=lambda x: x[1])
    top_3_lease = [
        VehicleLeaseInfo(
            id=v.id,
            registration_number=v.registration_number,
            brand=v.brand,
            leasing_end_date=v.leasing_end_date,
            days_remaining=days_remaining
        )
        for v, days_remaining in lease_list[:3]
    ]
    
    # TOP 3 vehicles closest to service
    service_list = []
    for v in vehicles_all:
        if v.service_interval_km and v.current_odometer_km:
            km_until_service = v.service_interval_km - (v.current_odometer_km % v.service_interval_km)
            service_list.append((v, km_until_service))
    
    service_list.sort(key=lambda x: x[1])
    top_3_service = [
        VehicleServiceInfo(
            id=v.id,
            registration_number=v.registration_number,
            brand=v.brand,
            current_odometer_km=v.current_odometer_km,
            service_interval_km=v.service_interval_km,
            km_until_service=km_until_service
        )
        for v, km_until_service in service_list[:3]
    ]
    
    # Count vehicles over leasing limit
    vehicles_over_limit = 0
    vehicles_needing_replacement = 0
    total_km = 0
    
    for v in vehicles_all:
        if v.current_odometer_km:
            total_km += v.current_odometer_km
            
        if v.leasing_limit_km and v.current_odometer_km:
            total_driven = v.current_odometer_km - (v.leasing_start_km or 0)
            if total_driven > v.leasing_limit_km:
                vehicles_over_limit += 1
                # If significantly over limit or lease expired, needs replacement
                if total_driven > v.leasing_limit_km * 1.2 or (
                    v.leasing_end_date and (v.leasing_end_date - datetime.now()).days < 0
                ):
                    vehicles_needing_replacement += 1
    
    # Count vehicles needing service soon (< 500km)
    services_needed = sum(1 for v, km in service_list if km < 500)
    
    # Calculate average odometer
    avg_odometer = total_km / len(vehicles_all) if vehicles_all else 0
    avg_days_to_lease = total_days_to_lease / valid_lease_count if valid_lease_count > 0 else 0
    
    for v, km in service_list[:5]:
        if km < 100:
            add_event("service_urgent", f"Pilny serwis: {v.registration_number} za {km} km", 
                     v.id, v.registration_number, "error")
    
    for v, days in lease_list[:3]:
        if days < 30:
            add_event("lease_expiring", f"Leasing wygasa: {v.registration_number} za {days} dni",
                     v.id, v.registration_number, "warning")
    
    if vehicles_needing_replacement > 0:
        add_event("fleet_alert", f"Wymagana wymiana {vehicles_needing_replacement} pojazdów",
                 None, None, "info")
    
    return {
        'top_3_lease_ending': [
            {
                'id': v.id,
                'registration_number': v.registration_number,
                'brand': v.brand,
                'leasing_end_date': v.leasing_end_date.isoformat(),
                'days_remaining': days
            }
            for v, days in lease_list[:3]
        ],
        'top_3_service_needed': [
            {
                'id': v.id,
                'registration_number': v.registration_number,
                'brand': v.brand,
                'current_odometer_km': v.current_odometer_km,
                'service_interval_km': v.service_interval_km,
                'km_until_service': km
            }
            for v, km in service_list[:3]
        ],
        'vehicles_over_limit': vehicles_over_limit,
        'total_services_needed': services_needed,
        'average_odometer': avg_odometer,
        'total_km_driven': total_km,
        'vehicles_needing_replacement': vehicles_needing_replacement,
        'average_days_to_lease_end': avg_days_to_lease
    }


@router.get("/quick-stats", response_model=QuickStatsResponse)
def get_quick_stats(db: Session = Depends(get_db)):
    """Get quick statistics for dashboard"""
    data = get_quick_stats_data(db)
    return QuickStatsResponse(**data)


class EventLogEntry(BaseModel):
    timestamp: str
    type: str
    message: str
    vehicle_id: Optional[int]
    registration_number: Optional[str]
    severity: str


class EventLogResponse(BaseModel):
    events: List[EventLogEntry]
    total_count: int


@router.get("/events", response_model=EventLogResponse)
def get_events(limit: int = 100, severity: Optional[str] = None):
    """Get recent events/logs"""
    global _event_log
    
    events = _event_log
    
    # Filter by severity if specified
    if severity:
        events = [e for e in events if e["severity"] == severity]
    
    # Sort by timestamp descending (newest first)
    events = sorted(events, key=lambda x: x["timestamp"], reverse=True)
    
    # Apply limit
    events = events[:limit]
    
    return EventLogResponse(
        events=[EventLogEntry(**e) for e in events],
        total_count=len(_event_log)
    )
