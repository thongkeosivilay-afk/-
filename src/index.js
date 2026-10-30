/* =========================================================
   worker/src/index.js
   Cloudflare Worker — ระบบล็อกอินผ่าน Discord (OAuth2) + Supabase proxy ห้องแอดมิน
   Route ที่มี:
     GET  /auth/discord/login     -> เด้งไปหน้า Discord authorize (รับ ?next= ปลายทางหลังล็อกอินสำเร็จ)
     GET  /auth/discord/callback  -> Discord เด้งกลับมาที่นี่พร้อม ?code=
     GET  /auth/google/login      -> เด้งไปหน้า Google consent (รับ ?next= เหมือนกัน)
     GET  /auth/google/callback   -> Google เด้งกลับมาที่นี่พร้อม ?code=
     GET  /auth/logout            -> ล้าง session cookie
     GET  /api/me                 -> เช็คว่า login อยู่ไหม คืนข้อมูล user (รวมสถานะ isAdmin)
     POST /api/auth/signup        -> สมัครสมาชิกด้วยอีเมล/รหัสผ่าน (ผ่าน Supabase Auth Admin API)
     POST /api/auth/login         -> ล็อกอินด้วยอีเมล/รหัสผ่าน (ผ่าน Supabase Auth token endpoint,
                                      จำกัดจำนวนครั้งที่ลองผิดต่ออีเมลกัน brute-force)
     POST /api/account/change-password -> ลูกค้า (ต้อง login ด้วยอีเมล/รหัสผ่าน) เปลี่ยนรหัสผ่าน
                                      ต้องส่ง currentPassword มา verify กับ Supabase ก่อนเสมอ
     ALL  /api/admin/supabase/*   -> proxy ไป Supabase จริง ด้วย service_role key (ดูรายละเอียดด้านล่าง)
     GET  /api/public/storefront  -> ข้อมูลหน้าร้านสาธารณะ (หมวดหมู่/สินค้า/สต็อกจริง) ดูรายละเอียดด้านล่าง
     POST /api/topup/create       -> ลูกค้า (ต้อง login) เริ่มรายการเติมเงิน คืน topupId ชั่วคราว
     POST /api/topup/confirm      -> ลูกค้าอัพโหลดสลิป -> เก็บขึ้น storage + insert แถวจริงใน
                                      topup_requests (status: pending) ให้ห้องแอดมินเห็น/อนุมัติได้
     GET  /api/topup/history      -> ลูกค้า (ต้อง login) ดึงประวัติการเติมเงินของตัวเองเท่านั้น
                                      (topup-history.html)
     POST /api/orders/create      -> ลูกค้า (ต้อง login) กด "ซื้อเลย" ใน category.html —
                                      เรียก RPC purchase_product แบบ atomic (เช็คสต็อก/ยอดเงิน,
                                      หักเงิน, ออกรหัส, insert แถวใน orders) ดู SQL ท้ายไฟล์นี้
     POST /api/coupons/validate   -> ลูกค้า (ต้อง login) เช็คโค้ดส่วนลดก่อนซื้อ (คืน type/value/จำนวนสิทธิ์ที่เหลือของบัญชีนี้)
     GET  /api/orders/history     -> ลูกค้า (ต้อง login) ดึงประวัติการสั่งซื้อของตัวเองเท่านั้น
                                      (orders.html)
     GET  /api/public/top-spenders -> (public) อันดับ 1-10 ยอดเติมสะสมสูงสุด จาก topup_requests (approved) ชื่อถูกปิดบังบางส่วน
     GET  /api/account/stats      -> ลูกค้า (ต้อง login) สรุปยอดสั่งซื้อสำเร็จ/ยอดใช้จ่ายรวม
                                      (ยังไม่มีหน้าเรียกใช้จริงตอนนี้ เก็บ endpoint ไว้เผื่อทำหน้าบัญชีทีหลัง)
     GET  /api/account/reseller-status  -> ลูกค้า (ต้อง login) ดูสถานะตัวแทนของตัวเอง (ถ้ามี)
                                      อ่านจากตาราง reseller_status ด้วย service_role key (เผื่อใช้ทีหลัง —
                                      reseller.html ตอนนี้ไม่ได้เรียก เพราะแค่ให้กรอกคีย์อย่างเดียว)
     POST /api/account/redeem-reseller-key -> ลูกค้า (ต้อง login) กรอกคีย์ตัวแทนที่หน้า reseller.html ->
                                      เรียก RPC redeem_reseller_key ด้วย user.id/user.email ของ
                                      คนที่ login อยู่ (ห้ามรับ user id จาก body เด็ดขาด กันสวมรอย)
     GET  /api/account/reseller-dashboard -> ลูกค้า (ต้อง login + เป็นตัวแทนอยู่แล้ว) ดึงสรุปยอด
                                      จริง (โควตาเทียบเป้า/ยอดวันนี้/ยอดสะสม) จาก orders + topup_requests
                                      + wallets มาให้หน้า reseller.html แสดงเป็นแดชบอร์ด
     อื่นๆ ทั้งหมด                 -> ส่งต่อให้ env.ASSETS (ไฟล์ static เดิม)

   ---- ระบบแอดมิน ----
   ห้องแอดมิน (admin.html) ไม่ใช้รหัสผ่านอีกต่อไป — ผู้ใช้ต้องล็อกอินด้วย
   Discord แล้วอีเมลของบัญชี Discord นั้นต้องตรงกับ ADMIN_EMAIL ด้านล่าง
   ถึงจะได้สิทธิ์ isAdmin: true (อีเมลต้องยืนยันแล้วในฝั่ง Discord ด้วย)

   ---- Supabase proxy (/api/admin/supabase/*) ----
   admin.js (ผ่าน admin-supabase-config.js) ไม่ถือ Supabase key จริงในเบราว์เซอร์อีกต่อไป
   ทุกคำขอที่ supabase-js สร้าง (.from().select/insert/update/delete, .rpc(), .storage...)
   จะวิ่งมาที่ path นี้บนโดเมนตัวเอง (same-origin จึงพ่วง session cookie มาด้วยอัตโนมัติ)
   ก่อน forward ไป Supabase จริง Worker จะ:
     1) เช็ค session cookie -> ต้อง isAdmin: true เท่านั้น (ยกเว้น GET รูปจาก storage bucket
        ที่ตั้งเป็น public ไว้ ซึ่งเปิดให้อ่านได้อยู่แล้วโดยไม่ต้องมี key ใดๆ)
     2) ทิ้ง apikey/authorization ที่เบราว์เซอร์ส่งมา แล้วใส่ SUPABASE_SERVICE_ROLE_KEY แทนเสมอ
   ต้องตั้งค่า secret ก่อนใช้งาน (ดูคำแนะนำท้ายไฟล์นี้ / ที่แชท):
     wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   และตั้ง SUPABASE_URL ไว้ใน wrangler.toml [vars] (ไม่ใช่ secret เพราะไม่ใช่ข้อมูลลับ)

   ---- หน้าร้านสาธารณะ (/api/public/storefront) ----
   index.html (ผ่าน storefront-data.js + storefront.js) และ category.html (ผ่าน category.js)
   ไม่ได้อ่านข้อมูลตรงจาก Supabase อีกต่อไป (เดิมเป็น demo ที่ปั้นข้อมูลไว้ใน localStorage ฝั่ง
   browser เท่านั้น) แต่เรียก endpoint นี้แทน ซึ่ง Worker จะเป็นคนไปดึงข้อมูลจริงจาก Supabase
   ด้วย SUPABASE_SERVICE_ROLE_KEY เอง (คีย์ไม่เคยหลุดไปถึง browser) แล้วคัดกรองเฉพาะฟิลด์ที่
   ปลอดภัย/จำเป็นสำหรับหน้าร้านเท่านั้นก่อนส่งกลับไป (ชื่อ/ราคา/รูป/จำนวนสต็อกคงเหลือ) —
   ไม่ดึง/ไม่ส่ง service key และไม่ดึงตาราง product_codes (รหัสสินค้าจริงที่ยังไม่ถูกขาย) ออกไปเด็ดขาด
   สินค้าที่ archived = true (ถูกซ่อนจากหน้าร้านโดยแอดมิน) จะไม่ถูกส่งออกไปเลย
   Endpoint นี้เป็น public (GET อย่างเดียว, ไม่ต้อง login) เพราะเป็นข้อมูลที่ลูกค้าทุกคนควรเห็นอยู่แล้ว
   ========================================================= */

// อีเมล Discord ที่อนุญาตให้เข้าห้องแอดมินได้ (เพิ่มได้หลายคนโดยเติมในลิสต์นี้)
const ADMIN_EMAILS = ['bhchhhyggg@gmail.com', 'nuanmm12233@gmail.com'];

const SUPABASE_PROXY_PREFIX = '/api/admin/supabase';

/* ---------- security headers: ใส่ให้ทุก response ที่ตอบกลับ ---------- */
function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; " +
      // อนุญาตเฉพาะ onload="this.media='all'" ที่ใช้โหลดฟอนต์ Google (ถ้าไม่มีบรรทัดนี้ CSP จะบล็อก
      // ทำให้ฟอนต์ไม่ถูกใช้ ทั้งฟอนต์หน้าเว็บและฟอนต์ชื่อร้านเปลี่ยนเป็นฟอนต์สำรอง)
      "script-src-attr 'unsafe-hashes' 'sha256-MhtPZXr7+LpJUY5qtMutB+qWfQtMaPccfe7QXtCcEYc='; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; " +
      "connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; " +
      "form-action 'self'"
  );
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function route(request, env, ctx) {
  {
    const url = new URL(request.url);

    // ปุ่มปิด/เปิดเว็บ (โหมดปิดปรับปรุง) — เฉพาะแอดมิน
    if (url.pathname === '/api/admin/maintenance') {
      return handleMaintenance(request, env);
    }

    // บอท Discord กดอนุมัติ/ปฏิเสธเติมเงิน (ป้องกันด้วย Bearer BOT_API_SECRET) — ต้องอยู่ก่อน maintenanceGate
    // เพื่อให้กดปุ่มในดิสได้แม้เว็บปิดปรับปรุงอยู่
    if (url.pathname === '/api/bot/topup-decision') {
      return handleBotTopupDecision(request, env);
    }

    // เช็คสถานะปิด/เปิดเว็บ (public) — ต้องอยู่ก่อน maintenanceGate เพื่อให้หน้าปิดปรับปรุงเช็คได้ว่าเว็บเปิดกลับมาหรือยัง
    if (url.pathname === '/api/maintenance-status') {
      return handleMaintenanceStatus(request, env);
    }

    // ถ้าเว็บปิดปรับปรุงอยู่ และไม่ใช่แอดมิน -> โชว์หน้าปิดปรับปรุงแทน
    {
      const blocked = await maintenanceGate(request, env, url);
      if (blocked) return blocked;
    }

    if (url.pathname === '/auth/discord/login') {
      return handleLogin(request, env);
    }
    if (url.pathname === '/auth/discord/callback') {
      return safeAuthCallback(handleCallback, request, env);
    }
    if (url.pathname === '/auth/google/login') {
      return handleGoogleLogin(request, env);
    }
    if (url.pathname === '/auth/google/callback') {
      return safeAuthCallback(handleGoogleCallback, request, env);
    }
    if (url.pathname === '/auth/logout') {
      return handleLogout();
    }
    if (url.pathname === '/api/me') {
      return handleMe(request, env);
    }
    if (url.pathname === '/api/auth/signup' && request.method === 'POST') {
      return handlePasswordSignup(request, env);
    }
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      return handlePasswordLogin(request, env);
    }
    if (url.pathname === '/api/account/change-password' && request.method === 'POST') {
      return handleChangePassword(request, env);
    }
    if (url.pathname === '/api/account/update-profile' && request.method === 'POST') {
      return handleUpdateProfile(request, env);
    }
    if (url.pathname === '/api/account/avatar' && request.method === 'POST') {
      return handleUpdateAvatar(request, env);
    }
    if (url.pathname.startsWith('/api/public/avatar/') && request.method === 'GET') {
      return handlePublicAvatar(env, url);
    }
    if (url.pathname.startsWith(SUPABASE_PROXY_PREFIX + '/')) {
      return handleSupabaseProxy(request, env, url);
    }
    if (url.pathname === '/api/public/storefront') {
      return handlePublicStorefront(request, env);
    }
    if (url.pathname === '/api/public/recent-purchases') {
      return handleRecentPurchases(request, env);
    }
    if (url.pathname === '/api/public/weekly-best-sellers') {
      return handleWeeklyBestSellers(request, env);
    }
    if (url.pathname === '/api/public/top-spenders') {
      return handleTopSpenders(request, env, ctx);
    }
    if (url.pathname.startsWith('/api/admin/customers')) {
      return handleAdminCustomers(request, env, url);
    }
    if (url.pathname === '/api/topup/create') {
      return handleTopupCreate(request, env);
    }
    if (url.pathname === '/api/topup/confirm') {
      return handleTopupConfirm(request, env);
    }
    if (url.pathname === '/api/topup/history') {
      return handleTopupHistory(request, env);
    }
    if (url.pathname === '/api/admin/topup-decision') {
      return handleAdminTopupDecision(request, env);
    }
    if (url.pathname === '/api/orders/create') {
      return handleOrderCreate(request, env);
    }
    if (url.pathname === '/api/orders/history') {
      return handleOrdersHistory(request, env);
    }
    if (url.pathname === '/api/coupons/validate') {
      return handleCouponValidate(request, env);
    }
    if (url.pathname === '/api/account/stats') {
      return handleAccountStats(request, env);
    }
    if (url.pathname === '/api/account/reseller-status') {
      return handleResellerStatusGet(request, env);
    }
    if (url.pathname === '/api/account/redeem-reseller-key') {
      return handleRedeemResellerKey(request, env);
    }
    if (url.pathname === '/api/account/reseller-dashboard') {
      return handleResellerDashboard(request, env);
    }

    // path อื่นๆ ทั้งหมด -> เสิร์ฟไฟล์ static เดิม (index.html, style.css, script.js, ...)
    return env.ASSETS.fetch(request);
  }
}

