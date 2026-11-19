# inblack-c — เว็บราคาเกมเป็นเงินบาท

20 ดีลเกมลดราคาจริงจาก [CheapShark](https://www.cheapshark.com) แปลงเป็นเงินบาทด้วยอัตรา [Frankfurter](https://frankfurter.dev) (ECB) พร้อม MCP tool `search_deals` สำหรับค้นหาดีล

**เว็บ:** https://suratt028.github.io/inblack-c/

| หน้า | แสดง |
|---|---|
| [`/`](https://suratt028.github.io/inblack-c/) | ตารางชื่อเกม ร้าน ราคาปกติ ราคาลด ส่วนลด — ค้นหาด้วยชื่อเกมหรือชื่อร้าน เรียงได้ 3 แบบ (ลดมากสุด / ถูกสุด / ชื่อ) ลิงก์ผ่าน CheapShark |
| [`/data.html`](https://suratt028.github.io/inblack-c/data.html) | อัตราแลกเปลี่ยน วันที่ของอัตรา ที่มาของข้อมูล เวลาดึง และจุดผิดปกติที่จัดการแล้ว |

## เริ่มใช้งาน

ต้องใช้ Node.js 20 ขึ้นไป

```bash
npm install
```

### เปิด MCP server (Streamable HTTP) ที่ `http://localhost:3000/mcp`

```bash
npm run mcp
# หรือ: node mcp/server.mjs
```

ทดสอบ `initialize` → `ping` → `tools/list` → `tools/call search_deals` (เปิด server ไว้อีกหน้าต่าง):

```bash
npm run test:mcp
```

เชื่อมกับ Claude Code: repo มี `.mcp.json` ชี้ไปที่ `http://localhost:3000/mcp` แล้ว หรือเพิ่มเองด้วย
`claude mcp add --transport http inblack-c-deals http://localhost:3000/mcp`

**Tool `search_deals`** — อาร์กิวเมนต์ทั้งหมดไม่บังคับ

| อาร์กิวเมนต์ | ชนิด | ความหมาย |
|---|---|---|
| `query` | string | คำในชื่อเกม (ไม่สนตัวพิมพ์และเครื่องหมาย) |
| `store` | string | `store_id` หรือชื่อร้าน (ตรงทั้งชื่อ หรือคำขึ้นต้นครบคำ) เช่น `GOG`, `Epic`, `25` |
| `max_price_thb` | number | ราคาลดสูงสุด (บาท) |
| `min_savings` | number | ส่วนลดขั้นต่ำ (%) |
| `sort` | `savings` \| `price` \| `rating` | ค่าเริ่มต้น `savings` |
| `limit` | 1–20 | ค่าเริ่มต้น 10 |

### ข้อมูล

```bash
npm run fetch                          # ดึงจาก API จริง (3 คำขอ, เพดาน 5) → data/raw/<วันที่>/ + data/deals.json
node scripts/fetch-deals.mjs --from-raw   # สร้าง deals.json ใหม่จาก raw ล่าสุด ไม่ยิง API
npm run verify                         # ตรวจทุกตัวเลขใน deals.json เทียบกับ raw
```

- ส่ง `User-Agent: inblack-c-thb-deals/1.0 (…)` ทุกคำขอ ถ้าได้ 429 หยุดรอตาม `Retry-After`
- ลิงก์ดีลใช้ `https://www.cheapshark.com/redirect?dealID=…` ไม่มี affiliate อื่น
- ไม่มี API key — ทั้งสอง API เปิดสาธารณะ

### เว็บ

```bash
npm run build:site     # site/ + data/deals.json → dist/
npx http-server dist -p 8080
```

GitHub Actions ([`.github/workflows/pages.yml`](.github/workflows/pages.yml)) รัน `verify-deals.mjs` ก่อน แล้ว build และ deploy `dist/` ขึ้น GitHub Pages ทุกครั้งที่ push `main` — ถ้าตัวเลขไม่ตรงกับ raw จะไม่ deploy

## โครงสร้าง

```
data/deals.json            20 ดีล (รูปแบบตามโจทย์ + ฟิลด์ตรวจสอบ เช่น savings_percent_api, is_free, title_raw)
data/raw/<date>/           response ดิบจาก API
data/review/               response ที่ Agent รีวิวดึงมาเทียบ
scripts/fetch-deals.mjs    ดึงข้อมูล (≤ 5 คำขอ)
scripts/lib/transform.mjs  กรอง/รวมเกมซ้ำ/แปลงบาท
scripts/verify-deals.mjs   ตรวจตัวเลขเทียบ raw
scripts/test-mcp.mjs       ทดสอบ MCP
mcp/server.mjs             MCP server + tool search_deals
site/                      หน้าเว็บ 2 หน้า
.claude/skills/gameprice-check/  Skill ตรวจราคา
DATA_ISSUES.md · REVIEW.md · DECISIONS.md · AGENT_SETUP.md · AGENT_LOG/
```
