"""Offline-safe official certification registry parsing. No runtime pipeline imports."""
from __future__ import annotations
import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass, field
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

INDEX_URL = "https://cloud.google.com/learn/certification"
ALLOWED_HOSTS = {"cloud.google.com", "docs.cloud.google.com", "services.google.com",
                 "docs.google.com", "forms.gle", "www.skills.google",
                 "www.cloudskillsboost.google", "cloudskillsboost.google"}
class RegistryError(ValueError):
    """Untrusted download or unsupported source structure. Never publish partial data."""

def approved_url(url):
    p = urlparse(url)
    if p.scheme != "https" or p.hostname not in ALLOWED_HOSTS or p.username or p.password:
        raise RegistryError("Unapproved official source URL: " + url)
    if p.hostname == "docs.google.com" and not p.path.startswith("/forms/"):
        raise RegistryError("Only officially linked Google Forms are allowed")
    if p.port not in (None, 443):
        raise RegistryError("Nonstandard source port")
    return url

def clean(text):
    # PDFs use doubled zero-width spaces between words and single ones within words.
    text = text.replace("\u200b\u200b", " ").replace("\u200b", "").replace("\ufeff", "")
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text)).strip()

@dataclass
class Node:
    tag: str
    attrs: dict = field(default_factory=dict)
    children: list = field(default_factory=list)
    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()
    def rendered(self):
        if self.tag in {"script", "style", "nav", "footer", "devsite-header"}:
            return ""
        value = "".join(c.rendered() if isinstance(c, Node) else c for c in self.children)
        if self.tag in {"p", "div", "section", "article", "li", "ul", "ol", "h1", "h2", "h3", "h4", "br", "td", "tr"}:
            value = " " + value + " "
        return value
    def text(self):
        return clean(self.rendered())

class Document(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node("document")
        self.stack = [self.root]
        self.feed(html)
        self.close()
    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs)); self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]; break
    def handle_data(self, data):
        self.stack[-1].children.append(data)

def content_node(html):
    doc = Document(html).root
    return next((n for n in doc.walk() if n.tag == "devsite-content"),
                next((n for n in doc.walk() if n.tag == "main"), doc))

def links(node, base):
    return [(n.text(), urljoin(base, n.attrs["href"])) for n in node.walk()
            if n.tag == "a" and n.attrs.get("href")]

def parse_inventory(html):
    """Read only the role catalog after its level headings; reject missing groups."""
    doc = Document(html).root
    level = None; entries = {}; groups = set()
    for n in doc.walk():
        if n.tag in {"h2", "h3", "h4"}:
            match = re.fullmatch(r"(Foundational|Associate|Professional) certification", n.text(), re.I)
            if match:
                level = match[1].lower(); groups.add(level)
        if n.tag != "a" or not n.attrs.get("href") or not level:
            continue
        url = urljoin(INDEX_URL, n.attrs["href"])
        p = urlparse(url)
        if p.hostname != "cloud.google.com" or not re.fullmatch(r"/(?:learn/)?certification/[^/]+/?", p.path):
            continue
        name = n.text()
        if not name or name.lower() in {"certification", "certifications"}:
            continue
        approved_url(url)
        cert_id = p.path.rstrip("/").rsplit("/", 1)[-1]
        entries[cert_id] = {"cert_id": cert_id, "catalog_name": name, "level": level, "cert_url": url}
    if groups != {"foundational", "associate", "professional"} or len(entries) < 3:
        raise RegistryError("Catalog structure missing: refuse an empty/partial inventory")
    return sorted(entries.values(), key=lambda e: e["cert_id"])

SECTION = re.compile(r"^Section\s+(\d+)\s*:\s*(.*)$", re.I)
SUBSECTION = re.compile(r"^(\d+)\s*\.\s*(\d+)\s+(.+)$")
BULLET = re.compile(r"^([●○◦▪■]|o(?=\s)|-(?=\s))\s*(.*)$")
DATE = r"([A-Z][a-z]+\s+\d{1,2},\s+\d{4})"

def stated_date(text):
    import datetime
    try:
        return datetime.datetime.strptime(clean(text), "%B %d, %Y").date().isoformat()
    except ValueError:
        return None

