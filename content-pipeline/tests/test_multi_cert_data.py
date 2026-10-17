"""The migration seeds the reviewed planner domain identity, not another catalog."""
from pathlib import Path

from shared.cert_context import load_cert_context


def test_seeded_domains_match_reviewed_standard_guides():
    root = Path(__file__).resolve().parents[2]
    sql = (root / "supabase/migrations/20261017190000_multi_cert_foundation.sql").read_text()
    for cert_id in ("cloud-engineer", "cloud-architect", "data-engineer"):
        context = load_cert_context(cert_id)
        for code, domain in context["domains"].items():
            quoted_title = domain["display_name"].replace("'", "''")
            assert f"('{cert_id}', '{code}', '{quoted_title}'," in sql
        assert context["guide_sha256"] in sql


def test_database_lookup_scopes_code_to_exam(monkeypatch):
    from unittest.mock import Mock
    from shared.supabase_client import SupabaseClient
    client = object.__new__(SupabaseClient)
    client.client = Mock()
    query = client.client.table.return_value
    query.select.return_value = query
    query.eq.return_value = query
    query.maybe_single.return_value = query
    query.execute.return_value.data = {"id": "ace-domain"}
    assert client.get_domain_by_code("shared-code", exam="cloud-engineer") == {"id": "ace-domain"}
    assert query.eq.call_args_list[0].args == ("exam", "cloud-engineer")
    assert query.eq.call_args_list[1].args == ("code", "shared-code")
    query.eq.reset_mock()
    client.get_domain_by_code("legacy-code")
    assert query.eq.call_args_list[0].args == ("exam", "GCP_PM_ML_ENG")
