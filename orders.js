/* =========================================================
   orders.js — ການເຮັດວຽກຂອງໜ້າ orders.html
   ດຶງປະຫວັດການສັ່ງຊື້ຈິງຂອງລູກຄ້າຄົນທີ່ login ຢູ່ (GET /api/orders/history)
   ແລ້ວຄິດໄລ່ສະຖິຕິ (ລາຍການທັງໝົດ / ສຳເລັດແລ້ວ / ຍອດຊື້ລວມ) ຈາກຂໍ້ມູນຈິງເອງ
   ບໍ່ໄດ້ hardcode ຫຍັງໄວ້ເລີຍ — ຖ້າຍັງບໍ່ມີລາຍການ ຈະສະແດງ empty state ຄືໃນຮູບຕົວຢ່າງ
   (ໂຄງສ້າງອ້າງອີງມາຈາກ topup-history.js) ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const loadingEl = document.querySelector('#ohLoading');
  const emptyEl = document.querySelector('#ohEmpty');
  const listEl = document.querySelector('#ohList');
  if (!loadingEl || !emptyEl || !listEl) return; // ไม่ใช่หน้า orders

  const statTotalEl = document.querySelector('#ohStatTotal');

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

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
    completed: 'ສຳເລັດແລ້ວ',
    failed: 'ລົ້ມເຫຼວ',
  };

  function itemHTML(r) {
    const nameLine = escapeHtml(r.product_name || 'ສິນຄ້າ');
    const durationLine = r.duration_label ? ` — ${escapeHtml(r.duration_label)}` : '';
    const codeBlock = r.code ? `
        <div class="oh-item-code" data-code="${escapeHtml(r.code)}" title="ແຕະເພື່ອສຳເນົາລະຫັດ">
          <span>${escapeHtml(r.code)}</span>
          <span class="copy-hint">ສຳເນົາ</span>
        </div>` : '';
    return `
      <div class="oh-item">
        <div class="oh-item-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5-9 9"/></svg>
        </div>
        <div class="oh-item-body">
          <div class="oh-item-name">${nameLine}${durationLine}</div>
          <div class="oh-item-amount">${formatKip(r.price)}</div>
          <div class="oh-item-date">${formatDate(r.created_at)}</div>
        </div>
        <span class="oh-item-status ${r.status}">${STATUS_LABEL[r.status] || r.status}</span>
        ${codeBlock}
      </div>
    `;
  }

  function renderList(items) {
    listEl.innerHTML = items.map(itemHTML).join('');
    listEl.querySelectorAll('.oh-item-code').forEach((el) => {
      el.addEventListener('click', async () => {
        const code = el.dataset.code || '';
        try {
          await navigator.clipboard.writeText(code);
          const hint = el.querySelector('.copy-hint');
          if (hint) {
            const original = hint.textContent;
            hint.textContent = 'ສຳເນົາແລ້ວ ✓';
            setTimeout(() => { hint.textContent = original; }, 1200);
          }
        } catch { /* clipboard ไม่รองรับ — ปล่อยผ่าน ผู้ใช้ copy เองจากที่แสดงได้ */ }
      });
    });
  }

  (async () => {
    try {
      const res = await fetch('/api/orders/history', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401 || data.requireLogin) {
        window.location.href = '/login.html?next=' + encodeURIComponent('/orders.html');
        return;
      }
      if (!res.ok || !data.ok) {
        loadingEl.textContent = data.error || 'ດຶງປະຫວັດການສັ່ງຊື້ບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ';
        loadingEl.classList.add('oh-error');
        return;
      }

      const items = data.items || [];

      // ---- สถิติ: คิดจากข้อมูลจริงที่ดึงมาเท่านั้น ----
      const total = items.length;

      statTotalEl.textContent = total.toLocaleString('th-TH');

      loadingEl.style.display = 'none';

      if (!items.length) {
        emptyEl.style.display = '';
        return;
      }

      renderList(items);
      listEl.style.display = '';
    } catch (err) {
      console.error('ດຶງປະຫວັດການສັ່ງຊື້ບໍ່ສຳເລັດ', err);
      loadingEl.textContent = 'ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ';
      loadingEl.classList.add('oh-error');
    }
  })();
});
