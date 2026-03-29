from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Optional

import numpy as np
import pandas as pd


def safe_pct_diff(a: Optional[float], b: Optional[float]) -> float:
    if a is None or b is None:
        return np.nan
    if pd.isna(a) or pd.isna(b):
        return np.nan
    a = float(a)
    b = float(b)
    if a == 0 and b == 0:
        return 0.0
    denom = (abs(a) + abs(b)) / 2.0
    if denom == 0:
        return np.nan
    return abs(a - b) / denom


def months_between(date_a: Optional[pd.Timestamp], date_b: Optional[pd.Timestamp]) -> float:
    if date_a is None or date_b is None:
        return np.nan
    if pd.isna(date_a) or pd.isna(date_b):
        return np.nan
    return abs((date_b - date_a).days) / 30.0


@dataclass(frozen=True)
class FeatureSpec:
    numeric_features: List[str]
    categorical_features: List[str]
    target_col: str


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Makes CSVs resilient to naming differences between exports.
    """
    out = df.copy()

    rename_map = {
        "lotSize": "lot_size",
        "yearBuilt": "year_built",
        "confidenceScore": "confidence_score",
        "confidenceLabel": "confidence_label",
        "comparableCount": "comparable_count",
        "weightedPpsf": "weighted_ppsf",
        "listingTrendAdjustmentPct": "listing_trend_adjustment_pct",
        "conditionAdjustmentPct": "condition_adjustment_pct",
        "rangeSpreadPct": "range_spread_pct",
        "propertyType": "property_type",
    }

    for old, new in rename_map.items():
        if old in out.columns and new not in out.columns:
            out[new] = out[old]

    # Normalize obvious types.
    if "created_at" in out.columns:
        out["created_at"] = pd.to_datetime(out["created_at"], errors="coerce")
    if "actual_sale_date" in out.columns:
        out["actual_sale_date"] = pd.to_datetime(out["actual_sale_date"], errors="coerce")

    return out


def build_features(df: pd.DataFrame, spec: FeatureSpec) -> pd.DataFrame:
    out = normalize_columns(df)

    # Derived relation features
    if "api_estimate" in out.columns and "comps_estimate" in out.columns:
        out["api_vs_comps_diff_pct"] = [
            safe_pct_diff(a, b) for a, b in zip(out["api_estimate"], out["comps_estimate"])
        ]
    else:
        out["api_vs_comps_diff_pct"] = np.nan

    if "tax_anchor_estimate" in out.columns and "comps_estimate" in out.columns:
        out["tax_vs_comps_diff_pct"] = [
            safe_pct_diff(a, b)
            for a, b in zip(out["tax_anchor_estimate"], out["comps_estimate"])
        ]
    else:
        out["tax_vs_comps_diff_pct"] = np.nan

    if "tax_anchor_estimate" in out.columns and "api_estimate" in out.columns:
        out["tax_vs_api_diff_pct"] = [
            safe_pct_diff(a, b) for a, b in zip(out["tax_anchor_estimate"], out["api_estimate"])
        ]
    else:
        out["tax_vs_api_diff_pct"] = np.nan

    # Time/market features (only possible if CSV includes the dates)
    out["months_since_last_sale"] = np.nan
    if "last_sale_date" in out.columns and "created_at" in out.columns:
        out["months_since_last_sale"] = [
            months_between(a, b) for a, b in zip(out["last_sale_date"], out["created_at"])
        ]

    out["months_from_estimate_to_sale"] = np.nan
    if "created_at" in out.columns and "actual_sale_date" in out.columns:
        out["months_from_estimate_to_sale"] = [
            months_between(a, b) for a, b in zip(out["created_at"], out["actual_sale_date"])
        ]

    # Ensure all spec columns exist (trainer may later drop entirely-null columns)
    for col in spec.numeric_features:
        if col not in out.columns:
            out[col] = np.nan

    for col in spec.categorical_features:
        if col not in out.columns:
            out[col] = "unknown"

    # Target must exist.
    if spec.target_col not in out.columns:
        raise ValueError(f"Missing target column '{spec.target_col}' in training CSV.")

    return out


def filter_training_rows(df: pd.DataFrame, target_col: str) -> pd.DataFrame:
    filtered = df[df[target_col].notna()].copy()
    filtered = filtered[filtered[target_col] > 0]
    return filtered


def drop_entirely_null_numeric(df: pd.DataFrame, numeric_cols: Iterable[str]) -> List[str]:
    kept: List[str] = []
    for col in numeric_cols:
        if col in df.columns and df[col].notna().any():
            kept.append(col)
    return kept


def drop_entirely_unknown_categorical(df: pd.DataFrame, categorical_cols: Iterable[str]) -> List[str]:
    kept: List[str] = []
    for col in categorical_cols:
        if col not in df.columns:
            continue
        # If every row is identical "unknown" (or null), it’s not helpful.
        nonnull = df[col].dropna()
        if nonnull.empty:
            continue
        if (nonnull.astype(str) == "unknown").all():
            continue
        kept.append(col)
    return kept

