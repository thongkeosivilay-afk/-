/* =========================================================
   worker/src/index.js
   Cloudflare Worker — ระบบล็อกอินผ่าน Discord (OAuth2) + Supabase proxy ห้องแอดมิน
   Route ที่มี:
     GET  /auth/discord/login     -> เด้งไปหน้า Discord authorize (รับ ?next= ปลายทางหลังล็อกอินสำเร็จ)
     GET  /auth/discord/callback  -> Discord เด้งกลับมาที่นี่พร้อม ?code=
     GET  /auth/logout            -> ล้าง session cookie
     GET  /api/me                 -> เช็คว่า login อยู่ไหม คืนข้อมูล user (รวมสถานะ isAdmin)
     POST /api/auth/signup        -> สมัครสมาชิกด้วยอีเมล/รหัสผ่าน (ผ่าน Supabase Auth Admin API)
     POST /api/auth/login         -> ล็อกอินด้วยอีเมล/รหัสผ่าน (ผ่าน Supabase Auth token endpoint)
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
     GET  /api/orders/history     -> ลูกค้า (ต้อง login) ดึงประวัติการสั่งซื้อของตัวเองเท่านั้น
                                      (orders.html)
     GET  /api/account/stats      -> ลูกค้า (ต้อง login) สรุปยอดสั่งซื้อสำเร็จ/ยอดใช้จ่ายรวม
                                      (profile.html)
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

// อีเมล Discord ที่อนุญาตให้เข้าห้องแอดมินได้
const ADMIN_EMAIL = 'bhchhhyggg@gmail.com';

const SUPABASE_PROXY_PREFIX = '/api/admin/supabase';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/auth/discord/login') {
      return handleLogin(request, env);
    }
    if (url.pathname === '/auth/discord/callback') {
      return handleCallback(request, env);
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
    if (url.pathname.startsWith(SUPABASE_PROXY_PREFIX + '/')) {
      return handleSupabaseProxy(request, env, url);
    }
    if (url.pathname === '/api/public/storefront') {
      return handlePublicStorefront(request, env);
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
    if (url.pathname === '/api/orders/create') {
      return handleOrderCreate(request, env);
    }
    if (url.pathname === '/api/orders/history') {
      return handleOrdersHistory(request, env);
    }
    if (url.pathname === '/api/account/stats') {
      return handleAccountStats(request, env);
    }

    // path อื่นๆ ทั้งหมด -> เสิร์ฟไฟล์ static เดิม (index.html, style.css, script.js, ...)
    return env.ASSETS.fetch(request);
  },
};

/* ---------- helper: อ่านค่า cookie จาก request ---------- */
function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/* ---------- 1) /auth/discord/login ----------
   สร้างค่า "state" แบบสุ่ม (กัน CSRF), เก็บไว้ใน cookie ชั่วคราว,
   แล้วเด้งผู้ใช้ไปหน้า authorize ของ Discord */
async function handleLogin(request, env) {
  const state = crypto.randomUUID();
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/auth/discord/callback`;

  // ปลายทางที่จะเด้งกลับไปหลังล็อกอินสำเร็จ (เช่น /admin.html) — กันเปิดลิงก์ไปเว็บอื่น
  let next = url.searchParams.get('next') || '/';
  if (!next.startsWith('/')) next = '/';

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

  if (!code || !state || state !== savedState) {
    return new Response(
      'ການລ໋ອກອິນລົ້ມເຫຼວ: state ບໍ່ກົງກັນ (ອາດຖືກ CSRF ຫຼືເປີດລິ້ງເກົ່າ)',
      { status: 400 }
    );
  }

  const redirectUri = `${url.origin}/auth/discord/callback`;
  const nextPath = getCookie(request, 'oauth_next') || '/';

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
    return new Response('ແລກ token ກັບ Discord ບໍ່ສຳເລັດ', { status: 502 });
  }
  const tokenData = await tokenRes.json();

  // ---- ใช้ access_token ดึงข้อมูลผู้ใช้ ----
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const discordUser = await userRes.json();

  // ---- DEBUG ชั่วคราว: ดูค่าจริงที่ Discord ส่งกลับมา (ลบทิ้งหลังแก้ปัญหาเสร็จ) ----
  console.log('[DEBUG discordUser]', JSON.stringify({
    id: discordUser.id,
    username: discordUser.username,
    email: discordUser.email,
    verified: discordUser.verified,
  }));

  // ---- เช็คสิทธิ์แอดมิน: อีเมล Discord ต้องตรงกับ ADMIN_EMAIL และต้องยืนยันแล้ว ----
  const isAdmin =
    !!discordUser.email &&
    discordUser.verified === true &&
    discordUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // ---- สร้าง session แล้วเก็บลง KV (อายุ 7 วัน) ----
  const sessionId = crypto.randomUUID();
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

  await env.SESSIONS.put(sessionId, JSON.stringify(sessionData), {
    expirationTtl: 60 * 60 * 24 * 7, // 7 วัน
  });

  // ---- ปิด session ด้วย cookie แล้วเด้งกลับไปยังปลายทางเดิม (เช่น /admin.html) ----
  const headers = new Headers({ Location: nextPath });
  headers.append(
    'Set-Cookie',
    `session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
  );
  headers.append('Set-Cookie', 'oauth_state=; Path=/; Max-Age=0'); // ล้าง state cookie ทิ้ง
  headers.append('Set-Cookie', 'oauth_next=; Path=/; Max-Age=0'); // ล้าง next cookie ทิ้ง

  return new Response(null, { status: 302, headers });
}

