import json
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import vehicles, simulation, tracking


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        print("Initializing database...")
        init_db()
    except Exception as e:
        print(f"⚠️  Warning: Could not initialize database: {e}")

    try:
        openapi_schema = app.openapi()

        backend_dir = Path(__file__).parent
        shared_dir = backend_dir.parent / "shared"

        output_file = shared_dir / "openapi.json"

        with open(output_file, "w") as f:
            json.dump(openapi_schema, f, indent=2)

        endpoint_count = len(openapi_schema.get("paths", {}))
        print(
            f"✅ OpenAPI schema exported to: {output_file} ({endpoint_count} endpoints)"
        )
    except Exception as e:
        print(f"⚠️  Warning: Could not export OpenAPI schema: {e}")

    yield
    pass


app = FastAPI(
    title="LSP Hackathon",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(vehicles.router)
app.include_router(simulation.router)
app.include_router(tracking.router)
