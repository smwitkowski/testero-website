/** Local taxonomy verifier. Run through scripts/local.mjs verify-taxonomy-db.
 * Uses loopback PostgreSQL only; isolated fixtures roll back.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

const prodSchema = process.env.TESTERO_PROD_SCHEMA === "1";
if (process.env.TESTERO_PROD_SCHEMA && !prodSchema) throw new Error("TESTERO_PROD_SCHEMA must be 1 or unset");
if (prodSchema) {
  if (!/project_id\s*=\s*"testero-v2"/.test(readFileSync("supabase/config.toml", "utf8"))) throw new Error("Expected isolated testero-v2 project");
  if (readdirSync(".").some(name => name.startsWith(".env") && name !== ".env.example")) throw new Error("Prod-schema verifier refuses credential env files");
}

const urlText = process.env.DATABASE_URL;
if (!urlText) throw new Error("Provide a LOCAL DATABASE_URL explicitly");
const url = new URL(urlText);
if (!["postgres:", "postgresql:"].includes(url.protocol)
    || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    || url.port !== "56542" || url.search || url.pathname !== "/postgres") {
  throw new Error("Only loopback PostgreSQL port56542/database postgres is permitted; no URL query overrides");
}
const env = { ...process.env, PGHOST: url.hostname.replace(/[\[\]]/g, ""), PGPORT: url.port,
  PGDATABASE: "postgres", PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: "disable" };
// Defeat environment-based service/host overrides; never invoke a shell.
for (const key of ["PGSERVICE", "PGSERVICEFILE", "PGHOSTADDR", "PGOPTIONS", "PGPASSFILE"]) delete env[key];
function run(sql, allowFailure = false) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"], { env, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", error = "";
    child.stdout.on("data", (part) => { output += part; });
    child.stderr.on("data", (part) => { error += part; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 && !allowFailure) reject(new Error(`Local SQL failed: ${error}`));
      else resolve({ code, output: output.trim(), error });
    });
    child.stdin.end(sql);
  });
}
const q = (text) => "'" + String(text).replaceAll("'", "''") + "'";
const scalar = async (sql) => (await run(sql)).output;
async function denied(sql, reason) {
  const result = await run(sql, true);
  assert.notEqual(result.code, 0, reason);
}

// All fixtures and successful writes roll back, including restored-bank mode.
const fixture = `
 INSERT INTO public.question_taxonomy(dimension,value_key,label,definition,cert_scope) VALUES
 ('taxonomy_test','one','One','Isolated test','{}'),
 ('taxonomy_test','two','Two','Isolated test','{}'),
 ('taxonomy_test','inactive','Inactive','Isolated test','{}'),
 ('taxonomy_test','other_cert','Other','Isolated test',ARRAY['cloud-engineer']);
 UPDATE public.question_taxonomy SET active=false WHERE dimension='taxonomy_test' AND value_key='inactive';
 INSERT INTO public.questions(id,exam,domain_id,stem,status)
 SELECT '11111111-1234-4321-8765-111111111111','GCP_PM_ML_ENG',id,'Taxonomy test','DRAFT'
 FROM public.exam_domains WHERE exam='GCP_PM_ML_ENG' ORDER BY id LIMIT 1;
`;
const id = '11111111-1234-4321-8765-111111111111';
const tag = (key, confidence = 0.9) => ({ dimension:'taxonomy_test', value_key:key, confidence });
const rpc = (source, tags) => `SELECT public.replace_question_tags('${id}',${q(source)},${q(JSON.stringify(tags))}::jsonb);`;
const transaction = sql => `BEGIN; ${fixture} SET LOCAL ROLE service_role; ${sql} ROLLBACK;`;
for (const role of ['anon','authenticated']) {
 for (const table of ['question_tags','question_taxonomy']) {
  await denied(`BEGIN; SET LOCAL ROLE ${role}; SELECT * FROM public.${table}; ROLLBACK;`, `${role} table denied`);
 }
 assert.equal(await scalar(`SELECT has_function_privilege('${role}','public.replace_question_tags(uuid,text,jsonb)','EXECUTE');`),'f');
}
assert.equal(await scalar(`SELECT count(*) FROM pg_class WHERE oid IN ('public.question_tags'::regclass,'public.question_taxonomy'::regclass) AND relrowsecurity;`),'2');
await denied(transaction(`INSERT INTO public.question_tags(question_id,dimension,value_key,source,confidence) VALUES ('${id}','taxonomy_test','one','backfill',0.9);`),'service direct write denied');
await run(transaction(`
 ${rpc('backfill',[tag('one'),tag('two')])}
 ${rpc('backfill',[tag('one')])}
 DO $$ BEGIN
 IF (SELECT count(*) FROM public.question_tags WHERE question_id='${id}') <> 1 THEN RAISE EXCEPTION 'stale tags retained'; END IF;
 END $$;
 CREATE TEMP TABLE tag_snapshot AS SELECT * FROM public.question_tags WHERE question_id='${id}';
 ${rpc('backfill',[tag('one')])}
 DO $$ BEGIN
 IF EXISTS ((SELECT * FROM public.question_tags WHERE question_id='${id}' EXCEPT SELECT * FROM tag_snapshot)
 UNION ALL (SELECT * FROM tag_snapshot EXCEPT SELECT * FROM public.question_tags WHERE question_id='${id}')) THEN
 RAISE EXCEPTION 'retry changed rows'; END IF;
 END $$;
 ${rpc('generation',[tag('two',1)])}
 DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.question_tags WHERE question_id='${id}' AND value_key='two' AND source='generation')
 OR EXISTS (SELECT 1 FROM public.question_tags WHERE question_id='${id}' AND source='backfill') THEN
 RAISE EXCEPTION 'sources mixed'; END IF;
 END $$;
 ${rpc('generation',[])}
 DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.question_tags WHERE question_id='${id}') THEN RAISE EXCEPTION 'clear failed'; END IF; END $$;
`));
for (const invalid of [[tag('missing')],[tag('inactive')],[tag('other_cert')],[tag('one',-0.1)],[tag('one',1.1)],[tag('one'),tag('one')],[{...tag('one'),confidence:null}],[{...tag('one'),extra:true}]]) {
 await denied(transaction(`${rpc('backfill',[tag('one')])} ${rpc('backfill',invalid)}`),'invalid replacement rejected');
}
await denied(transaction(`${rpc('generation',[tag('one')])} ${rpc('backfill',[tag('two')])}`),'backfill cannot overwrite generation');
// Catch an RPC error in a subtransaction and prove it did not delete the old set.
await run(transaction(`
 ${rpc('backfill',[tag('one')])}
 DO $$ BEGIN
 BEGIN
  PERFORM public.replace_question_tags('${id}','backfill','[{"dimension":"taxonomy_test","value_key":"missing","confidence":1}]'::jsonb);
  RAISE EXCEPTION 'unexpected success';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 IF (SELECT count(*) FROM public.question_tags WHERE question_id='${id}' AND value_key='one') <> 1 THEN
 RAISE EXCEPTION 'failed replacement changed tags'; END IF;
 END $$;
`));
console.log('PASS taxonomy permissions, replacement, retry, validation, source precedence and rollback');
