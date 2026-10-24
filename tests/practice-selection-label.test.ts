import { describe, expect, it } from "vitest";
import { restorePracticeSelection } from "@/lib/practice/selection-label";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
const domainCode = PMLE_BLUEPRINT[0].domainCode;
describe("trusted stored practice labels", () => {
  it.each(["history", "diagnostic_focus", "general"])("constructs %s text from reason and canonical domain", reason => {
    const result=restorePracticeSelection({reason,domainCode});
    expect(result).toMatchObject({reason,domainCode});
    expect(result?.message).toContain(PMLE_BLUEPRINT[0].displayName);
  });
  it.each([null,undefined,[],"URL prose",{}, {reason:"history",domainCode,message:"forged"},{reason:"history",domainCode:"foreign"},{reason:"evil",domainCode},{reason:{toString:(): string => "history"},domainCode}])("rejects untrusted metadata %#", value => {
    expect(restorePracticeSelection(value)).toBeNull();
  });
});
