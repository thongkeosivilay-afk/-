/* =========================================================
   auth.js — ການເຮັດວຽກຂອງໜ້າ login.html / signup.html
   1) ປຸ່ມສະແດງ/ເຊື່ອງລະຫັດຜ່ານ
   2) ກວດຄວາມຖືກຕ້ອງຂອງຟອມ (client-side) + toast ແຈ້ງເຕືອນ
   3) ປຸ່ມ Discord -> /auth/discord/login (ຕໍ່ກັບ worker ຈິງ)

   ໝາຍເຫດ: ຟອມອີເມວ/ລະຫັດຜ່ານໃນໄຟລ໌ນີ້ຍັງເປັນ client-side ຢ່າງດຽວ
   (ຍັງບໍ່ໄດ້ຕໍ່ກັບ backend ຈິງ) — ໃຫ້ຕໍ່ API ຂອງທ່ານເອງທີ່ຈຸດທີ່ໝາຍ TODO
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- 0) ດຶງຊື່ຮ້ານຈິງທີ່ແອດມິນຕັ້ງໄວ້ ມາໃສ່ .auth-brand (ຄືກັນກັບ index.html/category.html) ---------- */
  if (window.StorefrontData) {
    window.StorefrontData.fetchData()
      .then((data) => window.StorefrontData.applyStoreBranding(data.store))
      .catch((err) => console.error('auth.js: applyStoreBranding failed', err));
  }

  /* ---------- 1) Password show/hide toggle ---------- */
  document.querySelectorAll('.field-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.field-input').querySelector('input');
      const isPw = input.type === 'password';
      input.type = isPw ? 'text' : 'password';
      btn.setAttribute('aria-label', isPw ? 'ເຊື່ອງລະຫັດຜ່ານ' : 'ສະແດງລະຫັດຜ່ານ');
      btn.classList.toggle('is-visible', isPw);
    });
  });

  /* ---------- 2) Toast helper ---------- */
  let toastTimer = null;
  function showToast(message, isError = false, duration = 2600) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z"/></svg><span></span>`;
      document.body.appendChild(toast);
    }
    toast.classList.toggle('error', isError);
    toast.querySelector('span').textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
  }

  /* ---------- 3) Discord / Google buttons ---------- */
  // ถ้า URL หน้านี้มี ?next=/xxx.html (เช่น มาจากหน้าโปรไฟล์ที่ยังไม่ login) ให้พาไปที่นั่นต่อหลัง login สำเร็จ
  const nextParam = new URLSearchParams(window.location.search).get('next');
  // กันกดซ้ำจนเริ่ม OAuth หลายรอบ (แต่ละรอบสร้าง state ใหม่ ทับ cookie state รอบก่อน -> callback รอบแรกจะ state ไม่ตรง)
  // ต้องรีเซ็ตตอนกลับมาหน้านี้ด้วยปุ่มย้อนกลับ (iOS Safari เก็บหน้าไว้ใน bfcache) ไม่งั้นปุ่มจะกดไม่ติดอีกเลย
  let oauthBusy = false;
  window.addEventListener('pageshow', () => { oauthBusy = false; });
  function startOAuth(provider) {
    if (oauthBusy) return;
    oauthBusy = true;
    window.location.href = `/auth/${provider}/login` + (nextParam ? `?next=${encodeURIComponent(nextParam)}` : '');
  }
  document.querySelectorAll('.btn-discord').forEach((btn) => {
    btn.addEventListener('click', () => startOAuth('discord'));
  });
  document.querySelectorAll('.btn-google').forEach((btn) => {
    btn.addEventListener('click', () => startOAuth('google'));
  });

  // ข้อความแจ้งเตือนเมื่อ Worker ส่งกลับมาที่ /login.html?error=<รหัส> (ผู้ใช้ยกเลิก / state หมดอายุ / ผู้ให้บริการขัดข้อง ฯลฯ)
  const AUTH_ERRORS = {
    cancelled: 'ທ່ານໄດ້ຍົກເລີກການເຂົ້າສູ່ລະບົບ',
    state: 'ລິ້ງເຂົ້າສູ່ລະບົບໝົດອາຍຸ ກະລຸນາກົດເຂົ້າສູ່ລະບົບໃໝ່ອີກຄັ້ງ',
    provider: 'ເຊື່ອມຕໍ່ກັບ Google/Discord ບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່',
    profile: 'ດຶງຂໍ້ມູນບັນຊີບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່',
    server: 'ລະບົບຂັດຂ້ອງຊົ່ວຄາວ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ',
  };
  const authErrCode = new URLSearchParams(window.location.search).get('error');
  if (authErrCode) {
    const msg = Object.prototype.hasOwnProperty.call(AUTH_ERRORS, authErrCode) ? AUTH_ERRORS[authErrCode] : AUTH_ERRORS.server;
    showToast(msg, true, 6000);
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('error');
      window.history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) { /* ไม่เป็นไร */ }
  }

  /* ---------- 4) Form validation helpers ---------- */
  function setFieldError(fieldEl, message) {
    fieldEl.classList.toggle('has-error', !!message);
    const errEl = fieldEl.querySelector('.field-error');
    if (errEl) errEl.textContent = message || '';
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ---- ຄວາມປອດໄພ: ?next= ມາຈາກ URL (ຜູ້ໃຊ້ຄວບຄຸມໄດ້) ຫ້າມເອົາໄປໃສ່ window.location.href
  // ກົງໆ ບໍ່ດັ່ງນັ້ນຄົນຮ້າຍສາມາດປ້ອນ ?next=https://evil-site.com ແລ້ວສົ່ງລິ້ງໃຫ້ເຫຍື່ອກົດ —
  // ຫຼັງ login/signup ສຳເລັດ (ຜ່ານໜ້າ login.html ຂອງເຮົາຈິງ, ເບິ່ງໜ້າ URL ຖືກຕ້ອງໝົດ) ຈະຖືກ
  // ເດ້ງອອກໄປເວັບປອມທັນທີ (open redirect -> ໃຊ້ phishing ຕໍ່ໄດ້) ຈຶ່ງຕ້ອງຮັບສະເພາະ path
  // ພາຍໃນເວັບຕົວເອງ (ຂຶ້ນຕົ້ນດ້ວຍ "/" ຢ່າງດຽວ, ບໍ່ໃຫ້ຂຶ້ນຕົ້ນດ້ວຍ "//" ເພາະ browser ຈະຕີຄວາມ
  // ເປັນ protocol-relative URL ໄປໂດເມນອື່ນໄດ້ຄືກັນ) — ໃຊ້ helper ດຽວກັນນີ້ທັງ login ແລະ signup
  function safeNextPath(raw) {
    if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return '/';
    return raw;
  }

  // ---- ສົ່ງຄຳຂໍໄປ API ແບບທົນຕໍ່ error: ມີ timeout, ອ່ານ response ທີ່ບໍ່ແມ່ນ JSON ໄດ້, ແລະ ກວດວ່າ session ຕິດຈິງ (/api/me) ກ່ອນເປີດໜ້າຕໍ່ໄປ ----
  async function authRequest(url, payload, failMsg) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
        signal: ctrl.signal,
      });
    } catch (err) {
      throw new Error(err && err.name === 'AbortError'
        ? 'ເຊື່ອມຕໍ່ຊ້າເກີນໄປ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ'
        : 'ເຊື່ອມຕໍ່ອິນເຕີເນັດບໍ່ໄດ້ ກະລຸນາກວດເນັດແລ້ວລອງໃໝ່');
    } finally {
      clearTimeout(timer);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || (failMsg + ' (HTTP ' + res.status + ')'));

    // ຢືນຢັນວ່າ cookie session ຖືກເກັບແລ້ວຈິງ (ບາງ browser/ໂໝດສ່ວນຕົວບລັອກ cookie) — ລອງ 3 ເທື່ອ
    for (let i = 0; i < 3; i++) {
      try {
        const meRes = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' });
        const me = await meRes.json().catch(() => ({}));
        if (me && me.loggedIn) return data;
      } catch (e) { /* ລອງໃໝ່ */ }
      await new Promise((r) => setTimeout(r, 400));
    }
    throw new Error('ເຂົ້າສູ່ລະບົບແລ້ວ ແຕ່ browser ບໍ່ເກັບ cookie — ກະລຸນາປິດໂໝດສ່ວນຕົວ/ເປີດ cookie ແລ້ວລອງໃໝ່');
  }

  /* ---------- 5) Login form ---------- */
  const loginForm = document.querySelector('#login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailField = loginForm.querySelector('#login-email-field');
      const pwField = loginForm.querySelector('#login-password-field');
      const email = emailField.querySelector('input').value.trim();
      const pw = pwField.querySelector('input').value;

      let ok = true;
      if (!emailPattern.test(email)) { setFieldError(emailField, 'ກະລຸນາໃສ່ອີເມວໃຫ້ຖືກຕ້ອງ'); ok = false; }
      else setFieldError(emailField, '');

      if (pw.length < 6) { setFieldError(pwField, 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ໂຕ'); ok = false; }
      else setFieldError(pwField, '');

      if (!ok) return;

      const submitBtn = loginForm.querySelector('.btn-submit');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'ກຳລັງເຂົ້າສູ່ລະບົບ...';

      authRequest('/api/auth/login', { email, password: pw }, 'ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ')
        .then(() => {
          const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
          window.location.href = next;
        })
        .catch((err) => {
          showToast(err.message || 'ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ', true);
        })
        .finally(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        });
    });
  }

  /* ---------- 6) Signup form ---------- */
  const signupForm = document.querySelector('#signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const userField = signupForm.querySelector('#signup-username-field');
      const emailField = signupForm.querySelector('#signup-email-field');
      const pwField = signupForm.querySelector('#signup-password-field');
      const pw2Field = signupForm.querySelector('#signup-password2-field');
      const termsBox = signupForm.querySelector('#signup-terms');

      const username = userField.querySelector('input').value.trim();
      const email = emailField.querySelector('input').value.trim();
      const pw = pwField.querySelector('input').value;
      const pw2 = pw2Field.querySelector('input').value;

      let ok = true;
      if (username.length < 3) { setFieldError(userField, 'ຊື່ຜູ້ໃຊ້ຕ້ອງມີຢ່າງໜ້ອຍ 3 ໂຕ'); ok = false; }
      else setFieldError(userField, '');

      if (!emailPattern.test(email)) { setFieldError(emailField, 'ກະລຸນາໃສ່ອີເມວໃຫ້ຖືກຕ້ອງ'); ok = false; }
      else setFieldError(emailField, '');

      if (pw.length < 6) { setFieldError(pwField, 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ໂຕ'); ok = false; }
      else setFieldError(pwField, '');

      if (pw2 !== pw || !pw2) { setFieldError(pw2Field, 'ລະຫັດຜ່ານບໍ່ກົງກັນ'); ok = false; }
      else setFieldError(pw2Field, '');

      if (termsBox && !termsBox.checked) {
        showToast('ກະລຸນາຍອມຮັບເງື່ອນໄຂການນຳໃຊ້ກ່ອນ', true);
        ok = false;
      }

      if (!ok) return;

      const submitBtn = signupForm.querySelector('.btn-submit');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'ກຳລັງສ້າງບັນຊີ...';

      authRequest('/api/auth/signup', { username, email, password: pw }, 'ສະໝັກສະມາຊິກບໍ່ສຳເລັດ')
        .then(() => {
          const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
          window.location.href = next;
        })
        .catch((err) => {
          showToast(err.message || 'ສະໝັກສະມາຊິກບໍ່ສຳເລັດ', true);
        })
        .finally(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        });
    });
  }

});
