# Frontend Documentation

## Overview

The frontend is built with **Next.js 16** and **React 19**, featuring an interactive dashboard with real-time fleet tracking, map visualization, and comprehensive analytics.

## Architecture

### Tech Stack

- **Next.js 16.0.1** - React framework with App Router
- **React 19.2.0** - UI library
- **TypeScript** - Type safety
- **TailwindCSS v4** - Styling
- **Leaflet** - Interactive maps
- **React Query** - Server state management
- **Zustand** - Global state management
- **Recharts** - Data visualization

### Project Structure

```
frontend/
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── (dashboard)/            # Dashboard route group
│   │   │   ├── page.tsx            # Main page
│   │   │   └── dashboard-client.tsx # Client component
│   │   ├── layout.tsx              # Root layout
│   │   └── globals.css             # Global styles
│   ├── components/
│   │   ├── dashboard/              # Dashboard components
│   │   │   ├── header.tsx          # Navigation header
│   │   │   ├── map.tsx             # Leaflet map
│   │   │   ├── vehicle-markers.tsx # Vehicle markers
│   │   │   ├── search.tsx          # Vehicle search
│   │   │   ├── vehicle-search.tsx  # Advanced search
│   │   │   └── zoom.tsx            # Map zoom controls
│   │   ├── windows/                # Window panels
│   │   │   ├── window-panel.tsx    # Base draggable panel
│   │   │   ├── quick-info.tsx      # Quick stats window
│   │   │   ├── financial-stats.tsx # Financial window
│   │   │   ├── logs-window.tsx     # Event logs window
│   │   │   └── trucks-info.tsx     # Vehicle info window
│   │   ├── ui/                     # Radix UI components
│   │   └── window-manager.tsx      # Window state management
│   └── lib/
│       ├── api-client/             # Generated API client
│       │   ├── sdk.gen.ts          # API SDK
│       │   ├── types.gen.ts        # TypeScript types
│       │   └── @tanstack/react-query.gen.ts # React Query hooks
│       ├── tracking-websocket-context.tsx # WebSocket provider
│       ├── utils.ts                # Utility functions
│       └── hooks/                  # Custom React hooks
├── public/                         # Static assets
├── package.json
├── tsconfig.json
└── next.config.js
```

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Generate TypeScript API client
npm run generate:client
```

### Dependencies

```json
{
  "dependencies": {
    "next": "16.0.1",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "leaflet": "^1.9.4",
    "react-leaflet": "^5.0.0-rc.2",
    "leaflet.markercluster": "^1.5.3",
    "@tanstack/react-query": "^5.90.5",
    "zustand": "^5.0.8",
    "recharts": "2.15.4"
  },
  "devDependencies": {
    "@biomejs/biome": "2.3.2",
    "@hey-api/openapi-ts": "^0.86.8",
    "typescript": "^5",
    "tailwindcss": "^4"
  }
}
```

## Running the Application

### Development Mode

```bash
npm run dev
```

The application will start at [http://localhost:3000](http://localhost:3000)

Features:
- Hot module replacement
- Fast refresh
- Turbopack bundler
- React Compiler (experimental)

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run generate:client` - Generate API client from OpenAPI spec

## Core Components

### Dashboard Client

**File**: [src/app/(dashboard)/dashboard-client.tsx](../frontend/src/app/(dashboard)/dashboard-client.tsx)

Main dashboard component that orchestrates all features:

```tsx
export default function DashboardClient() {
  return (
    <TrackingWebSocketProvider>
      <VehicleNavigationProvider>
        <div className="flex h-screen">
          <Header />
          <Map />
          <WindowManager>
            <QuickInfoWindow />
            <FinancialStatsWindow />
            <LogsWindow />
            <TrucksInfoWindow />
          </WindowManager>
          <ZoomControls />
          <Search />
        </div>
      </VehicleNavigationProvider>
    </TrackingWebSocketProvider>
  )
}
```

### Map Component

**File**: [src/components/dashboard/map.tsx](../frontend/src/components/dashboard/map.tsx)

Interactive Leaflet map with vehicle tracking:

