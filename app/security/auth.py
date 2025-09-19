from __future__ import annotations

from typing import Callable, Iterable, Set

from fastapi import HTTPException, Request, status

from app.settings import settings

ROLE_LEVEL = {"read_only": 0, "operator": 1, "admin": 2}


def _parse_roles(header: str | None) -> Set[str]:
    if not header:
        return set()
    roles: Set[str] = set()
    for token in header.split(","):
        piece = token.strip()
        if not piece:
            continue
        if ":" in piece:
            _, role = piece.split(":", 1)
            roles.add(role.strip())
        else:
            roles.add(piece)
    return roles


def _has_role(roles: Iterable[str], required: str) -> bool:
    if required in roles:
        return True
    if required not in ROLE_LEVEL:
        return required in roles
    required_level = ROLE_LEVEL[required]
    return any(ROLE_LEVEL.get(role, -1) >= required_level for role in roles)


def ensure_role(request: Request, required: str) -> Set[str]:
    api_key = request.headers.get("x-api-key")
    if settings.orch_api_key and api_key != settings.orch_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_api_key"
        )

    roles = _parse_roles(request.headers.get("ORCH_ROLES"))
    if not _has_role(roles, required):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    return roles


def require_role(role: str) -> Callable[[Request], Set[str]]:
    def dependency(request: Request) -> Set[str]:
        return ensure_role(request, role)

    return dependency
