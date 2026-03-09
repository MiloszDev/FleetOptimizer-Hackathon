# API Documentation

## Overview

The Fleet Management System provides a RESTful API built with FastAPI, offering endpoints for vehicle management, simulation control, and real-time tracking via WebSockets.

**Base URL**: `http://localhost:8000`

**Interactive Documentation**:
- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- OpenAPI Spec: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

## Authentication

Currently, the API does not require authentication. For production deployment, consider implementing:
- JWT tokens
- API keys
- OAuth 2.0

## Response Format

All responses are in JSON format.

### Success Response

```json
{
  "data": { ... },
  "status": "success"
}
```

### Error Response

```json
{
  "detail": "Error message",
  "error_code": "ERROR_CODE",
  "status": "error"
}
```

## Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource not found |
| 422 | Unprocessable Entity - Validation error |
| 500 | Internal Server Error |

## Endpoints

### Vehicles

#### Get Vehicle Count

Returns the total number of vehicles in the fleet.

```http
GET /api/vehicles/count
```

**Response**:
```json
{
  "count": 100
}
```

**Example**:
```bash
curl http://localhost:8000/api/vehicles/count
```

---

#### Get Quick Statistics

Returns dashboard statistics including vehicles needing attention.

```http
GET /api/vehicles/quick-stats
```

**Response**:
```json
{
  "top_3_closest_to_lease_expiration": [
    {
      "registration_number": "WX12345",
      "current_odometer": 98500.5,
      "lease_km_limit": 100000.0,
      "km_remaining": 1499.5,
      "percentage_used": 98.5,
      "days_until_limit": 15
    }
  ],
  "top_3_needing_service": [
    {
      "registration_number": "WX67890",
      "current_odometer": 45000.0,
      "km_to_next_service": 500.0,
      "service_interval_km": 5000.0,
      "last_service_km": 40000.0
    }
  ],
  "vehicles_over_lease_limit": [
    {
      "registration_number": "WX11111",
      "current_odometer": 102000.0,
      "lease_km_limit": 100000.0,
      "km_over_limit": 2000.0,
      "penalty_cost": 1840.0
    }
  ],
  "average_odometer": 45234.67,
  "vehicles_needing_replacement": 5,
  "total_vehicles": 100
}
```

**Example**:
```bash
curl http://localhost:8000/api/vehicles/quick-stats
```

---

#### Get Events

Returns event log with optional filtering.

```http
GET /api/vehicles/events
```

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| event_type | string | No | Filter by event type |
| vehicle_id | string | No | Filter by vehicle |
| limit | integer | No | Max events to return (default: 100) |
| offset | integer | No | Pagination offset (default: 0) |
| start_date | string | No | Start date (ISO 8601) |
| end_date | string | No | End date (ISO 8601) |

**Event Types**:
- `route_start` - Vehicle started a route
- `route_complete` - Vehicle completed a route
- `service_needed` - Vehicle needs service
- `service_completed` - Service completed
- `lease_warning` - Approaching lease limit
- `lease_exceeded` - Over lease limit
- `relocation_start` - Empty relocation started
- `relocation_complete` - Empty relocation completed

**Response**:
```json
{
  "events": [
    {
      "id": 1,
      "timestamp": "2024-01-15T10:30:45Z",
      "event_type": "route_start",
      "vehicle_id": "WX12345",
      "message": "Vehicle WX12345 started route R001",
      "metadata": {
        "route_id": "R001",
        "start_location": "Warsaw Hub",
        "end_location": "Krakow",
        "estimated_duration": 3.5
      }
    },
    {
      "id": 2,
      "timestamp": "2024-01-15T14:00:00Z",
      "event_type": "service_needed",
      "vehicle_id": "WX67890",
      "message": "Vehicle WX67890 needs service in 500 km",
      "metadata": {
        "km_to_service": 500,
        "current_odometer": 44500
      }
    }
  ],
  "total": 150,
  "limit": 100,
  "offset": 0
}
```

