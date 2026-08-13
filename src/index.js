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
     GET  /api/orders/history     -> ลูกค้า (ต้อง login) ดึงประวัติการสั่งซื้อของตัวเองเท่านั้น
                                      (orders.html)
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
      "style-src 'self'; img-src 'self' data: https:; " +
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

async function route(request, env) {
  {
    const url = new URL(request.url);

    if (url.pathname === '/auth/discord/login') {
      return handleLogin(request, env);
    }
    if (url.pathname === '/auth/discord/callback') {
      return handleCallback(request, env);
    }
    if (url.pathname === '/auth/google/login') {
      return handleGoogleLogin(request, env);
    }
    if (url.pathname === '/auth/google/callback') {
      return handleGoogleCallback(request, env);
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
    if (url.pathname.startsWith(SUPABASE_PROXY_PREFIX + '/')) {
      return handleSupabaseProxy(request, env, url);
    }
    if (url.pathname === '/api/public/storefront') {
      return handlePublicStorefront(request, env);
    }
    if (url.pathname === '/api/public/recent-purchases') {
      return handleRecentPurchases(request, env);
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

export default {
  async fetch(request, env) {
    const response = await route(request, env);
    return withSecurityHeaders(response);
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

  // ---- เช็คสิทธิ์แอดมิน: อีเมล Discord ต้องอยู่ใน ADMIN_EMAILS และต้องยืนยันแล้ว ----
  const isAdmin =
    !!discordUser.email &&
    discordUser.verified === true &&
    ADMIN_EMAILS.some(e => e.toLowerCase() === discordUser.email.toLowerCase());

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
  const headers = new Headers({ Location: nextPath });
  headers.append(
    'Set-Cookie',
    `session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
  );
  headers.append('Set-Cookie', 'oauth_state=; Path=/; Max-Age=0'); // ล้าง state cookie ทิ้ง
  headers.append('Set-Cookie', 'oauth_next=; Path=/; Max-Age=0'); // ล้าง next cookie ทิ้ง

  return new Response(null, { status: 302, headers });
}

/* ---------- 2.5) /auth/google/login ----------
   ทำงานแบบเดียวกับ /auth/discord/login เป๊ะๆ: สร้าง "state" กัน CSRF,
   เก็บไว้ใน cookie ชั่วคราว แล้วเด้งผู้ใช้ไปหน้า consent ของ Google */
async function handleGoogleLogin(request, env) {
  const state = crypto.randomUUID();
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/auth/google/callback`;

  let next = url.searchParams.get('next') || '/';
  if (!next.startsWith('/')) next = '/';

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

  if (!code || !state || state !== savedState) {
    return new Response(
      'ການລ໋ອກອິນລົ້ມເຫຼວ: state ບໍ່ກົງກັນ (ອາດຖືກ CSRF ຫຼືເປີດລິ້ງເກົ່າ)',
      { status: 400 }
    );
  }

  const redirectUri = `${url.origin}/auth/google/callback`;
  const nextPath = getCookie(request, 'oauth_next') || '/';

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
    return new Response('ແລກ token ກັບ Google ບໍ່ສຳເລັດ', { status: 502 });
  }
  const tokenData = await tokenRes.json();

  // ---- ใช้ access_token ดึงข้อมูลผู้ใช้ ----
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const googleUser = await userRes.json();

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

  const headers = new Headers({ Location: nextPath });
  headers.append(
    'Set-Cookie',
    `session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
  );
  headers.append('Set-Cookie', 'oauth_state=; Path=/; Max-Age=0');
  headers.append('Set-Cookie', 'oauth_next=; Path=/; Max-Age=0');

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

  // hasPassword: ໜ້າໂປຣໄຟລ໌ໃຊ້ຄ່ານີ້ຕັດສິນວ່າຈະໂຊວ໌ຟອມ "ຕັ້ງລະຫັດຜ່ານ" (ບັນຊີ Discord/Google
  // ລ້ວນໆ) ຫຼື "ປ່ຽນລະຫັດຜ່ານ" (ຕ້ອງໃສ່ລະຫັດເກົ່າກ່ອນ, ບັນຊີອີເມວ/ລະຫັດຜ່ານ) — ເບິ່ງ
  // handleChangePassword ດ້ານລຸ່ມ
  const hasPassword = !!sessionUser.passwordAuth;
  return json({ loggedIn: true, user: { ...sessionUser, balance, hasPassword } });
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
  const limited = await isRateLimited(env, `loginlimit:${email}`, 8, 15 * 60);
  if (limited) {
    return json({ error: 'ພະຍາຍາມລ໋ອກອິນຜິດຫຼາຍເທື່ອເກີນໄປ ກະລຸນາລໍຖ້າ 15 ນາທີແລ້ວລອງໃໝ່' }, 429);
  }

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
    await bumpRateLimit(env, `loginlimit:${email}`, 15 * 60);
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
  const raw = await env.SESSIONS.get(key);
  const count = raw ? Number(raw) || 0 : 0;
  return count >= maxAttempts;
}
async function bumpRateLimit(env, key, windowSeconds) {
  const raw = await env.SESSIONS.get(key);
  const count = raw ? Number(raw) || 0 : 0;
  await env.SESSIONS.put(key, String(count + 1), { expirationTtl: windowSeconds });
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
  if (!env.DISCORD_WEBHOOK_URL) return; // ยังไม่ได้ตั้งค่า -> ข้ามไปเฉยๆ

  const embed = {
    title,
    description: description || undefined,
    color: color || 0xff0001, // แดงโทนร้าน (Dekmash) เป็นค่าเริ่มต้น
    fields: fields || [],
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
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
    const rows = await supabaseSelect(env, 'orders', {
      select: 'product_name',
      status: 'eq.completed',
    });
    const counts = new Map();
    (rows || []).forEach((row) => {
      const name = row.product_name;
      if (!name) return;
      counts.set(name, (counts.get(name) || 0) + 1);
    });
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
      'store_name', 'tagline', 'announcement_text', 'hero_image',
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
        select: 'id,name,category,price,reseller_price,image_url,duration_enabled,paused,paused_note,description,created_at',
        or: '(archived.is.null,archived.eq.false)',
        order: 'created_at.desc',
      }),
      supabaseSelect(env, 'product_durations', {
        select: 'id,product_id,label,price,reseller_price,sort_order',
        order: 'sort_order.asc',
      }),
      getRegisteredUserCount(env),
      getSoldCount(env),
      getSoldCountsByProductName(env),
    ]);

    const settings = settingsRows[0] || {};

    // ດຶງສະຕັອກຈິງ (ຕົວເລກເທົ່ານັ້ນ) ຂອງແຕ່ລະສິນຄ້າ/ໄລຍະເວລາ ແບບຂະໜານກັນ
    const productsWithStock = await Promise.all((products || []).map(async (p) => {
      const stock = await supabaseRpc(env, 'product_stock', { p_product_id: p.id });
      const ownDurations = (durations || []).filter((d) => d.product_id === p.id);
      const durationsWithStock = await Promise.all(ownDurations.map(async (d) => {
        const dStock = await supabaseRpc(env, 'product_duration_stock', { p_duration_id: d.id });
        return { id: d.id, label: d.label, price: d.price, resellerPrice: d.reseller_price, stock: dStock ?? 0 };
      }));

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        resellerPrice: p.reseller_price,
        image_url: p.image_url,
        duration_enabled: !!p.duration_enabled,
        paused: !!p.paused,
        paused_note: p.paused_note || null,
        description: p.description || null,
        stock: stock ?? 0,
        durations: durationsWithStock,
        soldCount: soldCountsByName.get(p.name) || 0,
      };
    }));

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
    await sendDiscordAlert(env, {
      title: '💰 ມີການເຕີມເງິນເຂົ້າມາໃໝ່ (ລໍຖ້າກວດສອບ)',
      color: 0xff0001, // แดง — เด่นชัด ต้องรีบเข้าไปดู
      description: 'ກົດເຂົ້າໜ້າແອດມິນ (admin.html) ເພື່ອກວດສະລິບ ແລະ ອະນຸມັດ/ປະຕິເສດ',
      fields: [
        { name: 'ຜູ້ໃຊ້', value: user.username || '-', inline: true },
        { name: 'ອີເມວ', value: user.email || '-', inline: true },
        { name: 'ຈຳນວນເງິນ', value: `${amount.toLocaleString()} ກີບ`, inline: true },
        { name: 'ສະລິບ', value: `[ເບິ່ງຮູບ](${slipUrl})`, inline: false },
      ],
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
      select: 'is_reseller,duration_type,period_start,period_end,quota_target,discount_percent',
      user_id: `eq.${user.id}`,
      limit: '1',
    });
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    return json({ ok: true, status: row });
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
