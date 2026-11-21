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

## 🌐 Genuine Public Traffic Dataset Integration (PS-003)

TrafficFlow-AI separates **official PS-003 public dataset experiments** (`pems08_public`) from **synthetic demonstration fixtures** (`pems08` and `synthetic`):

| Dataset ID | Classification | Provenance & Origin | Records / Sensors | Target Variable | Usage Scope |
|---|---|---|---|---|---|
| **`pems08_public`** | **Genuine Public Dataset (`PS-003 Eligible`)** | Caltrans PeMS District 8 (San Bernardino) by Shiqi Zhang (Zhengzhou Univ.) via Zenodo DOI `10.5281/zenodo.7816008` (ASTGCN, AAAI 2019) | `17,856` steps × `170` sensors (`3,035,520` valid observations) | Future 5-min Flow (`veh/5m`) | Official Centralized vs. FedAvg evaluation |
| **`pems08`** | Synthetic Demo (`is_simulated=true`) | `backend/data/pems08_sample.json` (Diurnal Gaussian curve modeled on PeMS geometry, **not raw Caltrans data**) | `2,304` steps (`8` synthetic stations) | Synthetic Volume (`veh/15m`) | UI demonstration & unit testing only |
| **`synthetic`** | Synthetic Demo (`is_simulated=true`) | Built-in Delhi NCR calibrated diurnal baseline (`seed_data.py`) | `2,304+` simulated rows (`8` corridors) | Simulated Volume (`veh/15m`) | Local development & fallback |

### Reproducible Acquisition & Verification
The authentic PeMS08 files are stored in `backend/data/public/` (`PEMS08.npz`, `PEMS08.csv`, `pems08_metadata.json`) and can be fetched or SHA-256 verified anytime from Zenodo:
```bash
python -m backend.app.services.fetch_public_dataset
```
- **Documentation & Repository:** `https://zenodo.org/records/7816008` (DOI: `10.5281/zenodo.7816008`)
- **Licence / Usage Terms:** Creative Commons Attribution 4.0 International (**CC-BY-4.0**), derived from California Department of Transportation (Caltrans) PeMS public records and published on Zenodo (`TrafficDataSets`, `2023-04-11`) by **Shiqi Zhang (Zhengzhou University, ORCID: `0000-0001-9940-8409`)** for academic and commercial research with attribution.

### Schema, Preprocessing & Client Partitioning
- **Raw Data Schema (`backend/app/federated/public_dataset.py`):**
  - `PEMS08.npz` (`18,525,419` bytes): NumPy tensor key `data` with shape `(17856, 170, 3)` covering **July 1, 2016 00:00** to **August 31, 2016 23:55** at **5-minute intervals** across **170 original loop detectors** (`PEMS08-S000`–`PEMS08-S169`), containing 3 verified physical channels: `flow` (`veh/5m`), `occupy` (`[0, 1]` lane occupancy ratio), and `speed` (`mph`).
  - `PEMS08.csv` (`4,032` bytes): Spatial detector adjacency graph (`from,to,cost`, `295` directed corridor edges).
- **Data Cleaning & Leakage Prevention:**
  - Non-finite (`NaN`/`Inf`) or out-of-range measurements (`flow < 0`, `occupy < 0`, `occupy > 1`, `speed < 0`) are excluded transparently without fabricating missing observations, and sliding windows overlapping invalid points are dropped. Valid finite zero-traffic intervals (`flow == 0` and `occupy == 0` — `10,560` points / `0.348%`, 88.3% nocturnal between `21:00–06:55` on low-volume ramp detectors) are preserved as legitimate measurements rather than discarded.
  - Chronological timestamps (`2016-07-01T00:00:00` + `5m × step`) are split 80/20 chronologically with an explicit **horizon purge embargo** (`horizon_steps`), enforcing `max(train_target_timestamp) < min(test_input_timestamp)`.
  - Fixed physical feature scaling (`[flow/500, occupy, speed/100, sin_hour, cos_hour, is_weekend]`, 8 features + 1 intercept) prevents cross-client or test-set normalization leakage.
