from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship


from .database import Base


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    lat = Column(Float)
    long = Column(Float)
    is_hub = Column(Boolean, default=False)

    # Relationships
    routes_as_start = relationship(
        "Segment", foreign_keys="Segment.start_loc_id", back_populates="start_location"
    )
    routes_as_end = relationship(
        "Segment", foreign_keys="Segment.end_loc_id", back_populates="end_location"
    )
    vehicles = relationship("Vehicle", back_populates="current_location")
    relations_1 = relationship(
        "LocationRelation",
        foreign_keys="LocationRelation.id_loc_1",
        back_populates="location_1",
    )
    relations_2 = relationship(
        "LocationRelation",
        foreign_keys="LocationRelation.id_loc_2",
        back_populates="location_2",
    )


class LocationRelation(Base):
    __tablename__ = "location_relations"

    id = Column(Integer, primary_key=True, index=True)
    id_loc_1 = Column(Integer, ForeignKey("locations.id"))
    id_loc_2 = Column(Integer, ForeignKey("locations.id"))
    dist = Column(Float)  # distance in km
    time = Column(Float)  # time in minutes

    # Relationships
    location_1 = relationship(
        "Location", foreign_keys=[id_loc_1], back_populates="relations_1"
    )
    location_2 = relationship(
        "Location", foreign_keys=[id_loc_2], back_populates="relations_2"
    )


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    registration_number = Column(String, unique=True, index=True)
    brand = Column(String)
    service_interval_km = Column(Integer)
    leasing_start_km = Column(Integer)
    leasing_limit_km = Column(Integer)
    leasing_start_date = Column(DateTime)
    leasing_end_date = Column(DateTime)
    current_odometer_km = Column(Integer)
    current_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)

    # Relationships
    current_location = relationship("Location", back_populates="vehicles")


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    start_datetime = Column(DateTime)
    end_datetime = Column(DateTime)
    distance_km = Column(Float)

    # Relationships
    segments = relationship(
        "Segment", back_populates="route", cascade="all, delete-orphan"
    )


class Segment(Base):
    __tablename__ = "segments"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"))
    seq = Column(Integer)  # sequence number in route
    start_loc_id = Column(Integer, ForeignKey("locations.id"))
    end_loc_id = Column(Integer, ForeignKey("locations.id"))
    start_datetime = Column(DateTime)
    end_datetime = Column(DateTime)
    relation_id = Column(Integer, ForeignKey("location_relations.id"))

    # Relationships
    route = relationship("Route", back_populates="segments")
    start_location = relationship(
        "Location", foreign_keys=[start_loc_id], back_populates="routes_as_start"
    )
    end_location = relationship(
        "Location", foreign_keys=[end_loc_id], back_populates="routes_as_end"
    )
    relation = relationship("LocationRelation")
