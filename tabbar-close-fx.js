/* =========================================================
   tabbar-close-fx.js — ตัวควบคุมอนิเมชั่น "ปิดแถบเมนูด้านล่าง"
   เรียกจาก script.js:  TabbarFX.close(bar, loginBtn)  /  TabbarFX.cancel(bar)
   - close() คืน true ถ้าเล่นอนิเมชั่น, false ถ้าไม่เล่น (เช่นผู้ใช้เปิด "ลดการเคลื่อนไหว")
   - ใช้ Web Animations API กับ transform / opacity เท่านั้น -> ลื่น ไม่กระตุก
   - ทุกอย่างอยู่ในชั้น .tbc-layer ชั้นเดียว เสร็จแล้วลบทิ้งทั้งก้อน ไม่ทิ้งขยะใน DOM
   ========================================================= */
(function () {
  'use strict';

  var T_LINE = 340;   // ms: แถบบีบเป็นเส้นแสง
  var T_DOT = 500;    // ms: เส้นหดเป็นจุด -> ลูกไฟออกเดินทาง
  var BAR_MS = 680;   // ms: ลบ class .closing ออกจากแถบ

  var ORB_SIZE = [26, 22, 18, 15, 12, 9, 7];
  var ORB_OPA  = [1, .85, .7, .55, .42, .3, .2];
  var ORB_STEP = 34;  // ms: หน่วงหางแต่ละลูก

  var state = null;

  function reduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function div(cls, parent) {
    var d = document.createElement('div');
    d.className = cls;
    parent.appendChild(d);
    return d;
  }

  function cancel(bar) {
    if (!state) { if (bar) bar.classList.remove('closing'); return; }
    var s = state;
    state = null;
    s.timers.forEach(clearTimeout);
    s.anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    if (s.layer.parentNode) s.layer.parentNode.removeChild(s.layer);
    (bar || s.bar).classList.remove('closing');
  }

  function close(bar, btn) {
    if (!bar || !btn || reduced() || !bar.animate) return false;
    cancel(bar);

    // วัดตำแหน่ง "ก่อน" ใส่ class closing (ตอนนี้แถบยังอยู่ในสถานะเปิดเต็ม)
    var br = bar.getBoundingClientRect();
    var rr = btn.getBoundingClientRect();
    var cx = br.left + br.width / 2, cy = br.top + br.height / 2;
    var bx = rr.left + rr.width / 2, by = rr.top + rr.height / 2;
    var dx = bx - cx, dy = by - cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var fly = Math.min(760, Math.max(480, dist * 0.55)); // ระยะบินยิ่งไกล ยิ่งนานขึ้นนิดหน่อย
    var Ta = T_DOT + fly;                                  // เวลาที่หัวลูกไฟถึงปุ่ม

    var anims = [], timers = [];
    function A(target, kf, opt) {
      var a = target.animate(kf, opt);
      anims.push(a);
      return a;
    }

    // ตั้งจำนวนไอคอนให้ CSS คำนวณลำดับไล่หุบ แล้วเริ่มเฟสแรก
    var count = bar.querySelectorAll('.tabbar-item').length;
    bar.style.setProperty('--n', String(count));
    bar.classList.add('closing');

    var layer = document.createElement('div');
    layer.className = 'tbc-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);

    /* ---------- ประกายไฟ ---------- */
    function spark(x, y, sx, sy, delay, dur) {
      var sz = rand(3, 6);
      var s = div('tbc-spark', layer);
      s.style.cssText = 'left:' + (x - sz / 2) + 'px;top:' + (y - sz / 2) + 'px;width:' + sz + 'px;height:' + sz + 'px;' +
        (Math.random() < 0.4 ? 'background:#fff;' : '');
      A(s, [
        { opacity: 1, transform: 'translate(0,0) scale(1)' },
        { opacity: 1, transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.9)', offset: 0.55 },
        { opacity: 0, transform: 'translate(' + (sx * 1.15) + 'px,' + (sy + 38) + 'px) scale(0)' }
      ], { delay: delay, duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    }
    function burst(x, y, n, rMin, rMax, delay) {
      for (var i = 0; i < n; i++) {
        var ang = rand(0, Math.PI * 2), r = rand(rMin, rMax);
        spark(x, y, Math.cos(ang) * r, Math.sin(ang) * r, delay + rand(0, 50), rand(460, 720));
      }
    }

    /* ---------- วงคลื่น ---------- */
    function ring(x, y, size, delay, dur, s0, s1) {
      var r = div('tbc-ring', layer);
      r.style.cssText = 'left:' + (x - size / 2) + 'px;top:' + (y - size / 2) + 'px;width:' + size + 'px;height:' + size + 'px;';
      A(r, [
        { opacity: 0.95, transform: 'scale(' + s0 + ')' },
        { opacity: 0, transform: 'scale(' + s1 + ')' }
      ], { delay: delay, duration: dur, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards' });
    }

    /* ---------- 2) เส้นแสงตอนแถบบีบแบน แล้วหดเป็นจุด ---------- */
    var line = div('tbc-line', layer);
    line.style.cssText = 'left:' + br.left + 'px;top:' + (cy - 1.5) + 'px;width:' + br.width + 'px;';
    A(line, [
      { opacity: 1, transform: 'scale(1,1)' },
      { opacity: 1, transform: 'scale(.92,1.9)', offset: 0.3 },
      { opacity: 1, transform: 'scale(.03,1.2)', offset: 0.92 },
      { opacity: 0, transform: 'scale(.03,1.2)' }
    ], { delay: T_LINE, duration: T_DOT - T_LINE + 20, easing: 'cubic-bezier(.6,0,.9,.5)', fill: 'forwards' });

    // ประกายพุ่งขึ้นจากเส้นแสง
    for (var i = 0; i < 12; i++) {
      spark(br.left + rand(0.08, 0.92) * br.width, cy, rand(-26, 26), -rand(34, 96), T_LINE + rand(0, 110), rand(420, 650));
    }

    /* ---------- 3) จุดระเบิด: วงคลื่น + ประกายรอบทิศ ---------- */
    ring(cx, cy, 70, T_DOT, 540, 0.2, 2.8);
    burst(cx, cy, 12, 34, 86, T_DOT);

    /* ---------- 4) ลูกไฟ + หาง พุ่งโค้งไปหาปุ่มโปรไฟล์ ---------- */
    for (var k = 0; k < ORB_SIZE.length; k++) {
      (function (k) {
        var sz = ORB_SIZE[k], op = ORB_OPA[k], d = T_DOT + k * ORB_STEP;
        var o = div('tbc-orb', layer);
        o.style.cssText = 'left:' + (cx - sz / 2) + 'px;top:' + (cy - sz / 2) + 'px;width:' + sz + 'px;height:' + sz + 'px;';
        var m = div('tbc-orb-m', o);
        var c = div('tbc-orb-c', m);
        // X กับ Y ใช้ easing คนละแบบ -> เส้นทางโค้งเป็นธรรมชาติ (พุ่งขึ้นก่อน แล้วเฉไปหาปุ่ม)
        A(o, [{ transform: 'translateX(0px)' }, { transform: 'translateX(' + dx + 'px)' }],
          { delay: d, duration: fly, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' });
        A(m, [{ transform: 'translateY(0px)' }, { transform: 'translateY(' + dy + 'px)' }],
          { delay: d, duration: fly, easing: 'cubic-bezier(.2,.75,.3,1)', fill: 'forwards' });
        A(c, [
          { opacity: 0, transform: 'scale(.1)' },
          { opacity: op, transform: 'scale(1.4)', offset: 0.12 },
          { opacity: op, transform: 'scale(1)', offset: 0.8 },
          { opacity: 0, transform: 'scale(.2)' }
        ], { delay: d, duration: fly, easing: 'linear', fill: 'forwards' });
      })(k);
    }

    /* ---------- 5) ถึงปุ่มโปรไฟล์: วงคลื่น + ประกาย + ปุ่มเด้ง + รูปหมุน ---------- */
    ring(bx, by, 38, Ta, 560, 0.4, 3.4);
    ring(bx, by, 38, Ta + 120, 660, 0.4, 4.6);
    burst(bx, by, 10, 22, 56, Ta);

    A(btn, [
      { scale: '1' },
      { scale: '.84', offset: 0.2 },
      { scale: '1.14', offset: 0.55 },
      { scale: '.98', offset: 0.8 },
      { scale: '1' }
    ], { delay: Ta, duration: 620, easing: 'ease-out' });

    A(btn, [
      { boxShadow: '0 0 0 4px rgba(255,60,40,.55), 0 0 30px 8px rgba(255,0,1,.75)', offset: 0.25 }
    ], { delay: Ta, duration: 700, easing: 'ease-out' });

    var img = btn.querySelector('img');
    if (img) {
      A(img, [{ rotate: '0deg' }, { rotate: '360deg' }],
        { delay: Ta, duration: 760, easing: 'cubic-bezier(.2,1.3,.4,1)' });
    }

    /* ---------- เก็บกวาด ---------- */
    timers.push(setTimeout(function () { bar.classList.remove('closing'); }, BAR_MS));
    timers.push(setTimeout(function () { if (state && state.layer === layer) cancel(bar); }, Ta + 900));

    state = { bar: bar, layer: layer, anims: anims, timers: timers };
    return true;
  }

  window.TabbarFX = { close: close, cancel: cancel };
})();
