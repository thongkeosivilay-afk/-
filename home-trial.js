// home-trial.js — ธีมสว่าง/มืด + ยอดเงินในชิปหัวเว็บ (หน้าแรกแบบทดลอง)
// โหลดใน <head> แบบไม่ defer เพื่อตั้งธีมก่อนวาดหน้า (ไม่ให้จอวูบสีดำ)
(function () {
  var KEY = 'dk-theme', root = document.documentElement;
  var SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  var MOON = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';

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
    fetch('/api/me', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.loggedIn && d.user) {
          txt.textContent = Number(d.user.balance || 0).toLocaleString('en-US') + ' ₭';
          chip.setAttribute('href', 'topup.html');
        }
      })
      .catch(function () {});
  });
})();
