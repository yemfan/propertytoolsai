from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List

import joblib
import numpy as np
import pandas as pd

from feature_builder import FeatureSpec, build_features


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", default="artifacts/valuation_model")
    parser.add_argument(
        "--input-json",
        required=True,
        help="Path to JSON array of rows for prediction (list of objects).",
    )
    args = parser.parse_args()

    model_dir = Path(args.model_dir)
    model_path = model_dir / "valuation_model.joblib"
    schema_path = model_dir / "schema.json"

    schema = json.loads(schema_path.read_text())
    numeric_features: List[str] = list(schema["numeric_features"])
    categorical_features: List[str] = list(schema["categorical_features"])
    target_col = schema["target"]

    rows: List[Dict[str, Any]] = json.loads(Path(args.input_json).read_text())

    model = joblib.load(model_path)

    spec = FeatureSpec(
        numeric_features=numeric_features,
        categorical_features=categorical_features,
        target_col=target_col,
    )

    df = pd.DataFrame(rows)
    featured = build_features(df, spec=spec)

    needed_cols = numeric_features + categorical_features
    for col in needed_cols:
        if col not in featured.columns:
            featured[col] = np.nan if col in numeric_features else "unknown"

    preds = model.predict(featured[needed_cols].copy())

    print(json.dumps({"predictions": preds.tolist()}, indent=2))


if __name__ == "__main__":
    main()

