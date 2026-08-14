/* =========================================================
   orders.js — ການເຮັດວຽກຂອງໜ້າ orders.html
   ດຶງປະຫວັດການສັ່ງຊື້ຈິງຂອງລູກຄ້າຄົນທີ່ login ຢູ່ (GET /api/orders/history)
   ແລ້ວຄິດໄລ່ສະຖິຕິ (ລາຍການທັງໝົດ / ສຳເລັດແລ້ວ / ຍອດຊື້ລວມ) ຈາກຂໍ້ມູນຈິງເອງ
   ບໍ່ໄດ້ hardcode ຫຍັງໄວ້ເລີຍ — ຖ້າຍັງບໍ່ມີລາຍການ ຈະສະແດງ empty state ຄືໃນຮູບຕົວຢ່າງ
   (ໂຄງສ້າງອ້າງອີງມາຈາກ topup-history.js)

   ໝາຍເຫດ: ລະບົບຫຼັງບ້ານຊື້ 1 ຄັ້ງ = 1 ລະຫັດ = 1 ແຖວໃນຕາຕະລາງ orders (ເບິ່ງ src/index.js
   handleOrderCreate). ສະນັ້ນເວລາລູກຄ້າກົດ "ຊື້ເລີຍ" ດ້ວຍຈຳນວນຫຼາຍກວ່າ 1 ອັນ (product.js ຈະຍິງ
   /api/orders/create ຊ້ຳຫຼາຍຄັ້ງຕິດຕໍ່ກັນ) ຈະໄດ້ຫຼາຍແຖວທີ່ product_name/duration_label/status
   ຄືກັນ ແລະເວລາ created_at ໃກ້ກັນຫຼາຍ — ໜ້ານີ້ຈຶ່ງລວມ (group) ແຖວພວກນັ້ນເປັນກາດດຽວ ພ້ອມສະແດງ
   ລະຫັດທຸກອັນຮຽງລົງມາ ແລະປຸ່ມ "ຄັດລອກທັງໝົດ" (ບໍ່ໄດ້ໄປແກ້ຫຍັງໃນຝັ່ງ backend/ຖານຂໍ້ມູນເລີຍ)
   ========================================================= */

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

  // ຖ້າແຖວ 2 ອັນ ຊື້ຕິດກັນ (product/duration/status ຄືກັນ) ຫ່າງກັນບໍ່ເກີນ 90 ວິນາທີ
  // ຖືວ່າແມ່ນການສັ່ງຊື້ຊຸດດຽວກັນ (ຈາກການກົດ "ຊື້ເລີຍ" ຄັ້ງດຽວ ຫຼາຍຈຳນວນ) -> ລວມກາດດຽວກັນ
  const GROUP_WINDOW_MS = 90 * 1000;

  function groupOrders(items) {
    const groups = [];
    items.forEach((r) => {
      const last = groups[groups.length - 1];
      const sameBatch = last
        && last.product_name === (r.product_name || '')
        && last.duration_label === (r.duration_label || '')
        && last.status === r.status
        && Math.abs(new Date(last.earliestAt) - new Date(r.created_at)) <= GROUP_WINDOW_MS;

      if (sameBatch) {
        last.rows.push(r);
        last.earliestAt = r.created_at; // ຂໍ້ມູນຮຽງ created_at ໃໝ່ -> ເກົ່າ, ຂະຫຍາຍຂອບເຂດຕໍ່ໄປເລື່ອຍໆ
      } else {
        groups.push({
          product_name: r.product_name || '',
          duration_label: r.duration_label || '',
          status: r.status,
          rows: [r],
          earliestAt: r.created_at,
        });
      }
    });
    return groups;
  }

  function groupHTML(g) {
    const head = g.rows[0]; // ແຖວທຳອິດ (ໃໝ່ສຸດໃນກຸ່ມ) — ໃຊ້ສະແດງເລກອໍເດີ/ວັນທີ
    const qty = g.rows.length;
    const totalPrice = g.rows.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    const nameLine = escapeHtml(g.product_name || 'ສິນຄ້າ');
    const durationLine = g.duration_label ? ` — ${escapeHtml(g.duration_label)}` : '';
    const qtyLine = qty > 1 ? `<div class="oh-item-qty">ຈຳນວນ: ${qty} ອັນ</div>` : '';

    const codes = g.rows.filter((r) => r.code);
    let codeBlock = '';
    if (codes.length) {
      const lines = codes.map((r, i) => `
          <div class="oh-code-line" data-code="${escapeHtml(r.code)}" title="ແຕະເພື່ອສຳເນົາລະຫັດ">
            ${qty > 1 ? `<span class="num">${i + 1}</span>` : ''}
            <span class="val">${escapeHtml(r.code)}</span>
            <span class="tick">✓</span>
          </div>`).join('');
      const copyAllBtn = codes.length > 1 ? `
          <button type="button" class="oh-copy-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            ຄັດລອກທັງໝົດ
          </button>` : '';
      codeBlock = `
        <div class="oh-code-group">
          <div class="oh-code-lines">${lines}</div>
          ${copyAllBtn}
        </div>`;
    }

    return `
      <div class="oh-item">
        <div class="oh-item-head">
          <div class="oh-item-id">#${escapeHtml(head.id || '')}<br/>${formatDate(head.created_at)}</div>
          <span class="oh-item-status ${g.status}">${STATUS_LABEL[g.status] || g.status}</span>
        </div>
        <div class="oh-item-main">
          <div class="oh-item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5-9 9"/></svg>
          </div>
          <div class="oh-item-body">
            <div class="oh-item-name">${nameLine}${durationLine}</div>
            ${qtyLine}
            <div class="oh-item-amount">${formatKip(totalPrice)}</div>
          </div>
        </div>
        ${codeBlock}
      </div>
    `;
  }

  function renderList(items) {
    const groups = groupOrders(items);
    listEl.innerHTML = groups.map(groupHTML).join('');

    // ສຳເນົາທີລະລະຫັດ (ແຕະໃສ່ແຖວນັ້ນ)
    listEl.querySelectorAll('.oh-code-line').forEach((el) => {
      el.addEventListener('click', async () => {
        const code = el.dataset.code || '';
        try {
          await navigator.clipboard.writeText(code);
          el.classList.add('is-copied');
          setTimeout(() => el.classList.remove('is-copied'), 1000);
        } catch { /* clipboard ไม่รองรับ — ปล่อยผ่าน ผู้ใช้ copy เองจากที่แสดงได้ */ }
      });
    });

    // ສຳເນົາລະຫັດທັງໝົດໃນກາດດຽວ (ສຳລັບກາດທີ່ຊື້ຫຼາຍກວ່າ 1 ອັນ)
    listEl.querySelectorAll('.oh-copy-all').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const group = btn.closest('.oh-code-group');
        const codes = Array.from(group.querySelectorAll('.oh-code-line')).map((el) => el.dataset.code);
        try {
          await navigator.clipboard.writeText(codes.join('\n'));
          const original = btn.innerHTML;
          btn.classList.add('is-done');
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>ຄັດລອກແລ້ວ`;
          setTimeout(() => { btn.innerHTML = original; btn.classList.remove('is-done'); }, 1400);
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
