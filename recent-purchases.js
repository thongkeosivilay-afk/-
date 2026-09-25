/* =========================================================
   recent-purchases.js — ແຖບ "ສິນຄ້າທີ່ຊື້ລ່າສຸດ" ໃນ index.html
   ດຶງລາຍການສັ່ງຊື້ຈິງລ່າສຸດຈາກ GET /api/public/recent-purchases (ເບິ່ງ
   handleRecentPurchases ໃນ src/index.js) ແລ້ວສ້າງແຖບ carousel ທີ່ໄຫຼ
   ອັດຕະໂນມັດຈາກຂວາ -> ຊ້າຍແບບວົນຕໍ່ເນື່ອງ (ບໍ່ມີຈັງຫວະກະໂດດກັບຕົ້ນລາຍການ)

   ການໄຫຼແມ່ນຂັບເຄື່ອນດ້ວຍ CSS @keyframes ລ້ວນໆ (ເບິ່ງ .rp-track ໃນ
   style.css) — JS ມີໜ້າທີ່ພຽງແຕ່ດຶງຂໍ້ມູນ, ສ້າງ HTML ຂອງການ໌ດ ແລະ ຄຳນວນ
   ຄວາມໄວ (--rp-duration) ຄັ້ງດຽວຕອນເລີ່ມ ບໍ່ມີ loop ຂອງ JS ວິ່ງຕະຫຼອດເວລາອີກ

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
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.productName)}" width="42" height="42" loading="lazy" decoding="async">`
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
        <div class="rp-thumb">
          ${media}
          <span class="rp-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </span>
        </div>
        <div class="rp-info">
          <div class="rp-name">${escapeHtml(item.productName)}</div>
          ${buyerRow}
          <div class="rp-time" data-created="${escapeHtml(item.createdAt || '')}">${escapeHtml(timeAgoLabel(item.createdAt))}</div>
        </div>
      </div>`;
  }

  // ອັບເດດ "X ນາທີກ່ອນ" ໃຫ້ຍັງເປັນປັດຈຸບັນຢູ່ສະເໝີໂດຍບໍ່ຕ້ອງໂຫລດໜ້າໃໝ່
  function refreshTimeLabels() {
    track.querySelectorAll('.rp-time[data-created]').forEach((el) => {
      const iso = el.getAttribute('data-created');
      if (iso) el.textContent = timeAgoLabel(iso);
    });
  }

  function initCarousel(items) {
    // ຊ້ຳຫຼາຍຊຸດຕໍ່ກັນເປັນແຖບຍາວ -> ໄຫຼວົນແບບບໍ່ມີຮອຍຕໍ່ (ບໍ່ຕ້ອງ "ກະໂດດ" ກັບຈຸດເລີ່ມຕົ້ນ)
    // ຢ່າງໜ້ອຍ 2 ຊຸດສະເໝີ, ໃຊ້ 4 ຊຸດຖ້າລາຍການໜ້ອຍ ເພາະ viewport ອາດກວ້າງກວ່າ 1 ຊຸດ
    const cycles = items.length < 6 ? 4 : 3;
    let html = '';
    for (let i = 0; i < cycles; i++) items.forEach((it) => { html += cardHTML(it); });
    track.innerHTML = html;
    // ໝາຍເຫດ: ຕ້ອງ remove('u-hidden') ນຳ ບໍ່ແມ່ນແຄ່ລຶບ inline style ຢ່າງດຽວ — index.html ໃສ່
    // class="rp-carousel u-hidden" ໄວ້ຕັ້ງແຕ່ຕົ້ນ (ເຊື່ອງໄວ້ກ່ອນຈົນກວ່າຈະຮູ້ວ່າມີຂໍ້ມູນຈິງ) ແລະ
    // .u-hidden{display:none} ໃນ style.css ຍັງມີຜົນຢູ່ຕໍ່ໄປແມ້ style.display ຈະຖືກຕັ້ງເປັນ '' —
    // ຖ້າບໍ່ລຶບ class ນີ້ອອກ ແຖບ "ສິນຄ້າທີ່ຊື້ລ່າສຸດ" ຈະຄ້າງເຊື່ອງຢູ່ຕະຫຼອດ ບໍ່ວ່າຈະມີຂໍ້ມູນຈິງຫຼືບໍ່
    carousel.classList.remove('u-hidden');
    carousel.style.display = '';

    // ໄຫຼດ້ວຍ CSS @keyframes (ເບິ່ງ .rp-track ໃນ style.css) ແທນ JS requestAnimationFrame loop
    // ເກົ່າ — browser ຮັນ animation ນີ້ຢູ່ compositor thread ແຍກ, ຈຶ່ງບໍ່ກະຕຸກເມື່ອ main thread
    // ມີວຽກອື່ນ (fetch, ຮູບກຳລັງໂຫລດ, scroll ໜ້າ) ແລະ ບໍ່ຕ້ອງວັດຂະໜາດດ້ວຍ JS ເລີຍ ເພາະການ໌ດ
    // ແຕ່ລະໃບກຳນົດຄວາມກວ້າງໄວ້ຄົງທີ່ໃນ CSS ແລ້ວ (.rp-card{width:196px}) — ໃຊ້ %/var() ແທນ px ຈຶ່ງ
    // ບໍ່ຂຶ້ນກັບການວັດ offsetLeft ທີ່ອາດຄາດເຄື່ອນຕອນຮູບຍັງບໍ່ທັນໂຫລດແລ້ວເຮັດໃຫ້ layout ສັ່ນ
    const CARD_W = 196, GAP = 12, SPEED_PX_PER_SEC = 90;
    const secondsPerCard = (CARD_W + GAP) / SPEED_PX_PER_SEC;
    const duration = Math.max(10, items.length * secondsPerCard);
    track.style.setProperty('--rp-cycles', String(cycles));
    track.style.setProperty('--rp-duration', `${duration.toFixed(2)}s`);

    // ໝາຍເຫດ: ບໍ່ມີ touchmove preventDefault ອີກຕໍ່ໄປ — ອັນນັ້ນແມ່ນຕົ້ນເຫດທີ່ເຮັດໃຫ້ໜ້າຈໍ "ຄ້າງ"
    // ຕອນຜູ້ໃຊ້ພະຍາຍາມເລື່ອນໜ້າ (scroll ແນວຕັ້ງ) ໂດຍນິ້ວເລີ່ມແຕະຢູ່ເທິງແຖບນີ້ — touch-action:pan-y
    // ໃນ CSS ພຽງພໍແລ້ວທີ່ຈະບໍ່ໃຫ້ລາກລວງແຖວນອນໄດ້ ໂດຍບໍ່ໄປກີດຂວາງການເລື່ອນໜ້າແນວຕັ້ງ
    carousel.addEventListener('dragstart', (e) => e.preventDefault());

    setInterval(refreshTimeLabels, 30000); // ອັບເດດປ້າຍເວລາທຸກ 30 ວິນາທີ
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
