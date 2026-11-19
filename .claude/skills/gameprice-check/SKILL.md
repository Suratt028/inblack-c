---
name: gameprice-check
description: ตรวจราคาเกมเป็นเงินบาทใน data/deals.json ของ inblack-c ว่าตรงกับ raw API (CheapShark + Frankfurter) — ใช้ก่อน commit/deploy ข้อมูลดีล, เมื่อถูกถามว่า "ราคานี้ถูกไหม/ตรงไหม", หรือเมื่อแก้ scripts/lib/transform.mjs
---

# gameprice-check

ตรวจว่าตัวเลขทุกตัวใน `data/deals.json` คำนวณกลับไปถึงข้อมูลดิบได้ และหน้าเว็บแสดงตรงกับ JSON

## ขั้นตอน

1. **ตรวจเลขจาก raw** — รัน `node scripts/verify-deals.mjs`
   - ต้องได้ `✓ verify-deals: 20 ดีลตรงกับ raw`
   - ถ้า ✗ ให้รายงานรายการที่ไม่ผ่านตามจริง ห้ามแก้ deals.json ด้วยมือ ให้แก้ที่ `scripts/lib/transform.mjs` แล้วรัน `node scripts/fetch-deals.mjs --from-raw`
2. **ตรวจผ่าน MCP** — ถ้า MCP server รันอยู่ (`npm run mcp`) เรียก tool `search_deals` อย่างน้อย 1 ครั้ง
   (เช่น `{ "sort": "price", "limit": 3 }`) แล้วเทียบ `sale_thb` ของผลลัพธ์กับ `round2(sale_usd × fx.rate)` ด้วยตัวเอง
   ถ้าไม่มี MCP client ในเซสชัน ใช้ `node scripts/test-mcp.mjs` แทน
3. **สุ่มคิดมือ 3 ดีล** — เลือก 3 ดีล (รวมดีลแรก ดีลสุดท้าย และดีลที่ `is_free` ถ้ามี) แล้วแสดงการคิด:
   `sale_thb = round2(sale_usd × rate)`, `savings = round2((1 − sale/normal) × 100)`
4. **ตรวจกฎโจทย์**
   - 20 ดีล, `game_id` ไม่ซ้ำ, ทุกร้าน `isActive = 1` ใน raw `/stores`
   - ลิงก์เป็น `https://www.cheapshark.com/redirect?dealID=...` ไม่มี affiliate อื่น
   - `sources.request_count ≤ 5`, `fx.rate_date` มาจาก Frankfurter ไม่ใช่วันที่ดึง
   - ไม่มี API key/รหัสผ่านใน repo (`git grep -nI -E "(api[_-]?key|secret|token|password)\s*[:=]"`)
5. **ตรวจเว็บ** — `site/` อ่าน `data/deals.json` ตรง ๆ ไม่ hardcode ตัวเลข (grep ตัวเลขบาทใน `site/*.html` ต้องไม่เจอ)

## รูปแบบรายงาน

```
gameprice-check: PASS|FAIL
- verify-deals: …
- MCP search_deals: …
- คิดมือ: <title> $x × r = ฿y ✓
- กฎโจทย์: …
```
