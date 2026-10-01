/* =========================================================
   page-loader.js — แสดงหน้าโหลด (โลโก้ + วงแหวนหมุน) ทุกหน้า
   วางไว้ใน <head> บนสุด เพื่อให้ขึ้นทันทีก่อนหน้าเว็บวาดเสร็จ
   ซ่อนเมื่อ: หน้าโหลดเสร็จ + ข้อมูลร้านจาก /api/public/storefront มาแล้ว
   (หรือครบเวลาสูงสุด 8 วินาที กันค้าง)
   ตอนจบ: เล่นแอนิเมชั่น "โหลดเสร็จ" (คลื่นกระแทก + พื้นหลังแยกบน/ล่างเผยหน้าเว็บ)
   ========================================================= */
(function () {
  var root = document.documentElement;
  var MIN_SHOW_MS = 300;   // โชว์อย่างน้อยเท่านี้ ไม่ให้วาบแล้วหาย
  var MAX_WAIT_MS = 8000;  // รอนานสุด แล้วเปิดหน้าให้เลย
  var EXIT_MS = 760;       // ความยาวแอนิเมชั่นจบ (ต้องมากกว่า .24s delay + .48s ใน page-loader.css)
  var start = Date.now();
  var done = false;
  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // สร้าง overlay — แชร์ให้ page-transition.js เรียกใช้ตอนกดลิงก์ด้วย (หน้าตาเดียวกันเป๊ะ)
  function build() {
    var el = document.createElement('div');
    el.id = 'page-loader';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', 'Loading');
    el.innerHTML =
      '<div class="pl-panel pl-top"></div>' +
      '<div class="pl-panel pl-bottom"></div>' +
      '<div class="pl-seam"></div>' +
      '<div class="pl-stage">' +
        '<div class="pl-ring pl-ring-2"></div>' +
        '<div class="pl-ring"></div>' +
        '<img class="pl-logo" src="assets/logo.png" alt="">' +
      '</div>' +
      '<div class="pl-dots"><i></i><i></i><i></i></div>';
    return el;
  }
  window.__plBuild = build;

  var el = build();
  root.classList.add('pl-lock');
  root.appendChild(el); // ใส่ที่ <html> ได้เลย ไม่ต้องรอ <body>

  function remove() { if (el.parentNode) el.parentNode.removeChild(el); }

  function finish() {
    if (done) return;
    done = true;
    var wait = Math.max(0, MIN_SHOW_MS - (Date.now() - start));
    setTimeout(function () {
      // รอ 2 เฟรมให้เนื้อหาที่เพิ่งเติมวาดเสร็จก่อนค่อยเริ่มแอนิเมชั่นจบ
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          // ปลดล็อกการเลื่อนทันที — หน้าพร้อมใช้งานตั้งแต่เริ่มเปิด ไม่ต้องรอแอนิเมชั่นจบ
          root.classList.remove('pl-lock');
          if (reduced) {
            el.classList.add('pl-hide');
            setTimeout(remove, 400);
          } else {
            el.classList.add('pl-exit');
            setTimeout(remove, EXIT_MS);
            // กันเหนียว: ถ้าแท็บอยู่เบื้องหลังแล้ว timer ช้า ก็ยังเอาออกแน่ๆ
            setTimeout(remove, EXIT_MS + 1500);
          }
        });
      });
    }, wait);
  }

  // กันค้างสูงสุด
  setTimeout(finish, MAX_WAIT_MS);

  var pageLoaded = new Promise(function (res) {
    if (document.readyState === 'complete') res();
    else window.addEventListener('load', res);
  });

  // รอข้อมูลร้าน (ถ้าหน้านั้นใช้) — สำเร็จหรือพลาดก็ถือว่า "เสร็จ" จะได้ไม่ค้าง
  var dataReady = new Promise(function (res) {
    var tries = 0;
    (function poll() {
      if (window.StorefrontData && window.StorefrontData.fetchData) {
        window.StorefrontData.fetchData().then(res, res);
      } else if (++tries > 100) { res(); }      // หน้านี้ไม่ได้ใช้ข้อมูลร้าน
      else setTimeout(poll, 20);
    })();
  });

  Promise.all([pageLoaded, dataReady]).then(function () {
    // เว้นจังหวะให้ script ของแต่ละหน้าเติมข้อมูลลง DOM ก่อน
    setTimeout(finish, 30);
  });

  // กด "ย้อนกลับ" แล้วหน้ากลับมาจาก bfcache -> อย่าให้ overlay ค้าง
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { remove(); root.classList.remove('pl-lock'); }
  });
})();
