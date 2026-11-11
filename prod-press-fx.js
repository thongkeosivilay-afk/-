/* =========================================================
   prod-press-fx.js (ทดลอง v6) — เอฟเฟกต์ตอนกดค้างการ์ดสินค้า
   - event delegation บน document เดียว: ครอบคลุมการ์ดที่เรนเดอร์ทีหลังทุกหน้า
   - สร้าง overlay (.ppx) ใน .prod-media ครั้งแรกที่กดการ์ดนั้นเท่านั้น
   - เอฟเฟกต์ค้างอยู่ตราบที่ยังกดอยู่ แม้เลื่อนแคโรเซลไปด้วย (ใช้ touchend แทน pointercancel
     เพราะ pointercancel ยิงทันทีที่เบราว์เซอร์เริ่ม scroll ทำให้เอฟเฟกต์หายกลางทาง)
   - ปิดเองเมื่อผู้ใช้ตั้ง prefers-reduced-motion
   ========================================================= */
(function () {
  'use strict';
  if (window.__ppxInit) return; window.__ppxInit = true;

  var LOGO = 'assets/logo.png';
  var HOLD_DELAY = 60;   // ms ก่อนเริ่ม กันกะพริบตอนแค่เลื่อนผ่าน
  var MIN_SHOW = 380;    // ms แตะสั้นก็โชว์อย่างน้อยเท่านี้
  var cur = null, timer = null, offTimer = null, shownAt = 0;

  // จำนวนวงโคจร: ตั้งก่อนโหลดไฟล์นี้ด้วย  window.PPX = {orbits:4} ใน script แยก  (1-6, ค่าเริ่มต้น 3)
  var CFG = window.PPX = window.PPX || {};
  if (!CFG.orbits) CFG.orbits = 3;
  // สี [หัวแสง, กลาง, หาง, เส้นฐาน] ของแต่ละวง (วนซ้ำถ้ามีมากกว่า 6)
  var PAL = [
    ['#ff6a58', '#ff2a1c', '#b00008', 'rgba(255,40,30,.95)'],
    ['#ff6258', '#ff1f2a', '#a00010', 'rgba(255,36,36,.95)'],
    ['#ff6a58', '#ff3020', '#c00000', 'rgba(255,50,30,.95)'],
    ['#ffd0c8', '#ff2a2a', '#b00010', 'rgba(255,40,40,.95)'],
    ['#ffb8b0', '#ff1a14', '#a80000', 'rgba(255,30,24,.95)'],
    ['#ffc8c0', '#ff3a2a', '#b81010', 'rgba(255,60,40,.95)']
  ];
  var ANG = [0, 68, -68, 34, -34, 90];   // มุมของแต่ละวง (องศา)
  function orbitsHTML(n) {
    n = Math.max(1, Math.min(6, Math.round(n) || 3));
    var h = '';
    for (var i = 0; i < n; i++) {
      var c = PAL[i % PAL.length];
      var oz = ANG[i % ANG.length];
      h += '<i class="ppx-orbit" style="--oz:' + oz.toFixed(1) + 'deg;--h:' + c[0] + ';--m:' + c[1] + ';--t:' + c[2] +
        ';--line:' + c[3] + ';--k:' + (1 + i * 0.27).toFixed(2) + ';--dl:-' + (i * 0.55).toFixed(2) + 's;--dir:' +
        (i % 2 === 1 ? 'reverse' : 'normal') + '"></i>';
    }
    return h;
  }
  function build() {
    var d = document.createElement('div');
    d.className = 'ppx';
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<div class="ppx-tint"></div><div class="ppx-fx"><div class="ppx-atom">' + orbitsHTML(CFG.orbits) +
      '<img class="ppx-logo" alt="" draggable="false" src="' + LOGO + '"></div></div>';
    return d;
  }
  // เปลี่ยนจำนวนวงขณะรัน (ใช้ในหน้าปรับแต่ง)
  function setOrbits(n) {
    CFG.orbits = n;
    document.querySelectorAll('.ppx-atom').forEach(function (a) {
      a.querySelectorAll('.ppx-orbit').forEach(function (o) { o.parentNode.removeChild(o); });
      a.insertAdjacentHTML('afterbegin', orbitsHTML(n));
    });
  }
  function on(card) {
    var media = card.querySelector('.prod-media');
    if (!media) return;
    if (!media.querySelector(':scope > .ppx')) media.appendChild(build());
    clearTimeout(offTimer);
    shownAt = Date.now();
    card.classList.add('ppx-on');
  }
  function off(card, now) {
    clearTimeout(timer);
    if (!card || !card.classList.contains('ppx-on') || card.hasAttribute('data-ppx-lock')) return;
    clearTimeout(offTimer);
    var wait = now ? 0 : Math.max(0, MIN_SHOW - (Date.now() - shownAt));
    offTimer = setTimeout(function () { card.classList.remove('ppx-on'); }, wait);
  }
  function down(target) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var card = target.closest && target.closest('.prod-card');
    if (!card) return;
    if (cur && cur !== card) off(cur, true);
    cur = card;
    clearTimeout(timer);
    timer = setTimeout(function () { if (cur === card) on(card); }, HOLD_DELAY);
  }
  function up() { var c = cur; cur = null; off(c, false); }

  window.__ppx = { on: on, setOrbits: setOrbits };

  var P = { passive: true };
  // เมาส์ / ปากกา
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') return;
    if (e.button !== 0) return;
    down(e.target);
  }, P);
  document.addEventListener('pointerup', function (e) { if (e.pointerType !== 'touch') up(); }, P);
  document.addEventListener('pointercancel', function (e) { if (e.pointerType !== 'touch') up(); }, P);
  // นิ้ว: touchend ยิงตอนยกนิ้วจริง แม้ระหว่างนั้นจะเลื่อนหน้า
  document.addEventListener('touchstart', function (e) { down(e.target); }, P);
  document.addEventListener('touchend', up, P);
  document.addEventListener('touchcancel', up, P);
  window.addEventListener('pagehide', function () {
    document.querySelectorAll('.prod-card.ppx-on:not([data-ppx-lock])').forEach(function (c) { c.classList.remove('ppx-on'); });
  });
})();
