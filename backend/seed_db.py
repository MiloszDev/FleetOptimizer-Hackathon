import csv
import sys
from datetime import datetime
from pathlib import Path
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).parent))

from .database import SessionLocal, engine, Base
from .models import Location, LocationRelation, Vehicle, Route, Segment


def parse_datetime(dt_str: str) -> datetime:
    """Parse datetime string from CSV"""
    return datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")


def parse_nullable_int(value: str) -> int | None:
    if value == "N/A" or not value:
        return None
    return int(float(value))


def seed_locations(db: Session, csv_path: Path):
    print(f"Importing locations from {csv_path}...")
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            location = Location(
                id=int(row["id"]),
                name=row["name"],
                lat=float(row["lat"]),
                long=float(row["long"]),
                is_hub=bool(int(row["is_hub"])),
            )
            db.add(location)
            count += 1
            if count % 100 == 0:
                db.commit()
        db.commit()
    print(f"✓ Imported {count} locations")


def seed_location_relations(db: Session, csv_path: Path):
    print(f"Importing location relations from {csv_path}...")
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            relation = LocationRelation(
                id=int(row["id"]),
                id_loc_1=int(row["id_loc_1"]),
                id_loc_2=int(row["id_loc_2"]),
                dist=float(row["dist"]),
                time=float(row["time"]),
            )
            db.add(relation)
            count += 1
            if count % 1000 == 0:
                db.commit()
        db.commit()
    print(f"✓ Imported {count} location relations")


def seed_vehicles(db: Session, csv_path: Path):
    print(f"Importing vehicles from {csv_path}...")
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            vehicle = Vehicle(
                id=int(row["Id"]),
                registration_number=row["registration_number"],
                brand=row["brand"],
                service_interval_km=int(row["service_interval_km"]),
                leasing_start_km=int(row["Leasing_start_km"]),
                leasing_limit_km=int(row["leasing_limit_km"]),
                leasing_start_date=parse_datetime(row["leasing_start_date"]),
                leasing_end_date=parse_datetime(row["leasing_end_date"]),
                current_odometer_km=int(row["current_odometer_km"]),
                current_location_id=parse_nullable_int(row["Current_location_id"]),
            )
            db.add(vehicle)
            count += 1
            if count % 100 == 0:
                db.commit()
        db.commit()
    print(f"✓ Imported {count} vehicles")


def seed_routes(db: Session, csv_path: Path):
    print(f"Importing routes from {csv_path}...")
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            route = Route(
                id=int(row["id"]),
                start_datetime=parse_datetime(row["start_datetime"]),
                end_datetime=parse_datetime(row["end_datetime"]),
                distance_km=float(row["distance_km"]),
            )
            db.add(route)
            count += 1
            if count % 1000 == 0:
                db.commit()
        db.commit()
    print(f"✓ Imported {count} routes")


def seed_segments(db: Session, csv_path: Path):
    print(f"Importing segments from {csv_path}...")
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            segment = Segment(
                id=int(row["id"]),
                route_id=int(row["route_id"]),
                seq=int(row["seq"]),
                start_loc_id=int(row["start_loc_id"]),
                end_loc_id=int(row["end_loc_id"]),
                start_datetime=parse_datetime(row["start_datetime"]),
                end_datetime=parse_datetime(row["end_datetime"]),
                relation_id=int(row["relation_id"]),
            )
            db.add(segment)
            count += 1
            if count % 1000 == 0:
                db.commit()
        db.commit()
    print(f"✓ Imported {count} segments")


def main():
    print("Dropping and recreating tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created")

    # Get CSV directory
    csv_dir = Path(__file__).parent.parent / "__CSV_DATA"

    # Create database session
    db = SessionLocal()

    try:
        # Import data in correct order (respecting foreign keys)
        seed_locations(db, csv_dir / "locations.csv")
        seed_location_relations(db, csv_dir / "locations_relations.csv")
        seed_vehicles(db, csv_dir / "vehicles.csv")
        seed_routes(db, csv_dir / "routes.csv")
        seed_segments(db, csv_dir / "segments.csv")

        print("\n✅ Database seeding completed successfully!")

    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