// ຈັດລຽງໄລຍະເວລາ ນ້ອຍ -> ຫຼາຍ (ຊມ < ວັນ < ອາທິດ < ເດືອນ)
function durationToHours(label) {
  const m = String(label || '').match(/(\d+(?:\.\d+)?)\s*(.*)/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const n = parseFloat(m[1]);
  const u = (m[2] || '').trim().toLowerCase();
  if (/ຊມ|ຊົ່ວໂມງ|^h/.test(u)) return n;
  if (/ອາທິດ|ສັບປະດາ|^w/.test(u)) return n * 24 * 7;
  if (/ເດືອນ|^m/.test(u)) return n * 24 * 30;
  return n * 24;
}

export default {
  async fetch(request, env, ctx) {
    let response;
    try {
      response = await route(request, env, ctx);
    } catch (err) {
      // กัน Worker พังเป็นหน้า error ดิบ (เช่น KV โควต้าเต็ม / Supabase ล่ม) — ตอบ JSON/ข้อความอ่านง่ายแทน
      console.error('route crashed:', err && err.stack ? err.stack : err);
      const path = new URL(request.url).pathname;
      if (path.startsWith('/api/')) {
        response = new Response(JSON.stringify({ error: 'ລະບົບຂັດຂ້ອງຊົ່ວຄາວ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      } else if (path.startsWith('/auth/')) {
        response = authFailRedirect('server');
      } else {
        response = new Response('Server error — please try again', {
          status: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
    }
    return withSecurityHeaders(response);
  },
};

/* ---------- โหมดปิดปรับปรุง (maintenance) ----------
   สถานะหลักเก็บใน Supabase ตาราง site_settings (key = 'maintenance') เพราะอ่านแล้วได้ค่าล่าสุดทันที
   (เดิมเก็บใน KV อย่างเดียว ซึ่ง KV เป็น eventual consistency: edge cache อ่านค่าเก่านาน 30-60 วินาที
   ทำให้กดปิด/เปิดแล้วสถานะสลับไปมา บางคนเห็นเว็บเปิด บางคนเห็นหน้าปิด และปุ่มในห้องแอดมินโชว์ค่าเก่า)
   KV (SESSIONS key 'maintenance:on') ยังเขียนคู่ไว้เป็น fallback ถ้ายังไม่ได้สร้างตาราง (ดู supabase-site-settings.sql)
   - GET  /api/admin/maintenance   -> { on, at, by, consistency }   (เฉพาะแอดมิน)
   - POST /api/admin/maintenance   -> body { on: true/false }        (เฉพาะแอดมิน)
   - GET  /api/maintenance-status  -> { on, blocked }  (public — หน้าเว็บใช้เช็คเองเพื่อรีโหลดอัตโนมัติ)
   ระหว่างปิดเว็บ: ลูกค้าเห็นหน้า "ปิดปรับปรุง" (HTTP 503) ส่วนแอดมินที่ล็อกอินอยู่ใช้งานได้ปกติ */
const MAINTENANCE_KEY = 'maintenance:on';
const MAINT_DB_KEY = 'maintenance';
const MAINT_CACHE_MS = 4000;       // cache ต่อ isolate สั้นๆ กัน Supabase โดนยิงทุก request
const MAINT_DB_SKIP_MS = 30000;    // ถ้าตารางยังไม่มี/Supabase ล่ม ข้ามไปใช้ KV สักพัก ไม่ต้องรอ timeout ทุกครั้ง
let maintCache = null;             // { at, state }
let maintDbSkipUntil = 0;

function maintSupabaseReady(env) {
  return !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function maintSupabaseHeaders(env, extra) {
  return Object.assign({
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  }, extra || {});
}

/* อ่านจาก Supabase: คืน state ถ้าตารางมีอยู่, คืน null ถ้าอ่านไม่ได้/ตารางยังไม่ถูกสร้าง (ให้ไปใช้ KV แทน) */
async function readMaintenanceFromDb(env) {
  if (!maintSupabaseReady(env)) return null;
  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const res = await fetch(
    `${base}/rest/v1/site_settings?key=eq.${MAINT_DB_KEY}&select=value,updated_at&limit=1`,
    { headers: maintSupabaseHeaders(env), signal: AbortSignal.timeout(2500) }
  );
  if (!res.ok) {
    console.error('read maintenance from db failed:', res.status);
    return null;
  }
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  const v = (row && row.value) || {};
  return { on: v.on === true, at: (row && row.updated_at) || v.at || null, by: v.by || null, source: 'db' };
}

async function getMaintenanceState(env, fresh) {
  const now = Date.now();
  if (!fresh && maintCache && now - maintCache.at < MAINT_CACHE_MS) return maintCache.state;

  let state = null;
  if (fresh || now >= maintDbSkipUntil) {
    try {
      state = await readMaintenanceFromDb(env);
    } catch (err) {
      console.error('read maintenance from db failed:', err);
    }
    if (!state) maintDbSkipUntil = now + MAINT_DB_SKIP_MS;
  }
  if (!state) {
    try {
      state = { on: (await env.SESSIONS.get(MAINTENANCE_KEY)) === '1', at: null, by: null, source: 'kv' };
    } catch (err) {
      console.error('read maintenance flag from kv failed:', err);
    }
  }
  // อ่านพลาดทั้งคู่ -> ใช้ค่าล่าสุดที่รู้อยู่ (ไม่สลับเป็น "เปิดเว็บ" เพราะเน็ตกระตุกครั้งเดียว)
  if (!state) state = maintCache ? maintCache.state : { on: false, at: null, by: null, source: 'none' };

  maintCache = { at: now, state };
  return state;
}

/* บันทึกสถานะ: คืน { state, consistency } หรือ null ถ้าบันทึกไม่ได้ */
async function setMaintenanceState(env, on, by) {
  const at = new Date().toISOString();
  let dbOk = false;
  let tableMissing = !maintSupabaseReady(env);

  if (maintSupabaseReady(env)) {
    try {
      const base = env.SUPABASE_URL.replace(/\/$/, '');
      const res = await fetch(`${base}/rest/v1/site_settings?on_conflict=key`, {
        method: 'POST',
        headers: maintSupabaseHeaders(env, {
          'content-type': 'application/json',
          prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify([{ key: MAINT_DB_KEY, value: { on, by, at }, updated_at: at }]),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        dbOk = true;
      } else {
        const text = await res.text();
        console.error('write maintenance to db failed:', res.status, text);
        // 404 = ยังไม่ได้สร้างตาราง site_settings -> ใช้ KV อย่างเดียวได้ (ยังเป็นแบบเดิม)
        if (res.status === 404) tableMissing = true;
      }
    } catch (err) {
      console.error('write maintenance to db failed:', err);
    }
    // ตารางมีอยู่แต่เขียนไม่สำเร็จ (timeout/5xx): ห้ามเขียน KV อย่างเดียว ไม่งั้น DB กับ KV จะขัดกัน -> ให้แอดมินลองใหม่
    if (!dbOk && !tableMissing) return null;
  }

  let kvOk = false;
  try {
    if (on) await env.SESSIONS.put(MAINTENANCE_KEY, '1');
    else await env.SESSIONS.delete(MAINTENANCE_KEY);
    kvOk = true;
  } catch (err) {
    console.error('write maintenance flag to kv failed:', err);
  }
  if (!dbOk && !kvOk) return null;

  const state = { on, at, by, source: dbOk ? 'db' : 'kv' };
  maintCache = { at: Date.now(), state };
  maintDbSkipUntil = 0;
  return { state, consistency: dbOk ? 'strong' : 'eventual' };
}

/* อ่าน session แบบไม่ throw (session เสีย/JSON เพี้ยน ต้องไม่ทำให้ทั้งเว็บ 500 ตอนปิดปรับปรุง) */
async function getSessionUserSafe(request, env) {
  try {
    return await getSessionUser(request, env);
  } catch (err) {
    console.error('read session failed:', err);
    return null;
  }
}

async function handleMaintenance(request, env) {
  const user = await getSessionUserSafe(request, env);
  if (!user || !user.isAdmin) {
    return json({ error: 'ບໍ່ມີສິດເຂົ້າເຖິງ — ຕ້ອງລ໋ອກອິນເປັນແອດມິນກ່ອນ' }, 403);
  }

  if (request.method === 'GET') {
    const s = await getMaintenanceState(env, true);
    const res = json({ on: s.on, at: s.at, by: s.by, consistency: s.source === 'db' ? 'strong' : 'eventual' });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { body = null; }
    if (!body || typeof body.on !== 'boolean') {
      return json({ error: 'ຂໍ້ມູນບໍ່ຖືກຕ້ອງ (ຕ້ອງສົ່ງ on: true/false)' }, 400);
    }
    const result = await setMaintenanceState(env, body.on, user.username || user.email || null);
    if (!result) {
      return json({ error: 'ບັນທຶກສະຖານະບໍ່ໄດ້ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ' }, 502);
    }
    const s = result.state;
    return json({ on: s.on, at: s.at, by: s.by, consistency: result.consistency });
  }

  return json({ error: 'Method not allowed' }, 405);
}

/* public: หน้าเว็บ/หน้าปิดปรับปรุงเรียกเช็คเอง (ดู maintenance-watch.js)
   blocked = เว็บปิดอยู่ "และ" คนนี้ไม่ใช่แอดมิน (แอดมินเข้าเว็บได้ตามปกติ จึงไม่ถูกรีโหลดวน) */
async function handleMaintenanceStatus(request, env) {
  const s = await getMaintenanceState(env, false);
  let blocked = s.on;
  if (blocked) {
    const user = await getSessionUserSafe(request, env);
    if (user && user.isAdmin) blocked = false;
  }
  const res = json({ on: s.on, blocked });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

const MAINTENANCE_HTML = `<!doctype html>
<html lang="lo" data-maintenance><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="60">
<title>ເວັບປິດປັບປຸງຊົ່ວຄາວ</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  html,body{height:100%;margin:0}
  body{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;
       background:radial-gradient(ellipse at 50% 38%,#17203a 0%,#0b0e17 55%,#07090f 100%);
       color:#e8eaf0;font-family:"Noto Sans Lao",system-ui,-apple-system,"Noto Sans Thai",sans-serif;
       text-align:center;padding:24px}

  /* พื้นหลังตาราง + แสงสีเคลื่อนไหว */
  .grid{position:absolute;inset:0;pointer-events:none;
        background-image:linear-gradient(rgba(120,140,255,.07) 1px,transparent 1px),
                         linear-gradient(90deg,rgba(120,140,255,.07) 1px,transparent 1px);
        background-size:44px 44px;
        -webkit-mask-image:radial-gradient(ellipse at center,#000 15%,transparent 70%);
        mask-image:radial-gradient(ellipse at center,#000 15%,transparent 70%);
        animation:gridmove 14s linear infinite}
  @keyframes gridmove{to{background-position:44px 44px}}
  .blob{position:absolute;border-radius:50%;filter:blur(70px);opacity:.5;pointer-events:none}
  .b1{width:300px;height:300px;background:#4f46e5;top:-80px;left:-90px;animation:drift 12s ease-in-out infinite alternate}
  .b2{width:260px;height:260px;background:#06b6d4;bottom:-90px;right:-70px;animation:drift 15s ease-in-out infinite alternate-reverse}
  @keyframes drift{to{transform:translate(40px,30px) scale(1.15)}}

  /* อนุภาคลอยขึ้น */
  .sp{position:absolute;bottom:-10px;width:4px;height:4px;border-radius:50%;background:#7dd3fc;
      box-shadow:0 0 8px #38bdf8;opacity:0;animation:rise 9s linear infinite}
  .sp:nth-child(1){left:8%;animation-delay:0s}
  .sp:nth-child(2){left:22%;animation-delay:2.2s;background:#c4b5fd;box-shadow:0 0 8px #a78bfa}
  .sp:nth-child(3){left:37%;animation-delay:5s}
  .sp:nth-child(4){left:58%;animation-delay:1.1s;background:#fda4af;box-shadow:0 0 8px #fb7185}
  .sp:nth-child(5){left:73%;animation-delay:3.6s}
  .sp:nth-child(6){left:88%;animation-delay:6.4s;background:#c4b5fd;box-shadow:0 0 8px #a78bfa}
  @keyframes rise{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:.9}100%{transform:translateY(-105vh) scale(1.2);opacity:0}}

  .box{position:relative;z-index:1;max-width:440px;width:100%}

  /* ไอคอนเฟือง */
  .icon{position:relative;width:240px;height:200px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;
        animation:float 4.5s ease-in-out infinite}
  @keyframes float{50%{transform:translateY(-8px)}}
  .halo{position:absolute;width:190px;height:190px;border-radius:50%;
        background:radial-gradient(circle,rgba(99,102,241,.45),rgba(56,189,248,.12) 55%,transparent 72%);
        animation:pulse 3s ease-in-out infinite}
  @keyframes pulse{50%{transform:scale(1.18);opacity:.65}}
  .orbit{position:absolute;width:210px;height:210px;border-radius:50%;border:1px dashed rgba(148,163,255,.35);
         animation:spin 22s linear infinite}
  .orbit::after{content:"";position:absolute;top:-4px;left:50%;margin-left:-4px;width:8px;height:8px;border-radius:50%;
         background:#fff;box-shadow:0 0 10px 3px #38bdf8}
  @keyframes spin{to{transform:rotate(360deg)}}
  .icon svg{position:relative;width:230px;height:auto;overflow:visible;
            filter:drop-shadow(0 0 10px rgba(99,102,241,.7)) drop-shadow(0 0 22px rgba(56,189,248,.35))}

  /* ป้ายสถานะ */
  .chip{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;
        background:rgba(99,102,241,.14);border:1px solid rgba(129,140,248,.4);
        font-size:12px;font-weight:600;letter-spacing:.22em;color:#c7d2fe;margin-bottom:16px}
  .chip i{width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 0 0 rgba(52,211,153,.7);animation:ping 1.8s ease-out infinite}
  @keyframes ping{to{box-shadow:0 0 0 10px rgba(52,211,153,0)}}

  h1{margin:0 0 12px;font-size:28px;font-weight:800;line-height:1.35;
     background:linear-gradient(100deg,#e0e7ff 20%,#7dd3fc 40%,#c4b5fd 60%,#e0e7ff 80%);background-size:250% 100%;
     -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;
     animation:shine 5s linear infinite}
  @keyframes shine{to{background-position:-250% 0}}
  p{margin:0;color:#aab0bd;line-height:1.8;font-size:15px}

  /* แถบโหลด */
  .bar{position:relative;height:5px;width:220px;margin:26px auto 0;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
  .bar::after{content:"";position:absolute;top:0;left:0;height:100%;width:40%;border-radius:99px;
              background:linear-gradient(90deg,transparent,#38bdf8,#a78bfa,transparent);animation:load 1.8s ease-in-out infinite}
  @keyframes load{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}

  @media (prefers-reduced-motion:reduce){
    *,*::before,*::after{animation:none!important}
  }
</style></head>
<body>
<div class="grid"></div><div class="blob b1"></div><div class="blob b2"></div>
<span class="sp"></span><span class="sp"></span><span class="sp"></span><span class="sp"></span><span class="sp"></span><span class="sp"></span>
<div class="box">
  <div class="icon" aria-hidden="true">
    <div class="halo"></div><div class="orbit"></div>
    <svg viewBox="-56 -58 150 116" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#a78bfa"/></linearGradient>
        <linearGradient id="gB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f472b6"/><stop offset="1" stop-color="#fb923c"/></linearGradient>
        <linearGradient id="fA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#232b4a"/><stop offset="1" stop-color="#121730"/></linearGradient>
        <linearGradient id="fB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2238"/><stop offset="1" stop-color="#1c1224"/></linearGradient>
      </defs>
      <g transform="rotate(-18)">
        <g transform="translate(0,0)">
          <g>
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="12s" repeatCount="indefinite"/>
            <path fill-rule="evenodd" fill="url(#fA)" stroke="url(#gA)" stroke-width="1.6" stroke-linejoin="round" d="M32.07 -5.25L38.74 -4.48L38.74 4.48L32.07 5.25A32.50 32.50 0 0 1 30.40 11.49L35.79 15.49L31.31 23.25L25.15 20.58A32.50 32.50 0 0 1 20.58 25.15L23.25 31.31L15.49 35.79L11.49 30.40A32.50 32.50 0 0 1 5.25 32.07L4.48 38.74L-4.48 38.74L-5.25 32.07A32.50 32.50 0 0 1 -11.49 30.40L-15.49 35.79L-23.25 31.31L-20.58 25.15A32.50 32.50 0 0 1 -25.15 20.58L-31.31 23.25L-35.79 15.49L-30.40 11.49A32.50 32.50 0 0 1 -32.07 5.25L-38.74 4.48L-38.74 -4.48L-32.07 -5.25A32.50 32.50 0 0 1 -30.40 -11.49L-35.79 -15.49L-31.31 -23.25L-25.15 -20.58A32.50 32.50 0 0 1 -20.58 -25.15L-23.25 -31.31L-15.49 -35.79L-11.49 -30.40A32.50 32.50 0 0 1 -5.25 -32.07L-4.48 -38.74L4.48 -38.74L5.25 -32.07A32.50 32.50 0 0 1 11.49 -30.40L15.49 -35.79L23.25 -31.31L20.58 -25.15A32.50 32.50 0 0 1 25.15 -20.58L31.31 -23.25L35.79 -15.49L30.40 -11.49A32.50 32.50 0 0 1 32.07 -5.25 ZM12.00 0 A12.00 12.00 0 1 0 -12.00 0 A12.00 12.00 0 1 0 12.00 0 Z"/>
            <circle r="22" fill="none" stroke="url(#gA)" stroke-width="1" stroke-dasharray="3 5" opacity=".7"/>
            <circle r="5" fill="url(#gA)"/>
          </g>
        </g>
        <g transform="translate(60,0)">
          <g>
            <animateTransform attributeName="transform" type="rotate" from="22.5" to="-337.5" dur="8s" repeatCount="indefinite"/>
            <path fill-rule="evenodd" fill="url(#fB)" stroke="url(#gB)" stroke-width="1.6" stroke-linejoin="round" d="M19.90 -4.94L26.60 -4.64L26.60 4.64L19.90 4.94A20.50 20.50 0 0 1 17.56 10.57L22.09 15.53L15.53 22.09L10.57 17.56A20.50 20.50 0 0 1 4.94 19.90L4.64 26.60L-4.64 26.60L-4.94 19.90A20.50 20.50 0 0 1 -10.57 17.56L-15.53 22.09L-22.09 15.53L-17.56 10.57A20.50 20.50 0 0 1 -19.90 4.94L-26.60 4.64L-26.60 -4.64L-19.90 -4.94A20.50 20.50 0 0 1 -17.56 -10.57L-22.09 -15.53L-15.53 -22.09L-10.57 -17.56A20.50 20.50 0 0 1 -4.94 -19.90L-4.64 -26.60L4.64 -26.60L4.94 -19.90A20.50 20.50 0 0 1 10.57 -17.56L15.53 -22.09L22.09 -15.53L17.56 -10.57A20.50 20.50 0 0 1 19.90 -4.94 ZM8.00 0 A8.00 8.00 0 1 0 -8.00 0 A8.00 8.00 0 1 0 8.00 0 Z"/>
            <circle r="14" fill="none" stroke="url(#gB)" stroke-width="1" stroke-dasharray="2 4" opacity=".7"/>
            <circle r="3.5" fill="url(#gB)"/>
          </g>
        </g>
      </g>
    </svg>
  </div>
  <div class="chip"><i></i>MAINTENANCE</div>
  <h1>ເວັບປິດປັບປຸງຊົ່ວຄາວ</h1>
  <p>ພວກເຮົາກຳລັງປັບປຸງລະບົບ ກະລຸນາກັບມາໃໝ່ໃນພາຍຫຼັງ<br>ຂໍອະໄພໃນຄວາມບໍ່ສະດວກ</p>
  <div class="bar"></div>
</div>
<script src="/maintenance-watch.js?v=20261014a"></script>
</body></html>`;

/* คืน Response (หน้าปิดปรับปรุง/JSON 503) ถ้าต้องบล็อก, คืน null ถ้าปล่อยผ่าน */
async function maintenanceGate(request, env, url) {
  const path = url.pathname;

  // ไฟล์ static (css/js/รูป/ฟอนต์) ปล่อยผ่านเสมอ — หน้าปิดปรับปรุงและหน้า login ต้องใช้
  const lastSeg = path.split('/').pop() || '';
  if (lastSeg.includes('.') && !lastSeg.endsWith('.html')) return null;

  // ต้องปล่อยให้แอดมินล็อกอินได้ แม้เว็บปิดอยู่
  if (path.startsWith('/auth/')) return null;
  if (path === '/api/me') return null;
  if (path === '/login.html' || path === '/admin.html') return null;
  // กรณี Cloudflare redirect /login.html -> /login (clean URL) แอดมินต้องยังเข้าได้
  if (path === '/login' || path === '/admin') return null;

  const state = await getMaintenanceState(env, false);
  if (!state.on) return null;

  const user = await getSessionUserSafe(request, env);
  if (user && user.isAdmin) return null;

  const headers = { 'Cache-Control': 'no-store', 'Retry-After': '300' };
  if (path.startsWith('/api/')) {
    return new Response(
      JSON.stringify({ error: 'ເວັບປິດປັບປຸງຢູ່ຊົ່ວຄາວ', maintenance: true }),
      { status: 503, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
  return new Response(MAINTENANCE_HTML, {
    status: 503,
    headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/* ---------- helper: อ่านค่า cookie จาก request ---------- */
function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

/* ---------- helper: ปลายทางหลังล็อกอิน ต้องเป็น path ภายในเว็บเราเท่านั้น ----------
   กัน open redirect: ?next=//evil.com หรือ /\\evil.com เดิมผ่านเช็ค startsWith('/') ได้ แล้วถูกเด้งออกนอกเว็บหลังล็อกอิน */
function safeNextPath(raw) {
  if (typeof raw !== 'string' || raw.length > 512) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/' + String.fromCharCode(92))) return '/';
  if (/[\u0000-\u001f\u007f]/.test(raw)) return '/';
  return raw;
}

/* ---------- helper: ล็อกอินไม่สำเร็จ -> กลับหน้า login พร้อมรหัส error (หน้า login แสดงข้อความให้ผู้ใช้เอง) ---------- */
function authFailRedirect(code) {
  const headers = new Headers({
    Location: `/login.html?error=${encodeURIComponent(code)}`,
    'Cache-Control': 'no-store',
  });
  headers.append('Set-Cookie', 'oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  headers.append('Set-Cookie', 'oauth_next=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return new Response(null, { status: 302, headers });
}

/* ---------- helper: ครอบ callback ของ OAuth — เกิด exception (เน็ตตัด/JSON เพี้ยน) ต้องไม่ขึ้นหน้า error ดิบ ---------- */
async function safeAuthCallback(fn, request, env) {
  try {
    return await fn(request, env);
  } catch (err) {
    console.error('OAuth callback crashed:', err && err.message ? err.message : err);
    return authFailRedirect('server');
  }
}

/* ---------- helper: ผู้ใช้กดยกเลิก/ผู้ให้บริการส่ง ?error= กลับมา ---------- */
function oauthProviderErrorRedirect(url) {
  const err = url.searchParams.get('error');
  if (!err) return null;
  return authFailRedirect(err === 'access_denied' ? 'cancelled' : 'provider');
}

/* ---------- 1) /auth/discord/login ----------
   สร้างค่า "state" แบบสุ่ม (กัน CSRF), เก็บไว้ใน cookie ชั่วคราว,
   แล้วเด้งผู้ใช้ไปหน้า authorize ของ Discord */
async function handleLogin(request, env) {
  const state = crypto.randomUUID();
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/auth/discord/callback`;

  // ปลายทางที่จะเด้งกลับไปหลังล็อกอินสำเร็จ (เช่น /admin.html) — กันเปิดลิงก์ไปเว็บอื่น
  const next = safeNextPath(url.searchParams.get('next') || '/');

  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify email', // ต้องมี email เพื่อเอาไว้เช็คสิทธิ์แอดมิน
    state,
  });

  const headers = new Headers({
    Location: `https://discord.com/api/oauth2/authorize?${params.toString()}`,
  });
  headers.append(
    'Set-Cookie',
    `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );
  headers.append(
    'Set-Cookie',
    `oauth_next=${encodeURIComponent(next)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );

  return new Response(null, { status: 302, headers });
}

/* ---------- 2) /auth/discord/callback ----------
   Discord ส่ง ?code=...&state=... กลับมาที่นี่
   ขั้นตอน: ตรวจ state -> แลก code เป็น token -> ดึงข้อมูลผู้ใช้ -> สร้าง session */
async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = getCookie(request, 'oauth_state');

  const providerErr = oauthProviderErrorRedirect(url);
  if (providerErr) return providerErr;

  if (!code || !state || !savedState || state !== savedState) {
    return authFailRedirect('state');
  }

  const redirectUri = `${url.origin}/auth/discord/callback`;
  const nextPath = safeNextPath(getCookie(request, 'oauth_next') || '/');

  // ---- แลก code เป็น access_token (ต้องทำฝั่ง server เท่านั้น เพราะใช้ client_secret) ----
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('Discord token exchange failed:', errText);
    return authFailRedirect('provider');
  }
  const tokenData = await tokenRes.json();

  // ---- ใช้ access_token ดึงข้อมูลผู้ใช้ ----
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const discordUser = await userRes.json().catch(() => null);
  if (!userRes.ok || !discordUser || !discordUser.id) {
    console.error('Discord userinfo failed: status', userRes.status);
    return authFailRedirect('profile');
  }

  // ---- เช็คสิทธิ์แอดมิน: อีเมล Discord ต้องอยู่ใน ADMIN_EMAILS และต้องยืนยันแล้ว ----
  const isAdmin =
    !!discordUser.email &&
    discordUser.verified === true &&
    ADMIN_EMAILS.some(e => e.toLowerCase() === discordUser.email.toLowerCase());

  // ---- สร้าง session (คุกกี้ลงลายเซ็น — ไม่พึ่ง KV) อายุ 7 วัน ----
  const sessionData = {
    id: discordUser.id,
    username: discordUser.global_name || discordUser.username,
    email: discordUser.email || null,
    avatar: discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null,
    isAdmin,
    discordLinked: true,
    createdAt: Date.now(),
  };

  const sessionId = await createSession(env, sessionData);

  // ---- แจ้งเตือนเข้า Discord: มีคนล็อกอินผ่าน Discord ----
  await sendDiscordAlert(env, {
    title: '🔐 ລ໋ອກອິນສຳເລັດ (Discord)',
    color: 0x5865f2, // สี Discord blurple
    fields: [
      { name: 'ຊື່', value: sessionData.username || '-', inline: true },
      { name: 'ອີເມວ', value: sessionData.email || '-', inline: true },
      { name: 'Discord ID', value: sessionData.id || '-', inline: true },
      { name: 'ແອດມິນ?', value: isAdmin ? 'ແມ່ນ ✅' : 'ບໍ່ແມ່ນ', inline: true },
    ],
  });

  // ---- ปิด session ด้วย cookie แล้วเด้งกลับไปยังปลายทางเดิม (เช่น /admin.html) ----
  const headers = new Headers({ Location: nextPath, 'Cache-Control': 'no-store' });
  headers.append(
    'Set-Cookie',
    `session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
  );
  headers.append('Set-Cookie', 'oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'); // ล้าง state cookie ทิ้ง
  headers.append('Set-Cookie', 'oauth_next=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'); // ล้าง next cookie ทิ้ง

  return new Response(null, { status: 302, headers });
}

/* ---------- 2.5) /auth/google/login ----------
   ทำงานแบบเดียวกับ /auth/discord/login เป๊ะๆ: สร้าง "state" กัน CSRF,
   เก็บไว้ใน cookie ชั่วคราว แล้วเด้งผู้ใช้ไปหน้า consent ของ Google */
async function handleGoogleLogin(request, env) {
  const state = crypto.randomUUID();
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/auth/google/callback`;

  const next = safeNextPath(url.searchParams.get('next') || '/');

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile', // ขอ email มาด้วยเพื่อไว้เช็คสิทธิ์แอดมิน เหมือนฝั่ง Discord
    state,
    access_type: 'online',
    prompt: 'select_account', // บังคับให้เลือกบัญชีทุกครั้ง กันกรณีเบราว์เซอร์จำบัญชี Google ไว้หลายอัน
  });

  const headers = new Headers({
    Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  });
  headers.append(
    'Set-Cookie',
    `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );
  headers.append(
    'Set-Cookie',
    `oauth_next=${encodeURIComponent(next)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );

  return new Response(null, { status: 302, headers });
}

/* ---------- 2.6) /auth/google/callback ----------
   Google ส่ง ?code=...&state=... กลับมาที่นี่
   ขั้นตอน: ตรวจ state -> แลก code เป็น token -> ดึงข้อมูลผู้ใช้จาก userinfo endpoint
   -> สร้าง session (ใช้ helper createSession ตัวเดียวกับ email login เพื่อลดโค้ดซ้ำ) */
async function handleGoogleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = getCookie(request, 'oauth_state');

  const providerErr = oauthProviderErrorRedirect(url);
  if (providerErr) return providerErr;

  if (!code || !state || !savedState || state !== savedState) {
    return authFailRedirect('state');
  }

  const redirectUri = `${url.origin}/auth/google/callback`;
  const nextPath = safeNextPath(getCookie(request, 'oauth_next') || '/');

  // ---- แลก code เป็น access_token (ต้องทำฝั่ง server เท่านั้น เพราะใช้ client_secret) ----
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('Google token exchange failed:', errText);
    return authFailRedirect('provider');
  }
  const tokenData = await tokenRes.json();

  // ---- ใช้ access_token ดึงข้อมูลผู้ใช้ ----
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const googleUser = await userRes.json().catch(() => null);
  if (!userRes.ok || !googleUser || !googleUser.sub) {
    console.error('Google userinfo failed: status', userRes.status);
    return authFailRedirect('profile');
  }

  // ---- เช็คสิทธิ์แอดมิน: ใช้ ADMIN_EMAILS ลิสต์เดียวกับฝั่ง Discord ----
  const isAdmin =
    !!googleUser.email &&
    googleUser.email_verified === true &&
    ADMIN_EMAILS.some(e => e.toLowerCase() === googleUser.email.toLowerCase());

  const sessionId = await createSession(env, {
    id: googleUser.sub,
    username: googleUser.name || (googleUser.email || '').split('@')[0],
    email: googleUser.email || null,
    avatar: googleUser.picture || null,
    isAdmin,
    discordLinked: false,
    googleLinked: true,
    createdAt: Date.now(),
  });

  // ---- แจ้งเตือนเข้า Discord: มีคนล็อกอินผ่าน Google ----
  await sendDiscordAlert(env, {
    title: '🔐 ລ໋ອກອິນສຳເລັດ (Google)',
    color: 0x4285f4, // สี Google blue
    fields: [
      { name: 'ຊື່', value: googleUser.name || '-', inline: true },
      { name: 'ອີເມວ', value: googleUser.email || '-', inline: true },
      { name: 'ແອດມິນ?', value: isAdmin ? 'ແມ່ນ ✅' : 'ບໍ່ແມ່ນ', inline: true },
    ],
  });

  const headers = new Headers({ Location: nextPath, 'Cache-Control': 'no-store' });
  headers.append(
    'Set-Cookie',
    `session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
  );
  headers.append('Set-Cookie', 'oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  headers.append('Set-Cookie', 'oauth_next=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');

  return new Response(null, { status: 302, headers });
}

/* ---------- 3) /auth/logout ---------- */
async function handleLogout() {
  const headers = new Headers({ Location: '/', 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return new Response(null, { status: 302, headers });
}

/* ---------- 4) /api/me ----------
   หน้าเว็บเรียก endpoint นี้ตอนโหลด เพื่อเช็คว่า login ค้างอยู่ไหม
   ก่อนหน้านี้ user object ที่คืนกลับไปมาจาก session อย่างเดียว ไม่เคยมีฟิลด์
   "balance" เลย (เมนู dropdown/หน้าโปรไฟล์ที่อ่าน user.balance เลยเห็นเป็น 0
   ตลอด ต่อให้แอดมินกด "ยืนยัน" เติมเงินแล้ว wallets ในฐานข้อมูลบวกเพิ่มจริงก็ตาม)
   ตอนนี้ดึงยอดจริงจากตาราง wallets มาแนบให้ทุกครั้งที่เรียก */
async function handleMe(request, env) {
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser) {
    return json({ loggedIn: false });
  }

  // จำรูปโปรไฟล์ไว้ใน KV (profile:<id>) ให้หน้าจัดอันดับ — ไม่ block response ถ้าพลาด
  try { await rememberProfile(env, sessionUser); } catch (err) { console.error('rememberProfile failed:', err); }

  let balance = 0;
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const rows = await supabaseSelect(env, 'wallets', {
        select: 'balance',
        user_id: `eq.${sessionUser.id}`,
        limit: '1',
      });
      balance = (rows && rows[0] && Number(rows[0].balance)) || 0;
    } catch (err) {
      console.error('handleMe: ดึงຍອດເງິນຈາກ wallets ບໍ່ສຳເລັດ', err);
    }
  }

  // hasPassword: ໜ້າໂປຣໄຟລ໌ໃຊ້ຄ່ານີ້ຕັດສິນວ່າຈະໂຊວ໌ຟອມ "ຕັ້ງລະຫັດຜ່ານ" (ບັນຊີ Discord/Google
  // ລ້ວນໆ) ຫຼື "ປ່ຽນລະຫັດຜ່ານ" (ຕ້ອງໃສ່ລະຫັດເກົ່າກ່ອນ, ບັນຊີອີເມວ/ລະຫັດຜ່ານ) — ເບິ່ງ
  // handleChangePassword ດ້ານລຸ່ມ
  const hasPassword = !!sessionUser.passwordAuth;
  // โปรไฟล์ที่ผู้ใช้แก้เอง (ชื่อ/รูปอัปโหลด) ทับค่าจาก session
  const custom = await readCustom(env, sessionUser.id);
  const merged = { ...sessionUser };
  if (typeof custom.username === 'string' && custom.username) merged.username = custom.username;
  if (isAvatarUrl(custom.avatar)) merged.avatar = custom.avatar;
  return json({ loggedIn: true, user: { ...merged, balance, hasPassword } });
}

/* ---------- helper: จำรูปโปรไฟล์ผู้ใช้ (KV: profile:<user.id>) ----------
   รูปโปรไฟล์มาจาก Discord/Google ตอน login และอยู่ใน session เท่านั้น (ไม่มีตาราง profiles ใน Supabase)
   หน้าจัดอันดับต้องเห็นรูปของ "คนอื่น" จึงบันทึกลง KV แยกต่างหากทุกครั้งที่ /api/me ถูกเรียก
   (เขียนเฉพาะตอนค่าเปลี่ยน/ยังไม่มี — ไม่มี TTL) ; เก็บเฉพาะ URL รูปสาธารณะ ไม่เก็บอีเมล */
async function rememberProfile(env, user) {
  if (!user || !user.id) return;
  const avatar = typeof user.avatar === 'string' && /^https:\/\//.test(user.avatar) ? user.avatar : null;
  if (!avatar) return;
  // profile:<id> = รูปจาก Discord/Google เท่านั้น ({ avatar }) — ข้อมูลที่ผู้ใช้แก้เอง (ชื่อ/รูปอัปโหลด) อยู่คนละ key
  // (pcustom:<id>) เพื่อไม่ให้ "อ่านค่าเก่าจาก KV (eventual consistency) แล้วเขียนทับ" ทำให้รูปที่เพิ่งอัปโหลดหาย
  let cur = null;
  try { const raw = await env.SESSIONS.get(`profile:${user.id}`); cur = raw ? JSON.parse(raw) : null; } catch { cur = null; }
  if (cur && cur.avatar === avatar) return;
  await env.SESSIONS.put(`profile:${user.id}`, JSON.stringify({ avatar }));
}

/* ---------- ข้อมูลที่ผู้ใช้แก้เอง (KV: pcustom:<id>) = { username?, avatar? } เขียนโดย handleUpdateProfile/Avatar เท่านั้น ---------- */
async function readCustom(env, userId, pre) {
  let c = {};
  // 1) Supabase (ตาราง user_profiles) = แหล่งจริง — อ่านสดทุกครั้ง ไม่มีแคช จึงไม่เกิดอาการรูป/ชื่อ "เด้งกลับ" หลังรีเฟรช
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      let r;
      if (pre !== undefined) r = pre;   // มีแถวที่ดึงมาล่วงหน้าแล้ว (หรือ null = ไม่มีแถว) → ไม่ต้องยิง query ซ้ำ
      else {
        const rows = await supabaseSelect(env, 'user_profiles', {
          select: 'username,avatar_hash,avatar_version',
          user_id: `eq.${userId}`,
          limit: '1',
        });
        r = rows && rows[0];
      }
      if (r) {
        if (r.username) c.username = r.username;
        if (r.avatar_hash && /^[0-9a-f]{24}$/.test(r.avatar_hash)) {
          c.avatar = `/api/public/avatar/${r.avatar_hash}?v=${Number(r.avatar_version) || 0}`;
        }
      }
    } catch (err) { console.error('readCustom: อ่าน user_profiles ไม่สำเร็จ', err); }
    if (c.avatar && c.username) return c;
  }
  // 2) KV รุ่นเก่า (สำรอง — ผู้ใช้ที่เคยอัปโหลดไว้ก่อนย้ายมา Supabase)
  try {
    const raw = await env.SESSIONS.get(`pcustom:${userId}`);
    const p = raw ? JSON.parse(raw) : null;
    if (p && typeof p === 'object') c = { ...p, ...c };
  } catch { /* ใช้ค่าว่าง */ }
  // รองรับข้อมูลเดิมที่เคยเก็บใน profile:<id> (รุ่นก่อน: custom:true / username)
  if (!c.avatar || !c.username) {
    try {
      const raw = await env.SESSIONS.get(`profile:${userId}`);
      const old = raw ? JSON.parse(raw) : null;
      if (old) {
        if (!c.username && typeof old.username === 'string' && old.username) c.username = old.username;
        if (!c.avatar && old.custom && isAvatarUrl(old.avatar)) c.avatar = old.avatar;
      }
    } catch { /* ข้าม */ }
  }
  return c;
}

function isAvatarUrl(a) {
  return typeof a === 'string' && (/^https:\/\//.test(a) || /^\/api\/public\/avatar\/[0-9a-f]{24}(\?v=\d+)?$/.test(a));
}
async function avatarHash(userId) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('avatar:' + userId));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- POST /api/account/update-profile  { username } ----------
   เปลี่ยนชื่อที่แสดง — เก็บใน KV profile:<id>.username แล้ว /api/me เอาไปทับชื่อจาก session/Discord/Google
   (ใช้ได้ทุกบัญชีและมีผลทุกเครื่อง) ; จำกัด 5 ครั้ง/ชั่วโมง */
async function handleUpdateProfile(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: 'ກະລຸນາລ໋ອກອິນກ່ອນ', requireLogin: true }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'ຂໍ້ມູນທີ່ສົ່ງມາບໍ່ຖືກຕ້ອງ' }, 400); }

  const username = String(body.username || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!/^[\p{L}\p{M}\p{N} ._-]{2,24}$/u.test(username)) {
    return json({ error: 'ຊື່ຕ້ອງມີ 2-24 ໂຕ (ຕົວອັກສອນ ຕົວເລກ ຍະຫວ່າງ . _ - ເທົ່ານັ້ນ)' }, 400);
  }
  if (await isRateLimited(env, `pfnamelimit:${user.id}`, 5, 60 * 60)) {
    return json({ error: 'ປ່ຽນຊື່ຫຼາຍເທື່ອເກີນໄປ ກະລຸນາລໍຖ້າ 1 ຊົ່ວໂມງ' }, 429);
  }
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await supabaseUpsert(env, 'user_profiles', 'user_id', { user_id: String(user.id), username, updated_at: new Date().toISOString() });
    } catch (err) {
      console.error('update-profile: เขียน user_profiles ไม่สำเร็จ', err);
      return json({ error: 'ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່' }, 500);
    }
  } else {
    const custom = await readCustom(env, user.id);
    await env.SESSIONS.put(`pcustom:${user.id}`, JSON.stringify({ ...custom, username }));
  }
  await bumpRateLimit(env, `pfnamelimit:${user.id}`, 60 * 60);
  return json({ ok: true, username });
}

/* ---------- POST /api/account/avatar  { image: "data:image/jpeg;base64,..." } หรือ { remove: true } ----------
   หน้าเว็บย่อรูปเป็น JPEG สี่เหลี่ยมจัตุรัส ~256px ก่อนส่ง ; ฝั่งนี้ตรวจซ้ำ (ชนิด/magic bytes/ขนาด ≤ ~120KB)
   เก็บ base64 ใน KV avatarimg:<hash> (hash มาจาก user id — ไม่เปิดเผย id) แล้วเสิร์ฟผ่าน /api/public/avatar/<hash>
   remove: ลบรูปที่อัปโหลด กลับไปใช้รูปจาก Discord/Google (ถ้ามี) ; จำกัด 10 ครั้ง/ชั่วโมง */
async function handleUpdateAvatar(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: 'ກະລຸນາລ໋ອກອິນກ່ອນ', requireLogin: true }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'ຂໍ້ມູນທີ່ສົ່ງມາບໍ່ຖືກຕ້ອງ' }, 400); }
  if (await isRateLimited(env, `pfavatarlimit:${user.id}`, 10, 60 * 60)) {
    return json({ error: 'ປ່ຽນຮູບຫຼາຍເທື່ອເກີນໄປ ກະລຸນາລໍຖ້າ 1 ຊົ່ວໂມງ' }, 429);
  }
  const hash = await avatarHash(user.id);
  const custom = await readCustom(env, user.id);

  const useDb = !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

  if (body.remove) {
    if (useDb) {
      try {
        await supabaseUpsert(env, 'user_profiles', 'user_id', {
          user_id: String(user.id), avatar_b64: null, avatar_hash: null, avatar_version: null, updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('avatar remove: เขียน user_profiles ไม่สำเร็จ', err);
        return json({ error: 'ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່' }, 500);
      }
    }
    await env.SESSIONS.delete(`avatarimg:${hash}`);
    const provider = typeof user.avatar === 'string' && /^https:\/\//.test(user.avatar) ? user.avatar : null;
    const { avatar: _drop, ...rest } = custom;
    await env.SESSIONS.put(`pcustom:${user.id}`, JSON.stringify(rest));
    // ข้อมูลเดิมรุ่นก่อนที่เคยเก็บ custom ใน profile:<id> ต้องล้างด้วย ไม่งั้น readCustom จะอ่านกลับมา
    await env.SESSIONS.put(`profile:${user.id}`, JSON.stringify({ avatar: provider }));
    await bumpRateLimit(env, `pfavatarlimit:${user.id}`, 60 * 60);
    return json({ ok: true, avatar: provider });
  }

  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(body.image || ''));
  if (!m) return json({ error: 'ຮອງຮັບສະເພາະຮູບ JPEG ທີ່ຍ່ອມາຈາກໜ້າເວັບ' }, 400);
  const b64 = m[1];
  if (b64.length > 160000) return json({ error: 'ຮູບໃຫຍ່ເກີນໄປ' }, 413);
  let head;
  try { head = atob(b64.slice(0, 8)); } catch { return json({ error: 'ຮູບບໍ່ຖືກຕ້ອງ' }, 400); }
  if (b64.length < 200 || head.charCodeAt(0) !== 0xff || head.charCodeAt(1) !== 0xd8 || head.charCodeAt(2) !== 0xff) {
    return json({ error: 'ຮູບບໍ່ຖືກຕ້ອງ' }, 400);
  }

  const version = Date.now();
  const url = `/api/public/avatar/${hash}?v=${version}`;
  if (useDb) {
    try {
      await supabaseUpsert(env, 'user_profiles', 'user_id', {
        user_id: String(user.id), avatar_b64: b64, avatar_hash: hash, avatar_version: version, updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('avatar upload: เขียน user_profiles ไม่สำเร็จ', err);
      return json({ error: 'ບັນທຶກຮູບບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່' }, 500);
    }
  } else {
    await env.SESSIONS.put(`avatarimg:${hash}`, b64);
    await env.SESSIONS.put(`pcustom:${user.id}`, JSON.stringify({ ...custom, avatar: url }));
  }
  await bumpRateLimit(env, `pfavatarlimit:${user.id}`, 60 * 60);
  return json({ ok: true, avatar: url });
}

/* ---------- GET /api/public/avatar/<hash> : เสิร์ฟรูปที่ผู้ใช้อัปโหลด (ใช้ในหน้าจัดอันดับ/เมนู) ---------- */
async function handlePublicAvatar(env, url) {
  const hash = url.pathname.split('/').pop();
  if (!/^[0-9a-f]{24}$/.test(hash)) return new Response('Not found', { status: 404 });
  let raw = null;
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const rows = await supabaseSelect(env, 'user_profiles', { select: 'avatar_b64', avatar_hash: `eq.${hash}`, limit: '1' });
      raw = rows && rows[0] && rows[0].avatar_b64 ? rows[0].avatar_b64 : null;
    } catch (err) { console.error('public avatar: อ่าน user_profiles ไม่สำเร็จ', err); }
  }
  if (!raw) raw = await env.SESSIONS.get(`avatarimg:${hash}`); // สำรอง: รูปเก่าใน KV
  if (!raw) return new Response('Not found', { status: 404 });
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'public, max-age=86400',
      'x-content-type-options': 'nosniff',
    },
  });
}

/* ---------- helper: ดึงรูปโปรไฟล์ย้อนหลังจาก session ที่ยัง active (ใช้ตอนคนใน top 10 ยังไม่มี profile:<id>) ----------
   session เก็บใน KV (อายุ 7 วัน) พร้อม avatar อยู่แล้ว แต่ไม่มี index ตาม user id จึงไล่ list แล้วหาตัวที่ id ตรง
   - อ่านไม่เกิน MAX_READS session ต่อครั้ง (กัน subrequest limit ของ Worker) ; พลาดตรงไหนข้ามไป ไม่ให้หน้าอันดับพัง
   - คนที่หาไม่เจอ จะจดผลว่า "ยังไม่มีรูป" ไว้ 1 ชั่วโมง (TTL) กันสแกนซ้ำทุกครั้ง ;
     พอคนนั้น login/เข้าเว็บ rememberProfile จะเขียนทับด้วยรูปจริงทันที */
async function backfillProfiles(env, wanted) {
  const found = new Map();
  if (!wanted.size) return found;
  const MAX_READS = 400;
  let reads = 0, cursor;
  try {
    do {
      const page = await env.SESSIONS.list({ cursor, limit: 1000 });
      const names = page.keys.map((k) => k.name).filter((n) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(n));
      for (let i = 0; i < names.length && reads < MAX_READS && found.size < wanted.size; i += 50) {
        const chunk = names.slice(i, Math.min(i + 50, i + (MAX_READS - reads)));
        reads += chunk.length;
        await Promise.all(chunk.map(async (n) => {
          try {
            const raw = await env.SESSIONS.get(n);
            if (!raw) return;
            const u = JSON.parse(raw);
            const id = u && u.id != null ? String(u.id) : '';
            if (wanted.has(id) && typeof u.avatar === 'string' && /^https:\/\//.test(u.avatar)) found.set(id, u.avatar);
          } catch { /* ข้าม */ }
        }));
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor && reads < MAX_READS && found.size < wanted.size);
  } catch (err) {
    console.error('backfillProfiles failed:', err);
  }
  return found;
}

/* ---------- helper: อ่าน session cookie -> ผู้ใช้ปัจจุบัน (หรือ null) ---------- */
async function getSessionUser(request, env) {
  const sessionId = getCookie(request, 'session');
  if (!sessionId) return null;

  let user = null;
  if (sessionId.startsWith(SESSION_PREFIX)) {
    // session แบบใหม่: คุกกี้ลงลายเซ็น HMAC — ตรวจในตัว Worker เลย ไม่ต้องอ่าน KV (ไม่มี eventual consistency / โควต้า KV)
    user = await verifySession(env, sessionId);
    if (!user) return null;
  } else {
    // session แบบเก่า (UUID ใน KV) — รองรับไว้ให้คนที่ล็อกอินค้างอยู่ก่อนอัปเดตไม่โดนเด้งออก
    let raw = null;
    try { raw = await env.SESSIONS.get(sessionId); } catch (err) { console.error('getSessionUser: อ่าน KV ไม่ได้', err); return null; }
    if (!raw) return null;
    try { user = JSON.parse(raw); } catch { return null; }
  }
  // บัญชีที่ถูกแอดมินแบน = ถือว่า "ไม่ได้ล็อกอิน" ทุกที่ (สั่งซื้อ/เติมเงิน/โปรไฟล์ใช้ไม่ได้) ; แอดมินไม่โดนแบน
  if (user && !user.isAdmin && user.id != null && await isUserBanned(env, String(user.id))) return null;
  return user;
}

/* ---------- รายชื่อบัญชีที่ถูกแบน (ตาราง banned_users) — แคชใน isolate 10 วินาที ----------
   ถ้าอ่านฐานข้อมูลไม่ได้ จะใช้รายการเดิมที่แคชไว้ (ไม่ทำให้ลูกค้าทุกคนล็อกอินไม่ได้) */
let BANNED_CACHE = { at: 0, set: new Set(), pending: null };
async function getBannedSet(env) {
  if (Date.now() - BANNED_CACHE.at < 10000) return BANNED_CACHE.set;
  if (BANNED_CACHE.pending) return BANNED_CACHE.pending;
  const p = (async () => {
    try {
      const rows = await supabaseSelect(env, 'banned_users', { select: 'user_id', limit: '10000' }, { timeoutMs: 4000 });
      BANNED_CACHE.set = new Set((rows || []).map((r) => String(r.user_id)));
    } catch (err) {
      console.error('getBannedSet failed:', err);
    }
    BANNED_CACHE.at = Date.now();
    BANNED_CACHE.pending = null;
    return BANNED_CACHE.set;
  })();
  BANNED_CACHE.pending = p;
  return p;
}
async function isUserBanned(env, userId) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return false;
  return (await getBannedSet(env)).has(String(userId));
}

/* ---------- 4.5) /api/auth/signup + /api/auth/login (ອີເມວ/ລະຫັດຜ່ານ) ----------
   ໜ້າ signup.html / login.html (ຜ່ານ auth.js) ຍິງມາທີ່ path ພວກນີ້ຢູ່ແລ້ວ ແຕ່ເມື່ອກ່ອນ
   Worker ບໍ່ມີ route ພວກນີ້ເລີຍ (ມີແຕ່ Discord OAuth) → request ຕົກໄປໃສ່ env.ASSETS.fetch()
   ເຊິ່ງບໍ່ຮູ້ຈັກ path ນີ້ ແລ້ວຄືນ error ແປກໆ ("The string did not match the expected
   pattern.") ອອກມາແທນ — ນີ້ຄືສາເຫດຕົວຈິງທີ່ສະໝັກ/ລ໋ອກອິນດ້ວຍອີເມວບໍ່ໄດ້
   ຂ້າງລຸ່ມນີ້ໃຊ້ Supabase Auth Admin API ຝັ່ງ server ດ້ວຍ SUPABASE_SERVICE_ROLE_KEY
   (ບໍ່ເຄີຍສົ່ງ key ອອກໄປຫາ browser) ເພື່ອສ້າງ/ກວດຜູ້ໃຊ້ ແລ້ວອອກ session cookie
   ແບບດຽວກັນກັບ Discord login (ເກັບໃນ env.SESSIONS) ເພື່ອໃຫ້ /api/me, wallets,
   topup, orders ໃຊ້ user id ດຽວກັນໄດ້ທັນທີ */

async function handlePasswordSignup(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'ລະບົບຍັງບໍ່ໄດ້ຕັ້ງຄ່າ Supabase (SUPABASE_SERVICE_ROLE_KEY)' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'ຂໍ້ມູນທີ່ສົ່ງມາບໍ່ຖືກຕ້ອງ' }, 400);
  }

  const username = (body.username || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (username.length < 3) return json({ error: 'ຊື່ຜູ້ໃຊ້ຕ້ອງມີຢ່າງໜ້ອຍ 3 ໂຕ' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'ອີເມວບໍ່ຖືກຕ້ອງ' }, 400);
  if (password.length < 6) return json({ error: 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ໂຕ' }, 400);

  // ---- ສ້າງຜູ້ໃຊ້ໃໝ່ຜ່ານ Supabase Auth Admin API (ຢືນຢັນອີເມວທັນທີ ບໍ່ຕ້ອງລໍ email link) ----
  let createRes;
  try {
    createRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { username },
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error('handlePasswordSignup: เชื่อมต่อ Supabase ไม่ได้', err);
    return json({ error: 'ເຊື່ອມຕໍ່ຖານຂໍ້ມູນບໍ່ໄດ້ຊົ່ວຄາວ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ' }, 502);
  }

  const createData = await createRes.json().catch(() => ({}));

  if (!createRes.ok) {
    const msg = (createData && (createData.msg || createData.message || createData.error_description || createData.error)) || '';
    const code = (createData && (createData.error_code || createData.code)) || '';
    console.error('handlePasswordSignup: Supabase admin create user failed', createRes.status, JSON.stringify(createData));

    // อีเมลซ้ำจริงๆ เท่านั้น (เดิมเหมาทุก 422 ว่า "อีเมลซ้ำ" ทำให้ error อื่นถูกบอกผิดๆ)
    if (code === 'email_exists' || /already been registered|already exists/i.test(msg)) {
      return json({ error: 'ອີເມວນີ້ຖືກສະໝັກໄປແລ້ວ' }, 400);
    }
    if (code === 'weak_password' || /password/i.test(msg)) {
      return json({ error: 'ລະຫັດຜ່ານບໍ່ປອດໄພພໍ ກະລຸນາໃຊ້ລະຫັດທີ່ຍາກຂຶ້ນ' }, 400);
    }
    if (code === 'validation_failed' || /valid email|invalid email/i.test(msg)) {
      return json({ error: 'ອີເມວບໍ່ຖືກຕ້ອງ' }, 400);
    }
    // key ผิด/ไม่มีสิทธิ์ (401/403) = ตั้ง SUPABASE_SERVICE_ROLE_KEY ไม่ถูก
    if (createRes.status === 401 || createRes.status === 403) {
      return json({ error: 'ຕັ້ງຄ່າ SUPABASE_SERVICE_ROLE_KEY ບໍ່ຖືກ (ເບິ່ງ wrangler secret)' }, 500);
    }
    return json({ error: 'ສະໝັກສະມາຊິກບໍ່ສຳເລັດ' + (msg ? ': ' + msg : ''), code }, 502);
  }

  const authUser = createData;
  const sessionId = await createSession(env, {
    id: authUser.id,
    username,
    email,
    avatar: null,
    isAdmin: false,
    discordLinked: false,
    passwordAuth: true, // ບັນຊີນີ້ມີລະຫັດຜ່ານແທ້ (ໃຊ້ບອກ hasPassword ໃນ /api/me ສຳລັບໜ້າໂປຣໄຟລ໌)
    createdAt: Date.now(),
  });

  // ---- แจ้งเตือนเข้า Discord: มีสมาชิกใหม่สมัครด้วยอีเมล ----
  await sendDiscordAlert(env, {
    title: '🆕 ສະໝັກສະມາຊິກໃໝ່ (Email)',
    color: 0xe8b34a, // ทอง
    fields: [
      { name: 'ຊື່', value: username || '-', inline: true },
      { name: 'ອີເມວ', value: email || '-', inline: true },
    ],
  });

  return jsonWithSession({ ok: true }, sessionId);
}

async function handlePasswordLogin(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'ລະບົບຍັງບໍ່ໄດ້ຕັ້ງຄ່າ Supabase (SUPABASE_SERVICE_ROLE_KEY)' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'ຂໍ້ມູນທີ່ສົ່ງມາບໍ່ຖືກຕ້ອງ' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) return json({ error: 'ກະລຸນາໃສ່ອີເມວ ແລະ ລະຫັດຜ່ານ' }, 400);

  // ---- ຄວາມປອດໄພ: ຈຳກັດຈຳນວນຄັ້ງທີ່ພະຍາຍາມລ໋ອກອິນຜິດ (ກັນ brute-force ເດົາລະຫັດຜ່ານ) ----
  // ນັບແຍກຕາມອີເມວ (ບໍ່ແມ່ນ IP ເພາະ Worker ນີ້ບໍ່ໄດ້ເກັບ IP ໄວ້ໃນ KV ຢູ່ແລ້ວ) ໃຊ້
  // env.SESSIONS KV ດຽວກັນ (ບໍ່ຕ້ອງເພີ່ມ binding ໃໝ່) key ແຍກ namespace ຄື "loginlimit:"
  // นับแยกตาม อีเมล + IP (เดิมนับตามอีเมลอย่างเดียว -> ใครก็ได้พิมพ์ผิดใส่อีเมลเราจนเจ้าของบัญชีโดนล็อก 15 นาที)
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const limitKey = `loginlimit:${email}:${clientIp}`;
  const limited = await isRateLimited(env, limitKey, 8, 15 * 60);
  if (limited) {
    return json({ error: 'ພະຍາຍາມລ໋ອກອິນຜິດຫຼາຍເທື່ອເກີນໄປ ກະລຸນາລໍຖ້າ 15 ນາທີແລ້ວລອງໃໝ່' }, 429);
  }

  // ---- ກວດອີເມວ/ລະຫັດຜ່ານຜ່ານ Supabase Auth token endpoint ----
  let tokenRes;
  try {
    tokenRes = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error('handlePasswordLogin: เชื่อมต่อ Supabase ไม่ได้', err);
    return json({ error: 'ເຊື່ອມຕໍ່ຖານຂໍ້ມູນບໍ່ໄດ້ຊົ່ວຄາວ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ' }, 502);
  }

  const tokenData = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok) {
    const code = (tokenData && (tokenData.error_code || tokenData.code)) || '';
    const msg = (tokenData && (tokenData.msg || tokenData.message || tokenData.error_description || tokenData.error)) || '';
    console.error('handlePasswordLogin: Supabase token failed', tokenRes.status, code, msg);
    // key ผิด/ไม่มีสิทธิ์ -> ปัญหาการตั้งค่า ไม่ใช่รหัสผ่านผิด (เดิมบอกว่า "รหัสผ่านผิด" ทุกกรณี ทำให้หาสาเหตุไม่เจอ)
    if (tokenRes.status === 401 || tokenRes.status === 403 || /invalid api key|no api key/i.test(msg)) {
      return json({ error: 'ຕັ້ງຄ່າ SUPABASE_SERVICE_ROLE_KEY ບໍ່ຖືກ (ເບິ່ງ wrangler secret)' }, 500);
    }
    // Supabase ล่ม/ช้า -> ไม่ใช่ความผิดของผู้ใช้ ไม่นับเข้า rate limit
    if (tokenRes.status >= 500 || tokenRes.status === 429) {
      return json({ error: 'ລະບົບຖານຂໍ້ມູນຂັດຂ້ອງຊົ່ວຄາວ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ' }, 503);
    }
    if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) {
      return json({ error: 'ອີເມວນີ້ຍັງບໍ່ໄດ້ຢືນຢັນ' }, 400);
    }
    await bumpRateLimit(env, limitKey, 15 * 60);
    return json({ error: 'ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ' }, 400);
  }

  const authUser = tokenData.user || {};
  const username =
    (authUser.user_metadata && authUser.user_metadata.username) ||
    (authUser.email || '').split('@')[0];

  const sessionId = await createSession(env, {
    id: authUser.id,
    username,
    email: authUser.email || email,
    avatar: null,
    isAdmin: false,
    discordLinked: false,
    passwordAuth: true,
    createdAt: Date.now(),
  });

  // ---- แจ้งเตือนเข้า Discord: มีคนล็อกอินผ่านอีเมล ----
  await sendDiscordAlert(env, {
    title: '🔐 ລ໋ອກອິນສຳເລັດ (Email)',
    color: 0x2ecc71, // เขียว
    fields: [
      { name: 'ຊື່', value: username || '-', inline: true },
      { name: 'ອີເມວ', value: authUser.email || email || '-', inline: true },
    ],
  });

  return jsonWithSession({ ok: true }, sessionId);
}

/* ---------- 4.6) POST /api/account/change-password ----------
   ໜ້າໂປຣໄຟລ໌ (profile.js) ຮຽກຈຸດນີ້ — ກ່ອນໜ້ານີ້ route ນີ້ບໍ່ມີຢູ່ຈິງເລີຍ (frontend ຮຽກແລ້ວ
   ໄດ້ 404 ຕະຫຼອດ, ຟີເจอร์ "ปั่นรหัสผ่าน" ไม่เคยทำงานได้จริง — ผู้ใช้ที่รหัสผ่านหลุด/สงสัยว่าโดน
   ขโมย session ไม่มีทางเปลี่ยนรหัสผ่านได้เลย)
   ---- ຂໍ້ຈຳກັດ: ໃຊ້ໄດ້ສະເພາະບັນຊີທີ່ສະໝັກດ້ວຍອີເມວ/ລະຫັດຜ່ານ (passwordAuth: true) ເທົ່ານັ້ນ ----
   ບັນຊີ Discord/Google login ບໍ່ໄດ້ຜູກກັບຜູ້ໃຊ້ Supabase Auth ຈິງເລີຍ (id ທີ່ໃຊ້ຢູ່ໃນລະບົບນີ້
   ຄື Discord snowflake / Google sub, ບໍ່ແມ່ນ Supabase auth uid) ຈຶ່ງບໍ່ມີບັນຊີໃຫ້ "ຕັ້ງລະຫັດຜ່ານ"
   ໃສ່ໄດ້ຈິງດ້ວຍ API ນີ້ — ຖ້າຈະເຮັດຟີเจอร์ນັ້ນຕ້ອງອອກແບບການຜູກບັນຊີ (account linking) ເພີ່ມ
   ຕ່າງຫາກ (ບອກໄດ້ທີ່ແຊັດຖ້າຢາກເຮັດຕໍ່) ຕອນນີ້ຄືນ error ຊັດເຈນແທນທີ່ຈະປ່ອຍ 404 ງ່ຽງໆ
   ---- ຄວາມປອດໄພ: ຕ້ອງ verify currentPassword ຈິງກັບ Supabase ກ່ອນສະເໝີ (ຄືກັນກັບ login ປົກກະຕິ)
   ຫ້າມເຊື່ອ session cookie ຢ່າງດຽວແລ້ວປ່ຽນລະຫັດຜ່ານເລີຍ ເພາະຖ້າ session ຫຼຸດ (ເຊັ່ນ ລືມ log out
   ຄອມສາທາລະນະ) ຄົນອື່ນຈະບໍ່ສາມາດຍຶດບັນຊີຖາວອນໄດ້ດ້ວຍການປ່ຽນລະຫັດຜ່ານທັບໂດຍບໍ່ຮູ້ລະຫັດເກົ່າ */
async function handleChangePassword(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ error: 'ກະລຸນາລ໋ອກອິນກ່ອນ', requireLogin: true }, 401);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'ລະບົບຍັງບໍ່ໄດ້ຕັ້ງຄ່າ Supabase (SUPABASE_SERVICE_ROLE_KEY)' }, 500);
  }
  if (!user.passwordAuth || !user.email) {
    return json({ error: 'ບັນຊີນີ້ລ໋ອກອິນດ້ວຍ Discord/Google, ຍັງບໍ່ຮອງຮັບການຕັ້ງລະຫັດຜ່ານ' }, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'ຂໍ້ມູນທີ່ສົ່ງມາບໍ່ຖືກຕ້ອງ' }, 400);
  }

  const currentPassword = body.currentPassword || '';
  const newPassword = body.newPassword || '';
  if (!currentPassword) {
    return json({ error: 'ກະລຸນາໃສ່ລະຫັດຜ່ານປັດຈຸບັນ' }, 400);
  }
  if (newPassword.length < 6) {
    return json({ error: 'ລະຫັດຜ່ານໃໝ່ຕ້ອງມີຢ່າງໜ້ອຍ 6 ໂຕ' }, 400);
  }

  const limited = await isRateLimited(env, `pwchangelimit:${user.id}`, 8, 15 * 60);
  if (limited) {
    return json({ error: 'ພະຍາຍາມຫຼາຍເທື່ອເກີນໄປ ກະລຸນາລໍຖ້າ 15 ນາທີແລ້ວລອງໃໝ່' }, 429);
  }

  // ---- ຂັ້ນທີ 1: verify ວ່າ currentPassword ຖືກຕ້ອງແທ້ (ຍິງ token endpoint ຄືກັນກັບ login) ----
  const verifyRes = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ email: user.email, password: currentPassword }),
  });
  if (!verifyRes.ok) {
    await bumpRateLimit(env, `pwchangelimit:${user.id}`, 15 * 60);
    return json({ error: 'ລະຫັດຜ່ານປັດຈຸບັນບໍ່ຖືກຕ້ອງ' }, 400);
  }

  // ---- ຂັ້ນທີ 2: ອັບເດດລະຫັດຜ່ານຈິງດ້ວຍ Supabase Auth Admin API (service_role, ຝັ່ງ Worker ເທົ່ານັ້ນ) ----
  const updateRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ password: newPassword }),
  });
  if (!updateRes.ok) {
    const errText = await updateRes.text();
    console.error('handleChangePassword: update failed', updateRes.status, errText);
    return json({ error: 'ປ່ຽນລະຫັດຜ່ານບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ' }, 502);
  }

  await sendDiscordAlert(env, {
    title: '🔑 ມີການປ່ຽນລະຫັດຜ່ານບັນຊີ',
    color: 0xf39c12,
    fields: [{ name: 'ອີເມວ', value: user.email || '-', inline: true }],
  });

  return json({ ok: true });
}

/* ---------- helper: rate limit ແບບງ່າຍໆດ້ວຍ KV (ນັບຈຳນວນຄັ້ງພາຍໃນຊ່ວງເວລາ windowSeconds) ----------
   ບໍ່ແມ່ນ atomic ຮ້ອຍເປີເຊັນ (KV read-then-write ມີ race ນ້ອຍໆໄດ້ຖ້າຍິງພ້ອມກັນຫຼາຍຫົວ) ແຕ່ພຽງພໍ
   ສຳລັບກັນ brute-force ທົ່ວໄປ (ບໍ່ໄດ້ອອກແບບມາຮັບການໂຈມຕີລະດັບ botnet ຂະໜາດໃຫຍ່) */
async function isRateLimited(env, key, maxAttempts, windowSeconds) {
  try {
    const raw = await env.SESSIONS.get(key);
    const count = raw ? Number(raw) || 0 : 0;
    return count >= maxAttempts;
  } catch (err) {
    console.error('isRateLimited: อ่าน KV ไม่ได้ (ปล่อยผ่าน ไม่ให้ลูกค้าล็อกอินไม่ได้)', err);
    return false;
  }
}
async function bumpRateLimit(env, key, windowSeconds) {
  try {
    const raw = await env.SESSIONS.get(key);
    const count = raw ? Number(raw) || 0 : 0;
    // KV ต้อง expirationTtl >= 60 วินาที
    await env.SESSIONS.put(key, String(count + 1), { expirationTtl: Math.max(60, windowSeconds) });
  } catch (err) {
    console.error('bumpRateLimit: เขียน KV ไม่ได้ (ข้าม)', err);
  }
}

/* ---------- helper: ສ້າງ session ໃໝ່ (KV + cookie) ໃຊ້ຮ່ວມກັນທັງ Discord ແລະ ອີເມວ/ລະຫັດຜ່ານ ---------- */
async function createSession(env, sessionData) {
  let sessionId = await signSession(env, sessionData);
  if (!sessionId) {
    // ไม่มี secret สำหรับเซ็นชื่อ (ไม่มีทั้ง SESSION_SECRET และ SUPABASE_SERVICE_ROLE_KEY) -> ใช้วิธีเก่า (KV)
    sessionId = crypto.randomUUID();
    await env.SESSIONS.put(sessionId, JSON.stringify(sessionData), {
      expirationTtl: SESSION_TTL_S,
    });
  }
  try { await rememberProfile(env, sessionData); } catch (err) { console.error('rememberProfile failed:', err); }
  return sessionId;
}

/* ---------- session แบบคุกกี้ลงลายเซ็น (stateless) ----------
   เดิมเก็บ session ใน Cloudflare KV ซึ่งทำให้ล็อกอินพังเป็นระยะ:
     1) KV เป็น eventual consistency — ล็อกอินเสร็จแล้วเด้งไปหน้าถัดไป อ่านไม่เจอ (ดูเหมือนล็อกอินไม่สำเร็จ)
     2) KV แพ็กเกจฟรีเขียนได้ 1,000 ครั้ง/วัน — เต็มแล้ว put() error -> ล็อกอินพังทั้งเว็บ
   ตอนนี้ข้อมูล session อยู่ในคุกกี้เลย เซ็นด้วย HMAC-SHA256 (ปลอมไม่ได้) ไม่ต้องใช้ KV
   Secret ใช้ SESSION_SECRET ถ้าตั้งไว้ ไม่งั้นใช้ SUPABASE_SERVICE_ROLE_KEY (มีอยู่แล้ว ไม่ต้องตั้งเพิ่ม) */
const SESSION_PREFIX = 'v1.';
const SESSION_TTL_S = 60 * 60 * 24 * 7;
const _enc = new TextEncoder();
const _dec = new TextDecoder();

function b64urlFromBytes(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function bytesFromB64url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
let _sessKeyCache = { secret: null, key: null };
async function getSessionHmacKey(env) {
  const secret = env.SESSION_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  if (_sessKeyCache.secret === secret && _sessKeyCache.key) return _sessKeyCache.key;
  const key = await crypto.subtle.importKey(
    'raw', _enc.encode('dekmash-session-v1:' + secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
  _sessKeyCache = { secret, key };
  return key;
}
async function signSession(env, data) {
  const key = await getSessionHmacKey(env);
  if (!key) return null;
  const build = async (d) => {
    const payload = b64urlFromBytes(_enc.encode(JSON.stringify({ u: d, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S })));
    const sig = b64urlFromBytes(new Uint8Array(await crypto.subtle.sign('HMAC', key, _enc.encode(payload))));
    return SESSION_PREFIX + payload + '.' + sig;
  };
  let token = await build(data);
  // คุกกี้ต้องไม่เกิน ~4KB — ถ้ายาวเกิน ตัดรูปโปรไฟล์ออก (รูปยังดึงจาก KV/โปรไฟล์ได้)
  if (token.length > 3500) token = await build({ ...data, avatar: null });
  return token;
}
async function verifySession(env, token) {
  try {
    const key = await getSessionHmacKey(env);
    if (!key) return null;
    const parts = token.slice(SESSION_PREFIX.length).split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const ok = await crypto.subtle.verify('HMAC', key, bytesFromB64url(sig), _enc.encode(payload));
    if (!ok) return null;
    const obj = JSON.parse(_dec.decode(bytesFromB64url(payload)));
    if (!obj || !obj.u || typeof obj.exp !== 'number' || obj.exp < Math.floor(Date.now() / 1000)) return null;
    return obj.u;
  } catch {
    return null;
  }
}

/* ---------- helper: ตอบ JSON พร้อมแปะ session cookie (ใช้กับ signup/login ด้วยอีเมล) ---------- */
function jsonWithSession(data, sessionId) {
  const res = json(data);
  res.headers.append(
    'Set-Cookie',
    `session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
  );
  return res;
}

/* ---------- 5) /api/admin/supabase/* ----------
   Proxy คำขอทั้งหมดจากห้องแอดมินไป Supabase จริง โดยที่เบราว์เซอร์ไม่ถือ key จริงเลย
   - ต้อง login เป็นแอดมิน (session cookie -> isAdmin: true) ยกเว้นกรณีเดียว:
     GET รูปจาก storage bucket ที่ตั้ง public ไว้ (product-images/site-assets/topup-slips)
     ซึ่งเดิมก็เปิดให้ใครก็อ่านได้อยู่แล้วโดยไม่ต้องมี key ใดๆ (bucket public = true)
     ถ้าไม่เว้นกรณีนี้ รูปสินค้าจะโหลดไม่ขึ้นตอนแสดงในหน้าร้านจริง (ลูกค้าไม่ได้ login แอดมิน) */
async function handleSupabaseProxy(request, env, url) {
  const targetPath = url.pathname.slice(SUPABASE_PROXY_PREFIX.length) || '/';
  const isPublicStorageRead =
    request.method === 'GET' && targetPath.startsWith('/storage/v1/object/public/');

  if (!isPublicStorageRead) {
    const user = await getSessionUser(request, env);
    if (!user || !user.isAdmin) {
      return json({ error: 'ບໍ່ມີສິດເຂົ້າເຖິງ — ຕ້ອງລ໋ອກອິນເປັນແອດມິນກ່ອນ' }, 403);
    }
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(
      { error: 'Worker ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (ເບິ່ງ wrangler.toml + wrangler secret)' },
      500
    );
  }

  // header ที่ไม่ควร forward ไปตรงๆ: host เดิม, cookie ของเว็บเรา (ไม่เกี่ยวกับ Supabase),
  // และ apikey/authorization ที่เบราว์เซอร์ส่งมา (จะถูกใส่ค่าจริงทับด้านล่างเสมอ)
  const skipHeaders = new Set(['host', 'cookie', 'apikey', 'authorization', 'content-length']);
  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (!skipHeaders.has(key.toLowerCase())) headers.set(key, value);
  }
  headers.set('apikey', env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set('authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);

  const targetUrl = env.SUPABASE_URL.replace(/\/$/, '') + targetPath + url.search;
  const hasBody = !['GET', 'HEAD'].includes(request.method);

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? 'half' : undefined,
  });

  const respHeaders = new Headers(upstream.headers);
  respHeaders.delete('set-cookie'); // กันไม่ให้ response จาก Supabase ไปยุ่งกับ cookie ของเว็บเรา

  return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      // ห้าม browser/Cloudflare cache คำตอบ API ทุกเส้นทาง — ข้อมูลร้าน (สินค้า/สต็อก/
      // สถานะล็อกอิน) ต้องสดใหม่จริงทุกครั้งที่หน้าเว็บเรียก ไม่งั้นข้อมูลเก่าจะค้าง
      // อยู่ใน cache แล้วโผล่มาแวบหนึ่งตอนโหลดหน้าเว็บใหม่ก่อนจะถูกแทนที่
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

/* ---------- helper: ສົ່ງແຈ້ງເຕືອນເຂົ້າ Discord (webhook) ----------
   ใช้แจ้งเตือนแอดมินในช่อง Discord ทุกครั้งที่มีคน "ล็อกอิน" (ทั้ง Discord OAuth และ
   อีเมล/รหัสผ่าน) หรือ "เติมเงิน" (ส่งสลิปเข้ามารออนุมัติ)
   ต้องตั้งค่า secret ก่อนใช้งาน (รันครั้งเดียว):
     wrangler secret put DISCORD_WEBHOOK_URL
   เอา URL มาจาก: ตั้งค่าช่อง Discord > Integrations > Webhooks > New Webhook > Copy
   Webhook URL
   ถ้ายังไม่ได้ตั้งค่า (env.DISCORD_WEBHOOK_URL ว่าง) ฟังก์ชันนี้จะข้ามเงียบๆ โดยไม่ทำให้
   ระบบล็อกอิน/เติมเงินพังไปด้วย (แจ้งเตือนคือ best-effort เสริม ไม่ใช่ core flow) */
async function sendDiscordAlert(env, { title, description, color, fields }) {
  if (!env.DISCORD_WEBHOOK_URL) {
    // ไม่ตั้งค่า = ไม่เตือน — log ไว้ให้เห็นใน Cloudflare > Workers > Logs ว่าทำไมเงียบ
    console.warn('sendDiscordAlert: DISCORD_WEBHOOK_URL ยังไม่ได้ตั้งค่า (wrangler secret put DISCORD_WEBHOOK_URL)');
    return;
  }

  const embed = {
    title,
    description: description || undefined,
    color: color || 0xff0001, // แดงโทนร้าน (Dekmash) เป็นค่าเริ่มต้น
    fields: fields || [],
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
      signal: AbortSignal.timeout(6000),
    });
    // Discord ตอบ 204 เมื่อสำเร็จ — ถ้า webhook ถูกลบ/ผิด (404/401) หรือโดน rate limit (429) ต้อง log
    if (!res.ok) {
      console.error('sendDiscordAlert: Discord ตอบกลับ', res.status, await res.text());
    }
  } catch (err) {
    // อย่าให้การแจ้งเตือนล้มเหลวไปทำให้ login/topup ของลูกค้าพังตาม — log ไว้เฉยๆ
    console.error('sendDiscordAlert failed:', err);
  }
}

/* ---------- helper: ນັບຈຳນວນສະມາຊິກທີ່ສະໝັກຈິງ (ຜູ້ໃຊ້ງານ) ----------
   ໃຊ້ Supabase Auth Admin API (GET /auth/v1/admin/users) ນັບຈຳນວນບັນຊີທັງໝົດ —
   ນີ້ນັບສະເພາະບັນຊີທີ່ຖືກສ້າງຜ່ານ /api/auth/signup (ອີເມວ/ລະຫັດຜ່ານ) ຫຼື ຜ່ານ
   ຫນ້າແອດມິນ ເນື່ອງຈາກລະບົບ Google/Discord login ຂອງເວັບນີ້ບໍ່ໄດ້ບັນທຶກຜູ້ໃຊ້ລົງຖານ
   ຂໍ້ມູນຖາວອນ (ໃຊ້ແຕ່ session ຊົ່ວຄາວໃນ KV ອາຍຸ 7 ວັນ) — ຖ້າຢາກໃຫ້ນັບຄົນທີ່ login
   ຜ່ານ Google/Discord ດ້ວຍ ຕ້ອງເພີ່ມການບັນທຶກລົງຕາຕະລາງແຍກຕ່າງຫາກ (ບອກໄດ້ທີ່ແຊັດ)
   per_page=1000: ພຽງພໍສຳລັບຮ້ານຂະໜາດນ້ອຍ-ກາງ, ຖ້າສະມາຊິກເກີນ 1000 ຄົນຄ່ອຍປັບເປັນ
   ແບບແບ່ງໜ້າ (pagination) ຕໍ່ໄປ */
async function getRegisteredUserCount(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users?per_page=1000`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!res.ok) {
      console.error('getRegisteredUserCount failed:', await res.text());
      return 0;
    }
    const data = await res.json();
    const users = Array.isArray(data) ? data : (data.users || []);
    return users.length;
  } catch (err) {
    console.error('getRegisteredUserCount error:', err);
    return 0;
  }
}

/* ---------- helper: ນັບຈຳນວນອໍເດີທີ່ຂາຍສຳເລັດແລ້ວ (ຂາຍແລ້ວ) ----------
   ໃຊ້ Supabase "count=exact" ຜ່ານ header Prefer + Range ແທນການດຶງແຖວທັງໝົດມາ .length
   (ຖ້າອໍເດີເກີນ 1000 ແຖວ ຈະນັບຜິດຖ້າໃຊ້ວິທີເກົ່າ) ນັບສະເພາະ status = completed ເພື່ອໃຫ້
   ຕົງກັບ "ຂາຍແລ້ວ" ຈິງ (ບໍ່ນັບອໍເດີທີ່ຍົກເລີກ/ຄ້າງຈ່າຍ) */
async function getSoldCount(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  try {
    const url = new URL(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/orders`);
    url.searchParams.set('select', 'id');
    url.searchParams.set('status', 'eq.completed');
    const res = await fetch(url.toString(), {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    });
    if (!res.ok && res.status !== 206) {
      console.error('getSoldCount failed:', await res.text());
      return 0;
    }
    const range = res.headers.get('content-range'); // ຮູບແບບ "0-0/135"
    const total = range ? Number(range.split('/')[1]) : NaN;
    return Number.isFinite(total) ? total : 0;
  } catch (err) {
    console.error('getSoldCount error:', err);
    return 0;
  }
}

/* ---------- 5b) ຈຳນວນ "ຂາຍແລ້ວ" ຂອງແຕ່ລະສິນຄ້າ (ໃຊ້ໂຊວ໌ປ້າຍ "ຂາຍແລ້ວ X ອັນ" ໃນ category.js)
   ນັບຈາກ orders ທີ່ status = completed, ຈັດກຸ່ມຕາມ product_name (orders ບໍ່ມີ product_id ໂດຍກົງ
   ຈຶ່ງອີງຊື່ສິນຄ້າ ຄືກັນກັບ handlePublicRecentPurchases ດ້ານລຸ່ມ) ຄືນເປັນ Map<product_name, count> */
async function getSoldCountsByProductName(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return new Map();
  try {
    // Supabase/PostgREST คืนสูงสุด 1000 แถวต่อคำขอ (max-rows) — ถ้าไม่แบ่งหน้า ออเดอร์ที่เกิน 1000
    // จะไม่ถูกนับ ทำให้ "ขายแล้ว X อัน" ของแต่ละสินค้าต่ำกว่าความจริง (ขณะที่ยอดรวมใช้ count=exact ถูกต้อง)
    // จึงดึงทีละ 1000 แถว เรียงตาม id ให้ลำดับคงที่ แล้วนับต่อจนหมด
    const PAGE = 1000;
    const counts = new Map();
    for (let offset = 0; offset < 200000; offset += PAGE) {
      const rows = await supabaseSelect(env, 'orders', {
        select: 'product_name',
        status: 'eq.completed',
        order: 'id.asc',
        limit: String(PAGE),
        offset: String(offset),
      });
      (rows || []).forEach((row) => {
        const name = row.product_name;
        if (!name) return;
        counts.set(name, (counts.get(name) || 0) + 1);
      });
      if (!rows || rows.length < PAGE) break;
    }
    return counts;
  } catch (err) {
    console.error('getSoldCountsByProductName error:', err);
    return new Map();
  }
}

/* ---------- 6) /api/public/storefront ----------
   ดึงหมวดหมู่ (category_1..4 name/image จาก site_settings) + สินค้า (products ที่ไม่ถูก
   archived) + สต็อกจริงของแต่ละชิ้น (ผ่าน RPC product_stock / product_duration_stock —
   ตัวเลขคงเหลือเท่านั้น ไม่ใช่รหัสสินค้าจริง) แล้วคืนเป็น JSON ก้อนเดียวให้ทั้ง index.html
   และ category.html ใช้งาน (category.html กรองด้วย ?cat=1..4 เอาเองฝั่ง client จาก
   products[].category ที่ตรงกับ categories[].name) */
async function handlePublicStorefront(request, env) {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(
      { error: 'Worker ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (ເບິ່ງ wrangler.toml + wrangler secret)' },
      500
    );
  }

  const CATEGORY_SLOT_COUNT = 4; // index.html มี 4 การ์ดหมวดหมู่บนหน้าแรกเสมอ

  try {
    const siteSettingsColumns = [
      'store_name', 'tagline', 'announcement_text', 'hero_image', 'logo_url',
      'qr_label', 'qr_label_2', 'qr_url', 'qr_url_2',
      'social_facebook', 'social_discord', 'social_line', 'social_telegram', 'social_whatsapp',
      'promo_popup_enabled', 'promo_popup_image',
      ...Array.from({ length: CATEGORY_SLOT_COUNT }, (_, i) => `category_${i + 1}_name`),
      ...Array.from({ length: CATEGORY_SLOT_COUNT }, (_, i) => `category_${i + 1}_image`),
      ...Array.from({ length: CATEGORY_SLOT_COUNT }, (_, i) => `category_${i + 1}_title`),
      ...Array.from({ length: CATEGORY_SLOT_COUNT }, (_, i) => `category_${i + 1}_desc`),
      ...Array.from({ length: CATEGORY_SLOT_COUNT }, (_, i) => `category_${i + 1}_tag`),
      ...Array.from({ length: CATEGORY_SLOT_COUNT }, (_, i) => `category_${i + 1}_enabled`),
    ];

    const [settingsRows, products, durations, userCount, totalSold, soldCountsByName] = await Promise.all([
      supabaseSelect(env, 'site_settings', {
        select: siteSettingsColumns.join(','),
        id: 'eq.1',
        limit: '1',
      }),
      // archived เป็น null ได้ (แถวเก่าก่อนมีคอลัมน์นี้) จึงต้องรวม is.null ด้วย ไม่ใช่แค่ eq.false
      supabaseSelect(env, 'products', {
        select: 'id,name,category,price,reseller_price,reseller_price_2,image_url,duration_enabled,paused,paused_note,description,featured,created_at',
        or: '(archived.is.null,archived.eq.false)',
        order: 'created_at.desc',
      }),
      supabaseSelect(env, 'product_durations', {
        select: 'id,product_id,label,price,reseller_price,reseller_price_2,sort_order',
        order: 'sort_order.asc',
      }),
      getRegisteredUserCount(env),
      getSoldCount(env),
      getSoldCountsByProductName(env),
    ]);

    const settings = settingsRows[0] || {};

    // ດຶງສະຕັອກຈິງ (ຕົວເລກເທົ່ານັ້ນ) ຂອງທຸກສິນຄ້າ/ທຸກໄລຍະເວລາ ດ້ວຍ RPC ລວມ 2 ຄັ້ງເທົ່ານັ້ນ
    // (ເມື່ອກ່ອນຍິງ RPC ແຍກທີລະສິນຄ້າ/ທີລະໄລຍະເວລາ ເຮັດໃຫ້ຮ້ານທີ່ມີສິນຄ້າຫຼາຍໆຊົນເພດານ
    // "Too many subrequests" ຂອງ Cloudflare Workers ແຜນ Free (50 ຄັ້ງ/1 request) —
    // ດຽວນີ້ໃຫ້ Postgres ເປັນຄົນວົນ loop ເອງຝັ່ງ server ຜ່ານ get_bulk_product_stock /
    // get_bulk_duration_stock (ຕ້ອງສ້າງໄວ້ໃນ Supabase ກ່ອນ — ເບິ່ງ bulk_stock_functions.sql)
    const productIds = (products || []).map((p) => p.id);
    const durationIds = (durations || []).map((d) => d.id);

    const [bulkProductStock, bulkDurationStock] = await Promise.all([
      productIds.length ? supabaseRpc(env, 'get_bulk_product_stock', { product_ids: productIds }) : [],
      durationIds.length ? supabaseRpc(env, 'get_bulk_duration_stock', { duration_ids: durationIds }) : [],
    ]);

    const productStockMap = new Map((bulkProductStock || []).map((r) => [r.product_id, r.stock ?? 0]));
    const durationStockMap = new Map((bulkDurationStock || []).map((r) => [r.duration_id, r.stock ?? 0]));

    const productsWithStock = (products || []).map((p) => {
      const ownDurations = (durations || []).filter((d) => d.product_id === p.id).sort((a, b) => durationToHours(a.label) - durationToHours(b.label));
      const durationsWithStock = ownDurations.map((d) => ({
        id: d.id,
        label: d.label,
        price: d.price,
        resellerPrice: d.reseller_price,
        resellerPrice2: d.reseller_price_2,
        stock: durationStockMap.get(d.id) ?? 0,
      }));

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        resellerPrice: p.reseller_price,
        resellerPrice2: p.reseller_price_2,
        image_url: p.image_url,
        duration_enabled: !!p.duration_enabled,
        paused: !!p.paused,
        paused_note: p.paused_note || null,
        description: p.description || null,
        featured: !!p.featured,
        stock: productStockMap.get(p.id) ?? 0,
        durations: durationsWithStock,
        soldCount: soldCountsByName.get(p.name) || 0,
      };
    });

    // category_{i}_enabled ຄ່າເລີ່ມຕົ້ນ = ເປີດ (true) ຖ້າແອດມິນຍັງບໍ່ເຄີຍປິດ/ຄອລັມຍັງເປັນ null
    // (ແຖວເກົ່າກ່ອນມີຄອລັມນີ້) — ຕ້ອງເປັນ false ຢ່າງຈະແຈ້ງເທົ່ານັ້ນຈຶ່ງຈະຖືວ່າ "ປິດ"
    const allCategories = Array.from({ length: CATEGORY_SLOT_COUNT }, (_, i) => {
      const idx = i + 1;
      return {
        index: idx,
        name: (settings[`category_${idx}_name`] || `ໝວດໝູ່ ${idx}`).trim(),
        image: settings[`category_${idx}_image`] || null,
        title: (settings[`category_${idx}_title`] || '').trim() || null,
        desc: (settings[`category_${idx}_desc`] || '').trim() || null,
        tag: (settings[`category_${idx}_tag`] || '').trim() || null,
        enabled: settings[`category_${idx}_enabled`] !== false,
      };
    });

    // ໝວດໝູ່ທີ່ຖືກປິດ -> ບໍ່ສົ່ງກັບໄປໃນ categories[] (ບໍ່ໂຊວ໌ກາຕູນຢູ່ໜ້າຫຼັກ/category.html)
    // ແລະ ສິນຄ້າທີ່ຢູ່ໃນໝວດນັ້ນກໍ່ຖືກຕັດອອກຈາກ products[] ນຳ (ບໍ່ໂຊວ໌ໃສ່ບ່ອນໃດເລີຍ ລວມທັງ
    // ການເປີດ product.html?pid= ຊື່ໆ ເພາະ product.js ຄົ້ນຫາຈາກ products[] ດຽວກັນນີ້)
    const categories = allCategories.filter((c) => c.enabled);
    const disabledCategoryNames = new Set(
      allCategories.filter((c) => !c.enabled).map((c) => c.name)
    );
    const visibleProductsWithStock = disabledCategoryNames.size
      ? productsWithStock.filter((p) => !disabledCategoryNames.has((p.category || '').trim()))
      : productsWithStock;

    // ຄັງ/ຈຳນວນສິນຄ້າທີ່ໂຊວ໌ໃນສະຖິຕິໜ້າຮ້ານ ຄິດສະເພາະສິນຄ້າທີ່ຍັງເບິ່ງເຫັນໄດ້ (ຕັດສິນຄ້າ
    // ໃນໝວດທີ່ຖືກປິດອອກ) ໃຫ້ຕົງກັບສິ່ງທີ່ລູກຄ້າເຫັນຈິງໆ
    const totalStock = visibleProductsWithStock.reduce((sum, p) => {
      const pStock = p.duration_enabled
        ? p.durations.reduce((s, d) => s + (d.stock || 0), 0)
        : (p.stock || 0);
      return sum + pStock;
    }, 0);

    return json({
      store: {
        name: settings.store_name || null,
        tagline: settings.tagline || null,
        announcement: settings.announcement_text || null,
        heroImage: settings.hero_image || null,
        logoUrl: settings.logo_url || null,
        qrLabel1: settings.qr_label || null,
        qrLabel2: settings.qr_label_2 || null,
        qrUrl1: settings.qr_url || null,
        qrUrl2: settings.qr_url_2 || null,
        social: {
          facebook: settings.social_facebook || null,
          discord: settings.social_discord || null,
          line: settings.social_line || null,
          telegram: settings.social_telegram || null,
          whatsapp: settings.social_whatsapp || null,
        },
        promoPopup: {
          enabled: !!settings.promo_popup_enabled,
          image: settings.promo_popup_image || null,
        },
      },
      categories,
      stats: {
        productCount: visibleProductsWithStock.length,
        totalStock,
        userCount,
        totalSold,
      },
      products: visibleProductsWithStock,
    });
  } catch (err) {
    console.error('handlePublicStorefront failed:', err);
    return json({ error: 'ດຶງຂໍ້ມູນຮ້ານບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ' }, 502);
  }
}

/* ---------- 6b) GET /api/public/recent-purchases ----------
   ໜ້າແຮກ (index.html -> recent-purchases.js) ໃຊ້ຈຸດນີ້ ເພື່ອໂຊວ໌ແຖບ "ສິນຄ້າທີ່ຊື້ລ່າສຸດ"
   ດຶງແຖວລ່າສຸດຈິງຈາກຕາຕະລາງ orders (ຮຽງ created_at desc) ຈາກນັ້ນ:
     - ຊື່ຮູບສິນຄ້າ: orders ບໍ່ມີຄອລັມ image_url ຂອງມັນເອງ, ຈຶ່ງ join ກັບ products ດ້ວຍ
       product_name (ຄອລັມນີ້ orders ມີແທ້ ເບິ່ງ handleOrdersHistory) ເອົາ image_url ມາໃສ່
       — ຖ້າສິນຄ້ານັ້ນຖືກລຶບ/ປ່ຽນຊື່ໄປແລ້ວ ຈະບໍ່ມີຮູບ (null, ຝັ່ງ frontend ຈະໂຊວ໌ໄອຄອນແທນ)
     - ຊື່ຜູ້ຊື້: ບໍ່ມີຕາຕະລາງ users/profiles ໃນລະບົບນີ້ (ເບິ່ງ getSessionUser -> ມາຈາກ Discord
       ຕອນ login, ບໍ່ໄດ້ບັນທຶກລົງ Supabase) ມີແຕ່ orders.user_email ເທົ່ານັ້ນທີ່ພໍໃຊ້ໄດ້ —
       ຈຶ່ງເອົາ local-part ຂອງອີເມວ (ກ່ອນ @) ມາປິດບັງບາງສ່ວນ (3 ໂຕທຳອິດ + ***) ກ່ອນສົ່ງອອກ
       ໄປ browser (ບໍ່ສົ່ງອີເມວເຕັມອອກໄປເດັດຂາດ, ນີ້ເປັນ public endpoint ບໍ່ຕ້ອງ login ອ່ານໄດ້)
   ເປັນ public/GET ອย่างเดียว (ไม่ต้อง login) เพราะเป็นข้อมูลโชว์หน้าร้านทั่วไปเหมือน storefront */
async function handleRecentPurchases(request, env) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(
      { error: 'Worker ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' },
      500
    );
  }

  const LIMIT = 20;

  function maskLocalPart(email) {
    const local = String(email || '').split('@')[0] || '';
    if (!local) return null;
    const visible = local.slice(0, 3);
    return (visible || local.slice(0, 1) || '?') + '***';
  }

  try {
    const [orderRows, products] = await Promise.all([
      supabaseSelect(env, 'orders', {
        select: 'product_name,user_email,status,created_at',
        status: 'eq.completed',
        order: 'created_at.desc',
        limit: String(LIMIT),
      }),
      supabaseSelect(env, 'products', {
        select: 'name,image_url',
      }),
    ]);

    const imageByProductName = new Map((products || []).map((p) => [p.name, p.image_url || null]));

    const items = (orderRows || []).map((o) => ({
      productName: o.product_name || 'ສິນຄ້າ',
      image: imageByProductName.get(o.product_name) || null,
      buyer: maskLocalPart(o.user_email),
      createdAt: o.created_at,
    }));

    return json({ ok: true, items });
  } catch (err) {
    console.error('handleRecentPurchases failed:', err);
    return json({ error: 'ດຶງລາຍການສິນຄ້າຊື້ລ່າສຸດບໍ່ສຳເລັດ' }, 502);
  }
}

/* ---------- 6b-2) GET /api/public/weekly-best-sellers ----------
   index.html -> weekly-best.js ใช้แสดงแถบ "สินค้าขายดีประจำสัปดาห์"
   นับจากออเดอร์ status = completed ใน 7 วันล่าสุด (rolling) จัดกลุ่มตาม product_name
   เรียงจากขายได้มากไปน้อย (เท่ากันให้ตัวที่ขายล่าสุดมาก่อน) เอาแค่ TOP_N ตัว
   - join กับ products เพื่อเอา id/รูป/ราคา (สินค้าที่ถูกลบ/archive แล้วจะไม่แสดง)
   - สินค้าในหมวดหมู่ที่แอดมินปิดไว้จะไม่แสดง (ตรงกับที่ลูกค้าเห็นใน storefront)
   - ไม่มียอดขายในสัปดาห์นี้เลย -> คืน items ว่าง (หน้าเว็บจะซ่อน section เอง ไม่สร้างข้อมูลปลอม) */
async function handleWeeklyBestSellers(request, env) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(
      { error: 'Worker ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' },
      500
    );
  }

  const TOP_N = 6;
  const DAYS = 7;
  const PAGE = 1000;
  const MAX_PAGES = 10;

  try {
    const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
    const catCols = [1, 2, 3, 4].flatMap((i) => [`category_${i}_name`, `category_${i}_enabled`]);

    const [products, durations, settingsRows] = await Promise.all([
      supabaseSelect(env, 'products', {
        select: 'id,name,category,price,image_url,duration_enabled,paused',
        or: '(archived.is.null,archived.eq.false)',
      }),
      supabaseSelect(env, 'product_durations', { select: 'product_id,price' }),
      supabaseSelect(env, 'site_settings', { select: catCols.join(','), id: 'eq.1', limit: '1' }),
    ]);

    // นับยอดขายรายสินค้าในช่วง 7 วัน (แบ่งหน้าทีละ 1000 แถว เหมือน getSoldCountsByProductName)
    const stats = new Map(); // name -> { count, last }
    for (let page = 0; page < MAX_PAGES; page++) {
      const rows = await supabaseSelect(env, 'orders', {
        select: 'product_name,created_at',
        status: 'eq.completed',
        created_at: `gte.${since}`,
        order: 'created_at.desc',
        limit: String(PAGE),
        offset: String(page * PAGE),
      });
      (rows || []).forEach((row) => {
        if (!row.product_name) return;
        const cur = stats.get(row.product_name) || { count: 0, last: row.created_at };
        cur.count += 1;
        stats.set(row.product_name, cur);
      });
      if (!rows || rows.length < PAGE) break;
    }

    const settings = (settingsRows && settingsRows[0]) || {};
    const disabledCategoryNames = new Set();
    const enabledCategoryNames = new Set(); // หมวดที่เปิดอยู่จริงบนหน้าร้าน (ตรงกับ categories[] ของ /api/public/storefront)
    [1, 2, 3, 4].forEach((i) => {
      if (settings[`category_${i}_enabled`] === false) {
        disabledCategoryNames.add(String(settings[`category_${i}_name`] || `ໝວດໝູ່ ${i}`).trim());
      }
    });
    [1, 2, 3, 4].forEach((i) => {
      if (settings[`category_${i}_enabled`] !== false) {
        enabledCategoryNames.add(String(settings[`category_${i}_name`] || `ໝວດໝູ່ ${i}`).trim());
      }
    });

    const minDurationPrice = new Map(); // product_id -> ราคาต่ำสุดของแพ็กเกจเวลา
    (durations || []).forEach((d) => {
      const price = Number(d.price);
      if (!Number.isFinite(price)) return;
      const cur = minDurationPrice.get(d.product_id);
      if (cur === undefined || price < cur) minDurationPrice.set(d.product_id, price);
    });

    const productByName = new Map((products || []).map((p) => [p.name, p]));

    const items = [...stats.entries()]
      .map(([name, st]) => ({ name, st, product: productByName.get(name) }))
      .filter(({ product }) => {
        if (!product) return false;
        const cat = String(product.category || '').trim();
        // ต้องอยู่ในหมวดที่เปิดอยู่บนหน้าร้านจริงเท่านั้น (สินค้าไร้หมวด/หมวดไม่ตรง/หมวดที่ปิด = ลูกค้าไม่เห็นในเว็บ จึงไม่แสดง)
        return enabledCategoryNames.has(cat) && !disabledCategoryNames.has(cat);
      })
      .sort((a, b) => b.st.count - a.st.count || String(b.st.last).localeCompare(String(a.st.last)))
      .slice(0, TOP_N)
      .map(({ name, st, product }, idx) => ({
        rank: idx + 1,
        productId: product.id,
        productName: name,
        image: product.image_url || null,
        price: product.duration_enabled
          ? (minDurationPrice.has(product.id) ? minDurationPrice.get(product.id) : null)
          : product.price,
        fromPrice: !!product.duration_enabled,
        paused: !!product.paused,
        soldThisWeek: st.count,
      }));

    return json({ ok: true, days: DAYS, items });
  } catch (err) {
    console.error('handleWeeklyBestSellers failed:', err);
    return json({ error: 'ດຶງສິນຄ້າຂາຍດີປະຈຳອາທິດບໍ່ສຳເລັດ' }, 502);
  }
}

/* ---------- 6c) GET /api/public/top-spenders ----------
   หน้า leaderboard.html ใช้จัดอันดับ "ຈັດອັນດັບຍອດເຕີມ" — รวมยอด topup_requests ที่ status = approved
   ต่อ user_id แล้วเรียงมาก→น้อย เอา 10 อันดับแรก
   - ไม่ส่ง user_id / อีเมลเต็มออกไปเด็ดขาด (public endpoint): ส่งแค่ชื่อที่ปิดบัง (3 ตัวแรกของอีเมล + ***)
   - ไม่มีตาราง users ที่เก็บวันสมัคร จึงใช้ "วันที่เติมเงินครั้งแรก" ของคนนั้นแทนวันสมัคร (joined)
   - วันที่แสดงตามเวลา UTC+7 รูปแบบ dd/mm/yyyy ; สด: no-store + แคช isolate 2 วินาที (ไคลเอนต์โพลทุก ~4 วินาที) */
/* ซ่อนบัญชีออกจากหน้าจัดอันดับ (เช่น บัญชีเงินทดสอบ/เงินเสก) — คนที่ถูกซ่อนจะไม่ขึ้นเลย และอันดับถัดไปเลื่อนขึ้นมาแทน
   ซ่อนได้ 3 แบบ: user_ids / emails (ตรงตัวเป๊ะ — แม่นที่สุด) หรือ prefixes (ชื่ออีเมลก่อน @ ขึ้นต้นด้วย…)
   ตอนนี้ใช้ prefixes ตามชื่อที่ปิดบังบนหน้าเว็บ (bhc***, nua***) เพราะยังไม่มี user_id/อีเมลเต็ม
   → แนะนำให้ใส่ user_id หรืออีเมลเต็มแทน จะได้ไม่เผลอซ่อนคนอื่นที่ชื่อขึ้นต้นเหมือนกัน
   เพิ่มเองได้โดยไม่ต้องแก้โค้ดผ่าน env LEADERBOARD_HIDE (คั่นด้วย comma: user_id หรืออีเมลเต็ม) */
const LEADERBOARD_HIDE = {
  user_ids: [],
  emails: [],
  prefixes: ['bhc', 'nua'],
};

function isHiddenFromLeaderboard(env, userId, email) {
  const e = String(email || '').toLowerCase();
  const local = e.split('@')[0] || '';
  const extra = String((env && env.LEADERBOARD_HIDE) || '')
    .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (userId && (LEADERBOARD_HIDE.user_ids.includes(String(userId)) || extra.includes(String(userId).toLowerCase()))) return true;
  if (e && (LEADERBOARD_HIDE.emails.map((x) => x.toLowerCase()).includes(e) || extra.includes(e))) return true;
  if (local && LEADERBOARD_HIDE.prefixes.some((p) => local.startsWith(p.toLowerCase()))) return true;
  return false;
}

/* ---- แคช 3 ชั้น (ทำให้หน้าอันดับตอบเร็วและไม่ค้าง) ----
   1) แคชใน isolate: ใหม่ภายใน 8 วินาที → ตอบทันที
   2) เก่าเกิน 8 วิแต่ไม่เกิน 10 นาที → ตอบข้อมูลเก่า "ทันที" แล้วคำนวณใหม่เบื้องหลัง (stale-while-revalidate)
      ผู้ใช้จึงไม่ต้องรอ Supabase/KV เลย (เดิมทุกคนที่โดนแคชหมดต้องรอคำนวณเต็มๆ ~หลายวินาที)
   3) Cache API ของ Cloudflare (ใช้ร่วมกันทุก isolate ใน datacenter เดียวกัน, อายุ 10 วิ) → isolate ใหม่ไม่ต้องคำนวณตั้งแต่ศูนย์
   + รวม request ที่ยิงพร้อมกันให้ใช้การคำนวณเดียว */
const TOP_FRESH_MS = 8000;
const TOP_STALE_MS = 10 * 60 * 1000;
const TOP_EDGE_KEY = 'https://cache.internal/top-spenders-v1';
let TOP_SPENDERS_CACHE = { at: 0, items: null, pending: null };
let TOP_BACKFILL_BUSY = false;

async function readEdgeTop() {
  try {
    const r = await caches.default.match(TOP_EDGE_KEY);
    if (!r) return null;
    const items = await r.json();
    return Array.isArray(items) ? items : null;
  } catch { return null; }
}
async function writeEdgeTop(items) {
  try {
    await caches.default.put(TOP_EDGE_KEY, new Response(JSON.stringify(items), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=10' },
    }));
  } catch { /* ข้าม */ }
}

function refreshTopSpenders(env, ctx) {
  if (TOP_SPENDERS_CACHE.pending) return TOP_SPENDERS_CACHE.pending;
  const p = computeTopSpenders(env, ctx).then(async (items) => {
    TOP_SPENDERS_CACHE = { at: Date.now(), items, pending: null };
    await writeEdgeTop(items);
    return items;
  }, (err) => {
    TOP_SPENDERS_CACHE.pending = null;
    throw err;
  });
  TOP_SPENDERS_CACHE.pending = p;
  return p;
}

async function getTopSpenders(env, ctx) {
  const c = TOP_SPENDERS_CACHE;
  const age = Date.now() - c.at;
  if (c.items && age < TOP_FRESH_MS) return c.items;
  if (c.items && age < TOP_STALE_MS) {
    // ตอบข้อมูลเก่าทันที แล้วรีเฟรชเบื้องหลัง
    const bg = refreshTopSpenders(env, ctx).catch((e) => console.error('top-spenders refresh failed:', e));
    if (ctx && ctx.waitUntil) ctx.waitUntil(bg);
    return c.items;
  }
  if (c.pending) return c.pending;
  // isolate ใหม่/แคชหมดนานแล้ว: ลองอ่านจากแคชกลางของ datacenter ก่อน
  const edge = await readEdgeTop();
  if (edge) {
    TOP_SPENDERS_CACHE = { at: Date.now(), items: edge, pending: null };
    return edge;
  }
  return refreshTopSpenders(env, ctx);
}

// hash สั้น ๆ ไว้เทียบว่าอันดับเปลี่ยนไหม (ไม่ใช่เรื่องความปลอดภัย)
function topSpendersVersion(items) {
  const str = items.map((i) => `${i.key}|${i.name}|${i.amount}|${i.avatar || ''}`).join(';');
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(16) + '-' + items.length;
}

/* ดึง topup_requests ที่ approved "ทั้งหมด" แบบแบ่งหน้า — PostgREST/Supabase ตัดผลลัพธ์ที่ max-rows (ปกติ 1000 แถว)
   แม้ส่ง limit มากกว่านั้น ถ้าไม่แบ่งหน้า ยอดรวมจะผิดเมื่อมีรายการเกิน 1000 ; เรียงตาม id เพื่อให้แบ่งหน้าไม่ซ้ำ/ไม่ตกหล่น */
async function fetchAllApprovedTopups(env) {
  const PAGE = 1000, MAX_PAGES = 200;
  const all = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = await supabaseSelect(env, 'topup_requests', {
      select: 'id,user_id,user_email,amount,created_at',
      status: 'eq.approved',
      amount: 'gt.0',
      order: 'id.asc',
      limit: String(PAGE),
      offset: String(page * PAGE),
    }, { timeoutMs: 8000 });
    if (!rows || !rows.length) break;
    for (const r of rows) all.push(r);
    if (rows.length < PAGE) break;
  }
  return all;
}

async function computeTopSpenders(env, ctx) {
  function maskName(email) {
    const local = String(email || '').split('@')[0] || '';
    if (!local) return '???***';
    return (local.slice(0, 3) || local.slice(0, 1)) + '***';
  }
  function fmtDate(iso) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '-';
    const d = new Date(t + 7 * 60 * 60 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  }

  const rows = await fetchAllApprovedTopups(env);

  // รอบแรก: หา "คน" ที่ถูกซ่อน (ทุกแถวของคนนั้นต้องหายหมด แม้บางแถวไม่มีอีเมล)
  const hidden = new Set();
  for (const r of rows) {
    if (isHiddenFromLeaderboard(env, r.user_id, r.user_email)) hidden.add(r.user_id || r.user_email);
  }

  const byUser = new Map();
  for (const r of rows) {
    const key = r.user_id || r.user_email;
    const amt = Number(r.amount) || 0;
    if (!key || amt <= 0) continue;
    if (hidden.has(key)) continue;
    const cur = byUser.get(key) || { email: r.user_email, total: 0, first: r.created_at };
    cur.total += amt;
    if (!cur.email && r.user_email) cur.email = r.user_email;
    if (r.created_at && (!cur.first || r.created_at < cur.first)) cur.first = r.created_at;
    byUser.set(key, cur);
  }

  // ยอดเท่ากัน: คนที่เติมครั้งแรกก่อนอยู่เหนือกว่า ; ยังเท่าอีก → เรียงตาม key เพื่อให้ลำดับนิ่ง ไม่สลับไปมาระหว่างการโพล
  const top = [...byUser.entries()]
    .sort((a, b) => (b[1].total - a[1].total)
      || String(a[1].first || '').localeCompare(String(b[1].first || ''))
      || String(a[0]).localeCompare(String(b[0])))
    .slice(0, 10);

  // รูปโปรไฟล์: อัปโหลดเอง (pcustom) > Discord/Google (profile) — ถ้ายังไม่มี = null
  // ดึง user_profiles ของทั้ง 10 คนใน query เดียว (เดิมยิง 10 query ต่อคน) แล้วอ่าน KV พร้อมกัน
  const profRows = new Map();
  let batchOk = false;
  try {
    const ids = top.map(([uid]) => String(uid)).filter((id) => /^[A-Za-z0-9_-]+$/.test(id));
    if (ids.length) {
      const rows = await supabaseSelect(env, 'user_profiles', {
        select: 'user_id,username,avatar_hash,avatar_version',
        user_id: `in.(${ids.join(',')})`,
      }, { timeoutMs: 6000 });
      for (const r of rows || []) profRows.set(String(r.user_id), r);
    }
    batchOk = true;
  } catch (err) { console.error('top-spenders: batch user_profiles failed', err); }
  const stored = await Promise.all(top.map(async ([uid]) => {
    let custom = null;
    try {
      const c = await readCustom(env, uid, batchOk ? (profRows.get(String(uid)) || null) : undefined);
      custom = isAvatarUrl(c.avatar) ? c.avatar : null;
    } catch { custom = null; }
    try {
      const raw = await env.SESSIONS.get(`profile:${uid}`);
      if (!raw) return { known: false, avatar: custom };
      const a = JSON.parse(raw).avatar;
      return { known: true, avatar: custom || (isAvatarUrl(a) ? a : null) };
    } catch { return { known: false, avatar: custom }; }
  }));
  // คนที่ยังไม่เคยจดโปรไฟล์เลย -> หารูปจาก session เบื้องหลัง "ไม่ให้ผู้ใช้ต้องรอ" (สแกน KV ช้า) แล้วจดไว้ให้รอบถัดไป
  const missing = new Set(top.filter((_, i) => !stored[i].known).map(([uid]) => String(uid)));
  if (missing.size && !TOP_BACKFILL_BUSY) {
    TOP_BACKFILL_BUSY = true;
    const job = (async () => {
      try {
        const filled = await backfillProfiles(env, missing);
        await Promise.all([...missing].map(async (uid) => {
          try {
            const av = filled.get(uid) || null;
            await env.SESSIONS.put(`profile:${uid}`, JSON.stringify({ avatar: av }),
              av ? undefined : { expirationTtl: 60 * 60 });
          } catch { /* ข้าม */ }
        }));
      } catch (err) { console.error('top-spenders backfill failed', err); }
      finally { TOP_BACKFILL_BUSY = false; }
    })();
    if (ctx && ctx.waitUntil) ctx.waitUntil(job);
  }

  // key = รหัสทึบของคนนั้น (hash ของ user id) ให้หน้าเว็บจับคู่ "คนเดิม" ข้ามการโพลเพื่อทำอนิเมชันสลับอันดับ — ย้อนกลับเป็น id จริงไม่ได้
  const keys = await Promise.all(top.map(([uid]) => avatarHash(String(uid))));
  return top.map(([, u], i) => ({
    rank: i + 1,
    key: keys[i],
    name: maskName(u.email),
    amount: u.total,
    joined: fmtDate(u.first),
    avatar: stored[i].avatar,
  }));
}

async function handleTopSpenders(request, env, ctx) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Worker ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  };
  try {
    const items = await getTopSpenders(env, ctx);
    const version = topSpendersVersion(items);
    const known = new URL(request.url).searchParams.get('v');
    if (known && known === version) {
      return new Response(JSON.stringify({ ok: true, version, unchanged: true }), { status: 200, headers });
    }
    return new Response(JSON.stringify({ ok: true, version, items }), { status: 200, headers });
  } catch (err) {
    console.error('handleTopSpenders failed:', err);
    return json({ error: 'ດຶງອັນດັບຍອດເຕີມບໍ່ສຳເລັດ' }, 502);
  }
}

