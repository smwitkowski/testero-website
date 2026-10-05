"""Registry-derived certification context with compatible legacy PMLE helpers."""

from typing import Any

from shared.cert_context import DEFAULT_CERT, PMLE_SECTION_CODES, domain_prompt, load_cert_context

# Compatibility export only. Facts are derived from the reviewed standard guide,
# not maintained as another hand-written source of PMLE scope.
PMLE_DOMAIN_CONTEXT = load_cert_context()["domains"]


def get_domain_context(domain_code: str, cert_id: str = DEFAULT_CERT) -> dict[str, Any]:
    """Get domain context; existing callers default to PMLE."""
    domains = load_cert_context(cert_id)["domains"]
    if domain_code not in domains:
        raise ValueError(f"Domain code {domain_code!r} not found for {cert_id!r}. Valid codes: {list(domains)}")
    return domains[domain_code]


def get_subsection_context(domain_code: str, subsection_code: str,
                           cert_id: str = DEFAULT_CERT) -> dict[str, Any]:
    """Get official subsection scope. Invalid scope is an explicit error."""
    subsections = get_domain_context(domain_code, cert_id)["subsections"]
    if subsection_code not in subsections:
        raise ValueError(f"Subsection {subsection_code!r} not found in domain {domain_code!r}. Valid subsections: {list(subsections)}")
    return subsections[subsection_code]


def build_domain_prompt_context(domain_code: str, domain_name: str,
                                subsection_code: str | None = None,
                                cert_id: str = DEFAULT_CERT) -> str:
    """Build certification-aware scope; retain the legacy domain_name argument.

    The registry's reviewed title takes precedence over a stale caller title.
    """
    context = load_cert_context(cert_id)
    if domain_code not in context["domains"]:
        raise ValueError(f"Domain code {domain_code!r} not found for {cert_id!r}")
    return domain_prompt(context, context["domains"][domain_code], subsection_code)
