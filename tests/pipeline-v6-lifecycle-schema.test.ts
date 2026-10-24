import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const a = readFileSync("supabase/migrations/20261025100000_pipeline_v6_publication.sql", "utf8");
const b = readFileSync("supabase/migrations/20261025110000_pipeline_v6_report_quarantine.sql", "utf8");

describe("pipeline v6 lifecycle DB contracts", () => {
  it("guards status and review status UPDATEs, not unchanged values", () => {
    expect(a).toContain("CREATE TRIGGER question_lifecycle_guard BEFORE UPDATE ON public.questions");
    expect(a).toContain("(NEW.status,NEW.review_status) IS DISTINCT FROM (OLD.status,OLD.review_status)");
    expect(a).toContain("current_setting('testero.lifecycle',true) IS DISTINCT FROM '1'");
    expect(a).toContain("public.guard_question_lifecycle()");
    expect(a).toContain("FROM PUBLIC,anon,authenticated");
    expect(a).not.toMatch(/SECURITY DEFINER/);
  });
  it("restores the previous transaction-local flag on success and failure", () => {
    expect(a).toContain("v_previous_flag := current_setting('testero.lifecycle',true)");
    expect(a).toContain("set_config('testero.lifecycle','1',true)");
    expect(a.match(/set_config\('testero.lifecycle',coalesce\(v_previous_flag,''\),true\)/g)).toHaveLength(2);
    expect(a).toMatch(/EXCEPTION WHEN OTHERS THEN[\s\S]*?set_config[\s\S]*?RAISE;/);
  });
  it("orders lifecycle locks globally before domains/rows, without report-lock inversion", () => {
    const lock = a.slice(a.indexOf("CREATE FUNCTION public.lock_question_lifecycle"), a.indexOf("CREATE FUNCTION public.transition_question"));
    expect(lock.indexOf("'question-lifecycle-global'")).toBeLessThan(lock.indexOf("'question-domain:'"));
    expect(lock.indexOf("'question-domain:'")).toBeLessThan(lock.indexOf("FOR UPDATE"));
    expect(a).not.toContain("'question-report-global-quarantine'");
    expect(b.indexOf("public.lock_question_lifecycle(v_question_id)")).toBeLessThan(b.indexOf("INSERT INTO public.question_reports"));
    expect(b).toContain("user_id=p_user_id FOR KEY SHARE");
    expect(b).toContain("kind=p_kind FOR KEY SHARE");
    expect(b.indexOf("'question-report-global-quarantine'")).toBeLessThan(b.indexOf("public.lock_question_lifecycle(v_question_id)"));
  });
  it("withdraws ACTIVE descendants recursively with their own audit events", () => {
    expect(a).toContain("WITH RECURSIVE family AS");
    expect(a).toContain("WHERE q.status='ACTIVE' AND q.id<>p_question_id ORDER BY q.id FOR UPDATE OF q");
    expect(a).toContain("'cascade_from_question_id',p_question_id");
    expect(a).toContain("Restore original ancestry before variant");
    expect(a).toContain("trusted service boundary, not SQL proof");
  });
  it("finalizes only an exact pending draft run without publication", () => {
    expect(a).toContain("CREATE FUNCTION public.finalize_question_review(p_question_id UUID,p_generation_run_id UUID,");
    expect(a).toContain("v_question.status IS DISTINCT FROM 'DRAFT' OR v_question.review_status IS DISTINCT FROM 'UNREVIEWED'");
    expect(a).toContain("v_question.generation_run_id IS DISTINCT FROM (p_payload->>'generation_run_id')::uuid");
    expect(a).toContain("v_question.review_notes IS DISTINCT FROM p_payload->>'review_notes'");
    expect(a).toContain("(p_action='reviewed' AND p_reason='GOOD')");
    expect(a).toContain("WHEN p_action='reviewed' THEN 'DRAFT'");
    expect(a).toContain("public.finalize_question_review(UUID,UUID,TEXT,TEXT),public.publish_question");
  });
  it("uses distinct valid anonymous owners from this publication/restoration cycle", () => {
    expect(b).toContain("action IN ('published','restored')");
    expect(b).toContain("count(DISTINCT owner_key)");
    expect(b).toContain("r.owner_key ~ '^anon:[0-9a-f]{64}$'");
    expect(b).toContain("e.payload->>'cycle_event_id'=v_cycle");
    expect(b).toContain("r.reason IN ('wrong answer','outdated')");
    expect(b).toContain("v_owner LIKE 'anon:%' AND v_anonymous_owners < 2");
    expect(b).toContain("'cycle_event_id',v_cycle");
    expect(b).toContain("NOT (payload ? 'cascade_from_question_id')");
    expect(b).toContain(">= 5 THEN");
    expect(b).toContain(">= 10 THEN");
  });
});
