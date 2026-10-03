import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261003000000_v2_baseline.sql", "utf8");
const seed = readFileSync("supabase/seed.sql", "utf8");
const tables = ["exam_domains", "questions", "answers", "explanations", "question_generation_runs",
  "user_subscriptions", "payment_history", "webhook_events", "study_sessions", "session_items",
  "free_practice_quota", "pmle_passes", "pmle_pass_refunds"];

describe("v2 baseline security and replay contracts", () => {
  it("is additive and does not touch legacy sessions", () => {
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|TYPE|POLICY|FUNCTION|COLUMN)\b|\bRENAME\s+TO\b|\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/public\.(diagnostics_sessions|diagnostic_\w+|practice_sessions|practice_questions|anonymous_sessions)/i);
    for (const table of tables) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table} (`);
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      expect(sql).toContain(`REVOKE ALL ON TABLE public.${table} FROM PUBLIC, anon, authenticated;`);
    }
    expect(sql).toContain("IF NOT EXISTS (SELECT 1 FROM pg_policies");
    expect(sql).not.toMatch(/CREATE INDEX (?!IF NOT EXISTS)/i);
  });
  it("ANDs owner isolation with any existing permissive metadata policy", () => {
    for (const table of ["user_subscriptions", "payment_history", "study_sessions", "pmle_passes", "free_practice_quota"]) {
      expect(sql).toContain(`tablename = '${table}' AND policyname = 'v2_owner_gate'`);
      expect(sql).toContain(`CREATE POLICY v2_owner_gate ON public.${table} AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);`);
    }
    for (const table of ["user_subscriptions", "payment_history", "study_sessions", "pmle_passes"]) {
      expect(sql).toContain(`CREATE POLICY v2_own_metadata ON public.${table} FOR SELECT TO authenticated`);
    }
    expect(sql).not.toContain("GRANT SELECT ON TABLE public.free_practice_quota TO authenticated");
  });
  it("keeps questions, correct answers, explanations and snapshots server-only", () => {
    for (const table of ["questions", "answers", "explanations", "session_items", "webhook_events", "pmle_pass_refunds"]) {
      expect(sql).not.toMatch(new RegExp(`GRANT SELECT ON TABLE public\\.${table} TO (anon|authenticated)`));
      expect(sql).not.toMatch(new RegExp(`CREATE POLICY \\w+ ON public\\.${table}`));
    }
    for (const signature of ["create_study_session(TEXT, UUID, TEXT, JSONB, TIMESTAMPTZ)",
      "answer_study_item(UUID, UUID, TEXT, UUID, TEXT)", "consume_free_practice_quota(UUID, INTEGER)",
      "fulfill_pmle_pass(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ)", "refund_pmle_pass(TEXT, TIMESTAMPTZ)",
      "v2_consume_free_practice_quota(UUID, INTEGER)",
      "v2_create_study_session(TEXT, UUID, TEXT, JSONB, TIMESTAMPTZ, BOOLEAN)",
      "create_free_practice_session(UUID, JSONB, TIMESTAMPTZ)", "claim_anonymous_diagnostics(UUID, TEXT)"]) {
      expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${signature}`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${signature}`);
    }
    const answerBody = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.answer_study_item"));
    expect(answerBody).toContain("FOR UPDATE");
    expect(answerBody).toContain("v_session.expires_at <= clock_timestamp()");
    expect(answerBody).toContain("Session owner mismatch");
    expect(answerBody).toContain("Answer the next item in order");
    expect(answerBody).toContain("Answer already recorded");
    expect(answerBody).toContain("'answeredCount',v_answered,'totalQuestions',v_session.question_count");
    expect(answerBody).not.toMatch(/jsonb_build_object\([^;]*(correct_label|is_correct|explanation)/s);
  });
  it("keeps quota and fulfillment atomic", () => {
    expect(sql).toContain("date_trunc('week', now() AT TIME ZONE 'UTC')");
    expect(sql).toContain("ON CONFLICT (user_id, week_start) DO UPDATE");
    expect(sql).toContain("public.free_practice_quota.questions_used + EXCLUDED.questions_used <= 5");
    expect(sql).toContain("PERFORM public.consume_free_practice_quota(p_user_id, v_count)");
    expect(sql.match(/pg_catalog.pg_advisory_xact_lock/g)).toHaveLength(2);
    expect(sql).toContain("INTERVAL '2160 hours'");
    expect(sql).toContain("PMLE pass identity or paid date mismatch");
    expect(sql).toContain("to_regprocedure('public.fulfill_pmle_pass(uuid,text,text,text,timestamptz)')");
  });
});

describe("Phase 2 strict quota and bulk claim", () => {
  it("charges the strict free path in the shared creation transaction without paid bypass", () => {
    const strictQuota = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.v2_consume_free_practice_quota("),
      sql.indexOf("CREATE OR REPLACE FUNCTION public.consume_free_practice_quota("));
    expect(strictQuota).not.toMatch(/user_subscriptions|pmle_passes|status = 'active'/);
    expect(strictQuota).toContain("ON CONFLICT (user_id, week_start) DO UPDATE");
    expect(strictQuota).toContain("questions_used + EXCLUDED.questions_used <= 5");
    expect(sql).toContain("IF p_free_only THEN\n   PERFORM public.v2_consume_free_practice_quota(p_user_id, v_count);");
    expect(sql).toContain("SELECT public.v2_create_study_session('practice', p_user_id, NULL, p_items, p_expires_at, true)");
    expect(sql).toContain("SELECT public.v2_create_study_session(p_kind, p_user_id, p_anonymous_owner_hash, p_items, p_expires_at, false)");
  });
  it("bulk claims only diagnostics by owner hash, never an ID or already owned row", () => {
    const claim = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.claim_anonymous_diagnostics("),
      sql.indexOf("CREATE OR REPLACE FUNCTION public.answer_study_item("));
    expect(claim).toContain("p_user_id IS NULL OR p_anonymous_owner_hash IS NULL");
    expect(claim).toContain("p_anonymous_owner_hash !~ '^[0-9a-f]{64}$'");
    expect(claim).toContain("SET user_id = p_user_id, anonymous_owner_hash = NULL");
    expect(claim).toContain("WHERE kind = 'diagnostic' AND user_id IS NULL AND anonymous_owner_hash = p_anonymous_owner_hash");
    expect(claim).toContain("GET DIAGNOSTICS v_claimed = ROW_COUNT");
    expect(claim).not.toMatch(/p_session_id|WHERE id\s*=/);
  });
  it("uses local confirmed auth and direct token-hash app templates", () => {
    const config = readFileSync("supabase/config.toml", "utf8");
    expect(config).toContain('project_id = "testero-v2"');
    expect(config).toContain('site_url = "http://127.0.0.1:3000"');
    expect(config).toContain('"http://127.0.0.1:3100/**"');
    expect(config).toContain("enable_confirmations = true");
    for (const [template, type] of [["confirmation", "signup"], ["recovery", "recovery"]]) {
      const html = readFileSync(`supabase/templates/${template}.html`, "utf8");
      expect(config).toContain(`content_path = "./supabase/templates/${template}.html"`);
      expect(html).toContain(`{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=${type}`);
      expect(html).not.toContain(".ConfirmationURL");
    }
  });
});

describe("local educational seed", () => {
  it("has exactly 30 questions, four explained choices each, and six domains", () => {
    expect(seed.match(/INSERT INTO public.questions /g)).toHaveLength(30);
    expect(seed.match(/INSERT INTO public.answers /g)).toHaveLength(120);
    expect(seed.match(/INSERT INTO public.explanations /g)).toHaveLength(30);
    expect(seed.match(/INSERT INTO public.exam_domains /g)).toHaveLength(6);
    expect(seed.match(/,'ACTIVE','GOOD'\)/g)).toHaveLength(30);
    expect(seed.match(/,true,/g)).toHaveLength(30);
    expect(seed.match(/ON CONFLICT DO NOTHING;/g)).toHaveLength(186);
    expect(seed).not.toMatch(/INSERT INTO (auth\.users|public\.(payment_history|user_subscriptions|pmle_passes))/);
    expect(seed).toContain("LOCAL DEVELOPMENT ONLY");
  });
});
