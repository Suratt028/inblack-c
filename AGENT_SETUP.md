# AGENT_SETUP — เครื่องมือ AI และตำแหน่งของแต่ละส่วน

## เครื่องมือ AI ที่ใช้

- **Claude Code** (แอป Claude desktop, แท็บ Code, โมเดล Claude Opus 5.5) — สร้างสคริปต์ ข้อมูล MCP server Skill เว็บ และสั่ง Sub-agent 2 ตัว
- **GitHub Copilot ใน VS Code** — รอบตรวจระหว่างทาง (เพิ่ม `scripts/review-check.mjs`, push และเปิด GitHub Pages) ระหว่างที่ Claude Code ติด usage limit
- ผู้สมัครเป็นคนสั่ง ตรวจ และตัดสินใจ (ดู `DECISIONS.md`) — ประวัติอยู่ใน `AGENT_LOG/`

## ตำแหน่งของแต่ละส่วน

| ส่วน | อยู่ที่ไหน | ใช้ทำอะไร | หลักฐาน |
|---|---|---|---|
| **Sub-agent 1 — ผู้รีวิว** | Agent tool ของ Claude Code (`general-purpose`) | ตรวจตัวเลขเทียบ API สด (3 คำขอ), เรียก MCP, พบและแก้บั๊กปัดเศษ (D1) และ Retry-After (D2) | `REVIEW.md` ส่วน "รอบ 2", `data/review/`, `AGENT_LOG/claude-code-session.md` |
| **Sub-agent 2 — ผู้ตรวจข้อมูล** | Agent tool ของ Claude Code (`general-purpose`) ทำงานขนานกับตัวแรก | ตรวจทุกข้ออ้างใน `DATA_ISSUES.md` เทียบ raw/โค้ด แก้ 4 ข้อที่ผิด และพบจุดผิดปกติเพิ่ม 8 ข้อ | ท้าย `DATA_ISSUES.md`, `AGENT_LOG/claude-code-session.md` |
| **Skill `gameprice-check`** | [`.claude/skills/gameprice-check/SKILL.md`](.claude/skills/gameprice-check/SKILL.md) | เช็กลิสต์ตรวจราคาบาท/ส่วนลด/กฎโจทย์ก่อน deploy | `AGENT_LOG/claude-code-session.md` |
| **Plugin** | `superpowers` (ติดตั้งใน Claude Code) — skill `superpowers:verification-before-completion` | บังคับให้ตรวจ diff ของ Sub-agent และรันคำสั่งตรวจใหม่ก่อน commit | `AGENT_LOG/claude-code-session.md` |
| **MCP server** | [`mcp/server.mjs`](mcp/server.mjs) — Streamable HTTP `http://localhost:3000/mcp`, ลงทะเบียนใน [`.mcp.json`](.mcp.json) | tool `search_deals` (Claude Code เรียกผ่าน `.mcp.json` จริง) | `AGENT_LOG/mcp-test.log`, `AGENT_LOG/claude-code-session.md` |
| **Tools (สคริปต์)** | [`scripts/`](scripts/) | `fetch-deals.mjs` ดึงข้อมูล, `verify-deals.mjs` / `review-check.mjs` ตรวจตัวเลข, `test-mcp.mjs` ทดสอบ MCP, `build-site.mjs` ประกอบเว็บ | — |
| **API** | CheapShark `/api/1.0/stores`, `/api/1.0/deals`; Frankfurter `/v1/latest` | ดีลจริง + อัตรา USD→THB | `data/raw/2026-11-19/responses.json`, `data/review/` |
| **CI / Deploy** | [`.github/workflows/pages.yml`](.github/workflows/pages.yml) | ตรวจ `verify-deals` → build → GitHub Pages | แท็บ Actions ของ repo |

## ขั้นตอนตามโจทย์ → ไฟล์ผลลัพธ์

1. ดึงข้อมูลจริง (≤ 5 คำขอ, ใช้จริง 3) → `data/deals.json`
2. หาจุดผิดปกติ → `DATA_ISSUES.md` (Sub-agent 2 ตรวจซ้ำ)
3. เครื่องมือ → `mcp/server.mjs` (`search_deals`), `.claude/skills/gameprice-check/`, plugin `superpowers`
4. Agent อีกตัวรีวิว → `REVIEW.md` (Sub-agent 1 แก้ข้อผิดพลาด 2 จุด)
5. เปิดเว็บ → GitHub Pages 2 หน้า + `DECISIONS.md`
