# REVIEW — ตรวจข้อมูลและการทำงาน

วันที่ตรวจ: 2026-11-19

## ผลตรวจ

- `node scripts/verify-deals.mjs` ผ่าน: 20 ดีลตรงกับ raw, `game_id` ไม่ซ้ำ, ร้านเปิดอยู่, ลิงก์เป็น CheapShark redirect, คำนวณ THB/ส่วนลดและอัตราแลกเปลี่ยนตรงกับแหล่งข้อมูล และใช้ 3 คำขอ (ไม่เกิน 5)
- `node scripts/review-check.mjs` ผ่านหลังแก้ตัวเปรียบเทียบการจัดอันดับ: ผู้ตรวจอิสระเลือกดีลและลำดับตรงกับ JSON 20/20 รายการ พร้อมตรวจราคาด้วยเลขจำนวนเต็ม
- MCP `search_deals` เรียกได้และคืน 20 ดีล; เรียงราคาต่ำสุดและตรวจตัวอย่างกับอัตรา 33.975 ได้ตรงกัน
- `npm run build:site` ผ่าน; `dist/` มีหน้าเว็บทั้งสองหน้า และ `data/deals.json` ที่ build มี SHA-256 ตรงกับไฟล์ต้นทาง
- สแกนรูปแบบข้อมูลรับรองไม่พบ API key/รหัสผ่าน; ผลค้น `id-token: write` เป็น permission สำหรับ GitHub Pages OIDC ไม่ใช่ secret

## ข้อผิดพลาดที่พบและแก้

`review-check.mjs` เดิมเรียงตามเปอร์เซ็นต์ส่วนลดที่ปัด 2 ตำแหน่ง แต่ `transform.mjs` เรียงตามส่วนลดจริงก่อนปัดเศษ จึงรายงานลำดับไม่ตรงทั้งที่ข้อมูลคัดเลือกถูกต้อง ปรับผู้ตรวจให้เปรียบเทียบอัตราส่วนราคาด้วยจำนวนเต็มแบบ exact แล้วตรวจซ้ำได้ 20/20 โดยไม่เปลี่ยน `data/deals.json`

## GitHub Pages

เปิดใช้ Pages แบบ GitHub Actions แล้ว push ขึ้น `main`; workflow run `44488071486` ผ่านทั้ง build และ deploy. ตรวจ URL จริงหลัง deploy ได้ HTTP 200 และ `data/deals.json` ที่เผยแพร่มี 20 ดีล

## ข้อจำกัดของรอบตรวจ (รอบ 1 — Copilot ใน VS Code)

> ข้อจำกัดนี้เป็นของรอบ 1 เท่านั้น — ต่อมา Sub-agent 2 ตัวใน Claude Code ทำงานจริง (ดู "รอบ 2" ด้านล่าง และส่วน "ผลตรวจโดย Agent ตรวจข้อมูล" ท้าย `DATA_ISSUES.md`) และเรียก Plugin `superpowers:verification-before-completion` แล้ว (ดู `AGENT_LOG/claude-code-session.md`)

งานตรวจแยกสองรายการที่ส่งให้ sub-agent ไม่เริ่มทำงาน เพราะ runtime ตอบ `400 The requested model is not supported`; จึงไม่มีผลตรวจจาก sub-agent ให้อ้างอิง และการตรวจข้างต้นเป็นการตรวจโดยตรงพร้อมตัวตรวจอิสระใน repository. Plugin แยกต่างหากที่ระบุใน `AGENT_SETUP.md` ไม่พร้อมใช้งานในเซสชันนี้ จึงไม่มีหลักฐานการเรียก plugin.

## รีวิวโดย Sub-agent (Claude Code) — รอบ 2

