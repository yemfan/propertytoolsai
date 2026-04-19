from __future__ import annotations

import argparse
import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, median_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from feature_builder import (
    FeatureSpec,
    build_features,
    drop_entirely_null_numeric,
    drop_entirely_unknown_categorical,
    filter_training_rows,
)


TARGET_COL = "actual_sale_price"

NUMERIC_FEATURES = [
    # subject facts
    "beds",
    "baths",
    "sqft",
    "lot_size",
    "year_built",
    # valuation engine outputs
    "api_estimate",
    "comps_estimate",
    "final_estimate",
    "low_estimate",
    "high_estimate",
    "confidence_score",
    "comparable_count",
    "weighted_ppsf",
    "listing_trend_adjustment_pct",
    "condition_adjustment_pct",
    "range_spread_pct",
    # fallback signal
    "tax_anchor_estimate",
    # derived stability features
    "api_vs_comps_diff_pct",
    "tax_vs_comps_diff_pct",
    "tax_vs_api_diff_pct",
    # time / market features (optional, derived if dates exist in CSV)
    "months_since_last_sale",
    "months_from_estimate_to_sale",
]

CATEGORICAL_FEATURES = [
    "city",
    "state",
    "zip",
    "property_type",
    "condition",
    "confidence_label",
    "tier_used",
    "valuation_version",
]


def try_make_model() -> tuple[str, Any, Dict[str, Any]]:
    # Prefer LightGBM, then XGBoost, then sklearn fallback.
    try:
        from lightgbm import LGBMRegressor  # type: ignore

        kwargs = {
            "n_estimators": 500,
            "learning_rate": 0.03,
            "num_leaves": 31,
            "subsample": 0.9,
            "colsample_bytree": 0.9,
            "random_state": 42,
        }
        return "lightgbm", LGBMRegressor, kwargs
    except Exception:
        pass

    try:
        from xgboost import XGBRegressor  # type: ignore

        kwargs = {
            "n_estimators": 500,
            "learning_rate": 0.03,
            "max_depth": 6,
            "subsample": 0.9,
            "colsample_bytree": 0.9,
            "objective": "reg:squarederror",
            "random_state": 42,
        }
        return "xgboost", XGBRegressor, kwargs
    except Exception:
        pass

    kwargs = {"learning_rate": 0.05, "max_depth": 8, "max_iter": 400, "random_state": 42}
    return "sklearn", HistGradientBoostingRegressor, kwargs


def mean_absolute_percentage_error(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    mask = y_true != 0
    if not np.any(mask):
        return float("nan")
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])))


def evaluate_model(y_true: np.ndarray, y_pred: np.ndarray, train_rows: int, test_rows: int, backend: str) -> Dict[str, Any]:
    mae = float(mean_absolute_error(y_true, y_pred))
    median_ae = float(median_absolute_error(y_true, y_pred))
    rmse = float(math.sqrt(mean_squared_error(y_true, y_pred)))
    mape = float(mean_absolute_percentage_error(y_true, y_pred))
    r2 = float(r2_score(y_true, y_pred))

    return {
        "backend": backend,
        "train_rows": int(train_rows),
        "test_rows": int(test_rows),
        "mae": mae,
        "median_ae": median_ae,
        "rmse": rmse,
        "mape": mape,
        "r2": r2,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="Path to exported valuation training CSV")
    parser.add_argument("--out-dir", default="artifacts/valuation_model", help="Output directory")
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--min-rows", type=int, default=30)
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(args.csv)
    spec = FeatureSpec(
        numeric_features=NUMERIC_FEATURES,
        categorical_features=CATEGORICAL_FEATURES,
        target_col=TARGET_COL,
    )
    featured = build_features(df, spec)
    featured = filter_training_rows(featured, TARGET_COL)

    if len(featured) < args.min_rows:
        raise ValueError(f"Not enough labeled rows to train. Got {len(featured)}, need {args.min_rows}+.")

    # Drop useless columns early (all-null numeric; fully-unknown categorical).
    numeric_features = drop_entirely_null_numeric(featured, spec.numeric_features)
    categorical_features = drop_entirely_unknown_categorical(featured, spec.categorical_features)

    X = featured[numeric_features + categorical_features].copy()
    y = featured[TARGET_COL].astype(float).values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=42
    )

    backend, RegressorClass, regressor_kwargs = try_make_model()

    numeric_transformer = Pipeline(steps=[("imputer", SimpleImputer(strategy="median"))])
    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ]
    )

    model = RegressorClass(**regressor_kwargs)

    pipeline = Pipeline(steps=[("preprocessor", preprocessor), ("model", model)])
    pipeline.fit(X_train, y_train)

    preds = pipeline.predict(X_test)
    metrics = evaluate_model(y_test, preds, train_rows=len(X_train), test_rows=len(X_test), backend=backend)

    model_path = out_dir / "valuation_model.joblib"
    schema_path = out_dir / "schema.json"
    metrics_path = out_dir / "metrics.json"

    joblib.dump(pipeline, model_path)

    schema = {
        "target": TARGET_COL,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "backend": backend,
        "version": "v2",
        "note": "tax_anchor_estimate may be null in early rollout; trainer drops entirely-null columns.",
    }

    schema_path.write_text(json.dumps(schema, indent=2))
    metrics_path.write_text(json.dumps(metrics, indent=2))

    # --- ONNX export (optional, best-effort) ---
    onnx_path = out_dir / "valuation_model.onnx"
    onnx_exported = False
    try:
        from skl2onnx import convert_sklearn  # type: ignore
        from skl2onnx.common.data_types import FloatTensorType  # type: ignore

        # The preprocessor outputs a 2D float array; we need its output width.
        preprocessor_fitted = pipeline.named_steps["preprocessor"]
        X_sample = preprocessor_fitted.transform(X_train[:1])
        n_features = X_sample.shape[1]

        initial_type = [("X", FloatTensorType([None, n_features]))]

        # Convert only the regressor (preprocessor runs in Node.js as feature assembly)
        onnx_model = convert_sklearn(
            pipeline.named_steps["model"],
            initial_types=initial_type,
            target_opset=15,
        )
        onnx_path.write_bytes(onnx_model.SerializeToString())
        onnx_exported = True
        print(f"ONNX model exported to {onnx_path.resolve()}")
    except Exception as onnx_err:
        print(f"ONNX export skipped (install skl2onnx for ONNX support): {onnx_err}")

    print(
        json.dumps(
            {
                "model_path": str(model_path.resolve()),
                "schema_path": str(schema_path.resolve()),
                "metrics_path": str(metrics_path.resolve()),
                "onnx_path": str(onnx_path.resolve()) if onnx_exported else None,
                "onnx_exported": onnx_exported,
                "metrics": metrics,
                "rows_used": len(featured),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

