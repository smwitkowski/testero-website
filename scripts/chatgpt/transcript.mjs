const SAFE_FIELDS = new Set(["$schema","_meta","additionalProperties","annotations","approximate","arguments","authenticated","available_questions","capabilities","challenge_unset_status","client","clientInfo","command","content","correct_option","description","destructiveHint","disclaimer","domain","domains","duration_minutes","endpoint","enum","error","exam","exam_id","exchanges","execution","explanation","format","guide_as_of","id","idempotentHint","informational_link","inputSchema","instructions","isError","is_correct","jsonrpc","label","languages","listChanged","max","maxLength","method","min","minLength","name","number","openWorldHint","options","params","pattern","practice_selection_size","production_writes","properties","protocolVersion","protocol_version","question_count","question_id","question_types","readOnlyHint","recommended_experience","recorded_at","redaction","request","required","response","result","sampling_weight","scope","securitySchemes","selected_label","serverInfo","guide_retrieved_at","certification_page_retrieved_at","recommended_experience_retrieved_at","status","stem","structuredContent","taskSupport","text","title","tools","total_questions","type","version","weight_note"]);
const TOOL_NAMES = new Set(["exam_overview", "list_practice_domains", "get_practice_question", "check_answer", "testero-local-mcp-smoke", "testero"]);
const TYPES = new Set(["object", "string", "boolean", "array", "number", "integer", "null", "text"]);
const METHODS = new Set(["initialize", "notifications/initialized", "tools/list", "tools/call", "POST", "GET", "DELETE", "OPTIONS"]);

/** Public evidence retains structure, never question text, answer labels, IDs or explanations. */
export function redactMcpStructure(value, key = "") {
  if (Array.isArray(value)) return value.map(item => redactMcpStructure(item, key));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item], index) => {
    const field = SAFE_FIELDS.has(name) || /^\[redacted field \d+\]$/.test(name) ? name : `[redacted field ${index + 1}]`;
    return [field, redactMcpStructure(item, name)];
  }));
  if (typeof value !== "string") return value;
  // MCP text content mirrors structuredContent as serialized JSON. Redact inside that string too.
  if (key === "text") {
    try { return JSON.stringify(redactMcpStructure(JSON.parse(value))); }
    catch { return "[redacted string]"; }
  }
  if (key === "method" && METHODS.has(value)) return value;
  if (key === "name" && TOOL_NAMES.has(value)) return value;
  if (key === "type" && TYPES.has(value)) return value;
  if (key === "jsonrpc" && value === "2.0") return value;
  if (["protocolVersion", "protocol_version"].includes(key) && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (key === "client" && value === "@modelcontextprotocol/sdk") return value;
  if (key === "command" && ["npm run qa:local", "npm run qa:local -- --mcp-smoke"].includes(value)) return value;
  if (key === "recorded_at" && /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(value)) return value;
  if (key === "endpoint" && /^http:\/\/(?:127\.0\.0\.1|localhost):\d+\/api\/mcp$/.test(value)) return value;
  return "[redacted string]";
}
export function publicMcpTranscript(transcript) {
  return { ...redactMcpStructure(transcript), redaction: {
    scope: "Structure only. Question content, IDs, answer labels and explanations are redacted, including serialized MCP text content.",
  } };
}
