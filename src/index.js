/* =========================================================
   worker/src/index.js
   Cloudflare Worker — ระบบล็อกอินผ่าน Discord (OAuth2)
   Route ที่มี:
     GET  /auth/discord/login     -> เด้งไปหน้า Discord authorize
     GET  /auth/discord/callback  -> Discord เด้งกลับมาที่นี่พร้อม ?code=
     GET  /auth/logout            -> ล้าง session cookie
     GET  /api/me                 -> เช็คว่า login อยู่ไหม คืนข้อมูล user
     อื่นๆ ทั้งหมด                 -> ส่งต่อให้ env.ASSETS (ไฟล์ static เดิม)
   ========================================================= */

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
  const redirectUri = `${new URL(request.url).origin}/auth/discord/callback`;

  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    state,
  });

  const headers = new Headers({
    Location: `https://discord.com/api/oauth2/authorize?${params.toString()}`,
  });
  headers.append(
    'Set-Cookie',
    `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
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

  // ---- สร้าง session แล้วเก็บลง KV (อายุ 7 วัน) ----
  const sessionId = crypto.randomUUID();
  const sessionData = {
    id: discordUser.id,
    username: discordUser.global_name || discordUser.username,
    avatar: discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null,
    createdAt: Date.now(),
  };

  await env.SESSIONS.put(sessionId, JSON.stringify(sessionData), {
    expirationTtl: 60 * 60 * 24 * 7, // 7 วัน
  });

  // ---- ปิด session ด้วย cookie แล้วเด้งกลับหน้าแรก ----
  const headers = new Headers({ Location: '/' });
  headers.append(
    'Set-Cookie',
    `session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
  );
  headers.append('Set-Cookie', 'oauth_state=; Path=/; Max-Age=0'); // ล้าง state cookie ทิ้ง

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
  const sessionId = getCookie(request, 'session');

  if (!sessionId) {
    return json({ loggedIn: false });
  }

  const raw = await env.SESSIONS.get(sessionId);
  if (!raw) {
    return json({ loggedIn: false });
  }

  const user = JSON.parse(raw);
  return json({ loggedIn: true, user });
}

function json(data) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}
