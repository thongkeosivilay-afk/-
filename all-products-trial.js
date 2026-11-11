/* all-products-trial.js — "สินค้าทั้งหมด": แถวสินค้าแยกตามหมวดหมู่ เลื่อนซ้าย-ขวาได้ 2 การ์ดต่อหน้าจอ
   ใช้การ์ดสไตล์เดียวกับเว็บ (.prod-card จาก style.css / category.js / weekly-best.js)
   เรียงลำดับ: ขายดี (soldCount มาก) ก่อน -> รองลงมาสต็อกเยอะ -> ชื่อ */
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('allProducts');
  if (!root || !window.StorefrontData) return;
  const SD = window.StorefrontData;

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const n = (v) => Number(v || 0).toLocaleString('en-US');

  let resellerInfo = { isReseller: false, discountPercent: 0 };
  // ໄອຄອນທີ່ໃຊ້ໃນອນິເມຊັນ 2 ສະຖານະ: "ຢຸດຂາຍຊົ່ວຄາວ" (ແອດມິນປິດເອງ) ແລະ "ສິນຄ້າໝົດ" (ໝົດແທ້)
  const GEAR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19.5a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 17.85a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H2.5a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.15 6.99a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H8.6a1.7 1.7 0 0 0 1.04-1.56V.5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V6.6a1.7 1.7 0 0 0 1.56 1.04h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04Z"/></svg>`;
  const WRENCH_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L2 19l3 3 7.3-7.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2-2Z"/></svg>`;
  const LOCK_SVG = `<svg class="soldout-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`;
  // ໝາຍເຫດ: stroke ໃຊ້ currentColor (ບໍ່ hardcode #fff ອີກຕໍ່ໄປ) ເພື່ອໃຫ້ໄອຄອນປ່ຽນສີ
  // ຕາມ .buy-btn ອັດຕະໂນມັດ — ດຳຕອນປົກກະຕິ (ພື້ນຫຼັງແດງ), ເທົາຕອນ disabled
  const CART_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`;
  // ໄອຄອນເປວໄຟ ໃຊ້ໃນປ້າຍ "ຂາຍແລ້ວ" — SVG ລ້ວນ, ບໍ່ໃຊ້ emoji
  const FLAME_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 3-2 4-2 7a3 3 0 0 0 6 0c2 2 3 4 3 6.5A7 7 0 1 1 8 15.5c0-2 1-3 2-4.5.5 1 1.5 1.5 2 1 1-1 0-2.5-1-4.5C10 5.5 11 3.5 12 2Z"/></svg>`;

  // ສະຖານະຂອງສິນຄ້າ: 'ok' ພ້ອມຂາຍ, 'paused' ແອດມິນປິດຂາຍເອງ, 'soldout' ສິນຄ້າໝົດແທ້ໆ
  function stockState(product, stock) {
    if (product.paused) return 'paused';
    if (!(stock > 0)) return 'soldout';
    return 'ok';
  }

  function mediaHTML(product) {
    if (product.image_url) {
      return `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" class="prod-img" loading="lazy" decoding="async">`;
    }
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <rect x="3" y="4" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5-9 9"/>
      </svg>`;
  }

  // stable pseudo-random 0..-2.5s delay per product id, so cards in the same
  // grid don't all pulse/rotate in perfect unison
  function fxDelay(id) {
    const str = String(id || '');
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return -(h % 250) / 100; // 0 .. -2.5s
  }

  // ບໍລິເວນຮູບສິນຄ້າ (v5): "ພ້ອມຂາຍ" ໂຊວ໌ຮູບ/ໄອຄອນປົກກະຕິ,
  // "ປັບປຸງ" ໂຊວ໌ໄອຄອນຟັນເຟືອງ+ປະແຈກາງກ່ອງ + ແຖບໂຫລດຄືບໜ້າ (ບໍ່ມີຮູບສິນຄ້າ),
  // "ໝົດ" ໂຊວ໌ ໂບ hazard-tape "SOLD OUT" ພາດມຸມ + ໄອຄອນລັອກ (ນິລະໄພປິດຜະນຶກ)
  function mediaBodyHTML(product, state, id) {
    const d = fxDelay(id);
    if (state === 'paused') {
      return `
        <div class="paused-icon">
          <div class="gear" style="animation-delay:${d}s;">${GEAR_SVG}</div>
          <div class="wrench" style="animation-delay:${d * 0.4}s;">${WRENCH_SVG}</div>
        </div>
        <div class="paused-title">ປັບປຸງ / ລໍຖ້າອັບເດດ</div>
        <div class="paused-sub">${product.paused_note ? escapeHtml(product.paused_note) : 'ກຳລັງສ້ອມແປງ..'}</div>
        <div class="paused-bar"><i style="animation-delay:${d}s;"></i></div>`;
    }
    if (state === 'soldout') {
      return `
        <div class="soldout-ribbon"><span>SOLD OUT</span></div>
        <div class="soldout-wrap">
          ${LOCK_SVG}
          <div class="soldout-title">ໝົດແລ້ວ</div>
          <div class="soldout-sub">ລໍຖ້າຮອບຕໍ່ໄປ</div>
        </div>`;
    }
    return mediaHTML(product);
  }

  function statusHTML(product, stock, state) {
    if (state === 'paused') {
      return `<div class="prod-status out">ຄັງ ${stock.toLocaleString('en-US')}</div>`;
    }
    if (state === 'soldout') {
      return `<div class="prod-status out">ຄັງ 0</div>`;
    }
    return `<div class="prod-status">ເຫຼືອ ${stock.toLocaleString('en-US')} ອັນ</div>`;
  }

  function buyLabel(state) {
    if (state === 'paused') return 'ກຳລັງປັບປຸງ';
    if (state === 'soldout') return 'ສິນຄ້າໝົດ';
    return 'ຊື້ເລີຍ';
  }

  const UP_ARROW_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6M6 11l6-6 6 6"/></svg>`;
  const X_CIRCLE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5.5 5.5l13 13"/></svg>`;

  function buyIconHTML(state) {
    if (state === 'paused') return UP_ARROW_SVG;
    if (state === 'soldout') return X_CIRCLE_SVG;
    return CART_SVG;
  }

  function priceHTML(product) {
    const price = window.StorefrontData.productDisplayPrice(product, resellerInfo);
    if (price === null) return `<div class="prod-price todo">₭ 0</div>`;
    const pp = window.StorefrontData.productPromo(product, resellerInfo);
    if (pp) return window.StorefrontData.promoPriceHTML(pp);
    const tag = resellerInfo.isReseller ? '<span class="prod-price-reseller-tag">ຕົວແທນ</span>' : '';
    const priceClass = resellerInfo.isReseller ? 'prod-price is-reseller-glow' : 'prod-price';
    return `<div class="${priceClass}">${window.StorefrontData.formatKip(price)}${tag}</div>`;
  }

  // ຫາສິນຄ້າທີ່ "ຂາຍດີສຸດ" ໃນລາຍການທີ່ກຳລັງໂຊວ໌ (soldCount ສູງສຸດ ແລະ ຕ້ອງ > 0 ຈຶ່ງຈະຕິດປ້າຍ) —
  // ຄິດແຍກຕໍ່ໜ້າ/ຕໍ່ໝວດ ບໍ່ແມ່ນຕາຍຕົວທັງຮ້ານ, ຖ້າຂາຍທຽບກັນ 0 ໝົດຈະບໍ່ມີໃຜຕິດຕາປັ໊ມ
  function findTopSellerId(products) {
    let topId = null;
    let topCount = 0;
    products.forEach((p) => {
      const c = Number(p.soldCount) || 0;
      if (c > topCount) { topCount = c; topId = p.id; }
    });
    return topId;
  }

  function soldTagHTML(product) {
    const count = Number(product.soldCount) || 0;
    if (count <= 0) return '';
    return `<div class="prod-sold-tag">${FLAME_SVG}ຂາຍແລ້ວ ${count.toLocaleString('en-US')} ອັນ</div>`;
  }


  function sortProducts(list) {
    return list.slice().sort((a, b) =>
      (Number(b.soldCount) || 0) - (Number(a.soldCount) || 0) ||
      SD.productTotalStock(b) - SD.productTotalStock(a) ||
      String(a.name).localeCompare(String(b.name)));
  }

  function cardHTML(product, topSellerId) {
    const stock = SD.productTotalStock(product);
    const buyable = SD.isProductBuyable(product);
    const state = stockState(product, stock);
    const mediaClass = state === 'ok' ? 'prod-media' : `prod-media is-${state}`;
    const isTopSeller = topSellerId && product.id === topSellerId;
    const cardClass = ['prod-card', 'grid-card', 'wb-pc', isTopSeller ? 'is-top-seller' : ''].filter(Boolean).join(' ');
    const stampHTML = isTopSeller ? `<div class="prod-stamp is-hot"><svg class="hot-badge" viewBox="0 0 124 64" role="img" aria-label="HOT" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="hbG" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#ffb23a"/><stop offset=".55" stop-color="#ff6a12"/><stop offset="1" stop-color="#e83a00"/></linearGradient><linearGradient id="hbT" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff5a0a"/><stop offset=".6" stop-color="#ff9a1f"/><stop offset="1" stop-color="#ffd24a"/></linearGradient><linearGradient id="hbH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><g class="hb-flames" fill="url(#hbT)" stroke="#a82600" stroke-width="1.4" stroke-linejoin="round"><path class="hb-t hb-t1" d="M76 18C88 18 96 12 100 2C106 10 104 20 96 26C90 30 84 30 76 30Z"/><path class="hb-t hb-t2" d="M76 26C92 24 104 20 114 14C114 24 110 30 102 34C94 38 86 38 76 38Z"/><path class="hb-t hb-t3" d="M76 34C92 34 106 36 118 42C108 46 100 48 90 49C84 50 80 50 76 50Z"/><path class="hb-t hb-t4" d="M76 42C88 46 96 52 100 62C92 60 86 58 76 54Z"/></g><path d="M8 34C8 22 20 15 36 15H62C80 15 88 22 88 34C88 46 80 53 62 53H36C20 53 8 46 8 34Z" fill="url(#hbG)" stroke="#a82600" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 30C16 21 26 18 40 18H62C50 22 30 22 14 30Z" fill="url(#hbH)"/><text x="48" y="42" text-anchor="middle" font-family="'Lilita One','Arial Black',Impact,sans-serif" font-weight="900" font-style="italic" font-size="27" fill="#3a0d00" fill-opacity=".55" transform="translate(2 2) skewX(-8)">HOT</text><text x="48" y="42" text-anchor="middle" font-family="'Lilita One','Arial Black',Impact,sans-serif" font-weight="900" font-style="italic" font-size="27" fill="#fff" stroke="#fff" stroke-width=".6" transform="skewX(-8)">HOT</text></svg></div>` : '';
    return `
      <article class="${cardClass}" data-pid="${escapeHtml(product.id)}">
        ${stampHTML}
        ${window.StorefrontData.promoBadgeHTML(window.StorefrontData.productPromo(product, resellerInfo))}
        <div class="${mediaClass}">
          ${mediaBodyHTML(product, state, product.id)}
        </div>
        <div class="prod-body">
 <div class="prod-name" title="${escapeHtml(product.name || '')}">${escapeHtml(product.name || '')}</div>
 <div class="prod-row">${priceHTML(product)}${statusHTML(product, stock, state)}</div>
 <button type="button" class="buy-btn" ${buyable ? '' : 'disabled'}>
 ${buyIconHTML(state)}
 ${buyLabel(state)}
 </button>
 ${soldTagHTML(product)}
 </div>
 </article>`;
  }

  function render(data) {
    const html = (data.categories || []).map((c) => {
      const items = sortProducts(SD.productsByCategoryName(data, c.name));
      if (!items.length) return '';
      const topId = findTopSellerId(items);
      return `<div class="ap-cat">
        <div class="ap-cat-head">
          <div class="ap-cat-name">${escapeHtml(c.name)}</div>
          <a class="ap-more" href="category.html?cat=${c.index}">${n(items.length)} ລາຍການ ›</a>
        </div>
        <div class="ap-row">${items.map((p) => cardHTML(p, topId)).join('')}</div>
      </div>`;
    }).join('');
    root.innerHTML = html || '<div class="ap-empty">ຍັງບໍ່ມີສິນຄ້າ</div>';
  }

  // ກົດການ໌ດ/ປຸ່ມ "ຊື້ເລີຍ" -> ໄປໜ້າສິນຄ້າ (ຄືກັບໜ້າໝວດໝູ່)
  root.addEventListener('click', (e) => {
    const card = e.target.closest('.prod-card[data-pid]');
    if (!card) return;
    const btn = e.target.closest('.buy-btn');
    if (btn && btn.disabled) return;
    window.location.href = `product.html?pid=${encodeURIComponent(card.dataset.pid)}`;
  });

  SD.fetchData().then(render).catch(() => {
    root.innerHTML = '<div class="ap-empty">ດຶງຂໍ້ມູນສິນຄ້າບໍ່ສຳເລັດ, ກະລຸນາໂຫຼດໜ້ານີ້ໃໝ່</div>';
  });
});
