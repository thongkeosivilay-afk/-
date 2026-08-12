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
      refEl.textContent = data.id || currentTopupId || '-';
      waitAmountEl.textContent = formatKip(selectedAmount);
      stepPay.style.display = 'none';
      stepWaiting.classList.remove('u-hidden');
      stepWaiting.style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
