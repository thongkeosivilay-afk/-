/* =========================================================
   promo-popup.js — popup ໂປຣໂມຊັ່ນ ໂຊວ໌ຕອນເປີດໜ້າຫຼັກ (index.html)
   ຮູບ/ເປີດ-ປິດ ຕັ້ງຄ່າໄດ້ຈາກຫ້ອງແອດມິນ (admin.html -> ຕັ້ງຄ່າຮ້ານ -> Popup ໂປຣໂມຊັ່ນ)
   ດຶງຄ່າຈາກ /api/public/storefront -> store.promoPopup { enabled, image }
   ຖ້າລູກຄ້າກົດ "ບໍ່ໂຊວ໌ອີກ 1 ຊົ່ວໂມງ" ແລ້ວກົດປິດ -> ເກັບ timestamp ໄວ້ໃນ localStorage
   ຈະບໍ່ໂຊວ໌ popup ນີ້ອີກຈົນກວ່າຈະຄົບ 1 ຊົ່ວໂມງ
   ========================================================= */

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.StorefrontData) return;

  const HIDE_KEY = 'promoPopupHideUntil';
  const HIDE_DURATION_MS = 60 * 60 * 1000; // 1 ຊົ່ວໂມງ

  function isHiddenByUser() {
    const until = Number(localStorage.getItem(HIDE_KEY) || 0);
    return until && Date.now() < until;
  }

  if (isHiddenByUser()) return;

  let data;
  try {
    data = await window.StorefrontData.fetchData();
  } catch (err) {
    console.error('promo-popup: fetchData ບໍ່ສຳເລັດ', err);
    return;
  }

  const promo = data && data.store && data.store.promoPopup;
  if (!promo || !promo.enabled || !promo.image) return; // ແອດມິນຍັງບໍ່ໄດ້ເປີດ ຫຼື ຍັງບໍ່ໄດ້ໃສ່ຮູບ

  function escHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  const overlay = document.createElement('div');
  overlay.className = 'promo-popup-overlay';
  overlay.innerHTML = `
    <div class="promo-popup" role="dialog" aria-modal="true" aria-label="ໂປຣໂມຊັ່ນ">
      <button type="button" class="promo-popup-close" id="promoPopupCloseX" aria-label="ປິດ">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
      <div class="promo-popup-img-wrap">
        <img src="${escHtml(promo.image)}" alt="ໂປຣໂມຊັ່ນ">
      </div>
      <div class="promo-popup-footer">
        <label class="promo-popup-check-row">
          <input type="checkbox" id="promoPopupHideCheck">
          ບໍ່ໂຊວ໌ອີກ 1 ຊົ່ວໂມງ
        </label>
        <button type="button" class="promo-popup-close-all" id="promoPopupCloseAll">ປິດທັງໝົດ</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add('promo-popup-open');
  requestAnimationFrame(() => overlay.classList.add('show'));

  function closePopup() {
    const hideCheck = document.getElementById('promoPopupHideCheck');
    if (hideCheck && hideCheck.checked) {
      localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_DURATION_MS));
    }
    overlay.classList.remove('show');
    document.body.classList.remove('promo-popup-open');
    setTimeout(() => overlay.remove(), 250);
  }

  overlay.querySelector('#promoPopupCloseX').addEventListener('click', closePopup);
  overlay.querySelector('#promoPopupCloseAll').addEventListener('click', closePopup);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePopup(); // ກົດພື້ນທີ່ນອກກ່ອງ ໃຫ້ປິດ
  });
  document.addEventListener('keydown', function escListener(e) {
    if (e.key === 'Escape') {
      closePopup();
      document.removeEventListener('keydown', escListener);
    }
  });
});
