/* =========================================================
   topup.js — ການເຮັດວຽກຂອງໜ້າ topup.html
   1) ເລືອກທະນາຄານ + ຈຳນວນເງິນ (preset ຫຼືພິມເອງ)
   2) ສ້າງ QR (ຮ້ອງ API) + ອັບໂຫຼດສະລິບ
   3) ຢືນຢັນການໂອນ -> ໜ້າລໍຖ້າກວດສອບ

   ໝາຍເຫດ: ຈຸດທີ່ໝາຍ TODO ຍັງເປັນ client-side stub ຢູ່ — ໃຫ້ຕໍ່ກັບ backend
   ຈິງ (Worker ໃນ src/index.js) ເມື່ອທ່ານພ້ອມ:
     - POST /api/topup/create   -> ສ້າງລາຍການເຕີມເງິນ + ຄືນ QR ຮັບເງິນ
     - POST /api/topup/confirm  -> ອັບໂຫຼດສະລິບ + ຢືນຢັນລາຍການ
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const stepAmount = document.querySelector('#topupStepAmount');
  const stepPay = document.querySelector('#topupStepPay');
  const stepWaiting = document.querySelector('#topupStepWaiting');
  if (!stepAmount || !stepPay || !stepWaiting) return; // ไม่ใช่หน้า topup

  const methods = document.querySelectorAll('.topup-method');
  const bankTitle = document.querySelector('#topupBankTitle');
  const bankDesc = document.querySelector('#topupBankDesc');
  const presetsBox = document.querySelector('#topupPresets');
  const presets = document.querySelectorAll('.topup-preset');
  const firstPreset = document.querySelector('.topup-preset.first');
  const pickerHint = document.querySelector('#topupPickerHint');
  const sumValueEl = document.querySelector('#topupSumValue');
  const createQrBtn = document.querySelector('#topupCreateQrBtn');

  const backToAmountBtn = document.querySelector('#topupBackToAmount');
  const payAmountEl = document.querySelector('#topupPayAmount');
  const qrBox = document.querySelector('#topupQrBox');
  const uploadLabel = document.querySelector('#topupUploadLabel');
  const slipInput = document.querySelector('#topupSlipInput');
  const slipName = document.querySelector('#topupSlipName');
  const uploadIcon = document.querySelector('#topupUploadIcon');
  const uploadPreviewImg = document.querySelector('#topupUploadPreviewImg');
  const confirmBtn = document.querySelector('#topupConfirmBtn');

  const refEl = document.querySelector('#topupRef');
  const waitAmountEl = document.querySelector('#topupWaitAmount');

  // ---- ອົງປະກອບການ໌ດ "ລໍຖ້າກວດສອບ" ແບບ premium + realtime (ເບິ່ງ topup-waiting.css) ----
  const tuwCard = document.querySelector('#tuwCard');
  const tuwIcon = document.querySelector('#tuwIcon');
  const tuwHeadline = document.querySelector('#tuwHeadline');
  const tuwSub = document.querySelector('#tuwSub');
  const tuwStatusChip = document.querySelector('#tuwStatusChip');
  const tuwNode2 = document.querySelector('#tuwNode2');
  const tuwNode3 = document.querySelector('#tuwNode3');
  const tuwLine2 = document.querySelector('#tuwLine2');
  const tuwStep2Label = document.querySelector('#tuwStep2Label');
  const tuwToast = document.querySelector('#tuwToast');
  const tuwToastIcon = document.querySelector('#tuwToastIcon');
  const tuwToastText = document.querySelector('#tuwToastText');

  /* ---------- toast ຂໍ້ຄວາມແຈ້ງເຕືອນ (ຂຽນເອງໃນນີ້ເລີຍ ເພາະໜ້ານີ້ບໍ່ໄດ້ link auth.css
     ທີ່ມີ .toast ຢູ່) ---------- */
  let toastTimer = null;
  function showToast(message, isError = false) {
    let toast = document.querySelector('.topup-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'topup-toast';
      toast.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translate(-50%,12px);'
        + 'max-width:90vw;padding:12px 18px;border-radius:12px;background:rgba(20,20,24,.96);'
        + 'border:1px solid rgba(255,255,255,.12);color:#fff;font-size:14px;z-index:9999;opacity:0;'
        + 'transition:opacity .25s ease, transform .25s ease;pointer-events:none;'
        + 'box-shadow:0 8px 24px rgba(0,0,0,.4);';
      document.body.appendChild(toast);
    }
    toast.style.borderColor = isError ? 'rgba(255,0,1,.5)' : 'rgba(255,255,255,.12)';
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, 12px)';
    }, 3200);
  }

  function redirectToLogin() {
    window.location.href = '/login.html?next=' + encodeURIComponent('/topup.html');
  }

  /* =========================================================
     ການ໌ດ "ລໍຖ້າກວດສອບ" ແບບ premium + realtime
     ---------------------------------------------------------
     ບໍ່ໄດ້ໃຊ້ Supabase Realtime (websocket) ໂດຍກົງຈາກ browser ຝັ່ງລູກຄ້າ
     ເພາະທຸກຄຳຮ້ອງຂໍ Supabase ຂອງເວັບນີ້ຖືກ proxy ຜ່ານ Worker ດ້ວຍ service_role
     key ຫມົດ (ເບິ່ງ admin-supabase-config.js) — ແທນທີ່ຈະເປີດຊ່ອງທາງໃໝ່,
     ໃຊ້ວິທີ poll endpoint ທີ່ມີຢູ່ແລ້ວ (/api/topup/history) ທຸກ 4 ວິນາທີ
     ແທນ ເຊິ່ງໃຫ້ຄວາມຮູ້ສຶກ "ອັບເດດສົດ" ເໝືອນກັນ ໂດຍບໍ່ຕ້ອງເປີດ endpoint/
     ຊ່ອງທາງໃໝ່ທີ່ຍັງບໍ່ໄດ້ກວດສອບຄວາມປອດໄພ

     ຄໍລໍາ viewed_at (ແອດມິນເປີດເບິ່ງສະລິບແລ້ວ) ເປັນຄໍລໍາໃໝ່ທີ່ຕ້ອງຣັນ
     migration_add_topup_viewed_at.sql ໃນ Supabase ກ່ອນ + deploy src/index.js
     ອັນໃໝ່ (ເພີ່ມ viewed_at ເຂົ້າ select ຂອງ handleTopupHistory) ບໍ່ຢ່າງນັ້ນ
     ຄ່ານີ້ຈະບໍ່ມາ ແລະ state ຈະຄ້າງຢູ່ "ລໍຖ້າກວດສອບ" ຈົນກວ່າແອດມິນຈະ
     ຢືນຢັນ/ປະຕິເສດ (ຍັງໃຊ້ໄດ້ປົກກະຕິ ພຽງແຕ່ບໍ່ມີຂັ້ນ "ກຳລັງກວດສອບ") */

  const TUW_ICONS = {
    pending: `
      <div class="ring ring-outer"></div>
      <div class="ring ring-mid"></div>
      <div class="wave"></div>
      <div class="tuw-icon-core">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--tuw-a)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 1.8"/></svg>
      </div>`,
    reviewing: `
      <div class="ring ring-outer" style="border-top-color:#7aa2ff;border-right-color:#7aa2ff;"></div>
      <div class="ring ring-mid" style="border-color:#7aa2ff;"></div>
      <div class="wave" style="border-color:#7aa2ff;"></div>
      <div class="tuw-icon-core" style="box-shadow:0 0 0 1px rgba(255,255,255,.06) inset, 0 0 22px -4px #7aa2ff;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#7aa2ff" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.4"/><path d="M4 16l5-4 4 3 3-2 4 3"/></svg>
      </div>`,
    success: `
      <div class="ring ring-mid" style="animation:none;opacity:.3;"></div>
      <div class="wave"></div>
      <div class="tuw-icon-core">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 13l4.5 4.5L19 7" style="stroke-dasharray:24;stroke-dashoffset:24;animation:tuwDraw 550ms 150ms ease forwards;"/>
        </svg>
      </div>`,
    failed: `
      <div class="ring ring-mid" style="animation:none;opacity:.3;"></div>
      <div class="tuw-icon-core">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--tu-red)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l10 10M17 7L7 17"/></svg>
      </div>`,
  };
  if (!document.getElementById('tuwDrawKeyframe')) {
    const s = document.createElement('style');
    s.id = 'tuwDrawKeyframe';
    s.textContent = '@keyframes tuwDraw{ to{ stroke-dashoffset:0; } }';
    document.head.appendChild(s);
  }

  const TUW_CONTENT = {
    pending: {
      headline: 'ກຳລັງລໍຖ້າການກວດສອບ',
      sub: 'ແອດມິນຈະກວດສະລິບການໂອນຂອງທ່ານ<br>ແລະຢືນຢັນຍອດເງິນເຂົ້າບັນຊີໃນໄວໆນີ້',
      chip: 'ລໍຖ້າກວດສອບ', step2Label: 'ກຳລັງກວດສອບ',
    },
    reviewing: {
      headline: 'ແອດມິນກຳລັງກວດສອບ',
      sub: 'ແອດມິນກຳລັງເປີດເບິ່ງສະລິບໂອນເງິນ<br>ຂອງທ່ານຢູ່ ກະລຸນາລໍຖ້າສັກຄູ່',
      chip: 'ກຳລັງກວດສອບ', step2Label: 'ກຳລັງກວດສອບ',
    },
    success: {
      headline: 'ເຕີມເງິນສຳເລັດ',
      sub: 'ລະບົບໄດ້ເຕີມເງິນເຂົ້າບັນຊີຂອງທ່ານ<br>ຮຽບຮ້ອຍແລ້ວ ຂອບໃຈທີ່ໃຊ້ບໍລິການ',
      chip: 'ສຳເລັດ', step2Label: 'ກວດສອບແລ້ວ',
    },
    failed: {
      headline: 'ລາຍການບໍ່ຜ່ານການກວດສອບ',
      sub: 'ກະລຸນາກວດສອບຂໍ້ມູນການໂອນເງິນ<br>ຫຼືຕິດຕໍ່ຝ່າຍບໍລິການລູກຄ້າ',
      chip: 'ບໍ່ສຳເລັດ', step2Label: 'ກວດສອບບໍ່ຜ່ານ',
    },
  };

  function setTuwState(state) {
    if (!tuwCard) return;
    tuwCard.dataset.state = state;
    if (tuwIcon) tuwIcon.innerHTML = TUW_ICONS[state] || TUW_ICONS.pending;
    const c = TUW_CONTENT[state] || TUW_CONTENT.pending;
    if (tuwHeadline) tuwHeadline.innerHTML = c.headline;
    if (tuwSub) tuwSub.innerHTML = c.sub;
    if (tuwStatusChip) tuwStatusChip.textContent = c.chip;
    if (tuwStep2Label) tuwStep2Label.textContent = c.step2Label;

    if (!tuwNode2 || !tuwNode3 || !tuwLine2) return;
    if (state === 'success') {
      tuwNode2.className = 'tuw-node done';
      tuwNode2.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#2ecc71" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      tuwNode3.className = 'tuw-node done';
      tuwNode3.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#2ecc71" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      tuwLine2.className = 'tuw-line lit';
    } else if (state === 'failed') {
      tuwNode2.className = 'tuw-node failed';
      tuwNode2.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7L7 17" stroke="#ff0001" stroke-width="2.2" stroke-linecap="round"/></svg>';
      tuwNode3.className = 'tuw-node';
      tuwLine2.className = 'tuw-line';
    } else {
      const dotColor = state === 'reviewing' ? '#7aa2ff' : '#ffb020';
      tuwNode2.className = 'tuw-node current';
      tuwNode2.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" fill="${dotColor}"/></svg>`;
      tuwNode3.className = 'tuw-node';
      tuwLine2.className = 'tuw-line';
    }
  }

  function showTuwToast(text, kind) {
    if (!tuwToast) return;
    tuwToastText.textContent = text;
    tuwToast.className = 'tuw-toast show' + (kind ? ' ' + kind : '');
    if (kind === 'success') tuwToastIcon.setAttribute('d', 'M5 13l4 4L19 7');
    else if (kind === 'failed') tuwToastIcon.setAttribute('d', 'M7 7l10 10M17 7L7 17');
    else tuwToastIcon.setAttribute('d', 'M12 9v4M12 17h.01M10.3 3.9L2.8 17a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z');
    clearTimeout(showTuwToast._t);
    showTuwToast._t = setTimeout(() => { tuwToast.className = 'tuw-toast'; }, 5000);
  }

  let tuwPollTimer = null;
  let tuwLastKey = null; // ກັນອັບເດດ UI ຊ້ຳໆ ຖ້າຂໍ້ມູນຍັງບໍ່ປ່ຽນຈາກຮອບກ່ອນ

  async function pollTopupStatus() {
    if (!currentTopupId) return;
    try {
      const res = await fetch('/api/topup/history');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return; // ງຽບໄວ້ — ຮອບໜ້າ poll ໃໝ່ອີກ

      const item = (data.items || []).find((r) => String(r.id) === String(currentTopupId));
      if (!item) return;

      const key = item.status + '|' + (item.viewed_at || '');
      if (key === tuwLastKey) return;
      tuwLastKey = key;

      if (item.status === 'approved') {
        setTuwState('success');
        showTuwToast('ເຕີມເງິນສຳເລັດ! ຍອດເຂົ້າບັນຊີແລ້ວ', 'success');
        stopTuwPolling();
      } else if (item.status === 'rejected') {
        setTuwState('failed');
        showTuwToast('ລາຍການບໍ່ຜ່ານການກວດສອບ', 'failed');
        stopTuwPolling();
      } else if (item.viewed_at) {
        setTuwState('reviewing');
        showTuwToast('ແອດມິນກຳລັງກວດສະລິບຂອງທ່ານ', 'reviewing');
      } else {
        setTuwState('pending');
      }
    } catch (err) {
      console.error('ກວດສະຖານະເຕີມເງິນບໍ່ສຳເລັດ', err);
    }
  }

  function startTuwPolling() {
    stopTuwPolling();
    setTuwState('pending');
    pollTopupStatus();
    tuwPollTimer = setInterval(pollTopupStatus, 4000);
  }
  function stopTuwPolling() {
    if (tuwPollTimer) { clearInterval(tuwPollTimer); tuwPollTimer = null; }
  }

  // ພັກ poll ຕອນສະລັບແທັບ/ຍໍ້ໜ້າຈໍໄປ ແລ້ວກັບມາ poll ຕໍ່ອັດຕະໂນມັດຕອນກັບມາເບິ່ງໜ້ານີ້
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopTuwPolling();
    } else if (stepWaiting && !stepWaiting.classList.contains('u-hidden')) {
      startTuwPolling();
    }
  });

  const BANKS = {
    1: { name: 'ບັນຊີທະນາຄານ 1' },
    2: { name: 'ບັນຊີທະນາຄານ 2' },
  };
  const QR_IMAGES = { 1: null, 2: null };

  // ปุ่มพรีเซ็ตเก็บ "จำนวนแสดงผลแบบย่อ" ไว้ใน data-amount (หน่วย: พันกีบ, ดูป้าย K บนปุ่ม)
  // ส่วน selectedAmount ที่ใช้จริงทั้งหมด (ยอดที่ต้องโอน / ยอดที่ส่งให้ backend / ยอดที่เติมเข้ากระเป๋า)
  // ต้องเป็นจำนวนเงินกีบจริงเสมอ (ย่อ x 1000) กันลูกค้าโอนเงินผิดจำนวนจากที่เห็นบนจอ
  const DISPLAY_UNIT = 1000;

  let selectedBank = 1;
  let selectedDisplayAmount = 0; // ค่าย่อที่ตรงกับ data-amount ของปุ่ม (ใช้เทียบ active state เท่านั้น)
  let selectedAmount = 0;        // ยอดเงินจริง (กีบ) — ใช้แสดงผล/ส่ง backend ทุกจุด
  let selectedSlip = null;
  let currentTopupId = null;

  function formatKip(n) {
    return Number(n || 0).toLocaleString('de-DE') + ' ₭';
  }

  function updateBankText() {
    const b = BANKS[selectedBank];
    bankTitle.textContent = `ໂອນ QR ${b.name}`;
    bankDesc.textContent = `ສະແກນ QR ຮັບເງິນຂອງຮ້ານ (${b.name}) ຜ່ານແອັບທະນາຄານ ແລ້ວອັບໂຫຼດສະລິບເພື່ອລໍຖ້າແອດມິນກວດສອບ`;
  }

  // ---- ดึงข้อความกำกับ QR + รูป QR จริงที่แอดมินตั้งไว้ (ตั้งค่าร้าน > QR โอนเงิน) ----
  // ก่อนหน้านี้หน้านี้เป็นข้อความคงที่ ไม่ได้ต่อกับข้อมูลจริงเลย จึงแก้ในแอดมินแล้วไม่มีอะไรเปลี่ยน
  async function loadRealQrSettings() {
    if (!window.StorefrontData) return;
    try {
      const data = await window.StorefrontData.fetchData();
      const store = data.store || {};

      BANKS[1].name = store.qrLabel1 || 'ບັນຊີທະນາຄານ 1';
      QR_IMAGES[1] = store.qrUrl1 || null;

      const method2Btn = document.querySelector('#topupMethod2');
      const name2El = document.querySelector('#topupMethodName2');
      // ตามที่ระบุในห้องแอดมิน: ถ้าไม่ได้ใส่รูป QR อันที่ 2 ไว้ ให้โชว์แต่ QR อันที่ 1 เหมือนเดิม
      if (store.qrUrl2) {
        BANKS[2].name = store.qrLabel2 || 'ບັນຊີທະນາຄານ 2';
        QR_IMAGES[2] = store.qrUrl2;
        if (name2El) name2El.textContent = BANKS[2].name;
        if (method2Btn) method2Btn.style.display = '';
      } else if (method2Btn) {
        method2Btn.style.display = 'none';
      }

      const name1El = document.querySelector('#topupMethodName1');
      if (name1El) name1El.textContent = BANKS[1].name;

      updateBankText();
    } catch (err) {
      console.error('ດຶງຂໍ້ມູນ QR ຈິງບໍ່ສຳເລັດ', err);
      const name1El = document.querySelector('#topupMethodName1');
      if (name1El) name1El.textContent = BANKS[1].name;
      updateBankText();
    }
  }

  methods.forEach((btn) => {
    btn.addEventListener('click', () => {
      methods.forEach((m) => m.classList.remove('active'));
      btn.classList.add('active');
      selectedBank = Number(btn.dataset.bank);
      updateBankText();
    });
  });

  function setAmount(val) {
    selectedDisplayAmount = Math.max(0, Number(val) || 0);
    selectedAmount = selectedDisplayAmount * DISPLAY_UNIT; // แปลงเป็นยอดเงินจริงทันที
    presets.forEach((p) => {
      p.classList.toggle('active', Number(p.dataset.amount) === selectedDisplayAmount);
    });
    if (selectedAmount > 0) {
      sumValueEl.textContent = selectedAmount.toLocaleString('de-DE') + ' ₭';
      sumValueEl.classList.add('picked');
    } else {
      sumValueEl.textContent = '— ₭';
      sumValueEl.classList.remove('picked');
    }
    createQrBtn.disabled = selectedAmount < 1;
  }

  // ---- ปุ่ม ₭20 ตัวแรกโชว์ตัวเดียวก่อน พอกดแล้วตัวเลือกที่เหลือค่อยๆ โผล่ออกมาทีละใบ ----
  let presetsRevealed = false;
  function revealOtherPresets() {
    if (presetsRevealed) return;
    presetsRevealed = true;
    if (pickerHint) pickerHint.classList.add('gone');
    if (presetsBox) presetsBox.classList.add('expanded');
    const rest = Array.from(presets).filter((p) => p !== firstPreset);
    rest.forEach((p, i) => {
      setTimeout(() => p.classList.add('shown'), 90 * (i + 1));
    });
  }

  if (firstPreset) {
    firstPreset.addEventListener('click', () => {
      setAmount(firstPreset.dataset.amount);
      revealOtherPresets();
    });
  }
  presets.forEach((p) => {
    if (p === firstPreset) return;
    p.addEventListener('click', () => {
      if (!presetsRevealed) return; // ยังไม่โผล่มา กดไม่ได้ (มองไม่เห็นอยู่แล้ว)
      setAmount(p.dataset.amount);
    });
  });

  /* ---------- ช่องพิมพ์จำนวนเงินเอง ----------
     ผู้ใช้พิมพ์ได้แค่ตัวเลข (ถือเป็นหน่วย "พัน") ตัวต่อท้าย ".000" ถูกตรึงไว้ใน UI เสมอ
     เมื่อคำนวณจริง setAmount() จะคูณ 1000 ให้อัตโนมัติ (เหมือนปุ่ม preset ทุกปุ่ม)
     จึงรับประกันว่ายอดเงินจริงลงท้ายด้วย 000 เสมอ ไม่มีทางพิมพ์เศษสตางค์เข้ามาได้ */
  const customAmountInput = document.querySelector('#topupCustomAmount');
  if (customAmountInput) {
    const MAX_DIGITS = 6; // ป้องกันพิมพ์ยอดเงินสูงเกินจริง (สูงสุด 999,999K)

    customAmountInput.addEventListener('input', () => {
      let digits = customAmountInput.value.replace(/[^0-9]/g, '');
      if (digits.length > 1) digits = digits.replace(/^0+/, '') || '0'; // ตัดเลข 0 นำหน้าทิ้ง
      if (digits.length > MAX_DIGITS) digits = digits.slice(0, MAX_DIGITS);
      customAmountInput.value = digits;

      if (digits === '' || digits === '0') {
        setAmount(0);
        return;
      }
      setAmount(digits);
    });

    customAmountInput.addEventListener('focus', () => {
      revealOtherPresets();
    });
  }

  /* ---------- Step 1 -> Step 2: ສ້າງ QR ---------- */
  createQrBtn.addEventListener('click', async () => {
    if (selectedAmount < 1) return;

    createQrBtn.disabled = true;
    const originalHtml = createQrBtn.innerHTML;
    createQrBtn.innerHTML = 'ກຳລັງສ້າງ QR...';

    try {
      const res = await fetch('/api/topup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank: selectedBank, amount: selectedAmount }),
      });
      const data = await res.json().catch(() => ({}));

      // ບໍ່ໄດ້ login -> ພາໄປໜ້າ login ເລີຍ ດີກວ່າປ່ອຍໃຫ້ເຮັດຕໍ່ໄປແລ້ວມາຄ້າງຢູ່ຂັ້ນ
      // ອັບໂຫຼດສະລິບ (ຈະບັນທຶກລົງ topup_requests ບໍ່ໄດ້ ເພາະບໍ່ຮູ້ວ່າເປັນລູກຄ້າຄົນໃດ)
      if (res.status === 401 || data.requireLogin) {
        showToast('ກະລຸນາລ໋ອກອິນກ່ອນເຕີມເງິນ', true);
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        showToast(data.error || 'ສ້າງລາຍການເຕີມເງິນບໍ່ສຳເລັດ, ລອງໃໝ່ອີກຄັ້ງ', true);
        return;
      }

      currentTopupId = data.topupId || null;

      payAmountEl.textContent = formatKip(selectedAmount);
      const realQrUrl = QR_IMAGES[selectedBank];
      if (realQrUrl) {
        qrBox.innerHTML = `<img src="${realQrUrl}" alt="QR ຮັບເງິນ">`;
      } else {
        qrBox.textContent = `[ ຍັງບໍ່ໄດ້ຕັ້ງຮູບ QR — ໄປໃສ່ໃນຫ້ອງແອດມິນ > ຕັ້ງຄ່າຮ້ານ > QR ໂອນເງິນ ]`;
      }

      stepAmount.style.display = 'none';
      stepPay.classList.remove('u-hidden');
      stepPay.style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('ສ້າງ QR ບໍ່ສຳເລັດ', err);
      showToast('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ', true);
    } finally {
      createQrBtn.disabled = false;
      createQrBtn.innerHTML = originalHtml;
    }
  });

  backToAmountBtn.addEventListener('click', () => {
    stepPay.style.display = 'none';
    stepPay.classList.add('u-hidden');
    stepAmount.classList.remove('u-hidden');
    stepAmount.style.display = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---------- Step 2: ອັບໂຫຼດສະລິບ ---------- */
  slipInput.addEventListener('change', () => {
    const file = slipInput.files && slipInput.files[0];
    selectedSlip = file || null;
    if (file) {
      uploadLabel.classList.add('has-file');
      slipName.textContent = file.name;
      confirmBtn.disabled = false;
      if (uploadPreviewImg) {
        const reader = new FileReader();
        reader.onload = (e) => {
          uploadPreviewImg.src = e.target.result;
          uploadPreviewImg.classList.add('show');
          if (uploadIcon) uploadIcon.style.display = 'none';
        };
        reader.readAsDataURL(file);
      }
    } else {
      uploadLabel.classList.remove('has-file');
      slipName.textContent = 'ກົດເພື່ອເລືອກຮູບສະລິບ';
      confirmBtn.disabled = true;
      if (uploadPreviewImg) uploadPreviewImg.classList.remove('show');
      if (uploadIcon) uploadIcon.style.display = '';
    }
  });

  /* ---------- Step 2 -> Step 3: ຢືນຢັນການໂອນ ---------- */
  confirmBtn.addEventListener('click', async () => {
    if (!selectedSlip) return;

    confirmBtn.disabled = true;
    const originalHtml = confirmBtn.innerHTML;
    confirmBtn.innerHTML = 'ກຳລັງສົ່ງ...';

    try {
      // ອັບໂຫຼດ selectedSlip ໄປ Supabase storage bucket "topup-slips" ຜ່ານ Worker
      // (ຄືກັນກັບ product-images) ແລ້ວບັນທຶກລາຍການເຂົ້າ topup_requests ຈິງ
      const form = new FormData();
      form.append('topupId', currentTopupId || '');
      form.append('bank', String(selectedBank));
      form.append('amount', String(selectedAmount));
      form.append('slip', selectedSlip);

      const res = await fetch('/api/topup/confirm', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401 || data.requireLogin) {
        showToast('ກະລຸນາລ໋ອກອິນກ່ອນເຕີມເງິນ', true);
        redirectToLogin();
        return;
      }
      if (!res.ok || !data.ok) {
        // ສົ່ງບໍ່ສຳເລັດຈິງ -> ຢູ່ໜ້າເດີມ ບໍ່ພາໄປໜ້າ "ລໍຖ້າກວດສອບ" ຫຼອກໆ ຄືເມື່ອກ່ອນ
        showToast(data.error || 'ຢືນຢັນການໂອນບໍ່ສຳເລັດ, ລອງໃໝ່ອີກຄັ້ງ', true);
        return;
      }

      // ບັນທຶກເຂົ້າ topup_requests ສຳເລັດແລ້ວແທ້ໆ -> ຫ້ອງແອດມິນຈະເຫັນລາຍການນີ້ທັນທີ
      // ໃຊ້ id ແຖວຈິງທີ່ backend ຄືນມາ (ອາດຕ່າງຈາກ topupId ຊົ່ວຄາວຕອນ step ກ່ອນ)
      // ເປັນຕົວອ້າງອີງໃນການ poll ສະຖານະຕໍ່ໄປ
      currentTopupId = data.id || currentTopupId;
      refEl.textContent = currentTopupId || '-';
      waitAmountEl.textContent = formatKip(selectedAmount);
      stepPay.style.display = 'none';
      stepWaiting.classList.remove('u-hidden');
      stepWaiting.style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      startTuwPolling();
    } catch (err) {
      console.error('ຢືນຢັນການໂອນບໍ່ສຳເລັດ', err);
      showToast('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ', true);
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = originalHtml;
    }
  });

  // ---- ตั้งค่าเริ่มต้น: ดึงชื่อธนาคาร/รูป QR จริงจากแอดมินมาแสดง ----
  loadRealQrSettings();
});