/* ---------- 3) /auth/logout ---------- */
async function handleLogout() {
  const headers = new Headers({ Location: '/' });
  headers.append('Set-Cookie', 'session=; Path=/; Max-Age=0');
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

  return json({ loggedIn: true, user: { ...sessionUser, balance } });
}

/* ---------- helper: อ่าน session cookie -> ผู้ใช้ปัจจุบัน (หรือ null) ---------- */
async function getSessionUser(request, env) {
  const sessionId = getCookie(request, 'session');
  if (!sessionId) return null;

  const raw = await env.SESSIONS.get(sessionId);
  if (!raw) return null;

  return JSON.parse(raw);
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
  const createRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
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
  });

  const createData = await createRes.json().catch(() => ({}));

  if (!createRes.ok) {
    const msg = (createData && createData.msg) || (createData && createData.message) || '';
    if (createRes.status === 422 || /already been registered|already exists/i.test(msg)) {
      return json({ error: 'ອີເມວນີ້ຖືກສະໝັກໄປແລ້ວ' }, 400);
    }
    console.error('handlePasswordSignup: Supabase admin create user failed', createRes.status, createData);
    return json({ error: 'ສະໝັກສະມາຊິກບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ' }, 502);
  }

  const authUser = createData;
  const sessionId = await createSession(env, {
    id: authUser.id,
    username,
    email,
    avatar: null,
    isAdmin: false,
    discordLinked: false,
    createdAt: Date.now(),
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

  // ---- ກວດອີເມວ/ລະຫັດຜ່ານຜ່ານ Supabase Auth token endpoint ----
  const tokenRes = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  const tokenData = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok) {
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
    createdAt: Date.now(),
  });

  return jsonWithSession({ ok: true }, sessionId);
}

