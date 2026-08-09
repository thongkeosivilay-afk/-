/* =========================================================
   profile.js — ການເຮັດວຽກຂອງໜ້າ profile.html
   1) ດຶງ /api/me -> ຖ້າຍັງບໍ່ login ໃຫ້ເດັ້ງໄປ login.html (ພ້ອມ ?next= ກັບມາໜ້ານີ້)
   2) ສະແດງຂໍ້ມູນບັນຊີ + ດຶງ /api/account/stats ມາໂຊວ໌ (ຕອນນີ້ຄືນ 0 ໄປກ່ອນ —
      ຈະໄດ້ຄ່າຈິງທັນທີທີ່ໂປຣເຈັກມີຕາຕະລາງ orders)
   3) ຟອມປ່ຽນລະຫັດຜ່ານ -> POST /api/account/change-password
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  function formatKip(n) {
    return Number(n || 0).toLocaleString('th-TH');
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
    const avatarBox = document.getElementById('pAvatarBox');
    if (user.avatar) {
      avatarBox.innerHTML = `<img src="${user.avatar}" alt="${user.username || ''}">`;
    } else {
      avatarBox.innerHTML = `<div class="p-avatar-fallback">${initials(user.username)}</div>`;
    }

    // ---- Name / badge ----
    document.getElementById('pUsername').textContent = user.username || 'ຜູ້ໃຊ້';
    document.getElementById('pInfoUsername').textContent = user.username || '—';
    const badge = document.getElementById('pBadge');
    const badgeText = document.getElementById('pBadgeText');
    badge.classList.toggle('is-admin', !!user.isAdmin);
    badgeText.textContent = user.isAdmin ? 'ADMIN' : 'ຜູ້ໃຊ້';

    // ---- Balance ----
    document.getElementById('pStatBalance').innerHTML = `${formatKip(user.balance)}<span class="unit"> ₭</span>`;

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
    contentEl.classList.add('ready');

    // ---- Order stats (best-effort — คืน 0 จนกว่าจะมีตาราง orders จริง) ----
    try {
      const statsRes = await fetch('/api/account/stats', { cache: 'no-store' });
      if (statsRes.ok) {
        const stats = await statsRes.json();
        document.getElementById('pStatOrders').textContent = stats.ordersCompleted ?? 0;
        document.getElementById('pStatSpent').innerHTML = `${formatKip(stats.totalSpent)}<span class="unit"> ₭</span>`;
      }
    } catch (err) {
      console.error('ດຶງ /api/account/stats ບໍ່ສຳເລັດ', err);
    }

    // ---- Reseller status (ตัวแทน) ----
    await refreshResellerStatus();
  })();

  /* ---------- Reseller status (ตัวแทน) ---------- */
  const RESELLER_TIER_LABELS = { '7d': '7 ມື້', '14d': '14 ມື້', '30d': '30 ມື້', 'lifetime': 'ຖາວອນ' };

  async function refreshResellerStatus() {
    const redeemBox = document.getElementById('pResellerRedeemBox');
    const activeBox = document.getElementById('pResellerActiveBox');
    if (!redeemBox || !activeBox) return;

    try {
      const res = await fetch('/api/account/reseller-status', { cache: 'no-store' });
      const data = await res.json();
      const status = data && data.status;

      if (status && status.is_reseller) {
        redeemBox.style.display = 'none';
        activeBox.style.display = '';
        document.getElementById('pResellerTier').textContent = RESELLER_TIER_LABELS[status.duration_type] || status.duration_type || '—';
        document.getElementById('pResellerDiscount').textContent = status.discount_percent != null ? `${status.discount_percent}%` : '—';
        document.getElementById('pResellerExpiry').textContent = status.period_end ? formatDate(status.period_end) : 'ຖາວອນ ບໍ່ໝົດອາຍຸ';
      } else {
        redeemBox.style.display = '';
        activeBox.style.display = 'none';
      }
    } catch (err) {
      console.error('ດຶງ /api/account/reseller-status ບໍ່ສຳເລັດ', err);
    }
  }

  const resellerForm = document.getElementById('pResellerForm');
  if (resellerForm) {
    resellerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const codeField = document.getElementById('pResellerCodeField');
      const codeInput = document.getElementById('pResellerCode');
      const code = codeInput.value.trim();

      if (!code) {
        setFieldError(codeField, 'ກະລຸນາໃສ່ຄີຍ໌ຕົວແທນ');
        return;
      }
      setFieldError(codeField, '');

      const submitBtn = document.getElementById('pResellerSubmitBtn');
      const originalHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.textContent = 'ກຳລັງກວດສອບ...';

      try {
        const res = await fetch('/api/account/redeem-reseller-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();

        if (!res.ok) {
          showToast(data.error || 'ໃຊ້ຄີຍ໌ບໍ່ສຳເລັດ', true);
          return;
        }

        showToast('ໃຊ້ຄີຍ໌ຕົວແທນສຳເລັດແລ້ວ');
        resellerForm.reset();
        await refreshResellerStatus();
      } catch (err) {
        console.error('ໃຊ້ຄີຍ໌ຕົວແທນບໍ່ສຳເລັດ', err);
        showToast('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ', true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
      }
    });
  }

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

});
