"""Exact permutation checks, deterministic fallback and simulated operating characteristics."""
from fractions import Fraction
from itertools import product

import pytest

from scripts.optimize.cluster_statistics import cluster_bootstrap_interval, sign_flip_test
from scripts.optimize.simulate_cluster_statistics import simulate


@pytest.mark.parametrize("values", [[], [0, 0], [1], [1, -1], [1, 2, -3, 0],
                                    [Fraction(1, 3), Fraction(-1, 2), Fraction(1, 4)]])
def test_exact_sign_flip_matches_brute_force_including_ties(values):
    observed = sum(values)
    totals = [sum(sign * value for sign, value in zip(signs, values))
              for signs in product((-1, 1), repeat=len(values))]
    result = sign_flip_test(values)
    assert result["exact"]
    assert result["p_value"] == sum(total >= observed for total in totals) / len(totals)
    assert sign_flip_test([-value for value in values], alternative="less")["p_value"] == result["p_value"]


def test_irregular_lattice_monte_carlo_is_deterministic_conservative_and_nonzero():
    values = [Fraction(1, denominator) for denominator in (101, 103, 107, 109, 113)]
    result = sign_flip_test(values, draws=9999)
    assert not result["exact"] and result["draws"] == 9999
    assert result == sign_flip_test(values, draws=9999)
    assert result["p_value"] == (result["extreme_draws"] + 1) / 10000
    assert result["p_value"] == pytest.approx(1 / 32, abs=.01)
    assert result["p_value"] > 0
    with pytest.raises(ValueError):
        sign_flip_test(values, alternative="two-sided")
    with pytest.raises(ValueError):
        sign_flip_test(values, draws=0)


def test_bootstrap_resamples_clusters_and_handles_degenerate_samples():
    assert cluster_bootstrap_interval([])["lower"] is None
    assert cluster_bootstrap_interval([1])["upper"] is None
    result = cluster_bootstrap_interval([1, 1, 1])
    assert result["lower"] == result["upper"] == 1
    assert not result["deciding"]
    assert result == cluster_bootstrap_interval([1, 1, 1])


def test_power_plus_15pp_promotes_most_seeds():
    result = simulate(trials=200, seed=90000, effect=.15)
    assert result["rate160"] > .70


def test_null_calibration_at_predeclared_looks():
    result = simulate(trials=600, seed=70000)
    # Broad deterministic sanity bands, not a second hypothesis-test gate.
    assert .015 <= result["rate160"] <= .075
    assert result["rate80"] <= .02
    assert result["rate_either"] <= .08
