"""Small, offline model-vendor policy. No discovery/API calls at runtime."""

DEFAULT_GENERATOR_MODEL = "openrouter/google/gemini-3.8-flash"
DEFAULT_JUDGE_MODEL = "claude"
OPENROUTER_JUDGE_MODEL = "openrouter/anthropic/claude-sonnet-5.5"
DEFAULT_CLAUDE_MODEL = "claude-sonnet-5-5"
# Verified on https://openrouter.ai/api/v1/models, 2026-10-04:
# Flash is the lower-cost generator; Sonnet provides a different-vendor judge.
VENDORS = {
    "google": ("gemini-", "gemma-"), "anthropic": ("claude-",),
    "openai": ("gpt-", "o1", "o3", "o4"), "x-ai": ("grok-",),
    "deepseek": ("deepseek-",), "meta-llama": ("llama-",),
    "mistralai": ("mistral-", "ministral-", "magistral-", "codestral-", "devstral-", "pixtral-"),
    "qwen": ("qwen",),
}


def model_family(model: str) -> str:
    if not isinstance(model, str):
        raise ValueError("Unknown model vendor family")
    if model == "codex":
        return "openai"
    if model == "claude":
        return "anthropic"
    if model.startswith("codex/"):
        name = model.removeprefix("codex/")
        if name and "/" not in name and name.startswith(VENDORS["openai"]):
            return "openai"
        raise ValueError("Unknown model vendor family")
    if model.startswith("claude/"):
        name = model.removeprefix("claude/")
        if name and "/" not in name and name.startswith(VENDORS["anthropic"]):
            return "anthropic"
        raise ValueError("Unknown model vendor family")
    ident = model.removeprefix("openrouter/")
    parts = ident.split("/")
    if len(parts) != 2 or parts[0] not in VENDORS or not parts[1].startswith(VENDORS[parts[0]]):
        raise ValueError("Unknown model vendor family")
    return parts[0]


def require_independent_models(generator: str, judge: str) -> tuple[str, str]:
    families = model_family(generator), model_family(judge)
    if families[0] == families[1]:
        raise ValueError("Generator and judge must use different vendor families")
    return families
