import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HANDLED_STRIPE_EVENTS } from "@/lib/stripe/events";
const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file: string) => readFileSync(join(root, file), "utf8");

describe("one supported Stripe event list", () => {
  it("equals every switch case, with no subscription handlers", () => {
    const cases = [...read("app/api/billing/webhook/route.ts").matchAll(/case "([^"]+)":/g)].map(match => match[1]);
    expect(cases).toEqual([...HANDLED_STRIPE_EVENTS]);
    expect(HANDLED_STRIPE_EVENTS).toEqual(["checkout.session.completed", "checkout.session.async_payment_succeeded", "charge.refunded"]);
  });
  it("the deploy validator accepts latest and numbered references but never raw secrets", () => {
    const workflow = read(".github/workflows/deploy-to-cloud-run.yml");
    const pattern = workflow.match(/re.fullmatch\(r"([^"]+)"/)![1];
    const validate = new RegExp(`^(?:${pattern})$`);
    expect(validate.test("STRIPE_WEBHOOK_SECRET:latest")).toBe(true);
    expect(validate.test("STRIPE_WEBHOOK_SECRET:3")).toBe(true);
    for (const value of ["whsec_not_a_reference", "STRIPE_WEBHOOK_SECRET:0", "STRIPE_WEBHOOK_SECRET:latest\n"]) expect(validate.test(value)).toBe(false);
  });
});
function runRotation(mode: string, check = false) {
  mkdirSync(join(root, ".cache"), { recursive: true });
  const directory = mkdtempSync(join(root, ".cache", "rotation-"));
  const mock = `#!${process.execPath}
import { appendFileSync, readFileSync } from 'node:fs';
const args=process.argv.slice(2); const tool=process.argv[1].split('/').pop();
appendFileSync(process.env.MOCK_LOG,JSON.stringify({tool,args})+'\\n');
if(tool==='gcloud') {
  if(args.includes('access')) { if(process.env.MOCK_MODE==='key-failure') process.exit(1); process.stdout.write('fixture-api-key'); }
  else { if(readFileSync(0,'utf8')!=='whsec_fixture') process.exit(2); if(process.env.MOCK_MODE==='secret-failure') process.exit(1); }
} else {
  if(process.env.STRIPE_API_KEY!=='fixture-api-key') process.exit(3);
  if(args[1]==='list') console.log(JSON.stringify({has_more:process.env.MOCK_MODE==='pagination',data:[{id:'we_old',url:'https://testero.ai/api/billing/webhook',status:'enabled',enabled_events:process.env.MOCK_MODE==='mismatch'?['checkout.session.completed']:['checkout.session.completed','checkout.session.async_payment_succeeded','charge.refunded']},{id:'we_other',url:'https://other.test',status:'enabled',enabled_events:[]}]}));
  else if(args[1]==='create') console.log(JSON.stringify({id:'we_new',secret:'whsec_fixture'}));
  else if(args[1]!=='update') process.exit(4);
}
`;
  for (const tool of ["stripe", "gcloud"]) { writeFileSync(join(directory, tool), mock); chmodSync(join(directory, tool), 0o755); }
  const logfile = join(directory, "calls.jsonl");
  try {
    const result = spawnSync("bash", [join(root, "scripts/stripe-webhook-rotate.sh"), ...(check ? ["--check"] : [])], {
      cwd: root, encoding: "utf8", env: { NODE_ENV: "test", PATH: `${directory}:${process.env.PATH}`, HOME: directory, MOCK_LOG: logfile, MOCK_MODE: mode },
    });
    const calls = readFileSync(logfile, "utf8").trim().split("\n").map(line => JSON.parse(line) as { tool: string; args: string[] });
    expect(result.stdout + result.stderr + JSON.stringify(calls)).not.toMatch(/fixture-api-key|whsec_fixture/);
    return { result, calls };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
describe("rotation script with fake cloud/payment CLIs only", () => {
  it("creates exact event list, stores secret before disabling only matching old endpoints", () => {
    const { result, calls } = runRotation("ok"); expect(result.status).toBe(0);
    const create = calls.find(call => call.args[1] === "create")!;
    expect(create.args.filter(arg => arg.startsWith("enabled_events[]=")).sort()).toEqual(HANDLED_STRIPE_EVENTS.map(type => `enabled_events[]=${type}`).sort());
    const store = calls.findIndex(call => call.tool === "gcloud" && call.args.includes("add"));
    const disable = calls.findIndex(call => call.args[1] === "update");
    expect(store).toBeGreaterThan(0); expect(disable).toBeGreaterThan(store);
    expect(calls[disable].args).toEqual(["webhook_endpoints", "update", "we_old", "--live", "--disabled=true"]);
  });
  it.each([["ok", 0], ["mismatch", 1], ["pagination", 1]])("--check %s is read-only with expected exit %s", (mode, expected) => {
    const { result, calls } = runRotation(mode, true); expect(result.status).toBe(expected);
    expect(calls).toHaveLength(2); expect(calls[1].args[1]).toBe("list");
  });
  it.each(["key-failure", "secret-failure", "pagination"])("stops on %s without disabling any endpoint", mode => {
    const { result, calls } = runRotation(mode); expect(result.status).not.toBe(0);
    expect(calls.some(call => call.args[1] === "update")).toBe(false);
    if (mode === "key-failure") expect(calls).toHaveLength(1);
  });
});