/* ---------- ระบบจัดการลูกค้า (เฉพาะแอดมิน) ----------
   GET  /api/admin/customers?q=&limit=&offset=   -> รายชื่อลูกค้า + ยอดเงิน (ค้นหาด้วยอีเมล/ชื่อ/ID)
   GET  /api/admin/customers/detail?user_id=     -> ประวัติ: ปรับยอดโดยแอดมิน / เติมเงิน / ออเดอร์ / สถานะแบน
   POST /api/admin/customers/adjust  { user_id, amount, mode: 'add'|'sub', reason }  -> บวก/ลบยอด (atomic + บันทึกประวัติ)
   POST /api/admin/customers/ban     { user_id, banned: true|false, reason }         -> แบน/ปลดแบน
   POST /api/admin/customers/delete  { user_id, delete_history, also_ban }           -> ลบบัญชี
   ทุกอย่างทำฝั่ง Worker ด้วย service_role + ตรวจสิทธิ์แอดมินจาก session เสมอ (ไม่เชื่อ browser) */
const CUSTOMER_ID_RE = /^[A-Za-z0-9_.:@-]{1,120}$/;

async function sbRaw(env, method, path, body, extraHeaders) {
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, {
    method,
    headers: Object.assign({
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
    }, extraHeaders || {}),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data, text };
}

