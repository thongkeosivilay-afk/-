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
      cachedPromise = fetch(ENDPOINT, { headers: { Accept: 'application/json' } })
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

  // ລາຄາທີ່ຈະໂຊວ໌ໃນກາຕູນ: ສິນຄ້າທຳມະດາ = price ຂອງມັນເລີຍ,
  // ສິນຄ້າແບບມີໄລຍະເວລາ (duration_enabled) = ລາຄາຕ່ຳສຸດໃນບັນດາໄລຍະທີ່ຕັ້ງໄວ້ (null ຖ້າຍັງບໍ່ຕັ້ງລາຄາໃດເລີຍ)
  function productDisplayPrice(product) {
    if (!product) return null;
    if (product.duration_enabled) {
      const prices = (product.durations || [])
        .map((d) => Number(d.price))
        .filter((n) => Number.isFinite(n) && n > 0);
      return prices.length ? Math.min(...prices) : null;
    }
    return Number(product.price) || 0;
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

  // ຄ່າເລີ່ມຕົ້ນ (ໃຊ້ຕອນແອດມິນຍັງບໍ່ໄດ້ຕັ້ງຊື່ຮ້ານ/ຄຳອະທິບາຍໃນ "ຕັ້ງຄ່າຮ້ານ")
  const DEFAULT_STORE_NAME = '𝐃𝐄𝐊 𝐌𝐀𝐒𝐇 𝐒𝐇𝐎𝐏';
  const DEFAULT_TAGLINE =
    'ຮ້ານຈຳໜ່າຍບັນຊີເກມ ບັດເຕີມເງິນ ແລະ ອຸປະກອນເສີມເກມມິ່ງ\n' +
    'ບໍລິການວ່ອງໄວ ປອດໄພ 100%\n' +
    'ສາມາດສັ່ງຊື້ສິນຄ້າຜ່ານລະບົບອັດຕະໂນມັດ !!';

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

    document.querySelectorAll('.brand-name, .brand-name-inline, .eyebrow-text, .headline .hl, footer .fname, footer .fcopy-name')
      .forEach((el) => { el.textContent = name; });
    document.querySelectorAll('.sub')
      .forEach((el) => { el.innerHTML = taglineHTML; });

    return { name, tagline };
  }

  global.StorefrontData = {
    fetchData,
    formatKip,
    productDisplayPrice,
    productTotalStock,
    isProductBuyable,
    productsByCategoryName,
    categoryByIndex,
    applyStoreBranding,
  };
})(window);
