#!/usr/bin/env node
// MCP server (Streamable HTTP, stateless) — tool: search_deals
// เปิด: npm run mcp   → http://localhost:3000/mcp
import express from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data", "deals.json");
const PORT = Number(process.env.PORT || 3000);

// ค้นหาแบบไม่สนตัวพิมพ์/เครื่องหมาย (เหมือนหน้าเว็บ): "assassin's" เจอ "Assassins"
const norm = (x) => String(x).toLowerCase().replace(/['’]/g, "").replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();

// ช่องว่างล้วน/ไม่ส่ง = ไม่กรอง; มีข้อความแต่ normalize แล้วว่าง (เช่น "!!!") = ไม่ตรงอะไรเลย (D3)
const filterTerm = (x) => (x == null || String(x).trim() === "" ? null : norm(x));

// ร้าน: ตรง store_id พอดี หรือชื่อร้านขึ้นต้นด้วยคำที่ค้นแบบครบคำ (D4)
// "epic" / "epic games" → Epic Games Store, "25" → store 25, แต่ "e" ไม่ตรงทุกร้านที่มีตัว e
function storeMatches(d, raw, s) {
  if (s === "") return false;
  if (d.store_id === String(raw).trim()) return true;
  const name = norm(d.store_name);
  return name === s || name.startsWith(s + " ");
}

export async function searchDeals({ query, store, max_price_thb, min_savings, sort = "savings", limit = 10 } = {}) {
  const data = JSON.parse(await readFile(DATA, "utf8"));
  const q = filterTerm(query);
  const s = filterTerm(store);
  let rows = data.deals.filter((d) =>
    (q === null || (q !== "" && norm(d.title).includes(q))) &&
    (s === null || storeMatches(d, store, s)) &&
    (max_price_thb == null || d.sale_thb <= max_price_thb) &&
    (min_savings == null || d.savings_percent >= min_savings)
  );
  const cmp = {
    savings: (a, b) => b.savings_percent - a.savings_percent || a.sale_thb - b.sale_thb,
    price: (a, b) => a.sale_thb - b.sale_thb || b.savings_percent - a.savings_percent,
    rating: (a, b) => b.deal_rating - a.deal_rating || b.savings_percent - a.savings_percent,
  }[sort];
  rows.sort(cmp);
  const total = rows.length;
  rows = rows.slice(0, limit).map((d) => ({
    title: d.title, store_name: d.store_name, game_id: d.game_id,
    sale_thb: d.sale_thb, normal_thb: d.normal_thb, savings_percent: d.savings_percent,
    sale_usd: d.sale_usd, normal_usd: d.normal_usd, is_free: d.is_free, cheapshark_url: d.cheapshark_url,
  }));
  return {
    total_matches: total,
    fx: data.fx,
    generated_at: data.generated_at,
    deals: rows,
  };
}

function buildServer() {
  const server = new McpServer({ name: "inblack-c-deals", version: "1.0.0" });
  server.registerTool(
    "search_deals",
    {
      title: "ค้นหาดีลเกม (ราคาบาท)",
      description:
        "ค้นหาดีลเกมลดราคาจาก data/deals.json (CheapShark, แปลงเป็นบาทด้วยอัตรา Frankfurter). กรองด้วยชื่อเกม ร้าน ราคาบาทสูงสุด หรือส่วนลดขั้นต่ำ แล้วเรียงตามส่วนลด ราคา หรือ dealRating",
      inputSchema: {
        query: z.string().optional().describe("คำในชื่อเกม (ไม่สนตัวพิมพ์)"),
        store: z.string().optional().describe("store_id หรือชื่อร้าน (ตรงทั้งชื่อหรือคำขึ้นต้นครบคำ) เช่น GOG, Epic, 25"),
        max_price_thb: z.number().nonnegative().optional().describe("ราคาลดสูงสุด (บาท)"),
        min_savings: z.number().min(0).max(100).optional().describe("ส่วนลดขั้นต่ำ (%)"),
        sort: z.enum(["savings", "price", "rating"]).optional().describe("เรียงตาม: savings (ค่าเริ่มต้น), price, rating"),
        limit: z.number().int().min(1).max(20).optional().describe("จำนวนผลลัพธ์ (1–20, ค่าเริ่มต้น 10)"),
      },
    },
    async (args) => {
      const result = await searchDeals(args);
      const lines = result.deals.map(
        (d, i) => `${i + 1}. ${d.title} — ${d.store_name}: ${d.is_free ? "ฟรี" : `฿${d.sale_thb.toFixed(2)}`} (ปกติ ฿${d.normal_thb.toFixed(2)}, ลด ${d.savings_percent}%) ${d.cheapshark_url}`
      );
      const head = `พบ ${result.total_matches} ดีล (อัตรา 1 USD = ${result.fx.rate} THB ณ ${result.fx.rate_date})`;
      return {
        content: [{ type: "text", text: [head, ...lines].join("\n") }],
        structuredContent: result,
      };
    }
  );
  return server;
}

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
  }
});
const notAllowed = (_req, res) =>
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server)" }, id: null });
app.get("/mcp", notAllowed);
app.delete("/mcp", notAllowed);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(PORT, "127.0.0.1", () => console.log(`MCP server (Streamable HTTP) → http://localhost:${PORT}/mcp`));
}
