import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { PMLE_EXAM_GUIDE_URL } from "@/lib/constants/pmle-guide";
import { getCertification } from "@/lib/certifications/data";

it("shares Google's working current PMLE guide across every first-party guide link", () => {
  expect(PMLE_EXAM_GUIDE_URL).toBe("https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf");
  expect(getCertification("machine-learning-engineer")!.guides.map(guide => guide.url)).toContain(PMLE_EXAM_GUIDE_URL);
  for (const path of ["app/page.tsx", "app/diagnostic/page.tsx", "app/pmle/sample-questions/page.tsx"]) {
    const source = readFileSync(path, "utf8");
    expect(source, path).toContain('from "@/lib/constants/pmle-guide"');
    expect(source, path).toContain("href={PMLE_EXAM_GUIDE_URL}");
  }
  function inspect(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) inspect(path);
      else if (/\.tsx?$/.test(entry.name)) {
        const source = readFileSync(path, "utf8");
        expect(source, path).not.toContain("https://cloud.google.com/learn/certification/guides/machine-learning-engineer");
        // Editorial documents keep their original source text; JSX links use the constant.
        if (entry.name.endsWith(".tsx")) expect(source, path).not.toContain(`href="${PMLE_EXAM_GUIDE_URL}"`);
      }
    }
  }
  inspect("app");
  inspect("components");
});
