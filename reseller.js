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
  const loadingCard = document.getElementById('rsLoading');
  const loadingText = document.getElementById('rsLoadingText');
  if (!formCard) return; // ไม่ใช่หน้า reseller

  /* ---------- สลับกล่องที่โชว์ (loading / login / form / dashboard) ----------
     เดิมสลับด้วย element.style.display แต่ใน HTML ซ่อนด้วยคลาส u-hidden (ย้ายมาจาก inline style ตอนทำ CSP)
     พอตั้ง display ว่าง คลาส u-hidden ยังซ่อนอยู่ -> แดชบอร์ด/กล่องให้ล็อกอินไม่เคยโผล่ ส่วนฟอร์มโผล่แวบแล้วหาย
     ตอนนี้สลับด้วยคลาส u-hidden อย่างเดียว และโชว์ได้ทีละกล่องเท่านั้น */
  let hasState = false; // เคยรู้สถานะจริงจากเซิร์ฟเวอร์แล้วหรือยัง
  function showOnly(which) {
    const cards = { loading: loadingCard, login: needLoginCard, form: formCard, dashboard: dashboard };
    Object.keys(cards).forEach((k) => { if (cards[k]) cards[k].classList.toggle('u-hidden', k !== which); });
    hasState = which !== 'loading';
  }
  // โหลดสถานะครั้งแรกไม่สำเร็จ -> บอกให้รีโหลด (ไม่ปล่อยหน้าว่าง); ถ้าเคยโชว์หน้าแล้วก็คงหน้าเดิมไว้
  function showLoadFailed() {
    if (hasState) return;
    if (loadingText) loadingText.textContent = 'ເຊື່ອມຕໍ່ບໍ່ໄດ້ ກະລຸນາໂຫຼດໜ້ານີ້ໃໝ່';
    showOnly('loading');
  }

  // ชื่อร้าน/โลโก้/แถบประกาศ (header, footer, ...) — หน้านี้เคยลืมเรียก ทำให้ชื่อร้าน
  // ไม่ขึ้นและโลโก้ท้ายหน้าว่างเปล่า จึงเพิ่มเรียกเหมือนหน้าอื่น (index.html/category.html ฯลฯ)
  if (window.StorefrontData) {
    window.StorefrontData.fetchData()
      .then((data) => window.StorefrontData.applyStoreBranding(data.store))
      .catch((err) => console.error('reseller.js: applyStoreBranding failed', err));
  }

  const RESELLER_TIER_LABELS = { '7d': '7 ມື້', '14d': '14 ມື້', '30d': '30 ມື້', 'lifetime': 'ຖາວອນ' };

  const fmtMoney = (n) => Number(n || 0).toLocaleString('de-DE');

  /* ---------- ນັບຖອຍຫຼັງແບບສົດໆ (ໃຊ້ຮ່ວມກັນທັງ "ໝົດອາຍຸ" ແລະ "ຄ້າງ 100% ລໍຣີເຊັດ") ----------
     ຮັບ targetIso (ເວລາເປົ້າໝາຍ) + callback ອັບເດດ DOM ທຸກ 1 ວິນາທີ; ຄືນຟັງຊັນ stop() ໄວ້ຢຸດ
     interval ເມື່ອຈະ render ຄືນໃໝ່ (ກັນ interval ຊ້ອນກັນຫຼາຍອັນ) */
  function startLiveCountdown(targetIso, onTick, onDone) {
    const targetMs = new Date(targetIso).getTime();
    if (Number.isNaN(targetMs)) return () => {};

    function tick() {
      const remain = targetMs - Date.now();
      if (remain <= 0) {
        onTick(0, 0, 0, 0);
        if (onDone) onDone();
        return false;
      }
      const d = Math.floor(remain / 86400000);
      const h = Math.floor((remain % 86400000) / 3600000);
      const m = Math.floor((remain % 3600000) / 60000);
      const s = Math.floor((remain % 60000) / 1000);
      onTick(d, h, m, s);
      return true;
    }

    if (!tick()) return () => {};
    const timer = setInterval(() => { if (!tick()) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }

  let stopExpiryCountdown = null;
  let stopHoldCountdown = null;

  /* ตัวนับถอยหลังครบแล้วดึงแดชบอร์ดใหม่ — จำกัดไม่เกิน 1 ครั้ง/15 วินาที
     เดิมถ้านาฬิกาเครื่องเร็วกว่าเซิร์ฟเวอร์ (หรือเซิร์ฟเวอร์ยังไม่รีเซ็ตรอบ) จะ fetch -> render -> นับครบ -> fetch วนไม่หยุด
     หน้าเลยกะพริบและยิง API รัวๆ */
  let lastAutoRefetch = 0;
  function refetchSoon() {
    const now = Date.now();
    if (now - lastAutoRefetch < 15000) return;
    lastAutoRefetch = now;
    fetchDashboard();
  }

  /* ---------- Toast (ໃຊ້ .toast ຮ່ວມກັບ auth.css) ---------- */
  let toastTimer = null;
  function showToast(message, isError = false) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    // reseller.html มี <div class="toast"> เปล่าๆ อยู่แล้ว (ไม่มี <span>) — เดิม querySelector('span') เป็น null
    // แล้ว throw ตอนโชว์ error ปุ่ม "ใช้คีย์" เลยค้างเป็น "กำลังตรวจสอบ..." ตลอด
    if (!toast.querySelector('span')) {
      toast.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z"/></svg><span></span>`;
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
    const current = Number(data.cyclePurchase != null ? data.cyclePurchase : data.monthPurchase) || 0;
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    const remaining = Math.max(0, target - current);
    const isHeld = !!data.quotaReachedAt;

    document.getElementById('rsTier').textContent =
      (RESELLER_TIER_LABELS[data.durationType] || data.durationType || '—') + (target ? ` · ${fmtMoney(target)} ₭` : '');

    /* ---------- ໝົດອາຍຸ: ຖ້າມີ periodEnd -> ນັບຖອຍຫຼັງແບບສົດໆ ທຸກວິນາທີ, ຖ້າຖາວອນ -> ໂຊວ໌ຂໍ້ຄວາມຄົງທີ່ ---------- */
    if (stopExpiryCountdown) { stopExpiryCountdown(); stopExpiryCountdown = null; }
    const staticLabel = document.getElementById('rsExpiryStaticLabel');
    const staticVal = document.getElementById('rsExpiry');
    const liveLabel = document.getElementById('rsExpiryLiveLabel');
    const liveVal = document.getElementById('rsExpiryLive');

    if (!data.periodEnd) {
      liveLabel.classList.add('u-hidden');
      liveVal.classList.add('u-hidden');
      staticLabel.classList.remove('u-hidden');
      staticVal.classList.remove('u-hidden');
      staticVal.textContent = 'ຖາວອນ ບໍ່ໝົດອາຍຸ';
    } else {
      staticLabel.classList.add('u-hidden');
      staticVal.classList.add('u-hidden');
      liveLabel.classList.remove('u-hidden');
      liveVal.classList.remove('u-hidden');
      const dEl = document.getElementById('rsExpD');
      const hEl = document.getElementById('rsExpH');
      const mEl = document.getElementById('rsExpM');
      const sEl = document.getElementById('rsExpS');
      stopExpiryCountdown = startLiveCountdown(data.periodEnd, (d, h, m, s) => {
        dEl.textContent = String(d);
        hEl.textContent = String(h).padStart(2, '0');
        mEl.textContent = String(m).padStart(2, '0');
        sEl.textContent = String(s).padStart(2, '0');
      }, refetchSoon); // ໝົດອາຍຸແທ້ໆ -> ດຶງແດຊບອດຄືນເພື່ອອັບເດດສະຖານະລ່າສຸດ
    }

    const ringFg = document.getElementById('rsRingFg');
    ringFg.style.strokeDasharray = String(RING_C);
    ringFg.style.strokeDashoffset = String(RING_C - (pct / 100) * RING_C);
    ringFg.classList.toggle('is-held', isHeld);
    document.getElementById('rsPct').textContent = pct + '%';

    document.getElementById('rsCurrent').textContent = fmtMoney(current);
    document.getElementById('rsTarget').textContent = fmtMoney(target);
    document.getElementById('rsRemaining').textContent = fmtMoney(remaining) + ' ₭';

    /* ---------- ຄົບເປົ້າ 100% ແລ້ວ -> ຄ້າງໄວ້ 7 ມື້ ກ່ອນຣີເຊັດຮອບໃໝ່ (ນັບຖອຍຫຼັງແບບສົດໆຄືກັນ) ---------- */
    if (stopHoldCountdown) { stopHoldCountdown(); stopHoldCountdown = null; }
    const holdBanner = document.getElementById('rsHoldBanner');
    if (isHeld && data.quotaResetAt) {
      holdBanner.classList.add('show');
      const holdEl = document.getElementById('rsHoldCountdown');
      stopHoldCountdown = startLiveCountdown(data.quotaResetAt, (d, h, m, s) => {
        holdEl.textContent = `${d}ວ ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }, refetchSoon); // ຄົບ 7 ມື້ -> ດຶງແດຊບອດຄືນເພື່ອໂຊວ໌ຮອບໃໝ່ທີ່ຣີເຊັດແລ້ວ
    } else {
      holdBanner.classList.remove('show');
    }

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

    showOnly('dashboard');
    document.querySelector('header')?.classList.add('is-reseller');
    document.querySelector('.logo')?.classList.add('is-reseller');
  }

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/account/reseller-dashboard', { cache: 'no-store' });
      const data = await res.json();

      if (res.status === 401 || data.requireLogin) {
        showOnly('login');
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'ດຶງຂໍ້ມູນຕົວແທນບໍ່ສຳເລັດ', true);
        showLoadFailed();
        return;
      }
      if (data.isReseller) {
        renderDashboard(data);
      } else {
        showOnly('form');
      }
    } catch (err) {
      console.error('ດຶງແດຊບອດຕົວແທນບໍ່ສຳເລັດ', err);
      showToast('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ', true);
      showLoadFailed();
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
      showLoadFailed();
      return;
    }

    if (!me.loggedIn) {
      showOnly('login');
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
