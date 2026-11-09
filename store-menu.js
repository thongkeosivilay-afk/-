/* =========================================================
   store-menu.js — "ເມນູຮ້ານຄ້າ" ลิ้นชักเมนูแบบใหม่ (แทนแถบไอคอนด้านล่าง + การ์ดโปรไฟล์เดิม)
   เรียกใช้: window.StoreMenu.mount({ loginBtn, user:{username,avatar,isAdmin,isReseller,balance} })
   - กดปุ่มเมนูในหัวเว็บ -> ลิ้นชักเลื่อนเข้ามาจากขวา
   - ปิดได้ด้วย: ปุ่ม X, กดพื้นที่มืดด้านซ้าย, ปัดไปทางขวา, ปุ่ม Esc
   แก้ข้อความ/ลิงก์เมนูได้ที่ตัวแปร MAIN / ACCOUNT ด้านล่าง
   ========================================================= */
(function () {
  'use strict';

  var svg = function (d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  };
  var I = {
    home:   svg('<path d="M3.5 10.8 12 3.6l8.5 7.2V19a1.6 1.6 0 0 1-1.6 1.6H15v-5.4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5.4H5.100A1.600 1.600 0 0 1 3.500 19z"/>'),
    grid:   svg('<rect x="3.500" y="3.500" width="7" height="7" rx="1.800"/><rect x="13.500" y="3.500" width="7" height="7" rx="1.800"/><rect x="3.500" y="13.500" width="7" height="7" rx="1.800"/><rect x="13.500" y="13.500" width="7" height="7" rx="1.800"/>'),
    chart:  svg('<path d="M3 20.500h18"/><path d="M5.500 20.500v-4M9.500 20.500v-7M13.500 20.500v-5M17.500 20.500v-9"/><path d="m4 11 4.500-3.500 3.500 2.500L20 3.500"/><path d="M15.500 3.500H20V8"/>'),
    wallet: svg('<path d="M19 7V5.500A1.500 1.500 0 0 0 17.500 4H5.500A2.500 2.500 0 0 0 3 6.500v11A2.500 2.500 0 0 0 5.500 20h12a1.500 1.500 0 0 0 1.500-1.500V17"/><path d="M3 6.500A2.500 2.500 0 0 0 5.500 9H19.500A1.500 1.500 0 0 1 21 10.500V13"/><path d="M21 12.500v4h-3.800a2 2 0 0 1 0-4z"/>'),
    receipt:svg('<path d="M5.500 3.500h13v17l-2.200-1.500-2.100 1.500-2.200-1.500-2.200 1.500-2.100-1.500-2.200 1.500z" transform="translate(-.5 0)"/><path d="M9 8.500h6M9 12h6M9 15.500h3.500"/>'),
    card:   svg('<rect x="3" y="5.500" width="18" height="13" rx="2.500"/><path d="M3 10h18"/><path d="M6.500 14.500h3"/>'),
    user:   svg('<circle cx="12" cy="8" r="4"/><path d="M4.500 20.500a7.500 7.500 0 0 1 15 0"/>'),
    tag:    svg('<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.500" cy="6.500" r="2.500"/><circle cx="17.500" cy="17.500" r="2.500"/>'),
    shield: svg('<path d="M12 2.800 4 6v5.500c0 4.700 3.300 8.300 8 9.700 4.700-1.400 8-5 8-9.700V6z"/><path d="m9 12 2.200 2.200L15.500 10"/>'),
    chat:   svg('<path d="M20.500 11.500a7.800 7.800 0 0 1-.8 3.500 8 8 0 0 1-7.200 4.400 7.800 7.800 0 0 1-3.500-.8L3.500 20.500l1.900-5.200a7.800 7.800 0 0 1-.8-3.500 8 8 0 0 1 4.400-7.200 7.800 7.800 0 0 1 3.500-.8h.5a8 8 0 0 1 7.500 7.500z"/>'),
    out:    svg('<path d="M9.500 20.500H6A2 2 0 0 1 4 18.500v-13a2 2 0 0 1 2-2h3.500"/><path d="m16 16.500 4.500-4.500L16 7.500"/><path d="M20.500 12H9.500"/>'),
    x:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg>',
    right:  svg('<path d="m9 6 6 6-6 6"/>'),
    down:   svg('<path d="m6 9 6 6 6-6"/>'),
    plus:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.600" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  };

  /* ---------- รายการเมนู (แก้ข้อความ/ลิงก์ได้ที่นี่) ---------- */
  var MAIN = [
    { key: 'home',   label: 'ໜ້າຫຼັກ',        href: 'index.html',            icon: I.home },
    { key: 'shop',   label: 'ສິນຄ້າທັງໝົດ',   href: 'index.html#categories', icon: I.grid, chev: true },
    { key: 'rank',   label: 'ຈັດອັນດັບ',      href: 'leaderboard.html',      icon: I.chart, chev: true },
    { key: 'topup',  label: 'ເຕີມເງິນ',       icon: I.wallet, expand: [
        { label: 'ເຕີມເງິນຜ່ານ BCEL One', href: 'topup.html' },
        { label: 'ປະຫວັດການເຕີມເງິນ',     href: 'topup-history.html' }
      ] },
    { key: 'orders', label: 'ຄຳສັ່ງຊື້',      href: 'orders.html',           icon: I.receipt, chev: true }
  ];
  var ACCOUNT = [
    { key: 'history',  label: 'ປະຫວັດເຕີມເງິນ', href: 'topup-history.html', icon: I.card, chev: true },
    { key: 'profile',  label: 'ໂປຣໄຟລ໌',        href: 'profile.html',       icon: I.user, chev: true },
    { key: 'reseller', label: 'ຕົວແທນ',          href: 'reseller.html',      icon: I.tag,  chev: true },
    { key: 'admin',    label: 'ແອດມິນ',          href: 'admin.html',         icon: I.shield, chev: true, adminOnly: true }
  ];
  var T = {
    title: 'ເມນູຮ້ານຄ້າ', member: 'ສະມາຊິກ', reseller: 'ຕົວແທນ', admin: 'ແອດມິນ',
    balance: 'ຍອດເງິນຄົງເຫຼືອ', topup: 'ເຕີມເງິນ', main: 'ເມນູຫຼັກ', account: 'ບັນຊີຂອງຂ້ອຍ',
    contact: 'ຕິດຕໍ່ພວກເຮົາ', logout: 'ອອກຈາກລະບົບ'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function kip(n) { return Number(n || 0).toLocaleString('de-DE'); }

  // หน้าปัจจุบัน -> แถวไหนต้องไฮไลต์
  function currentKey() {
    var page = (location.pathname.split('/').pop() || '').replace(/\.html$/i, '').toLowerCase();
    switch (page) {
      case '': case 'index': case 'index-trial': return location.hash === '#categories' ? 'shop' : 'home';
      case 'category': case 'product': return 'shop';
      case 'leaderboard': return 'rank';
      case 'topup': return 'topup';
      case 'orders': return 'orders';
      case 'topup-history': return 'history';
      case 'profile': return 'profile';
      case 'reseller': return 'reseller';
      case 'admin': return 'admin';
      default: return null;
    }
  }

  function row(it, active) {
    var cls = 'sm-item' + (active ? ' is-active' : '');
    var inner = '<span class="sm-ico">' + it.icon + '</span><span class="sm-lbl">' + esc(it.label) + '</span>';
    if (it.expand) {
      return '<button type="button" class="' + cls + '" data-expand="' + it.key + '" aria-expanded="false">' + inner +
        '<span class="sm-chev">' + I.down + '</span></button>' +
        '<div class="sm-sub" id="sm-sub-' + it.key + '"><div>' +
        it.expand.map(function (s) {
          return '<a class="sm-item" href="' + s.href + '"><span class="sm-lbl">' + esc(s.label) + '</span></a>';
        }).join('') + '</div></div>';
    }
    var tail = active ? '<span class="sm-dot"></span>' : (it.chev ? '<span class="sm-chev">' + I.right + '</span>' : '');
    return '<a class="' + cls + '" href="' + it.href + '" data-key="' + it.key + '"' + (active ? ' aria-current="page"' : '') + '>' + inner + tail + '</a>';
  }

  function mount(opts) {
    if (document.getElementById('storeMenu')) return window.StoreMenu;
    var user = opts.user || {};
    var loginBtn = opts.loginBtn;
    var cur = opts.active || currentKey();

    var role = user.isAdmin ? T.admin : (user.isReseller ? T.reseller : T.member);
    var ava = user.avatar
      ? '<img src="' + esc(user.avatar) + '" alt="">'
      : esc((user.username || '?').trim().slice(0, 1).toUpperCase());

    var root = document.createElement('div');
    root.className = 'sm-root';
    root.id = 'storeMenu';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="sm-backdrop" data-sm-close></div>' +
      '<aside class="sm-panel" role="dialog" aria-modal="true" aria-label="' + T.title + '">' +
        '<div class="sm-head"><h2 class="sm-title">' + T.title + '</h2>' +
          '<button type="button" class="sm-close" data-sm-close aria-label="ປິດ">' + I.x + '</button></div>' +
        '<a class="sm-user" href="profile.html"><span class="sm-ava">' + ava + '</span>' +
          '<span><div class="sm-uname">' + esc(user.username) + '</div>' +
          '<div class="sm-urole' + (user.isAdmin ? ' is-admin' : '') + '">' + role + '</div></span></a>' +
        '<div class="sm-bal"><div><div class="sm-bal-label">' + T.balance + '</div>' +
          '<div class="sm-bal-num" id="smBal">₭0</div></div>' +
          '<a class="sm-topup" href="topup.html">' + I.plus + T.topup + '</a></div>' +
        '<div class="sm-rule"></div>' +
        '<div class="sm-scroll">' +
          '<div class="sm-sec">' + T.main + '</div>' +
          '<nav class="sm-list">' + MAIN.map(function (it) { return row(it, it.key === cur); }).join('') + '</nav>' +
          '<div class="sm-rule inset" style="margin-top:14px"></div>' +
          '<div class="sm-sec sm-sec-2">' + T.account + '</div>' +
          '<nav class="sm-list">' +
            ACCOUNT.filter(function (it) { return !it.adminOnly || user.isAdmin; })
              .map(function (it) { return row(it, it.key === cur); }).join('') +
          '</nav>' +
        '</div>' +
        '<div class="sm-rule"></div>' +
        '<div class="sm-foot">' +
          '<button type="button" class="sm-item" id="smContact"><span class="sm-ico">' + I.chat + '</span><span class="sm-lbl">' + T.contact + '</span><span class="sm-chev">' + I.right + '</span></button>' +
          '<button type="button" class="sm-item sm-out" id="smLogout"><span class="sm-ico">' + I.out + '</span><span class="sm-lbl">' + T.logout + '</span></button>' +
        '</div>' +
      '</aside>';
    document.body.appendChild(root);
    document.body.classList.add('sm-on');

    var panel = root.querySelector('.sm-panel');
    var balEl = root.querySelector('#smBal');
    var reduce = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };

    function countUp() {
      var target = Number(user.balance || 0);
      cancelAnimationFrame(balEl._raf || 0);
      if (reduce() || !target) { balEl.textContent = '₭' + kip(target); return; }
      var t0 = performance.now(), dur = 900;
      (function step(t) {
        var p = Math.min(1, (t - t0) / dur);
        balEl.textContent = '₭' + kip(Math.round(target * (1 - Math.pow(1 - p, 4))));
        if (p < 1) balEl._raf = requestAnimationFrame(step);
      })(t0);
    }

    function isOpen() { return root.classList.contains('is-open'); }
    function open() {
      root.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
      document.body.classList.add('sm-lock');
      if (loginBtn) loginBtn.setAttribute('aria-expanded', 'true');
      setTimeout(countUp, 150);
    }
    function close() {
      if (!isOpen()) return;
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('sm-lock');
      if (loginBtn) loginBtn.setAttribute('aria-expanded', 'false');
    }

    if (loginBtn) {
      loginBtn.setAttribute('aria-haspopup', 'dialog');
      loginBtn.setAttribute('aria-controls', 'storeMenu');
      loginBtn.addEventListener('click', function (e) { e.stopPropagation(); isOpen() ? close() : open(); });
    }
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-sm-close]')) { close(); return; }

      var ex = e.target.closest('[data-expand]');
      if (ex) {
        var sub = root.querySelector('#sm-sub-' + ex.getAttribute('data-expand'));
        var on = !sub.classList.contains('is-open');
        sub.classList.toggle('is-open', on);
        ex.classList.toggle('is-expanded', on);
        ex.setAttribute('aria-expanded', on ? 'true' : 'false');
        return;
      }

      var a = e.target.closest('a[href]');
      if (a) {
        // อยู่หน้านี้อยู่แล้ว: ไม่โหลดซ้ำ แค่ปิดเมนู (ลิงก์ที่มี # ให้เลื่อนตามปกติ)
        if (a.classList.contains('is-active') && (a.getAttribute('href') || '').indexOf('#') < 0) e.preventDefault();
        close();
      }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    root.querySelector('#smContact').addEventListener('click', function () {
      close();
      var fab = document.querySelector('.chat-fab');
      if (fab) setTimeout(function () { fab.click(); }, 260);
      else location.href = 'index.html#footer-social';
    });
    root.querySelector('#smLogout').addEventListener('click', function () { location.href = '/auth/logout'; });

    // ปัดไปทางขวาเพื่อปิด
    var sx = 0, sy = 0, dx = 0, drag = false;
    panel.addEventListener('touchstart', function (e) {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; drag = true;
    }, { passive: true });
    panel.addEventListener('touchmove', function (e) {
      if (!drag) return;
      var mx = e.touches[0].clientX - sx, my = e.touches[0].clientY - sy;
      if (Math.abs(my) > Math.abs(mx)) { drag = false; return; }
      dx = Math.max(0, mx);
      panel.style.transition = 'none';
      panel.style.transform = 'translateX(' + dx + 'px)';
    }, { passive: true });
    panel.addEventListener('touchend', function () {
      if (!drag && !dx) return;
      drag = false;
      panel.style.transition = '';
      panel.style.transform = '';
      if (dx > 80) close();
      dx = 0;
    });

    window.StoreMenu = { mount: mount, open: open, close: close, isOpen: isOpen, setBalance: function (n) { user.balance = n; balEl.textContent = '₭' + kip(n); } };
    return window.StoreMenu;
  }

  window.StoreMenu = { mount: mount };
})();
