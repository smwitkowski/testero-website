/** LOCAL ONLY: restore approved non-PII backups and verify the additive v2 baseline.
 * Never reads data.sql/roles.sql; never accepts a database URL.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const value = name => { const i=args.indexOf(name); return i < 0 ? undefined : args[i+1]; };
const allowed = new Set(["--restore-local", "--schema", "--bank", "--output"]);
for(let i=0;i<args.length;i++) {
  assert(allowed.has(args[i]), "Unknown argument; this verifier accepts no remote URL");
  if(args[i]!=="--restore-local") { assert(args[i+1] && !args[i+1].startsWith("--"), "Missing argument value"); i++; }
}
assert(args.includes("--restore-local"), "Require --restore-local: this destroys only the isolated local public/archive/vecs/vector schemas");
assert(/project_id\s*=\s*"testero-v2"/.test(readFileSync("supabase/config.toml","utf8")), "Expected isolated testero-v2 config");
assert(/port\s*=\s*56542/.test(readFileSync("supabase/config.toml","utf8")), "Expected local DB port56542");
assert(!readdirSync(".").some(n=>n.startsWith(".env")&&n!==".env.example"), "Credential files are forbidden");
const APPROVED_BACKUP_DIRECTORY="/Users/switkowski/Projects/Testero/backups/2026-10-03";
function approvedFile(argument, basename) {
  assert(argument, `Provide ${basename}`);
  assert.equal(path.basename(argument),basename,"Only approved backup filenames are permitted");
  assert.equal(path.resolve(argument),path.join(APPROVED_BACKUP_DIRECTORY,basename),"Only the explicitly approved backup directory is permitted");
  const resolved=realpathSync(argument);
  assert.equal(resolved,path.join(realpathSync(APPROVED_BACKUP_DIRECTORY),basename),"Approved backup files may not redirect to another file");
  assert.equal(path.basename(resolved),basename,"Only approved backup filenames are permitted, including symlink targets");
  return resolved;
}
const schemaPath=approvedFile(value("--schema"),"schema.sql");
const bankPath=approvedFile(value("--bank"),"question-bank-data.sql");
assert.equal(path.dirname(schemaPath),path.dirname(bankPath),"Use the same approved backup directory");
const outputPath=value("--output") || "/tmp/testero-v2-prod-schema-evidence.json";
assert(path.resolve(outputPath).startsWith("/tmp/") && outputPath.endsWith(".json"),"Evidence output must be a /tmp JSON file");
const temporaryRoot=realpathSync("/tmp");
const outputTarget=existsSync(outputPath) ? realpathSync(outputPath) : path.join(realpathSync(path.dirname(outputPath)),path.basename(outputPath));
assert(outputTarget.startsWith(temporaryRoot+path.sep),"Evidence output may not resolve outside /tmp or overwrite backup/source files");
const schema=readFileSync(schemaPath,"utf8"), bank=readFileSync(bankPath,"utf8");
const bankTables=["exam_domains","question_generation_runs","questions","answers","explanations"];
const copies=[...bank.matchAll(/COPY "public"\."([a-z_]+)"[^\n]* FROM stdin;\n[\s\S]*?\n\\\.\s*(?:\n|$)/g)];
assert.deepEqual(copies.map(m=>m[1]).sort(),[...bankTables].sort(),"Exactly five approved question-bank COPY blocks are permitted");
assert.equal(bank.replace(/COPY "public"\."([a-z_]+)"[^\n]* FROM stdin;\n[\s\S]*?\n\\\.\s*(?:\n|$)/g,"").trim(),"","Data dump must contain only approved COPY data");
assert(!/^\s*\\(?:connect|c(?:\s|$)|i(?:\s|$)|ir(?:\s|$)|include|!)/mi.test(schema),"Schema may not include files, shell commands or connections");
assert(!/\b(?:dblink|http_post|http_get|net\.http|cron\.schedule)\b/i.test(schema),"Schema must not make outbound calls");
const env={...process.env,PGHOST:"127.0.0.1",PGPORT:"56542",PGDATABASE:"postgres",PGUSER:"postgres",PGPASSWORD:"postgres",PGSSLMODE:"disable"};
for(const name of ["PGSERVICE","PGSERVICEFILE","PGHOSTADDR","PGOPTIONS","PGPASSFILE"])delete env[name];
function sql(text) {
 return new Promise((resolve,reject)=>{
  const child=spawn("psql",["-X","-qAt","-v","ON_ERROR_STOP=1"],{env,stdio:["pipe","pipe","pipe"]});
  let out="",error="";child.stdout.on("data",p=>out+=p);child.stderr.on("data",p=>error+=p);
  child.on("error",reject);child.on("close",code=>code===0?resolve(out.trim()):reject(new Error(`Local SQL failed: ${error.slice(-3000)}`)));child.stdin.end(text);
 });
}
const sha=text=>createHash("sha256").update(text).digest("hex");
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const identifier=value=>'"'+value.replaceAll('"','""')+'"';
const scopes="('public','archive','vecs','vector')";
async function tables() {
 return JSON.parse(await sql(`SELECT coalesce(json_agg(x),'[]') FROM (SELECT n.nspname schema,c.relname name,c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ${scopes} AND c.relkind='r' ORDER BY 1,2) x;`));
}
async function rows(list) {
 const statements=list.map(t=>`SELECT json_build_object('schema',${quote(t.schema)},'table',${quote(t.name)},'count',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text),''),'sha256'),'hex')) FROM ${identifier(t.schema)}.${identifier(t.name)} t;`).join("\n");
 return (await sql(statements)).split("\n").filter(Boolean).map(line=>JSON.parse(line));
}
async function structure() {
 const query=`SELECT jsonb_build_object(
 'columns',(SELECT coalesce(jsonb_agg(x ORDER BY x.schema,x.table,x.ordinal),'[]') FROM (SELECT table_schema schema,table_name table,ordinal_position ordinal,column_name name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema IN ${scopes})x),
 'constraints',(SELECT coalesce(jsonb_agg(x ORDER BY x.schema,x.table,x.name),'[]') FROM (SELECT n.nspname schema,c.relname table,k.conname name,k.convalidated valid,pg_get_constraintdef(k.oid) definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ${scopes})x),
 'indexes',(SELECT coalesce(jsonb_agg(x ORDER BY x.schemaname,x.indexname),'[]') FROM (SELECT * FROM pg_indexes WHERE schemaname IN ${scopes})x),
 'functions',(SELECT coalesce(jsonb_agg(x ORDER BY x.schema,x.identity),'[]') FROM (SELECT n.nspname schema,p.oid::regprocedure::text identity,pg_get_functiondef(p.oid) definition,p.proacl::text acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ${scopes} AND p.prokind='f')x),
 'policies',(SELECT coalesce(jsonb_agg(x ORDER BY x.schemaname,x.tablename,x.policyname),'[]') FROM (SELECT * FROM pg_policies WHERE schemaname IN ${scopes})x),
 'triggers',(SELECT coalesce(jsonb_agg(x ORDER BY x.schema,x.table,x.name),'[]') FROM (SELECT n.nspname schema,c.relname table,t.tgname name,pg_get_triggerdef(t.oid) definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ${scopes} AND NOT t.tgisinternal)x),
 'table_acl',(SELECT coalesce(jsonb_agg(x ORDER BY x.schema,x.name),'[]') FROM (SELECT n.nspname schema,c.relname name,c.relrowsecurity rls,c.relacl::text acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ${scopes} AND c.relkind='r')x));`;
 return JSON.parse(await sql(query));
}
await sql("BEGIN; DROP SCHEMA IF EXISTS public,archive,vecs,vector CASCADE; CREATE SCHEMA public AUTHORIZATION postgres; GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role; COMMIT;");
await sql("BEGIN;"+schema+"\nCOMMIT;");
await sql("BEGIN;"+bank+"\nCOMMIT;");
const beforeTables=await tables(),beforeRows=await rows(beforeTables),beforeStructure=await structure();
const expected={exam_domains:29,question_generation_runs:165,questions:343,answers:1372,explanations:343};
for(const [name,count]of Object.entries(expected))assert.equal(beforeRows.find(t=>t.schema==="public"&&t.table===name).count,count);
const baseline=readFileSync("supabase/migrations/20261003000000_v2_baseline.sql","utf8");
await sql(baseline);
const afterTables=await tables(),afterRows=await rows(beforeTables),afterStructure=await structure();
assert.deepEqual(afterRows,beforeRows,"All original bank and legacy row counts and complete-row hashes must stay unchanged");
for(const old of beforeTables)assert.deepEqual(afterTables.find(t=>t.schema===old.schema&&t.name===old.name),old,"Existing tables retain names and OIDs: no drop/rename/recreate");
for(const key of ["columns","constraints","indexes","policies","triggers"]) {
 for(const old of beforeStructure[key])assert(afterStructure[key].some(now=>JSON.stringify(now)===JSON.stringify(old)),`Existing ${key} must be retained`);
}
for(const old of beforeStructure.functions) {
 const now=afterStructure.functions.find(f=>f.schema===old.schema&&f.identity===old.identity);
 assert(now,"Existing function must remain");assert.equal(now.definition,old.definition,"Existing function body/signature must remain");
 if(!old.identity.startsWith("upsert_question_answers("))assert.equal(now.acl,old.acl,"Unrelated function ACL must remain");
}
for(const old of beforeStructure.table_acl) {
 if(old.schema==="public"&&bankTables.includes(old.name))continue;
 assert.deepEqual(afterStructure.table_acl.find(t=>t.schema===old.schema&&t.name===old.name),old,"Legacy RLS/grants must remain unchanged");
}
const allAfterRows=await rows(afterTables);
await sql(baseline);
assert.deepEqual(await tables(),afterTables,"Replay keeps every table identity");
assert.deepEqual(await rows(afterTables),allAfterRows,"Replay keeps every row");
assert.deepEqual(await structure(),afterStructure,"Replay has no logical schema/policy/function/grant changes");
for(const role of ["anon","authenticated"]) {
 assert.equal(await sql(`SELECT has_function_privilege(${quote(role)},'public.upsert_question_answers(uuid,jsonb)','EXECUTE');`),"f","Legacy SECURITY DEFINER writer is denied");
 for(const name of ["exam_domains","question_generation_runs","questions","answers","explanations","session_items","free_practice_quota","webhook_events","pmle_pass_refunds"])
  assert.equal(await sql(`SELECT has_table_privilege(${quote(role)},${quote('public.'+name)},'SELECT') OR has_table_privilege(${quote(role)},${quote('public.'+name)},'INSERT') OR has_table_privilege(${quote(role)},${quote('public.'+name)},'UPDATE') OR has_table_privilege(${quote(role)},${quote('public.'+name)},'DELETE');`),"f");
}
const bankRls=JSON.parse(await sql("SELECT json_agg(x) FROM (SELECT c.relname name,c.relrowsecurity rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('exam_domains','question_generation_runs','questions','answers','explanations'))x;"));
assert(bankRls.every(t=>t.rls));
await sql("NOTIFY pgrst,'reload schema';");
const evidence={schemaFileSha256:sha(schema),bankFileSha256:sha(bank),baselineSha256:sha(baseline),beforeTables:beforeTables.length,afterTables:afterTables.length,firstApply:true,replay:true,rowPreservation:true,objectPreservation:true,rows:beforeRows.map(r=>({...r,afterCount:r.count,replayCount:r.count})),bankRls,legacyDataLoaded:false};
writeFileSync(outputPath,JSON.stringify(evidence,null,2));
console.log(JSON.stringify({firstApply:true,replay:true,originalTables:beforeTables.length,afterTables:afterTables.length,bankCounts:expected,evidence:outputPath}));