เวลาตรวจ 2026-11-19 ~17:05 (+07:00) · ผู้ตรวจไม่เชื่อตัวตรวจของผู้สร้าง จึงคิดเลขใหม่ด้วยเลขจำนวนเต็มแบบแน่นอน (BigInt ใน `scripts/review-check.mjs`), เทียบ API จริง, เรียก MCP และทดสอบขอบเขตของฟังก์ชันปัดเศษแบบครบทุกราคา

### ผลการตรวจ

| การตรวจ | วิธี | ผล |
|---|---|---|
| THB = round2(usd × rate) ทั้ง 20 ดีล (sale + normal) | BigInt ปัดครึ่งขึ้น เทียบ deals.json | ผ่าน 40/40 |
| savings = round2((1 − sale/normal)×100) | BigInt จากเซนต์ | ผ่าน 20/20 |
| ชุดและลำดับ 20 ดีล | คัดเลือกใหม่เองจาก raw (ร้าน active → ลดจริง → รวม gameID → เรียง) | ตรง 20/20 ตำแหน่ง |
| ร้าน `isActive = 1`, `store_name` ตรง `/stores` | raw `/stores` | ผ่าน |
| `game_id` ไม่ซ้ำ | Set | ผ่าน (20 ไม่ซ้ำ) |
| ลิงก์ | host `www.cheapshark.com`, path `/redirect`, พารามิเตอร์เดียว `dealID` | ผ่าน |
| `fx.rate` / `fx.rate_date` | เทียบ raw Frankfurter (33.975 / 2026-11-18) | ผ่าน |
| ดีลฟรี | Contractor: The Clean Up Part II $0.00 × 33.975 = ฿0, `is_free: true`, savings 100 | ผ่าน |
| คิดมือ ดีลแรก/สุดท้าย | NFS Heat $3.49 × 33.975 = 118.57275 → ฿118.57 · Darksiders $9.49 × 33.975 = 322.42275 → ฿322.42 | ผ่าน |
| `request_count` | raw = 3 | ผ่าน (≤ 5) |
| MCP `search_deals` `{sort:"price", limit:20}` | เทียบทุกฟิลด์ราคา/ลิงก์กับ deals.json ตาม game_id | 20 ดีล, ไม่ตรง 0 ฟิลด์ |
| ราคาบาท hardcode ใน `site/*.html` | grep `฿[0-9]` | ไม่พบ |
| สแกน secret | `git grep` ตาม skill | ไม่พบ (มีแค่ `id-token: write` ของ Pages) |
| ฟังก์ชัน `round2` เดิม กับราคาอื่นนอก 20 ดีล | ไล่ทุกราคา $0.00–$1,000.00 ที่อัตรา 33.975 เทียบ BigInt | **ไม่ผ่าน 124 ราคา** → ดูข้อบกพร่อง D1 |

### เทียบกับ API จริง (3 คำขอ, User-Agent `inblack-c-thb-deals/1.0 (review)`, ไม่เจอ 429)

ไฟล์: `data/review/requests.json`, `cheapshark-deal-2.json`, `cheapshark-deal-20.json`, `frankfurter-latest.json`

| ฟิลด์ | deals.json (14:46) | API จริง (17:05) | สรุป |
|---|---|---|---|
| fx.rate | 33.975 | 33.975 | ตรง |
| fx.rate_date | 2026-11-18 | 2026-11-18 | ตรง (ECB ยังไม่ออกอัตราวันนี้) |
| NFS Heat Deluxe — sale_usd / normal_usd | 3.49 / 69.99 | 3.49 / 69.99 | ตรง |
| NFS Heat Deluxe — store / gameID | 25 / 204097 | 25 / 204097 | ตรง |
| NFS Heat Deluxe — sale_thb | 118.57 | 118.57 (คิดจากค่าจริง) | ตรง |
| Darksiders Blades and Whip — sale_usd / normal_usd | 9.49 / 79.99 | 9.49 / 79.99 | ตรง |
| Darksiders Blades and Whip — store / gameID | 21 / 195476 | 21 / 195476 | ตรง |
| Darksiders Blades and Whip — sale_thb | 322.42 | 322.42 (คิดจากค่าจริง) | ตรง |

