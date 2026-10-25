/* =========================================================
   weekly-best.js — ແຖບ "ສິນຄ້າຂາຍດີປະຈຳອາທິດ" ໃນ index.html
   (ຢູ່ລະຫວ່າງ "ສິນຄ້າທີ່ຊື້ລ່າສຸດ" ແລະ "ໝວດໝູ່ແນະນຳ")

   - ດຶງຂໍ້ມູນຈິງຈາກ GET /api/public/weekly-best-sellers (7 ວັນຫຼ້າສຸດ, ຮຽງຍອດຂາຍຫຼາຍ -> ໜ້ອຍ)
   - ສະແດງເທື່ອລະ 2 ການ໌ດ ທຸກ ~2.5 ວິ ເລື່ອນໄປທາງຊ້າຍ 1 ໃບ ແລ້ວການ໌ດໃໝ່ເຂົ້າມາທາງຂວາ ວົນຕໍ່ເນື່ອງ
     (ໃຊ້ການ໌ດ clone 2 ໃບທ້າຍແຖວ ແລ້ວ "snap" ກັບຈຸດເລີ່ມຕົ້ນແບບບໍ່ມີ transition ເພື່ອໃຫ້ວົນບໍ່ມີຮອຍຕໍ່)
   - ມີສິນຄ້າ <= 2 ລາຍການ -> ສະແດງນິ່ງໆ ບໍ່ເລື່ອນ
   - ມີປຸ່ມ ซ้าย/ขวา (ວາງທີ່ມຸມລຸ່ມຂອງຮູບການ໌ດ) ກົດເລື່ອນເອງໄດ້ ແລະ ວົນກັບໄດ້ທັງສອງທິດ
   - ຢຸດເລື່ອນເມື່ອແຕະ/ເອົາເມົ້າຄ້າງ ແລະ ເມື່ອແທັບຖືກເຊື່ອງ; ປະຕິບັດຕາມ prefers-reduced-motion
   - ບໍ່ມີຂໍ້ມູນປອມ: ອາທິດນີ້ຍັງບໍ່ມີຍອດຂາຍ/ດຶງຂໍ້ມູນບໍ່ໄດ້ -> ເຊື່ອງ section ນີ້ທັງໝົດ
   ========================================================= */

