"""Synthetic parser/diff/cache tests. No official sample question content."""
import ast
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import pytest
from shared.cert_registry import (RegistryError, approved_url, parse_inventory, parse_cert_page,
    parse_guide, diff_registry, semantic)

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = Path(__file__).parent/"fixtures/cert_registry"
spec = importlib.util.spec_from_file_location("registry_refresh", ROOT/"scripts/refresh_cert_registry.py")
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)

def test_full_catalog_levels():
    result = parse_inventory((FIXTURES/"catalog.html").read_text())
    assert len(result) == 3
    assert {e["level"] for e in result} == {"foundational","associate","professional"}

@pytest.mark.parametrize("html", ["<html></html>","<h2>Professional certification</h2>","<p>404</p>"])
def test_catalog_fail_closed(html):
    with pytest.raises(RegistryError): parse_inventory(html)

def test_full_outline_wrap_nested_and_bare_subsection():
    result = parse_guide((FIXTURES/"guide.txt").read_text(),"synthetic","https://services.google.com/synthetic.pdf")
    assert result["outline_counts"] == {"sections":2,"subsections":3,"objectives":3,"nested_objectives":1}
    assert result["sections"][0]["subsections"][0]["objectives"][0]["text"] == "Compare synthetic modes over a wrapped line"
    assert result["sections"][0]["subsections"][0]["objectives"][0]["children"][0]["text"] == "Match a synthetic nested requirement"
    assert result["sections"][1]["subsections"][1]["title"] == "Review a synthetic incident"
    assert result["in_scope_tools"] == ["Synthetic CLI","Synthetic Database"]
    assert result["stated_weight_total_percent"] == 101
    assert result["as_of_date"] == "2026-06-01"
    assert result["effective_date"] is None
    assert result["version"] is None
    assert result["sections"][0]["weight_approximate"] is True
    assert result["sections"][0]["subsections"][0]["weight_percent"] is None

def test_zero_width_pdf_normalization():
    text = "Section\u200b\u200b1: Design (~100% of the exam)\n1.\u200b\u200b1 Evaluate. Considerations include:\n●\u200b\u200bTest i\u200bnfrastructure"
    result = parse_guide(text,"synthetic","https://services.google.com/synthetic.pdf")
    assert result["sections"][0]["subsections"][0]["objectives"][0]["text"] == "Test infrastructure"

def test_launch_date_and_filename_not_version():
    text = (FIXTURES/"guide.txt").read_text() + "\nCloud Digital Leader exam guide - launched on August 12, 2026 8\n"
    result = parse_guide(text,"synthetic","https://services.google.com/v1.0_042426.pdf")
    assert result["effective_date"] == "2026-08-12"
    assert result["version"] is None
    assert result["in_scope_tools"][-1] == "Synthetic Database"

def test_bad_outline_fails():
    with pytest.raises(RegistryError): parse_guide("Section 1: Empty", "synthetic", "https://services.google.com/guide.pdf")
    with pytest.raises(RegistryError): parse_guide("Section 1: X\n2.1 Wrong\n● Bad", "synthetic", "https://services.google.com/guide.pdf")

def test_standard_renewal_and_skills_formats_are_separate():
    entry = {"cert_id":"synthetic","catalog_name":"Synthetic","level":"professional","cert_url":"https://cloud.google.com/certification/synthetic"}
    result,_ = parse_cert_page((FIXTURES/"cert.html").read_text(),entry)
    variants = {v["variant"]:v for v in result["exam_variants"]}
    assert variants["standard"]["duration_minutes"] == 120
    assert variants["renewal"]["duration_minutes"] == 60
    assert variants["standard"]["question_count"] == {"min":40,"max":50,"approximate":False}
    assert variants["renewal"]["question_count"]["min"] == 20
    assert variants["standard"]["price_usd"] == 200
    assert variants["standard"]["languages"] == ["English","Japanese"]
    assert variants["skills_renewal"]["question_count"] is None
    assert result["retirement"] is None
    assert result["sample_sources"][0]["availability"] == "not_fetched"
    assert all(g.get("effective_date") is None for g in result["guides"])

@pytest.mark.parametrize("url", ["http://cloud.google.com/learn/certification", "https://cloud.google.com.evil.test/x", "https://example.com/guide.pdf", "https://docs.google.com/document/d/id", "https://cloud.google.com:8443/x", "https://user@cloud.google.com/x"])
def test_official_allowlist_fails_closed(url):
    with pytest.raises(RegistryError): approved_url(url)

def test_redirect_rejects_unapproved_host_before_request():
    handler = refresh.ApprovedRedirect()
    request = refresh.urllib.request.Request("https://cloud.google.com/x")
    with pytest.raises(RegistryError): handler.redirect_request(request,None,302,"redirect",{},"https://example.com/x")

