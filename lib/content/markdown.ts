import { marked, type Token } from "marked";

export interface MarkdownDocument {
  attributes: Record<string, string | string[] | boolean>;
  body: string;
}

// Deliberately small frontmatter subset: top-level scalars, folded strings,
// and string lists. Nested analytics fields are ignored, never evaluated.
export function parseFrontmatter(source: string): MarkdownDocument {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { attributes: {}, body: normalized };
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) throw new Error("Unclosed frontmatter");
  const lines = normalized.slice(4, end).split("\n");
  const attributes: MarkdownDocument["attributes"] = {};
  const scalar = (value: string): string | boolean => {
    if (value === "true" || value === "false") return value === "true";
    if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value) as string;
    if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
    return value;
  };
  for (let i = 0; i < lines.length; i++) {
    const match = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const [, key, value] = match;
    const continuation: string[] = [];
    while (i + 1 < lines.length && !/^[A-Za-z_][\w-]*:/.test(lines[i + 1])) continuation.push(lines[++i]);
    if (value === "" && continuation.some((line) => /^\s*- /.test(line))) {
      attributes[key] = continuation.filter((line) => /^\s*- /.test(line)).map((line) => String(scalar(line.replace(/^\s*- /, "").trim())));
    } else if (/^[>|]-?$/.test(value)) {
      attributes[key] = continuation.map((line) => line.trim()).join(value.startsWith(">") ? " " : "\n").trim();
    } else if (value.startsWith("[")) {
      try { attributes[key] = JSON.parse(value) as string[]; } catch { attributes[key] = []; }
    } else if (value !== "") {
      attributes[key] = scalar([value, ...continuation.map((line) => line.trim())].join(" ").trim());
    }
  }
  return { attributes, body: normalized.slice(end + 5).trim() };
}

export function markdownTokens(source: string): Token[] {
  return marked.lexer(source, { gfm: true, breaks: false });
}

// Relative site links or HTTP(S) only. Reject protocol-relative URLs, encoded
// scheme tricks, backslashes, whitespace and controls before using an href.
export function safeHref(value: string): string | undefined {
  if (!value || /[\s\u0000-\u001f\u007f\\]/.test(value) || /%0[ad]/i.test(value)) return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (value.startsWith("#")) return value;
  try {
    const url = new URL(value);
    if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) return value;
  } catch { /* Invalid or unsupported destination. */ }
  return undefined;
}

// Images never request a third-party asset. SVG is excluded even locally.
export function safeImageSrc(value: string): string | undefined {
  const href = safeHref(value);
  return href?.startsWith("/") && /^\/images\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|gif|avif)$/i.test(href) && !href.includes("..") ? href : undefined;
}