document.addEventListener('DOMContentLoaded', async () => {
  const section = document.getElementById('weeklyBestSection');
  const viewport = document.getElementById('wbViewport');
  const track = document.getElementById('wbTrack');
  const wrap = document.getElementById('wbWrap');
  const prevBtn = document.getElementById('wbPrev');
  const nextBtn = document.getElementById('wbNext');
  if (!section || !viewport || !track || !wrap || !prevBtn || !nextBtn) return;

  const VISIBLE = 2;          // ສະແດງ 2 ການ໌ດພ້ອມກັນ
  const INTERVAL_MS = 2500;   // ເວລາຄ້າງກ່ອນເລື່ອນໄປໃບຕໍ່ໄປ
  const SLIDE_MS = 450;       // ໄລຍະເວລາເລື່ອນ

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function formatKip(amount) {
    if (window.StorefrontData && typeof window.StorefrontData.formatKip === 'function') {
      return window.StorefrontData.formatKip(amount);
    }
    return `₭ ${Number(amount || 0).toLocaleString('de-DE')}`;
  }

  // ---- ການ໌ດສິນຄ້າ: ໃຊ້ໂຄງສ້າງ/ຄລາດສ໌ດຽວກັບໜ້າໝວດໝູ່ (category.js) ທຸກຢ່າງ ----
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

  function cardHTML(item, isClone) {
    const product = item.product;
    const stock = window.StorefrontData.productTotalStock(product);
    const buyable = window.StorefrontData.isProductBuyable(product);
    const state = stockState(product, stock);
    const mediaClass = state === 'ok' ? 'prod-media' : `prod-media is-${state}`;
    const isTopSeller = item.rank === 1;
    const cardClass = [
      'prod-card', 'grid-card', 'wb-pc',
      resellerInfo.isReseller ? 'is-reseller' : '',
      isTopSeller ? 'is-top-seller' : '',
    ].filter(Boolean).join(' ');
    const stampHTML = isTopSeller ? `<div class="prod-stamp">${FLAME_SVG}ຂາຍດີ!</div>` : '';
    const html = `
      <article class="${cardClass}" data-pid="${escapeHtml(product.id)}">
        <div class="${mediaClass}">
          ${stampHTML}
          ${mediaBodyHTML(product, state, product.id)}
        </div>
        <div class="prod-body">
 <div class="prod-name" title="${escapeHtml(product.name || '')}">${escapeHtml(product.name || 'ໃສ່ຊື່ສິນຄ້າ')}</div>
 <div class="prod-row">${priceHTML(product)}${statusHTML(product, stock, state)}</div>
 <button type="button" class="buy-btn" ${buyable ? '' : 'disabled'}>
 ${buyIconHTML(state)}
 ${buyLabel(state)}
 </button>
 ${soldTagHTML(product)}
 </div>
 </article>`;
    return isClone
      ? html.replace('<article ', '<article aria-hidden="true" ').replace('<button type="button" class="buy-btn"', '<button type="button" tabindex="-1" class="buy-btn"')
      : html;
  }

  function hideSection() { section.style.display = 'none'; }

  function init(items) {
    const n = items.length;
    const slides = n > VISIBLE;       // ມີຫຼາຍກວ່າ 2 ລາຍການ ຈຶ່ງຈະເລື່ອນ
    let html = items.map((it) => cardHTML(it, false)).join('');
    if (slides) html += items.slice(0, VISIBLE).map((it) => cardHTML(it, true)).join('');
    track.innerHTML = html;
    track.addEventListener('click', (e) => {
      const btn = e.target.closest ? e.target.closest('.buy-btn:not([disabled])') : null;
      const card = btn && btn.closest('.prod-card[data-pid]');
      if (card) window.location.href = `product.html?pid=${encodeURIComponent(card.dataset.pid)}`;
    });

    // ຕ້ອງລຶບ class u-hidden ອອກ (style.css: .u-hidden{display:none} ຍັງມີຜົນຢູ່ ແມ່ນແຕ່ຕັ້ງ style.display='')
    section.classList.remove('u-hidden');
    section.style.display = '';
    wrap.classList.toggle('has-nav', slides); // ປຸ່ມ ซ้าย/ขวา ສະແດງສະເພາະຕອນມີຫຼາຍກວ່າ 2 ລາຍການ

    // ວາງປຸ່ມໃຫ້ຢູ່ສ່ວນລຸ່ມຂອງຮູບການ໌ດ — ວັດຄວາມສູງຮູບ (aspect-ratio ຈຶ່ງຮູ້ຄວາມສູງທັນທີ ບໍ່ຕ້ອງລໍຮູບໂຫຼດ)
    const setImgH = () => {
      const m = track.querySelector('.prod-media');
      if (m) wrap.style.setProperty('--wb-img-h', `${m.offsetHeight}px`);
    };
    setImgH();
    if (!slides) return;

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let index = 0;
    let timer = null;
    let paused = false;
    let busy = false; // ກັນກົດຖີ່ເກີນໄປຕອນກຳລັງເລື່ອນ/snap

    function stepWidth() {
      const cards = track.children;
      if (cards.length < 2) return 0;
      return cards[1].offsetLeft - cards[0].offsetLeft; // ຄວາມກວ້າງການ໌ດ + ຊ່ອງວ່າງ
    }

    function go(toIndex, animate) {
      track.style.transition = animate ? `transform ${SLIDE_MS}ms cubic-bezier(.22,.8,.3,1)` : 'none';
      track.style.transform = `translate3d(${-toIndex * stepWidth()}px,0,0)`;
      index = toIndex;
    }

    function lock() { busy = true; setTimeout(() => { busy = false; }, SLIDE_MS + 80); }

    function next() {
      if (busy) return;
      lock();
      go(index + 1, true);
      if (index >= n) {
        // ມາຮອດການ໌ດ clone ແລ້ວ -> ຫຼັງ animation ຈົບ snap ກັບຈຸດເລີ່ມຕົ້ນ (ພາບຄືກັນທຸກຢ່າງ ບໍ່ເຫັນຮອຍຕໍ່)
        setTimeout(() => { go(0, false); void track.offsetWidth; }, SLIDE_MS + 40);
      }
    }

    function prev() {
      if (busy) return;
      lock();
      if (index === 0) { go(n, false); void track.offsetWidth; } // ໂດດໄປຕຳແໜ່ງ clone (ພາບຄືກັນ) ກ່ອນເລື່ອນຖອຍ
      go(index - 1, true);
    }

    function autoNext() { if (!paused && !document.hidden) next(); }
    function start() {
      stop();
      if (reduceMotion) return;
      timer = setInterval(autoNext, INTERVAL_MS);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    prevBtn.addEventListener('click', () => { prev(); start(); }); // ກົດແລ້ວຣີເຊັດເວລາເລື່ອນອັດຕະໂນມັດ
    nextBtn.addEventListener('click', () => { next(); start(); });
    viewport.addEventListener('pointerenter', () => { paused = true; });
    viewport.addEventListener('pointerleave', () => { paused = false; });
    viewport.addEventListener('touchstart', () => { paused = true; }, { passive: true });
    viewport.addEventListener('touchend', () => { setTimeout(() => { paused = false; }, 1500); }, { passive: true });
    viewport.addEventListener('dragstart', (e) => e.preventDefault());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    window.addEventListener('resize', () => { setImgH(); go(index % n, false); });

    go(0, false);
    start();
  }

  try {
    if (!window.StorefrontData) throw new Error('StorefrontData missing');
    const [res, storeData, rInfo] = await Promise.all([
      fetch('/api/public/weekly-best-sellers', { headers: { Accept: 'application/json' }, cache: 'no-store' }),
      window.StorefrontData.fetchData(),
      window.StorefrontData.fetchResellerInfo().catch(() => null),
    ]);
    if (!res.ok) throw new Error(`weekly-best-sellers endpoint responded ${res.status}`);
    if (rInfo && rInfo.isReseller) resellerInfo = rInfo;
    const data = await res.json();
    // ສະແດງສະເພາະສິນຄ້າທີ່ມີຢູ່ໃນຮ້ານຈິງ (ຂໍ້ມູນຊຸດດຽວກັບໜ້າຮ້ານ) — ສິນຄ້າທີ່ບໍ່ມີໃນເວັບຈະບໍ່ຂຶ້ນ
    const byId = new Map(((storeData && storeData.products) || []).map((p) => [String(p.id), p]));
    const items = ((data && data.items) || [])
      .map((it) => ({ ...it, product: byId.get(String(it.productId)) }))
      .filter((it) => it.product)
      .map((it, i) => ({ ...it, rank: i + 1 }));
    if (!items.length) { hideSection(); return; }
    init(items);
  } catch (err) {
    console.error('weekly-best: fetch failed', err);
    hideSection();
  }
});
