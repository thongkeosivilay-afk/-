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
    return `₭ ${Number(amount || 0).toLocaleString('en-US')}`;
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
            return { isReseller: true, discountPercent: Number(status.discount_percent) || 0 };
          }
          return { isReseller: false, discountPercent: 0 };
        })
        .catch(() => ({ isReseller: false, discountPercent: 0 }));
    }
    return resellerInfoPromise;
  }

  // basePrice + resellerPrice (คอลัมน์เฉพาะสินค้า/ระยะเวลานั้น, อาจเป็น null) + resellerInfo
  // ({isReseller, discountPercent} จาก fetchResellerInfo()) -> ราคาที่จะโชว์จริง
  function effectivePrice(basePrice, resellerPrice, resellerInfo) {
    const base = Number(basePrice) || 0;
    if (!resellerInfo || !resellerInfo.isReseller) return base;
    if (resellerPrice !== null && resellerPrice !== undefined && resellerPrice !== '') {
      return Number(resellerPrice);
    }
    return Math.round(base * (1 - (resellerInfo.discountPercent || 0) / 100));
  }

  // ລາຄາທີ່ຈະໂຊວ໌ໃນກາຕູນ: ສິນຄ້າທຳມະດາ = price ຂອງມັນເລີຍ,
  // ສິນຄ້າແບບມີໄລຍະເວລາ (duration_enabled) = ລາຄາຕ່ຳສຸດໃນບັນດາໄລຍະທີ່ຕັ້ງໄວ້ (null ຖ້າຍັງບໍ່ຕັ້ງລາຄາໃດເລີຍ)
  // resellerInfo (optional): ถ้าส่งมา จะคำนวณเป็นราคาตัวแทนแทนราคาปกติ (ดู effectivePrice ด้านบน)
  function productDisplayPrice(product, resellerInfo) {
    if (!product) return null;
    if (product.duration_enabled) {
      const prices = (product.durations || [])
        .map((d) => effectivePrice(d.price, d.resellerPrice, resellerInfo))
        .filter((n) => Number.isFinite(n) && n > 0);
      return prices.length ? Math.min(...prices) : null;
    }
    return effectivePrice(product.price, product.resellerPrice, resellerInfo);
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

    return { name, tagline };
  }

  global.StorefrontData = {
    fetchData,
    fetchResellerInfo,
    effectivePrice,
    formatKip,
    productDisplayPrice,
    productTotalStock,
    isProductBuyable,
    productsByCategoryName,
    categoryByIndex,
    applyStoreBranding,
  };
})(window);
