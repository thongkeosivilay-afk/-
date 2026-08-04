/* =========================================================
   admin.js — ຫ້ອງແອດມິນ DEK MASH SHOP
   ການລ໋ອກອິນຫ້ອງແອດມິນໃຊ້ Discord OAuth (worker/src/index.js)
   ຝັ່ງເຊີບເວີເປັນຄົນເຊັກວ່າອີເມວ Discord ກົງກັບອີເມວແອດມິນ
   ຫຼືບໍ່ (isAdmin) — ໜ້ານີ້ພຽງແຕ່ຖາມສະຖານະຈາກ /api/me ເທົ່ານັ້ນ
   ========================================================= */

(function () {
  let currentCat = 'all';
  let activeModalPid = null;
  let currentUser = null;

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

  /* ---------- Auth (ຜ່ານ Discord + worker session) ---------- */
  function goToDiscordLogin() {
    window.location.href = '/auth/discord/login?next=' + encodeURIComponent(location.pathname);
  }

  function logout() {
    window.location.href = '/auth/logout';
  }

  async function checkAuthAndInit() {
    let res;
    try {
      res = await fetch('/api/me', { credentials: 'same-origin' });
    } catch (e) {
      showLogin('ຕິດຕໍ່ເຊີບເວີບໍ່ໄດ້ — ລອງໃໝ່ພາຍຫຼັງ');
      return;
    }
    const data = await res.json();

    if (!data.loggedIn) {
      showLogin();
      return;
    }
    if (!data.user || !data.user.isAdmin) {
      currentUser = data.user;
      showDenied();
      return;
    }

    currentUser = data.user;
    showDashboard();
  }

  function showLogin(errorMsg) {
    $('#loginScreen').style.display = 'flex';
    $('#deniedScreen').style.display = 'none';
    $('#dashboard').style.display = 'none';
    $('#loginError').textContent = errorMsg || '';
  }

  function showDenied() {
    $('#loginScreen').style.display = 'none';
    $('#deniedScreen').style.display = 'flex';
    $('#dashboard').style.display = 'none';
  }

  function showDashboard() {
    $('#loginScreen').style.display = 'none';
    $('#deniedScreen').style.display = 'none';
    $('#dashboard').style.display = 'block';
    const info = $('#settingsAccountInfo');
    if (info && currentUser) {
      info.textContent = `ລ໋ອກອິນເປັນ: ${currentUser.username || 'ບໍ່ຮູ້ຊື່'}`;
    }
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
    checkAuthAndInit();

    $('#discordLoginBtn').addEventListener('click', goToDiscordLogin);
    $('#deniedLogoutBtn').addEventListener('click', logout);
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
    $('#resetBtn').addEventListener('click', resetAllData);
  });
})();
