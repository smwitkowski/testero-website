import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  deriveQuickFilterKey,
  parseAdminQuestionFilters,
} from "@/lib/admin/questions/filter-utils";

describe("parseAdminQuestionFilters", () => {
  it("returns defaults when params are empty", () => {
    const result = parseAdminQuestionFilters({});
    expect(result).toEqual({
      search: "",
      domain: null,
      status: null,
      reviewStatuses: [],
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("normalizes search text and bounds pagination", () => {
    const result = parseAdminQuestionFilters({
      q: "  vector   search ",
      page: "-5",
      pageSize: "500",
    });

    expect(result.search).toBe("vector   search");
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(PAGE_SIZE_OPTIONS[PAGE_SIZE_OPTIONS.length - 1]);
  });

  it("extracts valid filters and ignores invalid values", () => {
    const result = parseAdminQuestionFilters({
      domain: "DATA_PIPELINES",
      status: "ACTIVE",
      reviewStatus: ["BAD_VALUE", "GOOD", "UNREVIEWED"],
      page: "2",
      pageSize: "50",
    });

    expect(result).toMatchObject({
      domain: "DATA_PIPELINES",
      status: "ACTIVE",
      reviewStatuses: ["GOOD", "UNREVIEWED"],
      page: 2,
      pageSize: 50,
    });
  });

  it("handles repeated review status params", () => {
    const result = parseAdminQuestionFilters({
      reviewStatus: ["GOOD", "GOOD", "NEEDS_ANSWER_FIX"],
    });

    expect(result.reviewStatuses).toEqual(["GOOD", "NEEDS_ANSWER_FIX"]);
  });
});

describe("deriveQuickFilterKey", () => {
  it("identifies quick filter presets by filter combination", () => {
    expect(
      deriveQuickFilterKey({
        search: "",
        domain: null,
        status: null,
        reviewStatuses: ["UNREVIEWED"],
        page: 1,
        pageSize: 25,
      })
    ).toBe("unreviewed");

    expect(
      deriveQuickFilterKey({
        search: "",
        domain: null,
        status: "ACTIVE",
        reviewStatuses: ["GOOD"],
        page: 1,
        pageSize: 25,
      })
    ).toBe("active_good");

    expect(
      deriveQuickFilterKey({
        search: "",
        domain: null,
        status: null,
        reviewStatuses: ["NEEDS_ANSWER_FIX", "NEEDS_EXPLANATION_FIX"],
        page: 1,
        pageSize: 25,
      })
    ).toBe("needs_attention");

    expect(
      deriveQuickFilterKey({
        search: "foo",
        domain: null,
        status: null,
        reviewStatuses: [],
        page: 1,
        pageSize: 25,
      })
    ).toBeNull();
  });
});
