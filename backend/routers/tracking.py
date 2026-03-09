from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from ..database import SessionLocal
from ..simulation_coordinator import SimulationCoordinator


router = APIRouter(prefix="/api/tracking", tags=["tracking"])

_coordinator = None


def get_coordinator():
    global _coordinator
    if _coordinator is None:
        _coordinator = SimulationCoordinator(SessionLocal)
    return _coordinator


class SpeedUpdate(BaseModel):
    speed_multiplier: float


class RecalculateRequest(BaseModel):
    truck_id: int


@router.get("/positions")
async def get_positions():
    coordinator = get_coordinator()
    return {
        "positions": coordinator.get_all_positions(),
        "speed_multiplier": coordinator.state.speed_multiplier
    }


@router.post("/speed")
async def update_speed(update: SpeedUpdate):
    coordinator = get_coordinator()
    coordinator.set_speed(update.speed_multiplier)
    return {"speed_multiplier": coordinator.state.speed_multiplier}


@router.post("/recalculate")
async def recalculate_truck(request: RecalculateRequest):
    coordinator = get_coordinator()
    success = coordinator.recalculate_truck(request.truck_id)
    return {"success": success, "truck_id": request.truck_id}


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    coordinator = get_coordinator()

    if not coordinator.running:
        await coordinator.start()

    coordinator.add_client(websocket)

    try:
        initial_data = {
            'type': 'initial',
            'positions': coordinator.get_all_positions(),
            'speed_multiplier': coordinator.state.speed_multiplier
        }
        await websocket.send_json(initial_data)

        while True:
            data = await websocket.receive_json()

            if data.get('type') == 'set_speed':
                speed = data.get('speed_multiplier', 1.0)
                coordinator.set_speed(speed)

            elif data.get('type') == 'recalculate':
                truck_id = data.get('truck_id')
                if truck_id:
                    success = coordinator.recalculate_truck(truck_id)
                    await websocket.send_json({
                        'type': 'recalculate_result',
                        'success': success,
                        'truck_id': truck_id
                    })

    except WebSocketDisconnect:
        coordinator.remove_client(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        coordinator.remove_client(websocket)
