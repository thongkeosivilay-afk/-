/* =========================================================
   storefront-data.js
   -------------------------------------------------------
   ຊັ້ນຂໍ້ມູນທີ່ໃຊ້ຮ່ວມກັນລະຫວ່າງ index.html (storefront.js) ແລະ
   category.html (category.js) — ດຶງຂໍ້ມູນຮ້ານ (ໝວດໝູ່/ສິນຄ້າ/ສະຕັອກ)
   ຈິງຈາກ Worker (GET /api/public/storefront) ແທນລະບົບ demo ເກົ່າທີ່
   ເກັບໄວ້ໃນ localStorage ຂອງ browser (store-data.js)

   Worker ເປັນຄົນໄປດຶງຈາກ Supabase ດ້ວຍ service_role key ເອງ (key ບໍ່ເຄີຍ
   ຫຼຸດມາຮອດ browser) ແລ້ວຄັດກອງສະເພາະຟິວທີ່ຈຳເປັນສຳລັບໜ້າຮ້ານກ່ອນສົ່ງກັບມາ
   — ບໍ່ມີ service key ແລະ ບໍ່ມີລະຫັດສິນຄ້າຈິງ (product_codes) ຫຼຸດອອກມາ
   ========================================================= */

(function (global) {
  const ENDPOINT = '/api/public/storefront';

  let cachedPromise = null;

  // ດຶງຂໍ້ມູນຮ້ານ (cache ໄວ້ໃນ session ນີ້ — ຮຽກຫຼາຍບ່ອນໃນໜ້າດຽວກັນຈະບໍ່ຍິງຊ້ຳ)
  // ໃສ່ force = true ເພື່ອບັງຄັບດຶງໃໝ່ (ເຊັ່ນ ຫຼັງ retry)
  function fetchData(force) {
    if (!cachedPromise || force) {
      // cache: 'no-store' — บังคับให้ browser ไปดึงข้อมูลจาก network จริงทุกครั้ง
      // ห้ามใช้ response เก่าที่ browser เคย cache ไว้ (สาเหตุที่ข้อมูลเก่าเคยโผล่มา
      // แวบหนึ่งตอนรีเฟรชหน้าเว็บ ก่อนจะถูกแทนที่ด้วยข้อมูลจริง)
      cachedPromise = fetch(ENDPOINT, { headers: { Accept: 'application/json' }, cache: 'no-store' })
        .then((res) => {
          if (!res.ok) throw new Error(`storefront endpoint responded ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data && data.error) throw new Error(data.error);
          return data;
        })
        .catch((err) => {
          cachedPromise = null; // ບໍ່ cache ຄວາມຜິດພາດ — ໃຫ້ຮຽກໃໝ່ໄດ້ຄັ້ງໜ້າ
          console.error('StorefrontData: fetchData failed', err);
          throw err;
        });
    }
    return cachedPromise;
  }

  function formatKip(amount) {
    return `₭ ${Number(amount || 0).toLocaleString('de-DE')}`;
  }

  /* ---------- ราคาตัวแทน (reseller pricing) ----------
     ดึงสถานะตัวแทนของคนที่ login อยู่ (GET /api/account/reseller-status) แค่ครั้งเดียวต่อ
     session แล้วนำสูตรเดียวกับ RPC get_effective_price ของฝั่ง Supabase มาคิดราคาที่จะโชว์
     บนการ์ดสินค้า/หน้ารายละเอียด: มี reseller_price เฉพาะตัวไหม -> ใช้เลย, ไม่มี -> เอา
     ราคาปกติ x (1 - discount_percent/100) ปัดเศษ ถ้าไม่ใช่ตัวแทนหรือยังไม่ login คืนราคาปกติ */
  let resellerInfoPromise = null;
  function fetchResellerInfo(force) {
    if (!resellerInfoPromise || force) {
      resellerInfoPromise = fetch('/api/account/reseller-status', { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          const status = data && data.status;
          if (status && status.is_reseller) {
            // customPrices: ລາຄາທີ່ແອດມິນຕັ້ງສະເພາະຕົວແທນຄົນນີ້ — map ຂອງ scope_key ('p:<productId>' / 'd:<durationId>') -> ລາຄາ
            const customPrices = {};
            ((data && data.customPrices) || []).forEach((r) => {
              if (r && r.scope_key && r.price !== null && r.price !== undefined) {
                customPrices[r.scope_key] = Number(r.price);
              }
            });
            return { isReseller: true, group2: !!status.group2, discountPercent: Number(status.discount_percent) || 0, customPrices };
          }
          return { isReseller: false, discountPercent: 0, customPrices: {} };
        })
        .catch(() => ({ isReseller: false, discountPercent: 0, customPrices: {} }));
    }
    return resellerInfoPromise;
  }

  // basePrice + resellerPrice (คอลัมน์เฉพาะสินค้า/ระยะเวลานั้น, อาจเป็น null) + resellerInfo
  // ({isReseller, discountPercent} จาก fetchResellerInfo()) -> ราคาที่จะโชว์จริง
  // ids (optional) = { productId, durationId } — ถ้าส่งมา และแอดมินตั้งราคาเฉพาะตัวแทนคนนี้ไว้ จะใช้ราคานั้นก่อนเสมอ
  function effectivePrice(basePrice, resellerPrice, resellerInfo, ids) {
    const base = Number(basePrice) || 0;
    if (!resellerInfo || !resellerInfo.isReseller) return promoPrice(base, ids && ids.promos);
    if (ids && resellerInfo.customPrices) {
      const key = ids.durationId ? `d:${ids.durationId}` : `p:${ids.productId}`;
      const custom = resellerInfo.customPrices[key];
      if (custom !== undefined && Number.isFinite(custom)) return custom;
    }
    // ตัวแทน 2 (ตั้งชื่อแล้ว): ใช้ resellerPrice2 ถ้ามี ก่อนราคาตัวแทนปกติ (ตรงกับ get_effective_price)
    const p2 = ids && ids.resellerPrice2;
    if (resellerInfo.group2 && p2 !== null && p2 !== undefined && p2 !== '') {
      return Number(p2);
    }
    if (resellerPrice !== null && resellerPrice !== undefined && resellerPrice !== '') {
      // resellerPrice ຄືລາຄາສຸດທ້າຍທີ່ຕົວແທນຈ່າຍໂດຍກົງ (ບໍ່ແມ່ນຈຳນວນທີ່ລົດ)
      return Number(resellerPrice);
    }
    return Math.round(base * (1 - (resellerInfo.discountPercent || 0) / 100));
  }


  /* ---------- โปรโมชั่น (promotions) ----------
     Worker ส่ง product.promos = [{ id, mode: 'percent'|'fixed', percent, amount, endsAt }] มาให้เฉพาะโปรที่กำลังใช้งานอยู่
     ฝั่งนี้คิดราคาโชว์ด้วยสูตรเดียวกับ SQL promo_discount (เลือกส่วนลดที่มากที่สุด) — ราคาที่หักจริงตอนซื้อคิดใน Supabase
     ตัวแทน (reseller) ไม่ได้ราคาโปร (ใช้ราคาตัวแทนเหมือนเดิม) */
  function promoOff(price, promos) {
    const now = Date.now();
    let best = 0;
    let bestPromo = null;
    (promos || []).forEach((pr) => {
      if (pr.endsAt && new Date(pr.endsAt).getTime() <= now) return; // หมดเวลาแล้ว (นาฬิกาฝั่งลูกค้า)
      const off = pr.mode === 'percent'
        ? Math.round((Number(price) || 0) * (Number(pr.percent) || 0) / 100)
        : (Number(pr.amount) || 0);
      if (off > best) { best = off; bestPromo = pr; }
    });
    best = Math.min(best, Number(price) || 0);
    return { off: best, promo: bestPromo };
  }
  function promoPrice(price, promos) {
    const p = Number(price) || 0;
    return Math.max(0, p - promoOff(p, promos).off);
  }

  function fmtDots(n) { return Number(n || 0).toLocaleString('de-DE'); }

  // ข้อมูลโปรของสินค้า 1 ชิ้นสำหรับการ์ด: { oldPrice, newPrice, off, label, kind, endsAt } หรือ null (ไม่มีโปร / เป็นตัวแทน)
  // label: ลด % -> "11%" , ลดเป็นราคา -> "-5.000"
  function productPromo(product, resellerInfo) {
    if (!product || (resellerInfo && resellerInfo.isReseller)) return null;
    const promos = product.promos;
    if (!promos || !promos.length) return null;
    const rows = product.duration_enabled
      ? (product.durations || []).map((d) => Number(d.price)).filter((n) => Number.isFinite(n) && n > 0)
      : [Number(product.price) || 0];
    let pick = null;
    rows.forEach((base) => {
      const r = promoOff(base, promos);
      if (r.off <= 0 || !r.promo) return;
      const np = base - r.off;
      if (!pick || np < pick.newPrice) pick = { oldPrice: base, newPrice: np, off: r.off, promo: r.promo };
    });
    if (!pick) return null;
    const isPct = pick.promo.mode === 'percent';
    return {
      oldPrice: pick.oldPrice,
      newPrice: pick.newPrice,
      off: pick.off,
      kind: isPct ? 'percent' : 'fixed',
      label: isPct ? `${Number(pick.promo.percent)}%` : `-${fmtDots(pick.off)}`,
      endsAt: pick.promo.endsAt,
    };
  }

  // ป้าย HOT สีทอง + ป้ายส่วนลด (แดง) บนมุมซ้ายของการ์ดสินค้า
  const PROMO_HOT_SVG = '<svg class="hot-badge" viewBox="0 0 124 64" role="img" aria-label="HOT" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="pbG" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset=".5" stop-color="#ffc83a"/><stop offset="1" stop-color="#d98a00"/></linearGradient><linearGradient id="pbT" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e29a00"/><stop offset=".6" stop-color="#ffc83a"/><stop offset="1" stop-color="#fff3b0"/></linearGradient><linearGradient id="pbH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><g class="hb-flames" fill="url(#pbT)" stroke="#8a5a00" stroke-width="1.4" stroke-linejoin="round"><path class="hb-t hb-t1" d="M76 18C88 18 96 12 100 2C106 10 104 20 96 26C90 30 84 30 76 30Z"/><path class="hb-t hb-t2" d="M76 26C92 24 104 20 114 14C114 24 110 30 102 34C94 38 86 38 76 38Z"/><path class="hb-t hb-t3" d="M76 34C92 34 106 36 118 42C108 46 100 48 90 49C84 50 80 50 76 50Z"/><path class="hb-t hb-t4" d="M76 42C88 46 96 52 100 62C92 60 86 58 76 54Z"/></g><path d="M8 34C8 22 20 15 36 15H62C80 15 88 22 88 34C88 46 80 53 62 53H36C20 53 8 46 8 34Z" fill="url(#pbG)" stroke="#8a5a00" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 30C16 21 26 18 40 18H62C50 22 30 22 14 30Z" fill="url(#pbH)"/><text x="48" y="42" text-anchor="middle" font-family="\'Lilita One\',\'Arial Black\',Impact,sans-serif" font-weight="900" font-style="italic" font-size="27" fill="#4a2a00" fill-opacity=".5" transform="translate(2 2) skewX(-8)">HOT</text><text x="48" y="42" text-anchor="middle" font-family="\'Lilita One\',\'Arial Black\',Impact,sans-serif" font-weight="900" font-style="italic" font-size="27" fill="#fff" stroke="#fff" stroke-width=".6" transform="skewX(-8)">HOT</text></svg>';
  function promoBadgeHTML(pp) {
    if (!pp) return '';
    return `<div class="prod-promo-badge" aria-label="โปรโมชั่น">${PROMO_HOT_SVG}<span class="pp-pill">${escapeHtmlLocal(pp.label)}</span></div>`;
  }
  // ราคาบนการ์ด: ราคาเดิมขีดทับ + ราคาใหม่สีแดง
  function promoPriceHTML(pp) {
    return `<div class="prod-price has-promo"><s class="pp-old">${formatKip(pp.oldPrice)}</s><span class="pp-new">${formatKip(pp.newPrice)}</span></div>`;
  }

  // ລາຄາທີ່ຈະໂຊວ໌ໃນກາຕູນ: ສິນຄ້າທຳມະດາ = price ຂອງມັນເລີຍ,
  // ສິນຄ້າແບບມີໄລຍະເວລາ (duration_enabled) = ລາຄາຕ່ຳສຸດໃນບັນດາໄລຍະທີ່ຕັ້ງໄວ້ (null ຖ້າຍັງບໍ່ຕັ້ງລາຄາໃດເລີຍ)
  // resellerInfo (optional): ถ้าส่งมา จะคำนวณเป็นราคาตัวแทนแทนราคาปกติ (ดู effectivePrice ด้านบน)
  function productDisplayPrice(product, resellerInfo) {
    if (!product) return null;
    if (product.duration_enabled) {
      const prices = (product.durations || [])
        .map((d) => effectivePrice(d.price, d.resellerPrice, resellerInfo, { productId: product.id, durationId: d.id, resellerPrice2: d.resellerPrice2, promos: product.promos }))
        .filter((n) => Number.isFinite(n) && n > 0);
      return prices.length ? Math.min(...prices) : null;
    }
    return effectivePrice(product.price, product.resellerPrice, resellerInfo, { productId: product.id, durationId: null, resellerPrice2: product.resellerPrice2, promos: product.promos });
  }

  // ສະຕັອກລວມທີ່ຈະໂຊວ໌: ສິນຄ້າແບບມີໄລຍະເວລາ = ລວມສະຕັອກທຸກໄລຍະ, ທຳມະດາ = stock ຂອງມັນເລີຍ
  function productTotalStock(product) {
    if (!product) return 0;
    if (product.duration_enabled) {
      return (product.durations || []).reduce((sum, d) => sum + (d.stock || 0), 0);
    }
    return product.stock || 0;
  }

  function isProductBuyable(product) {
    if (!product) return false;
    if (product.paused) return false;
    return productTotalStock(product) > 0;
  }

  function productsByCategoryName(data, categoryName) {
    const target = (categoryName || '').trim();
    if (!target) return [];
    return (data.products || []).filter((p) => (p.category || '').trim() === target);
  }

  function categoryByIndex(data, index) {
    const idx = Number(index);
    return (data.categories || []).find((c) => c.index === idx) || null;
  }

  // ຄ່າເລີ່ມຕົ້ນ (ໃຊ້ຕອນແອດມິນຍັງບໍ່ໄດ້ຕັ້ງຊື່ຮ້ານ/ຄຳອະທິບາຍໃນ "ຕັ້ງຄ່າຮ້ານ") — ປ່ອຍວ່າງໄວ້
  // ບໍ່ໃສ່ຂໍ້ມູນຮ້ານເດີມ ເພື່ອບໍ່ໃຫ້ຂໍ້ມູນເກົ່າໂຜ່ອອກມາຖ້າແອດມິນຍັງບໍ່ໄດ້ຕັ້ງ
  const DEFAULT_STORE_NAME = '';
  const DEFAULT_TAGLINE = '';

  function escapeHtmlLocal(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ເອົາຊື່ຮ້ານ/ຄຳອະທິບາຍທີ່ແອດມິນຕັ້ງໄວ້ (ຈາກ /api/public/storefront -> store.name / store.tagline)
  // ໄປໃສ່ທຸກຈຸດທີ່ມີໃນໜ້ານັ້ນ (header, hero, footer, ...) ໃຫ້ອັດຕະໂນມັດ — ບໍ່ວ່າຈະເປັນ index.html
  // ຫຼື category.html ກໍ່ໃຊ້ຟັງຊັນດຽວກັນນີ້ໄດ້ເລີຍ (element ໃດບໍ່ມີໃນໜ້ານັ້ນຈະຖືກຂ້າມແບບປອດໄພ)
  function applyStoreBranding(store) {
    const name = (store && store.name && String(store.name).trim()) || DEFAULT_STORE_NAME;
    const tagline = (store && store.tagline && String(store.tagline).trim()) || DEFAULT_TAGLINE;
    const taglineHTML = tagline.split('\n').map(escapeHtmlLocal).join('<br>');

    // ชื่อบนแท็บเบราว์เซอร์ — ใช้ชื่อร้านที่ตั้งใน "ຕັ້ງຄ່າຮ້ານ" (ถ้าไม่ได้ตั้งไว้ จะคง <title> เดิมของหน้าไว้)
    if (store && store.name && String(store.name).trim()) {
      document.title = name;
    }

    // ໂລໂກ້ຮ້ານ (settings.logo_url ຈາກ "ຕັ້ງຄ່າຮ້ານ") — ຖ້າແອດມິນອັບໂຫລດໄວ້ ໃຫ້ສະແດງແທນໄອຄອນເລີ່ມຕົ້ນ
    // (svg ຖົງເລີ່ມຕົ້ນ) ໃນທຸກບ່ອນທີ່ມີ .logo (header ຂອງ index.html / category.html)
    const logoUrl = store && store.logoUrl ? String(store.logoUrl).trim() : '';
    if (logoUrl) {
      document.querySelectorAll('.logo').forEach((el) => {
        el.classList.add('has-custom-logo');
        el.innerHTML = `<img src="${escapeHtmlLocal(logoUrl)}" alt="${escapeHtmlLocal(name)}">`;
      });
    }


    document.querySelectorAll('.brand-name, .brand-name-inline, .eyebrow-text, .headline .hl, footer .fname, footer .fcopy-name, .auth-brand')
      .forEach((el) => { el.textContent = name; });
    document.querySelectorAll('.sub')
      .forEach((el) => { el.innerHTML = taglineHTML; });

    applyAnnouncementBar(store && store.announcement);

    return { name, tagline };
  }

  // ---------- ແຖບປະກາດ (settings.announcement_text ຈາກ "ຕັ້ງຄ່າຮ້ານ") ----------
  // ແອດມິນຕັ້ງຄ່ານີ້ໄດ້ຢູ່ແລ້ວ (ຫ້ອງແອດມິນ -> ຕັ້ງຄ່າຮ້ານ -> ຂໍ້ຄວາມປະກາດ) ແຕ່ບໍ່ມີບ່ອນໃດໃນເວັບ
  // ໄຊທ໌ເອົາໄປໂຊວ໌ໃຫ້ລູກຄ້າເຫັນເລີຍ — ຟັງຊັນນີ້ສ້າງແຖບປະກາດເລັກໆໄວ້ເທິງສຸດຂອງໜ້າໃຫ້ອັດຕະໂນມັດ
  // (ສ້າງ style ໃນຕົວເອງ ບໍ່ອີງໃສ່ style.css ເພື່ອໃຫ້ໃຊ້ໄດ້ທຸກໜ້າ ລວມທັງ login.html/signup.html
  // ທີ່ໃຊ້ auth.css ແທນ) — ຖ້າແອດມິນປ່ອຍວ່າງ ຈະບໍ່ໂຊວ໌ຫຍັງເລີຍ, ລູກຄ້າກົດ × ປິດໄດ້ (ຈື່ໄວ້ດ້ວຍ
  // sessionStorage ຈົນກວ່າຈະປິດ browser ຫຼືຂໍ້ຄວາມປະກາດປ່ຽນໄປ)
  function applyAnnouncementBar(rawText) {
    // ปิดแถบประกาศสีแดงด้านบน: ลบแถบทิ้งเสมอ (อยากเปิดกลับ ให้ลบ 3 บรรทัดนี้)
    const oldBar = document.querySelector('.site-announcement-bar'); if (oldBar) oldBar.remove();
    return;
    const text = (rawText && String(rawText).trim()) || '';
    let bar = document.querySelector('.site-announcement-bar');

    if (!text) {
      if (bar) bar.remove();
      return;
    }

    if (!document.getElementById('site-announcement-style')) {
      const style = document.createElement('style');
      style.id = 'site-announcement-style';
      style.textContent = `
        .site-announcement-bar{position:relative;display:flex;align-items:center;gap:10px;
          background:linear-gradient(90deg,#990001,#ff0001);color:#fff;font-size:13px;
          font-weight:600;line-height:1.5;padding:9px 40px 9px 16px;text-align:center;
          justify-content:center;}
        .site-announcement-bar.is-hidden{display:none;}
        .site-announcement-close{position:absolute;right:8px;top:50%;transform:translateY(-50%);
          background:rgba(0,0,0,.18);border:none;color:#fff;width:22px;height:22px;border-radius:50%;
          font-size:15px;line-height:1;cursor:pointer;}
        .site-announcement-close:hover{background:rgba(0,0,0,.32);}
      `;
      document.head.appendChild(style);
    }

    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'site-announcement-bar';
      bar.innerHTML = '<span class="site-announcement-text"></span><button type="button" class="site-announcement-close" aria-label="ປິດ">×</button>';
      document.body.prepend(bar);
      bar.querySelector('.site-announcement-close').addEventListener('click', () => {
        bar.classList.add('is-hidden');
        try { sessionStorage.setItem('site_announcement_dismissed', text); } catch { /* private mode ฯลฯ ก็ปล่อยผ่าน ไม่ใช่ฟีเจอร์จำเป็น */ }
      });
    }

    bar.querySelector('.site-announcement-text').textContent = text;
    let dismissed = '';
    try { dismissed = sessionStorage.getItem('site_announcement_dismissed') || ''; } catch { /* private mode ฯลฯ ก็ปล่อยผ่าน */ }
    bar.classList.toggle('is-hidden', dismissed === text);
  }

  global.StorefrontData = {
    fetchData,
    fetchResellerInfo,
    effectivePrice,
    formatKip,
    productDisplayPrice,
    promoPrice,
    promoOff,
    productPromo,
    promoBadgeHTML,
    promoPriceHTML,
    productTotalStock,
    isProductBuyable,
    productsByCategoryName,
    categoryByIndex,
    applyStoreBranding,
  };
})(window);
