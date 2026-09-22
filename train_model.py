"""Train the pairwise logistic model from one row per completed round."""
import argparse
import itertools
import json
from pathlib import Path

import pandas as pd
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline


def build_features(row):
    attack = sorted(set(x for x in row.attack_ops if x))
    defense = sorted(set(x for x in row.defense_ops if x))
    f = {}
    for op in attack:
        f[f"attack_main::{op}"] = 1
    for op in defense:
        f[f"defense_main::{op}"] = 1
    for a, b in itertools.combinations(attack, 2):
        f[f"attack_ally::{a}|{b}"] = 1
    for a, b in itertools.combinations(defense, 2):
        f[f"defense_ally::{a}|{b}"] = 1
    for a in attack:
        for d in defense:
            f[f"matchup::{a}|{d}"] = 1
    return f


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="CSV with attack_ops, defense_ops, attack_won columns")
    parser.add_argument("--output", default="model/model.json")
    parser.add_argument("--data-label", default="Season 5 historical data")
    args = parser.parse_args()

    # Each *_ops cell is a | separated list such as "Ash|Thermite|Thatcher".
    frame = pd.read_csv(args.input)
    required = {"attack_ops", "defense_ops", "attack_won"}
    missing = required - set(frame.columns)
    if missing:
        raise SystemExit(f"Missing columns: {', '.join(sorted(missing))}")
    frame["attack_ops"] = frame.attack_ops.fillna("").map(lambda s: s.split("|") if s else [])
    frame["defense_ops"] = frame.defense_ops.fillna("").map(lambda s: s.split("|") if s else [])
    labels = frame.attack_won.astype(int)
    if not set(labels.unique()) <= {0, 1} or labels.nunique() != 2:
        raise SystemExit("attack_won must contain both 0 and 1")

    vectorizer = DictVectorizer(sparse=True)
    matrix = vectorizer.fit_transform(build_features(r) for r in frame.itertuples(index=False))
    # Recent SciPy builds can create 64-bit sparse indices, while scikit-learn's
    # sparse logistic-regression solvers require 32-bit indices.
    matrix.indices = matrix.indices.astype("int32", copy=False)
    matrix.indptr = matrix.indptr.astype("int32", copy=False)
    clf = LogisticRegression(C=1.0, max_iter=300, solver="liblinear")
    clf.fit(matrix, labels)
    weights = dict(zip(vectorizer.feature_names_, clf.coef_[0]))
    pull = lambda prefix: {k[len(prefix):]: float(v) for k, v in weights.items() if k.startswith(prefix)}
    operators = sorted({op for side in ("attack_ops", "defense_ops") for group in frame[side] for op in group})
    operators_by_side = {
        "attack": sorted({op for group in frame.attack_ops for op in group}),
        "defense": sorted({op for group in frame.defense_ops for op in group}),
    }
    artifact = {
        "data_label": args.data_label,
        "operators": operators,
        "operators_by_side": operators_by_side,
        "intercept": float(clf.intercept_[0]),
        "attack_main": pull("attack_main::"),
        "defense_main": pull("defense_main::"),
        "attack_ally": pull("attack_ally::"),
        "defense_ally": pull("defense_ally::"),
        "matchup": pull("matchup::"),
        "training_rounds": int(len(frame)),
        "label_definition": "1 when attackers won the round",
    }
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    print(f"Saved {len(operators)} operators and {len(frame):,} rounds to {out}")


if __name__ == "__main__":
    main()