async function handleAdminCustomers(request, env, url) {
  const admin = await getSessionUser(request, env);
  if (!admin || !admin.isAdmin) {
    return json({ error: 'ບໍ່ມີສິດເຂົ້າເຖິງ — ຕ້ອງລ໋ອກອິນເປັນແອດມິນກ່ອນ' }, 403);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Worker ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }
  const adminName = String(admin.email || admin.username || admin.id || 'admin');
  const sub = url.pathname.replace(/\/+$/, '').slice('/api/admin/customers'.length) || '/';

  try {
    /* ---- รายชื่อลูกค้า ---- */
    if (sub === '/' && request.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
      const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '30', 10) || 30, 1), 100);
      const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);
      const r = await sbRaw(env, 'POST', 'rpc/admin_customers', { p_q: q || null, p_limit: limit, p_offset: offset });
      if (!r.ok) { console.error('admin_customers failed', r.status, r.text); return json({ error: 'ດຶງລາຍຊື່ລູກຄ້າບໍ່ສຳເລັດ' }, 502); }
      const rows = Array.isArray(r.data) ? r.data : [];
      return json({
        ok: true,
        total: rows.length ? Number(rows[0].total_count) : 0,
        items: rows.map((x) => ({
          user_id: x.user_id, email: x.email, username: x.username,
          balance: Number(x.balance) || 0, total_topup: Number(x.total_topup) || 0,
          orders_count: Number(x.orders_count) || 0, banned: !!x.banned, last_activity: x.last_activity,
          is_admin: !!(x.email && ADMIN_EMAILS.includes(String(x.email).toLowerCase())),
        })),
      });
    }

    /* ---- ประวัติของลูกค้าคนหนึ่ง ---- */
    if (sub === '/detail' && request.method === 'GET') {
      const uid = url.searchParams.get('user_id') || '';
      if (!CUSTOMER_ID_RE.test(uid)) return json({ error: 'user_id ບໍ່ຖືກຕ້ອງ' }, 400);
      const eq = `eq.${uid}`;
      const [adj, tops, ords, ban, wal] = await Promise.all([
        supabaseSelect(env, 'wallet_adjustments', { select: 'delta,balance_before,balance_after,reason,admin_email,created_at', user_id: eq, order: 'created_at.desc', limit: '30' }, { timeoutMs: 8000 }),
        supabaseSelect(env, 'topup_requests', { select: 'amount,status,ref_no,created_at', user_id: eq, order: 'created_at.desc', limit: '30' }, { timeoutMs: 8000 }),
        supabaseSelect(env, 'orders', { select: 'product_name,duration_label,price,status,created_at', user_id: eq, order: 'created_at.desc', limit: '30' }, { timeoutMs: 8000 }),
        supabaseSelect(env, 'banned_users', { select: 'reason,banned_by,created_at', user_id: eq, limit: '1' }, { timeoutMs: 8000 }),
        supabaseSelect(env, 'wallets', { select: 'balance', user_id: eq, limit: '1' }, { timeoutMs: 8000 }),
      ]);
      return json({
        ok: true,
        balance: wal && wal[0] ? Number(wal[0].balance) || 0 : 0,
        ban: ban && ban[0] ? ban[0] : null,
        adjustments: adj || [], topups: tops || [], orders: ords || [],
      });
    }

    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    let body = {};
    try { body = await request.json(); } catch { return json({ error: 'ຂໍ້ມູນທີ່ສົ່ງມາບໍ່ຖືກຕ້ອງ' }, 400); }
    const uid = String(body.user_id || '');
    if (!CUSTOMER_ID_RE.test(uid)) return json({ error: 'user_id ບໍ່ຖືກຕ້ອງ' }, 400);
    const email = body.email ? String(body.email).slice(0, 200) : null;
    const targetIsAdmin = String(uid) === String(admin.id) || (email && ADMIN_EMAILS.includes(email.toLowerCase()));

    /* ---- บวก/ลบยอด ---- */
    if (sub === '/adjust') {
      const amount = Number(body.amount);
      if (!Number.isInteger(amount) || amount <= 0 || amount > 1e12) {
        return json({ error: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກເຕັມ ແລະ ຫຼາຍກວ່າ 0' }, 400);
      }
      const delta = body.mode === 'sub' ? -amount : amount;
      const r = await sbRaw(env, 'POST', 'rpc/admin_adjust_balance', {
        p_user_id: uid, p_delta: delta, p_reason: String(body.reason || '').slice(0, 300), p_admin: adminName, p_email: email,
      });
      if (!r.ok) {
        const msg = (r.data && r.data.message) || r.text || '';
        if (/insufficient_balance/.test(msg)) return json({ error: 'ຍອດເງິນບໍ່ພໍໃຫ້ຫັກ (ຍອດຈະຕິດລົບ)' }, 400);
        console.error('admin_adjust_balance failed', r.status, r.text);
        return json({ error: 'ປັບຍອດບໍ່ສຳເລັດ' }, 502);
      }
      const row = Array.isArray(r.data) ? r.data[0] : r.data;
      try {
        await sendDiscordAlert(env, {
          title: delta > 0 ? '➕ แอดมินเพิ่มยอดเงินลูกค้า' : '➖ แอดมินหักยอดเงินลูกค้า',
          color: delta > 0 ? 0x2ecc71 : 0xe67e22,
          fields: [
            { name: 'ลูกค้า', value: email || uid, inline: true },
            { name: 'จำนวน', value: String(delta), inline: true },
            { name: 'ยอดก่อน → หลัง', value: `${row.balance_before} → ${row.balance_after}`, inline: false },
            { name: 'โดยแอดมิน', value: adminName, inline: true },
            { name: 'เหตุผล', value: String(body.reason || '-').slice(0, 200), inline: false },
          ],
        });
      } catch { /* แจ้งเตือนเป็นของเสริม */ }
      return json({ ok: true, balance_before: Number(row.balance_before), balance_after: Number(row.balance_after) });
    }

    /* ---- แบน / ปลดแบน ---- */
    if (sub === '/ban') {
      if (body.banned) {
        if (targetIsAdmin) return json({ error: 'ບໍ່ສາມາດແບນບັນຊີແອດມິນ/ບັນຊີຂອງທ່ານເອງ' }, 400);
        const r = await sbRaw(env, 'POST', 'banned_users?on_conflict=user_id', {
          user_id: uid, email, reason: String(body.reason || '').slice(0, 300) || null, banned_by: adminName,
        }, { prefer: 'resolution=merge-duplicates,return=minimal' });
        if (!r.ok) { console.error('ban failed', r.status, r.text); return json({ error: 'ແບນບໍ່ສຳເລັດ' }, 502); }
      } else {
        const r = await sbRaw(env, 'DELETE', `banned_users?user_id=eq.${encodeURIComponent(uid)}`, undefined, { prefer: 'return=minimal' });
        if (!r.ok) { console.error('unban failed', r.status, r.text); return json({ error: 'ປົດແບນບໍ່ສຳເລັດ' }, 502); }
      }
      BANNED_CACHE.at = 0; // ให้ isolate นี้อ่านรายชื่อแบนใหม่ทันที (isolate อื่นอัปเดตภายใน ~10 วินาที)
      return json({ ok: true, banned: !!body.banned });
    }

    /* ---- ลบบัญชี ---- */
    if (sub === '/delete') {
      if (targetIsAdmin) return json({ error: 'ບໍ່ສາມາດລຶບບັນຊີແອດມິນ/ບັນຊີຂອງທ່ານເອງ' }, 400);
      const r = await sbRaw(env, 'POST', 'rpc/admin_delete_customer', { p_user_id: uid, p_delete_history: !!body.delete_history });
      if (!r.ok) { console.error('admin_delete_customer failed', r.status, r.text); return json({ error: 'ລຶບບັນຊີບໍ່ສຳເລັດ' }, 502); }
      if (body.also_ban) {
        await sbRaw(env, 'POST', 'banned_users?on_conflict=user_id', {
          user_id: uid, email, reason: 'ລຶບບັນຊີໂດຍແອດມິນ', banned_by: adminName,
        }, { prefer: 'resolution=merge-duplicates,return=minimal' });
        BANNED_CACHE.at = 0;
      }
      try { await env.SESSIONS.delete(`profile:${uid}`); await env.SESSIONS.delete(`pcustom:${uid}`); } catch { /* ข้าม */ }
      return json({ ok: true, deleted: r.data, banned: !!body.also_ban });
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('handleAdminCustomers failed:', err);
    return json({ error: 'ເກີດຂໍ້ຜິດພາດ, ລອງໃໝ່ອີກຄັ້ງ' }, 502);
  }
}

/* ---------- 7) POST /api/topup/create ----------
   ลูกค้ากดสร้างรายการเติมเงิน (ยังไม่มีสลิป) — ก่อนหน้านี้ path นี้ไม่มีอยู่จริงเลย
   (fetch ไปแล้วโดน env.ASSETS ตอบ 404 กลับมา) topup.js เลยเงียบๆ fallback ไปสร้าง
   topupId ปลอมฝั่ง browser เอง ไม่มีอะไรถูกบันทึกจริง — ตอนนี้เช็ค login จริง + คืน
   topupId จริงให้ (แถวจริงใน topup_requests จะถูกสร้างตอน /api/topup/confirm พร้อม
   สลิปเลย ไม่ใช่ตอนนี้ เพราะขั้นนี้ยังไม่มีสลิปให้แอดมินตรวจ) */
async function handleTopupCreate(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ error: 'ກະລຸນາລ໋ອກອິນກ່ອນເຕີມເງິນ', requireLogin: true }, 401);
  }

  let body = {};
  try { body = await request.json(); } catch { /* ignore, amount จะเป็น 0 แล้วโดน validate ด้านล่าง */ }

  const amount = Number(body.amount) || 0;
  if (amount < 1000) {
    return json({ error: 'ຈຳນວນເງິນຕ້ອງບໍ່ຕ່ຳກວ່າ 1,000 ກີບ' }, 400);
  }

  return json({ topupId: crypto.randomUUID() });
}