**Example**:
```bash
# Get all events
curl http://localhost:8000/api/vehicles/events

# Get service events only
curl http://localhost:8000/api/vehicles/events?event_type=service_needed

# Get events for specific vehicle
curl http://localhost:8000/api/vehicles/events?vehicle_id=WX12345

# Pagination
curl http://localhost:8000/api/vehicles/events?limit=20&offset=40
```

---

### Simulation

#### Get Vehicle Positions

Returns current positions of all vehicles in the simulation.

```http
GET /api/simulation/vehicles/positions
```

**Response**:
```json
{
  "vehicles": [
    {
      "id": "WX12345",
      "registration_number": "WX12345",
      "latitude": 52.2297,
      "longitude": 21.0122,
      "speed": 85.5,
      "heading": 45.0,
      "odometer": 45123.5,
      "status": "in_transit",
      "current_route": "R001",
      "route_progress": 0.65
    }
  ],
  "timestamp": "2024-01-15T14:30:00Z",
  "total_vehicles": 100
}
```

**Vehicle Status Values**:
- `idle` - Parked at location
- `in_transit` - Traveling on route
- `in_service` - Under maintenance
- `relocating` - Empty travel to next route
- `completed` - Finished all routes

**Example**:
```bash
curl http://localhost:8000/api/simulation/vehicles/positions
```

---

#### Get Locations

Returns all locations with coordinates.

```http
GET /api/simulation/locations
```

**Response**:
```json
{
  "locations": [
    {
      "id": 1,
      "name": "Warsaw Hub",
      "latitude": 52.2297,
      "longitude": 21.0122,
      "is_hub": true,
      "vehicles_count": 15
    },
    {
      "id": 2,
      "name": "Krakow Depot",
      "latitude": 50.0647,
      "longitude": 19.9450,
      "is_hub": true,
      "vehicles_count": 8
    }
  ],
  "total": 50
}
```

**Example**:
```bash
curl http://localhost:8000/api/simulation/locations
```

---

#### Get Financial Statistics

Returns cost breakdown and financial metrics.

```http
GET /api/simulation/financial-stats
```

**Response**:
```json
{
  "total_relocation_cost": 125000.50,
  "total_service_cost": 96000.00,
  "total_penalty_cost": 45600.00,
  "total_cost": 266600.50,
  "routes_assigned": 350,
  "total_distance_km": 125000.0,
  "average_cost_per_route": 761.72,
  "cost_breakdown": {
    "relocation": {
      "fixed_costs": 35000.00,
      "variable_costs": 65000.50,
      "time_costs": 25000.00
    },
    "service": {
      "services_performed": 10,
      "cost_per_service": 9600.00
    },
    "penalty": {
      "vehicles_over_limit": 5,
      "total_km_over_limit": 49565.22,
      "cost_per_km": 0.92
    }
  },
  "period": {
    "start_date": "2024-01-01T00:00:00Z",
    "end_date": "2024-04-01T00:00:00Z",
    "days": 91
  }
}
```

**Cost Formulas**:

**Relocation Cost**:
```
Fixed: 1000 PLN
Variable: 1.0 PLN/km
Time: 150 PLN/hour
Total = 1000 + (distance_km × 1.0) + (duration_hours × 150)
```

**Service Cost**:
```
Cost: 9600 PLN per service
Downtime: 48 hours
```

**Penalty Cost**:
```
Cost: 0.92 PLN/km over lease limit
Total = km_over_limit × 0.92
```

**Example**:
```bash
curl http://localhost:8000/api/simulation/financial-stats
```

---

#### Get Simulation Time

Returns current simulation time and status.

```http
GET /api/simulation/time
```

**Response**:
```json
{
  "current_time": "2024-01-15T14:30:00Z",
  "speed_multiplier": 100,
  "is_running": true,
  "start_time": "2024-01-01T00:00:00Z",
  "end_time": "2024-04-01T00:00:00Z",
  "progress_percentage": 15.5,
  "elapsed_real_seconds": 450,
  "elapsed_sim_days": 14
}
```

**Example**:
```bash
curl http://localhost:8000/api/simulation/time
```

---

### Tracking

#### Get All Positions

Returns positions of all trucks (alias for vehicle positions).

