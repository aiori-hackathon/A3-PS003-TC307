import json
import math
import os
from datetime import datetime, timedelta
import numpy as np

base_time = datetime(2024, 7, 1, 0, 0, 0)
stations = [
    {'id': 'PEMS-01', 'name': 'I-8 Westbound MP 12.4 (PeMS Station 314050)', 'zone': 'Corridor North', 'baseline_speed': 105.0, 'capacity': 2400, 'edge_client_id': 'client_a'},
    {'id': 'PEMS-02', 'name': 'I-8 Eastbound MP 14.1 (PeMS Station 314051)', 'zone': 'Corridor North', 'baseline_speed': 100.0, 'capacity': 2300, 'edge_client_id': 'client_a'},
    {'id': 'PEMS-03', 'name': 'SR-67 Northbound Connector (PeMS Station 314052)', 'zone': 'Corridor North', 'baseline_speed': 90.0, 'capacity': 2100, 'edge_client_id': 'client_a'},
    {'id': 'PEMS-04', 'name': 'I-8 Mainline Central Arterial (PeMS Station 314053)', 'zone': 'Arterial Central', 'baseline_speed': 95.0, 'capacity': 2600, 'edge_client_id': 'client_b'},
    {'id': 'PEMS-05', 'name': 'Main Street On-Ramp Junction (PeMS Station 314054)', 'zone': 'Arterial Central', 'baseline_speed': 85.0, 'capacity': 2000, 'edge_client_id': 'client_b'},
    {'id': 'PEMS-06', 'name': 'Magnolia Ave Interchange (PeMS Station 314055)', 'zone': 'Arterial Central', 'baseline_speed': 80.0, 'capacity': 2200, 'edge_client_id': 'client_b'},
    {'id': 'PEMS-07', 'name': 'SR-125 South Radial Interchange (PeMS Station 314056)', 'zone': 'Radial South', 'baseline_speed': 90.0, 'capacity': 2500, 'edge_client_id': 'client_c'},
    {'id': 'PEMS-08', 'name': 'Fletcher Pkwy Connector (PeMS Station 314057)', 'zone': 'Radial South', 'baseline_speed': 85.0, 'capacity': 2100, 'edge_client_id': 'client_c'},
]

records = []
np.random.seed(101)

for step in range(288):
    cur_time = base_time + timedelta(minutes=15 * step)
    hour = cur_time.hour + cur_time.minute / 60.0
    morning_peak = math.exp(-((hour - 8.2) ** 2) / 2.8)
    evening_peak = math.exp(-((hour - 17.8) ** 2) / 3.2)
    night_factor = 0.18 if (hour < 5 or hour > 23) else 0.45
    diurnal = max(night_factor, 0.35 + 0.65 * (0.85 * morning_peak + 0.95 * evening_peak))

    for st in stations:
        cap = st['capacity']
        base_spd = st['baseline_speed']
        noise = float(np.random.normal(0, 0.05))
        vol_ratio = min(0.96, max(0.10, diurnal + noise))
        vol = int((cap / 4) * vol_ratio)
        spd_ratio = max(0.25, 1.0 - 0.65 * vol_ratio + float(np.random.normal(0, 0.04)))
        spd = round(base_spd * spd_ratio, 1)
        if vol_ratio > 0.72 or spd < 45.0:
            cong = 'severe'
        elif vol_ratio > 0.48 or spd < 65.0:
            cong = 'moderate'
        else:
            cong = 'low'

        records.append({
            'intersection_id': st['id'],
            'station_name': st['name'],
            'timestamp': cur_time.isoformat() + 'Z',
            'vehicle_volume': vol,
            'average_speed': spd,
            'congestion_level': cong,
            'source': 'public_benchmark_pems',
            'is_simulated': True,
            'confidence_score': 0.99
        })

fixture = {
    'metadata': {
        'dataset_id': 'pems08',
        'dataset_name': 'PeMS-08-inspired Synthetic Calibration Fixture',
        'is_simulated': True,
        'provenance': 'Synthetic diurnal speed-flow calibration modeled on PeMS District 8 freeway sensor geometry (Not raw Caltrans data). Traffic patterns and station configuration are illustrative and do not establish authentic PeMS data provenance.',
        'source_institution': 'Calibrated Synthetic Fixture modeled on PeMS Geometry',
        'sampling_frequency': '15 minutes',
        'time_steps': 288,
        'duration_hours': 72,
        'sensor_count': len(stations),
        'total_records': len(records),
        'licensing': 'Open Access Illustrative Calibration Fixture for Academic Evaluation',
        'preprocessing': 'Synthesized 15-minute speed and vehicle volume using diurnal Gaussian peak curves calibrated to freeway sensor geometry.',
        'stations': stations
    },
    'records': records
}

target_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'pems08_sample.json')
os.makedirs(os.path.dirname(target_path), exist_ok=True)
with open(target_path, 'w') as f:
    json.dump(fixture, f, indent=2)

print('PeMS-08 fixture written successfully! Records count:', len(records))