/* ---------- 8) POST /api/topup/confirm ----------
   ลูกค้าอัพโหลดสลิปตอนกดยืนยันการโอน — จุดนี้คือสาเหตุที่ห้องแอดมินไม่เคยมีรายการ
   ขึ้นมาให้อนุมัติ/ปฏิเสธเลย: เดิม endpoint นี้ไม่มีอยู่จริง fetch จึงล้มเหลวเงียบๆ
   (.catch(() => null)) แล้ว topup.js ก็พาไปหน้า "รอตรวจสอบ" อยู่ดีโดยไม่สนผลลัพธ์
   ทำให้ลูกค้าเข้าใจว่าส่งสำเร็จ ทั้งที่ไม่มีอะไรถูกบันทึกลง Supabase เลยสักแถว
   ตอนนี้: อัพโหลดสลิปขึ้น storage bucket "topup-slips" (public) แล้ว insert แถวจริง
   เข้า topup_requests (status: pending) ด้วย service_role key ฝั่ง Worker เท่านั้น
   (key ไม่เคยหลุดมาถึง browser) ให้ห้องแอดมินอ่านเจอทันทีที่กด "ໂຫຼດຄືນໃໝ່" */
async function handleTopupConfirm(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ error: 'ກະລຸນາລ໋ອກອິນກ່ອນເຕີມເງິນ', requireLogin: true }, 401);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(
      { error: 'Worker ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (ເບິ່ງ wrangler.toml + wrangler secret)' },
      500
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch (err) {
    return json({ error: 'ອ່ານຟອມທີ່ສົ່ງມາບໍ່ສຳເລັດ' }, 400);
  }

  const amount = Number(form.get('amount')) || 0;
  const bank = form.get('bank') != null ? String(form.get('bank')) : null;
  const slip = form.get('slip');

  if (amount < 1000) {
    return json({ error: 'ຈຳນວນເງິນຕ້ອງບໍ່ຕ່ຳກວ່າ 1,000 ກີບ' }, 400);
  }
  if (!(slip instanceof File) || slip.size === 0) {
    return json({ error: 'ກະລຸນາອັບໂຫຼດຮູບສະລິບກ່ອນ' }, 400);
  }
  // ---- ຄວາມປອດໄພ: ຈຳກັດໃຫ້ອັບໂຫຼດໄດ້ສະເພາະຮູບພາບ ແລະ ຂະໜາດບໍ່ໃຫຍ່ເກີນໄປ ----
  // slip.type ມາຈາກ browser ຂອງລູກຄ້າ (ບໍ່ໜ້າເຊື່ອຖື 100%) ແຕ່ ext ໃນຊື່ໄຟລ໌ຍິ່ງບໍ່ຄວນເຊື່ອ
  // ຖ້າບໍ່ກັ່ນຕອງເລີຍ ລູກຄ້າສາມາດອັບໂຫຼດໄຟລ໌ໃດກໍ່ໄດ້ (ເຊັ່ນ .html) ຂຶ້ນ storage bucket ທີ່
  // ເປັນ public ຢູ່ (topup-slips) ແລ້ວແຊຣ໌ລິ້ງນັ້ນອອກໄປໄດ້ — ຈຳກັດ MIME type ໄວ້ກັນໄວ້ກ່ອນ
  const ALLOWED_SLIP_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  const MAX_SLIP_BYTES = 8 * 1024 * 1024; // 8MB
  if (slip.type && !ALLOWED_SLIP_TYPES.has(slip.type)) {
    return json({ error: 'ຮອງຮັບສະເພາະໄຟລ໌ຮູບພາບ (jpg/png/webp/gif) ເທົ່ານັ້ນ' }, 400);
  }
  if (slip.size > MAX_SLIP_BYTES) {
    return json({ error: 'ໄຟລ໌ຮູບໃຫຍ່ເກີນໄປ (ຈຳກັດ 8MB)' }, 400);
  }

  try {
    const SAFE_EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    const extMatch = /\.([a-zA-Z0-9]{1,8})$/.exec(slip.name || '');
    const rawExt = extMatch ? extMatch[1].toLowerCase() : null;
    const ext = SAFE_EXT_BY_TYPE[slip.type]
      || (rawExt && /^(jpg|jpeg|png|webp|gif)$/.test(rawExt) ? rawExt : 'jpg');
    const objectPath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const slipUrl = await uploadToSupabaseStorage(env, 'topup-slips', objectPath, slip);

    // ໝາຍເຫດ: ບໍ່ໃສ່ຄໍລໍາ "bank" ໃນນີ້ ເພາະຕາຕະລາງ topup_requests ທີ່ໃຊ້ຢູ່ (ອ້າງອີງ
    // ຈາກ admin.js) ບໍ່ໄດ້ອ່ານ/ໂຊວ໌ຄ່ານີ້ຢູ່ແລ້ວ — ຖ້າ column ບໍ່ມີໃນ Supabase ຈິງ ການ
    // insert ຈະ error ທັງແຖວ. ຖ້າຢາກເກັບ bank ໄວ້ນຳ ໃຫ້ເພີ່ມຄໍລໍານີ້ໃນ Supabase ກ່ອນ
    // ແລ້ວຄ່ອຍໃສ່ "bank" ກັບຄືນເຂົ້າ object ດ້ານລຸ່ມນີ້
    const rows = await supabaseInsert(env, 'topup_requests', {
      user_id: user.id,
      user_email: user.email || null,
      amount,
      slip_url: slipUrl,
      status: 'pending',
    });

    // ---- แจ้งเตือนเข้า Discord: มีคนส่งสลิปเติมเงินเข้ามา รอแอดมินตรวจสอบ ----
    await sendTopupToDiscord(env, {
      id: rows && rows[0] && rows[0].id,
      amount,
      user,
      slipUrl,
    });

    return json({ ok: true, id: (rows && rows[0] && rows[0].id) || null });
  } catch (err) {
    console.error('handleTopupConfirm failed:', err);
    return json({ error: 'ບັນທຶກລາຍການເຕີມເງິນບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ' }, 502);
  }
}

