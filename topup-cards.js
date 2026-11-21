/* topup-cards.js — ควบคุมการ์ดเลือกวิธีเติมเงิน + แผ่นเลือกจำนวนเงิน
   ทำงานร่วมกับ topup.js เดิม: ใช้ปุ่ม .topup-method (ซ่อนอยู่) เป็นตัวตั้งค่า selectedBank ให้ */
(function () {
  'use strict';
  var grid = document.getElementById('tcGrid');
  var sheet = document.getElementById('tcSheet');
  var overlay = document.getElementById('tcOverlay');
  var closeBtn = document.getElementById('tcClose');
  var stepAmount = document.getElementById('topupStepAmount');
  var custom = document.getElementById('topupCustomAmount');
  if (!grid || !sheet || !overlay) return;

  var toast = null, toastT = null, revealed = false;
  function say(msg) {
    if (!toast) { toast = document.createElement('div'); toast.className = 'tc-toast'; document.body.appendChild(toast); }
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove('show'); }, 2600);
  }

  function legacyHidden(btn) {
    return !btn || btn.classList.contains('u-hidden') || btn.style.display === 'none';
  }

  function openSheet(bank, imgSrc) {
    var legacy = document.querySelector('.topup-method[data-bank="' + bank + '"]');
    if (legacyHidden(legacy)) { say('ວິທີນີ້ຍັງບໍ່ເປີດໃຫ້ບໍລິການ'); return; }
    legacy.click(); // ໃຫ້ topup.js ຕັ້ງ selectedBank + ຂໍ້ຄວາມທະນາຄານ
    var icon = sheet.querySelector('.topup-card-icon img');
    if (icon && imgSrc) icon.src = imgSrc;
    if (!revealed && custom) { revealed = true; custom.dispatchEvent(new Event('focus')); } // ເປີດຕົວເລືອກຈຳນວນເງິນທັງໝົດ
    sheet.classList.add('open'); overlay.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('tc-lock');
    sheet.scrollTop = 0;
  }
  function closeSheet() {
    sheet.classList.remove('open'); overlay.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('tc-lock');
  }

  grid.addEventListener('click', function (e) {
    var btn = e.target.closest('.tc-btn');
    if (!btn) return;
    if (btn.hasAttribute('data-tc-soon')) { say('ວິທີນີ້ກຳລັງຈະເປີດໃຫ້ບໍລິການໃນໄວໆນີ້'); return; }
    var img = btn.closest('.tc-card').querySelector('.tc-img img');
    openSheet(btn.getAttribute('data-tc-bank'), img && img.getAttribute('src'));
  });
  overlay.addEventListener('click', closeSheet);
  if (closeBtn) closeBtn.addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

  // ເມື່ອ topup.js ສະຫຼັບໄປຂັ້ນຕອນ QR (ເຊື່ອງ step ນີ້) ໃຫ້ປິດແຜ່ນອັດຕະໂນມັດ
  if (stepAmount && window.MutationObserver) {
    new MutationObserver(function () {
      if (stepAmount.classList.contains('u-hidden')) closeSheet();
    }).observe(stepAmount, { attributes: true, attributeFilter: ['class'] });
  }

  // ເອຟເຟັກ 3D ເອຍງຕາມນິ້ວ/ເມົາສ໌ ຢູ່ຮູບການ໌ດ
  [].forEach.call(grid.querySelectorAll('.tc-img'), function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.setProperty('--ry', (x * 28) + 'deg'); el.style.setProperty('--rx', (-y * 28) + 'deg');
    });
    el.addEventListener('pointerleave', function () { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); });
  });
})();
