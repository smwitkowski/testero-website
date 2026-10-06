# Testero PMLE Practice

Tools-only PMLE practice prototype: **three questions**, demo domains **1, 3,
and 6 only**, and possible repetitions. Not a full exam simulation. Scores stay
in the chat. Random opaque UUID question tokens live in server memory and expire
after one hour or a restart. The store holds at most 1,000 tokens; older tokens
can be evicted sooner. There is **no authentication** or persistent account
history; anyone who can reach the endpoint can use it.

## Package

```text
chatgpt-plugin/
├── plugin.json
├── mcp.json
├── package.json
├── package-lock.json
├── server.js
├── .gitignore
├── README.md
├── SAMPLE-TRANSCRIPT.md
├── data/demo-questions.json
├── test/server.test.js
└── skills/pmle-practice/
    ├── SKILL.md
    └── agents/openai.yaml
```

Root `plugin.json` and `mcp.json` use portable Agent Plugins schemas. The host
discovers `skills/` without a legacy manifest field. OpenAI presentation uses
`extensions.com.openai`; the optional `.codex-plugin/plugin.json` fallback is
omitted because the inline extension replaces that overlay, not merges with it.
No `.app.json` is needed without a registered `plugin_asdk_app...` mapping.

Both `mcp.json` and `skills/pmle-practice/agents/openai.yaml` contain the non-live
placeholder **`https://YOUR-TUNNEL-HOST/mcp`**. Replace **both URLs** before
installation. The MCP server key/dependency is `testero-pmle`; portable transport
is `streamable-http`, while the skill dependency uses `streamable_http`.
See [SAMPLE-TRANSCRIPT.md](./SAMPLE-TRANSCRIPT.md) for the intended chat flow.

## 1. Install, test, and run

From the repository root:

```bash
cd integrations/chatgpt-plugin
npm ci
npm test
npm start
```

Keep the server running on **8787**. The local endpoint is
`http://localhost:8787/mcp`. No environment file or credentials are required.

## 2. Check with MCP Inspector

In another terminal, run `npx @modelcontextprotocol/inspector@latest`.

1. Open its UI. Select **Streamable HTTP**, enter
   `http://localhost:8787/mcp`, and connect without server authentication.
2. List tools. Call `pmle_exam_overview` with `{}` for domains and exam format.
3. Call `get_practice_question` with `{}` or `{"domain":"1"}`. It returns a
   stem, A–D options, and `question_token`, without answer feedback.
4. Choose an option, then call `check_answer` with
   `{"question_token":"<returned token>","choice":"B"}`. Use the returned
   opaque token, not a fixture question ID. Do not assume B is correct.
5. Inspect `correct` (boolean), `chosen_option`, `correct_option`, and
   `diagnostic`. Each option object has `label`, `text`, `explanation`,
   `doc_url`, and `doc_quote`.
6. Try domain `"2"` and an invalid token to check useful errors.

`get_practice_question({domain?})` accepts an exact overview domain title,
a number 1–6 as a string, or a legacy code such as
`ARCHITECTING_LOW_CODE_ML_SOLUTIONS`. Omit `domain` for mixed practice. Only
1, 3, and 6 have demos. `check_answer({question_token,choice})` accepts A–D.

## 3. Open an HTTPS tunnel

With ngrok installed and configured, run `ngrok http 8787`. Copy its HTTPS URL
and append `/mcp`, for example `https://<your-tunnel-host>/mcp`. Keep the server
and tunnel running. ChatGPT cannot reach your machine's `localhost` URL.
A tunnel exposes this unauthenticated demo publicly: share the URL carefully
and stop it after testing. This is not production deployment or security.

## 4. Connect the tools in ChatGPT

1. Enable **Developer mode** in Settings → **Apps → Advanced settings** if
   available. Account access or workspace policy may hide these controls.
2. Open [ChatGPT Plugins](https://chatgpt.com/plugins), select the plus button,
   then **Add custom MCP server**.
3. Name it **Testero PMLE Demo**. Enter your HTTPS tunnel URL with `/mcp`.
   Select **No authentication** (or **None**). Do not select OAuth or add secrets.
4. Review the warning. Select **I understand and want to continue**, then
   **Create as a plugin**. Install the resulting connection.
5. Open a new chat, type `@`, and select it. Ask for the PMLE overview, then a
   domain 1 question. Choose A–D and ask it to check the answer.
6. Refresh the connection's detail page after server/tool changes. Update its
   URL if the tunnel address changes.

This connects **tools only**, not the repository's `pmle-practice` skill.

## 5. Install the local skill package

These are **manual user steps**. This prototype does not edit root `.agents`
or personal `~/.agents` configuration. Local marketplaces are separate from the
public directory; availability varies by client. Use the ChatGPT desktop app.

1. Replace both package HTTPS placeholders with your live tunnel `/mcp` URL.
   For local-only clients that can reach loopback, replace both with
   `http://localhost:8787/mcp` instead.
2. Manually add `.agents/plugins/marketplace.json` at the repository root.
   Merge into an existing catalog; do not overwrite unrelated entries:

   ```json
   {
     "name": "testero-local",
     "interface": {"displayName": "Testero Local"},
     "plugins": [{
       "name": "testero-pmle",
       "source": {"source": "local", "path": "./integrations/chatgpt-plugin"},
       "policy": {"installation": "AVAILABLE", "authentication": "ON_INSTALL"},
       "category": "Education"
     }]
   }
   ```

   `source.path` is relative to the **repository/marketplace root**, not
   `.agents/plugins/`. Marketplace policy is install metadata; the endpoint
   still has no authentication.
3. Restart the ChatGPT desktop app. Open Plugins Directory, choose
   **Testero Local**, then install/enable **Testero PMLE Practice**.
4. In a new chat with that package enabled, ask: “Use Testero PMLE Practice to
   quiz me one question at a time from domain 3.” Confirm it waits for your
   answer, grades only afterward, cites explanations, keeps score, and mentions
   the diagnostic once without a sales pitch.
5. After edits, update the catalog's source folder, restart the app, and
   refresh/reinstall if needed. Local installs use a cached copy.

Installing the package does **not** start the server or tunnel. A custom MCP
connection does **not** install the skill. Avoid enabling duplicate tool
connections in the same test chat.

## Official references

[Package your plugin](https://developers.openai.com/plugins/build/plugins) ·
[Build skills](https://developers.openai.com/plugins/build/skills) ·
[MCP quickstart](https://developers.openai.com/plugins/quickstart)

Local validation only: no publishing, production auth, or deployment is configured.
