from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from feature_builder import FeatureSpec, build_features


def mean_absolute_percentage_error(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    mask = y_true != 0
    if not np.any(mask):
        return float("nan")
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", default="artifacts/valuation_model")
    parser.add_argument("--csv", required=True, help="Training CSV with actual_sale_price")
    args = parser.parse_args()

    model_dir = Path(args.model_dir)
    model_path = model_dir / "valuation_model.joblib"
    schema_path = model_dir / "schema.json"

    schema = json.loads(schema_path.read_text())
    numeric_features: List[str] = list(schema["numeric_features"])
    categorical_features: List[str] = list(schema["categorical_features"])
    target_col: str = schema["target"]

    df = pd.read_csv(args.csv)
    spec = FeatureSpec(
        numeric_features=numeric_features,
        categorical_features=categorical_features,
        target_col=target_col,
    )
    featured = build_features(df, spec=spec)
    featured = featured[featured[target_col].notna()].copy()
    featured = featured[featured[target_col] > 0]

    model = joblib.load(model_path)
    needed_cols = numeric_features + categorical_features

    for col in needed_cols:
        if col not in featured.columns:
            featured[col] = np.nan if col in numeric_features else "unknown"

    preds = model.predict(featured[needed_cols].copy())
    y_true = featured[target_col].astype(float).values

    mae = float(mean_absolute_error(y_true, preds))
    rmse = float(np.sqrt(mean_squared_error(y_true, preds)))
    mape = mean_absolute_percentage_error(y_true, preds)
    r2 = float(r2_score(y_true, preds))

    print(json.dumps({"mae": mae, "rmse": rmse, "mape": mape, "r2": r2, "rows": int(len(y_true))}, indent=2))


if __name__ == "__main__":
    main()

