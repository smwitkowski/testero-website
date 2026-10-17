"""Offline artifact audit; run with project Python. No network or third-party imports."""
import collections, hashlib, json, re
from pathlib import Path
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"content-pipeline/.cache/retrieval-audit"
OUT.mkdir(parents=True,exist_ok=True)
FILES=[ROOT.parent/'frontend.pipeline-baseline/content-pipeline/.cache/generation/ab-1017-baseline.json',ROOT.parent/'frontend.prime-testero-pipe-eff/content-pipeline/.cache/generation/ab-1017-treatment.json',*sorted((ROOT.parent/'frontend.prime-testero-pipeline/content-pipeline/.cache/generation').glob('pmle-d033-v5-*.json'))]
def walk(x,p='$'):
    if isinstance(x,dict):
        for k,v in x.items(): yield from walk(v,p+'.'+k)
    elif isinstance(x,list):
        for i,v in enumerate(x): yield from walk(v,f'{p}[{i}]')
    else: yield p,x
results=[]
for f in FILES:
    raw=f.read_bytes(); d=json.loads(raw); events=[]; vetoes=[]; status=[]
    for ci,c in enumerate(d.get('candidates',[])):
        for ai,a in enumerate(c.get('decision_attempts',[])):
            base=f'$.candidates[{ci}].decision_attempts[{ai}]'
            for si,s in enumerate(a.get('sources',[])):
                events.append(dict(location=f'{base}.sources[{si}]',requested_url=s.get('requested_url'),url=s.get('url'),retrieved_at=s.get('retrieved_at'),text_sha256=s.get('text_sha256')))
            proof=a.get('proof',{}); reason=proof.get('reason','')
            if proof.get('passed') is False and re.search(r"missing|lack|not (?:establish|verify|support|cover)|does not|don't|doesn't|absent|insufficient|not supplied|not provided",reason,re.I):
                vetoes.append(dict(location=base+'.proof.reason',candidate_id=c.get('candidate_id'),reason=reason))
    for loc,val in walk(d):
        if isinstance(val,str) and not loc.endswith('.text') and re.search(r'\b404\b',val):status.append(dict(location=loc,value=val))
    urls=sorted({e['requested_url'] for e in events if e['requested_url']})
    rewrites=[e for e in events if e['requested_url']!=e['url']]
    pairs=sorted({(e['requested_url'],e['url']) for e in rewrites})
    results.append(dict(artifact=str(f),sha256=hashlib.sha256(raw).hexdigest(),group=('baseline' if 'baseline' in f.name else 'treatment' if 'treatment' in f.name else re.search(r'v5-(.*?)-\d+-',f.name).group(1)),candidate_count=len(d.get('candidates',[])),attempt_count=sum(len(c.get('decision_attempts',[])) for c in d.get('candidates',[])),discovered_url_count=None,fetch_error_count=None,recorded_404_non_body_fields=status,fetched_source_occurrences=len(events),unique_requested_urls=len(urls),unique_final_urls=len({e['url'] for e in events}),rewritten_source_occurrences=len(rewrites),rewrite_pairs=[dict(requested_url=x,final_url=y) for x,y in pairs],hosts=dict(collections.Counter(urlsplit(u).netloc for u in urls)),requested_paths=[dict(url=u,host=urlsplit(u).netloc,path=urlsplit(u).path) for u in urls],coverage_veto_attempts=vetoes,coverage_veto_candidate_count=len({v['candidate_id'] for v in vetoes}),source_occurrences=events))
report=dict(caveats=['Discovery lists and fetch failures are not serialized in these artifacts: unknown, not zero.','Source occurrences are serialized records, not proven HTTP requests; caches and repeated attempts can reuse sources. Candidate-level sources/evidence are excluded to avoid duplicated projections.','requested_url != url records final URL change; HTTP status, redirect hop count and Location headers are absent. No 301/302 inference.','Coverage veto matching is lexical and retains full reason/location for review; it is not proof fetch failure caused rejection.','404 search excludes fetched page body text and requires a standalone token; timestamps/hashes containing 404 are not statuses.'],artifacts=results)
groups={}
for group in sorted({r['group'] for r in results}):
    rs=[r for r in results if r['group']==group]
    es=[e for r in rs for e in r['source_occurrences']]
    groups[group]=dict(artifact_count=len(rs),source_occurrences=len(es),unique_requested_urls=len({e['requested_url'] for e in es}),unique_final_urls=len({e['url'] for e in es}),rewrite_occurrences=sum(e['requested_url']!=e['url'] for e in es),unique_rewrite_pairs=len({(e['requested_url'],e['url']) for e in es if e['requested_url']!=e['url']}),coverage_veto_attempts=sum(len(r['coverage_veto_attempts']) for r in rs),recorded_404_fields=sum(len(r['recorded_404_non_body_fields']) for r in rs),discovered_url_count=None,fetch_error_count=None)
report['groups']=groups
(OUT/'artifact-audit.json').write_text(json.dumps(report,indent=2)+'\n')
lines=['# Offline retrieval artifact audit','','Counts use decision-attempt source records only. Discovery and fetch-error counts are **unknown**, not zero. No network used.','','| Artifact | Candidates | Attempts | Source occurrences | Unique requested | Unique final | Rewrite occurrences | Rewrite pairs | Coverage veto attempts |','|---|---:|---:|---:|---:|---:|---:|---:|---:|']
for r in results:
    lines.append(f"| {Path(r['artifact']).name} | {r['candidate_count']} | {r['attempt_count']} | {r['fetched_source_occurrences']} | {r['unique_requested_urls']} | {r['unique_final_urls']} | {r['rewritten_source_occurrences']} | {len(r['rewrite_pairs'])} | {len(r['coverage_veto_attempts'])} |")
lines+=['','## Caveats',*['- '+c for c in report['caveats']],'','Exact paths, source SHA256s, source/error locations, recorded URL pairs and full veto reasons are in `artifact-audit.json`. No known-404 mappings can be established from these artifacts alone.']
(OUT/'artifact-audit.md').write_text('\n'.join(lines)+'\n')
print(json.dumps(dict(artifacts=len(results),source_occurrences=sum(r['fetched_source_occurrences'] for r in results),rewrite_occurrences=sum(r['rewritten_source_occurrences'] for r in results),recorded_404_fields=sum(len(r['recorded_404_non_body_fields']) for r in results))))