def normalize_guide_text(text):
    lines = []
    for line in text.replace("\u200b\u200b", " ").replace("\u200b", "").splitlines():
        line = clean(line)
        if not line or re.fullmatch(r"\d+", line):
            continue
        # Repeated CDL footer is not an objective. Its explicit launch date is parsed separately.
        if re.match(r"Cloud Digital Leader exam guide - launched on .*\s\d+$", line):
            continue
        lines.append(line)
    return "\n".join(lines)

def parse_guide(text, cert_id, url, variant="standard"):
    normalized = normalize_guide_text(text)
    lines = normalized.splitlines()
    result = {"url": url, "variant": variant, "version": None, "effective_date": None,
              "as_of_date": None, "date_evidence": None,
              "normalized_text_sha256": hashlib.sha256(clean(normalized).encode()).hexdigest(),
              "case_studies": [], "sections": [], "in_scope_tools": []}
    asof = re.search(r"exam guide as of\s+" + DATE, clean(text), re.I)
    launched = re.search(r"launched on\s+" + DATE, clean(text), re.I)
    effective = re.search(r"effective (?:as of |on |date: )?" + DATE, clean(text), re.I)
    if asof:
        result["as_of_date"] = stated_date(asof[1]); result["date_evidence"] = asof[0]
    if launched or effective:
        match = launched or effective
        result["effective_date"] = stated_date(match[1]); result["date_evidence"] = match[0]
    version = re.search(r"(?:guide version|version:)\s*(v?\d+(?:\.\d+)+)", clean(text), re.I)
    if version:
        result["version"] = version[1]
    before_sections = normalized.split("Section 1:", 1)[0]
    result["case_studies"] = list(dict.fromkeys(clean(m[1]) for m in re.finditer(
        r"^(.+?) Case Study$", before_sections, re.M)))
    section = subsection = objective = None
    objective_stack = []
    target = None; appendix = False; top_count = nested_count = 0
    for line in lines:
        if line.startswith("The following tools are in scope for this exam"):
            appendix = True; target = None; continue
        if appendix:
            if line.startswith("- "):
                result["in_scope_tools"].append(line[2:])
            elif result["in_scope_tools"]:
                result["in_scope_tools"][-1] += " " + line
            continue
        sm = SECTION.match(line)
        sub = SUBSECTION.match(line)
        bullet = BULLET.match(line)
        if sm:
            section = {"id": f"{cert_id}:{variant}:{sm[1]}", "number": sm[1], "title": sm[2],
                       "weight_percent": None, "weight_approximate": None, "included": True, "subsections": []}
            result["sections"].append(section); subsection = objective = None
            target = section
        elif sub:
            if section is None or sub[1] != section["number"]:
                raise RegistryError("Subsection has no matching section: " + line)
            number = f"{sub[1]}.{sub[2]}"
            subsection = {"id": f"{cert_id}:{variant}:{number}", "number": number,
                          "title": sub[3], "weight_percent": None, "objectives": []}
            section["subsections"].append(subsection); objective = None; objective_stack = []; target = subsection
        elif bullet:
            if subsection is None:
                if section is not None:
                    raise RegistryError("Objective outside a subsection: " + line)
                continue
            if bullet[1] == "●":
                objective = {"id": f"{subsection['id']}:{len(subsection['objectives'])+1}",
                             "text": bullet[2], "children": []}
                subsection["objectives"].append(objective); top_count += 1
                objective_stack = [objective]
            else:
                depth = 2 if bullet[1] in {"▪","■"} else 1
                if len(objective_stack) < depth:
                    raise RegistryError("Nested objective without parent: " + line)
                parent = objective_stack[depth-1]
                child = {"id": f"{parent['id']}:{len(parent['children'])+1}", "text": bullet[2], "children": []}
                parent["children"].append(child); nested_count += 1
                objective_stack = objective_stack[:depth] + [child]
                target = child; continue
            target = objective
        elif target is not None:
            key = "text" if "text" in target else "title"
            target[key] += " " + line
    for sec in result["sections"]:
        weight = re.search(r"\((~?)(\d+(?:\.\d+)?)% of the exam\)", sec["title"])
        if weight:
            sec["weight_percent"] = float(weight[2]); sec["weight_approximate"] = bool(weight[1])
            sec["title"] = sec["title"][:weight.start()].strip()
        if "not included in renewal exam" in sec["title"]:
            sec["included"] = False
            sec["title"] = sec["title"].split(" (not included", 1)[0]
        if sec["included"] and not sec["subsections"]:
            raise RegistryError("Included section missing subsection outline")
        for sub in sec["subsections"]:
            sub["title"] = re.sub(r"\s*Considerations include:+\s*$", "", sub["title"]).strip()
    if not result["sections"] or not top_count:
        raise RegistryError("No complete exam outline found in guide: " + url)
    # Every main/nested marker after the first section must survive parsing.
    outline = normalized[normalized.index("Section "):].split("The following tools are in scope", 1)[0]
    expected = sum(bool(BULLET.match(l)) for l in outline.splitlines())
    if expected != top_count + nested_count:
        raise RegistryError("Guide bullet coverage mismatch")
    result["outline_counts"] = {"sections": len(result["sections"]),
        "subsections": sum(len(s["subsections"]) for s in result["sections"]),
        "objectives": top_count, "nested_objectives": nested_count}
    total = sum(s["weight_percent"] or 0 for s in result["sections"])
    result["stated_weight_total_percent"] = total
    result["weight_note"] = "Approximate stated weights are preserved; totals need not equal 100."
    return result