- **Deterministic Virtual Client Assignment:**
  - The `170` original sensors (`0..169`) are deterministically partitioned into **4 disjoint freeway corridor clients**: `pems08_zone_1` (Sensors `0–42`), `pems08_zone_2` (Sensors `43–85`), `pems08_zone_3` (Sensors `86–127`), and `pems08_zone_4` (Sensors `128–169`).
- **Known Limitations:**
  - If `backend/data/public/PEMS08.npz` is missing or malformed, endpoints return explicit HTTP `503`/`422` errors with **zero random or synthetic fallback**.
  - `PEMS08.npz` stores speed in `mph` and flow in `veh/5m`; horizon requests on `pems08_public` must be multiples of 5 minutes (15m, 30m, 60m supported directly).

### IID vs. Non-IID Federated Learning Experiments (PS-003)

TrafficFlow AI supports scientifically controlled federated partitioning experiments comparing **IID** and **Non-IID** training data distributions across the same genuine `pems08_public` dataset (and compatible DB/CSV fixtures):

- **IID Partitioning (`partition_strategy="iid"`):**
  - Deterministically shuffles the chronological training observations (seeded via `random_seed`, default `42`) using a uniform random permutation and deals equal-sized shards across the 4 virtual clients (`~606,772–606,773` training windows each for 15-minute `pems08_public` horizon). Every client sees nearly identical aggregate flow, speed, and occupancy distributions without sample duplication or loss.
- **Non-IID Partitioning (`partition_strategy="non_iid"`):**
  - Preserves physical freeway corridor/detector grouping (`pems08_zone_1` through `pems08_zone_4`) and retains ascending chronological order within each client. Because upstream and downstream Caltrans PeMS District 8 freeway segments carry genuinely different traffic volumes and occupancy levels, inter-client distribution differences (e.g., corridor mean flow spread and CV%) emerge organically from authentic measurements rather than artificial value perturbations.
- **How Virtual Clients Are Formed:**
  - Virtual clients are **logical/simulated software partitions** constructed deterministically over the public PeMS08 sensor array (or corridor zones in synthetic/live DB fixtures)—they do **not** represent deployed physical roadside edge hardware.
- **Why Non-IID Traffic Data Is Realistic:**
  - Real regional traffic agencies, toll operators, and corridor sub-networks observe skewed peak volumes, lane geometry capacities, and bottleneck densities depending on local geography, making statistical heterogeneity (Non-IID) the natural operating regime for decentralized traffic forecasting.
- **Fairness Controls & Leakage Prevention:**
  - Both IID and Non-IID experiments reuse the exact same global chronological 80/20 purge boundary, identical holdout test evaluation set, identical forecasting horizon, model architecture, Ridge regularization, FedAvg hyperparameters, round count, and `random_seed`. The **Centralized** baseline trains on the unified pre-partition training matrix and is mathematically independent of client partitioning.
- **Running Experiments:**
  - **UI:** Open **Federated Learning Lab**, choose a dataset (e.g., `PeMS08 Public (Genuine Benchmark)`), select **Side-by-Side (IID vs Non-IID)** (or individual IID / Non-IID strategy) and an optional **Random Seed**, then click **Run Benchmark Comparison**.
  - **API:** Call `POST /api/federated/benchmark-compare` (`partition_strategy: "iid" | "non_iid"`, `random_seed: 42`) or `POST /api/federated/benchmark-partition-compare` for controlled side-by-side results with per-client aggregate statistics.
- **Experimental Limitations:**
  - Federated training runs in an in-process simulated multi-client loop without live wide-area network latency; privacy statistics report aggregate means/counts only; results are deterministic for a fixed `random_seed` and single-seed unless swept explicitly.

### Reproducible Three-Seed Federated Learning Experiments (PS-003)

To verify stability across random data permutations without cherry-picking a single seed, TrafficFlow AI supports repeatable multi-seed evaluation across **Centralized**, **FedAvg IID**, and **FedAvg Non-IID**:

