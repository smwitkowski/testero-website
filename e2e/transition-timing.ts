import { test, expect, type Page } from "@playwright/test";

// Browser timestamps exclude Playwright actionability and visibility-retry overhead.
export async function armTransition(page: Page, options: { path: string; ordinal: number; total: number; feedback?: boolean }) {
  await page.evaluate(options => {
    const state = window as unknown as { transitionResult: Promise<{ click: number; dom: number; focus: number; requests: { path: string; start: number; end: number }[] }> };
    const requests: { path: string; start: number; end: number }[] = [];
    let click = 0;
    document.addEventListener("click", event => {
      if ((event.target as Element).closest("button")) click ||= performance.now();
    }, { capture: true, once: true });
    const original = window.fetch;
    window.fetch = async (...args) => {
      const path = new URL(String(args[0]), location.href).pathname;
      const record = { path, start: performance.now(), end: 0 };
      if (path === options.path || path === `${options.path}/answer`) requests.push(record);
      const response = await original(...args);
      const json = response.json.bind(response);
      response.json = async () => { const value = await json(); record.end = performance.now(); return value; };
      return response;
    };
    state.transitionResult = new Promise(resolve => {
      let dom = 0;
      const observer = new MutationObserver(check);
      function check() {
        const ordinal = [...document.querySelectorAll("span")].some(node => node.textContent === `Question ${options.ordinal} of ${options.total}`);
        const heading = document.querySelector("h1");
        const radios = [...document.querySelectorAll<HTMLInputElement>("input[type=radio]")];
        const ready = ordinal && heading && heading.getClientRects().length && (options.feedback
          ? radios.length === 4 && requests.some(request => request.path === `${options.path}/answer` && request.end > 0) && /^(Correct\. The answer is [A-Z]\.|Not quite\. The correct answer is [A-Z]\.|(?:Correct|Incorrect)\. You chose [A-Z]; the correct answer is [A-Z]\.)/.test(document.querySelector("[role=status]")?.textContent ?? "") && radios.every(radio => radio.matches(":disabled"))
          : radios.length === 4 && radios.every(radio => !radio.matches(":disabled")));
        if (!click || !ready) return;
        dom ||= performance.now();
        // New questions must also move keyboard focus to their heading.
        if (!options.feedback && document.activeElement !== heading) { requestAnimationFrame(check); return; }
        observer.disconnect(); window.fetch = original;
        resolve({ click, dom, focus: performance.now(), requests });
      }
      observer.observe(document, { subtree: true, childList: true, attributes: true });
    });
  }, options);
}

export async function assertTransition(page: Page, path: string, kind: "diagnostic" | "feedback" | "next") {
  const result = await page.evaluate(() => (window as unknown as { transitionResult: Promise<{ click: number; dom: number; focus: number; requests: { path: string; start: number; end: number }[] }> }).transitionResult);
  await test.info().attach(`transition-${kind}`, { body: JSON.stringify(result), contentType: "application/json" });
  const answer = result.requests.find(request => request.path === `${path}/answer`);
  const progress = result.requests.filter(request => request.path === path).at(-1);
  expect(progress, JSON.stringify(result)).toBeUndefined();
  const anchor = kind === "next" ? result.click : answer?.end;
  expect(anchor, JSON.stringify(result)).toBeGreaterThan(0);
  expect(result.dom - anchor!, JSON.stringify(result)).toBeGreaterThanOrEqual(0);
  const order = answer ? [result.click, answer.start, answer.end, result.dom, result.focus] : [result.click, result.dom, result.focus];
  expect(order, JSON.stringify(result)).toEqual([...order].sort((a, b) => a - b));
  if (kind === "next") expect(answer, JSON.stringify(result)).toBeUndefined();
  const client = result.focus - anchor! + (answer ? answer.start - result.click : 0);
  expect(client, JSON.stringify(result)).toBeLessThan(150);
  return result;
}
