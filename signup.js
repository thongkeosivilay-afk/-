/* signup.js — เอฟเฟกต์เสริมหน้าสมัคร (ไม่แตะตรรกะ API — ใช้ auth.js เดิม) */
(function () {
  // แท็บ "เข้าสู่ระบบ" / ลิงก์ล่าง: พก ?next= ไปด้วย
  var q = location.search;
  if (q) document.querySelectorAll('a[href="login.html"],a[href="signup.html"]').forEach(function (a) { a.href = a.getAttribute('href') + q; });

  // ช่องที่ผิด: สั่น + วงแสงแดง + ไอคอนกระดิก (เมื่อ auth.js เพิ่ม class has-error)
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function bump(f) {
    if (reduce) return;
    var box = f.querySelector('.field-input'), ic = f.querySelector('.field-input > svg');
    if (box && box.animate) box.animate([
      { transform: 'translateX(0)', boxShadow: '0 0 0 0 rgba(255,90,90,.6)' },
      { transform: 'translateX(-10px)', offset: .15 }, { transform: 'translateX(9px)', offset: .32 },
      { transform: 'translateX(-6px)', offset: .5 }, { transform: 'translateX(3px)', offset: .7 },
      { transform: 'translateX(0)', boxShadow: '0 0 0 12px rgba(255,90,90,0)' }
    ], { duration: 640, easing: 'cubic-bezier(.36,.07,.19,.97)' });
    if (ic && ic.animate) ic.animate([
      { transform: 'scale(1) rotate(0)' }, { transform: 'scale(1.4) rotate(-16deg)', offset: .25 },
      { transform: 'scale(1.15) rotate(10deg)', offset: .55 }, { transform: 'scale(1) rotate(0)' }
    ], { duration: 560, easing: 'ease-out' });
  }
  document.querySelectorAll('.field').forEach(function (f) {
    new MutationObserver(function (m) {
      if (f.classList.contains('has-error') && !f._had) bump(f);
      f._had = f.classList.contains('has-error');
    }).observe(f, { attributes: true, attributeFilter: ['class'] });
  });
  // ไฟสปอตตามนิ้ว/เมาส์ + คลื่นตอนกดปุ่มโซเชียล
  document.querySelectorAll('.social').forEach(function (b) {
    b.addEventListener('pointermove', function (e) { var r = b.getBoundingClientRect(); b.style.setProperty('--mx', (e.clientX - r.left) + 'px'); b.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    b.addEventListener('click', function (e) {
      if (reduce) return;
      var r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.4, x = e.clientX ? e.clientX - r.left : r.width / 2, y = e.clientX ? e.clientY - r.top : r.height / 2;
      var s = document.createElement('span'); s.className = 'rip'; s.style.cssText = 'left:' + (x - d / 2) + 'px;top:' + (y - d / 2) + 'px;width:' + d + 'px;height:' + d + 'px'; b.appendChild(s);
      var a = s.animate([{ transform: 'scale(0)', opacity: .9 }, { transform: 'scale(1)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' }); a.onfinish = function () { s.remove(); };
    });
  });
})();
