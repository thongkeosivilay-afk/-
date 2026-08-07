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
  const amountInput = document.querySelector('#topupAmountInput');
  const presets = document.querySelectorAll('.topup-preset');
  const createQrBtn = document.querySelector('#topupCreateQrBtn');

  const backToAmountBtn = document.querySelector('#topupBackToAmount');
  const payAmountEl = document.querySelector('#topupPayAmount');
  const qrBox = document.querySelector('#topupQrBox');
  const uploadLabel = document.querySelector('#topupUploadLabel');
  const slipInput = document.querySelector('#topupSlipInput');
  const slipName = document.querySelector('#topupSlipName');
  const confirmBtn = document.querySelector('#topupConfirmBtn');

  const refEl = document.querySelector('#topupRef');
  const waitAmountEl = document.querySelector('#topupWaitAmount');

  const BANKS = {
    1: { name: 'ທະນາຄານ ພັດທະນາລາວ' },
    2: { name: 'ທະນາຄານ ການຄ້າຕ່າງປະເທດ' },
  };

  let selectedBank = 1;
  let selectedAmount = 0;
  let selectedSlip = null;
  let currentTopupId = null;

  function formatKip(n) {
    return Number(n || 0).toLocaleString('th-TH') + ' ₭';
  }

  function updateBankText() {
    const b = BANKS[selectedBank];
    bankTitle.textContent = `ໂອນ QR ${b.name}`;
    bankDesc.textContent = `ສະແກນ QR ຮັບເງິນຂອງຮ້ານ (${b.name}) ຜ່ານແອັບທະນາຄານ ແລ້ວອັບໂຫຼດສະລິບເພື່ອລໍຖ້າແອດມິນກວດສອບ`;
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
    selectedAmount = Math.max(0, Number(val) || 0);
    amountInput.value = selectedAmount || '';
    presets.forEach((p) => {
      p.classList.toggle('active', Number(p.dataset.amount) === selectedAmount);
    });
    createQrBtn.disabled = selectedAmount < 1000;
  }

  amountInput.addEventListener('input', (e) => setAmount(e.target.value));
  presets.forEach((p) => {
    p.addEventListener('click', () => setAmount(p.dataset.amount));
  });

  /* ---------- Step 1 -> Step 2: ສ້າງ QR ---------- */
  createQrBtn.addEventListener('click', async () => {
    if (selectedAmount < 1000) return;

    createQrBtn.disabled = true;
    const originalHtml = createQrBtn.innerHTML;
    createQrBtn.innerHTML = 'ກຳລັງສ້າງ QR...';

    try {
      // TODO: ຕໍ່ API ຈິງ — ຄືນ { topupId, qrImageUrl } ຈາກ backend
      const res = await fetch('/api/topup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank: selectedBank, amount: selectedAmount }),
      });

      let qrImageUrl = null;
      if (res.ok) {
        const data = await res.json();
        currentTopupId = data.topupId || null;
        qrImageUrl = data.qrImageUrl || null;
      } else {
        // ยังไม่มี endpoint จริง -> โชว์เป็น placeholder ไปก่อน ไม่บล็อกการทดลองใช้งาน
        currentTopupId = 'LOCAL-' + Date.now().toString(36).toUpperCase();
      }

      payAmountEl.textContent = formatKip(selectedAmount);
      if (qrImageUrl) {
        qrBox.innerHTML = `<img src="${qrImageUrl}" alt="QR ຮັບເງິນ">`;
      } else {
        qrBox.textContent = `[ QR ຮັບເງິນ ${BANKS[selectedBank].name} ]`;
      }

      stepAmount.style.display = 'none';
      stepPay.style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('ສ້າງ QR ບໍ່ສຳເລັດ', err);
      currentTopupId = 'LOCAL-' + Date.now().toString(36).toUpperCase();
      payAmountEl.textContent = formatKip(selectedAmount);
      qrBox.textContent = `[ QR ຮັບເງິນ ${BANKS[selectedBank].name} ]`;
      stepAmount.style.display = 'none';
      stepPay.style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      createQrBtn.disabled = false;
      createQrBtn.innerHTML = originalHtml;
    }
  });

  backToAmountBtn.addEventListener('click', () => {
    stepPay.style.display = 'none';
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
    } else {
      uploadLabel.classList.remove('has-file');
      slipName.textContent = 'ກົດເພື່ອເລືອກຮູບສະລິບ';
      confirmBtn.disabled = true;
    }
  });

  /* ---------- Step 2 -> Step 3: ຢືນຢັນການໂອນ ---------- */
  confirmBtn.addEventListener('click', async () => {
    if (!selectedSlip) return;

    confirmBtn.disabled = true;
    const originalHtml = confirmBtn.innerHTML;
    confirmBtn.innerHTML = 'ກຳລັງສົ່ງ...';

    try {
      // TODO: ຕໍ່ API ຈິງ — ອັບໂຫຼດ selectedSlip ໄປ Supabase storage bucket
      // "topup-slips" ຜ່ານ Worker (ຄືກັນກັບ product-images) ແລ້ວບັນທຶກລາຍການ
      const form = new FormData();
      form.append('topupId', currentTopupId || '');
      form.append('bank', String(selectedBank));
      form.append('amount', String(selectedAmount));
      form.append('slip', selectedSlip);

      await fetch('/api/topup/confirm', { method: 'POST', body: form }).catch(() => null);
    } catch (err) {
      console.error('ຢືນຢັນການໂອນບໍ່ສຳເລັດ (ຍັງບໍ່ໄດ້ຕໍ່ backend ຈິງ)', err);
    } finally {
      refEl.textContent = currentTopupId || '-';
      waitAmountEl.textContent = formatKip(selectedAmount);
      stepPay.style.display = 'none';
      stepWaiting.style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = originalHtml;
    }
  });

  // ---- ตั้งค่าเริ่มต้น ----
  updateBankText();
});
