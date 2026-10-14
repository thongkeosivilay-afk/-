/* =========================================================
   maintenance-watch.js — ให้หน้าเว็บ "รู้เอง" ตอนปิด/เปิดเว็บ
   - หน้าลูกค้า: ถ้า API ตอบ 503 (maintenance) หรือเช็คสถานะแล้วเว็บปิด -> รีโหลดให้เห็นหน้าปิดปรับปรุง
     (เดิมหน้าที่เปิดค้างอยู่จะเจอ error แปลกๆ / ข้อมูลหาย จนกว่าจะกดรีเฟรชเอง)
   - หน้าปิดปรับปรุง (<html data-maintenance>): เช็คทุก ~20 วิ พอเว็บเปิดกลับมาก็พากลับเข้าเว็บอัตโนมัติ
   - แอดมินไม่โดนรีโหลดวน เพราะ /api/maintenance-status ตอบ blocked=false ให้แอดมิน
   ========================================================= */
(function () {
  if (window.__mtWatch) return;
  window.__mtWatch = true;
  if (!window.fetch) return;

  var STATUS_URL = '/api/maintenance-status';
  var onMaintPage = document.documentElement.hasAttribute('data-maintenance');
  var origFetch = window.fetch.bind(window);
  var checking = false;

  // กันรีโหลดวน: รีโหลดได้อย่างมากทุก 8 วินาที
  function reloadOnce() {
    try {
      var last = Number(sessionStorage.getItem('mt_reload')) || 0;
      if (Date.now() - last < 8000) return;
      sessionStorage.setItem('mt_reload', String(Date.now()));
    } catch (e) { /* sessionStorage ใช้ไม่ได้ก็ข้ามไป */ }
    location.reload();
  }

  function check() {
    if (checking || document.hidden) return;
    checking = true;
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
    origFetch(STATUS_URL + '?t=' + Date.now(), {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: ctl ? ctl.signal : undefined
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        if (onMaintPage ? d.blocked === false : d.blocked === true) reloadOnce();
      })
      .catch(function () { /* เน็ตกระตุก — รอบหน้าค่อยเช็คใหม่ */ })
      .then(function () { clearTimeout(timer); checking = false; });
  }

  // หน้าลูกค้า: ถ้ามี API ไหนตอบ 503 + maintenance:true ให้รีโหลดทันที
  if (!onMaintPage) {
    window.fetch = function () {
      return origFetch.apply(window, arguments).then(function (res) {
        try {
          if (res && res.status === 503 && (res.headers.get('content-type') || '').indexOf('json') > -1) {
            res.clone().json().then(function (d) {
              if (d && d.maintenance === true) reloadOnce();
            }).catch(function () {});
          }
        } catch (e) {}
        return res;
      });
    };
  }

  var every = onMaintPage ? 20000 : 60000;
  (function loop() {
    setTimeout(function () { check(); loop(); }, every + Math.random() * 5000);
  })();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) check(); }); // กดย้อนกลับ (bfcache)
  window.addEventListener('online', check);
})();
