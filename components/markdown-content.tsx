import { createElement, type ReactNode } from "react";
import type { Token, Tokens } from "marked";
import { markdownTokens, safeHref, safeImageSrc } from "@/lib/content/markdown";

function renderTokens(tokens: Token[], headingIds?: Readonly<Record<string, string>>): ReactNode[] {
  return tokens.map((token, key) => {
    const children = () => renderTokens("tokens" in token ? token.tokens ?? [] : [], headingIds);
    switch (token.type) {
      case "space": case "def": case "html": return null;
      case "heading": return createElement(`h${Math.min(Math.max(token.depth, 2), 6)}`, { key, id: headingIds?.[token.text] }, children());
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
        const items = list.items.map((item, index) => <li key={index}>{renderTokens(item.tokens, headingIds)}</li>);
        return list.ordered ? <ol key={key} start={typeof list.start === "number" ? list.start : undefined}>{items}</ol> : <ul key={key}>{items}</ul>;
      }
      case "table": {
        const table = token as Tokens.Table;
        return <div key={key} className="max-w-full overflow-x-auto rounded-lg" tabIndex={0} role="region" aria-label="Scrollable table"><table><thead><tr>{table.header.map((cell, index) => <th key={index} scope="col">{renderTokens(cell.tokens)}</th>)}</tr></thead><tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((cell, col) => <td key={col}>{renderTokens(cell.tokens)}</td>)}</tr>)}</tbody></table></div>;
      }
      default: return null;
    }
  });
}

export function MarkdownContent({ content, headingIds }: { content: string; headingIds?: Readonly<Record<string, string>> }) {
  return <div className="space-y-5 text-base leading-7 text-foreground [&_h2]:text-pretty [&_h2]:pt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:tracking-tight [&_h3]:text-pretty [&_h3]:pt-4 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-snug [&_h4]:pt-3 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:leading-snug [&_h5]:font-semibold [&_h6]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:no-underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-2 [&_li>p+p]:mt-3 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:space-y-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_table]:w-full [&_table]:min-w-[36rem] [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-3 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:p-3 [&_td]:align-top [&_img]:mx-auto [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_hr]:border-border">{renderTokens(markdownTokens(content), headingIds)}</div>;
}