/* ---------- helper: ສ້າງ session ໃໝ່ (KV + cookie) ໃຊ້ຮ່ວມກັນທັງ Discord ແລະ ອີເມວ/ລະຫັດຜ່ານ ---------- */
async function createSession(env, sessionData) {
  const sessionId = crypto.randomUUID();
  await env.SESSIONS.put(sessionId, JSON.stringify(sessionData), {
    expirationTtl: 60 * 60 * 24 * 7, // 7 ວັນ
  });
  return sessionId;
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
      'store_name', 'tagline', 'announcement_text', 'hero_image',
      'qr_label', 'qr_label_2', 'qr_url', 'qr_url_2',
      ...Array.from({ length: CATEGORY_SLOT_COUNT }, (_, i) => `category_${i + 1}_name`),
      ...Array.from({ length: CATEGORY_SLOT_COUNT }, (_, i) => `category_${i + 1}_image`),
      ...Array.from({ length: CATEGORY_SLOT_COUNT }, (_, i) => `category_${i + 1}_title`),
      ...Array.from({ length: CATEGORY_SLOT_COUNT }, (_, i) => `category_${i + 1}_desc`),
    ];

    const [settingsRows, products, durations] = await Promise.all([
      supabaseSelect(env, 'site_settings', {
        select: siteSettingsColumns.join(','),
        id: 'eq.1',
        limit: '1',
      }),
      // archived เป็น null ได้ (แถวเก่าก่อนมีคอลัมน์นี้) จึงต้องรวม is.null ด้วย ไม่ใช่แค่ eq.false
      supabaseSelect(env, 'products', {
        select: 'id,name,category,price,image_url,duration_enabled,paused,paused_note,created_at',
        or: '(archived.is.null,archived.eq.false)',
        order: 'created_at.desc',
      }),
      supabaseSelect(env, 'product_durations', {
        select: 'id,product_id,label,price,sort_order',
        order: 'sort_order.asc',
      }),
    ]);

    const settings = settingsRows[0] || {};

    // ດຶງສະຕັອກຈິງ (ຕົວເລກເທົ່ານັ້ນ) ຂອງແຕ່ລະສິນຄ້າ/ໄລຍະເວລາ ແບບຂະໜານກັນ
    const productsWithStock = await Promise.all((products || []).map(async (p) => {
      const stock = await supabaseRpc(env, 'product_stock', { p_product_id: p.id });
      const ownDurations = (durations || []).filter((d) => d.product_id === p.id);
      const durationsWithStock = await Promise.all(ownDurations.map(async (d) => {
        const dStock = await supabaseRpc(env, 'product_duration_stock', { p_duration_id: d.id });
        return { id: d.id, label: d.label, price: d.price, stock: dStock ?? 0 };
      }));

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        image_url: p.image_url,
        duration_enabled: !!p.duration_enabled,
        paused: !!p.paused,
        paused_note: p.paused_note || null,
        stock: stock ?? 0,
        durations: durationsWithStock,
      };
    }));

    const totalStock = productsWithStock.reduce((sum, p) => {
      const pStock = p.duration_enabled
        ? p.durations.reduce((s, d) => s + (d.stock || 0), 0)
        : (p.stock || 0);
      return sum + pStock;
    }, 0);

    const categories = Array.from({ length: CATEGORY_SLOT_COUNT }, (_, i) => {
      const idx = i + 1;
      return {
        index: idx,
        name: (settings[`category_${idx}_name`] || `ໝວດໝູ່ ${idx}`).trim(),
        image: settings[`category_${idx}_image`] || null,
        title: (settings[`category_${idx}_title`] || '').trim() || null,
        desc: (settings[`category_${idx}_desc`] || '').trim() || null,
      };
    });

    return json({
      store: {
        name: settings.store_name || null,
        tagline: settings.tagline || null,
        announcement: settings.announcement_text || null,
        heroImage: settings.hero_image || null,
        qrLabel1: settings.qr_label || null,
        qrLabel2: settings.qr_label_2 || null,
        qrUrl1: settings.qr_url || null,
        qrUrl2: settings.qr_url_2 || null,
      },
      categories,
      stats: {
        productCount: productsWithStock.length,
        totalStock,
      },
      products: productsWithStock,
    });
  } catch (err) {
    console.error('handlePublicStorefront failed:', err);
    return json({ error: 'ດຶງຂໍ້ມູນຮ້ານບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ' }, 502);
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

  try {
    const extMatch = /\.([a-zA-Z0-9]{1,8})$/.exec(slip.name || '');
    const ext = extMatch ? extMatch[1] : 'jpg';
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
      select: 'id,amount,status,slip_url,created_at',
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

  // ຂໍ້ຄວາມ error ຈາກ RAISE EXCEPTION ໃນ RPC (ເບິ່ງ SQL ທ້າຍໄຟລ໌) -> ຂໍ້ຄວາມພາສາລາວທີ່ໂຊວ໌ໃຫ້ລູກຄ້າ
  const ERROR_LABEL = {
    PRODUCT_NOT_FOUND: 'ບໍ່ພົບສິນຄ້ານີ້ (ອາດຖືກລຶບ/ເຊື່ອງໄປແລ້ວ)',
    PRODUCT_PAUSED: 'ສິນຄ້ານີ້ຢຸດຂາຍຊົ່ວຄາວ',
    DURATION_NOT_FOUND: 'ບໍ່ພົບໄລຍະເວລາທີ່ເລືອກ',
    INSUFFICIENT_BALANCE: 'ຍອດເງິນໃນກະເປົາບໍ່ພຽງພໍ ກະລຸນາເຕີມເງິນກ່ອນ',
    OUT_OF_STOCK: 'ສິນຄ້ານີ້ໝົດສະຕັອກແລ້ວ',
  };

  try {
    const rows = await supabaseRpcStrict(env, 'purchase_product', {
      p_user_id: user.id,
      p_user_email: user.email || null,
      p_product_id: productId,
      p_duration_id: durationId,
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
    return json({ error: matchedKey ? ERROR_LABEL[matchedKey] : 'ສັ່ງຊື້ບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ' }, matchedKey === 'INSUFFICIENT_BALANCE' || matchedKey === 'OUT_OF_STOCK' ? 400 : 502);
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
      select: 'id,product_name,duration_label,price,code,status,created_at',
      user_id: `eq.${user.id}`,
      order: 'created_at.desc',
      limit: '200',
    });
    return json({ ok: true, items: rows || [] });
  } catch (err) {
    console.error('handleOrdersHistory failed:', err);
    return json({ error: 'ດຶງປະຫວັດການສັ່ງຊື້ບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ' }, 502);
  }
}

/* ---------- 12) GET /api/account/stats ----------
   ໜ້າ profile.html (profile.js) ຮຽກຈຸດນີ້ ເພື່ອໂຊວ໌ "ຈຳນວນສັ່ງຊື້ສຳເລັດ" + "ຍອດຊື້ລວມ"
   ໃນໜ້າໂປຣໄຟລ໌ — ເດີມ endpoint ນີ້ບໍ່ມີຢູ່ຈິງ (profile.js fetch ແລ້ວໄດ້ 404 ຄືນຄ່າ 0
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

/* ---------- helper: ຍິງ SELECT ໄປ Supabase REST ດ້ວຍ service_role key (ຝັ່ງ Worker ເທົ່ານັ້ນ) ---------- */
async function supabaseSelect(env, table, params) {
  const url = new URL(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString(), {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
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
