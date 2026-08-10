/* =========================================================
   reseller.js — ການເຮັດວຽກຂອງໜ້າ reseller.html (ໜ້າຕົວແທນ)
   1) ດຶງ /api/me -> ຖ້າຍັງບໍ່ login ໃຫ້ໂຊວ໌ກ່ອງ "ກະລຸນາລົງຊື່ເຂົ້າໃຊ້"
   2) ຖ້າ login ຢູ່ -> ດຶງ /api/account/reseller-dashboard
      - ຍັງບໍ່ເປັນຕົວແທນ -> ໂຊວ໌ຟອມໃສ່ຄີຍ໌ (rsFormCard)
      - ເປັນຕົວແທນຢູ່ແລ້ວ -> ໂຊວ໌ແດຊບອດ (rsDashboard): ໂຄວຕ້າ/ຍອດມື້ນີ້/ຍອດສະສົມ
   3) ຟອມໃສ່ຄີຍ໌ -> POST /api/account/redeem-reseller-key ສຳເລັດແລ້ວ -> ດຶງແດຊບອດຄືນມາໂຊວ໌ທັນທີ
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const formCard = document.getElementById('rsFormCard');
  const needLoginCard = document.getElementById('rsNeedLogin');
  const dashboard = document.getElementById('rsDashboard');
  if (!formCard) return; // ไม่ใช่หน้า reseller

  const RESELLER_TIER_LABELS = { '7d': '7 ມື້', '14d': '14 ມື້', '30d': '30 ມື້', 'lifetime': 'ຖາວອນ' };

  const fmtMoney = (n) => Number(n || 0).toLocaleString('de-DE');
  const fmtExpiry = (iso) => iso
    ? new Date(iso).toLocaleString('lo-LA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'ຖາວອນ ບໍ່ໝົດອາຍຸ';

  /* ---------- Toast (ໃຊ້ .toast ຮ່ວມກັບ auth.css) ---------- */
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

  function setFieldError(fieldEl, message) {
    fieldEl.classList.toggle('has-error', !!message);
    const errEl = fieldEl.querySelector('.field-error');
    if (errEl) errEl.textContent = message || '';
  }

  document.getElementById('rsGoLoginBtn')?.addEventListener('click', () => {
    window.location.href = '/login.html?next=' + encodeURIComponent('/reseller.html');
  });

  /* ---------- ແດຊບອດ: ວາງຄ່າວົງ progress (circle) ---------- */
  const RING_R = 47;
  const RING_C = 2 * Math.PI * RING_R;
  function renderDashboard(data) {
    const target = Number(data.quotaTarget) || 0;
    const current = Number(data.monthPurchase) || 0;
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    const remaining = Math.max(0, target - current);

    document.getElementById('rsTier').textContent =
      (RESELLER_TIER_LABELS[data.durationType] || data.durationType || '—') + (target ? ` · ${fmtMoney(target)} ₭` : '');
    document.getElementById('rsExpiry').textContent = fmtExpiry(data.periodEnd);

    const ringFg = document.getElementById('rsRingFg');
    ringFg.style.strokeDasharray = String(RING_C);
    ringFg.style.strokeDashoffset = String(RING_C - (pct / 100) * RING_C);
    document.getElementById('rsPct').textContent = pct + '%';

    document.getElementById('rsCurrent').textContent = fmtMoney(current);
    document.getElementById('rsTarget').textContent = fmtMoney(target);
    document.getElementById('rsRemaining').textContent = fmtMoney(remaining) + ' ₭';

    const today = data.today || {};
    document.getElementById('rsTodayTopup').textContent = fmtMoney(today.topup);
    document.getElementById('rsTodayPurchase').textContent = fmtMoney(today.purchase);
    document.getElementById('rsTodayOrders').textContent = today.ordersCount || 0;
    document.getElementById('rsTodayBalance').textContent = fmtMoney(today.balance);

    const cum = data.cumulative || {};
    document.getElementById('rsCumTopup').textContent = fmtMoney(cum.totalTopup) + ' ₭';
    document.getElementById('rsCumPurchase').textContent = fmtMoney(cum.totalPurchase) + ' ₭';
    document.getElementById('rsCumOrders').textContent = (cum.ordersCount || 0) + ' ຄັ້ງ';
    document.getElementById('rsCumDiscount').textContent = (data.discountPercent != null ? data.discountPercent : 0) + '%';

    formCard.style.display = 'none';
    needLoginCard.style.display = 'none';
    dashboard.style.display = '';
    document.querySelector('header')?.classList.add('is-reseller');
    document.querySelector('.logo')?.classList.add('is-reseller');
  }

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/account/reseller-dashboard', { cache: 'no-store' });
      const data = await res.json();

      if (res.status === 401 || data.requireLogin) {
        formCard.style.display = 'none';
        dashboard.style.display = 'none';
        needLoginCard.style.display = '';
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'ດຶງຂໍ້ມູນຕົວແທນບໍ່ສຳເລັດ', true);
        return;
      }
      if (data.isReseller) {
        renderDashboard(data);
      } else {
        dashboard.style.display = 'none';
        formCard.style.display = '';
      }
    } catch (err) {
      console.error('ດຶງແດຊບອດຕົວແທນບໍ່ສຳເລັດ', err);
      showToast('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ', true);
    }
  }

  (async () => {
    let me;
    try {
      const res = await fetch('/api/me', { cache: 'no-store' });
      me = await res.json();
    } catch (err) {
      console.error('ດຶງ /api/me ບໍ່ສຳເລັດ', err);
      showToast('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ', true);
      return;
    }

    if (!me.loggedIn) {
      formCard.style.display = 'none';
      needLoginCard.style.display = '';
      return;
    }

    await fetchDashboard();
  })();

  const form = document.getElementById('rsForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const codeField = document.getElementById('rsCodeField');
    const codeInput = document.getElementById('rsCode');
    const code = codeInput.value.trim();

    if (!code) {
      setFieldError(codeField, 'ກະລຸນາໃສ່ຄີຍ໌ຕົວແທນ');
      return;
    }
    setFieldError(codeField, '');

    const submitBtn = document.getElementById('rsSubmitBtn');
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

      if (res.status === 401 || data.requireLogin) {
        window.location.href = '/login.html?next=' + encodeURIComponent('/reseller.html');
        return;
      }

      if (!res.ok) {
        showToast(data.error || 'ໃຊ້ຄີຍ໌ບໍ່ສຳເລັດ', true);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
        return;
      }

      showToast('ໃຊ້ຄີຍ໌ຕົວແທນສຳເລັດແລ້ວ');
      codeInput.value = '';
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;

      // ໃຊ້ຄີຍ໌ສຳເລັດ -> ດຶງແດຊບອດຄືນມາໂຊວ໌ທັນທີ (ແທນທີ່ຈະໂຊວ໌ແຕ່ຜົນລັບສັ້ນໆ)
      await fetchDashboard();
    } catch (err) {
      console.error('ໃຊ້ຄີຍ໌ຕົວແທນບໍ່ສຳເລັດ', err);
      showToast('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ', true);
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }
  });
});