ไม่พบราคาเปลี่ยน (drift) ใน 2 ดีลที่สุ่ม และไม่พบบั๊กในตัวเลขที่เผยแพร่

### ข้อบกพร่องที่พบ

| # | ระดับ | ที่ | รายละเอียด | สถานะ |
|---|---|---|---|---|
| D1 | กลาง (แฝง) | `scripts/lib/transform.mjs:5`, `scripts/verify-deals.mjs:14` | `Math.round((x + Number.EPSILON) * 100) / 100` ไม่ได้ "ปัดครึ่งขึ้น" ตามกฎที่เขียนใน `rules.thb` เมื่อผลคูณเป็น .xx5 พอดี เพราะ float เก็บ 129.105 เป็น 129.10499… (EPSILON บวกก่อนคูณ 100 จึงเล็กเกินไป) เช่น $3.80 × 33.975 = 129.105 ได้ ฿129.10 แทน ฿129.11; ที่อัตรา 33.975 มี 124 ราคาใน $0–$1,000 ที่ผิด · savings ก็เช่นกัน เช่น 11.13/11.20 = 0.625% ได้ 0.62 · `verify-deals.mjs` ใช้สูตรเดียวกันจึงจับไม่ได้ (ตัวตรวจที่ผู้สร้างเขียนเองมีจุดบอดเดียวกับโค้ด) · 20 ดีลรอบนี้ไม่โดน | แก้แล้ว |
| D2 | กลาง | `scripts/fetch-deals.mjs:42` | ถ้าได้ 429 แต่ไม่มี header `Retry-After` → `Number(null) = 0` จึงรอ 0 วินาทีแล้วยิงซ้ำทันที (fallback 60 วินาทีไม่เคยทำงาน) ขัดกับคอมเมนต์หัวไฟล์ (บรรทัด 8) ที่ว่า "หยุดรอตาม Retry-After" · ถ้าเป็น HTTP-date ในอดีต ได้ 60 แทน 0 | แก้แล้ว |
| D3 | ต่ำ | `mcp/server.mjs:21` | `query` ที่มีแต่เครื่องหมาย (เช่น `"!!!"`) ถูก normalize เป็น `""` แล้วถือว่าไม่กรอง → คืนทั้ง 20 ดีลแทน 0 | แก้แล้ว (รอบ 3) |
| D4 | ต่ำ (การออกแบบ) | `mcp/server.mjs:25` | `store` จับแบบ substring: `"e"` ตรง 19 ดีล (Epic, Steam, GameBillet…) — ไม่ผิดตามคำอธิบาย tool แต่กว้างเกิน | แก้แล้ว (รอบ 3) |

ส่วนที่ตรวจแล้วไม่พบปัญหา: การรวมเกมซ้ำและ tie-break (ราคา → dealRating → storeID), ดีลฟรี, การถอด HTML entity/ยุบช่องว่าง, ชนิดข้อมูลตัวเลขใน JSON, input validation ของ MCP (zod ปฏิเสธ `limit: 0` ถูกต้อง), `max_price_thb: 0` คืนเฉพาะดีลฟรี

### สิ่งที่แก้ (ไม่ได้แตะ `site/`, `DATA_ISSUES.md`, git)

1. **D1 — `scripts/lib/transform.mjs:5-12, 106`**
   - ก่อน: `export const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;` และ `const savings = round2((1 - sale / normal) * 100);`
   - หลัง: `export const round2 = (x) => Number(Math.round(Number(x.toPrecision(15) + "e2")) + "e-2");` และ `savingsPct(sale, normal)` ที่คิดจากเซนต์ `round2(((n - s) * 100) / n)`
   - `scripts/verify-deals.mjs:14, 38-39` เปลี่ยนแบบเดียวกัน
   - ทดสอบแบบไล่ครบ: THB ทุกราคา $0–$2,000 ที่อัตรา 33.975 / 32.123 / 36.505 / 33.97512 และ savings ทุกคู่ normal ≤ $200 → ไม่ตรงกับ BigInt **0** รายการ (เดิม 124 / 4 / 28 และ savings 1,500+)
