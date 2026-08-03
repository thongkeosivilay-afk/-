/* =========================================================
   script.js — ການເຮັດວຽກ (interaction) ຂອງໜ້າເວັບ NEXUS STORE
   ໜ້າທີ່ຂອງໄຟລ໌ນີ້:
   1) ປຸ່ມ "ຊື້ເລີຍ" (buy-btn)  -> ສະແດງ feedback ສັ້ນໆເມື່ອກົດ
   2) ປຸ່ມແຊທລອຍ (chat-fab)     -> ຈຸດເຊື່ອມຕໍ່ໄປລະບົບແຊັດ/Discord ຂອງທ່ານ
   3) ປຸ່ມ "ເລີ່ມຕົ້ນໃຊ້ງານ" ແລະ "ວິທີໃຊ້ງານ" -> scroll ໄປສ່ວນທີ່ກ່ຽວຂ້ອງ
   ບໍ່ມີການເອີ້ນ API ພາຍນອກ ຫຼື ເກັບຂໍ້ມູນຜູ້ໃຊ້ໃດໆ ໃນໄຟລ໌ນີ້
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- 1) ປຸ່ມຊື້ເລີຍ: ໃຫ້ feedback ວ່າກົດແລ້ວ ---------- */
  document.querySelectorAll('.buy-btn').forEach((btn) => {
    const originalText = btn.textContent.trim();
    btn.addEventListener('click', () => {
      // TODO: ຕໍ່ໄປສາຍານກັບລະບົບຕະກ້າ/ຊຳລະເງິນຈິງຂອງທ່ານທີ່ນີ້
      btn.disabled = true;
      btn.textContent = 'ເພີ່ມແລ້ວ ✓';
      btn.style.opacity = '0.75';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = originalText;
        btn.style.opacity = '1';
      }, 1400);
    });
  });

  /* ---------- 2) ປຸ່ມແຊທລອຍ ---------- */
  const chatFab = document.querySelector('.chat-fab');
  if (chatFab) {
    chatFab.addEventListener('click', () => {
      // TODO: ປ່ຽນ URL ນີ້ເປັນລິ້ງ Discord / Messenger / LiveChat ຈິງຂອງຮ້ານທ່ານ
      window.open('https://discord.com', '_blank', 'noopener');
    });
  }

  /* ---------- 3) ປຸ່ມ Hero: scroll ໄປສ່ວນທີ່ກ່ຽວຂ້ອງ ---------- */
  const startBtn = document.querySelector('.btn-primary');
  const howBtn = document.querySelector('.btn-ghost');

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      document.querySelector('.section.cat-block')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (howBtn) {
    howBtn.addEventListener('click', () => {
      document.querySelector('.promo')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

});