def test_cache_only_never_falls_back_to_network(tmp_path,monkeypatch):
    def fail(*a,**k): raise AssertionError("network attempted")
    monkeypatch.setattr(refresh.urllib.request.OpenerDirector,"open",fail)
    cache = refresh.SourceCache(tmp_path,False)
    with pytest.raises(RegistryError,match="Offline cache missing"): cache.get("https://cloud.google.com/x")
    url="https://cloud.google.com/x"; key=hashlib.sha256(url.encode()).hexdigest(); raw=b"synthetic"
    (tmp_path/(key+".raw")).write_bytes(raw)
    (tmp_path/(key+".json")).write_text(json.dumps({"url":url,"final_url":url,"raw_sha256":hashlib.sha256(raw).hexdigest(),"content_type":"text/html","retrieved_at":"2026-10-04T00:00:00Z"}))
    assert cache.get(url)[0] == raw
    second = refresh.SourceCache(tmp_path,False)
    (tmp_path/(key+".raw")).write_bytes(b"corrupt")
    with pytest.raises(RegistryError,match="hash mismatch"): second.get(url)

def test_forms_need_official_link_provenance(tmp_path):
    with pytest.raises(RegistryError,match="provenance"):
        refresh.SourceCache(tmp_path).get("https://docs.google.com/forms/d/e/SYNTHETIC/viewform")

def test_diff_new_removed_guides_upcoming_and_timestamps():
    old = [{"cert_id":"synthetic","guides":[{"version":None,"normalized_text_sha256":"abc"}],"upcoming_versions":[],"sources":[{"url":"https://cloud.google.com/x","retrieved_at":"old"}]}]
    new = copy.deepcopy(old); new[0]["sources"][0]["retrieved_at"] = "new"
    assert diff_registry(old,new)==[]
    new[0]["guides"][0]["normalized_text_sha256"]="def"
    new[0]["upcoming_versions"]=[{"effective_date":"2027-01-01","guide_url":"https://services.google.com/next.pdf"}]
    assert {c["change"] for c in diff_registry(old,new)} == {"guide-version-or-outline-hash","upcoming-version"}
    assert diff_registry(old,[])[0]["change"] == "removed-from-catalog-unverified"
    assert diff_registry([],old)[0]["change"] == "new-certification"

def test_ast_no_runtime_generator_env_database_imports():
    for path in [ROOT/"shared/cert_registry.py",ROOT/"scripts/refresh_cert_registry.py"]:
        tree=ast.parse(path.read_text())
        imports=[]
        for node in ast.walk(tree):
            if isinstance(node,ast.Import): imports.extend(n.name for n in node.names)
            elif isinstance(node,ast.ImportFrom): imports.append(node.module or "")
        assert not any(any(term in name for term in ("dotenv","supabase","llm_generator","dspy","openai","tracing")) for name in imports)

def test_committed_registry_complete_and_no_sample_content_keys():
    index=json.loads((ROOT/"certs/registry.json").read_text())
    assert len(index["certifications"]) >= 3
    forbidden={"stem","options","question_text","questionContent","FB_PUBLIC_LOAD_DATA_"}
    for item in index["certifications"]:
        record=json.loads((ROOT/"certs"/item["file"]).read_text())
        assert record["cert_id"] == item["cert_id"]
        assert record["guides"] and record["sample_sources"] and record["sources"]
        for guide in record["guides"]:
            assert len(guide["normalized_text_sha256"]) == 64
            assert guide["outline_counts"]["subsections"] == sum(len(s["subsections"]) for s in guide["sections"])
        def walk(value):
            if isinstance(value,dict):
                assert not forbidden.intersection(value)
                for v in value.values(): walk(v)
            elif isinstance(value,list):
                for v in value: walk(v)
        walk(record)

def test_upcoming_guide_announcement_keeps_current_variant_separate():
    entry={"cert_id":"synthetic","catalog_name":"Synthetic","level":"professional","cert_url":"https://cloud.google.com/certification/synthetic"}
    html=(FIXTURES/"cert.html").read_text().replace("<h2>About this certification</h2>",
        '<p>Starting January 1, 2027, the upcoming exam version will use the <a href="https://services.google.com/fh/files/misc/next_synthetic_exam_guide.pdf">next version exam guide</a>.</p><h2>About this certification</h2>')
    result,urls=parse_cert_page(html,entry)
    upcoming=result["upcoming_versions"]
    assert len(upcoming)==1
    assert upcoming[0]["effective_date"]=="2027-01-01"
    assert upcoming[0]["guide_url"] in urls
    assert all(upcoming[0]["guide_url"] not in v["guide_urls"] for v in result["exam_variants"])

def test_beta_closed_ga_date_year_unknown():
    entry={"cert_id":"synthetic","catalog_name":"Synthetic","level":"professional","cert_url":"https://cloud.google.com/certification/synthetic"}
    html=(FIXTURES/"cert.html").read_text().replace("Standard exam information","Beta exam details").replace("40-50 multiple choice and multiple select questions","~80 multiple choice questions")
    html=html.replace("<h1>Synthetic Systems Engineer</h1>",'<h1>Synthetic Systems Engineer</h1><span>Professional Agentic Architect beta registration is closed. GA registration opens November 2.</span>')
    result,_=parse_cert_page(html,entry)
    assert result["registration_status"]=="closed_beta_upcoming_ga"
    assert result["upcoming_versions"][-1]["effective_date"] is None
    assert result["upcoming_versions"][-1]["registration_opens_stated"]=="November 2"
    assert next(v for v in result["exam_variants"] if v["variant"]=="beta")["question_count"]["approximate"] is True

