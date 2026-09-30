/* =========================================================
   page-loader.js — แสดงหน้าโหลด (โลโก้ + วงแหวนหมุน) ทุกหน้า
   วางไว้ใน <head> ก่อน เพื่อให้ขึ้นทันทีก่อนหน้าเว็บวาดเสร็จ
   ซ่อนเมื่อ: หน้าโหลดเสร็จ + ข้อมูลร้านจาก /api/public/storefront มาแล้ว
   (หรือครบเวลาสูงสุด 8 วินาที กันค้าง)
   ========================================================= */
(function () {
  var root = document.documentElement;
  var MIN_SHOW_MS = 450;   // โชว์อย่างน้อยเท่านี้ ไม่ให้วาบแล้วหาย
  var MAX_WAIT_MS = 8000;  // รอนานสุด แล้วเปิดหน้าให้เลย
  var start = Date.now();
  var done = false;

  var el = document.createElement('div');
  el.id = 'page-loader';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', 'Loading');
  el.innerHTML =
    '<div class="pl-stage">' +
      '<div class="pl-ring pl-ring-2"></div>' +
      '<div class="pl-ring"></div>' +
      '<img class="pl-logo" src="assets/logo.png" alt="">' +
    '</div>' +
    '<div class="pl-dots"><i></i><i></i><i></i></div>';

  root.classList.add('pl-lock');
  root.appendChild(el); // ใส่ที่ <html> ได้เลย ไม่ต้องรอ <body>

  function finish() {
    if (done) return;
    done = true;
    var wait = Math.max(0, MIN_SHOW_MS - (Date.now() - start));
    setTimeout(function () {
      // รอ 2 เฟรมให้เนื้อหาที่เพิ่งเติมวาดเสร็จก่อนค่อยเฟดออก
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          el.classList.add('pl-hide');
          root.classList.remove('pl-lock');
          setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 700);
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
      } else if (++tries > 40) { res(); }      // หน้านี้ไม่ได้ใช้ข้อมูลร้าน
      else setTimeout(poll, 50);
    })();
  });

  Promise.all([pageLoaded, dataReady]).then(function () {
    // เว้นจังหวะให้ script ของแต่ละหน้าเติมข้อมูลลง DOM ก่อน
    setTimeout(finish, 120);
  });

  // กด "ย้อนกลับ" แล้วหน้ากลับมาจาก bfcache -> อย่าให้ overlay ค้าง
  window.addEventListener('pageshow', function (e) {
    if (e.persisted && el.parentNode) { el.classList.add('pl-hide'); root.classList.remove('pl-lock'); }
  });
})();
