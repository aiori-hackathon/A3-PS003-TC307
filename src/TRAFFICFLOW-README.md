# TrafficFlow-AI (TrafficFL) — Smart City Traffic Intelligence Platform

TrafficFlow-AI is a privacy-preserving, communication-efficient traffic prediction and municipal intelligence platform. Built on a single integrated architecture (FastAPI backend, React 19 / TypeScript / Tailwind CSS frontend, SQLite persistence, and scikit-learn Ridge Regression ML), the system bridges real-time external traffic provider telemetry with edge-coordinated Federated Learning (FedAvg) and communication optimization (Top-K sparsification, 8-bit uniform quantization, event-driven delta updates).

---

## 🏛️ System Architecture & Logical Pipeline

```
                       +-----------------------------------------------+
                       |       TomTom Traffic Flow API (External)      |
                       | - Real-time Delhi NCR arterial coordinates   |
                       | - Bounded retries, 5s timeouts, TTL caching   |
                       +-----------------------+-----------------------+
                                               |
                                               v
                       +-----------------------------------------------+
                       |        Shared Traffic Provider Service        |
                       | - Fallback: live -> cached -> simulated stream|
                       | - Canonical TrafficObservationDTO schema      |
                       +-----------------------+-----------------------+
                                               |
                                               v
                       +-----------------------------------------------+
                       |  Historical Observation Service & SQLite DB   |
                       | - Non-destructive idempotent schema migration |
                       | - 5-min proximity deduplication protection    |
                       | - Provenance: live_provider, cached, simulated|
                       +-----------------------+-----------------------+
                                               |
                                               v
                       +-----------------------------------------------+
                       |    Chronological ML Dataset Preparation       |
                       | - Leakage-free train / val / test splits      |
                       | - Road identity isolation                     |
                       | - 15-minute ahead speed target (target_speed) |
                       +-----------------------+-----------------------+
                                               |
                                               v
                       +-----------------------------------------------+
                       |    Ridge Speed Forecaster & Evaluator         |
                       | - Offline artifact persistence (data/models/) |
                       | - Readiness checks: ready / calibrating       |
                       | - Genuinely measured vs Naive Persistence MAE |
                       | - Empirical residual uncertainty (+-1.96*std) |
                       +-----------------------+-----------------------+
                                               |
                                               v
                       +-----------------------------------------------+
                       |      FastAPI Backend REST API Layer          |
                       | - Role-Based Access Control (Admin/Authority) |
                       | - Provider diagnostics & collection sync      |
                       | - Predictions, History, Digital Twin, FL Lab  |
                       +-----------------------+-----------------------+
                                               |
                                               v
                       +-----------------------------------------------+
                       |     TrafficFlow-AI Frontend (React 19 + TS)   |
                       | - Live Traffic Map with TomTom status alerts  |
                       | - Traffic Prediction with readiness guards    |
                       | - Overview Dashboard with provider ribbon     |
                       | - Full bilingual localization (English / हिंदी) |
                       +-----------------------------------------------+
```

---

## 🌟 Key Functional Modules

1. **Live Traffic Map**:
   - Leaflet/OpenStreetMap geospatial visualizer for Delhi NCR arterial corridors.
   - Dynamic provider health badge: indicates active **TomTom Live Provider** or **Delhi NCR Simulation**.
   - Top banner alert when provider experiences degraded connectivity or fallback status.
   - Selected junction detail panel shows observed volume/speed, risk score, edge client ID, control recommendations, data freshness, and exact provenance tag (`TomTom Live Feed`, `Cached Provider Snapshot`, or `Corridor Benchmark`).
   - Forecasts guarded: suppresses uncalibrated predictions when model readiness is not ready.

2. **Traffic Prediction**:
   - Multi-horizon forecasting (15m, 30m, 1h, 6h, 24h) with 15-minute speed trajectory.
   - Prominent **AI Model Readiness Banner** alerting operators if the model is in a calibrating or untrained state.
   - Genuinely benchmarked evaluation: compares trained Ridge model MAE/RMSE against naive persistence baseline ($v_{t+15} = v_t$) with measured percentage improvement.
   - Empirical residual confidence intervals ($\pm 1.96 \cdot \sigma_{\text{test}}$) and execution latency in milliseconds.
   - Ridge regression feature attribution weights.