```http
GET /api/tracking/positions
```

**Response**: Same as `/api/simulation/vehicles/positions`

**Example**:
```bash
curl http://localhost:8000/api/tracking/positions
```

---

#### Update Simulation Speed

Updates the simulation speed multiplier.

```http
POST /api/tracking/speed
```

**Request Body**:
```json
{
  "speed": 100
}
```

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| speed | number | Yes | Speed multiplier (1-10000) |

**Speed Values**:
- `1` - Real-time (1 second = 1 second)
- `10` - 10x speed
- `100` - 100x speed (default)
- `1000` - 1000x speed
- `10000` - Maximum speed

**Response**:
```json
{
  "status": "success",
  "new_speed": 100,
  "message": "Simulation speed updated"
}
```

**Example**:
```bash
curl -X POST http://localhost:8000/api/tracking/speed \
  -H "Content-Type: application/json" \
  -d '{"speed": 100}'
```

---

#### Recalculate Vehicle Route

Recalculates the optimal route for a specific vehicle.

```http
POST /api/tracking/recalculate
```

**Request Body**:
```json
{
  "vehicle_id": "WX12345"
}
```

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| vehicle_id | string | Yes | Vehicle registration number |

**Response**:
```json
{
  "status": "success",
  "vehicle_id": "WX12345",
  "new_route": {
    "route_id": "R001_recalc",
    "estimated_distance": 245.5,
    "estimated_duration": 3.2,
    "cost_savings": 125.50
  },
  "message": "Route recalculated successfully"
}
```

**Example**:
```bash
curl -X POST http://localhost:8000/api/tracking/recalculate \
  -H "Content-Type: application/json" \
  -d '{"vehicle_id": "WX12345"}'
```

---

### WebSocket

#### Tracking WebSocket

Establishes real-time WebSocket connection for position updates.

```
WebSocket ws://localhost:8000/api/tracking/ws
```

**Connection**:
```javascript
const ws = new WebSocket('ws://localhost:8000/api/tracking/ws')

ws.onopen = () => {
  console.log('Connected to tracking WebSocket')
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log('Received:', data)
}

ws.onerror = (error) => {
  console.error('WebSocket error:', error)
}

ws.onclose = () => {
  console.log('WebSocket disconnected')
}
```

**Message Types**:

##### Position Update (10 Hz)

Sent every ~100ms with vehicle positions.

```json
{
  "type": "position_update",
  "data": {
    "vehicles": [
      {
        "id": "WX12345",
        "latitude": 52.2297,
        "longitude": 21.0122,
        "speed": 85.5,
        "heading": 45.0,
        "odometer": 45123.5,
        "status": "in_transit",
        "current_route": "R001"
      }
    ],
    "timestamp": "2024-01-15T14:30:00.123Z"
  }
}
```

##### Statistics Update (~4 seconds)

Sent every ~4 seconds with aggregated statistics.

```json
{
  "type": "stats_update",
  "data": {
    "financial_stats": {
      "total_relocation_cost": 125000.50,
      "total_service_cost": 96000.00,
      "total_penalty_cost": 45600.00
    },
    "quick_stats": {
      "vehicles_in_transit": 45,
      "vehicles_idle": 50,
      "vehicles_in_service": 5
    },
    "timestamp": "2024-01-15T14:30:00Z"
  }
}
```

##### Event Notification

Sent when significant events occur.

```json
{
  "type": "event",
  "data": {
    "event_type": "service_needed",
    "vehicle_id": "WX67890",
    "message": "Vehicle WX67890 needs service",
    "timestamp": "2024-01-15T14:30:00Z"
  }
}
```

**Client → Server Messages**:

You can send commands via WebSocket:

```javascript
// Set simulation speed
ws.send(JSON.stringify({
  type: 'set_speed',
  speed: 100
}))

// Recalculate route
ws.send(JSON.stringify({
  type: 'recalculate',
  vehicle_id: 'WX12345'
}))

// Subscribe to specific vehicle
ws.send(JSON.stringify({
  type: 'subscribe',
  vehicle_id: 'WX12345'
}))
```

