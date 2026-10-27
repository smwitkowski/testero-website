"""Offline fixed-look power/null sanity simulation (no provider calls)."""
from __future__ import annotations

import argparse
from fractions import Fraction
import json
import random

from scripts.optimize.cluster_statistics import PREDECLARED_LOOKS, sign_flip_test


def simulate(*, trials=2000, seed=70000, effect=0.):
    """40 objectives, four pairs each; heterogeneous shared arm propensities."""
    interim = final = either = 0
    for trial in range(trials):
        rng = random.Random(seed + trial)
        first, full = [], []
        for _ in range(40):
            propensity = rng.uniform(.08, .34)  # Mean control yield .21.
            pairs = [int(rng.random() < propensity + effect) - int(rng.random() < propensity)
                     for _ in range(4)]
            first.append(Fraction(sum(pairs[:2]), 2))
            full.append(Fraction(sum(pairs), 4))
        reject80 = sign_flip_test(first)["p_value"] <= PREDECLARED_LOOKS[0]["alpha"]
        reject160 = sign_flip_test(full)["p_value"] <= PREDECLARED_LOOKS[1]["alpha"]
        interim += reject80
        final += reject160
        either += reject80 or reject160
    return {"trials": trials, "seed_start": seed, "effect": effect,
            "reject80": interim, "reject160": final, "reject_either": either,
            "rate80": interim / trials, "rate160": final / trials, "rate_either": either / trials}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--trials", type=int, default=2000)
    args = parser.parse_args()
    print(json.dumps({"null": simulate(trials=args.trials),
                      "plus15pp": simulate(trials=args.trials, seed=90000, effect=.15)}, indent=2))


if __name__ == "__main__":
    main()
