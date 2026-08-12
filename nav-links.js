// ============================================
// nav-links.js — จัดการปุ่มที่ต้องพาไปหน้าอื่น (แทน onclick="window.location.href='...'"
// ที่ย้ายออกมาเพื่อให้ CSP ไม่ต้องเปิด 'unsafe-inline' ให้ script)
// ใช้งาน: <button data-nav-href="index.html">...</button>
// ============================================
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-nav-href]').forEach(function (el) {
    el.addEventListener('click', function () {
      window.location.href = el.getAttribute('data-nav-href');
    });
  });
});