- **Default Seeds:** `[42, 123, 2026]` (configurable list of distinct non-negative integers via UI/API; defaults to all three).
- **Why Multiple Seeds Are Necessary:** Single-seed splits can mask variance introduced by random IID window allocation. Running three independent seeds verifies stability of final accuracy and round-by-round convergence under identical chronological splits, horizon, feature engineering, hyperparameters, client counts, and communication rounds.
- **Deterministic vs. Seed-Controlled Components:**
  - *Seed-Controlled:* IID uniform train-window sharding (`np.random.default_rng(seed).permutation`) and explicit `random_state=seed` propagation into Ridge Regression.
  - *Deterministic (Unaffected by Seed):* Chronological 80/20 purge split, Non-IID physical freeway corridor assignment (`pems08_zone_1..4`), analytical Centralized Ridge least-squares fit, zero global initialization (`w=0`), and full-batch/Gram local gradient updates + Top-K/INT8 compression (`std = 0.0` expected for deterministic paths).
- **Mean & Standard Deviation Calculation:**
  - All per-seed MAE, RMSE, final-round MAE/RMSE, and round convergence metrics are aggregated at **full unrounded `float64` precision** (UI formatting applies rounding strictly for display).
  - Arithmetic mean ($\bar{x} = \frac{1}{N}\sum x_i$) and **Bessel-corrected sample standard deviation** (`ddof=1`, $s = \sqrt{\frac{1}{N-1}\sum (x_i - \bar{x})^2}$ when $N \ge 2$) are computed over completed runs, including per-round convergence across matching rounds present in all successful runs.
- **Handling Failed Runs:**
  - Each seed runs freshly with zero cross-seed result caching. If any seed fails, its error is explicitly recorded (`status="failed"`, listed in `failures` and per-seed results), the aggregate is flagged `incomplete_partial_failure` (`is_complete=false`), and incomplete statistics reflect only completed runs—never silently omitted or fabricated.
- **Executing the Experiment:**
  - **UI:** In **Federated Learning Lab**, select **Three-Seed Reproducibility Study (42, 123, 2026)** under **Experiment Mode** and click **Run Benchmark Comparison**.
  - **API:** `POST /api/federated/benchmark-multi-seed` with optional `seeds: [42, 123, 2026]` and `partition_strategies: ["iid", "non_iid"]`.
- **Three-Seed Limitations:**
  - `N = 3` provides initial stability quantification (`ddof=1` with 2 degrees of freedom has wide confidence intervals), does not test larger multi-node stochastic mini-batch SGD noise or random client dropout schedules, and runs simulated in-process rounds rather than wide-area network hardware.

### Per-Round & Cumulative Communication-Cost Accounting (PS-003)

To evaluate bandwidth-accuracy trade-offs transparently, TrafficFlow AI implements deterministic wire payload serialization (`TFL1` binary format in `backend/app/federated/communication.py`) alongside per-round, cumulative, and multi-seed convergence efficiency tracking:

- **Wire Payload Serialization (`TFL1`, 44-Byte Framing Envelope):**
  - Every client update serialized during a round produces actual binary bytes (`packet_bytes` with CRC32 trailer integrity check):
    - `44 B` fixed `TFL1` header (`magic`, `method_code`, `index_width`, `round_num`, `client_id`, `n_params`, `k_retained`, `crc32`)
    - `4 B` `float32` scalar intercept (`bias_bytes`)
    - Payload weight values (`values_bytes`: `4 B/param` in FP32, `1 B/param` in uniform `uint8`)
    - Sparse indices (`index_bytes`: `uint8` for $\le 255$ features, `uint16` for $\le 65{,}535$, `uint32` otherwise — never omitted on sparse strategies)
    - Uniform quantization metadata (`quant_metadata_bytes`: `8 B` for FP32 `scale` and `x_min` on `int8` / `top_k_int8`)
- **Four Compression Strategies & Small-Model Overhead Behavior:**
  - `full_precision`: Dense FP32 model update (`44 + 4 + n_params * 4`, e.g., `80 B` per PeMS08 8-feature client).
  - `top_k`: Magnitude pruning keeping $k = \lceil n_{\text{params}} \cdot \text{pct}/100 \rceil$ weights in FP32 plus sparse indices (`68 B` at 50% on PeMS08, `58 B` at 25%).
  - `int8`: Dense symmetric/min-max `uint8` quantization with `8 B` `scale + min` header (`64 B` on PeMS08).
  - `top_k_int8`: Top-$K$ pruning + `uint8` quantization of retained weights + sparse indices + `8 B` metadata (`64 B` at 50%, `60 B` at 25% on PeMS08).
  - **Honest Sparse Overhead Trade-off:** When linear Ridge models have very few parameters ($n = 8$), `1 B/index` sparse indices plus fixed framing consume space saved by pruning unless retention falls well below 50% (e.g., 50% `top_k_int8` equals dense `int8` at `64 B/client`, while 25% `top_k_int8` drops to `60 B/client`). On larger multi-layer models, sparse compression savings scale sharply.
