import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHttpServer } from '../server.js';

const { questions } = JSON.parse(await readFile(new URL('../data/demo-questions.json', import.meta.url), 'utf8'));
const labels = ['A', 'B', 'C', 'D'];
const diagnostic = 'Get a full readiness diagnostic at https://testero.ai/diagnostic';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function start(t) {
  const server = createHttpServer();
  assert.ok(server instanceof Server, 'factory must return a node http.Server');
  assert.equal(server.listening, false, 'factory/import must not start listening');
  const resources = [];
  t.after(async () => {
    try {
      for (const { client, transport } of resources.reverse()) {
        try { await client.close(); } finally { await transport.close(); }
      }
    } finally {
      const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      server.closeAllConnections();
      await closed;
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = new Client({ name: 'testero-integration-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`));
  resources.push({ client, transport });
  await client.connect(transport);
  return { server, client, base };
}

function payload(result) {
  assert.notEqual(result.isError, true, JSON.stringify(result));
  assert.ok(result.structuredContent && typeof result.structuredContent === 'object');
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, 'text');
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent,
    'text JSON and structuredContent must contain the same payload');
  return result.structuredContent;
}

function exactKeys(value, keys) {
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
}

async function overview(client) {
  return payload(await client.callTool({ name: 'pmle_exam_overview', arguments: {} }));
}

function assertPublicQuestion(result, demo, domain) {
  const question = payload(result);
  exactKeys(question, ['question_token', 'domain', 'stem', 'options']);
  assert.match(question.question_token, uuid);
  assert.equal(question.domain, domain.title);
  assert.equal(question.stem, demo.stem);
  assert.deepEqual(question.options.map(option => option.label), labels);
  assert.deepEqual(question.options.map(option => option.text).sort(), demo.options.map(option => option.text).sort());
  for (const option of question.options) exactKeys(option, ['label', 'text']);

  // Inspect the whole tool result, including text content and any extra envelopes.
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /"(?:correct|answer|correct_option|chosen_option|explanation|doc_url|doc_quote|id|objective_id|objective|domain_code)"\s*:/);
  for (const approved of questions) {
    for (const forbidden of [approved.id, approved.objective_id, approved.objective,
      ...approved.options.flatMap(option => [option.explanation, option.doc_url, option.doc_quote])]) {
      assert.ok(!serialized.includes(JSON.stringify(forbidden).slice(1, -1)), `get_practice_question leaked private data: ${forbidden}`);
    }
  }
  return question;
}

function assertGrading(result, question, chosenText, demo) {
  const answer = payload(result);
  exactKeys(answer, ['correct', 'chosen_option', 'correct_option', 'diagnostic']);
  assert.equal(typeof answer.correct, 'boolean');
  const chosen = demo.options.find(option => option.text === chosenText);
  const correct = demo.options.find(option => option.correct);
  assert.equal(answer.correct, chosen.correct);
  assert.equal(answer.diagnostic, diagnostic);
  for (const [key, approved] of [['chosen_option', chosen], ['correct_option', correct]]) {
    const displayed = question.options.find(option => option.text === approved.text);
    exactKeys(answer[key], ['label', 'text', 'explanation', 'doc_url', 'doc_quote']);
    assert.deepEqual(answer[key], {
      label: displayed.label, text: approved.text, explanation: approved.explanation,
      doc_url: approved.doc_url, doc_quote: approved.doc_quote,
    });
  }
}

async function expectToolError(client, name, args, messagePattern) {
  let result;
  try {
    result = await client.callTool({ name, arguments: args });
  } catch (error) {
    // Invalid arguments may use the MCP InvalidParams protocol error.
    assert.equal(error.code, -32602, `unexpected transport/server failure: ${error}`);
    if (messagePattern) assert.match(error.message, messagePattern);
    return;
  }
  assert.equal(result.isError, true, JSON.stringify(result));
  if (messagePattern) assert.match(JSON.stringify(result), messagePattern);
  assert.ok(!result.structuredContent?.question_token, 'error must not invent a practice question');
  for (const demo of questions) assert.ok(!JSON.stringify(result).includes(demo.stem));
}

test('SDK lists exactly three tools with constrained answer choices and complete exam overview', async t => {
  const { client } = await start(t);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(),
    ['check_answer', 'get_practice_question', 'pmle_exam_overview']);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, 'object');
    assert.ok(tool.description?.length);
  }
  const checkSchema = tools.find(tool => tool.name === 'check_answer').inputSchema;
  assert.deepEqual(checkSchema.properties.choice.enum, labels);
  assert.ok(checkSchema.required.includes('question_token'));
  assert.ok(checkSchema.required.includes('choice'));
  const exam = await overview(client);
  exactKeys(exam, ['guide_url', 'guide_as_of', 'domains', 'format', 'weight_note']);
  assert.equal(exam.guide_url, 'https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf');
  assert.equal(exam.guide_as_of, '2026-06-01');
  assert.deepEqual(exam.domains, [
    { number: 1, title: 'Architecting low-code AI solutions', weight_percent: 13, domain_code: 'ARCHITECTING_LOW_CODE_ML_SOLUTIONS' },
    { number: 2, title: 'Collaborating within and across teams to manage data and models', weight_percent: 16, domain_code: 'COLLABORATING_TO_MANAGE_DATA_AND_MODELS' },
    { number: 3, title: 'Scaling prototypes into ML models', weight_percent: 21, domain_code: 'SCALING_PROTOTYPES_INTO_ML_MODELS' },
    { number: 4, title: 'Serving and scaling models', weight_percent: 20, domain_code: 'SERVING_AND_SCALING_MODELS' },
    { number: 5, title: 'Automating and orchestrating ML pipelines', weight_percent: 18, domain_code: 'AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES' },
    { number: 6, title: 'Monitoring AI solutions', weight_percent: 13, domain_code: 'MONITORING_ML_SOLUTIONS' },
  ]);
  assert.equal(exam.domains.reduce((sum, domain) => sum + domain.weight_percent, 0), 101);
  assert.equal(new Set(exam.domains.map(domain => domain.title)).size, 6);
  assert.equal(new Set(exam.domains.map(domain => domain.domain_code)).size, 6);
  for (const domain of exam.domains) {
    exactKeys(domain, ['number', 'title', 'weight_percent', 'domain_code']);
    assert.equal(typeof domain.title, 'string');
    assert.ok(domain.title.length);
    assert.equal(typeof domain.domain_code, 'string');
    assert.ok(Number.isInteger(domain.weight_percent) && domain.weight_percent > 0 && domain.weight_percent < 100);
  }
  exactKeys(exam.format, ['question_count_min', 'question_count_max', 'duration_minutes', 'question_types']);
  assert.equal(exam.format.question_count_min, 50);
  assert.equal(exam.format.question_count_max, 60);
  assert.equal(exam.format.duration_minutes, 120);
  assert.deepEqual(exam.format.question_types, ['multiple_choice', 'multiple_select']);
  assert.ok(exam.format.question_types.every(value => typeof value === 'string' && value.length > 0));
  assert.equal(typeof exam.weight_note, 'string');
  assert.match(exam.weight_note, /approximate/i);
  assert.match(exam.weight_note, /101%/);
  assert.match(exam.weight_note, /rounding/i);
  assert.match(exam.weight_note, /not normalized/i);
});

