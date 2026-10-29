from datetime import datetime, timedelta
import math
import numpy as np
from sqlalchemy.orm import Session
from backend.app.models.database import (
    Intersection,
    TrafficObservation,
    EdgeClient,
    FederatedRound,
    CommunicationExperiment,
    IncidentAlert,
)


INTERSECTIONS_DATA = [
    {
        "id": "INT-01",
        "name": "Connaught Central Circle",
        "name_hi": "कनॉट सेंट्रल सर्कल",
        "zone": "CBD",
        "latitude": 28.6328,
        "longitude": 77.2197,
        "baseline_speed": 40.0,
        "capacity": 2200,
        "edge_client_id": "client_a",
    },
    {
        "id": "INT-02",
        "name": "Barakhamba Road Crossing",
        "name_hi": "बाराखम्बा रोड क्रॉसिंग",
        "zone": "CBD",
        "latitude": 28.6292,
        "longitude": 77.2285,
        "baseline_speed": 45.0,
        "capacity": 1900,
        "edge_client_id": "client_a",
    },
    {
        "id": "INT-03",
        "name": "Rajiv Chowk Metro Radial",
        "name_hi": "राजीव चौक मेट्रो रेडियल",
        "zone": "CBD",
        "latitude": 28.6329,
        "longitude": 77.2185,
        "baseline_speed": 35.0,
        "capacity": 2400,
        "edge_client_id": "client_a",
    },
    {
        "id": "INT-04",
        "name": "Ring Road Arterial Junction",
        "name_hi": "रिंग रोड आर्टेरियल जंक्शन",
        "zone": "Arterial",
        "latitude": 28.5714,
        "longitude": 77.1983,
        "baseline_speed": 60.0,
        "capacity": 3200,
        "edge_client_id": "client_b",
    },
    {
        "id": "INT-05",
        "name": "Moti Bagh Flyover Split",
        "name_hi": "मोती बाग फ्लाईओवर स्प्लिट",
        "zone": "Arterial",
        "latitude": 28.5833,
        "longitude": 77.1685,
        "baseline_speed": 55.0,
        "capacity": 2800,
        "edge_client_id": "client_b",
    },
    {
        "id": "INT-06",
        "name": "Dhaula Kuan Interchange",
        "name_hi": "धौला कुआँ इंटरचेंज",
        "zone": "Arterial",
        "latitude": 28.5921,
        "longitude": 77.1594,
        "baseline_speed": 50.0,
        "capacity": 3500,
        "edge_client_id": "client_b",
    },
    {
        "id": "INT-07",
        "name": "Cyber Hub Gateway",
        "name_hi": "साइबर हब गेटवे",
        "zone": "Tech Corridor",
        "latitude": 28.4986,
        "longitude": 77.0878,
        "baseline_speed": 45.0,
        "capacity": 2600,
        "edge_client_id": "client_c",
    },
    {
        "id": "INT-08",
        "name": "Golf Course Express Radial",
        "name_hi": "गोल्फ कोर्स एक्सप्रेस रेडियल",
        "zone": "Tech Corridor",
        "latitude": 28.4715,
        "longitude": 77.0984,
        "baseline_speed": 65.0,
        "capacity": 2900,
        "edge_client_id": "client_c",
    },
]

EDGE_CLIENTS_DATA = [
    {
        "id": "client_a",
        "name": "Edge Client A — CBD Cluster",
        "name_hi": "एज क्लाइंट A — सीबीडी क्लस्टर",
        "zone": "CBD",
        "status": "active",
        "local_samples": 864,
        "battery_health": 98.5,
        "network_latency": 18.2,
        "last_sync_round": 6,
    },
    {
        "id": "client_b",
        "name": "Edge Client B — Ring Road Arterial",
        "name_hi": "एज क्लाइंट B — रिंग रोड आर्टेरियल",
        "zone": "Arterial",
        "status": "active",
        "local_samples": 864,
        "battery_health": 94.0,
        "network_latency": 26.4,
        "last_sync_round": 6,
    },
    {
        "id": "client_c",
        "name": "Edge Client C — Tech Corridor",
        "name_hi": "एज क्लाइंट C — टेक कॉरिडोर",
        "zone": "Tech Corridor",
        "status": "active",
        "local_samples": 576,
        "battery_health": 99.1,
        "network_latency": 22.0,
        "last_sync_round": 6,
    },
]

