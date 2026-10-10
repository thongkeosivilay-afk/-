/* =========================================================
   profile.js — ການເຮັດວຽກຂອງໜ້າ profile.html
   1) ດຶງ /api/me -> ຖ້າຍັງບໍ່ login ໃຫ້ເດັ້ງໄປ login.html (ພ້ອມ ?next= ກັບມາໜ້ານີ້)
   2) ສະແດງຂໍ້ມູນບັນຊີ + ດຶງ /api/account/stats ມາໂຊວ໌ (ຕອນນີ້ຄືນ 0 ໄປກ່ອນ —
      ຈະໄດ້ຄ່າຈິງທັນທີທີ່ໂປຣເຈັກມີຕາຕະລາງ orders)
   3) ຟອມປ່ຽນລະຫັດຜ່ານ -> POST /api/account/change-password
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  function formatKip(n) {
    return Number(n || 0).toLocaleString('de-DE');
  }
  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('lo-LA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  }
  function initials(name) {
    return (name || '?').trim().slice(0, 1).toUpperCase();
  }

  /* ---------- Toast (แชร์แบบเดียวกับ auth.css/.toast) ---------- */
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
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  /* ---------- Password show/hide toggle ---------- */
  document.querySelectorAll('.field-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.field-input').querySelector('input');
      const isPw = input.type === 'password';
      input.type = isPw ? 'text' : 'password';
      btn.classList.toggle('is-visible', isPw);
    });
  });

  function setFieldError(fieldEl, message) {
    fieldEl.classList.toggle('has-error', !!message);
    const errEl = fieldEl.querySelector('.field-error');
    if (errEl) errEl.textContent = message || '';
  }

  /* ---------- Animation helpers ---------- */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ຕົວເລກວິ່ງຂຶ້ນຈາກ 0 -> target (ease-out)
  function countTo(el, target, withUnit, delay) {
    const end = Number(target) || 0;
    const render = (v) => { el.innerHTML = formatKip(Math.round(v)) + (withUnit ? '<span class="unit"> ₭</span>' : ''); };
    if (reduceMotion || end === 0) { render(end); return; }
    render(0);
    const dur = 1100;
    setTimeout(() => {
      const t0 = performance.now();
      (function tick(now) {
        const p = Math.min(1, (now - t0) / dur);
        render(end * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    }, delay || 0);
  }
  // ແຕກແສງເປັນອະນຸພາກສີແດງອອກຈາກຮູບ ຕອນບັນທຶກສຳເລັດ
  function burst(host) {
    if (reduceMotion || !host) return;
    const n = 18;
    for (let i = 0; i < n; i++) {
      const dot = document.createElement('i');
      dot.className = 'p-burst';
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.3;
      const dist = 52 + Math.random() * 40;
      dot.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      dot.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      dot.style.setProperty('--s', (0.5 + Math.random() * 0.9).toFixed(2));
      dot.style.animationDelay = (Math.random() * 60) + 'ms';
      host.appendChild(dot);
      setTimeout(() => dot.remove(), 900);
    }
    const ring = document.createElement('i');
    ring.className = 'p-burst-ring';
    host.appendChild(ring);
    setTimeout(() => ring.remove(), 900);
  }
  function replay(el, cls) {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }

  /* ---------- Avatar / Name (ແກ້ໄຂໂປຣໄຟລ໌) ---------- */
  const AVATAR_PREFIX = '/api/public/avatar/';
  const state = { username: '', avatar: null, pending: null };
  const avatarBox = document.getElementById('pAvatarBox');
  const avatarInput = document.getElementById('pAvatarInput');
  const avatarActions = document.getElementById('pAvatarActions');
  const avatarRemoveBtn = document.getElementById('pAvatarRemoveBtn');
  const nameInput = document.getElementById('pName');
  const nameSaveBtn = document.getElementById('pNameSaveBtn');
  const nameCount = document.getElementById('pNameCount');

  function esc(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function renderAvatar(url) {
    if (url) {
      avatarBox.innerHTML = `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer">`;
      avatarBox.querySelector('img').addEventListener('error', () => {
        avatarBox.innerHTML = `<div class="p-avatar-fallback">${esc(initials(state.username))}</div>`;
      });
    } else {
      avatarBox.innerHTML = `<div class="p-avatar-fallback">${esc(initials(state.username))}</div>`;
    }
    avatarRemoveBtn.hidden = !(state.avatar && state.avatar.startsWith(AVATAR_PREFIX)) || !!state.pending;
  }
  function updateNameUi() {
    const v = nameInput.value.trim();
    nameCount.textContent = `${nameInput.value.length}/24`;
    nameSaveBtn.disabled = !v || v === state.username;
  }
  nameInput.addEventListener('input', () => { setFieldError(document.getElementById('pNameField'), ''); updateNameUi(); });

  document.getElementById('pAvatarEditBtn').addEventListener('click', () => avatarInput.click());
  avatarBox.addEventListener('click', () => avatarInput.click());

  // ຍ່ອຮູບ: ຕັດເປັນສີ່ຫຼ່ຽມຈັດຕຸລັດກາງ 256x256 ແລ້ວ export JPEG (ຄຸມຂະໜາດ ≤ ~120KB ກ່ອນສົ່ງ)
  function fileToJpeg(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const size = 256;
          const side = Math.min(img.naturalWidth, img.naturalHeight);
          const sx = (img.naturalWidth - side) / 2;
          const sy = (img.naturalHeight - side) / 2;
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          let q = 0.88, out = canvas.toDataURL('image/jpeg', q);
          while (out.length > 150000 && q > 0.4) { q -= 0.1; out = canvas.toDataURL('image/jpeg', q); }
          resolve(out);
        } catch (err) { reject(err); } finally { URL.revokeObjectURL(objUrl); }
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('bad image')); };
      img.src = objUrl;
    });
  }

  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files && avatarInput.files[0];
    avatarInput.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) { showToast('ກະລຸນາເລືອກໄຟລ໌ຮູບພາບ', true); return; }
    if (file.size > 12 * 1024 * 1024) { showToast('ຮູບໃຫຍ່ເກີນໄປ (ສູງສຸດ 12MB)', true); return; }
    try {
      state.pending = await fileToJpeg(file);
    } catch {
      showToast('ອ່ານຮູບບໍ່ໄດ້, ລອງຮູບອື່ນ', true);
      return;
    }
    renderAvatar(state.pending);
    replay(avatarBox, 'p-pop');
    avatarActions.hidden = false;
  });

  document.getElementById('pAvatarCancelBtn').addEventListener('click', () => {
    state.pending = null;
    avatarActions.hidden = true;
    renderAvatar(state.avatar);
  });

  async function postJson(url, payload) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    let data = {};
    try { data = await res.json(); } catch { /* ignore */ }
    return { ok: res.ok, data };
  }

  document.getElementById('pAvatarSaveBtn').addEventListener('click', async () => {
    if (!state.pending) return;
    const btn = document.getElementById('pAvatarSaveBtn');
    btn.disabled = true; btn.textContent = 'ກຳລັງບັນທຶກ...';
    try {
      const { ok, data } = await postJson('/api/account/avatar', { image: state.pending });
      if (!ok) { showToast(data.error || 'ບັນທຶກຮູບບໍ່ສຳເລັດ', true); return; }
      state.avatar = data.avatar; state.pending = null;
      avatarActions.hidden = true;
      renderAvatar(state.avatar);
      replay(avatarBox, 'p-pop');
      burst(avatarBox.parentElement);
      showToast('ປ່ຽນຮູບໂປຣໄຟລ໌ແລ້ວ');
    } catch (err) {
      console.error('ບັນທຶກຮູບບໍ່ສຳເລັດ', err);
      showToast('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ', true);
    } finally {
      btn.disabled = false; btn.textContent = 'ບັນທຶກຮູບ';
    }
  });

  avatarRemoveBtn.addEventListener('click', async () => {
    if (!confirm('ລຶບຮູບທີ່ອັບໂຫຼດ ແລະ ໃຊ້ຮູບເດີມ?')) return;
    try {
      const { ok, data } = await postJson('/api/account/avatar', { remove: true });
      if (!ok) { showToast(data.error || 'ລຶບຮູບບໍ່ສຳເລັດ', true); return; }
      state.avatar = data.avatar || null;
      renderAvatar(state.avatar);
      replay(avatarBox, 'p-pop');
      showToast('ລຶບຮູບແລ້ວ');
    } catch (err) {
      console.error('ລຶບຮູບບໍ່ສຳເລັດ', err);
      showToast('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ', true);
    }
  });

  document.getElementById('pNameForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const field = document.getElementById('pNameField');
    const name = nameInput.value.replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > 24) { setFieldError(field, 'ຊື່ຕ້ອງມີ 2-24 ໂຕ'); return; }
    setFieldError(field, '');
    nameSaveBtn.disabled = true;
    const original = nameSaveBtn.textContent;
    nameSaveBtn.textContent = 'ກຳລັງບັນທຶກ...';
    try {
      const { ok, data } = await postJson('/api/account/update-profile', { username: name });
      if (!ok) { setFieldError(field, data.error || 'ບັນທຶກຊື່ບໍ່ສຳເລັດ'); return; }
      state.username = data.username;
      nameInput.value = data.username;
      document.getElementById('pUsername').textContent = data.username;
      document.getElementById('pInfoUsername').textContent = data.username;
      if (!state.avatar) renderAvatar(null);
      replay(document.getElementById('pUsername'), 'p-swap');
      replay(document.getElementById('pNameField'), 'p-ok');
      showToast('ບັນທຶກຊື່ແລ້ວ');
    } catch (err) {
      console.error('ບັນທຶກຊື່ບໍ່ສຳເລັດ', err);
      showToast('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ', true);
    } finally {
      nameSaveBtn.textContent = original;
      updateNameUi();
    }
  });

  const loadingEl = document.getElementById('pLoading');
  const contentEl = document.getElementById('pContent');

  (async () => {
    let me;
    try {
      const res = await fetch('/api/me', { cache: 'no-store' });
      me = await res.json();
    } catch (err) {
      console.error('ດຶງ /api/me ບໍ່ສຳເລັດ', err);
      loadingEl.textContent = 'ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ';
      return;
    }

    if (!me.loggedIn) {
      const next = encodeURIComponent('/profile.html');
      window.location.href = `/login.html?next=${next}`;
      return;
    }

    const user = me.user || {};

    // ---- Avatar ----
    // ຄວາມປອດໄພ: user.username / avatar ມາຈາກຜູ້ໃຊ້ — ຫ້າມໃສ່ innerHTML ຕົງໆ (stored XSS) ໃຊ້ esc() ທຸກຄັ້ງ
    state.username = user.username || '';
    state.avatar = user.avatar || null;
    renderAvatar(state.avatar);

    // ---- Name / badge ----
    document.getElementById('pUsername').textContent = user.username || 'ຜູ້ໃຊ້';
    document.getElementById('pInfoUsername').textContent = user.username || '—';
    nameInput.value = user.username || '';
    updateNameUi();
    const badge = document.getElementById('pBadge');
    const badgeText = document.getElementById('pBadgeText');
    badge.classList.toggle('is-admin', !!user.isAdmin);
    badgeText.textContent = user.isAdmin ? 'ADMIN' : 'ຜູ້ໃຊ້';

    // ---- Balance ----
    countTo(document.getElementById('pStatBalance'), user.balance, true, 450);

    // ---- Account info rows ----
    document.getElementById('pInfoEmail').textContent = user.email || 'ບໍ່ມີ';
    document.getElementById('pInfoCreated').textContent = formatDate(user.createdAt);
    document.getElementById('pInfoLastLogin').textContent = formatDate(user.lastLoginAt);

    const discordCell = document.getElementById('pInfoDiscord');
    if (user.discordLinked) {
      discordCell.innerHTML = `
        <span class="p-discord-chip">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.32 4.37a19.8 19.8 0 0 0-4.9-1.52.07.07 0 0 0-.08.04c-.21.38-.45.86-.61 1.24a18.3 18.3 0 0 0-5.46 0 12.6 12.6 0 0 0-.62-1.24.08.08 0 0 0-.08-.04c-1.7.29-3.34.8-4.9 1.52a.07.07 0 0 0-.03.03C.53 8.7-.32 12.9.1 17.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.11 13 13 0 0 1-1.87-.9.08.08 0 0 1 0-.13c.13-.09.25-.19.37-.28a.07.07 0 0 1 .08 0c3.93 1.8 8.18 1.8 12.06 0a.07.07 0 0 1 .08 0c.12.1.24.19.37.28a.08.08 0 0 1 0 .13c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.04.12c.37.7.78 1.36 1.23 2a.08.08 0 0 0 .08.02 19.8 19.8 0 0 0 6.01-3.03.08.08 0 0 0 .03-.05c.5-4.83-.83-9-3.51-12.66a.06.06 0 0 0-.03-.03Z"/></svg>
          ເຊື່ອມຕໍ່ແລ້ວ
        </span>`;
    } else {
      discordCell.innerHTML = `<button type="button" class="p-connect-btn" id="pConnectDiscordBtn">ເຊື່ອມຕໍ່ Discord</button>`;
      const btn = document.getElementById('pConnectDiscordBtn');
      if (btn) {
        btn.addEventListener('click', () => {
          window.location.href = '/auth/discord/login?next=' + encodeURIComponent('/profile.html');
        });
      }
    }

    // ---- Password section: hide "current password" field if never set one ----
    const hasPassword = !!user.hasPassword;
    const currentPwField = document.getElementById('pCurrentPwField');
    const pwNote = document.getElementById('pPwNote');
    const pwCardTitle = document.getElementById('pPwCardTitle');
    if (!hasPassword) {
      currentPwField.style.display = 'none';
      pwNote.style.display = 'block';
      pwCardTitle.textContent = 'ຕັ້ງລະຫັດຜ່ານ';
    }

    loadingEl.style.display = 'none';
    [...contentEl.children].forEach((el, i) => el.style.setProperty('--i', i));
    contentEl.classList.add('ready');

    // ---- Order stats (best-effort — คืน 0 จนกว่าจะมีตาราง orders จริง) ----
    try {
      const statsRes = await fetch('/api/account/stats', { cache: 'no-store' });
      if (statsRes.ok) {
        const stats = await statsRes.json();
        countTo(document.getElementById('pStatOrders'), stats.ordersCompleted ?? 0, false, 600);
        countTo(document.getElementById('pStatSpent'), stats.totalSpent, true, 700);
      }
    } catch (err) {
      console.error('ດຶງ /api/account/stats ບໍ່ສຳເລັດ', err);
    }
  })();

  /* ---------- Change password form ---------- */
  const pwForm = document.getElementById('pPwForm');
  if (pwForm) {
    pwForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const currentField = document.getElementById('pCurrentPwField');
      const newField = document.getElementById('pNewPwField');
      const new2Field = document.getElementById('pNewPw2Field');

      const currentPw = document.getElementById('pCurrentPw').value;
      const newPw = document.getElementById('pNewPw').value;
      const newPw2 = document.getElementById('pNewPw2').value;

      let ok = true;
      if (currentField.style.display !== 'none' && !currentPw) {
        setFieldError(currentField, 'ກະລຸນາໃສ່ລະຫັດຜ່ານປັດຈຸບັນ');
        ok = false;
      } else {
        setFieldError(currentField, '');
      }

      if (newPw.length < 6) {
        setFieldError(newField, 'ລະຫັດຜ່ານໃໝ່ຕ້ອງມີຢ່າງໜ້ອຍ 6 ໂຕ');
        ok = false;
      } else {
        setFieldError(newField, '');
      }

      if (newPw2 !== newPw || !newPw2) {
        setFieldError(new2Field, 'ລະຫັດຜ່ານບໍ່ກົງກັນ');
        ok = false;
      } else {
        setFieldError(new2Field, '');
      }

      if (!ok) return;

      const submitBtn = pwForm.querySelector('.btn-submit');
      const originalHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.textContent = 'ກຳລັງບັນທຶກ...';

      try {
        const res = await fetch('/api/account/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
        });
        const data = await res.json();

        if (!res.ok) {
          showToast(data.error || 'ປ່ຽນລະຫັດຜ່ານບໍ່ສຳເລັດ', true);
          return;
        }

        showToast('ບັນທຶກລະຫັດຜ່ານສຳເລັດແລ້ວ');
        pwForm.reset();
        document.getElementById('pCurrentPwField').style.display = '';
        document.getElementById('pPwNote').style.display = 'none';
        document.getElementById('pPwCardTitle').textContent = 'ປ່ຽນລະຫັດຜ່ານ';
      } catch (err) {
        console.error('ປ່ຽນລະຫັດຜ່ານບໍ່ສຳເລັດ', err);
        showToast('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ', true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
      }
    });
  }


  // ຊື່ຮ້ານ/ໂລໂກ້ ໃນ header + footer (ຄືກັນກັບໜ້າຈັດອັນດັບ/ໜ້າຫຼັກ) — ກ່ອນນີ້ໜ້າໂປຣໄຟລ໌ບໍ່ໄດ້ເອີ້ນ
  // ເລີຍ ຊື່ຮ້ານຈຶ່ງຫາຍ ແລະ ໂລໂກ້ເປັນຮູບເລີ່ມຕົ້ນຂະໜາດໃຫຍ່
  if (window.StorefrontData) {
    window.StorefrontData.fetchData()
      .then((data) => { window.StorefrontData.applyStoreBranding(data.store); })
      .catch((err) => { console.error('profile.js: applyStoreBranding failed', err); });
  }

});