---

## Data Models

### Vehicle

```typescript
interface Vehicle {
  id: number
  registration_number: string
  lease_km_limit: number
  current_odometer: number
  service_interval_km: number
  km_to_next_service: number
  current_location_id: number
  is_available: boolean
  latitude?: number
  longitude?: number
  speed?: number
  heading?: number
  status: 'idle' | 'in_transit' | 'in_service' | 'relocating' | 'completed'
}
```

### Location

```typescript
interface Location {
  id: number
  name: string
  latitude: number
  longitude: number
  is_hub: boolean
}
```

### Route

```typescript
interface Route {
  id: number
  route_name: string
  start_time: string  // ISO 8601
  end_time: string    // ISO 8601
  segments: Segment[]
}
```

### Segment

```typescript
interface Segment {
  id: number
  route_id: number
  from_location_id: number
  to_location_id: number
  distance_km: number
  duration_hours: number
  sequence_number: number
}
```

### Event

```typescript
interface Event {
  id: number
  timestamp: string  // ISO 8601
  event_type: string
  vehicle_id: string
  message: string
  metadata: Record<string, any>
}
```

---

## Rate Limiting

Currently, no rate limiting is implemented. For production:

**Recommended Limits**:
- REST API: 100 requests/minute per IP
- WebSocket: 1 connection per client
- Position updates: 10 Hz (automatic)

---

## CORS

CORS is enabled for local development:

```python
allow_origins = ["http://localhost:3000"]
allow_methods = ["*"]
allow_headers = ["*"]
```

For production, configure specific origins:

```python
allow_origins = [
  "https://yourdomain.com",
  "https://app.yourdomain.com"
]
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `VEHICLE_NOT_FOUND` | Vehicle ID does not exist |
| `ROUTE_NOT_FOUND` | Route ID does not exist |
| `INVALID_SPEED` | Speed multiplier out of range |
| `SIMULATION_NOT_RUNNING` | Simulation is not active |
| `DATABASE_ERROR` | Database operation failed |
| `WEBSOCKET_ERROR` | WebSocket connection error |

---

## Examples

### Python

```python
import requests

# Get vehicle count
response = requests.get('http://localhost:8000/api/vehicles/count')
print(response.json())

# Get financial stats
response = requests.get('http://localhost:8000/api/simulation/financial-stats')
stats = response.json()
print(f"Total cost: {stats['total_cost']} PLN")

# Update simulation speed
response = requests.post(
    'http://localhost:8000/api/tracking/speed',
    json={'speed': 100}
)
print(response.json())
```

### JavaScript

```javascript
// Fetch vehicle positions
const positions = await fetch('http://localhost:8000/api/simulation/vehicles/positions')
  .then(res => res.json())

console.log(positions.vehicles)

// Update speed
await fetch('http://localhost:8000/api/tracking/speed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ speed: 100 })
})

// WebSocket connection
const ws = new WebSocket('ws://localhost:8000/api/tracking/ws')
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  if (data.type === 'position_update') {
    updateMap(data.data.vehicles)
  }
}
```

### cURL

```bash
# Get quick stats
curl http://localhost:8000/api/vehicles/quick-stats | jq

# Get events with filtering
curl "http://localhost:8000/api/vehicles/events?event_type=service_needed&limit=10" | jq

# Update simulation speed
curl -X POST http://localhost:8000/api/tracking/speed \
  -H "Content-Type: application/json" \
  -d '{"speed": 1000}' | jq

# Recalculate route
curl -X POST http://localhost:8000/api/tracking/recalculate \
  -H "Content-Type: application/json" \
  -d '{"vehicle_id": "WX12345"}' | jq
```

---

## Changelog

### Version 1.0.0 (Current)
- Initial API release
- Vehicle endpoints
- Simulation endpoints
- WebSocket tracking
- Financial statistics
- Event logging

---

## Support

For API issues or questions:
1. Check interactive documentation at [/docs](http://localhost:8000/docs)
2. Review error messages and codes
3. Open an issue on GitHub

---

**Generated with OpenAPI 3.0 specification**
