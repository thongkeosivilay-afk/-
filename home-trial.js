// home-trial.js — ธีมสว่าง/มืด + ยอดเงินในชิปหัวเว็บ (หน้าแรกแบบทดลอง)
// โหลดใน <head> แบบไม่ defer เพื่อตั้งธีมก่อนวาดหน้า (ไม่ให้จอวูบสีดำ)
(function () {
  var KEY = 'dk-theme', root = document.documentElement;
  var SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  var MOON = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';

  // ยอดเงินย่อ: 49,000 -> 49K, 49,500 -> 49.5K, 1,250,000 -> 1.25M
  function short(n) {
    n = Number(n || 0);
    var a = Math.abs(n), v, u;
    if (a >= 1e9) { v = n / 1e9; u = 'B'; }
    else if (a >= 1e6) { v = n / 1e6; u = 'M'; }
    else if (a >= 1e3) { v = n / 1e3; u = 'K'; }
    else return String(Math.round(n));
    return String(Math.floor(Math.abs(v) * 100) / 100 * (v < 0 ? -1 : 1)) + u;
  }

  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(t) { try { localStorage.setItem(KEY, t); } catch (e) {} }

  function paint(t) {
    root.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    m.content = t === 'light' ? '#f5f5f8' : '#000000';
    var btn = document.getElementById('trialTheme');
    if (btn) {
      var svg = btn.querySelector('svg');
      if (svg) svg.innerHTML = t === 'light' ? MOON : SUN;
      btn.setAttribute('aria-label', t === 'light' ? 'ປ່ຽນເປັນໂໝດມືດ' : 'ປ່ຽນເປັນໂໝດສະຫວ່າງ');
    }
  }

  var theme = saved() === 'light' ? 'light' : 'dark';
  paint(theme);

  document.addEventListener('DOMContentLoaded', function () {
    paint(theme);
    var btn = document.getElementById('trialTheme');
    if (btn) btn.addEventListener('click', function () {
      theme = theme === 'light' ? 'dark' : 'light';
      save(theme); paint(theme);
    });

    var chip = document.getElementById('trialBal');
    var txt = document.getElementById('trialBalText');
    if (!chip || !txt) return;
    // ยังไม่รู้สถานะล็อกอิน -> ซ่อนชิปไว้ก่อน ไม่ให้เห็น "0 ₭" วูบหนึ่งแล้วค่อยเปลี่ยน
    chip.style.visibility = 'hidden';
    var icon = chip.querySelector('svg');
    var WALLET = icon ? icon.innerHTML : '';
    var USER = '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
    function showLoggedOut() {
      if (icon) icon.innerHTML = USER;
      txt.textContent = 'ລົງຊື່ເຂົ້າໃຊ້';
      chip.setAttribute('href', '/login.html');
      chip.setAttribute('aria-label', 'ລົງຊື່ເຂົ້າໃຊ້');
      chip.removeAttribute('title');
    }
    function showLoggedIn(u) {
      if (icon) icon.innerHTML = WALLET;
      txt.textContent = short(u.balance);
      chip.setAttribute('title', Number(u.balance || 0).toLocaleString('en-US') + ' ₭');
      chip.setAttribute('href', 'topup.html');
      chip.setAttribute('aria-label', 'ຍອດເງິນ');
    }
    fetch('/api/me', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.loggedIn && d.user) showLoggedIn(d.user); else showLoggedOut();
      })
      .catch(showLoggedOut)
      .then(function () { chip.style.visibility = ''; });
  });
})();
