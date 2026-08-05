/* =========================================================
   worker/src/index.js
   Cloudflare Worker — ระบบล็อกอินผ่าน Discord (OAuth2) + Supabase proxy ห้องแอดมิน
   Route ที่มี:
     GET  /auth/discord/login     -> เด้งไปหน้า Discord authorize (รับ ?next= ปลายทางหลังล็อกอินสำเร็จ)
     GET  /auth/discord/callback  -> Discord เด้งกลับมาที่นี่พร้อม ?code=
     GET  /auth/logout            -> ล้าง session cookie
     GET  /api/me                 -> เช็คว่า login อยู่ไหม คืนข้อมูล user (รวมสถานะ isAdmin)
     ALL  /api/admin/supabase/*   -> proxy ไป Supabase จริง ด้วย service_role key (ดูรายละเอียดด้านล่าง)
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
    if (url.pathname.startsWith(SUPABASE_PROXY_PREFIX + '/')) {
      return handleSupabaseProxy(request, env, url);
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
    avatar: discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null,
    isAdmin,
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
   หน้าเว็บเรียก endpoint นี้ตอนโหลด เพื่อเช็คว่า login ค้างอยู่ไหม */
async function handleMe(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ loggedIn: false });
  }
  return json({ loggedIn: true, user });
}

/* ---------- helper: อ่าน session cookie -> ผู้ใช้ปัจจุบัน (หรือ null) ---------- */
async function getSessionUser(request, env) {
  const sessionId = getCookie(request, 'session');
  if (!sessionId) return null;

  const raw = await env.SESSIONS.get(sessionId);
  if (!raw) return null;

  return JSON.parse(raw);
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
    headers: { 'Content-Type': 'application/json' },
  });
}