def test_excluded_renewal_section_does_not_invent_zero_weight():
    text="Section 1: Synthetic setup (not included in renewal exam)\nSection 2: Synthetic operations (~100% of the exam)\n2.1 Synthetic task. Considerations include:\n● Synthetic objective"
    result=parse_guide(text,"synthetic","https://services.google.com/renewal.pdf","renewal")
    assert result["sections"][0]["included"] is False
    assert result["sections"][0]["weight_percent"] is None
    assert result["sections"][0]["subsections"]==[]

def test_missing_cache_cli_does_not_replace_registry(tmp_path):
    output=tmp_path/"output";output.mkdir()
    sentinel=output/"registry.json"
    sentinel.write_text(json.dumps({"certifications":[]}))
    before=sentinel.read_bytes()
    assert refresh.main(["--no-network","--cache-dir",str(tmp_path/"cache"),"--output-dir",str(output)])==2
    assert sentinel.read_bytes()==before

def test_sudden_catalog_shrink_requires_manual_review(tmp_path):
    url="https://cloud.google.com/learn/certification";raw=(FIXTURES/"catalog.html").read_bytes()
    key=hashlib.sha256(url.encode()).hexdigest()
    (tmp_path/(key+".raw")).write_bytes(raw)
    (tmp_path/(key+".json")).write_text(json.dumps({"url":url,"final_url":url,"raw_sha256":hashlib.sha256(raw).hexdigest(),"content_type":"text/html","retrieved_at":"2026-10-04T00:00:00Z"}))
    with pytest.raises(RegistryError,match="shrank"):
        refresh.build_registry(refresh.SourceCache(tmp_path),None,[{}]*15)

def test_html_outline_preserves_nested_bullets(tmp_path):
    html=b"<main><h2>Section 1: Synthetic systems (~100% of the exam)</h2><h3>1.1 Synthetic task</h3><ul><li>Top synthetic objective<ul><li>Nested synthetic objective</li></ul></li></ul></main>"
    info={"url":"https://cloud.google.com/certification/synthetic/guide","path":"unused","content_type":"text/html"}
    cache=refresh.SourceCache(tmp_path)
    text=refresh.guide_text(html,info,cache,None)
    guide=parse_guide(text,"synthetic",info["url"])
    obj=guide["sections"][0]["subsections"][0]["objectives"][0]
    assert obj["text"]=="Top synthetic objective"
    assert obj["children"][0]["text"]=="Nested synthetic objective"

def test_download_throttle_before_redirect(tmp_path,monkeypatch):
    pauses=[]
    monkeypatch.setattr(refresh.time,"sleep",pauses.append)
    cache=refresh.SourceCache(tmp_path,True)
    cache.throttle()
    handler=refresh.ApprovedRedirect(cache.throttle)
    req=refresh.urllib.request.Request("https://cloud.google.com/x")
    assert handler.redirect_request(req,None,302,"found",{},"https://docs.cloud.google.com/x").full_url=="https://docs.cloud.google.com/x"
    assert pauses==[0.3,0.3]


def test_upcoming_branding_notice_does_not_assign_current_guide():
    entry={"cert_id":"synthetic","catalog_name":"Synthetic","level":"professional","cert_url":"https://cloud.google.com/certification/synthetic"}
    html=(FIXTURES/"cert.html").read_text().replace("<h1>Synthetic Systems Engineer</h1>",
        '<h1>Synthetic Systems Engineer</h1><span>This exam will soon be updated to reflect recent branding changes. Refer to the <a href="https://services.google.com/fh/files/misc/synthetic_exam_guide.pdf">exam guide</a> for product names.</span>')
    result,_=parse_cert_page(html,entry)
    assert len(result["upcoming_versions"])==1
    upcoming=result["upcoming_versions"][0]
    assert upcoming["version"] is None and upcoming["effective_date"] is None
    assert upcoming["variant"] is None and upcoming["guide_url"] is None
    assert "will soon be updated" in upcoming["announcement"]
    standard=next(v for v in result["exam_variants"] if v["variant"]=="standard")
    assert standard["guide_urls"]==["https://services.google.com/fh/files/misc/synthetic_exam_guide.pdf"]


def test_reappearing_catalog_id_clears_unverified_removal_history():
    from shared.cert_registry import catalog_removal_history
    assert catalog_removal_history(["synthetic-returned","synthetic-absent"],[],["synthetic-returned"]) == ["synthetic-absent"]
    assert catalog_removal_history([], [{"cert_id":"synthetic-gone","change":"removed-from-catalog-unverified"}],[]) == ["synthetic-gone"]