/* ---------- 9) GET /api/topup/history ----------
   ໜ້າ "ປະຫວັດເຕີມເງິນ" (topup-history.html) ຮຽກຈຸດນີ້ ເພື່ອເອົາລາຍການເຕີມເງິນ
   ຂອງລູກຄ້າຄົນທີ່ login ຢູ່ເທົ່ານັ້ນມາໂຊວ໌ — ໃຊ້ service_role key ຝັ່ງ Worker
   ດຶງຈາກ topup_requests ແລ້ວກັ່ນຕອງດ້ວຍ user_id ຂອງ session ນີ້ຄືກັນ (ບໍ່ໄດ້ໃຫ້
   ລູກຄ້າຮ້ອງ Supabase ຕົງໆເລີຍ ຄືກັນກັບຈຸດອື່ນໆໃນໄຟລ໌ນີ້) */
async function handleTopupHistory(request, env) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ error: 'ກະລຸນາລ໋ອກອິນກ່ອນ', requireLogin: true }, 401);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Worker ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  try {
    const rows = await supabaseSelect(env, 'topup_requests', {
      // viewed_at: ຄໍລໍາໃໝ່ (ເບິ່ງ migration_add_topup_viewed_at.sql) — ໃຊ້ບອກຝັ່ງ
      // ລູກຄ້າແບບ realtime ວ່າແອດມິນເປີດເບິ່ງສະລິບຢູ່ ກ່ອນຈະຢືນຢັນ/ປະຕິເສດ
      select: 'id,ref_no,amount,status,slip_url,created_at,viewed_at',
      user_id: `eq.${user.id}`,
      order: 'created_at.desc',
      limit: '200',
    });
    return json({ ok: true, items: rows || [] });
  } catch (err) {
    console.error('handleTopupHistory failed:', err);
    return json({ error: 'ດຶງປະຫວັດການເຕີມເງິນບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ' }, 502);
  }
}