test('all approved demos grade every option by shuffled text, and tokens remain reusable', async t => {
  const { client } = await start(t);
  const exam = await overview(client);
  for (const demo of questions) {
    const domain = exam.domains.find(item => item.domain_code === demo.domain_code);
    assert.ok(domain, `approved domain ${demo.domain_code} must exist`);
    const result = await client.callTool({ name: 'get_practice_question', arguments: { domain: domain.title } });
    const question = assertPublicQuestion(result, demo, domain);
    // Check a correct answer, all distractors, then the correct answer again with one token.
    const correct = demo.options.find(option => option.correct);
    const sequence = [correct, ...demo.options.filter(option => !option.correct), correct];
    for (const approved of sequence) {
      const choice = question.options.find(option => option.text === approved.text).label;
      assertGrading(await client.callTool({ name: 'check_answer', arguments: {
        question_token: question.question_token, choice,
      } }), question, approved.text, demo);
    }
  }
});

test('domain titles, number strings, and legacy codes filter all available domains', async t => {
  const { client } = await start(t);
  const exam = await overview(client);
  assert.deepEqual(questions.map(demo => Number(demo.objective_id.split('.')[0])).sort(), [1, 3, 6]);
  for (const demo of questions) {
    const domain = exam.domains.find(item => item.domain_code === demo.domain_code);
    for (const filter of [domain.title, String(domain.number), demo.domain_code]) {
      assertPublicQuestion(await client.callTool({ name: 'get_practice_question', arguments: { domain: filter } }), demo, domain);
    }
  }
  for (const domain of exam.domains.filter(item => [2, 4, 5].includes(item.number))) {
    for (const filter of [domain.title, String(domain.number), domain.domain_code]) {
      await expectToolError(client, 'get_practice_question', { domain: filter }, /demo|available|question/i);
    }
  }
  for (const filter of ['NOT_A_DOMAIN', '7', '0']) {
    await expectToolError(client, 'get_practice_question', { domain: filter }, /domain|unknown|invalid/i);
  }
  // No filter may select only approved data, never a fabricated question.
  const result = await client.callTool({ name: 'get_practice_question', arguments: {} });
  const demo = questions.find(item => item.stem === payload(result).stem);
  assert.ok(demo);
  assertPublicQuestion(result, demo, exam.domains.find(item => item.domain_code === demo.domain_code));
});

