// home-trial.js — แสดงยอดเงินในชิปหัวเว็บของหน้าแรกแบบทดลอง (ใช้ /api/me เดียวกับ script.js)
(function () {
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
})();
