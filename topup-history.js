/* =========================================================
   topup-history.js — ການເຮັດວຽກຂອງໜ້າ topup-history.html
   ດຶງປະຫວັດການເຕີມເງິນຈິງຂອງລູກຄ້າຄົນທີ່ login ຢູ່ (GET /api/topup/history)
   ແລ້ວຄິດໄລ່ສະຖິຕິ (ລາຍການທັງໝົດ / ສຳເລັດແລ້ວ / ຍອດເຕີມລວມ) ຈາກຂໍ້ມູນຈິງເອງ
   ບໍ່ໄດ້ hardcode ຫຍັງໄວ້ເລີຍ — ຖ້າຍັງບໍ່ມີລາຍການ ຈະສະແດງ empty state ຄືໃນຮູບຕົວຢ່າງ
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const loadingEl = document.querySelector('#thLoading');
  const emptyEl = document.querySelector('#thEmpty');
  const listEl = document.querySelector('#thList');
  if (!loadingEl || !emptyEl || !listEl) return; // ไม่ใช่หน้า topup-history

  const statTotalEl = document.querySelector('#thStatTotal');
  const statDoneEl = document.querySelector('#thStatDone');
  const statAmountEl = document.querySelector('#thStatAmount');

  function formatKip(n) {
    return Number(n || 0).toLocaleString('de-DE') + ' ₭';
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString('lo-LA', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso || '-';
    }
  }

  const STATUS_LABEL = {
    pending: 'ລໍຖ້າກວດສອບ',
    approved: 'ສຳເລັດແລ້ວ',
    rejected: 'ຖືກປະຕິເສດ',
  };

  function renderList(items) {
    listEl.innerHTML = items.map((r) => `
      <div class="th-item">
        <div class="th-item-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>
        </div>
        <div class="th-item-body">
          <div class="th-item-amount">${formatKip(r.amount)}</div>
          <div class="th-item-date">${formatDate(r.created_at)}</div>
        </div>
        <span class="th-item-status ${r.status}">${STATUS_LABEL[r.status] || r.status}</span>
      </div>
    `).join('');
  }

  (async () => {
    try {
      const res = await fetch('/api/topup/history', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401 || data.requireLogin) {
        window.location.href = '/login.html?next=' + encodeURIComponent('/topup-history.html');
        return;
      }
      if (!res.ok || !data.ok) {
        loadingEl.textContent = data.error || 'ດຶງປະຫວັດການເຕີມເງິນບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ';
        loadingEl.classList.add('th-error');
        return;
      }

      const items = data.items || [];

      // ---- สถิติ: คิดจากข้อมูลจริงที่ดึงมาเท่านั้น ----
      const total = items.length;
      const doneItems = items.filter((r) => r.status === 'approved');
      const done = doneItems.length;
      const totalAmount = doneItems.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

      statTotalEl.textContent = total.toLocaleString('th-TH');
      statDoneEl.textContent = done.toLocaleString('th-TH');
      statAmountEl.textContent = formatKip(totalAmount);

      loadingEl.style.display = 'none';

      if (!items.length) {
        emptyEl.style.display = '';
        return;
      }

      renderList(items);
      listEl.style.display = '';
    } catch (err) {
      console.error('ດຶງປະຫວັດການເຕີມເງິນບໍ່ສຳເລັດ', err);
      loadingEl.textContent = 'ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ';
      loadingEl.classList.add('th-error');
    }
  })();
});
