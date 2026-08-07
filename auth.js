/* =========================================================
   auth.js — ການເຮັດວຽກຂອງໜ້າ login.html / signup.html
   1) 3D tilt effect ຂອງກ່ອງບັດ (card) ຕາມຕຳແໜ່ງເມົາສ໌ / ນິ້ວມື
   2) ປຸ່ມສະແດງ/ເຊື່ອງລະຫັດຜ່ານ
   3) ກວດຄວາມຖືກຕ້ອງຂອງຟອມ (client-side) + toast ແຈ້ງເຕືອນ
   4) ປຸ່ມ Discord -> /auth/discord/login (ຕໍ່ກັບ worker ຈິງ)

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

  /* ---------- 1) 3D tilt on the auth card ---------- */
  const card = document.querySelector('.auth-card');
  const crest = document.querySelector('.auth-crest-inner');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (card && !prefersReducedMotion) {
    const maxTilt = 6; // degrees, kept subtle on purpose

    const applyTilt = (clientX, clientY) => {
      const rect = card.getBoundingClientRect();
      const px = (clientX - rect.left) / rect.width;  // 0..1
      const py = (clientY - rect.top) / rect.height;  // 0..1
      const rotateY = (px - 0.5) * maxTilt * 2;
      const rotateX = (0.5 - py) * maxTilt * 2;
      card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      if (crest) crest.style.transform = `rotateX(${rotateX * 0.6}deg) rotateY(${rotateY * 0.6}deg)`;
    };

    const resetTilt = () => {
      card.style.transform = 'rotateX(0deg) rotateY(0deg)';
      if (crest) crest.style.transform = 'rotateX(0deg) rotateY(0deg)';
    };

    window.addEventListener('mousemove', (e) => applyTilt(e.clientX, e.clientY));
    window.addEventListener('mouseleave', resetTilt);
    window.addEventListener('touchmove', (e) => {
      if (e.touches[0]) applyTilt(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchend', resetTilt);
  }

  /* ---------- 2) Password show/hide toggle ---------- */
  document.querySelectorAll('.field-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.field-input').querySelector('input');
      const isPw = input.type === 'password';
      input.type = isPw ? 'text' : 'password';
      btn.setAttribute('aria-label', isPw ? 'ເຊື່ອງລະຫັດຜ່ານ' : 'ສະແດງລະຫັດຜ່ານ');
      btn.classList.toggle('is-visible', isPw);
    });
  });

  /* ---------- 3) Toast helper ---------- */
  let toastTimer = null;
  function showToast(message, isError = false) {
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
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  /* ---------- 4) Discord buttons ---------- */
  // ถ้า URL หน้านี้มี ?next=/xxx.html (เช่น มาจากหน้าโปรไฟล์ที่ยังไม่ login) ให้พาไปที่นั่นต่อหลัง login สำเร็จ
  const nextParam = new URLSearchParams(window.location.search).get('next');
  document.querySelectorAll('.btn-discord').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = '/auth/discord/login' + (nextParam ? `?next=${encodeURIComponent(nextParam)}` : '');
      window.location.href = url;
    });
  });

  /* ---------- 5) Form validation helpers ---------- */
  function setFieldError(fieldEl, message) {
    fieldEl.classList.toggle('has-error', !!message);
    const errEl = fieldEl.querySelector('.field-error');
    if (errEl) errEl.textContent = message || '';
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ---------- 6) Login form ---------- */
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

      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pw }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ');
          const next = new URLSearchParams(window.location.search).get('next') || '/';
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

  /* ---------- 7) Signup form ---------- */
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

      fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password: pw }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'ສະໝັກສະມາຊິກບໍ່ສຳເລັດ');
          const next = new URLSearchParams(window.location.search).get('next') || '/';
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
