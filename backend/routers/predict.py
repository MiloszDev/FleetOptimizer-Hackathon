from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from ..fleet_opt.predict import predict


router = APIRouter(prefix="/api/algo", tags=["drivers"])


class TruckRoute(BaseModel):
    """Model for a single truck's route assignment"""
    truck_id: int
    routes: List[int]
    
    class Config:
        json_schema_extra = {
            "example": {
                "truck_id": 1,
                "routes": [101, 102, 103, 104]
            }
        }


class PredictionResponse(BaseModel):
    """Response model for prediction endpoint"""
    predictions: List[TruckRoute]
    total_trucks: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "predictions": [
                    {"truck_id": 1, "routes": [101, 102, 103]},
                    {"truck_id": 2, "routes": [201, 202, 203]}
                ],
                "total_trucks": 2
            }
        }


@router.get("/predict", response_model=PredictionResponse)
def get_predictions():
    """Get optimized truck route predictions"""
    results = predict()
    
    return {
        "predictions": results,
        "total_trucks": len(results)
    }