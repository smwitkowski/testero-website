from __future__ import annotations

import json
import os
from typing import Optional

from app.policy.models import Caps, Policies, QuietHours
from app.settings import settings

DEFAULT_POLICY_PATH = os.environ.get("POLICY_STORE_PATH", ".state/policies.json")


def _default_policies() -> Policies:
    quiet_hours = QuietHours(
        start=settings.policy_qh_start,
        end=settings.policy_qh_end,
        timezone=settings.default_timezone,
    )
    caps = Caps(per_user_weekly_marketing=settings.policy_weekly_cap)
    blocklist = [
        item.strip().lower()
        for item in (settings.policy_blocklist or "").split(",")
        if item.strip()
    ]
    return Policies(
        quiet_hours=quiet_hours,
        caps=caps,
        blocklist=blocklist,
        kill_switch=settings.policy_kill_switch,
    )


class PolicyStore:
    def __init__(self, path: Optional[str] = None) -> None:
        self.path = path or DEFAULT_POLICY_PATH
        directory = os.path.dirname(self.path) or "."
        os.makedirs(directory, exist_ok=True)
        if not os.path.exists(self.path):
            self.save(_default_policies())

    def load(self) -> Policies:
        with open(self.path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return Policies.model_validate(data)

    def save(self, policies: Policies) -> None:
        tmp_path = f"{self.path}.tmp"
        with open(tmp_path, "w", encoding="utf-8") as handle:
            json.dump(policies.model_dump(), handle, indent=2, sort_keys=True)
        os.replace(tmp_path, self.path)
