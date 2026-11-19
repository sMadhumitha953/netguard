# NETGUARD AI - Python Backend

This backend receives a CSV from the React frontend and runs a real Isolation Forest anomaly-detection model.

## Easiest setup on Windows

1. Extract this folder.
2. Open the extracted `netguard-ai-backend` folder in VS Code.
3. Double-click `START_BACKEND.bat` (or run it from File Explorer).
4. The first run creates a Python virtual environment and installs dependencies. This can take a few minutes.
5. Keep the terminal window open.
6. Confirm the API is online at http://127.0.0.1:8000/api/health
7. Return to the frontend at http://localhost:5173 and upload a CSV.

## If Windows does not recognize Python

Install Python 3.10 or newer from https://www.python.org/downloads/ and enable **Add Python to PATH** during installation. Then run `START_BACKEND.bat` again.

## API endpoints

- `GET /api/health` - backend status
- `POST /api/analyze` - accepts a multipart CSV upload in the field named `file`
- `GET /docs` - interactive API documentation

## Notes

- The backend uses numeric columns as model features and excludes the `Label` column from model training.
- For speed, datasets larger than 20,000 rows are sampled to 20,000 rows.
- Isolation Forest detects statistical outliers. An anomaly is not proof of an intrusion or attack.
- Keep the backend window running while using the frontend.

DATA DRIFT FEATURE
------------------
A separate POST /api/drift endpoint compares two CSV files:
- reference_file: baseline / older dataset
- new_file: newer dataset

Both files must share numerical feature column names. The endpoint compares
matching numeric columns using the Kolmogorov-Smirnov test and Population
Stability Index (PSI). It returns per-feature scores and drift flags.

This feature does NOT change /api/analyze or retrain the Isolation Forest.
A drift warning means the feature distribution changed; it does not prove
that an attack occurred. Review data before any model retraining.