INITIAL_INCIDENTS_DATA = [
    {
        "id": "INC-101",
        "intersection_id": "INT-06",
        "incident_type": "surge",
        "severity": "critical",
        "description_en": "Sudden 42% traffic volume surge detected on Dhaula Kuan Interchange inbound lanes.",
        "description_hi": "धौला कुआँ इंटरचेंज इनबाउंड लेन पर ट्रैफिक वॉल्यूम में अचानक 42% की वृद्धि दर्ज की गई।",
        "recommended_action_en": "Adjust signal phase timing: extend green interval by 20s on arterial approach.",
        "recommended_action_hi": "सिग्नल टाइमिंग समायोजित करें: आर्टेरियल दिशा में ग्रीन सिग्नल 20 सेकंड बढ़ाएं।",
        "status": "open",
    },
    {
        "id": "INC-102",
        "intersection_id": "INT-03",
        "incident_type": "speed_drop",
        "severity": "warning",
        "description_en": "Average vehicle speed dropped below 15 km/h at Rajiv Chowk Radial.",
        "description_hi": "राजीव चौक रेडियल पर औसत वाहन गति 15 किमी/घंटे से नीचे गिर गई।",
        "recommended_action_en": "Deploy traffic marshal and broadcast variable message warning on Inner Ring.",
        "recommended_action_hi": "ट्रैफिक मार्शल तैनात करें और इनर रिंग पर डायवर्जन चेतावनी संदेश प्रसारित करें।",
        "status": "acknowledged",
    },
    {
        "id": "INC-103",
        "intersection_id": "INT-07",
        "incident_type": "congestion_prediction",
        "severity": "info",
        "description_en": "AI forecast predicts heavy congestion at Cyber Hub Gateway within the next 30 minutes.",
        "description_hi": "AI पूर्वानुमान के अनुसार अगले 30 मिनट में साइबर हब गेटवे पर भारी जाम की संभावना है।",
        "recommended_action_en": "Pre-emptively stagger peripheral office lane merging lights.",
        "recommended_action_hi": "कार्यालय निकास लेन की मर्जिंग बत्तियों को समय रहते नियंत्रित करें।",
        "status": "open",
    },
]


