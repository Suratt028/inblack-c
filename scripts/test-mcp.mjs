#!/usr/bin/env node
// ทดสอบ MCP server ที่รันอยู่: initialize → ping → tools/list → tools/call search_deals
// ผลลัพธ์ดิบทั้งหมดเขียนลง AGENT_LOG/mcp-test.log เพื่อเป็นหลักฐาน
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_ = process.env.MCP_URL || "http://localhost:3000/mcp";
const log = [];
let id = 0;

async function rpc(method, params, { notify = false } = {}) {
  const body = notify ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id: ++id, method, params };
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  if (text) {
    const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
    parsed = JSON.parse(dataLine ? dataLine.slice(6) : text);
  }
  log.push(`>>> ${JSON.stringify(body)}\n<<< HTTP ${res.status} ${parsed ? JSON.stringify(parsed) : "(empty)"}`);
  return { status: res.status, body: parsed };
}

const results = [];
const step = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };

const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "inblack-c-test", version: "1.0.0" } });
step("server-initialize", init.status === 200 && init.body?.result?.serverInfo?.name === "inblack-c-deals", `${init.body?.result?.serverInfo?.name} protocol ${init.body?.result?.protocolVersion}`);
await rpc("notifications/initialized", {}, { notify: true });

const ping = await rpc("ping", {});
step("ping", ping.status === 200 && ping.body?.result && Object.keys(ping.body.result).length === 0);

const list = await rpc("tools/list", {});
const names = list.body?.result?.tools?.map((t) => t.name) ?? [];
step("tools-list", names.includes("search_deals"), names.join(", "));

const call = await rpc("tools/call", { name: "search_deals", arguments: { query: "edition", max_price_thb: 250, sort: "price", limit: 3 } });
const sc = call.body?.result?.structuredContent;
step("tools-call search_deals", !!sc && sc.deals.length > 0 && sc.deals.every((d) => d.sale_thb <= 250), `${sc?.total_matches} matches, first: ${sc?.deals?.[0]?.title}`);

await writeFile(path.join(ROOT, "AGENT_LOG", "mcp-test.log"), `# MCP test ${new Date().toISOString()} → ${URL_}\n\n${log.join("\n\n")}\n`);
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
