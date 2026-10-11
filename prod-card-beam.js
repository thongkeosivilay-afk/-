/* =========================================================
   prod-card-beam.js — แสงวิ่งรอบขอบการ์ด (.prod-card)
   เวอร์ชันเบา: ไม่มี requestAnimationFrame / ไม่เขียน style ทุกเฟรมแล้ว
   - อนิเมชั่นหมุนแสงเป็น CSS (@keyframes beam-spin ใน style.css)
   - ไฟล์นี้ทำแค่: ใช้ IntersectionObserver ใส่/เอา class "in-view" ให้การ์ดที่อยู่ในจอ
     (การ์ดนอกจอ = หยุดแอนิเมชั่น ไม่กินเครื่อง) + กระจายเฟสเริ่มต้นแต่ละใบ
     + จับ hover/touch เพื่อเปิดเอฟเฟกต์ .is-hot
   - MutationObserver ยังคอยผูกการ์ดที่ grid เรนเดอร์ใหม่เหมือนเดิม
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var bound = new WeakSet();
  var io = null;

  // style.css ปิดแสงวิ่ง (animation:none) เมื่อ <html> มี class perf-lite — page-transition.js ใส่ให้อัตโนมัติ
  // กับเครื่องที่ CPU <= 4 คอร์ / RAM <= 4GB (มือถือส่วนใหญ่เข้าข่าย) แสงเลยค้างนิ่งอยู่ที่เดิม
  // แสงนี้เป็น CSS ล้วน และวิ่งเฉพาะการ์ดที่อยู่ในจอ (class in-view) จึงเบาพอ -> เปิดให้วิ่งได้ทุกเครื่อง
  // (คนที่ตั้ง "ลดการเคลื่อนไหว" ในระบบยังคงนิ่งตามเดิม)
  if (!reduceMotion) {
    var fix = document.createElement('style');
    fix.setAttribute('data-beam-fix', '');
    fix.textContent =
      'html.perf-lite .prod-card::before{animation:beam-spin 3.6s linear infinite !important;' +
      'animation-delay:calc(var(--beam-i, 0) * -.6s) !important;animation-play-state:paused !important}' +
      'html.perf-lite .prod-card.in-view::before{animation-play-state:running !important}';
    (document.head || document.documentElement).appendChild(fix);
  }

  function setHot(el, hot) { el.classList.toggle('is-hot', hot); }

  function bindCard(el, index) {
    if (bound.has(el)) return;
    bound.add(el);
    el.style.setProperty('--beam-i', String(index % 6));

    if (reduceMotion) return;

    el.addEventListener('pointerenter', function () { setHot(el, true); });
    el.addEventListener('pointerleave', function () { setHot(el, false); });
    el.addEventListener('pointerdown', function () { setHot(el, true); });
    el.addEventListener('pointerup', function () { setHot(el, false); });
    el.addEventListener('pointercancel', function () { setHot(el, false); });

    if (io) io.observe(el);
    else el.classList.add('in-view');
  }

  function scan(root) {
    var cards = (root || document).querySelectorAll('.prod-card:not([data-beam-skip])');
    for (var i = 0; i < cards.length; i++) bindCard(cards[i], i);
  }

  function start() {
    var grid = document.querySelector('#prod-grid');
    if (!grid) return;

    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          entry.target.classList.toggle('in-view', entry.isIntersecting);
        });
      }, { rootMargin: '80px', threshold: 0 });
    }

    scan(grid);

    // grid ถูกเรนเดอร์ใหม่ (เช่นหลังเช็คราคาตัวแทน) -> ผูกการ์ดใบใหม่อัตโนมัติ
    new MutationObserver(function () { scan(grid); }).observe(grid, { childList: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