```tsx
'use client'
import { MapContainer, TileLayer, Polyline } from 'react-leaflet'
import VehicleMarkers from './vehicle-markers'

export default function Map() {
  const { vehicles } = useTrackingWebSocket()

  return (
    <MapContainer
      center={[52.2297, 21.0122]}
      zoom={6}
      className="h-full w-full"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <VehicleMarkers vehicles={vehicles} />
      <RoutePolylines />
    </MapContainer>
  )
}
```

**Features**:
- Real-time vehicle position updates
- Interactive markers with popups
- Route visualization with polylines
- Marker clustering for performance
- Zoom controls
- Follow vehicle mode

### Vehicle Markers

**File**: [src/components/dashboard/vehicle-markers.tsx](../frontend/src/components/dashboard/vehicle-markers.tsx)

Displays vehicle markers with clustering:

```tsx
import MarkerClusterGroup from 'react-leaflet-cluster'
import { Marker, Popup } from 'react-leaflet'

export default function VehicleMarkers({ vehicles }) {
  return (
    <MarkerClusterGroup>
      {vehicles.map(vehicle => (
        <Marker
          key={vehicle.id}
          position={[vehicle.latitude, vehicle.longitude]}
          icon={createVehicleIcon(vehicle)}
        >
          <Popup>
            <VehiclePopup vehicle={vehicle} />
          </Popup>
        </Marker>
      ))}
    </MarkerClusterGroup>
  )
}
```

**Marker Features**:
- Custom icons based on vehicle status
- Rotation based on heading
- Click to show details
- Clustering at high zoom levels

### Window Manager

**File**: [src/components/window-manager.tsx](../frontend/src/components/window-manager.tsx)

Manages draggable window panels with Zustand:

```tsx
import { create } from 'zustand'

interface WindowState {
  windows: Record<string, {
    isOpen: boolean
    position: { x: number, y: number }
    size: { width: number, height: number }
    zIndex: number
  }>
  openWindow: (id: string) => void
  closeWindow: (id: string) => void
  updatePosition: (id: string, position: Position) => void
  bringToFront: (id: string) => void
}

export const useWindowStore = create<WindowState>((set) => ({
  // Implementation
}))
```

### Window Panel

**File**: [src/components/windows/window-panel.tsx](../frontend/src/components/windows/window-panel.tsx)

Reusable draggable window component:

```tsx
interface WindowPanelProps {
  id: string
  title: string
  defaultPosition?: { x: number, y: number }
  defaultSize?: { width: number, height: number }
  children: React.ReactNode
}

export default function WindowPanel({
  id,
  title,
  defaultPosition,
  defaultSize,
  children
}: WindowPanelProps) {
  const { isOpen, closeWindow, bringToFront } = useWindowStore()

  return isOpen(id) ? (
    <div
      className="absolute bg-white rounded-lg shadow-xl border"
      draggable
      onDragEnd={handleDragEnd}
      onClick={() => bringToFront(id)}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">{title}</h3>
        <button onClick={() => closeWindow(id)}>✕</button>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  ) : null
}
```

### Quick Info Window

**File**: [src/components/windows/quick-info.tsx](../frontend/src/components/windows/quick-info.tsx)

Displays key fleet statistics:

```tsx
export default function QuickInfoWindow() {
  const { data: stats } = useQuery({
    queryKey: ['quick-stats'],
    queryFn: () => vehiclesApi.getQuickStats(),
    refetchInterval: 5000 // Refresh every 5 seconds
  })

  return (
    <WindowPanel id="quick-info" title="Quick Info">
      <div className="space-y-4">
        <StatCard
          title="Close to Lease Expiration"
          data={stats?.top_3_closest_to_lease_expiration}
        />
        <StatCard
          title="Needing Service"
          data={stats?.top_3_needing_service}
        />
        <StatCard
          title="Over Lease Limit"
          data={stats?.vehicles_over_lease_limit}
        />
      </div>
    </WindowPanel>
  )
}
```

### Financial Stats Window

**File**: [src/components/windows/financial-stats.tsx](../frontend/src/components/windows/financial-stats.tsx)

Shows financial analytics and costs:

```tsx
export default function FinancialStatsWindow() {
  const { data: stats } = useQuery({
    queryKey: ['financial-stats'],
    queryFn: () => simulationApi.getFinancialStats(),
    refetchInterval: 5000
  })

  return (
    <WindowPanel id="financial-stats" title="Financial Statistics">
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          label="Relocation Costs"
          value={formatCurrency(stats?.total_relocation_cost)}
          icon={<TruckIcon />}
        />
        <MetricCard
          label="Service Costs"
          value={formatCurrency(stats?.total_service_cost)}
          icon={<WrenchIcon />}
        />
        <MetricCard
          label="Penalty Costs"
          value={formatCurrency(stats?.total_penalty_cost)}
          icon={<AlertIcon />}
        />
        <MetricCard
          label="Total Distance"
          value={`${stats?.total_distance_km?.toLocaleString()} km`}
          icon={<RouteIcon />}
        />
      </div>
      <CostChart data={stats} />
    </WindowPanel>
  )
}
```

### Logs Window

**File**: [src/components/windows/logs-window.tsx](../frontend/src/components/windows/logs-window.tsx)

Real-time event log viewer:

```tsx
export default function LogsWindow() {
  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => vehiclesApi.getEvents(),
    refetchInterval: 3000
  })

  return (
    <WindowPanel id="logs" title="Event Logs">
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {events?.map(event => (
          <LogEntry key={event.id} event={event} />
        ))}
      </div>
    </WindowPanel>
  )
}

function LogEntry({ event }) {
  const getIcon = () => {
    switch (event.event_type) {
      case 'route_start': return <PlayIcon />
      case 'route_complete': return <CheckIcon />
      case 'service_needed': return <WrenchIcon />
      case 'lease_warning': return <AlertIcon />
      default: return <InfoIcon />
    }
  }

  return (
    <div className="flex items-start gap-3 p-2 hover:bg-gray-50">
      <div className="text-blue-600">{getIcon()}</div>
      <div className="flex-1">
        <div className="text-sm font-medium">{event.message}</div>
        <div className="text-xs text-gray-500">
          {formatTimestamp(event.timestamp)}
        </div>
      </div>
    </div>
  )
}
```

### Vehicle Search

**File**: [src/components/dashboard/vehicle-search.tsx](../frontend/src/components/dashboard/vehicle-search.tsx)

Advanced vehicle search and filtering:

```tsx
export default function VehicleSearch() {
  const [searchTerm, setSearchTerm] = useState('')
  const { vehicles } = useTrackingWebSocket()
  const { navigateToVehicle } = useVehicleNavigation()

  const filteredVehicles = vehicles.filter(v =>
    v.registration_number.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="absolute top-4 right-4 z-[1000]">
      <input
        type="text"
        placeholder="Search vehicles..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="px-4 py-2 border rounded-lg shadow-lg"
      />
      {searchTerm && (
        <div className="mt-2 bg-white rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filteredVehicles.map(vehicle => (
            <button
              key={vehicle.id}
              onClick={() => navigateToVehicle(vehicle)}
              className="w-full px-4 py-2 text-left hover:bg-gray-100"
            >
              <div className="font-medium">{vehicle.registration_number}</div>
              <div className="text-sm text-gray-500">
                {vehicle.status} • {vehicle.speed?.toFixed(0)} km/h
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

## WebSocket Integration

### Tracking WebSocket Provider

**File**: [src/lib/tracking-websocket-context.tsx](../frontend/src/lib/tracking-websocket-context.tsx)

Manages WebSocket connection and state:

```tsx
interface TrackingContextValue {
  vehicles: Vehicle[]
  isConnected: boolean
  simulationSpeed: number
  setSimulationSpeed: (speed: number) => void
  recalculateRoute: (vehicleId: string) => void
}

export const TrackingWebSocketProvider = ({ children }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/api/tracking/ws')

    ws.onopen = () => {
      setIsConnected(true)
      console.log('WebSocket connected')
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'position_update') {
        setVehicles(data.data.vehicles)
      } else if (data.type === 'stats_update') {
        // Handle statistics update
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = () => {
      setIsConnected(false)
      // Reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000)
    }

    wsRef.current = ws

    return () => {
      ws.close()
    }
  }, [])

  const setSimulationSpeed = (speed: number) => {
    fetch('http://localhost:8000/api/tracking/speed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed })
    })
  }

  const recalculateRoute = (vehicleId: string) => {
    fetch('http://localhost:8000/api/tracking/recalculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle_id: vehicleId })
    })
  }

  return (
    <TrackingContext.Provider value={{
      vehicles,
      isConnected,
      simulationSpeed,
      setSimulationSpeed,
      recalculateRoute
    }}>
      {children}
    </TrackingContext.Provider>
  )
}