def seed_database(db: Session, force_reset: bool = False):
    """Seed reproducible synthetic dataset into SQLite."""
    existing_intersections = db.query(Intersection).count()
    if existing_intersections > 0 and not force_reset:
        return

    if force_reset:
        db.query(TrafficObservation).delete()
        db.query(IncidentAlert).delete()
        db.query(FederatedRound).delete()
        db.query(CommunicationExperiment).delete()
        db.query(EdgeClient).delete()
        db.query(Intersection).delete()
        db.commit()

    # 1. Insert Intersections
    for item in INTERSECTIONS_DATA:
        inter = Intersection(**item)
        db.add(inter)
    db.commit()

    # 2. Insert Edge Clients
    for item in EDGE_CLIENTS_DATA:
        client = EdgeClient(**item)
        db.add(client)
    db.commit()

    # 3. Generate 72 hours of 15-minute observations (288 steps)
    np.random.seed(42)
    base_time = datetime.utcnow().replace(minute=0, second=0, microsecond=0) - timedelta(hours=72)
    observations = []

    for step in range(288):
        current_time = base_time + timedelta(minutes=15 * step)
        hour = current_time.hour + (current_time.minute / 60.0)

        # Diurnal pattern
        morning_peak = math.exp(-((hour - 9.0) ** 2) / 2.5)
        evening_peak = math.exp(-((hour - 18.5) ** 2) / 3.0)
        night_dip = 0.2 if (hour < 5 or hour > 23) else 0.5
        diurnal_factor = max(night_dip, 0.4 + 0.6 * (0.8 * morning_peak + 1.0 * evening_peak))

        for inter in INTERSECTIONS_DATA:
            inter_id = inter["id"]
            capacity = inter["capacity"]
            baseline_spd = inter["baseline_speed"]

            noise = np.random.normal(0, 0.08)
            volume_ratio = min(0.98, max(0.12, diurnal_factor + noise))
            vehicle_vol = int((capacity / 4) * volume_ratio)  # 15-min volume

            # Speed drops as volume increases (Greenshields relation)
            speed_ratio = max(0.2, 1.0 - 0.75 * volume_ratio + np.random.normal(0, 0.05))
            avg_speed = round(baseline_spd * speed_ratio, 1)

            if volume_ratio > 0.75 or avg_speed < 18.0:
                congestion = "severe"
            elif volume_ratio > 0.50 or avg_speed < 30.0:
                congestion = "moderate"
            else:
                congestion = "low"

            obs = TrafficObservation(
                intersection_id=inter_id,
                timestamp=current_time,
                vehicle_volume=vehicle_vol,
                average_speed=avg_speed,
                congestion_level=congestion,
                is_simulated=True,
            )
            observations.append(obs)

    db.bulk_save_objects(observations)
    db.commit()

    # 4. Insert Initial Incidents
    for inc_data in INITIAL_INCIDENTS_DATA:
        inc = IncidentAlert(
            id=inc_data["id"],
            intersection_id=inc_data["intersection_id"],
            incident_type=inc_data["incident_type"],
            severity=inc_data["severity"],
            description_en=inc_data["description_en"],
            description_hi=inc_data["description_hi"],
            recommended_action_en=inc_data["recommended_action_en"],
            recommended_action_hi=inc_data["recommended_action_hi"],
            status=inc_data["status"],
            created_at=datetime.utcnow() - timedelta(minutes=45),
        )
        db.add(inc)
    db.commit()

    # 5. Insert Initial Federated Rounds history (rounds 1 to 6)
    fl_history = [
        {"round": 1, "loss": 0.482, "mae": 42.6, "rmse": 55.8, "bytes": 142400},
        {"round": 2, "loss": 0.365, "mae": 34.2, "rmse": 45.1, "bytes": 142400},
        {"round": 3, "loss": 0.284, "mae": 28.5, "rmse": 38.4, "bytes": 142400},
        {"round": 4, "loss": 0.221, "mae": 24.1, "rmse": 32.7, "bytes": 142400},
        {"round": 5, "loss": 0.178, "mae": 21.0, "rmse": 28.3, "bytes": 142400},
        {"round": 6, "loss": 0.152, "mae": 18.4, "rmse": 25.1, "bytes": 142400},
    ]
    for r in fl_history:
        fr = FederatedRound(
            round_number=r["round"],
            participating_clients='["client_a", "client_b", "client_c"]',
            aggregation_method="FedAvg",
            global_loss=r["loss"],
            test_mae=r["mae"],
            test_rmse=r["rmse"],
            total_payload_bytes=r["bytes"],
            created_at=datetime.utcnow() - timedelta(minutes=15 * (6 - r["round"])),
        )
        db.add(fr)
    db.commit()

    # 6. Insert Initial Communication Experiments (Pareto configurations)
    experiments_data = [
        {
            "name": "Baseline (Uncompressed FP32)",
            "top_k": 100.0,
            "int8": False,
            "thresh": 0.1,
            "baseline": 142400,
            "optimized": 142400,
            "savings": 0.0,
            "mae": 18.4,
            "rmse": 25.1,
            "rec_mse": 0.0,
            "transmitted": 18,
            "skipped": 0,
        },
        {
            "name": "Quantization Only (INT8)",
            "top_k": 100.0,
            "int8": True,
            "thresh": 0.1,
            "baseline": 142400,
            "optimized": 38200,
            "savings": 73.17,
            "mae": 18.7,
            "rmse": 25.4,
            "rec_mse": 0.0034,
            "transmitted": 18,
            "skipped": 0,
        },
        {
            "name": "Top-K 50% Retention + INT8",
            "top_k": 50.0,
            "int8": True,
            "thresh": 0.1,
            "baseline": 142400,
            "optimized": 21400,
            "savings": 84.97,
            "mae": 19.3,
            "rmse": 26.2,
            "rec_mse": 0.0078,
            "transmitted": 18,
            "skipped": 0,
        },
        {
            "name": "TrafficFL Optimal (Top-K 35% + INT8 + Event-Driven)",
            "top_k": 35.0,
            "int8": True,
            "thresh": 0.35,
            "baseline": 142400,
            "optimized": 12850,
            "savings": 90.98,
            "mae": 19.9,
            "rmse": 27.1,
            "rec_mse": 0.0112,
            "transmitted": 11,
            "skipped": 7,
        },
        {
            "name": "Aggressive Compression (Top-K 15% + INT8 + High Threshold)",
            "top_k": 15.0,
            "int8": True,
            "thresh": 0.60,
            "baseline": 142400,
            "optimized": 6200,
            "savings": 95.65,
            "mae": 24.8,
            "rmse": 33.6,
            "rec_mse": 0.0245,
            "transmitted": 6,
            "skipped": 12,
        },
    ]

    for exp in experiments_data:
        ce = CommunicationExperiment(
            name=exp["name"],
            top_k_retention_pct=exp["top_k"],
            int8_quantization=exp["int8"],
            event_driven_threshold=exp["thresh"],
            baseline_bytes=exp["baseline"],
            optimized_bytes=exp["optimized"],
            savings_pct=exp["savings"],
            mae=exp["mae"],
            rmse=exp["rmse"],
            reconstruction_mse=exp["rec_mse"],
            rounds_executed=6,
            updates_transmitted=exp["transmitted"],
            updates_skipped=exp["skipped"],
            timestamp=datetime.utcnow() - timedelta(hours=1),
        )
        db.add(ce)
    db.commit()


