# Backend Documentation

## Overview

The backend is built with **FastAPI**, a modern Python web framework, and provides REST API endpoints and WebSocket connections for real-time fleet tracking and optimization.

## Architecture

### Core Components

```
backend/
├── fleet_opt/                    # Fleet optimization engine
├── routers/                      # API route handlers
├── main.py                       # Application entry point
├── models.py                     # SQLAlchemy database models
├── database.py                   # Database configuration
├── simulation_coordinator.py     # Real-time simulation engine
└── seed_db.py                    # Database initialization
```

## Installation

### Requirements

- Python 3.8 or higher
- pip (Python package manager)

### Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Dependencies

```
fastapi          # Web framework
uvicorn          # ASGI server
sqlalchemy       # ORM and database toolkit
pandas           # Data processing
```

## Database

### Models

The application uses SQLAlchemy ORM with the following models defined in [models.py](../backend/models.py):

#### Location
Represents geographic points (hubs and delivery locations).

```python
class Location(Base):
    __tablename__ = "locations"

    id: int                    # Primary key
    name: str                  # Location name
    latitude: float            # Latitude coordinate
    longitude: float           # Longitude coordinate
    is_hub: bool              # Whether location is a hub
```

#### LocationRelation
Distance and time matrix between locations.

```python
class LocationRelation(Base):
    __tablename__ = "location_relations"

    id: int                    # Primary key
    from_location_id: int      # Start location (FK)
    to_location_id: int        # End location (FK)
    distance_km: float         # Distance in kilometers
    duration_hours: float      # Travel time in hours
```

#### Vehicle
Fleet inventory with leasing and service information.

```python
class Vehicle(Base):
    __tablename__ = "vehicles"

    id: int                    # Primary key
    registration_number: str   # License plate
    lease_km_limit: float      # Leasing kilometer limit
    current_odometer: float    # Current mileage
    service_interval_km: float # Service interval
    km_to_next_service: float  # Kilometers until service
    current_location_id: int   # Current location (FK)
    is_available: bool        # Availability status
```

#### Route
Transport route definitions.

```python
class Route(Base):
    __tablename__ = "routes"

    id: int                    # Primary key
    route_name: str           # Route identifier
    start_time: datetime      # Route start time
    end_time: datetime        # Route end time
```

#### Segment
Individual segments of a route.

```python
class Segment(Base):
    __tablename__ = "segments"

    id: int                    # Primary key
    route_id: int             # Parent route (FK)
    from_location_id: int     # Start location (FK)
    to_location_id: int       # End location (FK)
    distance_km: float        # Segment distance
    duration_hours: float     # Segment duration
    sequence_number: int      # Order in route
```

### Database Initialization

The database is initialized using [seed_db.py](../backend/seed_db.py):

```bash
python seed_db.py
```

This script:
1. Creates SQLite database (`logistics.db`)
2. Loads data from CSV files in `__CSV_DATA/`:
   - `locations.csv` → locations table
   - `locations_relations.csv` → location_relations table
   - `vehicles.csv` → vehicles table
   - `routes.csv` → routes table
   - `segments.csv` → segments table
3. Runs the fleet optimization algorithm
4. Stores optimized routes and vehicle states

## API Endpoints

### Application Entry Point

**File**: [main.py](../backend/main.py)

The FastAPI application includes:
- CORS middleware for cross-origin requests
- Router mounting for organized endpoints
- OpenAPI documentation at `/docs`

### Vehicle Endpoints

**Router**: [routers/vehicles.py](../backend/routers/vehicles.py)

#### `GET /api/vehicles/count`
Returns total number of vehicles in the fleet.

**Response**:
```json
{
  "count": 100
}
```

#### `GET /api/vehicles/quick-stats`
Returns dashboard quick statistics.

**Response**:
```json
{
  "top_3_closest_to_lease_expiration": [
    {
      "registration_number": "ABC123",
      "current_odometer": 95000,
      "lease_km_limit": 100000,
      "km_remaining": 5000,
      "percentage_used": 95.0
    }
  ],
  "top_3_needing_service": [...],
  "vehicles_over_lease_limit": [...],
  "average_odometer": 45000,
  "vehicles_needing_replacement": 5
}
```

#### `GET /api/vehicles/events`
Returns event log with optional filtering.

**Query Parameters**:
- `event_type` (optional): Filter by event type
- `limit` (optional): Maximum number of events
- `offset` (optional): Pagination offset

**Response**:
```json
{
  "events": [
    {
      "timestamp": "2024-01-15T10:30:00",
      "event_type": "route_start",
      "vehicle_id": "ABC123",
      "message": "Vehicle started route R001",
      "metadata": {...}
    }
  ],
  "total": 150
}
```

