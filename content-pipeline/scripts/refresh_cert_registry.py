#!/usr/bin/env python3
"""Refresh only the research registry. Does not import generator, dotenv or database code."""
from __future__ import annotations
import argparse
import datetime
import hashlib
import json
import math
import re
from pathlib import Path
import shutil
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from shared.cert_registry import (INDEX_URL, RegistryError, approved_url, parse_inventory,
                                  parse_cert_page, parse_guide, diff_registry, semantic, catalog_removal_history)

class ApprovedRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, throttle=lambda: None):
        self.throttle = throttle
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        approved_url(newurl)
        self.throttle()
        return super().redirect_request(req, fp, code, msg, headers, newurl)

class SourceCache:
    """One owner, one urllib opener; redirects are checked before sending a request."""
    def __init__(self, directory, refresh=False, retrieved_at=None):
        self.directory = Path(directory); self.directory.mkdir(parents=True, exist_ok=True)
        self.refresh = refresh
        self.retrieved_at = retrieved_at or datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.opener = urllib.request.build_opener(ApprovedRedirect(self.throttle))
        self.used = {}; self.last_request = 0.0
    def throttle(self):
        # Rate limiting, not work polling. Also applies before every redirect request.
        time.sleep(0.3)
        self.last_request = time.monotonic()
    def get(self, url, linked_from=None):
        approved_url(url)
        if url in self.used: return self.used[url]
        if urllib.parse.urlparse(url).hostname in {"docs.google.com", "forms.gle"} and not linked_from:
            raise RegistryError("Forms require official certification page link provenance")
        key = hashlib.sha256(url.encode()).hexdigest()
        raw = self.directory/(key+".raw"); meta = self.directory/(key+".json")
        if self.refresh:
            self.throttle()
            request = urllib.request.Request(url, headers={"User-Agent":"Testero-CertRegistryResearch/1.0"})
            try:
                self.last_request = time.monotonic()
                with self.opener.open(request, timeout=45) as response:
                    approved_url(response.url)
                    data = response.read()
                    info = {"url":url,"final_url":response.url,"retrieved_at":self.retrieved_at,
                            "content_type":response.headers.get("Content-Type",""),
                            "raw_sha256":hashlib.sha256(data).hexdigest(),"path":str(raw.resolve())}
            except Exception as exc:
                # Save raw HTTP error responses separately without replacing a known-good cache.
                if isinstance(exc, urllib.error.HTTPError):
                    error_raw = self.directory/(key+".error.raw")
                    body = exc.read(); error_raw.write_bytes(body)
                    (self.directory/(key+".error.json")).write_text(json.dumps({"url":url,
                        "final_url":exc.url,"status":exc.code,"retrieved_at":self.retrieved_at,
                        "path":str(error_raw.resolve()),"raw_sha256":hashlib.sha256(body).hexdigest()},indent=2)+"\n")
                raise RegistryError(f"Fetch failed; registry not written: {url}: {exc}") from exc
            raw.write_bytes(data); meta.write_text(json.dumps(info,indent=2)+"\n")
        else:
            if not raw.exists() or not meta.exists():
                raise RegistryError("Offline cache missing: " + url + "; run --refresh explicitly")
            info = json.loads(meta.read_text())
            if info.get("url") != url:
                raise RegistryError("Offline cache URL mismatch: " + url)
            data = raw.read_bytes()
            if info.get("raw_sha256") != hashlib.sha256(data).hexdigest():
                raise RegistryError("Offline cache hash mismatch: " + url)
            approved_url(info["final_url"])
        info["path"] = str(raw.resolve())
        if linked_from: info["linked_from"] = linked_from
        self.used[url] = (data,info)
        return data,info
    def manifest(self):
        path = self.directory/"manifest.json"
        known = {m["url"]:m for _,m in self.used.values()}
        for metadata in sorted(self.directory.glob("*.json")):
            if not re.fullmatch(r"[0-9a-f]{64}\.json", metadata.name): continue
            item = json.loads(metadata.read_text())
            if item.get("url") not in known: known[item["url"]] = item
        path.write_text(json.dumps({"sources":[known[u] for u in sorted(known)]},indent=2)+"\n")
        return path

