from __future__ import annotations

from fastapi import APIRouter, Depends

from app.policy.models import Policies
from app.security.auth import require_role
from app.services.policy_service import PolicyService
from app.state.policy_store import PolicyStore

router = APIRouter(prefix="/admin/policies", tags=["admin", "policies"])


def _svc() -> PolicyService:
    return PolicyService(PolicyStore())


@router.get("", dependencies=[Depends(require_role("operator"))])
def get_policies() -> dict:
    return _svc().get().model_dump()


@router.post("", dependencies=[Depends(require_role("admin"))])
def set_policies(policies: Policies) -> dict:
    return _svc().update(policies).model_dump()


@router.post("/kill", dependencies=[Depends(require_role("admin"))])
def set_kill_switch(enabled: bool) -> dict:
    service = _svc()
    current = service.get()
    current.kill_switch = bool(enabled)
    service.update(current)
    return {"ok": True, "kill_switch": current.kill_switch}
