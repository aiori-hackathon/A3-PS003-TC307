from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
)
from sqlalchemy.orm import relationship
from backend.app.database import Base


class Intersection(Base):
    __tablename__ = "intersections"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    name_hi = Column(String(100), nullable=False)
    zone = Column(String(50), nullable=False)  # e.g., "CBD", "Arterial", "Tech Corridor"
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    baseline_speed = Column(Float, default=45.0)  # km/h
    capacity = Column(Integer, default=1800)  # vehicles per hour
    edge_client_id = Column(String(50), nullable=True)

    observations = relationship("TrafficObservation", back_populates="intersection", cascade="all, delete-orphan")
    incidents = relationship("IncidentAlert", back_populates="intersection", cascade="all, delete-orphan")


class TrafficObservation(Base):
    __tablename__ = "traffic_observations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    intersection_id = Column(String(50), ForeignKey("intersections.id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    vehicle_volume = Column(Integer, nullable=False)  # vehicles per 15-min
    average_speed = Column(Float, nullable=False)  # km/h
    congestion_level = Column(String(20), nullable=False)  # "low", "moderate", "severe"
    is_simulated = Column(Boolean, default=True)
    source = Column(String(50), default="simulated", nullable=False)  # "live_provider", "simulated", "cached", "sensor"
    provider_name = Column(String(100), default="Simulated Diurnal Stream", nullable=True)
    confidence_score = Column(Float, default=1.0, nullable=True)

    intersection = relationship("Intersection", back_populates="observations")


class EdgeClient(Base):
    __tablename__ = "edge_clients"

    id = Column(String(50), primary_key=True)  # e.g., "client_a", "client_b", "client_c"
    name = Column(String(100), nullable=False)
    name_hi = Column(String(100), nullable=False)
    zone = Column(String(50), nullable=False)
    status = Column(String(20), default="active")  # "active", "training", "idle", "disconnected"
    local_samples = Column(Integer, default=0)
    battery_health = Column(Float, default=100.0)  # %
    network_latency = Column(Float, default=24.5)  # ms
    last_sync_round = Column(Integer, default=0)


class FederatedRound(Base):
    __tablename__ = "federated_rounds"

    id = Column(Integer, primary_key=True, autoincrement=True)
    round_number = Column(Integer, unique=True, nullable=False, index=True)
    participating_clients = Column(Text, nullable=False)  # JSON list of client IDs
    aggregation_method = Column(String(50), default="FedAvg")
    global_loss = Column(Float, nullable=False)
    test_mae = Column(Float, nullable=False)
    test_rmse = Column(Float, nullable=False)
    total_payload_bytes = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class CommunicationExperiment(Base):
    __tablename__ = "communication_experiments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    top_k_retention_pct = Column(Float, nullable=False)  # 10% - 100%
    int8_quantization = Column(Boolean, nullable=False)
    event_driven_threshold = Column(Float, nullable=False)
    baseline_bytes = Column(Integer, nullable=False)
    optimized_bytes = Column(Integer, nullable=False)
    savings_pct = Column(Float, nullable=False)
    mae = Column(Float, nullable=False)
    rmse = Column(Float, nullable=False)
    reconstruction_mse = Column(Float, default=0.0)
    rounds_executed = Column(Integer, default=5)
    updates_transmitted = Column(Integer, default=0)
    updates_skipped = Column(Integer, default=0)


class IncidentAlert(Base):
    __tablename__ = "incident_alerts"

    id = Column(String(50), primary_key=True)
    intersection_id = Column(String(50), ForeignKey("intersections.id"), nullable=False)
    incident_type = Column(String(50), nullable=False)  # "surge", "speed_drop", "congestion_prediction", "node_failure"
    severity = Column(String(20), nullable=False)  # "critical", "warning", "info"
    description_en = Column(Text, nullable=False)
    description_hi = Column(Text, nullable=False)
    recommended_action_en = Column(Text, nullable=False)
    recommended_action_hi = Column(Text, nullable=False)
    status = Column(String(20), default="open")  # "open", "acknowledged", "resolved"
    created_at = Column(DateTime, default=datetime.utcnow)
    is_simulated = Column(Boolean, default=True)
    source = Column(String(50), default="simulated", nullable=False)

    intersection = relationship("Intersection", back_populates="incidents")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(100), index=True, nullable=False)
    sender = Column(String(20), nullable=False)  # "user", "assistant"
    content = Column(Text, nullable=False)
    language = Column(String(10), default="en")
    data_citations = Column(Text, nullable=True)  # JSON array
    timestamp = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="citizen")  # "admin", "authority", "citizen"
    is_active = Column(Boolean, default=True)
    is_demo = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(128), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="reset_tokens")

