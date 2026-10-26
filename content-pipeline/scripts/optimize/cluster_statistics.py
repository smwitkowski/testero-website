"""Offline objective-cluster inference; no generation or judge dependencies."""
from __future__ import annotations

from collections import Counter
from fractions import Fraction
from functools import reduce
import math
import random
from statistics import mean

SIGN_FLIP_SEED = 20261026
BOOTSTRAP_SEED = 20261027
MONTE_CARLO_DRAWS = 99999
BOOTSTRAP_DRAWS = 9999
PREDECLARED_LOOKS = ({"pairs": 80, "alpha": .005}, {"pairs": 160, "alpha": .045})


def sign_flip_test(differences, *, alternative="greater", seed=SIGN_FLIP_SEED,
                   draws=MONTE_CARLO_DRAWS):
    """One-sided equal-weight cluster sign-flip test, including ties.

    Requires independent clusters whose joint differences are invariant to
    independent sign flips under the null (not merely a zero grand mean).
    Enumerate the exact integer-lattice distribution when feasible. Otherwise
    use independent uniform sign vectors and the conservative (hits+1)/(B+1)
    Monte Carlo p-value. Fixed seeds make repeated offline reads reproducible.
    Fractions preserve binary-outcome cluster means without rounding ties.
    """
    if alternative not in {"greater", "less"}:
        raise ValueError("alternative must be greater or less")
    if type(draws) is not int or draws < 1:
        raise ValueError("draws must be a positive integer")
    values = [value if isinstance(value, Fraction) else Fraction(str(value)) for value in differences]
    if alternative == "less":
        values = [-value for value in values]
    nonzero = [value for value in values if value]
    result = {"method": "objective-cluster sign-flip", "alternative": alternative,
              "clusters": len(values), "nonzero_clusters": len(nonzero),
              "seed": None, "draws": 0}
    if not nonzero:
        return {**result, "p_value": 1., "exact": True}
    scale = math.lcm(*(value.denominator for value in nonzero))
    scores = [int(value * scale) for value in nonzero]
    divisor = reduce(math.gcd, (abs(value) for value in scores))
    scores = [value // divisor for value in scores]
    observed = sum(scores)
    width = sum(map(abs, scores))
    # DP combines equal sums, avoiding 2**G enumeration for ordinary pass rates.
    if width <= 20000 and width * len(scores) <= 2000000:
        counts = Counter({0: 1})
        for value in map(abs, scores):
            updated = Counter()
            for total, count in counts.items():
                updated[total + value] += count
                updated[total - value] += count
            counts = updated
        hits = sum(count for total, count in counts.items() if total >= observed)
        return {**result, "p_value": hits / 2**len(scores), "exact": True,
                "sign_vectors": 2**len(scores)}
    rng = random.Random(seed)
    hits = 0
    magnitudes = list(map(abs, scores))
    for _ in range(draws):
        bits = rng.getrandbits(len(scores))
        total = sum(value if (bits >> index) & 1 else -value
                    for index, value in enumerate(magnitudes))
        hits += total >= observed
    return {**result, "p_value": (hits + 1) / (draws + 1), "exact": False,
            "seed": seed, "draws": draws, "extreme_draws": hits}


def cluster_bootstrap_interval(differences, *, seed=BOOTSTRAP_SEED, draws=BOOTSTRAP_DRAWS):
    """Descriptive 95% percentile interval, resampling whole objective means.

    This fixed-prefix interval is not sequentially adjusted or used to decide.
    Fewer than two clusters cannot estimate between-objective uncertainty.
    """
    values = [float(value) for value in differences]
    result = {"method": "objective-cluster percentile bootstrap", "confidence": .95,
              "seed": seed, "draws": draws, "lower": None, "upper": None,
              "deciding": False}
    if len(values) < 2:
        return result
    rng = random.Random(seed)
    samples = sorted(mean(rng.choices(values, k=len(values))) for _ in range(draws))
    def quantile(probability):
        index = (draws - 1) * probability
        low = math.floor(index)
        return samples[low] + (samples[math.ceil(index)] - samples[low]) * (index - low)
    return {**result, "lower": quantile(.025), "upper": quantile(.975)}