### Simulation Endpoints

**Router**: [routers/simulation.py](../backend/routers/simulation.py)

#### `GET /api/simulation/vehicles/positions`
Returns current positions of all vehicles.

**Response**:
```json
{
  "vehicles": [
    {
      "id": "ABC123",
      "latitude": 52.2297,
      "longitude": 21.0122,
      "speed": 80.5,
      "heading": 45,
      "status": "in_transit"
    }
  ]
}
```

#### `GET /api/simulation/locations`
Returns all locations with coordinates.

**Response**:
```json
{
  "locations": [
    {
      "id": 1,
      "name": "Warsaw Hub",
      "latitude": 52.2297,
      "longitude": 21.0122,
      "is_hub": true
    }
  ]
}
```

#### `GET /api/simulation/financial-stats`
Returns financial statistics and costs.

**Response**:
```json
{
  "total_relocation_cost": 125000.50,
  "total_service_cost": 96000.00,
  "total_penalty_cost": 45600.00,
  "routes_assigned": 350,
  "total_distance_km": 125000
}
```

#### `GET /api/simulation/time`
Returns current simulation time and status.

**Response**:
```json
{
  "current_time": "2024-01-15T14:30:00",
  "speed_multiplier": 100,
  "is_running": true,
  "start_time": "2024-01-01T00:00:00",
  "end_time": "2024-04-01T00:00:00"
}
```

### Tracking WebSocket

**Router**: [routers/ws.py](../backend/routers/ws.py)

#### WebSocket `/api/tracking/ws`
Establishes WebSocket connection for real-time updates.

**Message Format** (Server → Client):
```json
{
  "type": "position_update",
  "data": {
    "vehicles": [
      {
        "id": "ABC123",
        "latitude": 52.2297,
        "longitude": 21.0122,
        "speed": 80.5,
        "heading": 45,
        "odometer": 45123.5,
        "status": "in_transit",
        "current_route": "R001"
      }
    ],
    "timestamp": "2024-01-15T14:30:00"
  }
}
```

**Statistics Update** (every ~4 seconds):
```json
{
  "type": "stats_update",
  "data": {
    "financial_stats": {...},
    "quick_stats": {...}
  }
}
```

#### `POST /api/tracking/speed`
Updates simulation speed multiplier.

**Request Body**:
```json
{
  "speed": 100
}
```

#### `POST /api/tracking/recalculate`
Recalculates route for a specific vehicle.

**Request Body**:
```json
{
  "vehicle_id": "ABC123"
}
```

## Fleet Optimization Module

### Data Loader

**File**: [fleet_opt/data_loader.py](../backend/fleet_opt/data_loader.py)

Loads CSV data into pandas DataFrames:
- `load_vehicles()` - Fleet inventory
- `load_locations()` - Geographic points
- `load_routes()` - Route definitions
- `load_segments()` - Route segments
- `load_location_relations()` - Distance matrix

### Vehicle State

**File**: [fleet_opt/vehicle_state.py](../backend/fleet_opt/vehicle_state.py)

Manages vehicle state during simulation:
```python
class VehicleState:
    current_location: str       # Current location
    available_from: datetime    # Next availability time
    odometer: float            # Current mileage
    routes_completed: List[str] # Completed routes
    service_due_at: float      # Service threshold

    def needs_service(self) -> bool
    def update_odometer(self, km: float)
    def move_to(self, location: str, arrival_time: datetime)
```

### Cost Analysis

**File**: [fleet_opt/analyzer.py](../backend/fleet_opt/analyzer.py)

Cost calculation functions:

```python
def calculate_relocation_cost(distance_km: float, time_hours: float) -> float:
    """
    Calculates empty relocation cost.
    - Fixed: 1000 PLN
    - Variable: 1.0 PLN/km
    - Time: 150 PLN/hour
    """
    return 1000 + (distance_km * 1.0) + (time_hours * 150)

def calculate_service_cost() -> float:
    """
    Returns service cost: 9600 PLN
    Downtime: 48 hours
    """
    return 9600

def calculate_penalty_cost(over_limit_km: float) -> float:
    """
    Calculates leasing penalty: 0.92 PLN/km over limit
    """
    return over_limit_km * 0.92
```

### Fleet Simulator

**File**: [fleet_opt/simulator.py](../backend/fleet_opt/simulator.py)

Main optimization algorithm:

```python
class FleetSimulator:
    def __init__(self, vehicles_df, locations_df, routes_df, segments_df, relations_df)

    def simulate(self) -> Dict:
        """
        Runs greedy optimization:
        1. Initialize vehicles at hubs
        2. Sort routes chronologically
        3. For each route:
           - Find available vehicles
           - Calculate total cost (relocation + service + penalty)
           - Assign to vehicle with minimum cost
           - Update vehicle state

        Returns:
            {
                'assignments': [...],
                'total_relocation_cost': float,
                'total_service_cost': float,
                'total_penalty_cost': float,
                'final_vehicle_states': {...}
            }
        """
```

### Route Optimization

**File**: [fleet_opt/routing.py](../backend/fleet_opt/routing.py)

Route planning and pathfinding:
```python
def find_shortest_path(from_location: str, to_location: str, relations_df) -> Dict
def calculate_route_metrics(segments: List[Segment]) -> Dict
def optimize_route_sequence(locations: List[str]) -> List[str]
```

## Simulation Coordinator

**File**: [simulation_coordinator.py](../backend/simulation_coordinator.py)

Manages real-time simulation and WebSocket broadcasting:

```python
class SimulationCoordinator:
    def __init__(self):
        self.current_time: datetime
        self.speed_multiplier: float = 1.0
        self.is_running: bool = False
        self.connected_clients: List[WebSocket] = []

    async def start_simulation(self):
        """Starts the simulation loop"""

    async def update_positions(self):
        """
        Updates vehicle positions:
        1. Calculate progress along current route
        2. Interpolate position between waypoints
        3. Calculate speed and heading
        4. Update odometer
        5. Broadcast to all clients
        """

    async def broadcast_positions(self, positions: Dict):
        """Sends position updates to all WebSocket clients"""

    def set_speed(self, multiplier: float):
        """Updates simulation speed (1x to 10,000x)"""

    def recalculate_vehicle_route(self, vehicle_id: str):
        """Recalculates optimal route for specific vehicle"""
```

### Position Interpolation Algorithm

```python
def interpolate_position(self, vehicle_state: VehicleState, current_time: datetime) -> Dict:
    """
    1. Calculate overall route progress:
       progress = (current_time - start_time) / (end_time - start_time)

    2. Find current segment based on cumulative distance

    3. Interpolate within segment:
       - Linear interpolation between start/end coordinates
       - Calculate heading from direction of travel
       - Calculate speed from segment distance/duration

    4. Update odometer:
       - odometer += distance_traveled_since_last_update

    Returns:
        {
            'latitude': float,
            'longitude': float,
            'speed': float,  # km/h
            'heading': float,  # degrees (0-360)
            'odometer': float  # total km
        }
    """
```

## Running the Backend

### Development Mode

```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Options:
- `--reload`: Auto-reload on code changes
- `--host 0.0.0.0`: Accept connections from any IP
- `--port 8000`: Port number

### Production Mode

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

Options:
- `--workers 4`: Run 4 worker processes

### Environment Variables

Create `.env` file:
```env
DATABASE_URL=sqlite:///./logistics.db
DEBUG=False
LOG_LEVEL=INFO
```

## API Documentation

FastAPI automatically generates interactive API documentation:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **OpenAPI JSON**: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

## Testing

### Manual Testing

Use the interactive Swagger UI at `/docs` to test endpoints.

### Python Testing

```bash
# Install pytest
pip install pytest pytest-asyncio

# Run tests
pytest tests/
```

## Performance Considerations

### Database Optimization

- Indexes on foreign keys for faster joins
- Query optimization using SQLAlchemy `joinedload()`
- Batch updates for vehicle positions

### WebSocket Optimization

- Position updates: 10 Hz (100ms interval)
- Statistics updates: 0.25 Hz (~4 second interval)
- Automatic client cleanup on disconnect

### Memory Management

- Lazy loading of route segments
- Periodic garbage collection
- Connection pooling for database

## Error Handling

The API uses standard HTTP status codes:

- `200 OK`: Successful request
- `400 Bad Request`: Invalid parameters
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation error
- `500 Internal Server Error`: Server error

All errors return JSON:
```json
{
  "detail": "Error message",
  "error_code": "ERROR_CODE"
}
```

## Logging

Configure logging in [main.py](../backend/main.py):

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

Log files are written to `backend/logs/`.

## Security

### CORS Configuration

CORS is configured to allow frontend access:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Input Validation

FastAPI automatically validates:
- Request parameters
- Request bodies (using Pydantic models)
- Response schemas

## Troubleshooting

### Database Issues

**Problem**: `OperationalError: no such table`
**Solution**: Run `python seed_db.py` to initialize database

### WebSocket Issues

**Problem**: WebSocket disconnects frequently
**Solution**: Check firewall settings and increase timeout

### Performance Issues

**Problem**: Slow position updates
**Solution**: Reduce simulation speed or number of vehicles

## Further Reading

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Uvicorn Documentation](https://www.uvicorn.org/)
