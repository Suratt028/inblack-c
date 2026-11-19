# AGENT_SETUP — เครื่องมือ AI และตำแหน่งของแต่ละส่วน

## เครื่องมือ AI ที่ใช้

- **การตรวจและแก้รอบ 2026-11-19:** AI assistant using Copilot SDK in VS Code; การตัดสินใจบันทึกใน `DECISIONS.md`
- รายละเอียดสิ่งที่ตรวจและข้อจำกัดของเครื่องมือในรอบนี้อยู่ใน `AGENT_LOG/session-log.md`

## ตำแหน่งของแต่ละส่วน

| ส่วน | อยู่ที่ไหน | ใช้ทำอะไร | หลักฐานใน log |
|---|---|---|---|
| **Sub-agent 1 — ผู้รีวิว** | พยายามเรียกผ่าน Agent tool ในรอบตรวจนี้ | Runtime ปฏิเสธก่อนเริ่มทำงาน; ไม่มีผลตรวจจาก sub-agent (`REVIEW.md` เป็นผลตรวจโดยตรง) | `AGENT_LOG/session-log.md`, `REVIEW.md` |
| **Sub-agent 2 — ผู้ตรวจข้อมูล** | พยายามเรียกผ่าน Agent tool ในรอบตรวจนี้ | Runtime ปฏิเสธก่อนเริ่มทำงาน; ไม่มีผลตรวจจาก sub-agent | `AGENT_LOG/session-log.md`, `DATA_ISSUES.md` |
| **Skill `gameprice-check`** | [`.claude/skills/gameprice-check/SKILL.md`](.claude/skills/gameprice-check/SKILL.md) | เช็กลิสต์ตรวจราคาบาท/ส่วนลด/กฎโจทย์ก่อน deploy | `AGENT_LOG/session-log.md` (ขั้นที่ 7) |
| **Plugin** | Plugin `superpowers` ไม่พร้อมใช้งานในเซสชันนี้ | ไม่มีการอ้างว่าเรียก Plugin; ใช้คำสั่งตรวจใน repository และ project Skill แทน | `AGENT_LOG/session-log.md` |
| **MCP server** | [`mcp/server.mjs`](mcp/server.mjs) — Streamable HTTP `http://localhost:3000/mcp`, ลงทะเบียนใน [`.mcp.json`](.mcp.json) | tool `search_deals` | `AGENT_LOG/mcp-test.log` |
| **Tools (สคริปต์)** | [`scripts/`](scripts/) | `fetch-deals.mjs` ดึงข้อมูล, `verify-deals.mjs` ตรวจตัวเลข, `test-mcp.mjs` ทดสอบ MCP, `build-site.mjs` ประกอบเว็บ | — |
| **API** | CheapShark `/api/1.0/stores`, `/api/1.0/deals`; Frankfurter `/v1/latest` | ตรวจข้อมูล snapshot จริงและอัตรา USD→THB (รอบนี้ไม่ได้ดึง API สดเพิ่ม) | `data/raw/2026-11-19/responses.json` |
| **CI / Deploy** | [`.github/workflows/pages.yml`](.github/workflows/pages.yml) | ตรวจ `verify-deals` → build → GitHub Pages | แท็บ Actions ของ repo |

## ขั้นตอนตามโจทย์ → ไฟล์ผลลัพธ์

1. ดึงข้อมูลจริง (≤ 5 คำขอ, ใช้จริง 3) → `data/deals.json`
2. หาจุดผิดปกติ → `DATA_ISSUES.md` (Sub-agent 2 ตรวจซ้ำ)
3. เครื่องมือ → `mcp/server.mjs` (`search_deals`), `.claude/skills/gameprice-check/`, plugin `superpowers`
4. ตรวจและบันทึกผล → `REVIEW.md` (รอบนี้เป็นการตรวจโดยตรง; sub-agent ยังไม่เริ่มทำงาน)
5. เปิดเว็บ → GitHub Pages 2 หน้า + `DECISIONS.md`
