import { createElement, type ReactNode } from "react";
import type { Token, Tokens } from "marked";
import { markdownTokens, safeHref, safeImageSrc } from "@/lib/content/markdown";

function renderTokens(tokens: Token[]): ReactNode[] {
  return tokens.map((token, key) => {
    const children = () => renderTokens("tokens" in token ? token.tokens ?? [] : []);
    switch (token.type) {
      case "space": case "def": case "html": return null;
      case "heading": return createElement(`h${Math.min(Math.max(token.depth, 2), 6)}`, { key }, children());
      case "paragraph": return <p key={key}>{children()}</p>;
      case "text": return token.tokens ? <span key={key}>{children()}</span> : token.text;
      case "escape": return token.text;
      case "strong": return <strong key={key}>{children()}</strong>;
      case "em": return <em key={key}>{children()}</em>;
      case "del": return <del key={key}>{children()}</del>;
      case "codespan": return <code key={key}>{token.text}</code>;
      case "code": return <pre key={key}><code>{token.text}</code></pre>;
      case "blockquote": return <blockquote key={key}>{children()}</blockquote>;
      case "br": return <br key={key} />;
      case "hr": return <hr key={key} />;
      case "link": {
        const href = safeHref(token.href);
        return href ? <a key={key} href={href} rel={href.startsWith("http") ? "noopener noreferrer" : undefined}>{children()}</a> : <span key={key}>{children()}</span>;
      }
      case "image": {
        const src = safeImageSrc(token.href);
        // Plain local img preserves offline rendering without an image proxy.
        // eslint-disable-next-line @next/next/no-img-element
        return src ? <img key={key} src={src} alt={token.text} loading="lazy" /> : <span key={key}>{token.text}</span>;
      }
      case "list": {
        const list = token as Tokens.List;
        const items = list.items.map((item, index) => <li key={index}>{renderTokens(item.tokens)}</li>);
        return list.ordered ? <ol key={key} start={typeof list.start === "number" ? list.start : undefined}>{items}</ol> : <ul key={key}>{items}</ul>;
      }
      case "table": {
        const table = token as Tokens.Table;
        return <div key={key} className="overflow-x-auto"><table><thead><tr>{table.header.map((cell, index) => <th key={index} scope="col">{renderTokens(cell.tokens)}</th>)}</tr></thead><tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((cell, col) => <td key={col}>{renderTokens(cell.tokens)}</td>)}</tr>)}</tbody></table></div>;
      }
      default: return null;
    }
  });
}

export function MarkdownContent({ content }: { content: string }) {
  return <div className="space-y-5 leading-relaxed text-foreground [&_h2]:pt-5 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:pt-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_code]:font-mono [&_code]:text-sm [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_th]:border [&_th]:p-3 [&_td]:border [&_td]:p-3 [&_hr]:border-border">{renderTokens(markdownTokens(content))}</div>;
}
