# Fleet Management & Route Optimization System

**Hackathon Project: Techni Schools Edition 5 - LSP Group Challenge**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![Next.js](https://img.shields.io/badge/next.js-16.0-black.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-latest-009688.svg)

## Overview

This project was developed for the **Techni Schools Hackathon (Edition 5)** to solve a real-world logistics challenge presented by **LSP Group**.

**Polish Description:**
> Projekt stworzony na hackathonie Techni Schools (edycja 5) dla wyzwania LSP Group. Opracowaliśmy algorytm optymalizujący koszty floty poprzez minimalizację leasingu ciężarówek. Wykorzystaliśmy algorytm zachłanny na danych dostarczonych przez firmę oraz przygotowaliśmy symulację, która wizualizuje decyzje algorytmu wraz z logami operacji.

**English Translation:**
> Project created at the Techni Schools hackathon (edition 5) for the LSP Group challenge. We developed an algorithm optimizing fleet costs by minimizing truck leasing expenses. We used a greedy algorithm on data provided by the company and prepared a simulation that visualizes the algorithm's decisions along with operation logs.

### Key Features

- **Real-time Fleet Tracking**: Live vehicle position updates with interactive map visualization
- **Cost Optimization Algorithm**: Greedy algorithm minimizing leasing, service, and relocation costs
- **Interactive Dashboard**: Comprehensive analytics and financial statistics
- **WebSocket Communication**: Real-time data streaming for smooth vehicle tracking
- **Route Simulation**: Visualize fleet decisions and operational efficiency
- **Event Logging**: Detailed logs of route assignments, service alerts, and lease warnings

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - SQL toolkit and ORM
- **SQLite** - Lightweight database
- **Pandas** - Data processing and analysis
- **Uvicorn** - ASGI server
- **WebSockets** - Real-time communication

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TailwindCSS v4** - Utility-first CSS framework
- **Leaflet** - Interactive map library
- **React Query** - Server state management
- **Zustand** - Global state management
- **Recharts** - Data visualization
- **TypeScript** - Type safety

## Project Structure

```
Hackathon/
├── backend/                      # Python FastAPI backend
│   ├── fleet_opt/               # Fleet optimization algorithms
│   │   ├── analyzer.py          # Cost analysis
│   │   ├── data_loader.py       # CSV data loading
│   │   ├── predict.py           # Route prediction
│   │   ├── preprocessing.py     # Data preprocessing
│   │   ├── routing.py           # Route optimization
│   │   ├── simulator.py         # Fleet simulation engine
│   │   └── vehicle_state.py     # Vehicle state management
│   ├── routers/                 # API route handlers
│   │   ├── simulation.py        # Simulation endpoints
│   │   ├── vehicles.py          # Vehicle endpoints
│   │   └── ws.py                # WebSocket endpoints
│   ├── main.py                  # FastAPI application
│   ├── models.py                # Database models
│   ├── database.py              # Database configuration
│   ├── simulation_coordinator.py # Real-time simulation
│   └── seed_db.py               # Database seeding
├── frontend/                     # Next.js React frontend
│   ├── src/
│   │   ├── app/                 # Next.js app directory
│   │   ├── components/          # React components
│   │   │   ├── dashboard/       # Dashboard components
│   │   │   └── windows/         # Window panels
│   │   └── lib/                 # Utilities and contexts
│   └── package.json
├── shared/                       # Shared resources
│   └── openapi.json             # API specification
├── __CSV_DATA/                   # Source data files
│   ├── vehicles.csv             # Fleet inventory
│   ├── locations.csv            # Geographic locations
│   ├── routes.csv               # Route definitions
│   ├── segments.csv             # Route segments
│   └── locations_relations.csv  # Distance/time matrix
└── logistics.db                 # SQLite database (generated)
```

## Getting Started

### Prerequisites

- **Python 3.8+**
- **Node.js 18+**
- **npm** or **yarn**

### Installation

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd Hackathon
```

#### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed the database with CSV data
python seed_db.py
```

#### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Generate TypeScript API client from OpenAPI spec
npm run generate:client
```

### Running the Application

You need to run both the backend and frontend servers simultaneously.

#### Terminal 1: Start Backend Server

```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at [http://localhost:8000](http://localhost:8000)
- API documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
- OpenAPI schema: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

#### Terminal 2: Start Frontend Server

```bash
cd frontend
npm run dev
```

The frontend will be available at [http://localhost:3000](http://localhost:3000)

### Building for Production

#### Backend

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

#### Frontend

```bash
cd frontend
npm run build
npm start
```

## Usage

### Dashboard Overview

Once both servers are running, navigate to [http://localhost:3000](http://localhost:3000) to access the dashboard:

1. **Map View**: Interactive map showing real-time vehicle positions
   - Click on vehicle markers to see details
   - Zoom and pan to explore routes
   - Vehicle clustering for better performance

2. **Quick Info Panel**: Key statistics at a glance
   - Vehicles closest to lease expiration
   - Vehicles needing service
   - Vehicles over leasing limits
   - Fleet replacement recommendations

3. **Financial Stats Panel**: Cost breakdown
   - Total relocation costs
   - Service costs
   - Penalty costs (leasing overage)
   - Routes assigned and total distance

4. **Logs Window**: Real-time event feed
   - Route assignments
   - Service alerts
   - Lease warnings
   - Fleet notifications

5. **Simulation Controls**:
   - Adjust simulation speed (1x to 10,000x)
   - Start/stop simulation
   - Recalculate routes for individual vehicles

### API Endpoints

#### Vehicles
- `GET /api/vehicles/count` - Total vehicle count
- `GET /api/vehicles/quick-stats` - Dashboard statistics
- `GET /api/vehicles/events` - Event log with filtering

#### Simulation
- `GET /api/simulation/vehicles/positions` - Current positions
- `GET /api/simulation/locations` - All locations
- `GET /api/simulation/financial-stats` - Cost analysis
- `GET /api/simulation/time` - Simulation status

#### Tracking
- `GET /api/tracking/positions` - All truck positions
- `POST /api/tracking/speed` - Update simulation speed
- `POST /api/tracking/recalculate` - Recalculate truck route
- `WebSocket /api/tracking/ws` - Real-time updates

## Algorithm Overview

### Fleet Optimization

The system uses a **greedy algorithm** to optimize fleet operations by minimizing three cost components:

1. **Leasing Penalty Costs**
   - Cost per km over leasing limit: 0.92 PLN/km
   - Tracks cumulative mileage for each vehicle

2. **Service Costs**
   - Service cost: 9,600 PLN per service
   - Downtime: 48 hours per service
   - Service interval: Based on vehicle specifications

3. **Relocation Costs**
   - Fixed cost: 1,000 PLN
   - Variable cost: 1.0 PLN/km
   - Time cost: 150 PLN/hour

### Vehicle Selection Algorithm

For each route assignment:
1. Filter available vehicles at the route start time
2. Calculate total cost for each vehicle:
   - Relocation cost (empty travel to route start)
   - Service cost (if maintenance needed)
   - Penalty cost (if over leasing limit)
3. Select vehicle with minimum total cost
4. Update vehicle state (location, mileage, costs)

### Real-time Simulation

The simulation coordinator:
- Interpolates vehicle positions based on route progress
- Calculates speed and heading in real-time
- Updates odometer readings
- Broadcasts position updates via WebSocket (10 Hz)
- Computes statistics every 4 seconds

## Database Schema

### Tables

- **locations**: Geographic points (latitude, longitude, hub status)
- **location_relations**: Distance and time matrix between locations
- **vehicles**: Fleet inventory with leasing and service data
- **routes**: Transport route definitions
- **segments**: Individual route segments connecting locations

### Key Relationships

- Vehicles → Current Location (foreign key)
- Routes → Multiple Segments (one-to-many)
- Segments → Start/End Locations (foreign keys)
- Segments → Location Relations (for distance/time data)

## Development

### Code Generation

The frontend uses automatic type-safe API client generation:

```bash
cd frontend
npm run generate:client
```

This generates TypeScript types and React Query hooks from the backend's OpenAPI specification.

### Code Quality

The project uses:
- **Biome** for linting and formatting (frontend)
- **TypeScript** for type safety
- **SQLAlchemy** for type-safe database queries

### Environment Variables

#### Backend
Create a `.env` file in the backend directory:
```env
DATABASE_URL=sqlite:///./logistics.db
```

#### Frontend
Create a `.env.local` file in the frontend directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- **LSP Group** for providing the challenge and data
- **Techni Schools** for organizing the hackathon (Edition 5)
- All team members who contributed to this project

## Contact

For questions or feedback, please open an issue on GitHub.

---

**Built with ❤️ for Techni Schools Hackathon Edition 5**
