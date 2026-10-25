"""Offline vendor-prefix checks; vendor independence does not depend on transport."""

import pytest

from shared.model_policy import model_family, require_independent_models


VENDOR_PREFIXES = [
    ("moonshotai", "kimi-"),
    ("minimax", "minimax-"),
    ("reflection", "beam-"),
    ("inception", "mercury-"),
    ("nvidia", "nemotron-"),
    ("cohere", "command-"),
    ("xiaomi", "mimo-"),
    ("z-ai", "glm-"),
    ("meta", "muse-"),
]


@pytest.mark.parametrize("vendor,prefix", VENDOR_PREFIXES)
@pytest.mark.parametrize("transport", ["", "openrouter/"])
def test_requested_vendor_prefixes(vendor, prefix, transport):
    assert model_family(f"{transport}{vendor}/{prefix}example") == vendor


@pytest.mark.parametrize("vendor,prefix", VENDOR_PREFIXES)
@pytest.mark.parametrize("transport", ["", "openrouter/"])
def test_known_vendor_rejects_unknown_model_family(vendor, prefix, transport):
    for name in ("unknown-example", prefix.removesuffix("-"), ""):
        with pytest.raises(ValueError, match="Unknown model vendor family"):
            model_family(f"{transport}{vendor}/{name}")


@pytest.mark.parametrize("vendor,prefix", VENDOR_PREFIXES)
@pytest.mark.parametrize("transport", ["", "openrouter/"])
def test_known_model_prefix_does_not_admit_unknown_vendor(vendor, prefix, transport):
    with pytest.raises(ValueError, match="Unknown model vendor family"):
        model_family(f"{transport}unknown-vendor/{prefix}example")


@pytest.mark.parametrize("vendor,prefix", VENDOR_PREFIXES)
def test_same_vendor_is_not_independent_across_models_or_transports(vendor, prefix):
    direct = f"{vendor}/{prefix}first"
    routed = f"openrouter/{vendor}/{prefix}second"
    for generator, judge in ((direct, routed), (routed, direct)):
        with pytest.raises(ValueError, match="must use different vendor families"):
            require_independent_models(generator, judge)


@pytest.mark.parametrize("vendor,prefix", VENDOR_PREFIXES)
@pytest.mark.parametrize("judge,family", [
    ("google/gemini-example", "google"),
    ("codex", "openai"),
    ("claude", "anthropic"),
])
def test_new_vendors_are_independent_from_existing_families(vendor, prefix, judge, family):
    generator = f"openrouter/{vendor}/{prefix}example"
    assert require_independent_models(generator, judge) == (vendor, family)
    assert require_independent_models(judge, generator) == (family, vendor)


@pytest.mark.parametrize("generator_vendor,generator_prefix", VENDOR_PREFIXES)
@pytest.mark.parametrize("judge_vendor,judge_prefix", VENDOR_PREFIXES)
def test_distinct_new_vendor_families_are_independent(
    generator_vendor, generator_prefix, judge_vendor, judge_prefix
):
    generator = f"openrouter/{generator_vendor}/{generator_prefix}first"
    judge = f"{judge_vendor}/{judge_prefix}second"
    if generator_vendor == judge_vendor:
        with pytest.raises(ValueError, match="must use different vendor families"):
            require_independent_models(generator, judge)
    else:
        assert require_independent_models(generator, judge) == (generator_vendor, judge_vendor)
