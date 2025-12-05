import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdmin } from "@/lib/auth/isAdmin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type {
  AdminQuestionReviewStatus,
  AdminQuestionStatus,
} from "@/lib/admin/questions/filter-utils";

const BulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum([
    "review:GOOD",
    "review:NEEDS_EXPLANATION_FIX",
    "review:NEEDS_ANSWER_FIX",
    "review:RETIRED",
    "status:ACTIVE",
    "status:DRAFT",
    "status:RETIRED",
  ]),
});

type BulkUpdatePayload = z.infer<typeof BulkUpdateSchema>;

const ACTION_MAP: Record<
  BulkUpdatePayload["action"],
  | { column: "review_status"; value: AdminQuestionReviewStatus }
  | { column: "status"; value: AdminQuestionStatus }
> = {
  "review:GOOD": { column: "review_status", value: "GOOD" },
  "review:NEEDS_EXPLANATION_FIX": {
    column: "review_status",
    value: "NEEDS_EXPLANATION_FIX",
  },
  "review:NEEDS_ANSWER_FIX": { column: "review_status", value: "NEEDS_ANSWER_FIX" },
  "review:RETIRED": { column: "review_status", value: "RETIRED" },
  "status:ACTIVE": { column: "status", value: "ACTIVE" },
  "status:DRAFT": { column: "status", value: "DRAFT" },
  "status:RETIRED": { column: "status", value: "RETIRED" },
};

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !(await isAdmin(user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const json = await request.json().catch(() => ({}));
    const parsed = BulkUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { ids, action } = parsed.data;
    const updateConfig = ACTION_MAP[action];
    const serviceSupabase = createServiceSupabaseClient();

    const { data, error } = await serviceSupabase
      .from("questions")
      .update({ [updateConfig.column]: updateConfig.value })
      .in("id", ids)
      .select("id");

    if (error) {
      console.error("[AdminBulkUpdate] Failed to update questions:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({
      updated: data?.length ?? 0,
      column: updateConfig.column,
      value: updateConfig.value,
    });
  } catch (error) {
    console.error("[AdminBulkUpdate] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
