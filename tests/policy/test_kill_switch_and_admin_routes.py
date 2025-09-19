from __future__ import annotations

from importlib import import_module, reload
from typing import Iterable

import pytest
from fastapi.testclient import TestClient


def _reload_modules(modules: Iterable[str]) -> None:
    for name in modules:
        module = import_module(name)
        reload(module)


@pytest.fixture()
def client(monkeypatch, tmp_path) -> TestClient:
    monkeypatch.setenv("ORCH_API_KEY", "secret")
    monkeypatch.setenv("POLICY_STORE_PATH", str(tmp_path / "policies.json"))
    monkeypatch.setenv("POLICY_KILL_SWITCH", "false")

    modules = [
        "app.settings",
        "app.state.policy_store",
        "app.services.policy_service",
        "app.security.auth",
        "app.routes.admin_policies",
        "app.routes.apply",
        "app.main",
    ]
    _reload_modules(modules)

    from app.main import app

    return TestClient(app)


def test_admin_routes_and_kill_switch(client: TestClient) -> None:
    operator_headers = {
        "x-api-key": "secret",
        "ORCH_ROLES": "default:read_only,me:operator",
    }
    admin_headers = {"x-api-key": "secret", "ORCH_ROLES": "default:read_only,me:admin"}

    # operator can read policies but not update
    resp = client.get("/admin/policies", headers=operator_headers)
    assert resp.status_code == 200

    forbidden = client.post("/admin/policies", headers=operator_headers, json={})
    assert forbidden.status_code == 403

    # admin can update full policy document
    updated = client.post("/admin/policies", headers=admin_headers, json={})
    assert updated.status_code == 200

    enable = client.post(
        "/admin/policies/kill", headers=admin_headers, params={"enabled": "true"}
    )
    assert enable.status_code == 200
    assert enable.json()["kill_switch"] is True

    fetched = client.get("/admin/policies", headers=admin_headers)
    assert fetched.status_code == 200
    assert fetched.json()["kill_switch"] is True

    payload = {"yaml_text": "flow: {}", "namespace": "default", "templates": {}}
    blocked = client.post(
        "/journeys/apply",
        headers=admin_headers,
        params={"dry_run": "false"},
        json=payload,
    )
    assert blocked.status_code == 200
    body = blocked.json()
    assert body["blocked"] is True
    assert body["reason"] == "kill_switch_enabled"
    assert body["dry_run"] is False

    disable = client.post(
        "/admin/policies/kill", headers=admin_headers, params={"enabled": "false"}
    )
    assert disable.status_code == 200
    assert disable.json()["kill_switch"] is False

    allowed = client.post(
        "/journeys/apply",
        headers=admin_headers,
        params={"dry_run": "false"},
        json=payload,
    )
    assert allowed.status_code == 200
    allowed_body = allowed.json()
    assert allowed_body["dry_run"] is False
    assert allowed_body["plan"]["applied"] is True
