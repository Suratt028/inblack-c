// แปลง raw response (CheapShark + Frankfurter) → data/deals.json
// แยกออกมาเป็นฟังก์ชันบริสุทธิ์ (ไม่ยิง network) เพื่อให้รันซ้ำจาก raw ได้และทดสอบได้
// ทุกจุดผิดปกติที่จัดการจะถูกนับและบันทึกลง data_issues (แสดงบน /data.html และอธิบายใน DATA_ISSUES.md)

export const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

export const CHEAPSHARK_REDIRECT = "https://www.cheapshark.com/redirect?dealID=";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };
function cleanTitle(t) {
  return String(t)
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      const k = e.toLowerCase();
      if (ENTITIES[k]) return ENTITIES[k];
      if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16));
      if (k.startsWith("#")) return String.fromCodePoint(parseInt(k.slice(1), 10));
      return m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

export function transform(raw, { count = 20 } = {}) {
  const issues = {
    duplicate_game: { id: "duplicate_game", title: "เกมเดียวกันซ้ำหลายร้าน", affected: 0, examples: [],
      handling: "รวมตาม gameID เก็บดีลที่ราคาลดถูกที่สุด (เสมอกันเลือก dealRating สูงกว่า แล้ว storeID น้อยกว่า)" },
    inactive_store: { id: "inactive_store", title: "ดีลจากร้านที่ปิดแล้ว/ไม่รู้จักร้าน", affected: 0, examples: [],
      handling: "ตัดทิ้งถ้า storeID ไม่อยู่ใน /stores หรือ isActive = 0" },
    not_discounted: { id: "not_discounted", title: "ราคาลดไม่ต่ำกว่าราคาปกติ / ราคาผิดรูป", affected: 0, examples: [],
      handling: "ตัดทิ้งถ้า salePrice ≥ normalPrice, normalPrice ≤ 0 หรือแปลงเป็นตัวเลขไม่ได้" },
    title_whitespace: { id: "title_whitespace", title: "ชื่อเกมมีช่องว่างซ้อน/อักขระ HTML", affected: 0, examples: [],
      handling: "ถอด HTML entity และยุบช่องว่างซ้อนเป็นช่องเดียว เก็บชื่อเดิมไว้ใน title_raw" },
    free_game: { id: "free_game", title: "ราคาลดเป็น 0 (แจกฟรี 100%)", affected: 0, examples: [],
      handling: "เก็บไว้เพราะเป็นดีลจริง แต่ติดธง is_free และแสดงคำว่า \"ฟรี\" แทน ฿0.00" },
    savings_precision: { id: "savings_precision", title: "savings จาก API เป็นสตริงทศนิยม 6 หลัก", affected: 0, examples: [],
      handling: "คำนวณส่วนลดใหม่จาก (1 − sale/normal) × 100 ปัด 2 ตำแหน่ง เก็บค่า API ไว้ใน savings_percent_api เพื่อเทียบ" },
    fx_date_lag: { id: "fx_date_lag", title: "วันที่อัตราแลกเปลี่ยนไม่ใช่วันที่ดึงข้อมูล", affected: 0, examples: [],
      handling: "Frankfurter ใช้อัตราอ้างอิง ECB ที่ออกวันทำการละครั้ง จึงแสดง rate_date จาก API ตรง ๆ ไม่ใช้วันที่ดึง" },
  };
  const note = (k, ex) => {
    issues[k].affected++;
    if (issues[k].examples.length < 5) issues[k].examples.push(ex);
  };

  const stores = new Map(raw.stores.map((s) => [String(s.storeID), s]));
  const rate = Number(raw.fx?.rates?.THB);
  if (!(rate > 0)) throw new Error("ไม่มีอัตรา THB ที่ใช้ได้ใน response ของ Frankfurter");
  if (raw.fx.date !== raw.fetched_at.slice(0, 10)) note("fx_date_lag", `rate_date ${raw.fx.date} / ดึงวันที่ ${raw.fetched_at.slice(0, 10)}`);

  // 1) ตรวจทีละดีล
  const valid = [];
  for (const d of raw.deals) {
    if (cleanTitle(d.title) !== d.title) note("title_whitespace", JSON.stringify(d.title));
    const store = stores.get(String(d.storeID));
    if (!store || Number(store.isActive) !== 1) {
      note("inactive_store", `${d.title} @ store ${d.storeID}`);
      continue;
    }
    const sale = Number(d.salePrice), normal = Number(d.normalPrice);
    if (!Number.isFinite(sale) || !Number.isFinite(normal) || normal <= 0 || sale >= normal || sale < 0) {
      note("not_discounted", `${d.title}: sale ${d.salePrice} / normal ${d.normalPrice}`);
      continue;
    }
    valid.push({ d, store, sale, normal });
  }

  // 2) รวมเกมซ้ำ
  const byGame = new Map();
  for (const v of valid) {
    const g = String(v.d.gameID);
    if (!byGame.has(g)) byGame.set(g, []);
    byGame.get(g).push(v);
  }
  const picked = [];
  for (const [g, list] of byGame) {
    list.sort((a, b) => a.sale - b.sale || Number(b.d.dealRating) - Number(a.d.dealRating) || Number(a.d.storeID) - Number(b.d.storeID));
    if (list.length > 1) {
      issues.duplicate_game.affected += list.length - 1;
      if (issues.duplicate_game.examples.length < 5)
        issues.duplicate_game.examples.push(
          `${cleanTitle(list[0].d.title)}: ${list.length} ร้าน (${list.map((x) => `${x.store.storeName} $${x.d.salePrice}`).join(", ")}) → เก็บ ${list[0].store.storeName}`
        );
    }
    picked.push(list[0]);
  }

  // 3) เรียงตาม dealRating ของ CheapShark แล้วส่วนลด แล้วเลือก count ดีลแรก
  picked.sort((a, b) =>
    Number(b.d.dealRating) - Number(a.d.dealRating) ||
    (1 - b.sale / b.normal) - (1 - a.sale / a.normal) ||
    String(a.d.gameID).localeCompare(String(b.d.gameID))
  );
  const chosen = picked.slice(0, count);
  if (chosen.length < count) throw new Error(`ได้ดีลที่ใช้ได้แค่ ${chosen.length} รายการ (ต้องการ ${count})`);

  // 4) สร้างผลลัพธ์ (ข้อ savings/free นับเฉพาะดีลที่เผยแพร่; ข้ออื่นนับจาก raw ทั้งหมด)
  const deals = chosen.map(({ d, store, sale, normal }) => {
    const title = cleanTitle(d.title);
    const savings = round2((1 - sale / normal) * 100);
    if (String(d.savings) !== savings.toFixed(2)) note("savings_precision", `${title}: API "${d.savings}" → ${savings}`);
    const isFree = sale === 0;
    if (isFree) note("free_game", `${title} @ ${store.storeName} (ปกติ $${d.normalPrice})`);
    const out = {
      game_id: String(d.gameID),
      deal_id: d.dealID,
      title,
      store_id: String(d.storeID),
      store_name: store.storeName,
      sale_usd: sale,
      normal_usd: normal,
      sale_thb: round2(sale * rate),
      normal_thb: round2(normal * rate),
      savings_percent: savings,
      savings_percent_api: Number(d.savings),
      is_free: isFree,
      deal_rating: Number(d.dealRating),
      steam_app_id: d.steamAppID || null,
      metacritic_score: Number(d.metacriticScore) || null,
      thumb: d.thumb,
      cheapshark_url: CHEAPSHARK_REDIRECT + d.dealID,
      fetched_at: raw.fetched_at,
      source_url: raw.urls.deals,
    };
    if (title !== d.title) out.title_raw = d.title;
    return out;
  });

  return {
    generated_at: raw.fetched_at,
    fx: { base: "USD", quote: "THB", rate, rate_date: raw.fx.date, source_url: raw.urls.fx },
    sources: {
      deals: raw.urls.deals,
      stores: raw.urls.stores,
      fx: raw.urls.fx,
      user_agent: raw.user_agent,
      request_count: raw.request_count,
      raw_file: `data/raw/${raw.fetched_at.slice(0, 10)}/responses.json`,
    },
    rules: {
      thb: "round2(usd × rate) ปัดครึ่งขึ้น 2 ตำแหน่ง คำนวณจาก USD โดยตรง (ไม่คูณต่อจากค่าที่ปัดแล้ว)",
      savings_percent: "round2((1 − sale_usd / normal_usd) × 100)",
      selection: "ร้านเปิดอยู่ → ลดจริง → รวมเกมซ้ำเหลือร้านถูกสุด → เรียง dealRating, ส่วนลด → 20 รายการแรก",
    },
    stats: { raw_deals: raw.deals.length, after_filters: valid.length, unique_games: picked.length, published: deals.length },
    data_issues: Object.values(issues),
    deals,
  };
}