2. **D2 — `scripts/fetch-deals.mjs:42, 52-58`**
   - ก่อน: `const secs = Number.isFinite(Number(ra)) ? Number(ra) : Math.max(0, (Date.parse(ra) - Date.now()) / 1000) || 60;`
   - หลัง: `const secs = retryAfterSeconds(ra);` — ตัวเลขล้วน → วินาที, HTTP-date → วินาทีที่เหลือ (ขั้นต่ำ 0), ไม่มี/อ่านไม่ได้ → 60
   - ทดสอบ: `null`→60, `""`→60, `"120"`→120, วันที่ +30 วินาที→30, วันที่ในอดีต→0, `"-5"`→60

หลังแก้: `node scripts/fetch-deals.mjs --from-raw` ได้ `data/deals.json` **เหมือนเดิมทุกไบต์** (20 ดีลรอบนี้ไม่มีค่าที่ตกจุด .xx5)

```
✓ verify-deals: 20 ดีลตรงกับ raw (data/raw/2026-11-19/responses.json), อัตรา 33.975 วันที่ 2026-11-18
✓ review-check: ทุกจุดผ่าน
✓ server-initialize / ✓ ping / ✓ tools-list — search_deals / ✓ tools-call search_deals — 9 matches
```

### ที่ยังเหลือ

- D3, D4 แก้แล้วในรอบ 3 (ดูด้านล่าง)
- ไม่ได้ build เว็บใหม่ (`site/` กำลังถูกแก้โดยเอเจนต์อื่น) — deals.json ไม่เปลี่ยน จึงไม่กระทบตัวเลขบนเว็บ
- `rules.savings_percent` ใน deals.json ยังเขียนสูตรเป็น `(1 − sale/normal) × 100` ซึ่งเท่ากันทางคณิตศาสตร์กับวิธีคิดจากเซนต์ — ไม่ได้แก้
- ยังไม่ commit (ตามคำสั่ง)

## รอบ 3 — แก้ D3, D4 ใน MCP `search_deals`

ผู้สมัครสั่งให้แก้ 2 จุดที่ค้างจากรอบ 2 (`mcp/server.mjs`)

- **D3:** เพิ่ม `filterTerm()` — ไม่ส่ง/ช่องว่างล้วน = ไม่กรอง, มีข้อความแต่ normalize แล้วว่าง (เช่น `"!!!"`) = ไม่ตรงอะไรเลย
- **D4:** เพิ่ม `storeMatches()` — ตรง `store_id` พอดี หรือชื่อร้าน (normalize) ตรงทั้งชื่อ หรือขึ้นต้นด้วยคำที่ค้นแบบครบคำ; ปรับคำอธิบายอาร์กิวเมนต์ `store` ให้ตรงพฤติกรรม

| อาร์กิวเมนต์ | ก่อน | หลัง |
|---|---|---|
| `{query:"!!!"}` | 20 | 0 |
| `{query:"   "}` | 20 | 20 (ไม่กรอง) |
| `{store:"e"}` | 19 | 0 |
| `{store:"epic"}` / `"Epic Games"` / `"Epic Games Store"` / `"25"` | 8 | 8 |
| `{store:"gog"}` | 1 | 1 |
| `{store:"store"}` | หลายร้าน | 0 |

ตรวจ: สคริปต์ทดสอบ 17 กรณีผ่านทั้งหมด, `node scripts/test-mcp.mjs` 4/4 ✓ และ Agent เรียก `search_deals` ผ่าน MCP จริงหลังรีสตาร์ต server (`"!!!"` → 0, `"e"` → 0, `"epic"` → 8)