export const useTrackingWebSocket = () => useContext(TrackingContext)
```

## API Client Generation

The frontend uses automatic TypeScript client generation from the backend's OpenAPI specification.

### Configuration

**File**: [openapi-ts.config.ts](../frontend/openapi-ts.config.ts)

```ts
export default {
  input: '../shared/openapi.json',
  output: {
    path: './src/lib/api-client',
    format: 'prettier',
    lint: 'biome'
  },
  client: '@hey-api/client-fetch',
  plugins: [
    '@tanstack/react-query'
  ]
}
```

### Generate Client

```bash
npm run generate:client
```

This creates:
- `sdk.gen.ts` - Type-safe API functions
- `types.gen.ts` - TypeScript interfaces
- `@tanstack/react-query.gen.ts` - React Query hooks

### Usage Example

```tsx
import { useGetVehiclesCount, useGetQuickStats } from '@/lib/api-client/@tanstack/react-query.gen'

export default function Dashboard() {
  const { data: count } = useGetVehiclesCount()
  const { data: stats, isLoading } = useGetQuickStats({
    refetchInterval: 5000
  })

  if (isLoading) return <Loading />

  return (
    <div>
      <h1>Total Vehicles: {count?.count}</h1>
      <Statistics data={stats} />
    </div>
  )
}
```

## Styling

### TailwindCSS Configuration

**File**: [tailwind.config.js](../frontend/tailwind.config.js)

```js
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [
    require('tw-animate-css')
  ],
}
```

### Global Styles

**File**: [src/app/globals.css](../frontend/src/app/globals.css)

```css
@import 'tailwindcss';
@import 'leaflet/dist/leaflet.css';
@import 'leaflet.markercluster/dist/MarkerCluster.css';

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
  }
}

@layer components {
  .window-panel {
    @apply bg-white rounded-lg shadow-xl border border-gray-200;
  }

  .stat-card {
    @apply p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg;
  }
}
```

## State Management

### React Query

Used for server state management:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchInterval: 10000,
    },
  },
})

export default function App({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

### Zustand

Used for global UI state:

```tsx
import { create } from 'zustand'

export const useAppStore = create((set) => ({
  sidebarOpen: true,
  selectedVehicle: null,
  toggleSidebar: () => set((state) => ({
    sidebarOpen: !state.sidebarOpen
  })),
  selectVehicle: (vehicle) => set({ selectedVehicle: vehicle }),
}))
```

## Performance Optimization

### Memoization

```tsx
import { memo, useMemo } from 'react'

const VehicleMarker = memo(({ vehicle }) => {
  const icon = useMemo(() => createVehicleIcon(vehicle), [vehicle.status])

  return <Marker position={[vehicle.lat, vehicle.lng]} icon={icon} />
})
```

### Lazy Loading

```tsx
import dynamic from 'next/dynamic'

const Map = dynamic(() => import('./map'), {
  ssr: false,
  loading: () => <MapSkeleton />
})
```

### Virtual Scrolling

For large lists in logs window:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

export default function LogsList({ events }) {
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
  })

  return (
    <div ref={parentRef}>
      {virtualizer.getVirtualItems().map(item => (
        <div key={item.key} style={{ height: `${item.size}px` }}>
          <LogEntry event={events[item.index]} />
        </div>
      ))}
    </div>
  )
}
```

## Testing

### Unit Tests

```bash
npm test
```

### E2E Tests

```bash
npm run test:e2e
```

## Build Optimization

### Next.js Config

**File**: [next.config.js](../frontend/next.config.js)

```js
export default {
  experimental: {
    reactCompiler: true,
  },
  images: {
    domains: ['tile.openstreetmap.org'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ]
  },
}
```

## Troubleshooting

### Common Issues

**Leaflet not rendering**:
- Ensure map container has explicit height
- Import CSS: `import 'leaflet/dist/leaflet.css'`

**WebSocket connection fails**:
- Check backend is running on port 8000
- Verify CORS configuration
- Check browser console for errors

**API client not updating**:
- Run `npm run generate:client` after backend changes
- Restart dev server

## Further Reading

- [Next.js Documentation](https://nextjs.org/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Leaflet Documentation](https://leafletjs.com/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
