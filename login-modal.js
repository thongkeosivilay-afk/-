/* login-modal.js — กดปุ่มลงชื่อเข้าใช้/สมัครสมาชิก แล้วเด้งเป็นการ์ดบนหน้าเดิม (ไม่เปลี่ยนหน้า)
   - ดักคลิกทุกลิงก์ที่ชี้ไป login.html / signup.html และปุ่ม .login-btn ที่ยังไม่ล็อกอิน
   - ใช้เรียกจากโค้ดอื่นได้: window.LoginModal.open({ tab:'login'|'signup', next:'/path' })
   - login.html / signup.html ยังอยู่เหมือนเดิม (ใช้เป็นหน้าสำรอง / ลิงก์ตรง) */
(function () {
  if (window.LoginModal) return;
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var overlay, card, nextPath = '', busy = false, toastTimer, lastFocus;

  function safeNext(raw) { // กัน open redirect: รับเฉพาะ path ภายในเว็บ
    return (typeof raw === 'string' && raw.charAt(0) === '/' && raw.charAt(1) !== '/') ? raw : '';
  }
  function curPath() { return location.pathname + location.search; }

  /* ---------- โหลดการ์ด/เสียงหลัง login สำเร็จ (ถ้าหน้านั้นยังไม่ได้ใส่) ---------- */
  function ensureSuccessFx() {
    if (window.LoginSuccess || document.getElementById('lm-ls-js')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/login-success.css?v=1'; document.head.appendChild(l);
    var s = document.createElement('script'); s.id = 'lm-ls-js'; s.src = '/login-success.js?v=3'; document.head.appendChild(s);
  }

  function toast(msg, isErr) {
    var t = document.querySelector('.lm-toast');
    if (!t) { t = document.createElement('div'); t.className = 'lm-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle('error', !!isErr); t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
  var LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  var USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';
  var DISCORD = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.32 4.37a19.8 19.8 0 0 0-4.9-1.52.07.07 0 0 0-.08.04c-.21.38-.45.86-.61 1.24a18.3 18.3 0 0 0-5.46 0 12.6 12.6 0 0 0-.62-1.24.08.08 0 0 0-.08-.04c-1.7.29-3.34.8-4.9 1.52a.07.07 0 0 0-.03.03C.53 8.7-.32 12.9.1 17.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.11 13 13 0 0 1-1.87-.9.08.08 0 0 1 0-.13c.13-.09.25-.19.37-.28a.07.07 0 0 1 .08 0c3.93 1.8 8.18 1.8 12.06 0a.07.07 0 0 1 .08 0c.12.1.24.19.37.28a.08.08 0 0 1 0 .13c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.04.12c.37.7.78 1.36 1.23 2a.08.08 0 0 0 .08.02 19.8 19.8 0 0 0 6.01-3.03.08.08 0 0 0 .03-.05c.5-4.83-.83-9-3.51-12.66a.06.06 0 0 0-.03-.03ZM8.02 14.6c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.17 1.1 2.15 2.42 0 1.34-.95 2.42-2.15 2.42Zm7.97 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.17 1.1 2.15 2.42 0 1.34-.94 2.42-2.15 2.42Z"/></svg>';
  var GOOGLE = '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.1 17.7 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.6H24v9h12.6c-.5 3-2.2 5.5-4.7 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-17.3Z"/><path fill="#FBBC05" d="M10.5 19.3a14.5 14.5 0 0 0 0 9.3l-7.9 6.1a24 24 0 0 1 0-21.5l7.9 6.1Z"/><path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.4-5.7c-2.1 1.4-4.7 2.2-7.6 2.2-6.3 0-11.6-3.6-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48Z"/></svg>';

  function field(id, label, icon, attrs, eye) {
    return '<div class="lm-field" id="lm-f-' + id + '"><label for="lm-' + id + '">' + label + '</label>' +
      '<div class="lm-input">' + icon + '<input id="lm-' + id + '" ' + attrs + '>' +
      (eye ? '<button type="button" class="lm-eye" aria-label="ສະແດງລະຫັດຜ່ານ">' + EYE + '</button>' : '') +
      '</div><div class="lm-err"></div></div>';
  }
  function social(prov, cls, icon, label) {
    return '<button type="button" class="lm-btn lm-social ' + cls + '" data-oauth="' + prov + '">' + icon + '<span>' + label + '</span></button>';
  }

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'lm-overlay';
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'ລົງຊື່ເຂົ້າໃຊ້');
    overlay.innerHTML =
      '<div class="lm-card">' +
        '<button type="button" class="lm-close" aria-label="ປິດ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
        '<div class="lm-logo"><img alt="logo" src="/assets/logo.png"></div>' +
        '<div class="lm-eyebrow"></div><div class="lm-title"></div><div class="lm-sub"></div>' +
        '<nav class="lm-tabs" role="tablist">' +
          '<button type="button" class="lm-tab" data-tab="login" role="tab">ເຂົ້າສູ່ລະບົບ</button>' +
          '<button type="button" class="lm-tab" data-tab="signup" role="tab">ສະໝັກສະມາຊິກ</button>' +
        '</nav>' +
        '<form class="lm-form" data-form="login" novalidate>' +
          field('l-email', 'ຊື່ຜູ້ໃຊ້', USER, 'type="text" placeholder="ຊື່ຜູ້ໃຊ້" autocomplete="username" autocapitalize="none" spellcheck="false"') +
          field('l-pw', 'ລະຫັດຜ່ານ', LOCK, 'type="password" placeholder="ລະຫັດຜ່ານ" autocomplete="current-password"', true) +
          '<div style="height:6px"></div>' +
          '<button type="submit" class="lm-btn lm-submit">ລົງຊື່ເຂົ້າໃຊ້</button>' +
        '</form>' +
        '<form class="lm-form" data-form="signup" novalidate hidden>' +
          field('s-user', 'ຊື່ຜູ້ໃຊ້', USER, 'type="text" placeholder="Username (English, 3-24 characters)" maxlength="24" autocomplete="username" autocapitalize="none" spellcheck="false"') +
          field('s-email', 'ອີເມວ (ບໍ່ບັງຄັບ)', MAIL, 'type="email" placeholder="ອີເມວ (ບໍ່ໃສ່ກໍໄດ້)" autocomplete="email" autocapitalize="none"') +
          field('s-pw', 'ລະຫັດຜ່ານ', LOCK, 'type="password" placeholder="ລະຫັດຜ່ານ (ຢ່າງໜ້ອຍ 6 ຕົວ)" autocomplete="new-password"', true) +
          field('s-pw2', 'ຢືນຢັນລະຫັດຜ່ານ', LOCK, 'type="password" placeholder="ຢືນຢັນລະຫັດຜ່ານ" autocomplete="new-password"', true) +
          '<div class="lm-row"><label><input type="checkbox" id="lm-s-terms"> ຂ້ອຍຍອມຮັບເງື່ອນໄຂການນຳໃຊ້</label></div>' +
          '<button type="submit" class="lm-btn lm-submit">ສ້າງບັນຊີ</button>' +
        '</form>' +
        '<div class="lm-divider">ຫຼື</div>' +
        social('discord', 'lm-discord', DISCORD, 'ເຂົ້າສູ່ລະບົບດ້ວຍ Discord') +
        social('google', 'lm-google', GOOGLE, 'ເຂົ້າສູ່ລະບົບດ້ວຍ Google') +
      '</div>';
    document.body.appendChild(overlay);
    card = overlay.querySelector('.lm-card');

    // ปิด: ปุ่ม X / แตะพื้นหลัง / ปุ่ม Esc
    overlay.querySelector('.lm-close').addEventListener('click', close);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    overlay.addEventListener('touchstart', function (e) { if (e.target === overlay) close(); }, { passive: true });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('is-open')) close(); });

    // สลับแท็บในการ์ดเดิม (ไม่เปลี่ยนหน้า)
    overlay.querySelectorAll('.lm-tab').forEach(function (b) { b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); }); });

    // ปุ่มตา
    overlay.querySelectorAll('.lm-eye').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var inp = btn.parentNode.querySelector('input'), isPw = inp.type === 'password';
        inp.type = isPw ? 'text' : 'password'; btn.classList.toggle('is-visible', isPw);
      });
    });

    // OAuth
    overlay.querySelectorAll('[data-oauth]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (busy) return; busy = true;
        var n = nextPath || curPath();
        location.href = '/auth/' + b.getAttribute('data-oauth') + '/login?next=' + encodeURIComponent(n);
      });
    });

    overlay.querySelector('[data-form="login"]').addEventListener('submit', onLogin);
    overlay.querySelector('[data-form="signup"]').addEventListener('submit', onSignup);
    window.addEventListener('pageshow', function () { busy = false; }); // iOS bfcache: กลับมาจาก OAuth แล้วปุ่มต้องกดได้
  }

  function setTab(tab) {
    var isLogin = tab !== 'signup';
    overlay.querySelectorAll('.lm-tab').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === (isLogin ? 'login' : 'signup'))); });
    overlay.querySelector('[data-form="login"]').hidden = !isLogin;
    overlay.querySelector('[data-form="signup"]').hidden = isLogin;
    overlay.querySelector('.lm-eyebrow').textContent = isLogin ? 'ຍິນດີຕ້ອນຮັບກັບມາ' : 'ສະໝັກສະມາຊິກ';
    overlay.querySelector('.lm-title').textContent = isLogin ? 'ລົງຊື່ເຂົ້າໃຊ້' : 'ສ້າງບັນຊີໃໝ່';
    overlay.querySelector('.lm-sub').textContent = isLogin ? 'ເຂົ້າບັນຊີເພື່ອສັ່ງຊື້ ແລະ ຕິດຕາມອໍເດີ້' : 'ເລີ່ມຕົ້ນໃຊ້ງານ';
    var lbl = isLogin ? 'ເຂົ້າສູ່ລະບົບດ້ວຍ ' : 'ສະໝັກສະມາຊິກດ້ວຍ ';
    overlay.querySelector('[data-oauth="discord"] span').textContent = lbl + 'Discord';
    overlay.querySelector('[data-oauth="google"] span').textContent = lbl + 'Google';
  }

  function setErr(id, msg) {
    var f = overlay.querySelector('#lm-f-' + id);
    f.classList.toggle('has-error', !!msg);
    f.querySelector('.lm-err').textContent = msg || '';
  }

  /* ---------- เรียก API (เหมือน auth.js เดิม: timeout + ตรวจว่า cookie ติดจริงผ่าน /api/me) ---------- */
  async function authRequest(url, payload, failMsg) {
    var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 20000), res;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin', signal: ctrl.signal });
    } catch (err) {
      throw new Error(err && err.name === 'AbortError' ? 'ເຊື່ອມຕໍ່ຊ້າເກີນໄປ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ' : 'ເຊື່ອມຕໍ່ອິນເຕີເນັດບໍ່ໄດ້ ກະລຸນາກວດເນັດແລ້ວລອງໃໝ່');
    } finally { clearTimeout(timer); }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || (failMsg + ' (HTTP ' + res.status + ')'));
    for (var i = 0; i < 3; i++) {
      try {
        var me = await (await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' })).json().catch(function () { return {}; });
        if (me && me.loggedIn) return data;
      } catch (e) {}
      await new Promise(function (r) { setTimeout(r, 400); });
    }
    throw new Error('ເຂົ້າສູ່ລະບົບແລ້ວ ແຕ່ browser ບໍ່ເກັບ cookie — ກະລຸນາປິດໂໝດສ່ວນຕົວ/ເປີດ cookie ແລ້ວລອງໃໝ່');
  }

  function finish(showSuccess, fxOpts) {
    // ล็อกอินสำเร็จ: ถ้ามี next -> ไปหน้านั้น, ไม่มี -> โหลดหน้าเดิมซ้ำให้ header/เมนูเป็นสถานะล็อกอิน
    var go = function () { if (nextPath) location.href = nextPath; else location.reload(); };
    close(true);
    if (showSuccess && window.LoginSuccess) window.LoginSuccess.show(fxOpts).then(go); else go();
  }

  function onLogin(e) {
    e.preventDefault();
    var email = overlay.querySelector('#lm-l-email').value.trim(), pw = overlay.querySelector('#lm-l-pw').value, ok = true;
    if (!email) { setErr('l-email', 'ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້'); ok = false; }
    else if (email.indexOf('@') > -1 ? !emailRe.test(email) : !/^[A-Za-z0-9._-]{3,24}$/.test(email)) { setErr('l-email', 'ຊື່ຜູ້ໃຊ້ບໍ່ຖືກຕ້ອງ'); ok = false; } else setErr('l-email', '');
    if (pw.length < 6) { setErr('l-pw', 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ໂຕ'); ok = false; } else setErr('l-pw', '');
    if (!ok) return;
    var btn = e.target.querySelector('.lm-submit'), txt = btn.textContent;
    btn.disabled = true; btn.textContent = 'ກຳລັງເຂົ້າສູ່ລະບົບ...';
    if (window.LoginSuccess) window.LoginSuccess.unlock();
    var done = false;
    authRequest('/api/auth/login', { username: email, password: pw }, 'ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ')
      .then(function () { done = true; finish(true); })
      .catch(function (err) { toast(err.message || 'ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ', true); if (window.LoginSuccess) window.LoginSuccess.error(); })
      .finally(function () { if (!done) { btn.disabled = false; btn.textContent = txt; } });
  }

  function onSignup(e) {
    e.preventDefault();
    var u = overlay.querySelector('#lm-s-user').value.trim(), em = overlay.querySelector('#lm-s-email').value.trim(),
        pw = overlay.querySelector('#lm-s-pw').value, pw2 = overlay.querySelector('#lm-s-pw2').value, ok = true;
    if (!/^[A-Za-z0-9._-]{3,24}$/.test(u)) { setErr('s-user', 'Username: 3-24 characters, English letters, numbers, . _ - only'); ok = false; } else setErr('s-user', '');
    if (em && !emailRe.test(em)) { setErr('s-email', 'ກະລຸນາໃສ່ອີເມວໃຫ້ຖືກຕ້ອງ ຫຼື ເວ້ນວ່າງໄວ້'); ok = false; } else setErr('s-email', '');
    if (pw.length < 6) { setErr('s-pw', 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ໂຕ'); ok = false; } else setErr('s-pw', '');
    if (!pw2 || pw2 !== pw) { setErr('s-pw2', 'ລະຫັດຜ່ານບໍ່ກົງກັນ'); ok = false; } else setErr('s-pw2', '');
    if (!overlay.querySelector('#lm-s-terms').checked) { toast('ກະລຸນາຍອມຮັບເງື່ອນໄຂການນຳໃຊ້ກ່ອນ', true); ok = false; }
    if (!ok) return;
    var btn = e.target.querySelector('.lm-submit'), txt = btn.textContent;
    btn.disabled = true; btn.textContent = 'ກຳລັງສ້າງບັນຊີ...';
    if (window.LoginSuccess) window.LoginSuccess.unlock();
    var done = false;
    authRequest('/api/auth/signup', { username: u, email: em, password: pw }, 'ສະໝັກສະມາຊິກບໍ່ສຳເລັດ')
      .then(function () { done = true; finish(true, { title: 'ສະໝັກສະມາຊິກສຳເລັດ' }); })
      .catch(function (err) { toast(err.message || 'ສະໝັກສະມາຊິກບໍ່ສຳເລັດ', true); if (window.LoginSuccess) window.LoginSuccess.error(); })
      .finally(function () { if (!done) { btn.disabled = false; btn.textContent = txt; } });
  }

  /* ---------- อนิเมชั่น "ปุ่มลงชื่อ ขยายเป็นการ์ด" (เฉพาะตอนกดปุ่มลงชื่อบนหัวเว็บ) ----------
     ใช้ element รูปทรง (shape) ที่ขยายจากตำแหน่งปุ่ม -> ตำแหน่งการ์ด แล้วค่อยเฟดการ์ดจริงขึ้นมาทับ
     (ไม่ยืดตัวหนังสือ ไม่เพี้ยนมุมโค้ง) ปิดการ์ด = เล่นย้อนกลับเข้าปุ่มเดิม
     ทางเปิดอื่นๆ (ลิงก์, ปุ่มเมนู ฯลฯ) ยังเด้งแบบเดิมทุกอย่าง */
  var EASE_OUT = 'cubic-bezier(.22,1,.36,1)', EASE_IN = 'cubic-bezier(.55,0,.35,1)';
  var morph = null; // { el, shape, ghost, closing }

  function canMorph() {
    try {
      if (!document.documentElement.animate) return false;
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      return !!(window.CSS && CSS.supports && CSS.supports('border-radius', '1px'));
    } catch (e) { return false; }
  }
  function rectOf(r) { return { left: r.left, top: r.top, width: r.width, height: r.height }; }
  var SH0 = '0 0 0 rgba(0,0,0,0)', SH1 = '0 24px 70px rgba(0,0,0,.65)';
  function boxCss(r, rad, bg, bd, sh) {
    return { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
             borderRadius: rad + 'px', backgroundColor: bg, borderColor: bd, boxShadow: sh };
  }
  function originStyle(el) {
    var cs = getComputedStyle(el), r = el.getBoundingClientRect();
    var rad = parseFloat(cs.borderTopLeftRadius); if (!(rad >= 0)) rad = 14;
    rad = Math.min(rad, r.height / 2);
    var bg = cs.backgroundColor;
    if (!bg || bg === 'transparent' || /rgba\(.*,\s*0\)$/.test(bg)) bg = '#1a1a1a';
    return { rect: rectOf(r), rad: rad, bg: bg };
  }
  function clearMorph() {
    if (!morph) return;
    try { morph.shape.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) {}
    try { morph.ghost.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) {}
    try { card.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) {}
    if (morph.shape.parentNode) morph.shape.parentNode.removeChild(morph.shape);
    if (morph.ghost.parentNode) morph.ghost.parentNode.removeChild(morph.ghost);
    overlay.classList.remove('lm-morph');
    morph = null;
  }
  function makeGhost(el, o) { // สำเนาไอคอน+ข้อความของปุ่ม ให้เห็นว่าเป็นปุ่มเดิมก่อนมันขยาย
    var cs = getComputedStyle(el), g = document.createElement('div');
    g.className = 'lm-ghost';
    g.innerHTML = el.innerHTML;
    var s = g.style;
    s.left = o.rect.left + 'px'; s.top = o.rect.top + 'px'; s.width = o.rect.width + 'px'; s.height = o.rect.height + 'px';
    s.color = cs.color; s.fontFamily = cs.fontFamily; s.fontSize = cs.fontSize; s.fontWeight = cs.fontWeight; s.lineHeight = cs.lineHeight; s.letterSpacing = cs.letterSpacing; s.gap = cs.columnGap && cs.columnGap !== 'normal' ? cs.columnGap : '6px';
    return g;
  }
  function openMorph(el) { // เรียกหลัง overlay เป็น display:flex และใส่คลาส lm-morph แล้ว (ก่อนใส่ is-open)
    var o = originStyle(el), c = card.getBoundingClientRect();
    var shape = document.createElement('div'); shape.className = 'lm-shape';
    var ghost = makeGhost(el, o);
    overlay.insertBefore(shape, card); overlay.appendChild(ghost);
    morph = { el: el, shape: shape, ghost: ghost, closing: false };
    var cr = rectOf(c), CARD_BG = '#0a0a0a', CARD_BD = '#1e1e1e';
    var from = boxCss(o.rect, o.rad, o.bg, o.bg, SH0), to = boxCss(cr, 22, CARD_BG, CARD_BD, SH1);
    Object.keys(from).forEach(function (k) { shape.style[k] = from[k]; });
    var sa = shape.animate([from, to], { duration: 480, easing: EASE_OUT, fill: 'both' });
    ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 170, easing: 'ease-out', fill: 'both' });
    card.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 280, delay: 190, easing: 'ease-out', fill: 'both' });
    var mine = morph;
    sa.onfinish = function () {
      if (morph !== mine || mine.closing) return;
      // จบแล้ว: ทิ้ง shape/ghost คงไว้แต่การ์ดจริง (สภาพสุดท้ายเหมือนกันทุกพิกเซล)
      try { card.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) {}
      if (mine.shape.parentNode) mine.shape.parentNode.removeChild(mine.shape);
      if (mine.ghost.parentNode) mine.ghost.parentNode.removeChild(mine.ghost);
      mine.done = true;
    };
  }
  function closeMorph() { // เล่นย้อนกลับ: การ์ดหุบกลับเข้าปุ่ม
    var m = morph; if (!m || m.closing) return;
    m.closing = true;
    var el = m.el;
    if (!document.body.contains(el)) { clearMorph(); return false; }
    var o = originStyle(el), c = card.getBoundingClientRect(), cr = rectOf(c);
    try { card.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) {}
    try { m.shape.getAnimations().forEach(function (a) { a.cancel(); }); } catch (e) {}
    if (!m.shape.parentNode) overlay.insertBefore(m.shape, card);
    if (!m.ghost.parentNode) overlay.appendChild(m.ghost);
    var from = boxCss(cr, 22, '#0a0a0a', '#1e1e1e', SH1), to = boxCss(o.rect, o.rad, o.bg, o.bg, SH0);
    Object.keys(from).forEach(function (k) { m.shape.style[k] = from[k]; });
    var g = m.ghost.style;
    g.left = o.rect.left + 'px'; g.top = o.rect.top + 'px'; g.width = o.rect.width + 'px'; g.height = o.rect.height + 'px';
    overlay.classList.remove('is-open');           // พื้นหลังมืดค่อยๆ จาง (transition ใน CSS)
    overlay.classList.add('lm-morph-out');
    card.style.opacity = '0';                       // การ์ดจริงซ่อน เหลือแต่ shape หุบ
    card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 130, easing: 'ease-out', fill: 'both' });
    var sa = m.shape.animate([from, to], { duration: 340, delay: 50, easing: EASE_IN, fill: 'both' });
    m.ghost.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, delay: 210, easing: 'ease-in', fill: 'both' });
    sa.onfinish = function () {
      if (morph !== m) return;
      overlay.style.display = 'none';
      clearMorph();
      card.style.opacity = '';
      overlay.classList.remove('lm-morph-out');
    };
    return true;
  }

  /* ---------- เปิด / ปิด ---------- */
  /* โลโก้ร้าน: ใช้ของที่แอดมินตั้งใน "ຕັ້ງຄ່າຮ້ານ" (settings.logo_url) แทนไฟล์เดิม */
  var shopLogoUrl = '';
  var logoFetched = false;
  function applyShopLogo() {
    if (!overlay) return;
    var img = overlay.querySelector('.lm-logo img');
    if (!img) return;
    if (!shopLogoUrl) {
      var hdr = document.querySelector('.logo img');
      if (hdr && hdr.getAttribute('src') && hdr.getAttribute('src').indexOf('assets/logo.png') === -1) shopLogoUrl = hdr.getAttribute('src');
    }
    if (shopLogoUrl && img.getAttribute('src') !== shopLogoUrl) img.setAttribute('src', shopLogoUrl);
  }
  function loadShopLogo() {
    if (logoFetched) { applyShopLogo(); return; }
    logoFetched = true;
    fetch('/api/public/storefront', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var u = d && d.store && d.store.logoUrl ? String(d.store.logoUrl).trim() : '';
        if (u) shopLogoUrl = u;
        applyShopLogo();
      })
      .catch(function () { logoFetched = false; applyShopLogo(); });
  }

  function open(opts) {
    opts = opts || {};
    if (!overlay) build();
    loadShopLogo();
    ensureSuccessFx();
    if (morph) { if (morph.closing) return; clearMorph(); } // กันกดซ้ำระหว่างอนิเมชั่น
    nextPath = safeNext(opts.next);
    setTab(opts.tab === 'signup' ? 'signup' : 'login');
    lastFocus = document.activeElement;
    document.documentElement.classList.add('lm-open');
    var origin = opts.origin && document.body.contains(opts.origin) && canMorph() ? opts.origin : null;
    overlay.classList.remove('lm-morph-out');
    if (origin) overlay.classList.add('lm-morph'); else overlay.classList.remove('lm-morph');
    overlay.style.display = 'flex';
    void overlay.offsetWidth; // ให้ transition เล่น
    if (origin) openMorph(origin);
    overlay.classList.add('is-open');
    setTimeout(function () {
      var first = overlay.querySelector('.lm-form:not([hidden]) input');
      if (first && window.innerWidth > 700) first.focus(); // มือถือไม่โฟกัสอัตโนมัติ เพื่อไม่ให้คีย์บอร์ดดันการ์ดทันที
    }, 280);
  }
  function close(keepLocked) {
    if (!overlay) return;
    if (keepLocked !== true) document.documentElement.classList.remove('lm-open');
    if (morph && !morph.closing) {
      if (keepLocked === true) clearMorph();   // ล็อกอินสำเร็จ: ใช้การปิดแบบเดิม (ต่อด้วยหน้า success)
      else if (closeMorph()) { try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (e) {} return; }
    }
    overlay.classList.remove('is-open');
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
  }

  /* ---------- ดักคลิก: ลิงก์ไป login/signup และปุ่มโปรไฟล์ตอนยังไม่ล็อกอิน ---------- */
  var authRe = /(^|\/)(login|signup)(\.html)?$/;
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (overlay && overlay.contains(e.target)) return;

    var a = e.target.closest && e.target.closest('a[href]');
    if (a && !a.hasAttribute('data-no-modal') && !(location.pathname.match(authRe))) {
      var url; try { url = new URL(a.getAttribute('href'), location.href); } catch (err) { url = null; }
      if (url && url.origin === location.origin && authRe.test(url.pathname)) {
        e.preventDefault(); e.stopImmediatePropagation();
        open({ tab: /signup/.test(url.pathname) ? 'signup' : 'login', next: url.searchParams.get('next') || '',
               origin: (a.id === 'trialBal' || a.hasAttribute('data-lm-morph')) ? a : null }); // ปุ่มลงชื่อบนหัวเว็บ = ขยายเป็นการ์ด
        return;
      }
    }
    var btn = e.target.closest && e.target.closest('.login-btn');
    if (btn && !btn.classList.contains('is-authed') && !btn.classList.contains('is-reseller') && !(location.pathname.match(authRe))) {
      e.preventDefault(); e.stopImmediatePropagation();
      open({ tab: 'login' });
    }
  }, true); // capture: ทำงานก่อน script.js / page-transition.js จึงไม่เกิดการเปลี่ยนหน้า

  window.LoginModal = { open: open, close: close };
})();
