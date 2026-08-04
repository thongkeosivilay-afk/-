/* =========================================================
   admin.js — ຫ້ອງແອດມິນ DEK MASH SHOP
   ⚠️ ການລ໋ອກອິນນີ້ກວດຢູ່ຝັ່ງ browser (client-side) ເທົ່ານັ້ນ —
   ເໝາະສຳລັບ demo/ທົດລອງໃຊ້ງານ ບໍ່ແມ່ນຄວາມປອດໄພລະດັບໃຊ້ງານຈິງ
   ========================================================= */

(function () {
  const SESSION_KEY = 'dms_admin_session';
  let currentCat = 'all';
  let activeModalPid = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
  }

  /* ---------- Auth ---------- */
  function isLoggedIn() {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  }
  function login() {
    const pw = $('#pwInput').value;
    if (StoreData.checkPassword(pw)) {
      sessionStorage.setItem(SESSION_KEY, '1');
      showDashboard();
    } else {
      $('#loginError').textContent = 'ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ';
    }
  }
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    $('#dashboard').style.display = 'none';
    $('#loginScreen').style.display = 'flex';
    $('#pwInput').value = '';
    $('#loginError').textContent = '';
  }

  function showDashboard() {
    $('#loginScreen').style.display = 'none';
    $('#dashboard').style.display = 'block';
    renderAll();
  }

  /* ---------- Rendering ---------- */
  const CAT_LABEL = { pc: 'PC', android: 'Android', gear: 'ອຸປະກອນ' };

  function renderAll() {
    const data = StoreData.load();
    renderStats(data);
    renderList(data);
  }

  function renderStats(data) {
    const ready = data.products.filter((p) => p.status === 'ready').length;
    const stock = data.products.reduce((s, p) => s + p.codes.length, 0);
    const sold = data.products.reduce((s, p) => s + p.sold.length, 0);
    $('#statReady').textContent = ready;
    $('#statStock').textContent = stock;
    $('#statSold').textContent = sold;
  }

  function renderList(data) {
    const list = $('#prodList');
    list.innerHTML = '';
    const products = data.products.filter((p) => currentCat === 'all' || p.category === currentCat);

    products.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'prow';
      row.dataset.pid = p.id;

      const stock = p.codes.length;
      const readyBadge = p.status === 'ready'
        ? `<span class="prow-badge ready">ພ້ອມຂາຍ</span>`
        : `<span class="prow-badge not-ready">ບໍ່ພ້ອມ</span>`;

      row.innerHTML = `
        <div class="prow-id">${CAT_LABEL[p.category]}<br>#${p.id.split('-')[1]}</div>
        <div class="prow-body">
          <div class="prow-name ${p.name ? '' : 'todo'}">${p.name || 'ຍັງບໍ່ໄດ້ຕັ້ງຊື່'}</div>
          <div class="prow-meta">
            <span>₭ ${Number(p.price || 0).toLocaleString('en-US')}</span>
            <span>ສະຕັອກ ${stock}</span>
            <span>ຂາຍແລ້ວ ${p.sold.length}</span>
          </div>
        </div>
        ${readyBadge}
        <svg class="prow-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
      `;
      row.addEventListener('click', () => openProductModal(p.id));
      list.appendChild(row);
    });

    if (!products.length) {
      list.innerHTML = `<div class="empty-note">ບໍ່ມີສິນຄ້າໃນໝວດນີ້</div>`;
    }
  }

  /* ---------- Product modal ---------- */
  function openProductModal(pid) {
    activeModalPid = pid;
    const data = StoreData.load();
    const p = StoreData.getProduct(data, pid);
    if (!p) return;

    $('#modalTitle').textContent = `ຈັດການສິນຄ້າ — ${pid.toUpperCase()}`;
    $('#mName').value = p.name || '';
    $('#mPrice').value = p.price || '';
    $('#mCodesInput').value = '';
    renderModalCodeLists(p);

    $('#prodModal').classList.remove('hidden');
  }

  function renderModalCodeLists(p) {
    $('#mStockCount').textContent = p.codes.length;
    $('#mSoldCount').textContent = p.sold.length;

    const stockList = $('#mStockList');
    stockList.innerHTML = '';
    if (!p.codes.length) {
      stockList.innerHTML = `<div class="empty-note">ຍັງບໍ່ມີລະຫັດໃນສະຕັອກ — ເພີ່ມຂ້າງເທິງ</div>`;
    } else {
      p.codes.forEach((code) => {
        const chip = document.createElement('div');
        chip.className = 'code-chip';
        chip.innerHTML = `<span class="en">${escapeHtml(code)}</span><button data-code="${escapeAttr(code)}">ລຶບ</button>`;
        chip.querySelector('button').addEventListener('click', () => {
          StoreData.removeCode(activeModalPid, code);
          refreshModalAndList();
          toast('ລຶບລະຫັດອອກຈາກສະຕັອກແລ້ວ');
        });
        stockList.appendChild(chip);
      });
    }

    const soldList = $('#mSoldList');
    soldList.innerHTML = '';
    if (!p.sold.length) {
      soldList.innerHTML = `<div class="empty-note">ຍັງບໍ່ມີການຂາຍ</div>`;
    } else {
      [...p.sold].reverse().forEach((s) => {
        const chip = document.createElement('div');
        chip.className = 'code-chip';
        const dt = new Date(s.at);
        chip.innerHTML = `<span class="en">${escapeHtml(s.code)}</span><span style="color:var(--text-faint); font-size:11px;">${dt.toLocaleString('lo-LA')}</span>`;
        soldList.appendChild(chip);
      });
    }
  }

  function refreshModalAndList() {
    const data = StoreData.load();
    const p = StoreData.getProduct(data, activeModalPid);
    if (p) renderModalCodeLists(p);
    renderAll();
  }

  function closeProductModal() {
    $('#prodModal').classList.add('hidden');
    activeModalPid = null;
  }

  function saveProductInfo() {
    if (!activeModalPid) return;
    const name = $('#mName').value.trim();
    const price = Number($('#mPrice').value) || 0;
    StoreData.updateProduct(activeModalPid, { name, price });
    refreshModalAndList();
    toast('ບັນທຶກຊື່/ລາຄາແລ້ວ');
  }

  function addCodesFromTextarea() {
    if (!activeModalPid) return;
    const raw = $('#mCodesInput').value;
    const lines = raw.split('\n');
    const result = StoreData.addCodes(activeModalPid, lines);
    if (!result) return;
    $('#mCodesInput').value = '';
    refreshModalAndList();
    if (result.added > 0) {
      toast(`ເພີ່ມ ${result.added} ລະຫັດເຂົ້າສະຕັອກແລ້ວ${result.skipped ? ` (ຂ້າມຊ້ຳ ${result.skipped})` : ''}`);
    } else {
      toast('ບໍ່ມີລະຫັດໃໝ່ຖືກເພີ່ມ (ອາດຊ້ຳໝົດ ຫຼື ຊ່ອງຫວ່າງ)');
    }
  }

  /* ---------- Settings modal ---------- */
  function openSettings() { $('#settingsModal').classList.remove('hidden'); }
  function closeSettings() { $('#settingsModal').classList.add('hidden'); }

  function savePassword() {
    const pw = $('#newPwInput').value.trim();
    if (pw.length < 4) {
      toast('ລະຫັດຜ່ານຄວນຍາວຢ່າງນ້ອຍ 4 ຕົວອັກສອນ');
      return;
    }
    StoreData.setPassword(pw);
    $('#newPwInput').value = '';
    toast('ປ່ຽນລະຫັດຜ່ານແລ້ວ');
  }

  function resetAllData() {
    if (!confirm('ລ້າງຂໍ້ມູນສິນຄ້າ/ສະຕັອກ/ປະຫວັດການຂາຍທັງໝົດ? ການນີ້ບໍ່ສາມາດກູ້ຄືນໄດ້')) return;
    StoreData.resetAll();
    closeSettings();
    renderAll();
    toast('ລ້າງຂໍ້ມູນທັງໝົດແລ້ວ');
  }

  /* ---------- Helpers ---------- */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(str) { return escapeHtml(str); }

  /* ---------- Wire up ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    if (isLoggedIn()) {
      showDashboard();
    }

    $('#loginBtn').addEventListener('click', login);
    $('#pwInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
    $('#logoutBtn').addEventListener('click', logout);

    $$('.cat-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.cat-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        currentCat = tab.dataset.cat;
        renderAll();
      });
    });

    $('#modalClose').addEventListener('click', closeProductModal);
    $('#prodModal').addEventListener('click', (e) => { if (e.target.id === 'prodModal') closeProductModal(); });
    $('#mSaveInfo').addEventListener('click', saveProductInfo);
    $('#mAddCodes').addEventListener('click', addCodesFromTextarea);

    $('#settingsBtn').addEventListener('click', openSettings);
    $('#settingsClose').addEventListener('click', closeSettings);
    $('#settingsModal').addEventListener('click', (e) => { if (e.target.id === 'settingsModal') closeSettings(); });
    $('#savePwBtn').addEventListener('click', savePassword);
    $('#resetBtn').addEventListener('click', resetAllData);
  });
})();
