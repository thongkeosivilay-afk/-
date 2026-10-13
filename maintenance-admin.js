/* =========================================================
   maintenance-admin.js — ปุ่มปิด/เปิดเว็บ (โหมดปิดปรับปรุง) ในห้องแอดมิน
   คุยกับ Worker ที่ GET/POST /api/admin/maintenance (เฉพาะแอดมิน)
   ========================================================= */
(function () {
  const $ = (id) => document.getElementById(id);
  const card = $('mtCard'), btn = $('mtBtn'), status = $('mtStatus'), sub = $('mtSub');
  if (!card || !btn) return;

  let isClosed = false;

  function render(on) {
    isClosed = on;
    card.classList.toggle('is-closed', on);
    card.classList.toggle('is-open', !on);
    status.textContent = on ? 'ເວັບປິດປັບປຸງຢູ່ (ມີແຕ່ແອດມິນເຂົ້າໄດ້)' : 'ເວັບເປີດໃຊ້ງານປົກກະຕິ';
    btn.textContent = on ? 'ເປີດເວັບ' : 'ປິດເວັບ';
    btn.classList.toggle('is-open-action', on);
    btn.disabled = false;
  }

  async function load() {
    try {
      const res = await fetch('/api/admin/maintenance', { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) return; // ຍັງບໍ່ໄດ້ລ໋ອກອິນແອດມິນ — ບໍ່ຕ້ອງເຮັດຫຍັງ
      const d = await res.json();
      render(d.on === true);
    } catch (e) { /* ເງຽບໄວ້ */ }
  }

  btn.addEventListener('click', async () => {
    const next = !isClosed;
    const msg = next
      ? 'ປິດເວັບດຽວນີ້? ລູກຄ້າທຸກຄົນຈະເຂົ້າເວັບບໍ່ໄດ້ ແລະ ເຫັນໜ້າປິດປັບປຸງ (ແອດມິນຍັງເຂົ້າໄດ້)'
      : 'ເປີດເວັບໃຫ້ລູກຄ້າເຂົ້າໃຊ້ງານປົກກະຕິ?';
    if (!confirm(msg)) return;
    btn.disabled = true;
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on: next }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'ບໍ່ສຳເລັດ');
      render(d.on === true);
      if (typeof showToast === 'function') showToast(d.on ? 'ປິດເວັບແລ້ວ' : 'ເປີດເວັບແລ້ວ');
    } catch (e) {
      btn.disabled = false;
      if (typeof showToast === 'function') showToast('ບັນທຶກບໍ່ສຳເລັດ: ' + e.message);
      else alert('ບັນທຶກບໍ່ສຳເລັດ: ' + e.message);
    }
  });

  load();
})();