def seed_pems_benchmark(db: Session, force_replace: bool = False):
    """Loads and seeds PeMS-08-inspired Synthetic Calibration Fixture into database."""
    import os
    import json

    pems_obs_count = (
        db.query(TrafficObservation)
        .filter(TrafficObservation.source == "public_benchmark_pems")
        .count()
    )
    fixture_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "data",
        "pems08_sample.json",
    )
    if not os.path.exists(fixture_path):
        return {"status": "fixture_missing", "count": 0}

    with open(fixture_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    meta = data.get("metadata", {})
    stations = meta.get("stations", [])
    records = data.get("records", [])

    if pems_obs_count > 0 and not force_replace:
        return {
            "status": "already_seeded",
            "metadata": meta,
            "count": pems_obs_count,
        }

    if force_replace:
        db.query(TrafficObservation).filter(
            TrafficObservation.source == "public_benchmark_pems"
        ).delete()
        db.commit()

    # Insert PeMS observations (without mutating core Delhi NCR Intersections)
    obs_objects = []
    for r in records:
        ts_str = r["timestamp"].replace("Z", "+00:00")
        try:
            ts = datetime.fromisoformat(ts_str).replace(tzinfo=None)
        except Exception:
            ts = datetime.utcnow()
        obs = TrafficObservation(
            intersection_id=r["intersection_id"],
            timestamp=ts,
            vehicle_volume=r["vehicle_volume"],
            average_speed=r["average_speed"],
            congestion_level=r.get("congestion_level", "low"),
            is_simulated=True,
            source="public_benchmark_pems",
        )
        obs_objects.append(obs)

    db.bulk_save_objects(obs_objects)
    db.commit()

    return {
        "status": "seeded",
        "metadata": meta,
        "count": len(obs_objects),
    }
