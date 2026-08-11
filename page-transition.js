/* =========================================================
   page-transition.js
   ควบคุมแอนิเมชั่นตอนสลับหน้า (คู่กับ page-transition.css)
   - หน้าใหม่: เล่นแอนิเมชั่นเข้าอัตโนมัติผ่าน CSS (ไม่ต้องรอ JS)
   - คลิกลิงก์ภายในเว็บ: เล่นแอนิเมชั่นออกก่อน แล้วค่อยเปลี่ยนหน้าจริง
   - ใช้ transform/opacity ล้วนๆ กัน jank และเคารพ prefers-reduced-motion
   ========================================================= */
(function () {
  var EXIT_MS = 320; // ต้องตรงกับ .pt-exit ใน page-transition.css

  var wrapper = document.querySelector('.shell, .auth-shell');
  if (!wrapper) return;

  var navigating = false;

  // เคลียร์ will-change หลังแอนิเมชั่น "เข้า" จบ กันค้าง GPU layer ทิ้งไว้เฉยๆ
  wrapper.addEventListener('animationend', function (e) {
    if (e.target === wrapper) wrapper.style.willChange = 'auto';
  });

  // ถ้าเบราว์เซอร์ดึงหน้านี้กลับมาจาก bfcache (เช่นกดปุ่มย้อนกลับ)
  // ระหว่างที่ค้างสถานะ "กำลังจางออก" อยู่ ให้รีเซ็ตกลับมาเห็นปกติทันที
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      navigating = false;
      wrapper.classList.remove('pt-exit');
      wrapper.style.opacity = '';
      wrapper.style.transform = '';
      wrapper.style.willChange = 'auto';
    }
  });

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return; // ผู้ใช้ปิดโมชั่นไว้ในระบบ — ไม่ต้อง intercept การคลิกเลย

  document.addEventListener('click', function (e) {
    if (navigating) { e.preventDefault(); return; }
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var a = e.target.closest('a[href]');
    if (!a) return;
    if (a.hasAttribute('data-no-transition')) return;
    if (a.hasAttribute('download')) return;
    if (a.target && a.target !== '' && a.target !== '_self') return;

    var href = a.getAttribute('href');
    if (!href || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0 || href.indexOf('javascript:') === 0) return;

    var url;
    try { url = new URL(href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin) return;

    // แค่กระโดดไป #hash ในหน้าเดิม ไม่ต้องเล่นแอนิเมชั่นสลับหน้า
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;

    e.preventDefault();
    navigating = true;
    wrapper.style.willChange = 'transform, opacity';
    wrapper.classList.add('pt-exit');
    setTimeout(function () { location.href = href; }, EXIT_MS);
  });
})();
