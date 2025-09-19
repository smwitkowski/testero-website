from __future__ import annotations

from typing import Dict, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.security.auth import ensure_role, require_role
from app.services.policy_service import PolicyService
from app.settings import settings
from app.state.policy_store import PolicyStore

router = APIRouter(prefix="/journeys", tags=["journeys"])


class ApplyInput(BaseModel):
    yaml_text: str
    namespace: Optional[str] = None
    templates: Dict[str, str] = Field(default_factory=dict)


class JourneyPlan(BaseModel):
    namespace: Optional[str] = None
    summary: str
    applied: bool = False


def get_service() -> "JourneyService":
    return JourneyService()


def render_plan_text(plan: JourneyPlan, *, max_lines: int) -> str:
    lines = plan.summary.strip().splitlines() or ["(no changes)"]
    if len(lines) > max_lines:
        displayed = "\n".join(lines[:max_lines])
        return f"{displayed}\n..."
    return "\n".join(lines)


class JourneyService:
    def plan(self, payload: ApplyInput) -> JourneyPlan:
        namespace = payload.namespace or "default"
        summary = f"Planned deployment for namespace {namespace} with {len(payload.templates)} templates"
        return JourneyPlan(namespace=namespace, summary=summary)

    def apply(self, plan: JourneyPlan) -> JourneyPlan:
        plan.applied = True
        return plan


@router.post("/apply", dependencies=[Depends(require_role("operator"))])
def apply_journey(
    payload: ApplyInput,
    request: Request,
    dry_run: bool = True,
):
    service = get_service()
    plan = service.plan(payload)
    text = render_plan_text(plan, max_lines=settings.plan_max_diff_lines)

    if dry_run:
        return {"dry_run": True, "plan": plan.model_dump(), "text": text}

    policy_service = PolicyService(PolicyStore())
    if policy_service.kill_switch():
        return {
            "dry_run": False,
            "blocked": True,
            "reason": "kill_switch_enabled",
            "plan": plan.model_dump(),
            "text": text,
        }

    ensure_role(request, "admin")

    applied = service.apply(plan)
    text_after = render_plan_text(applied, max_lines=settings.plan_max_diff_lines)
    return {"dry_run": False, "plan": applied.model_dump(), "text": text_after}
