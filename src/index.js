/* =========================================================
   worker/src/index.js
   Cloudflare Worker — ระบบล็อกอินผ่าน Discord (OAuth2) + Supabase proxy ห้องแอดมิน
   Route ที่มี:
     GET  /auth/discord/login     -> เด้งไปหน้า Discord authorize (รับ ?next= ปลายทางหลังล็อกอินสำเร็จ)
     GET  /auth/discord/callback  -> Discord เด้งกลับมาที่นี่พร้อม ?code=
     GET  /auth/logout            -> ล้าง session cookie
     GET  /api/me                 -> เช็คว่า login อยู่ไหม คืนข้อมูล user (รวมสถานะ isAdmin)
     ALL  /api/admin/supabase/*   -> proxy ไป Supabase จริง ด้วย service_role key (ดูรายละเอียดด้านล่าง)
     GET  /api/public/storefront  -> ข้อมูลหน้าร้านสาธารณะ (หมวดหมู่/สินค้า/สต็อกจริง) ดูรายละเอียดด้านล่าง
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
    if (url.pathname.startsWith(SUPABASE_PROXY_PREFIX + '/')) {
      return handleSupabaseProxy(request, env, url);
    }
    if (url.pathname === '/api/public/storefront') {
      return handlePublicStorefront(request, env);
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
