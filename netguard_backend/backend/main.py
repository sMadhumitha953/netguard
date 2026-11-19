from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from scipy.stats import ks_2samp
from io import BytesIO

app = FastAPI(title="NETGUARD AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "name": "NETGUARD AI API",
        "status": "online",
        "docs": "/docs",
        "health": "/api/health",
    }

@app.get("/api/health")
def health():
    return {
        "status": "online",
        "message": "NETGUARD AI backend is running",
    }

@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    try:
        raw = await file.read()
        if not raw:
            raise HTTPException(status_code=400, detail="The uploaded CSV is empty.")

        # CICIDS2017 CSV files are commonly UTF-8 or Latin-1 encoded.
        try:
            df = pd.read_csv(BytesIO(raw), low_memory=False, encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(BytesIO(raw), low_memory=False, encoding="latin-1")

        if df.empty:
            raise HTTPException(status_code=400, detail="The CSV contains no records.")

        df.columns = df.columns.astype(str).str.strip()
        original_rows = len(df)

        # Keep a copy of labels for context only; labels are not model features.
        label_column = next(
            (c for c in df.columns if c.lower() == "label"), None
        )
        label_counts = {}
        if label_column:
            label_counts = {
                str(k): int(v)
                for k, v in df[label_column].fillna("Unknown").value_counts().head(10).items()
            }

        numeric = df.select_dtypes(include=[np.number]).copy()
        numeric = numeric.replace([np.inf, -np.inf], np.nan)
        numeric = numeric.dropna(axis=1, how="all")

        # Remove constant columns and columns that cannot help distinguish records.
        numeric = numeric.loc[:, numeric.nunique(dropna=True) > 1]

        if numeric.shape[1] < 2:
            raise HTTPException(
                status_code=400,
                detail="This CSV does not contain enough usable numeric feature columns."
            )

        # Bound runtime and memory for a quick buildathon demo.
        sampled = False
        if len(numeric) > 20000:
            numeric = numeric.sample(n=20000, random_state=42).sort_index()
            sampled = True

        numeric = numeric.fillna(numeric.median()).fillna(0)

        model = IsolationForest(
            n_estimators=100,
            contamination="auto",
            random_state=42,
            n_jobs=-1,
        )
        predictions = model.fit_predict(numeric)
        scores = model.decision_function(numeric)

        anomaly_mask = predictions == -1
        anomaly_count = int(anomaly_mask.sum())
        analyzed_count = int(len(numeric))
        normal_count = analyzed_count - anomaly_count

        alerts = []
        anomaly_positions = np.flatnonzero(anomaly_mask)
        # Limit returned alert details to keep the response manageable.
        for position in anomaly_positions[:100]:
            score = float(scores[position])
            alerts.append({
                "id": int(len(alerts) + 1),
                "row": int(numeric.index[position]) + 1,
                "type": "Potential Network Anomaly",
                "severity": "High" if score < -0.1 else "Medium",
                "score": round(score, 4),
                "status": "Requires investigation",
                "description": "This flow differs from patterns learned from the uploaded dataset.",
            })

        return {
            "filename": file.filename,
            "total_records": analyzed_count,
            "records_in_file": int(original_rows),
            "normal_records": normal_count,
            "anomalies_detected": anomaly_count,
            "anomaly_percentage": round((anomaly_count / analyzed_count) * 100, 2),
            "features_used": int(numeric.shape[1]),
            "sampled_for_speed": sampled,
            "label_column_found": bool(label_column),
            "dataset_label_counts": label_counts,
            "alerts": alerts,
            "message": (
                "Isolation Forest flags statistical outliers. These are potential "
                "anomalies, not confirmed cyberattacks."
            ),
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not analyze CSV: {str(exc)}",
        )


def _read_csv_upload(raw: bytes, filename: str) -> pd.DataFrame:
    """Read a CSV upload using the same encoding fallback as /api/analyze."""
    try:
        frame = pd.read_csv(BytesIO(raw), low_memory=False, encoding="utf-8")
    except UnicodeDecodeError:
        frame = pd.read_csv(BytesIO(raw), low_memory=False, encoding="latin-1")
    if frame.empty:
        raise HTTPException(status_code=400, detail=f"{filename} contains no records.")
    frame.columns = frame.columns.astype(str).str.strip()
    return frame


def _population_stability_index(reference: np.ndarray, current: np.ndarray) -> float:
    """Calculate PSI using reference quantile bins; epsilon avoids zero division."""
    reference = reference[np.isfinite(reference)]
    current = current[np.isfinite(current)]
    if len(reference) < 2 or len(current) < 2:
        return 0.0

    quantiles = np.unique(np.quantile(reference, np.linspace(0, 1, 11)))
    if len(quantiles) < 2:
        return 0.0

    # Extend the outer edges so all current observations are counted.
    edges = np.concatenate(([-np.inf], quantiles[1:-1], [np.inf]))
    ref_counts, _ = np.histogram(reference, bins=edges)
    cur_counts, _ = np.histogram(current, bins=edges)
    ref_pct = np.maximum(ref_counts / max(ref_counts.sum(), 1), 1e-6)
    cur_pct = np.maximum(cur_counts / max(cur_counts.sum(), 1), 1e-6)
    return float(np.sum((cur_pct - ref_pct) * np.log(cur_pct / ref_pct)))


@app.post("/api/drift")
async def detect_data_drift(
    reference_file: UploadFile = File(...),
    new_file: UploadFile = File(...),
):
    """
    Compare a reference (baseline) CSV with a newer CSV.
    This endpoint is intentionally separate from /api/analyze.
    """
    for upload in (reference_file, new_file):
        if not upload.filename or not upload.filename.lower().endswith(".csv"):
            raise HTTPException(status_code=400, detail="Both uploads must be CSV files.")

    try:
        reference_raw = await reference_file.read()
        new_raw = await new_file.read()
        if not reference_raw or not new_raw:
            raise HTTPException(status_code=400, detail="Both CSV files must contain data.")

        reference_df = _read_csv_upload(reference_raw, reference_file.filename or "reference.csv")
        new_df = _read_csv_upload(new_raw, new_file.filename or "new.csv")

        reference_numeric = reference_df.select_dtypes(include=[np.number]).replace([np.inf, -np.inf], np.nan)
        new_numeric = new_df.select_dtypes(include=[np.number]).replace([np.inf, -np.inf], np.nan)
        common = [c for c in reference_numeric.columns if c in new_numeric.columns]

        feature_results = []
        for feature in common:
            ref = reference_numeric[feature].dropna().to_numpy(dtype=float)
            cur = new_numeric[feature].dropna().to_numpy(dtype=float)
            if len(ref) < 2 or len(cur) < 2 or np.unique(ref).size < 2:
                continue

            # Bound comparison work for large buildathon datasets.
            if len(ref) > 20000:
                rng = np.random.default_rng(42)
                ref = rng.choice(ref, 20000, replace=False)
            if len(cur) > 20000:
                rng = np.random.default_rng(43)
                cur = rng.choice(cur, 20000, replace=False)

            ks = ks_2samp(ref, cur, alternative="two-sided", method="auto")
            psi = _population_stability_index(ref, cur)
            drift_detected = bool(psi >= 0.20 or (float(ks.pvalue) < 0.01 and psi >= 0.10))
            if psi >= 0.20:
                magnitude = "High"
            elif psi >= 0.10:
                magnitude = "Moderate"
            else:
                magnitude = "Low"

            feature_results.append({
                "feature": str(feature),
                "reference_mean": round(float(np.mean(ref)), 6),
                "new_mean": round(float(np.mean(cur)), 6),
                "psi": round(psi, 4),
                "ks_statistic": round(float(ks.statistic), 4),
                "p_value": round(float(ks.pvalue), 6),
                "drift_detected": drift_detected,
                "magnitude": magnitude,
            })

        if not feature_results:
            raise HTTPException(
                status_code=400,
                detail="No comparable numerical features were found. The two CSVs need matching numeric column names."
            )

        drifted = [item for item in feature_results if item["drift_detected"]]
        return {
            "reference_filename": reference_file.filename,
            "new_filename": new_file.filename,
            "reference_records": int(len(reference_df)),
            "new_records": int(len(new_df)),
            "common_features_compared": len(feature_results),
            "drifted_features": len(drifted),
            "drift_percentage": round(len(drifted) / len(feature_results) * 100, 2),
            "drift_status": "Drift detected" if drifted else "No significant drift detected",
            "features": sorted(feature_results, key=lambda item: item["psi"], reverse=True),
            "method": "Kolmogorov-Smirnov test + Population Stability Index (PSI)",
            "thresholds": {
                "psi_high": 0.20,
                "psi_moderate": 0.10,
                "ks_p_value": 0.01,
                "rule": "Drift is flagged when PSI >= 0.20, or when KS p-value < 0.01 and PSI >= 0.10."
            },
            "note": "Drift indicates a change in feature distributions, not proof of a cyberattack. Review the new data before retraining."
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not compare datasets: {str(exc)}")