3. **Overview Dashboard**:
   - High-level KPIs: monitored intersections, citywide average speed, congested road count, bandwidth savings, and federated round status.
   - Provider diagnostics ribbon displaying provider name, online/fallback state, cached records count, and data freshness.
   - One-click **Sync Ingestion** button triggering backend-coordinated collection.
   - Traffic volume timeline, congestion level breakdown, and communication savings curves.

4. **Federated Learning Lab & Communication Optimizer**:
   - 3 simulated municipal edge nodes (CBD, Ring Road Arterial, Tech Corridor).
   - Sample-count-weighted FedAvg model parameter aggregation.
   - Communication reduction suite: Top-K sparsification (10%–100%), INT8 uniform quantization with measured reconstruction MSE, and event-driven synchronization thresholds ($\tau$).
   - Empirical Pareto Frontier visualization balancing communication bandwidth savings against forecast quality.

5. **Traffic Digital Twin & Incident Detection**:
   - Scenario simulation (Morning Rush, Evening Rush, Sudden Surge, Road Closure, Node Failure).
   - Anomaly detection generating automated incident alerts with status workflows (Open $\to$ Acknowledged $\to$ Resolved).

6. **Authentication & RBAC**:
   - Argon2 password hashing and PyJWT bearer token authorization.
   - Role-Based Access Control enforcing Authority/Admin permissions on collection orchestration and simulation triggers while allowing Citizens read-only access.
   - Pre-seeded Demo Accounts for instant evaluation.

---

## 🚀 Exact Startup Commands

### Prerequisites
- **Python**: 3.10+ (tested on Python 3.13)
- **Node.js**: v18+ (tested on Node v24)
- **npm**: v10+

### 1. Backend Server Startup
```bash
# Navigate to the backend directory
cd backend

# (Optional) Activate your Python virtual environment
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server using Uvicorn
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The interactive OpenAPI/Swagger documentation is accessible at:  
👉 `http://127.0.0.1:8000/docs`

### 2. Frontend Development Server Startup
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Start the Vite development server
npm run dev
```
Open your browser at:  
👉 `http://127.0.0.1:5173`

---

## ⚙️ Environment Variables & API Configuration

### Backend Configuration (`backend/.env`)
Copy `backend/.env.example` to `backend/.env` and configure:

```ini
# Server Settings
PORT=8000
HOST=127.0.0.1
DATABASE_URL=sqlite:///./data/trafficfl.db

# Security & Authentication
SECRET_KEY=dev-trafficfl-secret-key-change-in-production-2026
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# TomTom Traffic Flow API
# Set to "live" to query TomTom APIs; "simulated" uses the calibrated Delhi NCR stream
TRAFFIC_PROVIDER_MODE=live
TOMTOM_API_KEY=YOUR_TOMTOM_API_KEY_HERE
TOMTOM_BASE_URL=https://api.tomtom.com/traffic/services/4
TOMTOM_CACHE_TTL_SECONDS=300
TOMTOM_TIMEOUT_SECONDS=5.0
TOMTOM_MAX_RETRIES=2

# Machine Learning Artifact Persistence
MODELS_DIR=./data/models

# Optional LLM API Keys
GEMINI_API_KEY=
OPENAI_API_KEY=

# CORS Origins
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### Frontend Configuration (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:

```ini
VITE_API_URL=http://127.0.0.1:8000/api
```

---

## 🗄️ Historical Data Requirements & Persistence

- **Database Engine:** SQLite stored at `backend/data/trafficfl.db`.
- **Pre-existing Observations:** Contains 2,768+ historical Delhi NCR observations spanning 8 arterial corridors (INT-01 to INT-08).
- **Additive Migration:** Automated schema migration adds `source`, `provider_name`, and `confidence_score` non-destructively without dropping tables or losing historical readings.
- **Duplicate Protection:** Backend-coordinated collection enforces a 5-minute proximity window per intersection. Rapid successive calls are deduplicated and throttled.
- **Data Provenance:** Every observation record is explicitly tagged:
  - `source="live_provider"` — Genuine reading from external TomTom Traffic Flow API.
  - `source="cached"` — Cached provider snapshot returned during transient network interruptions.
  - `source="simulated"` — Diurnal calibrated synthetic corridor stream.

---

## 🧠 Model Training & Inference Instructions

### Offline Speed Forecaster Training
The 15-minute speed forecasting model can be trained on historical observations using the Python runtime:

```python
from backend.app.database import SessionLocal
from backend.app.ml.predictor import predictor_instance

