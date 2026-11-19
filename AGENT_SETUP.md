# AGENT_SETUP — เครื่องมือ AI และตำแหน่งของแต่ละส่วน

## เครื่องมือ AI ที่ใช้

- **Claude Code** (แอป Claude desktop, แท็บ Code) บน Windows 11 — โมเดล Claude Opus 5.5
- Agent หลักเป็นคนเขียนโค้ด/เอกสาร ผู้สมัครเป็นคนสั่ง ตรวจ และตัดสินใจ (ดู `DECISIONS.md`)

## ตำแหน่งของแต่ละส่วน

| ส่วน | อยู่ที่ไหน | ใช้ทำอะไร | หลักฐานใน log |
|---|---|---|---|
| **Sub-agent 1 — ผู้รีวิว** | สั่งผ่าน Agent tool (`general-purpose`) จากเซสชันหลัก | ตรวจตัวเลขเทียบ API สด, เรียก MCP, แก้ข้อผิดพลาด, เขียน `REVIEW.md` | `AGENT_LOG/session-log.md` (ขั้นที่ 6), `REVIEW.md`, `data/review/` |
| **Sub-agent 2 — ผู้ตรวจข้อมูล** | สั่งผ่าน Agent tool (`general-purpose`) ทำงานขนานกับตัวแรก | ตรวจทุกข้ออ้างใน `DATA_ISSUES.md` เทียบ raw และโค้ด แก้ข้อที่ผิด | `AGENT_LOG/session-log.md`, ท้าย `DATA_ISSUES.md` |
| **Skill `gameprice-check`** | [`.claude/skills/gameprice-check/SKILL.md`](.claude/skills/gameprice-check/SKILL.md) | เช็กลิสต์ตรวจราคาบาท/ส่วนลด/กฎโจทย์ก่อน deploy | `AGENT_LOG/session-log.md` (ขั้นที่ 7) |
| **Plugin** | `superpowers` (ติดตั้งใน Claude Code) — skill `superpowers:verification-before-completion` | บังคับให้รันคำสั่งตรวจจริงและอ่านผลก่อนอ้างว่าเสร็จ | `AGENT_LOG/session-log.md` (ขั้นที่ 7) |
| **MCP server** | [`mcp/server.mjs`](mcp/server.mjs) — Streamable HTTP `http://localhost:3000/mcp`, ลงทะเบียนใน [`.mcp.json`](.mcp.json) | tool `search_deals` | `AGENT_LOG/mcp-test.log` |
| **Tools (สคริปต์)** | [`scripts/`](scripts/) | `fetch-deals.mjs` ดึงข้อมูล, `verify-deals.mjs` ตรวจตัวเลข, `test-mcp.mjs` ทดสอบ MCP, `build-site.mjs` ประกอบเว็บ | — |
| **API** | CheapShark `/api/1.0/stores`, `/api/1.0/deals`; Frankfurter `/v1/latest` | ดีลจริง + อัตรา USD→THB | `data/raw/2026-11-19/responses.json`, `data/review/` |
| **CI / Deploy** | [`.github/workflows/pages.yml`](.github/workflows/pages.yml) | ตรวจ `verify-deals` → build → GitHub Pages | แท็บ Actions ของ repo |

## ขั้นตอนตามโจทย์ → ไฟล์ผลลัพธ์

1. ดึงข้อมูลจริง (≤ 5 คำขอ, ใช้จริง 3) → `data/deals.json`
2. หาจุดผิดปกติ → `DATA_ISSUES.md` (Sub-agent 2 ตรวจซ้ำ)
3. เครื่องมือ → `mcp/server.mjs` (`search_deals`), `.claude/skills/gameprice-check/`, plugin `superpowers`
4. Agent อีกตัวรีวิว → `REVIEW.md` (Sub-agent 1)
5. เปิดเว็บ → GitHub Pages 2 หน้า + `DECISIONS.md`
