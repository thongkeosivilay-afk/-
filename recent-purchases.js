/* =========================================================
   recent-purchases.js — ແຖບ "ສິນຄ້າທີ່ຊື້ລ່າສຸດ" ໃນ index.html
   ດຶງລາຍການສັ່ງຊື້ຈິງລ່າສຸດຈາກ GET /api/public/recent-purchases (ເບິ່ງ
   handleRecentPurchases ໃນ src/index.js) ແລ້ວສ້າງແຖບ carousel ທີ່ໄຫຼ
   ອັດຕະໂນມັດຈາກຂວາ -> ຊ້າຍແບບວົນຕໍ່ເນື່ອງ (ບໍ່ມີຈັງຫວະກະໂດດກັບຕົ້ນລາຍການ)

   ບໍ່ມີການສ້າງຂໍ້ມູນປອມ — ຖ້າ API ຄືນລາຍການວ່າງ (ຍັງບໍ່ມີການສັ່ງຊື້ status
   'completed' ຈິງເລີຍ) ຈະເຊື່ອງ section ນີ້ທັງໝົດໄປເລີຍ ບໍ່ໂຊວ໌ carousel ຫວ່າງໆ
   ========================================================= */

document.addEventListener('DOMContentLoaded', async () => {
  const carousel = document.getElementById('rpCarousel');
  const track = document.getElementById('rpTrack');
  if (!carousel || !track) return;

  const section = carousel.closest('.section');

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // "4 ນາທີກ່ອນ" ຈາກ createdAt (ISO string) — ຄິດໄລ່ຝັ່ງ client ຕອນສະແດງຜົນ
  // (ບໍ່ແມ່ນຄ່າຄົງທີ່ຈາກ backend, ຈຶ່ງຖືກຕ້ອງສະເໝີບໍ່ວ່າຈະໂຫລດໜ້າຕອນໃດ)
  function timeAgoLabel(iso) {
    const then = new Date(iso).getTime();
    if (!iso || Number.isNaN(then)) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (diffSec < 60) return 'ຫາກໍ່ຊື້';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} ນາທີກ່ອນ`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ຊົ່ວໂມງກ່ອນ`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} ມື້ກ່ອນ`;
  }

  function cardHTML(item) {
    const media = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.productName)}" loading="lazy">`
      : `<div class="rp-icon-fallback">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M3 11h18"/><path d="M8 7V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3"/></svg>
         </div>`;
    const buyerRow = item.buyer
      ? `<div class="rp-buyer">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
           ${escapeHtml(item.buyer)}
         </div>`
      : '';
    return `
      <div class="rp-card">
        ${media}
        <div class="rp-info">
          <div class="rp-name">${escapeHtml(item.productName)}</div>
          ${buyerRow}
          <div class="rp-time">${escapeHtml(timeAgoLabel(item.createdAt))}</div>
        </div>
      </div>`;
  }

  function initCarousel(items) {
    // ຊ້ຳຫຼາຍຊຸດຕໍ່ກັນເປັນແຖບຍາວ -> ໄຫຼວົນແບບບໍ່ມີຮອຍຕໍ່ (ບໍ່ຕ້ອງ "ກະໂດດ" ກັບຈຸດເລີ່ມຕົ້ນ)
    // ຢ່າງໜ້ອຍ 2 ຊຸດສະເໝີ, ໃຊ້ 4 ຊຸດຖ້າລາຍການໜ້ອຍ ເພາະ viewport ອາດກວ້າງກວ່າ 1 ຊຸດ
    const setsNeeded = items.length < 6 ? 4 : 3;
    let html = '';
    for (let i = 0; i < setsNeeded; i++) items.forEach((it) => { html += cardHTML(it); });
    track.innerHTML = html;
    carousel.style.display = '';

    const SPEED_PX_PER_SEC = 40; // ຢູ່ໃນຊ່ວງ 30-50 ຕາມທີ່ຮ້ອງຂໍ
    let oneSetWidth = 0;
    let offset = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartOffset = 0;
    let lastTs = null;
    let resumeTimer = null;
    let autoPaused = false;
    let rafId = null;

    function measure() {
      const cards = track.children;
      const perSet = items.length;
      if (cards.length < perSet + 1) return;
      oneSetWidth = cards[perSet].offsetLeft - cards[0].offsetLeft;
    }

    function applyTransform() {
      track.style.transform = `translate3d(${-offset}px,0,0)`;
    }

    // ໄຫຼວົນທິດດຽວສະເໝີ (offset ວິ່ງໄປຂ້າງໜ້າເລື່ອຍໆ, ບໍ່ jump ກັບ 0)
    function normalizeOffset() {
      if (oneSetWidth <= 0) return;
      while (offset >= oneSetWidth) offset -= oneSetWidth;
      while (offset < 0) offset += oneSetWidth;
    }

    function tick(ts) {
      if (lastTs === null) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000); // clamp กัน dt กระโดดตอนสลับแท็บ/lag
      lastTs = ts;

      if (!isDragging && !autoPaused && oneSetWidth > 0) {
        offset += SPEED_PX_PER_SEC * dt;
        normalizeOffset();
        applyTransform();
      }
      rafId = requestAnimationFrame(tick);
    }

    function pointerDown(clientX) {
      isDragging = true;
      autoPaused = true;
      carousel.classList.add('dragging');
      dragStartX = clientX;
      dragStartOffset = offset;
      if (resumeTimer) clearTimeout(resumeTimer);
    }
    function pointerMove(clientX) {
      if (!isDragging) return;
      const dx = clientX - dragStartX;
      offset = dragStartOffset - dx;
      normalizeOffset();
      applyTransform();
    }
    function pointerUp() {
      if (!isDragging) return;
      isDragging = false;
      carousel.classList.remove('dragging');
      resumeTimer = setTimeout(() => { autoPaused = false; }, 600);
    }

    carousel.addEventListener('mousedown', (e) => { pointerDown(e.clientX); e.preventDefault(); });
    window.addEventListener('mousemove', (e) => pointerMove(e.clientX));
    window.addEventListener('mouseup', pointerUp);
    carousel.addEventListener('touchstart', (e) => pointerDown(e.touches[0].clientX), { passive: true });
    carousel.addEventListener('touchmove', (e) => pointerMove(e.touches[0].clientX), { passive: true });
    carousel.addEventListener('touchend', pointerUp);
    carousel.addEventListener('touchcancel', pointerUp);

    // ຢຸດ rAF ຕອນແທັບບໍ່ visible ແລ້ວຄ່ອຍເລີ່ມໃໝ່ຕອນກັບມາ -> ກັນ dt ໃຫຍ່ຜິດປົກກະຕິເຮັດໃຫ້ກະໂດດ
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
      } else if (!rafId) {
        lastTs = null;
        rafId = requestAnimationFrame(tick);
      }
    });

    // ResizeObserver: re-measure ອັດຕະໂນມັດທຸກຄັ້ງທີ່ຂະໜາດແຖບປ່ຽນ (ຮູບໂຫລດແລ້ວ/ໜ້າຈໍໝູນ/ font ໂຫລດ)
    // ແທນທີ່ຈະອີງແຕ່ window 'load'/'resize' ຢ່າງດຽວ ເຮັດໃຫ້ຄ່າ oneSetWidth ຖືກຕ້ອງແທ້ຕະຫຼອດ
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => measure());
      ro.observe(track);
    } else {
      window.addEventListener('resize', measure);
    }

    requestAnimationFrame(() => {
      measure();
      rafId = requestAnimationFrame(tick);
    });
  }

  try {
    const res = await fetch('/api/public/recent-purchases', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`recent-purchases endpoint responded ${res.status}`);
    const data = await res.json();
    const items = (data && data.items) || [];

    if (!items.length) {
      if (section) section.style.display = 'none'; // ບໍ່ມີການສັ່ງຊື້ຈິງເລີຍ -> ເຊື່ອງ section ນີ້ໄປ
      return;
    }
    initCarousel(items);
  } catch (err) {
    console.error('recent-purchases: fetch failed', err);
    if (section) section.style.display = 'none'; // ດຶງບໍ່ສຳເລັດ -> ເຊື່ອງໄວ້ ບໍ່ໂຊວ໌ carousel ພັງ/ຫວ່າງ
  }
});