test('repeated calls use fresh UUIDs and shuffle/relabel approved option text', async t => {
  const { client } = await start(t);
  const exam = await overview(client);
  const tokens = new Set();
  for (const demo of questions) {
    const domain = exam.domains.find(item => item.domain_code === demo.domain_code);
    const permutations = new Set();
    const correctLabels = new Set();
    for (let index = 0; index < 24; index++) {
      const result = await client.callTool({ name: 'get_practice_question', arguments: { domain: String(domain.number) } });
      const question = assertPublicQuestion(result, demo, domain);
      assert.ok(!tokens.has(question.question_token), 'each call needs a new token');
      tokens.add(question.question_token);
      permutations.add(JSON.stringify(question.options.map(option => option.text)));
      const approved = demo.options.find(option => option.correct);
      const choice = question.options.find(option => option.text === approved.text).label;
      correctLabels.add(choice);
      assertGrading(await client.callTool({ name: 'check_answer', arguments: {
        question_token: question.question_token, choice,
      } }), question, approved.text, demo);
    }
    assert.ok(permutations.size > 1, 'option order must vary across calls');
    assert.ok(correctLabels.size > 1, 'correct answer must not keep a fixed label');
  }
});

test('invalid choices, missing arguments, and unknown tokens are rejected without consuming a valid token', async t => {
  const { client } = await start(t);
  const exam = await overview(client);
  const demo = questions[0];
  const domain = exam.domains.find(item => item.domain_code === demo.domain_code);
  const question = assertPublicQuestion(await client.callTool({ name: 'get_practice_question', arguments: { domain: '1' } }), demo, domain);
  for (const choice of ['E', 'a', '', 1, null]) {
    await expectToolError(client, 'check_answer', { question_token: question.question_token, choice });
  }
  await expectToolError(client, 'check_answer', { question_token: question.question_token });
  await expectToolError(client, 'check_answer', { choice: 'A' });
  await expectToolError(client, 'check_answer', { question_token: randomUUID(), choice: 'A' }, /token|expired|unknown|question/i);
  await expectToolError(client, 'check_answer', { question_token: 'not-a-token', choice: 'A' });
  const approved = demo.options.find(option => option.correct);
  const choice = question.options.find(option => option.text === approved.text).label;
  assertGrading(await client.callTool({ name: 'check_answer', arguments: {
    question_token: question.question_token, choice,
  } }), question, approved.text, demo);
});

