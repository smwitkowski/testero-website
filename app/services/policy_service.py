from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.policy.engine import Suppression, enforce_policies
from app.policy.models import Policies
from app.state.policy_store import PolicyStore


class PolicyService:
    def __init__(self, store: PolicyStore) -> None:
        self.store = store

    def get(self) -> Policies:
        return self.store.load()

    def update(self, policies: Policies) -> Policies:
        self.store.save(policies)
        return policies

    def check_send(
        self,
        recipient_email: Optional[str],
        weekly_count: Optional[int] = None,
        now: Optional[datetime] = None,
    ) -> Suppression:
        policies = self.get()
        current = now or datetime.now(timezone.utc)
        return enforce_policies(
            policies,
            recipient_email=recipient_email,
            weekly_count=weekly_count,
            now=current,
        )

    def kill_switch(self) -> bool:
        return self.get().kill_switch
