from __future__ import annotations

from fastapi import FastAPI

from app.routes.admin_policies import router as admin_policies_router
from app.routes.apply import router as apply_router

app = FastAPI(title="Policy Guardrails API")

app.include_router(apply_router)
app.include_router(admin_policies_router)
