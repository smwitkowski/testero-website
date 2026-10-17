import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { localStatus } from "./safety.mjs";
export async function seedAccounts() {
  const status = await localStatus();
  const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, redirect: "error" }) } });
  const accounts = {};
  // Fixed local-only fixture credentials, never accepted as production input.
  for (const kind of ["free", "paid", "refunded", "unconfirmed"]) {
    const email = `qa-${kind}@example.test`, password = `Local-QA-${kind}-Only-927!`;
    let user;
    for (let page = 1; !user; page++) {
      const result = await service.auth.admin.listUsers({ page, perPage: 100 });
      if (result.error) throw new Error("Local account listing failed");
      user = result.data.users.find(u => u.email === email);
      if (result.data.users.length < 100) break;
    }
    const result = user ? await service.auth.admin.updateUserById(user.id, { password, email_confirm: kind !== "unconfirmed" }) : await service.auth.admin.createUser({ email, password, email_confirm: kind !== "unconfirmed" });
    if (result.error) throw new Error("Local account fixture failed");
    const id = result.data.user.id;
    // Only deterministic QA owners are reset; unrelated local users stay intact.
    for (const table of ["study_sessions", "free_practice_quota", "pmle_passes"]) {
      const cleared = await service.from(table).delete().eq("user_id", id);
      if (cleared.error) throw new Error("Local fixture reset failed");
    }
    accounts[kind] = { id, email, password };
    if (["paid", "refunded"].includes(kind)) {
      const intent = `pi_local_qa_${kind}`;
      const pass = await service.rpc("fulfill_pmle_pass", { p_user_id: id, p_stripe_checkout_session_id: `cs_test_local_qa_${kind}`, p_stripe_payment_intent_id: intent, p_stripe_customer_id: `cus_local_qa_${kind}`, p_paid_at: new Date().toISOString() });
      if (pass.error) throw new Error("Local pass fixture failed");
      if (kind === "refunded") {
        const refund = await service.rpc("refund_pmle_pass", { p_stripe_payment_intent_id: intent, p_refunded_at: new Date().toISOString() });
        if (refund.error) throw new Error("Local refund fixture failed");
      }
    }
  }
  await mkdir(".qa", { recursive: true, mode: 0o700 });
  await writeFile(".qa/accounts.json", JSON.stringify(accounts, null, 2), { mode: 0o600 });
  console.log("Local-only account fixtures ready: free, paid, refunded, unconfirmed.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) seedAccounts().catch(() => { console.error("Local account seeding failed"); process.exitCode = 1; });