LABELS = ("Length", "Registration fee", "Languages", "Language", "Exam format", "Format", "Content",
          "Case studies", "Preparation", "Exam delivery method", "Validity period", "Prerequisites",
          "Recommended experience", "Certification renewal", "Eligibility")
LABEL_RE = re.compile(r"(?<!\w)(" + "|".join(map(re.escape, sorted(LABELS,key=len,reverse=True))) + r")\s*:", re.I)

def fields(chunk):
    matches = list(LABEL_RE.finditer(chunk)); values = {}
    for i,m in enumerate(matches):
        values[m[1].lower()] = chunk[m.end():matches[i+1].start() if i+1<len(matches) else len(chunk)].strip()
    return values

def variant_metadata(chunk, kind):
    f = fields(chunk)
    length = f.get("length"); duration = None
    if length:
        m = re.search(r"(\d+|one|two|three)\s*(hours?|minutes?)", length, re.I)
        if m:
            value = int(m[1]) if m[1].isdigit() else {"one":1,"two":2,"three":3}[m[1].lower()]
            duration = value * (60 if m[2].lower().startswith("hour") else 1)
    fmt = f.get("exam format", f.get("format")); count = None
    if fmt:
        m = re.search(r"(~?)(\d+)(?:-(\d+))?", fmt)
        if m:
            count = {"min":int(m[2]),"max":int(m[3] or m[2]),"approximate":bool(m[1])}
    price = f.get("registration fee"); price_num = re.search(r"\$(\d+)", price or "")
    languages = f.get("languages",f.get("language")); types = []
    if fmt and "multiple choice" in fmt.lower(): types.append("multiple_choice")
    if fmt and "multiple select" in fmt.lower(): types.append("multiple_select")
    case = f.get("case studies"); cases_per_exam = None
    if case:
        match = re.search(r"includes (\d+) case stud",case,re.I)
        cases_per_exam = int(match[1]) if match else None
    return {"variant":kind,"duration_minutes":duration,"duration_stated":length,
        "question_count":count,"question_types":types or None,"format_stated":fmt,
        "languages": [clean(x) for x in re.split(r",| and ", languages)] if languages else None,
        "languages_stated":languages,
        "price_usd":int(price_num[1]) if price_num else None,"price_stated":price,
        "validity_stated":f.get("validity period"),"delivery_stated":f.get("exam delivery method"),
        "case_studies_per_exam":cases_per_exam,"case_studies_stated":case,
        "guide_urls":[]}

