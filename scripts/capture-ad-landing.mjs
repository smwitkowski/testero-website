// Capture only local sessions; cleanup deletes the exact sessions this script creates.
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
const origin=process.env.MEASURE_ORIGIN || "http://127.0.0.1:3002";
if (!/^http:\/\/(127\.0\.0\.1|localhost):3002$/.test(origin)) throw new Error("Expected isolated loopback evidence server");
const {stdout}=await promisify(execFile)("supabase",["status","-o","json"]);
const local=JSON.parse(stdout);
if(local.API_URL!=="http://127.0.0.1:56541" || new URL(local.DB_URL).port!=="56542") throw new Error("Expected local v2");
const service=createClient(local.API_URL,local.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const out="docs/qa/ad-landing-2026-10-23/screenshots";
await mkdir(out,{recursive:true});
const browser=await chromium.launch();
const ids=[]; const rows=[];
try {
  for(const width of [1280,375]) {
    const context=await browser.newContext({viewport:{width,height:812}});
    try {
      const page=await context.newPage();
      await page.goto(`${origin}/diagnostic?length=5&src=ad`);
      const cta=page.getByRole("button",{name:"Start the 5-question check",exact:true});
      await cta.waitFor();
      const box=await cta.boundingBox();
      if(!box || box.y+box.height>812) throw new Error("Fresh CTA below fold");
      await page.screenshot({path:`${out}/fresh-${width}.png`,fullPage:true});
      const created=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/diagnostic" && r.request().method()==="POST");
      await cta.click();
      const response=await created;
      if(response.status()!==201) throw new Error("Local creation failed");
      const {sessionId}=await response.json();ids.push(sessionId);
      await page.getByText("Question 1 of 5",{exact:true}).waitFor();
      await page.screenshot({path:`${out}/question-${width}.png`,fullPage:true});
      await page.getByRole("radio").first().check();
      await page.getByRole("button",{name:"Check answer",exact:true}).click();
      await page.getByRole("button",{name:"Next question",exact:true}).click();
      await page.getByText("Question 2 of 5",{exact:true}).waitFor();
      await page.goto(`${origin}/diagnostic?length=5&src=ad`);
      const resume=page.getByRole("link",{name:"Continue where I left off",exact:true});
      await resume.waitFor();
      const resumeBox=await resume.boundingBox();
      if(!resumeBox || resumeBox.y+resumeBox.height>812) throw new Error("Returning CTA below fold");
      await page.screenshot({path:`${out}/returning-${width}.png`,fullPage:true});
      await resume.click();
      await page.getByText("Question 2 of 5",{exact:true}).waitFor();
      rows.push({width,freshCtaY:box.y,returningCtaY:resumeBox.y,resumedQuestion:2});
    }finally{await context.close();}
  }
}finally{
  await browser.close();
  if(ids.length){const {error}=await service.from("study_sessions").delete().in("id",ids);if(error)throw error;}
}
await writeFile("docs/qa/ad-landing-2026-10-23/screenshot-proof.json",JSON.stringify({rows,createdSessions:ids.length,cleanup:"deleted exact created session IDs from local v2"},null,2));
console.log(JSON.stringify(rows));