test('tokens are isolated between two server instances (restart has no stored tokens)', async t => {
  const first = await start(t);
  const second = await start(t);
  const exam = await overview(first.client);
  const demo = questions[0];
  const domain = exam.domains.find(item => item.domain_code === demo.domain_code);
  const questionsByServer = [];
  for (const { client } of [first, second]) {
    questionsByServer.push(assertPublicQuestion(await client.callTool({ name: 'get_practice_question', arguments: { domain: '1' } }), demo, domain));
  }
  assert.notEqual(questionsByServer[0].question_token, questionsByServer[1].question_token);
  for (const [owner, other, question] of [[first, second, questionsByServer[0]], [second, first, questionsByServer[1]]]) {
    const approved = demo.options.find(option => option.correct);
    const choice = question.options.find(option => option.text === approved.text).label;
    await expectToolError(other.client, 'check_answer', { question_token: question.question_token, choice }, /token|expired|unknown|question/i);
    assertGrading(await owner.client.callTool({ name: 'check_answer', arguments: {
      question_token: question.question_token, choice,
    } }), question, approved.text, demo);
  }
});

test('tokens work until the one-hour boundary, then expire without resurrection', async t => {
  const { client } = await start(t);
  const exam = await overview(client);
  const demo = questions[0];
  const domain = exam.domains.find(item => item.domain_code === demo.domain_code);
  const issuedAt = Date.now();
  let now = issuedAt;
  const clock = t.mock.method(Date, 'now', () => now);
  try {
    const question = assertPublicQuestion(await client.callTool({
      name: 'get_practice_question', arguments: { domain: '1' },
    }), demo, domain);
    const approved = demo.options.find(option => option.correct);
    const args = {
      question_token: question.question_token,
      choice: question.options.find(option => option.text === approved.text).label,
    };
    for (const age of [0, 60 * 60 * 1000 - 1]) {
      now = issuedAt + age;
      assertGrading(await client.callTool({ name: 'check_answer', arguments: args }), question, approved.text, demo);
    }
    now = issuedAt + 60 * 60 * 1000;
    await expectToolError(client, 'check_answer', args, /expired|token/i);
    now = issuedAt;
    await expectToolError(client, 'check_answer', args, /expired|unknown|token/i);
    // Expiry does not prevent issuing and grading a fresh question.
    const fresh = assertPublicQuestion(await client.callTool({
      name: 'get_practice_question', arguments: { domain: '1' },
    }), demo, domain);
    assert.notEqual(fresh.question_token, question.question_token);
    assertGrading(await client.callTool({ name: 'check_answer', arguments: {
      question_token: fresh.question_token,
      choice: fresh.options.find(option => option.text === approved.text).label,
    } }), fresh, approved.text, demo);
  } finally {
    clock.mock.restore();
  }
});

test('HTTP root, unknown routes, OAuth discovery, and CORS preflight', async t => {
  const { base } = await start(t);
  const root = await fetch(base);
  assert.equal(root.status, 200);
  assert.ok((await root.text()).length > 0);
  for (const path of ['/not-a-route', '/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, `${path} must not expose OAuth endpoints`);
    await response.text();
  }
  const unsupported = await fetch(`${base}/mcp`, { method: 'PUT' });
  assert.equal(unsupported.status, 405);
  assert.match(unsupported.headers.get('allow'), /POST/);
  await unsupported.text();
  const preflight = await fetch(`${base}/mcp`, {
    method: 'OPTIONS', headers: {
      Origin: 'https://chatgpt.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,mcp-session-id,mcp-protocol-version',
    },
  });
  assert.equal(preflight.status, 204);
  assert.ok(['*', 'https://chatgpt.com'].includes(preflight.headers.get('access-control-allow-origin')));
  assert.match(preflight.headers.get('access-control-allow-methods'), /POST/i);
  for (const header of ['content-type', 'mcp-session-id', 'mcp-protocol-version']) {
    assert.ok(preflight.headers.get('access-control-allow-headers')?.toLowerCase().includes(header), `preflight must allow ${header}`);
  }
  await preflight.text();
});