def source(info, role):
    return {"url":info["url"],"final_url":info["final_url"],"retrieved_at":info["retrieved_at"],
            "role":role,"content_type":info["content_type"]}

def guide_text(raw, info, cache, pdftotext):
    if raw.startswith(b"%PDF-"):
        if not pdftotext:
            raise RegistryError("pdftotext is required for PDF guides; set --pdftotext")
        destination = cache.directory/(hashlib.sha256(info["url"].encode()).hexdigest()+".txt")
        completed = subprocess.run([pdftotext,"-layout",info["path"],str(destination)],capture_output=True,text=True)
        if completed.returncode:
            raise RegistryError("PDF extraction failed: "+completed.stderr)
        text = destination.read_text()
        if not text.strip(): raise RegistryError("Empty PDF guide extraction")
        return text
    # Preserve heading and list structure for HTML exam guides; never parse Forms here.
    if "html" in info["content_type"]:
        from shared.cert_registry import content_node
        scope = content_node(raw.decode("utf-8"))
        lines = []
        def visit(node, depth=0):
            from shared.cert_registry import Node
            if node.tag in {"script","style","nav","footer"}: return
            if node.tag in {"h1","h2","h3","h4","p"}:
                lines.append(node.text()); return
            if node.tag == "li":
                own = [c.text() if isinstance(c,Node) else c for c in node.children
                       if not isinstance(c,Node) or c.tag not in {"ul","ol"}]
                from shared.cert_registry import clean
                if depth > 2: raise RegistryError("Unsupported HTML list depth; manual parser review required")
                lines.append(({0:"● ",1:"○ ",2:"▪ "}[depth])+clean(" ".join(own)))
                for c in node.children:
                    if isinstance(c,Node) and c.tag in {"ul","ol"}: visit(c, depth+1)
                return
            for c in node.children:
                if isinstance(c,Node): visit(c, depth)
        visit(scope)
        return "\n".join(lines)
    raise RegistryError("Unsupported guide content type: " + info["content_type"])

def build_registry(cache, pdftotext, previous=(), allow_catalog_removals=False):
    raw,index_info = cache.get(INDEX_URL)
    entries = parse_inventory(raw.decode("utf-8"))
    if previous and len(entries) < math.ceil(len(previous)*0.75) and not allow_catalog_removals:
        raise RegistryError("Catalog shrank more than 25%; verify official removals before --allow-catalog-removals")
    records = []
    for entry in entries:
        raw,info = cache.get(entry["cert_url"])
        record,guide_urls = parse_cert_page(raw.decode("utf-8"), entry)
        record["sources"] = [source(index_info,"catalog"),source(info,"certification")]
        record["cert_url"] = info["final_url"]
        for url in guide_urls:
            guide_raw,guide_info = cache.get(url,entry["cert_url"])
            variant = "renewal" if "renewal" in url else ("beta" if any(v["variant"]=="beta" for v in record["exam_variants"]) else "standard")
            guide = parse_guide(guide_text(guide_raw,guide_info,cache,pdftotext), entry["cert_id"],url,variant)
            guide["status"] = "upcoming" if any(v.get("guide_url")==url for v in record["upcoming_versions"]) else "current"
            record["guides"].append(guide)
            record["sources"].append(source(guide_info,"exam_guide"))
        for sample in record["sample_sources"]:
            # Store only link and fetch metadata. Do NOT parse or commit sample text/options.
            _,sample_info = cache.get(sample["url"],entry["cert_url"])
            sample["final_url"] = sample_info["final_url"]
            sample["availability"] = "public_html_fetched"
            record["sources"].append(source(sample_info,"official_sample"))
        for variant in record["exam_variants"]:
            variant["case_study_names"] = list(dict.fromkeys(name for guide in record["guides"]
                if guide["url"] in variant["guide_urls"] for name in guide["case_studies"])) or None
        records.append(record)
    return records