/* ---------- 10) POST /api/orders/create ----------
   ລູກຄ້າ (ຕ້ອງ login) ກົດ "ຊື້ເລີຍ" ໃນ category.html — ກ່ອນໜ້ານີ້ປຸ່ມນີ້ພຽງແຕ່ໂຊວ໌ alert
   ບອກວ່າລະບົບຍັງບໍ່ເປີດໃຫ້ນຳໃຊ້ (ເບິ່ງ category.js) ຍັງບໍ່ມີການສັ່ງຊື້ຈິງເກີດຂຶ້ນເລີຍ
   ຕອນນີ້: ຮຽກ RPC "purchase_product" (ຕ້ອງສ້າງໄວ້ໃນ Supabase ກ່ອນ — ເບິ່ງ README/ຄຳແນະນຳ
   SQL ທ້າຍໂປຣເຈັກ) ເຊິ່ງເຮັດວຽກແບບ atomic ໃນ transaction ດຽວ: ລ໋ອກແຖວສິນຄ້າ/ກະເປົາເງິນ,
   ເບິ່ງຍອດເງິນພຽງພໍບໍ່, ດຶງລະຫັດສິນຄ້າທີ່ຍັງບໍ່ຖືກໃຊ້ 1 ລະຫັດ, ຫັກເງິນ, ບັນທຶກແຖວໃໝ່ໃນ
   ຕາຕະລາງ orders — ຖ້າຂັ້ນຕອນໃດລົ້ມເຫລວ ຈະ rollback ທັງໝົດ (ບໍ່ຫັກເງິນ/ບໍ່ອອກລະຫັດຊ້ຳ) */
async function handleOrderCreate(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ error: 'ກະລຸນາລ໋ອກອິນກ່ອນສັ່ງຊື້', requireLogin: true }, 401);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(
      { error: 'Worker ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (ເບິ່ງ wrangler.toml + wrangler secret)' },
      500
    );
  }

  let body = {};
  try { body = await request.json(); } catch { /* productId จะเป็น undefined แล้วโดน validate ด้านล่าง */ }

  const productId = body.productId ? String(body.productId) : null;
  const durationId = body.durationId ? String(body.durationId) : null;
  if (!productId) {
    return json({ error: 'ບໍ່ພົບສິນຄ້າທີ່ຕ້ອງການຊື້' }, 400);
  }

  // ໂຄ້ດສ່ວນຫຼຸດ (ບໍ່ບັງຄັບ) — ການຄິດສ່ວນຫຼຸດ/ນັບສິດຈິງເຮັດໃນ purchase_product (SQL) ທັງໝົດ
  // ຝັ່ງນີ້ກວດແຕ່ຮູບແບບຂໍ້ຄວາມ ແລ້ວສົ່ງຕໍ່ເທົ່ານັ້ນ
  let couponCode = null;
  if (body.couponCode !== undefined && body.couponCode !== null && String(body.couponCode).trim() !== '') {
    couponCode = String(body.couponCode).trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,32}$/.test(couponCode)) {
      return json({ error: 'ໂຄ້ດສ່ວນຫຼຸດບໍ່ຖືກຕ້ອງ ຫຼືໝົດອາຍຸແລ້ວ' }, 400);
    }
  }

  // ຂໍ້ຄວາມ error ຈາກ RAISE EXCEPTION ໃນ RPC (ເບິ່ງ SQL ທ້າຍໄຟລ໌) -> ຂໍ້ຄວາມພາສາລາວທີ່ໂຊວ໌ໃຫ້ລູກຄ້າ
  const ERROR_LABEL = {
    PRODUCT_NOT_FOUND: 'ບໍ່ພົບສິນຄ້ານີ້ (ອາດຖືກລຶບ/ເຊື່ອງໄປແລ້ວ)',
    PRODUCT_PAUSED: 'ສິນຄ້ານີ້ຢຸດຂາຍຊົ່ວຄາວ',
    DURATION_NOT_FOUND: 'ບໍ່ພົບໄລຍະເວລາທີ່ເລືອກ',
    INSUFFICIENT_BALANCE: 'ຍອດເງິນໃນກະເປົາບໍ່ພຽງພໍ ກະລຸນາເຕີມເງິນກ່ອນ',
    OUT_OF_STOCK: 'ສິນຄ້ານີ້ໝົດສະຕັອກແລ້ວ',
    COUPON_INVALID: 'ໂຄ້ດສ່ວນຫຼຸດບໍ່ຖືກຕ້ອງ ຫຼືໝົດອາຍຸແລ້ວ',
    COUPON_USER_LIMIT: 'ທ່ານໃຊ້ໂຄ້ດນີ້ຄົບສິດແລ້ວ',
    COUPON_LIMIT: 'ໂຄ້ດນີ້ຖືກໃຊ້ຄົບຈຳນວນບັນຊີແລ້ວ',
    COUPON_RESELLER: 'ຕົວແທນບໍ່ສາມາດໃຊ້ໂຄ້ດສ່ວນຫຼຸດໄດ້',
  };

  try {
    const rows = await supabaseRpcStrict(env, 'purchase_product', {
      p_user_id: user.id,
      p_user_email: user.email || null,
      p_product_id: productId,
      p_duration_id: durationId,
      p_coupon_code: couponCode,
    });

    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || !row.order_id) {
      return json({ error: 'ສັ່ງຊື້ບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ' }, 502);
    }

    return json({ ok: true, orderId: row.order_id, code: row.code });
  } catch (err) {
    const msg = String((err && err.message) || '');
    const matchedKey = Object.keys(ERROR_LABEL).find((key) => msg.includes(key));
    console.error('handleOrderCreate failed:', err);
    return json({ error: matchedKey ? ERROR_LABEL[matchedKey] : 'ສັ່ງຊື້ບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ' }, matchedKey === 'INSUFFICIENT_BALANCE' || matchedKey === 'OUT_OF_STOCK' || (matchedKey && matchedKey.startsWith('COUPON_')) ? 400 : 502);
  }
}

/* ---------- 10b) POST /api/coupons/validate  { code } ----------
   ລູກຄ້າ (ຕ້ອງ login) ກົດປຸ່ມ "ໃຊ້ໂຄ້ດ" ໃນ product.html — ກວດວ່າໂຄ້ດໃຊ້ໄດ້ບໍ ແລະ ບັນຊີນີ້ເຫຼືອສິດໃຊ້ຈັກຄັ້ງ
   (ກວດແບບດຽວກັນກັບ purchase_product ແຕ່ "ບໍ່ນັບສິດ" — ການນັບສິດຈິງເກີດຕອນຊື້ສຳເລັດເທົ່ານັ້ນ)
   ຕາຕະລາງ coupons/coupon_redemptions ຖືກ revoke ຈາກ anon/authenticated ແລ້ວ ອ່ານໄດ້ສະເພາະ service_role (Worker ນີ້)
   ກັນເດົາໂຄ້ດ: ຈຳກັດ 12 ຄັ້ງ/ນາທີ/ບັນຊີ (ເກັບໃນ KV, best-effort) */
async function handleCouponValidate(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ error: 'ກະລຸນາລ໋ອກອິນກ່ອນໃຊ້ໂຄ້ດສ່ວນຫຼຸດ', requireLogin: true }, 401);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(
      { error: 'Worker ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (ເບິ່ງ wrangler.toml + wrangler secret)' },
      500
    );
  }

  let body = {};
  try { body = await request.json(); } catch { /* code ຈະເປັນຄ່າວ່າງ ແລ້ວຖືກ validate ດ້ານລຸ່ມ */ }

  const INVALID = 'ໂຄ້ດບໍ່ຖືກຕ້ອງ ຫຼືໝົດອາຍຸແລ້ວ';
  const code = String(body.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) return json({ error: INVALID }, 404);

  // ຕົວແທນ (reseller) ໃຊ້ໂຄ້ດສ່ວນຫຼຸດບໍ່ໄດ້ — ກວດຈາກ is_active_reseller ໃນ Supabase (ຕົວຕັດສິນຈິງຢູ່ purchase_product ອີກຊັ້ນ)
  try {
    const isReseller = await supabaseRpcStrict(env, 'is_active_reseller', { p_user_id: user.id });
    if (isReseller === true) return json({ error: 'ຕົວແທນບໍ່ສາມາດໃຊ້ໂຄ້ດສ່ວນຫຼຸດໄດ້', resellerBlocked: true }, 403);
  } catch (err) {
    console.error('handleCouponValidate reseller check failed:', err); // ກວດບໍ່ໄດ້ ບໍ່ຂັດຂວາງ — purchase_product ຈະກວດຊ້ຳຕອນຊື້
  }

  try {
    const rlKey = `cpnrl:${user.id}:${Math.floor(Date.now() / 60000)}`;
    const tries = parseInt((await env.SESSIONS.get(rlKey)) || '0', 10) || 0;
    if (tries >= 12) return json({ error: 'ລອງໂຄ້ດຫຼາຍເກີນໄປ ກະລຸນາລໍຖ້າ 1 ນາທີ ແລ້ວລອງໃໝ່' }, 429);
    await env.SESSIONS.put(rlKey, String(tries + 1), { expirationTtl: 120 });
  } catch (err) {
    console.error('handleCouponValidate rate-limit failed:', err); // KV ມີບັນຫາ ບໍ່ຄວນຂັດຂວາງລູກຄ້າ
  }

  try {
    const rows = await supabaseSelect(env, 'coupons', {
      select: 'code,type,value,active,max_accounts,uses_per_account,expires_at',
      code: `eq.${code}`,
      limit: '1',
    });
    const c = rows && rows[0];
    const expired = c && c.expires_at && new Date(c.expires_at).getTime() <= Date.now();
    if (!c || !c.active || expired) return json({ error: INVALID }, 404);

    const mine = await supabaseSelect(env, 'coupon_redemptions', {
      select: 'id',
      code: `eq.${code}`,
      user_id: `eq.${user.id}`,
    });
    const userUses = Array.isArray(mine) ? mine.length : 0;
    const remaining = Number(c.uses_per_account) - userUses;
    if (remaining <= 0) return json({ error: 'ທ່ານໃຊ້ໂຄ້ດນີ້ຄົບສິດແລ້ວ' }, 400);

    // ບັນຊີໃໝ່ (ຍັງບໍ່ເຄີຍໃຊ້ໂຄ້ດນີ້) ຕ້ອງຍັງມີໂຄວຕ້າ "ຈຳນວນບັນຊີ" ເຫຼືອ — ກົດດຽວກັນກັບ COUPON_LIMIT ໃນ SQL
    if (userUses === 0 && c.max_accounts != null) {
      const st = await supabaseSelect(env, 'coupon_stats', { select: 'accounts_used', code: `eq.${code}` });
      const used = st && st[0] ? Number(st[0].accounts_used) : 0;
      if (used >= Number(c.max_accounts)) return json({ error: 'ໂຄ້ດນີ້ຖືກໃຊ້ຄົບຈຳນວນບັນຊີແລ້ວ' }, 400);
    }

    return json({ ok: true, code: c.code, type: c.type, value: Number(c.value), remaining });
  } catch (err) {
    console.error('handleCouponValidate failed:', err);
    return json({ error: 'ກວດໂຄ້ດບໍ່ສຳເລັດ ລອງໃໝ່ພາຍຫຼັງ' }, 502);
  }
}

/* ---------- 11) GET /api/orders/history ----------
   ໜ້າ "ປະຫວັດການສັ່ງຊື້" (orders.html) ຮຽກຈຸດນີ້ ເພື່ອເອົາລາຍການສັ່ງຊື້ຂອງລູກຄ້າຄົນທີ່
   login ຢູ່ເທົ່ານັ້ນມາໂຊວ໌ — ຄືກັນກັບ handleTopupHistory ແຕ່ອ່ານຈາກຕາຕະລາງ orders ແທນ */
async function handleOrdersHistory(request, env) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ error: 'ກະລຸນາລ໋ອກອິນກ່ອນ', requireLogin: true }, 401);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Worker ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  try {
    const rows = await supabaseSelect(env, 'orders', {
      select: 'id,ref_no,product_name,duration_label,price,code,status,created_at',
      user_id: `eq.${user.id}`,
      order: 'created_at.desc',
      limit: '200',
    });

    // orders ไม่มีคอลัมน์รูปสินค้า -> join กับ products ด้วย product_name (เหมือน handleRecentPurchases)
    // ถ้าดึงรูปไม่สำเร็จ/สินค้าถูกลบไปแล้ว ก็แค่ไม่มี image_url (หน้าบ้านจะโชว์รูปสำรอง) ไม่ทำให้ประวัติพัง
    let imageByName = new Map();
    try {
      const products = await supabaseSelect(env, 'products', { select: 'name,image_url' });
      imageByName = new Map((products || []).map((p) => [p.name, p.image_url || null]));
    } catch (e) {
      console.error('handleOrdersHistory: product images unavailable:', e);
    }
    const items = (rows || []).map((r) => ({ ...r, image_url: imageByName.get(r.product_name) || null }));
    return json({ ok: true, items });
  } catch (err) {
    console.error('handleOrdersHistory failed:', err);
    return json({ error: 'ດຶງປະຫວັດການສັ່ງຊື້ບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ' }, 502);
  }
}

/* ---------- 12) GET /api/account/stats ----------
   ຍັງບໍ່ມີໜ້າໃດເອີ້ນໃຊ້ຢູ່ຕອນນີ້ (ໜ້າໂປຣໄຟລ໌ເກົ່າຖືກລຶບອອກໄປແລ້ວ) — ເກັບ endpoint ນີ້ໄວ້ເຜື່ອ
   ພາຍຫຼັງເຮັດໜ້າບັນຊີຄືນມາ. ເດີມ endpoint ນີ້ບໍ່ມີຢູ່ຈິງ (fetch ແລ້ວໄດ້ 404 ຄືນຄ່າ 0
   ຕະຫຼອດ) ຕອນນີ້ຄິດໄລ່ຈາກຕາຕະລາງ orders ຈິງຂອງລູກຄ້າຄົນນັ້ນ */
async function handleAccountStats(request, env) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ error: 'ກະລຸນາລ໋ອກອິນກ່ອນ', requireLogin: true }, 401);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ordersCompleted: 0, totalSpent: 0 });
  }

  try {
    const rows = await supabaseSelect(env, 'orders', {
      select: 'price,status',
      user_id: `eq.${user.id}`,
      status: 'eq.completed',
      limit: '10000',
    });
    const items = rows || [];
    const totalSpent = items.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    return json({ ordersCompleted: items.length, totalSpent });
  } catch (err) {
    console.error('handleAccountStats failed:', err);
    return json({ ordersCompleted: 0, totalSpent: 0 });
  }
}

/* ---------- 13) GET /api/account/reseller-status ----------
   ຍັງບໍ່ມີໜ້າໃດເອີ້ນໃຊ້ຢູ່ຕອນນີ້ (ເກັບໄວ້ເຜື່ອພາຍຫຼັງ) — ໃຊ້ເບິ່ງວ່າຄົນທີ່ login ຢູ່ ເປັນຕົວແທນຢູ່ບໍ່ (ແລະລະດັບ/ໂຄວຕ້າ/
   ວັນໝົດອາຍຸ) — ອ່ານຈາກ reseller_status ດ້ວຍ service_role key (ຕາຕະລາງນີ້ບໍ່ໄດ້ເປີດໃຫ້ browser
   ອ່ານກົງໆ) ຄືນ status: null ຖ້າຍັງບໍ່ເຄີຍ redeem ຄີຍ໌ຕົວແທນເລີຍ */
async function handleResellerStatusGet(request, env) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ error: 'ກະລຸນາລ໋ອກອິນກ່ອນ', requireLogin: true }, 401);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: true, status: null });
  }

  try {
    const rows = await supabaseSelect(env, 'reseller_status', {
      select: 'is_reseller,duration_type,period_start,period_end,quota_target,discount_percent,display_name',
      user_id: `eq.${user.id}`,
      limit: '1',
    });
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;

    // ລາຄາສະເພາະຕົວແທນຄົນນີ້ (ແອດມິນຕັ້ງແຍກຕໍ່ຄົນ) — ຕາຕະລາງ reseller_custom_prices
    // ຖ້າຍັງບໍ່ໄດ້ແລ່ນ agent-custom-prices.sql ຕາຕະລາງຈະບໍ່ມີ -> ຂ້າມໄປ (ໃຊ້ລາຄາຕົວແທນທົ່ວໄປຕາມເດີມ)
    let customPrices = [];
    if (row && row.is_reseller) {
      try {
        const cp = await supabaseSelect(env, 'reseller_custom_prices', {
          select: 'scope_key,price',
          user_id: `eq.${user.id}`,
        });
        customPrices = Array.isArray(cp) ? cp : [];
      } catch (err) {
        console.error('reseller custom prices load skipped:', err);
      }
    }
    // group2 = ตัวแทนที่แอดมินตั้งชื่อให้แล้ว (ได้ราคา reseller_price_2) — ไม่ส่งชื่อจริงออกไป
    const status = row ? { ...row, group2: !!(row.display_name && String(row.display_name).trim()) } : null;
    if (status) delete status.display_name;
    return json({ ok: true, status, customPrices });
  } catch (err) {
    console.error('handleResellerStatusGet failed:', err);
    return json({ ok: true, status: null });
  }
}