def parse_cert_page(html, entry):
    scope = content_node(html); text = scope.text(); all_links = links(scope, entry["cert_url"])
    h1 = next((n.text() for n in scope.walk() if n.tag == "h1"), None)
    if not h1:
        raise RegistryError("Certification page has no title: " + entry["cert_url"])
    guide_links = list(dict.fromkeys(url for label,url in all_links
        if "guide" in label.lower() and "exam_guide" in url and urlparse(url).hostname in {"services.google.com","cloud.google.com","docs.cloud.google.com"}))
    sample_links = list(dict.fromkeys(url for label,url in all_links
        if ("sample" in label.lower() or "reviewing example" in label.lower()) and
        urlparse(url).hostname in {"docs.google.com","forms.gle"}))
    if not guide_links or not sample_links:
        raise RegistryError("Missing official guide/sample links: " + entry["cert_url"])
    result = {"schema_version":1,**entry,"name":h1,"status":"catalog-listed",
              "registration_status":"not_stated", "canonical_exam_code":None,
              "retirement":None,"announcements":[],"upcoming_versions":[],"exam_variants":[],
              "sample_sources":[{"url":u,"final_url":None,"availability":"not_fetched"} for u in sample_links],
              "guides":[],"sources":[]}
    headings = [(n.text(), n) for n in scope.walk() if n.tag in {"h2","h3","h4"}]
    boundaries = ["Standard exam information", "Renewal via Google Skills", "Renewal exam information",
                  "Beta exam details", "About this certification exam", "Preparing for", "Exam overview"]
    found = []
    for title,kind in [("Standard exam information","standard"),("Renewal exam information","renewal"),
                       ("Renewal via Google Skills","skills_renewal"),("Beta exam details","beta")]:
        start = text.find(title)
        if start < 0: continue
        end = min([text.find(b,start+len(title)) for b in boundaries if text.find(b,start+len(title))>=0]+[len(text)])
        found.append(variant_metadata(text[start+len(title):end],kind))
    if not found:
        start = text.find("About this certification exam")
        if start < 0: raise RegistryError("Missing exam metadata headings")
        end = min([text.find(b,start+len("About this certification exam")) for b in boundaries
                   if text.find(b,start+len("About this certification exam"))>=0]+[len(text)])
        found = [variant_metadata(text[start:end],"standard")]
    for v in found:
        if v["variant"] != "skills_renewal" and (v["duration_minutes"] is None or v["format_stated"] is None):
            raise RegistryError("Incomplete format facts for " + entry["cert_id"])
        if v["variant"] in {"standard","beta"}:
            v["guide_urls"] = [u for u in guide_links if "renewal" not in u]
        elif v["variant"] == "renewal":
            v["guide_urls"] = [u for u in guide_links if "renewal" in u]
            if not v["guide_urls"] and "Same as the standard exam" in text:
                v["guide_urls"] = [u for u in guide_links if "renewal" not in u]
    result["exam_variants"] = found
    result["missing_fields"] = []
    result["not_stated_notes"] = ["canonical_exam_code is not stated in the fetched official sources; no app or DB code is assigned.",
        "Guide version/effective/as-of dates are null unless explicitly stated in the guide. File names, hashes and HTML Last Updated dates are not versions."]
    for v in found:
        for key in ("duration_minutes", "question_count", "question_types", "languages", "price_usd", "validity_stated"):
            if v[key] is None:
                result["missing_fields"].append(f"exam_variants.{v['variant']}.{key}")
    if any(v["validity_stated"] is None and v["variant"] != "skills_renewal" for v in found):
        result["not_stated_notes"].append("Certification validity is not stated on this fetched certification page. Linked Support FAQs are outside the approved fetch hosts; no validity is inferred from level.")
    # Capture only official page announcements, not a Last Updated timestamp or URL-derived date.
    for n in scope.walk():
        t = n.text()
        if n.tag not in {"p", "aside", "span"} or len(t)>1200: continue
        if ((re.search(r"exam|guide|registration|PAA labs", t, re.I) and
             re.search(r"as of|updated|new version|upcoming|starting|effective|launch|opens|closed|required PAA labs", t, re.I))):
            if t and t not in result["announcements"]:
                result["announcements"].append(t)
    # Upcoming guide links must have an explicit future/next-version announcement.
    # "New guide" by itself can refer to a currently live guide and is not enough.
    upcoming_urls = set()
    for n in scope.walk():
        if n.tag not in {"p", "aside", "span"}: continue
        t = n.text()
        if len(t)>1200 or not re.search(r"upcoming|next version|will (?:soon be|be) (?:updated|revised|changed|replaced|available)|will (?:launch|start)|starting|effective (?:on|from)", t, re.I):
            continue
        if not re.search(r"exam|guide", t, re.I): continue
        announced_guides = [(label,u) for label,u in links(n,entry["cert_url"]) if u in guide_links]
        # A generic future branding notice can link back to the current guide.
        # It is not proof that that same URL is the upcoming guide.
        if re.search(r"will soon be updated",t,re.I):
            announced_guides = [(label,u) for label,u in announced_guides if re.search(r"next|upcoming|new version",label,re.I)]
        date_match = re.search(DATE,t)
        if not announced_guides:
            item = {"variant":None,"version":None,"guide_url":None,
                "effective_date":stated_date(date_match[1]) if date_match else None,
                "date_stated":date_match[1] if date_match else None,
                "announcement":t,"source_url":entry["cert_url"],
                "note":"Upcoming change is stated, but variant, version, date or future guide link may be unspecified. Do not substitute the current guide."}
            if item not in result["upcoming_versions"]: result["upcoming_versions"].append(item)
        for label,u in announced_guides:
            variant = "renewal" if "renewal" in label.lower() or "renewal" in u else "standard"
            item = {"variant":variant,"version":None,"guide_url":u,
                "effective_date":stated_date(date_match[1]) if date_match else None,
                "date_stated":date_match[1] if date_match else None,"announcement":t,"source_url":entry["cert_url"]}
            if item not in result["upcoming_versions"]: result["upcoming_versions"].append(item)
            upcoming_urls.add(u)
    for v in found:
        v["guide_urls"] = [u for u in v["guide_urls"] if u not in upcoming_urls]
    if "beta registration is closed" in text:
        result["registration_status"] = "closed_beta_upcoming_ga"
        result["upcoming_versions"].append({"variant":"ga","version":None,"guide_url":None,"effective_date":None,
            "registration_opens_stated":"November 2", "date_note":"Year not stated; do not infer a full date.",
            "source_url":entry["cert_url"]})
        result["assessment_components"] = ["Proctored multiple-choice exam", "Required distinct hands-on PAA labs in Google Skills after passing the exam"]
        result["lab_deadline"] = {"date":"2026-12-31","source_url":entry["cert_url"]}
    # Retired is set only by an explicit retirement statement with evidence.
    match = re.search(r"(?:certification|exam) (?:was |is |will be )?retired(?: on| as of)?\s+"+DATE,text,re.I)
    if match:
        result["retirement"] = {"date":stated_date(match[1]),"statement":match[0],"source_url":entry["cert_url"]}
    return result, guide_links