def load_previous(output):
    manifest = output/"registry.json"
    if not manifest.exists(): return []
    index = json.loads(manifest.read_text())
    return [json.loads((output/e["file"]).read_text()) for e in index["certifications"]]

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--refresh",action="store_true",help="Explicitly fetch official sources sequentially with a >=0.3s request interval")
    modes.add_argument("--no-network",action="store_true",help="Rebuild using raw cache only (also the default)")
    parser.add_argument("--cache-dir",type=Path,default=ROOT/".cache/cert-registry")
    parser.add_argument("--output-dir",type=Path,default=ROOT/"certs")
    parser.add_argument("--pdftotext",default=shutil.which("pdftotext") or "/opt/homebrew/bin/pdftotext")
    parser.add_argument("--retrieved-at",help="UTC retrieval timestamp; never used as guide effective date")
    parser.add_argument("--check",action="store_true",help="Report drift without writing registry JSON")
    parser.add_argument("--allow-catalog-removals",action="store_true",help="Allow manually verified catalog shrink >25%; does not assert retirement")
    args = parser.parse_args(argv)
    try:
        if args.retrieved_at:
            stamp = datetime.datetime.fromisoformat(args.retrieved_at.replace("Z","+00:00"))
            if stamp.tzinfo is None or stamp.utcoffset() != datetime.timedelta(0):
                raise RegistryError("--retrieved-at must be a UTC timestamp")
        cache = SourceCache(args.cache_dir,args.refresh,args.retrieved_at)
        previous = load_previous(args.output_dir)
        records = build_registry(cache,args.pdftotext,previous,args.allow_catalog_removals)
        changes = diff_registry(previous,records)
        print(json.dumps({"status":"changes" if changes else "no changes","changes":changes},indent=2))
        manifest_path = cache.manifest()
        print("Cache manifest: " + str(manifest_path))
        if args.check: return 1 if changes else 0
        args.output_dir.mkdir(parents=True,exist_ok=True)
        # Parse/fetch all sources before publishing any file. Failed sources never retire entries.
        for record in records:
            path = args.output_dir/(record["cert_id"]+".json")
            if path.exists() and semantic(json.loads(path.read_text())) == semantic(record):
                continue  # Preserve prior retrieval timestamp and keep fresh no-change reruns clean.
            temp = path.with_suffix(".json.tmp")
            temp.write_text(json.dumps(record,indent=2,ensure_ascii=False)+"\n");temp.replace(path)
        index = {"schema_version":1,"catalog_url":INDEX_URL,
                 "certifications":[{"cert_id":r["cert_id"],"name":r["name"],"level":r["level"],
                    "registration_status":r["registration_status"],"file":r["cert_id"]+".json"} for r in records],
                 "removed_from_catalog_unverified":[c["cert_id"] for c in changes if c["change"]=="removed-from-catalog-unverified"],
                 "retirement_scope_note":"Current catalog and fetched linked official pages only. Absence is not proof of retirement. Unstated lifecycle facts remain null."}
        # Preserve removed entries in the index until explicit official retirement review.
        old_index = args.output_dir/"registry.json"
        if old_index.exists():
            old = json.loads(old_index.read_text())
            index["removed_from_catalog_unverified"] = catalog_removal_history(
                old.get("removed_from_catalog_unverified",[]), changes, [r["cert_id"] for r in records])
        old_index.write_text(json.dumps(index,indent=2,ensure_ascii=False)+"\n")
        return 0
    except (RegistryError, UnicodeError, OSError, json.JSONDecodeError) as exc:
        print("ERROR: "+str(exc),file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())