/* ---------- 14) POST /api/account/redeem-reseller-key ----------
   ໜ້າ reseller.html ຮຽກຈຸດນີ້ ຕອນລູກຄ້າກອກຄີຍ໌ຕົວແທນແລ້ວກົດຢືນຢັນ — ຮຽກ RPC redeem_reseller_key
   ດ້ວຍ user.id/user.email ຂອງຄົນທີ່ login ຢູ່ຈາກ session cookie ເທົ່ານັ້ນ (ບໍ່ຮັບຄ່າ user id ຈາກ
   body ເດັດຂາດ ເພື່ອກັນລູກຄ້າສວມຮອຍປົດລັອກລາຄາຕົວແທນໃຫ້ຄົນອື່ນ) */
async function handleRedeemResellerKey(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ error: 'ກະລຸນາລ໋ອກອິນກ່ອນ', requireLogin: true }, 401);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Worker ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  let body = {};
  try { body = await request.json(); } catch { /* code จะเป็น undefined แล้วโดน validate ด้านล่าง */ }

  const code = body.code ? String(body.code).trim().toUpperCase() : null;
  if (!code) {
    return json({ error: 'ກະລຸນາໃສ່ຄີຍ໌ຕົວແທນ' }, 400);
  }

  // ---- ຄວາມປອດໄພ: ຈຳກັດຈຳນວນຄັ້ງທີ່ລອງໃສ່ຄີຍ໌ຕົວແທນຕໍ່ຜູ້ໃຊ້ (ກັນ brute-force ເດົາຄີຍ໌) ----
  const limited = await isRateLimited(env, `resellerkeylimit:${user.id}`, 10, 15 * 60);
  if (limited) {
    return json({ error: 'ລອງໃສ່ຄີຍ໌ຫຼາຍເທື່ອເກີນໄປ ກະລຸນາລໍຖ້າ 15 ນາທີແລ້ວລອງໃໝ່' }, 429);
  }

  const ERROR_LABEL = {
    KEY_NOT_FOUND: 'ບໍ່ພົບຄີຍ໌ນີ້ ກະລຸນາກວດສອບຄີຍ໌ອີກຄັ້ງ',
    KEY_ALREADY_USED: 'ຄີຍ໌ນີ້ຖືກໃຊ້ໄປແລ້ວ',
  };

  try {
    const rows = await supabaseRpcStrict(env, 'redeem_reseller_key', {
      p_user_id: user.id,
      p_user_email: user.email || null,
      p_code: code,
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    return json({
      ok: true,
      durationType: row ? row.duration_type : null,
      periodEnd: row ? row.period_end : null,
      discountPercent: row ? row.discount_percent : null,
    });
  } catch (err) {
    const msg = String((err && err.message) || '');
    const matchedKey = Object.keys(ERROR_LABEL).find((key) => msg.includes(key));
    if (matchedKey === 'KEY_NOT_FOUND') {
      await bumpRateLimit(env, `resellerkeylimit:${user.id}`, 15 * 60);
    }
    console.error('handleRedeemResellerKey failed:', err);
    return json({ error: matchedKey ? ERROR_LABEL[matchedKey] : 'ໃຊ້ຄີຍ໌ບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ' }, matchedKey ? 400 : 502);
  }
}

/* ---------- 15) GET /api/account/reseller-dashboard ----------
   ໜ້າ reseller.html ຮຽກຈຸດນີ້ ຫຼັງຈາກຮູ້ແລ້ວວ່າຄົນທີ່ login ຢູ່ເປັນຕົວແທນ (is_reseller = true)
   ເພື່ອເອົາຂໍ້ມູນສະຫຼຸບຈິງມາໂຊວ໌ (ໂຄວຕ້າ/ຍອດມື້ນີ້/ຍອດສະສົມ) — ຄິດໄລ່ຈາກ orders + topup_requests
   + wallets ຈິງຂອງ user ຄົນນັ້ນ (ອ່ານດ້ວຍ service_role key ຄືກັນກັບຈຸດອື່ນ, ບໍ່ໄດ້ໃຫ້ browser
   ຮ້ອງ Supabase ຕົງໆ) ອີງເຂດເວລາ UTC+7 (ລາວ/ໄທ) ໃນການຕັດ "ມື້ນີ້"

   ---- ໂຄວຕ້າ "ຮອບ" (cycle) ----
   ຍອດຊື້ທຽບກັບເປົ້າ ບໍ່ໄດ້ອີງໃສ່ "ເດືອນປະຕິທິນ" ອີກຕໍ່ໄປ ແຕ່ອີງໃສ່ reseller_status.cycle_start
   (ຈຸດເລີ່ມຮອບປັດຈຸບັນ) ຫາດຽວນີ້ — ເມື່ອຍອດຊື້ໃນຮອບຄົບເປົ້າ 100% ຄັ້ງທຳອິດ ຈະບັນທຶກເວລາໄວ້ໃນ
   quota_reached_at ແລ້ວຄ້າງໄວ້ທີ່ 100% ຕໍ່ໄປອີກ RESET_HOLD_MS (7 ມື້) — ພໍຄົບ 7 ມື້ ຈຶ່ງຈະຣີເຊັດຮອບ
   ໃໝ່ອັດຕະໂນມັດ (cycle_start = ດຽວນີ້, quota_reached_at = null -> ຍອດ/ອໍເດີໃນຮອບເລີ່ມນັບຄືນຈາກ 0)
   ການຣີເຊັດນີ້ເປັນແບບ "lazy" ຄື ກວດ+ຣີເຊັດທຸກຄັ້ງທີ່ມີການດຶງແດຊບອດ (GET ນີ້) ຫຼືທຸກຄັ້ງທີ່ໜ້າ
   admin ໂຫຼດລາຍຊື່ຕົວແທນ (ເບິ່ງ admin.js: loadAgentAccounts) */
const RESET_HOLD_MS = 7 * 24 * 60 * 60 * 1000; // ໄລຍະຄ້າງ 100% ກ່ອນຣີເຊັດຮອບໃໝ່ (7 ມື້)

async function handleResellerDashboard(request, env) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ error: 'ກະລຸນາລ໋ອກອິນກ່ອນ', requireLogin: true }, 401);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: true, isReseller: false });
  }

  try {
    const statusRows = await supabaseSelect(env, 'reseller_status', {
      select: 'is_reseller,duration_type,period_start,period_end,quota_target,discount_percent,cycle_start,quota_reached_at',
      user_id: `eq.${user.id}`,
      limit: '1',
    });
    const status = Array.isArray(statusRows) && statusRows[0] ? statusRows[0] : null;

    if (!status || !status.is_reseller) {
      return json({ ok: true, isReseller: false });
    }

    const nowMs = Date.now();
    let cycleStart = status.cycle_start || status.period_start || new Date(nowMs).toISOString();
    let quotaReachedAt = status.quota_reached_at || null;
    let needsPersist = !status.cycle_start;

    // ---- ຄ້າງ 100% ມາຄົບ 7 ມື້ແລ້ວ -> ຣີເຊັດຮອບໃໝ່ (ຍອດ/ອໍເດີໃນຮອບເລີ່ມນັບຄືນຈາກ 0) ----
    if (quotaReachedAt && (nowMs - new Date(quotaReachedAt).getTime()) >= RESET_HOLD_MS) {
      cycleStart = new Date(nowMs).toISOString();
      quotaReachedAt = null;
      needsPersist = true;
    }

    // ---- ຄິດຂອບເຂດ "ມື້ນີ້" ອີງເຂດເວລາ UTC+7 ----
    const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
    const localNow = new Date(nowMs + TZ_OFFSET_MS);
    const startOfDayUtc = new Date(
      Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()) - TZ_OFFSET_MS
    ).toISOString();

    const [ordersRows, topupRows, walletRows] = await Promise.all([
      supabaseSelect(env, 'orders', {
        select: 'price,status,created_at',
        user_id: `eq.${user.id}`,
        status: 'eq.completed',
        limit: '10000',
      }),
      supabaseSelect(env, 'topup_requests', {
        select: 'amount,status,created_at',
        user_id: `eq.${user.id}`,
        status: 'eq.approved',
        limit: '10000',
      }),
      supabaseSelect(env, 'wallets', {
        select: 'balance',
        user_id: `eq.${user.id}`,
        limit: '1',
      }),
    ]);

    const orders = ordersRows || [];
    const topups = topupRows || [];
    const balance = (walletRows && walletRows[0] && Number(walletRows[0].balance)) || 0;

    const isOnOrAfter = (iso, boundaryIso) => typeof iso === 'string' && iso >= boundaryIso;

    const todayOrders = orders.filter((o) => isOnOrAfter(o.created_at, startOfDayUtc));
    const cycleOrders = orders.filter((o) => isOnOrAfter(o.created_at, cycleStart));
    const todayTopups = topups.filter((t) => isOnOrAfter(t.created_at, startOfDayUtc));

    const sumPrice = (rows) => rows.reduce((s, r) => s + (Number(r.price) || 0), 0);
    const sumAmount = (rows) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const target = Number(status.quota_target) || 0;
    const cyclePurchase = sumPrice(cycleOrders);

    // ---- ຮອບນີ້ຄົບເປົ້າ 100% ພໍ່ດີ (ຄັ້ງທຳອິດ) -> ບັນທຶກເວລາຄົບເປົ້າ ເລີ່ມນັບຄ້າງ 7 ມື້ ----
    if (target > 0 && cyclePurchase >= target && !quotaReachedAt) {
      quotaReachedAt = new Date(nowMs).toISOString();
      needsPersist = true;
    }

    if (needsPersist) {
      try {
        await supabaseUpdate(env, 'reseller_status', { user_id: `eq.${user.id}` }, {
          cycle_start: cycleStart,
          quota_reached_at: quotaReachedAt,
        });
      } catch (err) {
        // ບັນທຶກຮອບບໍ່ສຳເລັດກໍ່ຍັງສະແດງຂໍ້ມູນຮອບປັດຈຸບັນໃຫ້ລູກຄ້າໄດ້ຕາມປົກກະຕິ (ບໍ່ບັງຄັບ throw)
        console.error('handleResellerDashboard: ບັນທຶກຮອບ/ເວລາຄົບເປົ້າບໍ່ສຳເລັດ', err);
      }
    }

    const quotaResetAt = quotaReachedAt ? new Date(new Date(quotaReachedAt).getTime() + RESET_HOLD_MS).toISOString() : null;

    return json({
      ok: true,
      isReseller: true,
      durationType: status.duration_type,
      periodEnd: status.period_end,
      quotaTarget: target,
      discountPercent: status.discount_percent,
      cyclePurchase,
      cycleStart,
      quotaReachedAt,
      quotaResetAt,
      today: {
        topup: sumAmount(todayTopups),
        purchase: sumPrice(todayOrders),
        ordersCount: todayOrders.length,
        balance,
      },
      cumulative: {
        totalTopup: sumAmount(topups),
        totalPurchase: sumPrice(orders),
        ordersCount: orders.length,
      },
    });
  } catch (err) {
    console.error('handleResellerDashboard failed:', err);
    return json({ error: 'ດຶງຂໍ້ມູນຕົວແທນບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ' }, 502);
  }
}

/* ---------- helper: ຍິງ SELECT ໄປ Supabase REST ດ້ວຍ service_role key (ຝັ່ງ Worker ເທົ່ານັ້ນ) ---------- */
async function supabaseSelect(env, table, params, opts) {
  const url = new URL(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString(), {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    // ใส่ timeout เฉพาะที่ขอ (เช่น หน้าอันดับ) — กัน request ค้างจนหน้าเว็บโหลดไม่ขึ้น
    signal: opts && opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase select "${table}" failed (${res.status}): ${text}`);
  }
  return res.json();
}

/* ---------- helper: ຮຽກ Supabase RPC ດ້ວຍ service_role key (ຝັ່ງ Worker ເທົ່ານັ້ນ) ---------- */
async function supabaseRpc(env, fnName, args) {
  const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/${fnName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(args || {}),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Supabase rpc "${fnName}" failed (${res.status}):`, text);
    return null;
  }
  return res.json();
}

/* ---------- helper: ຮຽກ Supabase RPC ແບບ "throw ຂໍ້ຄວາມ error ຈິງອອກມາ" (ໃຊ້ກັບ purchase_product
   ເພື່ອໃຫ້ handleOrderCreate ຈັບຂໍ້ຄວາມ RAISE EXCEPTION ຈາກ Postgres ໄປແປເປັນພາສາລາວໄດ້ —
   ຕ່າງຈາກ supabaseRpc() ທຳມະດາທີ່ log ແລ້ວຄືນ null ເສີຍໆ (ໃຊ້ກັບ product_stock ທີ່ຢາກໃຫ້
   graceful degrade ເປັນ 0 ແທນ ບໍ່ໃຊ້ throw) ---------- */
async function supabaseRpcStrict(env, fnName, args) {
  const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/${fnName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(args || {}),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try { message = JSON.parse(text).message || text; } catch { /* ไม่ใช่ JSON ก็ใช้ text ดิบไป */ }
    throw new Error(message);
  }
  return res.json();
}

/* ---------- helper: ยิง PATCH (update) ไป Supabase REST ด้วย service_role key (ฝั่ง Worker เท่านั้น)
   ใช้กับ handleResellerDashboard เพื่อบันทึก cycle_start/quota_reached_at (รอบโควตา + เวลาคบเป้า
   สำหรับค้าง 100% ก่อนรีเซ็ต) — filters ใช้รูปแบบเดียวกับ supabaseSelect เช่น { user_id: `eq.${id}` } ---------- */
async function supabaseUpdate(env, table, filters, patch) {
  const url = new URL(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase update "${table}" failed (${res.status}): ${text}`);
  }
}

/* ---------- helper: ยิง INSERT ไป Supabase REST ด้วย service_role key (ฝั่ง Worker เท่านั้น) ---------- */
async function supabaseInsert(env, table, row) {
  const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase insert "${table}" failed (${res.status}): ${text}`);
  }
  return res.json();
}

/* ---------- helper: UPSERT (insert หรืออัปเดตถ้า key ซ้ำ) ไป Supabase REST ด้วย service_role key ---------- */
async function supabaseUpsert(env, table, conflictCol, row) {
  const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflictCol)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert "${table}" failed (${res.status}): ${text}`);
  }
}

/* ---------- helper: อัพโหลดไฟล์ขึ้น Supabase storage bucket ด้วย service_role key
   (เหมือนที่ upload รูปสินค้า/QR ทำผ่าน supabase-js ฝั่งแอดมิน แต่จุดนี้ฝั่งลูกค้าไม่มี
   session แอดมิน จึงอัพโหลดผ่าน Worker ตรงนี้แทน ด้วย key ที่อยู่ฝั่ง Worker เท่านั้น) ---------- */
async function uploadToSupabaseStorage(env, bucket, path, file) {
  const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${bucket}/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase storage upload to "${bucket}" failed (${res.status}): ${text}`);
  }
  return `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${path}`;
}


/* เทียบ secret แบบกัน timing attack */
function safeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(String(a));
  const y = enc.encode(String(b));
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* ส่งสลิปใหม่ไปที่ Edge Function เดิม -> โพสต์เข้าห้องแอดมินพร้อมปุ่ม ✅ ❌
   ต้องตั้ง DISCORD_EDGE_URL และ BOT_API_SECRET  ถ้าไม่ได้ตั้งหรือส่งไม่สำเร็จ
   จะ fallback ไปแจ้งผ่าน webhook เดิม (ไม่มีปุ่ม) */
async function sendTopupToDiscord(env, { id, amount, user, slipUrl }) {
  if (!env.DISCORD_EDGE_URL || !env.BOT_API_SECRET) {
    console.warn('sendTopupToDiscord: ยังไม่ได้ตั้ง DISCORD_EDGE_URL / BOT_API_SECRET -> ใช้ webhook (ไม่มีปุ่มกด)');
  } else if (id == null) {
    console.warn('sendTopupToDiscord: insert topup_requests ไม่คืน id -> ใช้ webhook (ไม่มีปุ่มกด)');
  }
  if (env.DISCORD_EDGE_URL && env.BOT_API_SECRET && id != null) {
    try {
      const res = await fetch(env.DISCORD_EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-site-secret': env.BOT_API_SECRET },
        body: JSON.stringify({
          id: String(id),
          amount,
          username: (user && user.username) || '-',
          email: (user && user.email) || '-',
          slip_url: slipUrl,
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return;
      console.error('sendTopupToDiscord failed:', res.status, await res.text());
    } catch (err) {
      console.error('sendTopupToDiscord error:', err);
    }
  }
  // fallback: webhook เดิม (ไม่มีปุ่ม)
  await sendDiscordAlert(env, {
    title: '💰 มีการเติมเงินเข้ามาใหม่ (รอตรวจสอบ)',
    color: 0xff0001,
    description: 'เข้าหน้าแอดมิน (admin.html) เพื่อตรวจสลิปและอนุมัติ/ปฏิเสธ',
    fields: [
      { name: 'ผู้ใช้', value: (user && user.username) || '-', inline: true },
      { name: 'อีเมล', value: (user && user.email) || '-', inline: true },
      { name: 'จำนวนเงิน', value: `${Number(amount).toLocaleString()} กีบ`, inline: true },
      { name: 'สลิป', value: `[ดูรูป](${slipUrl})`, inline: false },
    ],
  });
}

/* ---------- POST /api/bot/topup-decision ----------
   Edge Function เรียกตอนแอดมินกดปุ่ม
   header:  Authorization: Bearer <BOT_API_SECRET>
   body:    { "topup_id": "...", "decision": "approved" | "rejected" }
   - กันกดซ้ำ: อัปเดตเฉพาะแถวที่ยัง pending (ถ้าไม่ใช่ ตอบ 409 ไม่เติมเงินซ้ำ)
   - ถ้าเติมกระเป๋าไม่สำเร็จ จะคืนสถานะเป็น pending เพื่อให้กดใหม่ได้ */
async function handleBotTopupDecision(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.BOT_API_SECRET || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Worker ยังตั้งค่าไม่ครบ (BOT_API_SECRET / SUPABASE)' }, 500);
  }

  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!safeEqual(token, env.BOT_API_SECRET)) return json({ error: 'Unauthorized' }, 401);

  let body = {};
  try { body = await request.json(); } catch { /* ตกไปโดน validate ด้านล่าง */ }
  return applyTopupDecision(env, body.topup_id, body.decision);
}

/* ---------- POST /api/admin/topup-decision ----------
   ปุ่ม "ຢືນຢັນ / ປະຕິເສດ" ในหน้าแอดมิน (admin.js) เรียกจุดนี้ — ใช้ logic atomic เดียวกับบอท Discord
   ต้อง login เป็นแอดมิน (session cookie isAdmin) body: { topup_id, decision } */
async function handleAdminTopupDecision(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const admin = await getSessionUser(request, env);
  if (!admin || !admin.isAdmin) {
    return json({ error: 'ບໍ່ມີສິດເຂົ້າເຖິງ — ຕ້ອງລ໋ອກອິນເປັນແອດມິນກ່ອນ' }, 403);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Worker ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }
  let body = {};
  try { body = await request.json(); } catch { /* validate ด้านล่าง */ }
  const res = await applyTopupDecision(env, body.topup_id, body.decision);

  // แจ้ง Discord (ถ้าตั้ง webhook ไว้) ว่าแอดมินคนไหนอนุมัติ/ปฏิเสธ — เป็นของเสริม ไม่กระทบผลลัพธ์
  if (res.status === 200) {
    try {
      const d = await res.clone().json();
      await sendDiscordAlert(env, {
        title: d.status === 'approved' ? '✅ แอดมินอนุมัติเติมเงิน (หน้าเว็บ)' : '❌ แอดมินปฏิเสธเติมเงิน (หน้าเว็บ)',
        color: d.status === 'approved' ? 0x2ecc71 : 0xe74c3c,
        fields: [
          { name: 'ลูกค้า', value: d.user_email || '-', inline: true },
          { name: 'จำนวนเงิน', value: `${Number(d.amount).toLocaleString()} กีบ`, inline: true },
          { name: 'โดยแอดมิน', value: String(admin.email || admin.username || admin.id || 'admin'), inline: true },
        ],
      });
    } catch { /* ข้าม */ }
  }
  return res;
}

/* logic กลางของการอนุมัติ/ปฏิเสธเติมเงิน (ใช้ร่วมกันทั้งบอท Discord และหน้าแอดมิน)
   - กันกดซ้ำ/สองคนกดพร้อมกัน: อัปเดตเฉพาะแถวที่ยัง pending (ถ้าไม่ใช่ ตอบ 409 ไม่เติมเงินซ้ำ)
   - ถ้าเติมกระเป๋าไม่สำเร็จ จะคืนสถานะเป็น pending เพื่อให้กดใหม่ได้ */
async function applyTopupDecision(env, rawTopupId, decision) {
  const topupId = String(rawTopupId || '');
  if (!/^[A-Za-z0-9-]{1,64}$/.test(topupId)) return json({ error: 'topup_id ไม่ถูกต้อง' }, 400);
  if (decision !== 'approved' && decision !== 'rejected') {
    return json({ error: 'decision ต้องเป็น approved หรือ rejected' }, 400);
  }

  const idQ = encodeURIComponent(topupId);

  try {
    // 1) "จอง" รายการ: เปลี่ยนสถานะได้เฉพาะแถวที่ยัง pending เท่านั้น
    const claim = await sbRaw(
      env, 'PATCH', `topup_requests?id=eq.${idQ}&status=eq.pending`,
      { status: decision }, { prefer: 'return=representation' }
    );
    if (!claim.ok) {
      console.error('topup claim failed', claim.status, claim.text);
      return json({ error: 'อัปเดตฐานข้อมูลไม่สำเร็จ' }, 502);
    }
    const row = Array.isArray(claim.data) ? claim.data[0] : null;
    if (!row) {
      const cur = await sbRaw(env, 'GET', `topup_requests?id=eq.${idQ}&select=status`);
      const curStatus = cur.ok && Array.isArray(cur.data) && cur.data[0] ? cur.data[0].status : null;
      return json({ ok: false, already_decided: true, status: curStatus, error: 'ไม่พบรายการ หรือถูกดำเนินการไปแล้ว' }, 409);
    }

    // 2) ถ้าอนุมัติ -> เติมเงินเข้ากระเป๋า
    if (decision === 'approved') {
      try {
        await supabaseRpcStrict(env, 'increment_wallet_balance', {
          p_user_id: row.user_id,
          p_amount: Math.round(Number(row.amount)),
        });
      } catch (err) {
        console.error('increment_wallet_balance failed', err);
        try { await sbRaw(env, 'PATCH', `topup_requests?id=eq.${idQ}`, { status: 'pending' }); } catch { /* ข้าม */ }
        return json({ error: 'เติมเงินเข้ากระเป๋าไม่สำเร็จ: ' + err.message }, 502);
      }
    }

    return json({
      ok: true,
      status: decision,
      amount: row.amount,
      user_email: row.user_email || null,
    });
  } catch (err) {
    console.error('applyTopupDecision failed:', err);
    return json({ error: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง' }, 502);
  }
}