- **Upload vs. Modeled Broadcast vs. Centralized Accounting Separation:**
  - **Client Upload (`upload_bytes`):** Measured directly from actual serialized `TFL1` wire packets across participating clients each round.
  - **Server Broadcast (`download_bytes_modeled`):** Modeled as full-precision dense global model broadcast (`(n_params + 1) * 4 + 44` bytes per participating client per round) and kept strictly separate from upload-only totals (`upload_compression_ratio` / `upload_reduction_pct` vs. `bidirectional_compression_ratio` / `bidirectional_reduction_pct`).
  - **Centralized Baseline (`centralized_accounting`):** Estimated one-time raw data upload (`48 B/sample` = timestamp + sensor ID + flow + speed + occupancy + framing) before centralized model fitting (`download_bytes = 0`).
- **Convergence Efficiency per MB Transmitted:**
  - Round-0 pre-training global test error establishes the baseline. Every round computes `mae_improvement_vs_initial`, `rmse_improvement_vs_initial`, and gain per MB (`mae_improvement_per_mb_upload`, `rmse_improvement_per_mb_upload`). Zero-byte denominators return `None` (`"undefined_zero_bytes"`) and flat/worsening rounds return `None` (`"non_improving"`)—never `inf`, `NaN`, or synthetic positive ratios.
- **Running Communication & 4-Way Compression Experiments:**
  - **UI:** Select **4-Way Compression Comparison (Full / Top-K / INT8 / Top-K+INT8)** (or run IID/Non-IID or Three-Seed with any Compression Strategy selector) inside **Federated Learning Lab** to inspect Per-Round Upload vs Modeled Download, Cumulative Progression, 4-Strategy Payload Breakdown, Error vs. Cumulative Upload curves, and Multi-Seed Communication Mean ± Sample SD (`ddof=1`).
  - **API:** `POST /api/federated/benchmark-compression-compare` (and optional `compression_method` across `/api/federated/benchmark-compare`, `/api/federated/benchmark-partition-compare`, `/api/federated/benchmark-multi-seed`).
- **Scope & Limitations:**
  - Serialized byte sizes quantify application-layer `TFL1` binary payloads and exclude physical TCP/IP link headers, socket retries, and WAN transmission timings. Decentralized partitioning preserves data locality without formal differential privacy (`ε`) or cryptographic secure aggregation.

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
**Test Coverage Across Backend Test Modules:**
- `tests/test_genuine_public_dataset.py`: Genuine Caltrans PeMS08 Zenodo loading, `.npz`/tabular CSV schema validation, chronological ordering & horizon purge embargo, missing/dropout handling, deterministic 4-zone sensor partitioning, absence of synthetic/random fallback, and end-to-end Centralized vs. FedAvg benchmark verification.
- `tests/test_ps003_benchmark.py`: PS-003 unified benchmark execution, compression byte accounting, PeMS synthetic calibration fixture provenance, multi-round convergence, privacy terminology accuracy, and zero temporal leakage.
- `tests/test_iid_vs_non_iid.py`: Controlled IID vs. Non-IID partitioning sample conservation, leakage isolation, genuine PeMS08 inter-corridor heterogeneity, seed determinism, and Centralized invariance.
- `tests/test_multi_seed_experiments.py`: Reproducible 3-seed execution (`42, 123, 2026`), unrounded Mean & sample SD (`ddof=1`), matching-round convergence aggregation, non-silent failed-run reporting, and strict input validation.
- `tests/test_communication_accounting.py`: `TFL1` binary serialization & CRC32 validation across all 4 compression strategies, exact upload vs. modeled broadcast download separation, cumulative round accounting, 4-way compression benchmark endpoint, multi-seed communication aggregation with partial-failure handling, safe zero/non-improving efficiency guards, and HTTP `422` validation.
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
