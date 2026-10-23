// Regenerate offline with: node scripts/generate-social-image.mjs
// next/og uses its bundled font. No network fetch or external image service is used.
import { writeFile } from "node:fs/promises";
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";

const blue = "#1F4CB5";
const image = new ImageResponse(
  h("div", { style: { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#F6F7F9", color: "#101828", padding: "58px 68px", fontFamily: "sans-serif" } },
    h("div", { style: { display: "flex", alignItems: "center", color: blue, fontSize: 32, fontWeight: 700, marginBottom: 46 } }, "Testero"),
    h("div", { style: { display: "flex", fontSize: 62, fontWeight: 700, lineHeight: 1.1, maxWidth: 1020 } }, "PMLE practice for the June 2026 exam guide"),
    h("div", { style: { display: "flex", alignItems: "center", alignSelf: "flex-start", background: blue, color: "#FFFFFF", padding: "17px 26px", borderRadius: 8, fontSize: 29, marginTop: 34 } }, "Free 5-question readiness check"),
    h("div", { style: { display: "flex", justifyContent: "space-between", color: "#475467", fontSize: 21, marginTop: "auto" } },
      h("span", null, "Independent study tool. Not affiliated with Google."),
      h("span", null, "testero.ai")),
    h("div", { style: { position: "absolute", bottom: 0, left: 0, right: 0, height: 12, background: blue } }),
  ),
  { width: 1200, height: 630 },
);
await writeFile(new URL("../public/og-pmle-2026.png", import.meta.url), Buffer.from(await image.arrayBuffer()));
console.log("Generated public/og-pmle-2026.png (1200 × 630).");