VOLATILE_KEYS = {"retrieved_at", "raw_sha256", "cache_path", "path"}
def semantic(value):
    if isinstance(value, dict):
        return {k:semantic(v) for k,v in value.items() if k not in VOLATILE_KEYS}
    if isinstance(value, list): return [semantic(v) for v in value]
    return value

def diff_registry(old, new):
    """Structured changes. Removal from catalog is NOT a retirement claim."""
    before = {e["cert_id"]:e for e in old}; after = {e["cert_id"]:e for e in new}
    changes = []
    for ident in sorted(after.keys()-before.keys()): changes.append({"cert_id":ident,"change":"new-certification"})
    for ident in sorted(before.keys()-after.keys()): changes.append({"cert_id":ident,"change":"removed-from-catalog-unverified"})
    for ident in sorted(before.keys() & after.keys()):
        a,b = before[ident],after[ident]
        for key,label in [("guides","guide-version-or-outline-hash"),("upcoming_versions","upcoming-version"),
                          ("retirement","explicit-retirement"),("exam_variants","exam-format")]:
            if semantic(a.get(key)) != semantic(b.get(key)):
                item = {"cert_id":ident,"change":label}
                if key == "guides":
                    facts = ("url", "variant", "version", "effective_date", "as_of_date", "normalized_text_sha256")
                    item["before"] = [{k:g.get(k) for k in facts} for g in a.get(key,[])]
                    item["after"] = [{k:g.get(k) for k in facts} for g in b.get(key,[])]
                changes.append(item)
        if semantic(a)!=semantic(b) and not any(c["cert_id"]==ident for c in changes):
            changes.append({"cert_id":ident,"change":"metadata"})
    return changes


def catalog_removal_history(previous, changes, current_ids):
    """Keep unverified removals only while they remain absent from the catalog."""
    removed = set(previous) | {c["cert_id"] for c in changes if c["change"] == "removed-from-catalog-unverified"}
    return sorted(removed - set(current_ids))
