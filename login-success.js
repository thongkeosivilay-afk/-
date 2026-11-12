/* login-success.js — การ์ด + เสียง หลัง login สำเร็จ
   ใช้: window.LoginSuccess.unlock() ตอนกดปุ่ม (ปลดล็อกเสียง)
        window.LoginSuccess.show() ตอน login สำเร็จ -> คืน Promise เมื่อการ์ดโชว์พอแล้ว */
(function () {
  var ctx = null;
  function unlock() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
  }
  // เสียง "ติ๊ง-ติ๊ง" สองโน้ตขึ้น (สังเคราะห์ ไม่ต้องใช้ไฟล์เสียง)
  function ding() {
    try {
      unlock();
      if (!ctx) return;
      var t0 = ctx.currentTime + 0.02;
      [[880, 0], [1318.5, 0.13]].forEach(function (n) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = n[0];
        var s = t0 + n[1];
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.35, s + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.7);
        o.connect(g); g.connect(ctx.destination);
        o.start(s); o.stop(s + 0.75);
      });
    } catch (e) {}
  }
  function show(opts) {
    opts = opts || {};
    var el = document.querySelector('.login-ok');
    if (!el) {
      el = document.createElement('div');
      el.className = 'login-ok';
      el.setAttribute('role', 'status');
      el.innerHTML =
        '<div class="lok-ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg></div>' +
        '<div><div class="lok-t"></div><div class="lok-s"></div></div>';
      document.body.appendChild(el);
    }
    el.querySelector('.lok-t').textContent = opts.title || 'ເຂົ້າສູ່ລະບົບສຳເລັດ';
    el.querySelector('.lok-s').textContent = opts.sub || 'ກຳລັງໂຫຼດ...';
    void el.offsetWidth;
    el.classList.add('show');
    ding();
    return new Promise(function (r) { setTimeout(r, opts.hold || 1500); });
  }
  window.LoginSuccess = { unlock: unlock, show: show };
})();
