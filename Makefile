PYTHON ?= python

.PHONY: fmt lint type test run policies

fmt:
	$(PYTHON) -m black app/main.py app/settings.py app/security app/services app/state app/policy tests

lint:
	$(PYTHON) -m ruff check app/main.py app/settings.py app/security app/services app/state app/policy tests

type:
	$(PYTHON) -m mypy app/main.py app/settings.py app/security app/services app/state app/policy

test:
	$(PYTHON) -m pytest

run:
	uvicorn app.main:app --reload

policies:
	curl -s http://localhost:8000/admin/policies | jq .
