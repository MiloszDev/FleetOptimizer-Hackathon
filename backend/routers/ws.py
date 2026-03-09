from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import uuid

from ..simulator import get_simulator


router = APIRouter()


@router.websocket("/ws/positions")
async def websocket_positions(websocket: WebSocket):
    await websocket.accept()

    connection_id = str(uuid.uuid4())
    simulator = get_simulator()

    # Ensure simulator is running (lazy start)
    if not simulator.is_running():
        try:
            await simulator.start()
        except Exception as e:
            await websocket.send_json({"type": "error", "message": f"Simulator start failed: {e}"})

    # Register connection
    simulator.add_connection(connection_id)

    # Store websocket reference
    if connection_id in simulator.connections:
        simulator.connections[connection_id].websocket = websocket

    try:
        while True:
            data = await websocket.receive_json()

            if data.get('type') == 'subscribe':
                bbox = data.get('bbox')
                zoom = data.get('zoom', 10)

                if bbox and isinstance(bbox, list) and len(bbox) == 4:
                    simulator.update_connection_bbox(connection_id, bbox, zoom)

            elif data.get('type') == 'unsubscribe':
                simulator.update_connection_bbox(connection_id, None, None)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        simulator.remove_connection(connection_id)


