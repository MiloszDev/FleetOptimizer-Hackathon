from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models import Vehicle


router = APIRouter(prefix="/api/drivers", tags=["drivers"])


class DriverCountResponse(BaseModel):
    count: int


@router.get("/count", response_model=DriverCountResponse)
def get_driver_count(db: Session = Depends(get_db)):
    """Get total count of drivers/vehicles"""
    count = db.query(Vehicle).count()
    return {"count": count}
