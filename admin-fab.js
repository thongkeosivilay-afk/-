/* admin-fab.js — ไอคอนแอดมินลอย + เมนูลัด 5 หมวด (script.js โหลดไฟล์นี้เฉพาะตอนล็อกอินและเป็นแอดมินเท่านั้น)
   - ลาก = ย้ายตำแหน่ง ปล่อยแล้วดูดเข้าขอบซ้าย/ขวา (จำตำแหน่งไว้ในเครื่อง)
   - แตะ = เมนูไอคอน 5 อันเด้งออกมาเป็นวงโค้งรอบปุ่ม (เลือกตำแหน่งโค้งให้พอดีจอเสมอ)
   - แตะหมวด = ไอคอนย่อยของหมวดนั้นเด้งออกมา พร้อมคำอธิบายว่าเอาไว้ทำอะไร (ชั้นที่ 2)
   - แตะตัวเลือกย่อย = เปิดห้องแอดมินแล้วกางแผงนั้นให้เลย
     (ส่งต่อผ่าน sessionStorage: gpg = แท็บล่าง, adminOpen = แผงที่จะเปิด, agTab = แท็บในระบบตัวแทน) */
(function () {
  'use strict';
  if (window.__adminFab) return;
  window.__adminFab = true;

  var KEY = 'adminFabPos', SIZE = 56, ITEM = 52, EDGE = 10, TOP_MIN = 64, BOTTOM_MIN = 96, DRAG_PX = 6;
  var RADIUS = 124, SPREAD = Math.PI * 0.86;
  var I = {
    plus:   '<path d="M12 5v14M5 12h14"/>',
    edit:   '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
    key:    '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
    minus:  '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
    vault:  '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
    check:  '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    users:  '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18.6 15c1.8.8 3 2.4 3.4 5"/>',
    tag:    '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    coin:   '<circle cx="12" cy="12" r="9"/><path d="M9 7v10M9 12l5-5M10.5 11l4.5 6"/>',
    store:  '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.5 2.5 0 005 0 2.5 2.5 0 005 0 2.5 2.5 0 005 0"/><path d="M5 12v8h14v-8"/>',
    bell:   '<path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 004 0"/>'
  };
  var ITEMS = [
    { k: 'home', label: 'ພາບລວມ', d: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>' },
    { k: 'stock', label: 'ສິນຄ້າ', d: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
      title: 'ຄັງສິນຄ້າ', desc: 'ເພີ່ມ ແກ້ໄຂ ແລະ ເຕີມລະຫັດສິນຄ້າໃນຮ້ານ',
      sub: [
        { p: 'panelAdd',         label: 'ເພີ່ມສິນຄ້າ',    desc: 'ສ້າງລາຍການສິນຄ້າໃໝ່ໃຫ້ໂຊວ໌ໃນໜ້າຮ້ານ', d: I.plus },
        { p: 'panelManage',      label: 'ຈັດການສິນຄ້າ',   desc: 'ແກ້ໄຂ, ຢຸດຂາຍຊົ່ວຄາວ ຫຼືລຶບສິນຄ້າ', d: I.edit },
        { p: 'panelCodes',       label: 'ເຕີມລະຫັດ',      desc: 'ເພີ່ມສະຕັອກລະຫັດໃຫ້ສິນຄ້າແຕ່ລະລາຍການ', d: I.key },
        { p: 'panelRemoveCodes', label: 'ເອົາລະຫັດອອກ',   desc: 'ເອົາລະຫັດທີ່ຍັງບໍ່ຖືກຂາຍ ອອກ ຫຼື ຍ້າຍ', d: I.minus },
        { p: 'panelCodeVault',   label: 'ຄັງລະຫັດ',       desc: 'ເບິ່ງ ຄັດລອກ ດາວໂຫຼດ ແລະລຶບລະຫັດຊ້ຳ', d: I.vault }
      ] },
    { k: 'money', label: 'ເຕີມເງິນ', d: '<rect x="3" y="6" width="18" height="13" rx="3.5"/><path d="M3 10.5h18"/><circle cx="16.5" cy="14.8" r="1"/>',
      title: 'ການເງິນ', desc: 'ກວດສະລິບເຕີມເງິນ ຈັດການລູກຄ້າ ແລະ ໂຄ້ດສ່ວນຫຼຸດ',
      sub: [
        { p: 'panelTopup',     label: 'ຄຳຂໍເຕີມເງິນ',   desc: 'ກວດສະລິບໂອນເງິນ ແລ້ວອະນຸມັດ ຫຼືປະຕິເສດ', d: I.check },
        { p: 'panelCustomers', label: 'ຈັດການລູກຄ້າ',   desc: 'ເບິ່ງຍອດເງິນ, ເພີ່ມ/ຫັກເງິນ, ແບນ ຫຼືລຶບບັນຊີ', d: I.users },
        { p: 'panelCoupons',   label: 'ໂຄ້ດສ່ວນຫຼຸດ',   desc: 'ສ້າງໂຄ້ດ, ກຳນົດສິດໃຊ້ ແລະເບິ່ງຍອດຄົນໃຊ້', d: I.tag }
      ] },
    { k: 'agent', label: 'ຕົວແທນ', d: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18.6 15c1.8.8 3 2.4 3.4 5"/>',
      title: 'ຕົວແທນຈຳໜ່າຍ', desc: 'ຄີຍ໌ປົດລັອກ ລະດັບ ລາຄາພິເສດ ແລະ ຈັດການຕົວແທນ',
      sub: [
        { p: 'panelAgent', tab: 'accounts', label: 'ຈັດການຕົວແທນ', desc: 'ເບິ່ງຍອດຊື້ ເປົ້າໝາຍ ແລະ ປິດສິດຕົວແທນ', d: I.users },
        { p: 'panelAgent', tab: 'keys',     label: 'ຄີຍ໌ປົດລັອກ',  desc: 'ສ້າງຄີຍ໌ໃຫ້ລູກຄ້າກອກເພື່ອເປັນຕົວແທນ', d: I.key },
        { p: 'panelAgent', tab: 'tiers',    label: 'ລະດັບຕົວແທນ',  desc: 'ຕັ້ງເປົ້າຍອດຊື້ຂອງແຕ່ລະລະດັບ', d: I.layers },
        { p: 'panelAgent', tab: 'prices',   label: 'ລາຄາຕົວແທນ',   desc: 'ຕັ້ງລາຄາຕົວແທນຂອງແຕ່ລະສິນຄ້າ', d: I.coin }
      ] },
    { k: 'settings', label: 'ຕັ້ງຄ່າ', d: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
      title: 'ຕັ້ງຄ່າ', desc: 'ໂລໂກ້ ໝວດໝູ່ QR ຊ່ອງທາງໂຊເຊຍລ ແລະ ແຈ້ງເຕືອນ',
      sub: [
        { p: 'panelSettings', label: 'ຕັ້ງຄ່າຮ້ານ',        desc: 'ໂລໂກ້, ໝວດໝູ່, QR ຮັບເງິນ ແລະ ຊ່ອງທາງໂຊເຊຍລ', d: I.store },
        { p: 'panelDiscord',  label: 'ແຈ້ງເຕືອນ Discord',  desc: 'ໃສ່ລິ້ງ Webhook ເພື່ອແຈ້ງເຕືອນເວລາມີຄົນເຕີມເງິນ', d: I.bell }
      ] }
  ];
  var pulseT = 0, fab, scrim, sheet, items = [], cur = null, backT = 0, moved = false, sx = 0, sy = 0, ox = 0, oy = 0, pid = null, open = false;

  function vw() { return document.documentElement.clientWidth; }
  function vh() { return window.innerHeight; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function limits() {
    return { x0: EDGE, x1: vw() - SIZE - EDGE, y0: TOP_MIN, y1: Math.max(TOP_MIN, vh() - SIZE - BOTTOM_MIN) };
  }
  function place(x, y) {
    var L = limits();
    fab.style.left = clamp(x, L.x0, L.x1) + 'px';
    fab.style.top = clamp(y, L.y0, L.y1) + 'px';
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        right: parseFloat(fab.style.left) > vw() / 2 - SIZE / 2,
        y: parseFloat(fab.style.top) / Math.max(1, vh())
      }));
    } catch (e) {}
  }
  function restore() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    var L = limits();
    var right = s ? !!s.right : true;
    var y = s && typeof s.y === 'number' ? s.y * vh() : vh() * 0.43;
    place(right ? L.x1 : L.x0, y);
  }

  /* ---------- เมนูวงโค้ง ---------- */
  function arcPoints(cx, cy, base, n) {
    var step = SPREAD / (n - 1), pts = [];
    for (var i = 0; i < n; i++) {
      var a = base + (i - (n - 1) / 2) * step;
      pts.push({ x: Math.cos(a) * RADIUS, y: Math.sin(a) * RADIUS });
    }
    return pts;
  }
  function fits(cx, cy, pts) {
    var m = ITEM / 2 + 12, mx = 44;
    return pts.every(function (p) {
      var x = cx + p.x, y = cy + p.y;
      return x >= mx && x <= vw() - mx && y >= m + 24 && y <= vh() - m - 24;
    });
  }
  function fitPoints(cx, cy, n) {
    var base = Math.atan2(vh() / 2 - cy, vw() / 2 - cx), pts = null, best = null;
    for (var d = 0; d <= 130 && !pts; d += 6) {
      var tries = d === 0 ? [0] : [d, -d];
      for (var t = 0; t < tries.length; t++) {
        var p = arcPoints(cx, cy, base + tries[t] * Math.PI / 180, n);
        if (fits(cx, cy, p)) { pts = p; break; }
      }
    }
    if (!pts) {
      pts = arcPoints(cx, cy, base, n).map(function (p) {
        var m = ITEM / 2 + 8;
        return { x: clamp(cx + p.x, m, vw() - m) - cx, y: clamp(cy + p.y, m + 20, vh() - m - 20) - cy };
      });
    }
    return pts;
  }
  function layout() {
    var cx = (parseFloat(fab.style.left) || 0) + SIZE / 2, cy = (parseFloat(fab.style.top) || 0) + SIZE / 2;
    var pts = fitPoints(cx, cy, ITEMS.length);
    scrim.style.setProperty('--bx', cx + 'px');
    scrim.style.setProperty('--by', cy + 'px');
    items.forEach(function (el, i) {
      el.style.left = cx + 'px';
      el.style.top = cy + 'px';
      el.style.setProperty('--dx', pts[i].x.toFixed(1) + 'px');
      el.style.setProperty('--dy', pts[i].y.toFixed(1) + 'px');
    });
  }

  /* ---------- อนิเมชั่นปิด: ไอคอนบินกลับเข้าหาปุ่มแอดมิน "ตามตำแหน่งปัจจุบันของปุ่ม" ----------
     ปิดตอนลากปุ่มไปที่อื่น ไอคอนจะวิ่งตามปุ่มไปด้วย (ใช้ rAF + transform ล้วน ๆ ลื่นบนมือถือ) */
  var flyMain = null, flySub = null;
  var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  function easeIO(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function c01(v) { return Math.max(0, Math.min(1, v)); }
  function fly(els, done, how) {
    var D = REDUCE ? 150 : 680, n = els.length, st = [], raf = 0, stopped = false, last = 0;
    var fr = fab.getBoundingClientRect(), fx0 = fr.left + fr.width / 2, fy0 = fr.top + fr.height / 2;
    els.forEach(function (el, i) {
      var r = el.getBoundingClientRect(), ox = parseFloat(el.style.left) || 0, oy = parseFloat(el.style.top) || 0;
      var order = n - 1 - i;                       /* ตัวล่างสุดไปก่อน */
      st.push({
        el: el, ox: ox, oy: oy,
        /* ระยะห่างจากปุ่มแอดมิน ณ ตอนเริ่มปิด — จะหดเข้าหา 0 โดยยึดติดปุ่มตลอด */
        rx: r.left + r.width / 2 - fx0, ry: r.top + r.height / 2 - fy0,
        fx: fx0, fy: fy0,                          /* ตำแหน่งที่ "วิ่งไล่ตาม" ปุ่ม (หน่วงตามลำดับ) */
        lam: REDUCE ? 60 : 22 - order * 3,
        sc0: r.width ? r.width / ITEM : 1,
        op0: parseFloat(getComputedStyle(el).opacity) || 0,
        delay: REDUCE ? 0 : order * 35
      });
      el.style.transition = 'none';
      el.style.pointerEvents = 'none';
    });
    function render(t, t0) {
      var dt = last ? Math.max(0, Math.min(.05, (t - last) / 1000)) : 0; last = t;
      var q = fab.getBoundingClientRect(), fx = q.left + q.width / 2, fy = q.top + q.height / 2, all = true;
      st.forEach(function (s) {
        var k = 1 - Math.exp(-dt * s.lam);
        s.fx += (fx - s.fx) * k; s.fy += (fy - s.fy) * k;      /* วิ่งไล่ตามปุ่มที่กำลังถูกลาก */
        var p = c01((t - t0 - s.delay) / D), e = easeIO(p);
        if (p < 1) all = false;
        var x = s.fx + s.rx * (1 - e), y = s.fy + s.ry * (1 - e), sc = s.sc0 + (.3 - s.sc0) * e;
        s.el.style.transform = 'translate3d(' + (x - s.ox).toFixed(1) + 'px,' + (y - s.oy).toFixed(1) + 'px,0) scale(' + sc.toFixed(3) + ')';
        s.el.style.rotate = (-200 * e).toFixed(1) + 'deg';
        s.el.style.opacity = (s.op0 * (1 - c01((p - .5) / .45))).toFixed(3);
      });
      return all;
    }
    function reset() {
      st.forEach(function (s) {
        s.el.style.transform = ''; s.el.style.rotate = ''; s.el.style.opacity = ''; s.el.style.pointerEvents = '';
        if (s.sp) { s.sp.style.opacity = ''; s.sp.style.transition = ''; }
      });
      if (st.length) void st[0].el.offsetWidth;
      st.forEach(function (s) { s.el.style.transition = ''; });
    }

    /* ลากปุ่มไปที่อื่นตอนเมนูเปิดอยู่: ไอคอนร่วงลงตามแรงโน้มถ่วง (ฟิสิกส์จริง: ความเร็วเพิ่มต่อเนื่อง + ลมต้านเล็กน้อย) */
    if (how === 'fall' && !REDUCE) {
      st.forEach(function (s, i) {
        s.x = fx0 + s.rx; s.y = fy0 + s.ry;
        s.vx = (Math.random() * 2 - 1) * 70 + s.rx * .35;       /* กระจายออกข้างนิดหน่อยตามตำแหน่งเดิม */
        s.vy = -90 - Math.random() * 50;                          /* ดีดขึ้นนิดเดียวตอนปล่อย แล้วค่อยร่วง */
        s.vr = (Math.random() * 2 - 1) * 170;                     /* องศาต่อวินาที */
        s.rot = 0;
        s.delay = i * 32;
        var sp = s.el.querySelector('span');
        if (sp) { s.sp = sp; sp.style.transition = 'none'; sp.style.opacity = '1'; }
      });
      render = function (t, t0) {
        var dt = last ? Math.max(0, Math.min(.033, (t - last) / 1000)) : 0; last = t;
        var G = 2600, all = true;
        st.forEach(function (s) {
          var a = (t - t0 - s.delay) / 1000;
          if (a > 0) {
            s.vy += G * dt; s.vx *= Math.exp(-dt * .9);
            s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
          }
          var o = s.op0 * (1 - c01((a - .3) / .5));
          if (a < .8) all = false;
          s.el.style.transform = 'translate3d(' + (s.x - s.ox).toFixed(1) + 'px,' + (s.y - s.oy).toFixed(1) + 'px,0) scale(' + s.sc0.toFixed(3) + ')';
          s.el.style.rotate = s.rot.toFixed(1) + 'deg';
          s.el.style.opacity = o.toFixed(3);
        });
        return all;
      };
    }
    var t0 = performance.now();
    render(t0, t0);
    function frame(t) {
      if (stopped) return;
      if (render(t, t0)) { reset(); if (done) done(); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return { stop: function () { stopped = true; cancelAnimationFrame(raf); reset(); } };
  }
  function setOpen(on, viaKey, how) {
    if (on === open) return;
    open = on;
    if (!on) {
      if (cur) closeSheet(how);
      else { if (flyMain) flyMain.stop(); flyMain = fly(items.slice(), function () { flyMain = null; }, how); }
      clearTimeout(pulseT); if (how !== 'fall') pulseT = setTimeout(function () { fab.classList.add('is-pulse'); setTimeout(function () { fab.classList.remove('is-pulse'); }, 650); }, 380); }
    if (on) {
      if (flyMain) { flyMain.stop(); flyMain = null; }
      if (flySub) { flySub.stop(); flySub = null; sheet.classList.remove('is-on'); sheet.innerHTML = ''; }
      clearTimeout(pulseT); fab.classList.remove('is-pulse'); layout();
    }
    fab.classList.toggle('is-open', on);
    scrim.classList.toggle('is-open', on);
    fab.setAttribute('aria-expanded', on ? 'true' : 'false');
    items.forEach(function (el) { el.tabIndex = on ? 0 : -1; el.setAttribute('aria-hidden', on ? 'false' : 'true'); });
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
    if (on && viaKey) setTimeout(function () { items[0].focus(); }, 60);
    if (!on && viaKey) fab.focus();
  }
  function navigate(page, panel, tab) {
    try {
      sessionStorage.setItem('gpg', page);
      if (panel) sessionStorage.setItem('adminOpen', panel); else sessionStorage.removeItem('adminOpen');
      if (tab) sessionStorage.setItem('agTab', tab);
    } catch (e) {}
    setOpen(false);
    setTimeout(function () { window.location.href = '/admin.html'; }, 220);
  }

  /* ---------- ชั้นที่ 2: ไอคอนย่อย + คำอธิบาย ---------- */
  function openSheet(it, viaKey) {
    cur = it;
    if (flySub) { flySub.stop(); flySub = null; }
    var cx = (parseFloat(fab.style.left) || 0) + SIZE / 2, cy = (parseFloat(fab.style.top) || 0) + SIZE / 2;
    var list = it.sub.map(function (x, i) { return { i: i, label: x.label, d: x.d }; });
    var pts = fitPoints(cx, cy, list.length);
    sheet.innerHTML = '';
    list.forEach(function (o, n) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'afm-item afm-sub';
      b.setAttribute('role', 'menuitem');
      b.setAttribute('aria-label', o.label);
      b.style.left = cx + 'px';
      b.style.top = cy + 'px';
      b.style.setProperty('--n', n);
      b.style.setProperty('--dx', pts[n].x.toFixed(1) + 'px');
      b.style.setProperty('--dy', pts[n].y.toFixed(1) + 'px');
      b.innerHTML = svg(o.d) + '<span>' + o.label + '</span>';
      b.addEventListener('click', function () {
        var x = it.sub[o.i];
        navigate(it.k, x.p, x.tab);
      });
      sheet.appendChild(b);
    });
    sheet.className = 'afm-sheet is-on';
    clearTimeout(backT);
    scrim.classList.add('is-sub');
    void sheet.offsetWidth;
    requestAnimationFrame(function () { sheet.classList.add('is-in'); });
    sheet.setAttribute('aria-hidden', 'false');
    items.forEach(function (b) { b.tabIndex = -1; });
    if (viaKey) setTimeout(function () { var f = sheet.querySelector('.afm-sub'); if (f) f.focus(); }, 80);
    if (navigator.vibrate) try { navigator.vibrate(6); } catch (e) {}
  }
  function closeSheet(how) {
    if (!cur) return;
    cur = null;
    var kids = Array.prototype.slice.call(sheet.children);
    sheet.setAttribute('aria-hidden', 'true');
    clearTimeout(backT);
    if (flySub) flySub.stop();
    flySub = fly(kids, function () { sheet.classList.remove('is-on'); sheet.innerHTML = ''; flySub = null; }, how);
    sheet.classList.remove('is-in');
    scrim.classList.remove('is-sub');
  }
  function backToMain() {
    if (!cur) return;
    var k = cur.k;
    closeSheet();
    items.forEach(function (b) { b.tabIndex = open ? 0 : -1; });
    var back = items[ITEMS.map(function (x) { return x.k; }).indexOf(k)];
    if (back) setTimeout(function () { back.focus({ preventScroll: true }); }, 400);
  }
  function pick(it, viaKey) {
    if (it.sub) openSheet(it, viaKey); else navigate(it.k);
  }

  /* ---------- ลากย้ายปุ่ม ---------- */
  function down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pid = e.pointerId; moved = false;
    sx = e.clientX; sy = e.clientY;
    ox = parseFloat(fab.style.left) || 0; oy = parseFloat(fab.style.top) || 0;
    fab.classList.remove('is-snapping');
    try { fab.setPointerCapture(pid); } catch (x) {}
  }
  function move(e) {
    if (e.pointerId !== pid) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    if (!moved && Math.hypot(dx, dy) < DRAG_PX) return;
    if (!moved) setOpen(false, false, 'fall');
    moved = true;
    fab.classList.add('is-dragging');
    place(ox + dx, oy + dy);
  }
  function up(e) {
    if (e.pointerId !== pid) return;
    pid = null;
    fab.classList.remove('is-dragging');
    if (!moved) { setOpen(!open); return; }
    var L = limits(), x = parseFloat(fab.style.left);
    fab.classList.add('is-snapping');
    place(x + SIZE / 2 < vw() / 2 ? L.x0 : L.x1, parseFloat(fab.style.top));
    save();
  }

  function svg(inner) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>'; }

  function mount() {
    scrim = document.createElement('div');
    scrim.className = 'afm-scrim';
    scrim.addEventListener('click', function () { if (cur) backToMain(); else setOpen(false); });
    document.body.appendChild(scrim);

    ITEMS.forEach(function (it, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'afm-item';
      b.style.setProperty('--i', i);
      b.tabIndex = -1;
      b.setAttribute('aria-hidden', 'true');
      b.setAttribute('aria-label', it.label);
      b.innerHTML = svg(it.d) + '<span>' + it.label + '</span>';
      b.addEventListener('click', function (e) { pick(it, e.detail === 0); });
      document.body.appendChild(b);
      items.push(b);
    });

    sheet = document.createElement('div');
    sheet.className = 'afm-sheet';
    sheet.setAttribute('role', 'menu');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.appendChild(sheet);

    fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'admin-fab';
    fab.setAttribute('aria-label', 'ເມນູແອດມິນ (ລາກເພື່ອຍ້າຍ)');
    fab.setAttribute('aria-haspopup', 'true');
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML =
      '<span class="af-ic af-shield">' + svg('<path d="M12 3l8 3v6c0 4.5-3.2 8.3-8 9-4.8-.7-8-4.5-8-9V6z"/><circle cx="12" cy="10" r="2.4"/><path d="M7.8 16.4c.9-1.6 2.5-2.4 4.2-2.4s3.3.8 4.2 2.4"/>') + '</span>' +
      '<span class="af-ic af-close">' + svg('<path d="M6 6l12 12M18 6L6 18"/>') + '</span>';
    document.body.appendChild(fab);
    restore();
    fab.classList.add('is-ready');

    fab.addEventListener('pointerdown', down);
    fab.addEventListener('pointermove', move);
    fab.addEventListener('pointerup', up);
    fab.addEventListener('pointercancel', function (e) { pid = null; fab.classList.remove('is-dragging'); });
    fab.addEventListener('dragstart', function (e) { e.preventDefault(); });
    fab.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open, true); }
    });
    document.addEventListener('keydown', function (e) { if (e.key !== 'Escape' || !open) return; if (cur) backToMain(); else setOpen(false, true); });
    window.addEventListener('resize', function () {
      setOpen(false);
      var L = limits();
      fab.classList.add('is-snapping');
      place(parseFloat(fab.style.left) + SIZE / 2 < vw() / 2 ? L.x0 : L.x1, parseFloat(fab.style.top));
    });
  }

  function init() {
    if (document.querySelector('.admin-fab')) return;
    mount();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
