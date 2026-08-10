/* =========================================================
   reseller.js — ການເຮັດວຽກຂອງໜ້າ reseller.html (ໜ້າໃສ່ຄີຍ໌ຕົວແທນ)
   1) ດຶງ /api/me -> ຖ້າຍັງບໍ່ login ໃຫ້ໂຊວ໌ກ່ອງ "ກະລຸນາລົງຊື່ເຂົ້າໃຊ້"
   2) ຟອມໃສ່ຄີຍ໌ -> POST /api/account/redeem-reseller-key -> ໂຊວ໌ຜົນລັບ (ລະດັບ/ສ່ວນຫຼຸດ/ໝົດອາຍຸ)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const formCard = document.getElementById('rsFormCard');
  const needLoginCard = document.getElementById('rsNeedLogin');
  const resultCard = document.getElementById('rsResultCard');
  if (!formCard) return; // ไม่ใช่หน้า reseller

  const RESELLER_TIER_LABELS = { '7d': '7 ມື້', '14d': '14 ມື້', '30d': '30 ມື້', 'lifetime': 'ຖາວອນ' };

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
    }
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

      const tierLabel = RESELLER_TIER_LABELS[data.durationType] || data.durationType || '—';
      const expiryLabel = data.periodEnd
        ? new Date(data.periodEnd).toLocaleString('lo-LA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'ຖາວອນ ບໍ່ໝົດອາຍຸ';

      document.getElementById('rsResultTier').textContent = tierLabel;
      document.getElementById('rsResultDiscount').textContent = data.discountPercent != null ? `${data.discountPercent}%` : '—';
      document.getElementById('rsResultExpiry').textContent = expiryLabel;

      formCard.style.display = 'none';
      resultCard.style.display = '';
      showToast('ໃຊ້ຄີຍ໌ຕົວແທນສຳເລັດແລ້ວ');
    } catch (err) {
      console.error('ໃຊ້ຄີຍ໌ຕົວແທນບໍ່ສຳເລັດ', err);
      showToast('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ', true);
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }
  });
});