db = SessionLocal()
try:
    # Train 15-minute speed forecasting model for INT-01
    eval_result = predictor_instance.train_speed_model(db, intersection_id="INT-01")
    print(f"Model MAE: {eval_result.model_mae:.2f} km/h")
    print(f"Naive Baseline MAE: {eval_result.baseline_mae:.2f} km/h")
    print(f"Improvement over persistence: {eval_result.improvement_pct:.1f}%")
finally:
    db.close()
```

### Model Persistence & Artifacts
- Serialized model artifacts are stored under `backend/data/models/` as `ridge_speed_{intersection_id}_h15.pkl`.
- Inference loads the serialized weights on demand without retraining on every API request.
- If history is insufficient (< 10 valid consecutive pairs) or the model file is absent, `predictor.get_model_status()` reports `status="untrained"`, and the API gracefully returns `model_readiness="untrained"` without fabricating predictions.

---

## 🧪 Automated Verification & Testing

### 1. Run Complete Backend Test Suite
```bash
python -m pytest tests/ -v
```
**Test Coverage (46 Tests across 10 Test Modules):**
- `tests/test_end_to_end_verification.py`: Full E2E flow covering API-key failure fallback, database persistence, model readiness contracts, authentication RBAC, and data provenance distinguishability.
- `tests/test_api_integration.py`: Endpoints `/api/health`, `/api/traffic/provider-status`, `/api/dashboard/summary`, `/api/traffic/intersections`, `/api/traffic/history`, and `/api/predictions/run`.
- `tests/test_traffic_provider.py`: TomTom API flow reading, bounded retries (2 retries), timeouts (5s), cache fallbacks, and simulated mode.
- `tests/test_historical_observations.py`: Migration idempotence, duplicate protection, request throttling, and provenance filtering.
- `tests/test_ml_dataset.py`: Chronological train/validation/test splitting, leakage prevention, road identity isolation, and missing observation gap handling.
- `tests/test_ml_training_inference.py`: Model training, naive baseline comparison, readiness checks, artifact persistence, and zero fabrication on missing history.
- `tests/test_auth.py` & `tests/test_permissions.py`: Argon2 hashing, JWT verification, role permission gating.
- `tests/test_backend.py` & `tests/test_trafficflow_ai.py`: FL rounds, digital twin simulations, route comparison, and bilingual assistant.

### 2. Run Frontend Build & Linter
```bash
# Verify TypeScript compilation and production bundle
npm run build --prefix frontend

# Verify linter rules
npm run lint --prefix frontend
```

---

## ⚠️ Known Limitations & Real-World Boundaries

1. **Provider API Quotas:** TomTom Traffic Flow API queries require a valid `TOMTOM_API_KEY`. When unconfigured or exhausted, the system automatically falls back to cached snapshots or calibrated synthetic corridor streams (`TRAFFIC_PROVIDER_MODE=simulated`). The UI clearly discloses this via fallback alert banners and provenance chips.
2. **Model Horizon Specificity:** The ML speed predictor is trained specifically for 15-minute forward horizons ($t+15\text{m}$) using 8 chronological lag and temporal features. Longer horizons (e.g. 6h, 24h) use the generalized volume forecaster with empirical residual bands.
3. **Federated Edge Nodes:** The 3 edge clients (CBD, Ring Road Arterial, Tech Corridor) operate as simulated in-process nodes demonstrating sample-count-weighted FedAvg and gradient compression rather than physical embedded IoT hardware.
4. **Authenticity Disclaimer:** In accordance with project instructions, synthetic and simulated observations are never used to claim real-world ML accuracy. Real accuracy claims are restricted strictly to genuinely verified holdout test splits.

---

## 👥 Credits
Developed by **Team Nexora** for AI-Powered Privacy-Preserving Smart City Mobility.
