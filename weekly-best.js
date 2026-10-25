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

  function cardHTML(item, isClone) {
    const media = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.productName)}" loading="lazy" decoding="async" draggable="false">`
      : `<div class="wb-img-fallback"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M3 11h18"/><path d="M8 7V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3"/></svg></div>`;
    const price = item.price == null
      ? ''
      : `<div class="wb-price">${item.fromPrice ? '<span class="wb-from">ເລີ່ມ</span> ' : ''}${escapeHtml(formatKip(item.price))}</div>`;
    const href = `product.html?pid=${encodeURIComponent(item.productId)}`;
    return `
      <a class="wb-card${item.rank === 1 ? ' is-top' : ''}" href="${href}"${isClone ? ' aria-hidden="true" tabindex="-1"' : ''}>
        <div class="wb-media">
          ${media}
        </div>
        <div class="wb-body">
          <div class="wb-name">${escapeHtml(item.productName)}</div>
          ${price}
          <div class="wb-sold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c1 3.5 4 5 4 9a4 4 0 0 1-8 0c0-1.5.6-2.6 1.4-3.6C10.2 9 11 8 11 6.5 11 5 11.5 3.5 12 2Z"/></svg>
            ອາທິດນີ້ຂາຍແລ້ວ ${escapeHtml(item.soldThisWeek)} ຊິ້ນ
          </div>
        </div>
      </a>`;
  }

  function hideSection() { section.style.display = 'none'; }

  function init(items) {
    const n = items.length;
    const slides = n > VISIBLE;       // ມີຫຼາຍກວ່າ 2 ລາຍການ ຈຶ່ງຈະເລື່ອນ
    let html = items.map((it) => cardHTML(it, false)).join('');
    if (slides) html += items.slice(0, VISIBLE).map((it) => cardHTML(it, true)).join('');
    track.innerHTML = html;

    // ຕ້ອງລຶບ class u-hidden ອອກ (style.css: .u-hidden{display:none} ຍັງມີຜົນຢູ່ ແມ່ນແຕ່ຕັ້ງ style.display='')
    section.classList.remove('u-hidden');
    section.style.display = '';
    wrap.classList.toggle('has-nav', slides); // ປຸ່ມ ซ้าย/ขวา ສະແດງສະເພາະຕອນມີຫຼາຍກວ່າ 2 ລາຍການ

    // ວາງປຸ່ມໃຫ້ຢູ່ສ່ວນລຸ່ມຂອງຮູບການ໌ດ — ວັດຄວາມສູງຮູບ (aspect-ratio ຈຶ່ງຮູ້ຄວາມສູງທັນທີ ບໍ່ຕ້ອງລໍຮູບໂຫຼດ)
    const setImgH = () => {
      const m = track.querySelector('.wb-media');
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
    const res = await fetch('/api/public/weekly-best-sellers', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`weekly-best-sellers endpoint responded ${res.status}`);
    const data = await res.json();
    const items = (data && data.items) || [];
    if (!items.length) { hideSection(); return; }
    init(items);
  } catch (err) {
    console.error('weekly-best: fetch failed', err);
    hideSection();
  }
});
