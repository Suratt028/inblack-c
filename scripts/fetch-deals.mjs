#!/usr/bin/env node
// ดึงดีลเกมจริงจาก CheapShark + อัตรา USD→THB จาก Frankfurter แล้วเขียน data/deals.json (20 ดีล)
//
// ใช้คำขอทั้งหมด 3 ครั้ง (เพดาน 5 ครั้งตามโจทย์ บังคับด้วย MAX_REQUESTS):
//   1) CheapShark /stores   — ชื่อร้าน + สถานะเปิด/ปิด
//   2) CheapShark /deals    — ดีล 60 รายการ (เผื่อกรองทิ้ง)
//   3) Frankfurter /latest  — อัตรา USD→THB
// ถ้าได้ 429 จะหยุดรอตาม Retry-After แล้วลองใหม่ (นับเป็นคำขอด้วย)
//
// ใช้งาน:
//   node scripts/fetch-deals.mjs              ดึงจาก API จริง แล้วเก็บ raw ไว้ใน data/raw/<วันที่>/
//   node scripts/fetch-deals.mjs --from-raw   สร้าง deals.json ใหม่จาก raw ล่าสุด (ไม่ยิง API)

import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "./lib/transform.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const OUT = path.join(ROOT, "data", "deals.json");

export const USER_AGENT = "inblack-c-thb-deals/1.0 (game deals in THB; contact via GitHub repo inblack-c)";
const MAX_REQUESTS = 5;
const URLS = {
  stores: "https://www.cheapshark.com/api/1.0/stores",
  deals: "https://www.cheapshark.com/api/1.0/deals?onSale=1&pageSize=60&sortBy=Deal%20Rating",
  fx: "https://api.frankfurter.dev/v1/latest?base=USD&symbols=THB",
};

let requestCount = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (;;) {
    if (requestCount >= MAX_REQUESTS) throw new Error(`เกินเพดาน ${MAX_REQUESTS} คำขอ — หยุด`);
    requestCount++;
    console.log(`[req ${requestCount}/${MAX_REQUESTS}] GET ${url}`);
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (res.status === 429) {
      const ra = res.headers.get("retry-after");
      const secs = retryAfterSeconds(ra);
      console.warn(`  429 Too Many Requests — รอ ${secs}s ตาม Retry-After`);
      await sleep(secs * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return res.json();
  }
}

// Retry-After เป็นวินาทีหรือ HTTP-date; ไม่มี header/อ่านไม่ได้ → รอ 60 วินาที
// (เดิม Number(null) = 0 ทำให้ header หายแล้วยิงซ้ำทันที และวันที่ในอดีตกลับได้ 60 แทน 0)
export function retryAfterSeconds(ra, now = Date.now()) {
  const v = (ra ?? "").trim();
  if (/^\d+$/.test(v)) return Number(v);
  const t = /[a-z]/i.test(v) ? Date.parse(v) : NaN; // HTTP-date มีชื่อวัน/เดือนเสมอ; V8 อ่าน "120" เป็นปี 120
  return Number.isFinite(t) ? Math.max(0, (t - now) / 1000) : 60;
}

// เวลาท้องถิ่นไทย (+07:00) แบบ ISO
export function bangkokIso(d = new Date()) {
  const t = new Date(d.getTime() + 7 * 3600e3);
  return t.toISOString().replace(/\.\d{3}Z$/, "+07:00");
}

async function latestRawDir() {
  const dirs = (await readdir(RAW_DIR, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  if (!dirs.length) throw new Error("ไม่มี data/raw/* — รันแบบดึงจริงก่อน");
  return path.join(RAW_DIR, dirs.at(-1));
}

async function main() {
  const fromRaw = process.argv.includes("--from-raw");
  let raw;
  if (fromRaw) {
    const dir = await latestRawDir();
    console.log(`อ่าน raw จาก ${path.relative(ROOT, dir)}`);
    raw = JSON.parse(await readFile(path.join(dir, "responses.json"), "utf8"));
  } else {
    const fetchedAt = bangkokIso();
    const stores = await getJson(URLS.stores);
    const deals = await getJson(URLS.deals);
    const fx = await getJson(URLS.fx);
    raw = { fetched_at: fetchedAt, user_agent: USER_AGENT, request_count: requestCount, urls: URLS, stores, deals, fx };
    const dir = path.join(RAW_DIR, fetchedAt.slice(0, 10));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "responses.json"), JSON.stringify(raw, null, 2) + "\n");
    console.log(`เก็บ raw ที่ ${path.relative(ROOT, dir)}/responses.json`);
  }

  const out = transform(raw, { count: 20 });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`เขียน data/deals.json: ${out.deals.length} ดีล, อัตรา ${out.fx.rate} (${out.fx.rate_date})`);
  for (const s of out.data_issues) console.log(`  - [${s.id}] ${s.title}: ${s.affected} รายการ`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
