/* =========================================================
   admin.js — ຫ້ອງແອດມິນ DEK MASH SHOP
   ການລ໋ອກອິນຫ້ອງແອດມິນໃຊ້ Discord OAuth (worker/src/index.js)
   ຝັ່ງເຊີບເວີເປັນຄົນເຊັກວ່າອີເມວ Discord ກົງກັບອີເມວແອດມິນ
   ຫຼືບໍ່ (isAdmin) — ໜ້ານີ້ພຽງແຕ່ຖາມສະຖານະຈາກ /api/me ເທົ່ານັ້ນ

   ໂຄງສ້າງແທັບ (5 ແທັບ, ບໍ່ແມ່ນຫມວດຫມູ່ອີກຕໍ່ໄປ — ແຕ່ລະແທັບແມ່ນ "ໜ້າທີ່"):
     add-product   → ລວມສິນຄ້າທັງໝົດ + ສ້າງສິນຄ້າໃໝ່ + ແກ້ໄຂໄດ້ທຸກຢ່າງ
     add-code      → ເລືອກສິນຄ້າ ແລ້ວເຕີມລະຫັດເຂົ້າສະຕັອກ
     edit-name-cat → ເລືອກສິນຄ້າ ແລ້ວແກ້ໄຂຊື່/ຫມວດຫມູ່
     edit-image    → ເລືອກສິນຄ້າ ແລ້ວປ່ຽນຮູບພາບ
     edit-desc     → ເລືອກສິນຄ້າ ແລ້ວແກ້ໄຂຄຳບັນຍາຍ
   ========================================================= */

(function () {
  let currentTab = 'add-product'; // 'add-product' | 'add-code' | 'edit-name-cat' | 'edit-image' | 'edit-desc'
  let activeModalPid = null;
  let currentUser = null;

  // ແຕ່ລະແທັບ ສະແດງ section ໃດແດ່ໃນ modal ຈັດການສິນຄ້າ
  const TAB_SECTIONS = {
    'add-product': ['name', 'price', 'category', 'image', 'description', 'codes', 'sold'],
    'add-code': ['codes', 'sold'],
    'edit-name-cat': ['name', 'category'],
    'edit-image': ['image'],
    'edit-desc': ['description']
  };
  const TAB_TITLE = {
    'add-product': 'ຈັດການສິນຄ້າ — ',
    'add-code': 'ເຕິມລະຫັດ — ',
    'edit-name-cat': 'ແກ້ໄຂຊື່-ຫມວດຫມູ່ — ',
    'edit-image': 'ປັບປ່ຽນຮູບພາບ — ',
    'edit-desc': 'ແກ້ໄຂຄຳບັນຍາຍ — '
  };
  const TAB_HINT = {
    'add-product': 'ໜ້ານີ້ລວມສິນຄ້າທັງໝົດ — ກົດເບິ່ງ/ແກ້ໄຂໄດ້ທຸກຢ່າງ ຫຼື ກົດປຸ່ມຂ້າງເທິງເພື່ອສ້າງສິນຄ້າໃໝ່',
    'add-code': 'ເລືອກສິນຄ້າເພື່ອເຕີມລະຫັດເຂົ້າສະຕັອກ',
    'edit-name-cat': 'ເລືອກສິນຄ້າເພື່ອແກ້ໄຂຊື່ ຫຼື ຫມວດຫມູ່',
    'edit-image': 'ເລືອກສິນຄ້າເພື່ອປ່ຽນຮູບພາບ',
    'edit-desc': 'ເລືອກສິນຄ້າເພື່ອແກ້ໄຂຄຳບັນຍາຍ'
  };

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
    applyTabUI();
    renderAll();
  }

  /* ---------- Rendering ---------- */
  const CAT_LABEL = { pc: 'PC', android: 'Android', ios: 'iOS', gear: 'ອຸປະກອນ' };

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
    // ທຸກແທັບສະແດງສິນຄ້າທັງໝົດ (ບໍ່ມີການແຍກຕາມຫມວດຫມູ່ອີກຕໍ່ໄປ) —
    // ແທັບ "ເພິ່ມສິນຄ້າ" ແລະ ແທັບອື່ນໆ ລ້ວນຕ້ອງໃຊ້ລາຍການສິນຄ້ານີ້ເພື່ອເລືອກສິນຄ້າມາແກ້ໄຂ
    const products = data.products;

    products.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'prow';
      row.dataset.pid = p.id;

      const stock = p.codes.length;
      const readyBadge = p.status === 'ready'
        ? `<span class="prow-badge ready">ພ້ອມຂາຍ</span>`
        : `<span class="prow-badge not-ready">ບໍ່ພ້ອມ</span>`;

      const fallbackLabel = `${CAT_LABEL[p.category] || '?'}<br>#${p.id.split('-').pop()}`;

      row.innerHTML = `
        <div class="prow-id">${p.image ? '' : fallbackLabel}</div>
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

      // ຖ້າມີຮູບພາບ — ໃສ່ <img> ດ້ວຍ DOM ໂດຍກົງ ແລະ ຄືນຄ່າ fallback ຖ້າຮູບໂຫຼດບໍ່ໄດ້
      if (p.image) {
        const idBox = row.querySelector('.prow-id');
        const img = document.createElement('img');
        img.src = p.image;
        img.alt = '';
        img.addEventListener('error', () => { idBox.innerHTML = fallbackLabel; });
        idBox.appendChild(img);
      }

      row.addEventListener('click', () => openProductModal(p.id));
      list.appendChild(row);
    });

    if (!products.length) {
      list.innerHTML = `<div class="empty-note">ຍັງບໍ່ມີສິນຄ້າ — ໃຊ້ແທັບ "ເພິ່ມສິນຄ້າ" ເພື່ອສ້າງສິນຄ້າໃໝ່</div>`;
    }
  }

  /* ---------- Tab switching (ບໍ່ແມ່ນຕົວກອງຫມວດຫມູ່ອີກຕໍ່ໄປ — ແມ່ນການສະຫຼັບ "ໜ້າທີ່") ---------- */
  function applyTabUI() {
    $('#tabHint').textContent = TAB_HINT[currentTab] || '';
    $('#newProdBtn').classList.toggle('hidden', currentTab !== 'add-product');
  }

  function setActiveTab(tab) {
    currentTab = tab;
    $$('.cat-tab[data-tab]').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    applyTabUI();
    renderAll();
  }

  /* ---------- Product modal ---------- */
  function applySectionVisibility(tab) {
    const sections = TAB_SECTIONS[tab] || [];
    $$('.modal-section').forEach((el) => {
      const tokens = (el.dataset.section || '').split(',').map((s) => s.trim()).filter(Boolean);
      const show = tokens.some((t) => sections.includes(t));
      el.classList.toggle('hidden', !show);
    });
  }

  function updateImagePreview(url) {
    const wrap = $('#mImagePreviewWrap');
    const img = $('#mImagePreview');
    if (url) {
      img.src = url;
      wrap.classList.remove('hidden');
    } else {
      img.removeAttribute('src');
      wrap.classList.add('hidden');
    }
  }

  function openProductModal(pid) {
    activeModalPid = pid;
    const data = StoreData.load();
    const p = StoreData.getProduct(data, pid);
    if (!p) return;

    $('#modalTitle').textContent = `${TAB_TITLE[currentTab] || 'ຈັດການສິນຄ້າ — '}${p.name || pid}`;
    $('#mName').value = p.name || '';
    $('#mPrice').value = p.price || '';
    $('#mCategory').value = p.category || 'pc';
    $('#mImage').value = p.image || '';
    updateImagePreview(p.image || '');
    $('#mDescription').value = p.description || '';
    $('#mCodesInput').value = '';
    renderModalCodeLists(p);

    applySectionVisibility(currentTab);

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
    if (p) {
      renderModalCodeLists(p);
      $('#mImage').value = p.image || '';
      updateImagePreview(p.image || '');
    }
    renderAll();
  }

  function closeProductModal() {
    $('#prodModal').classList.add('hidden');
    activeModalPid = null;
  }

  // ບັນທຶກ ຊື່ / ລາຄາ / ຫມວດຫມູ່ — ບັນທຶກສະເພາະຊ່ອງທີ່ແທັບປັດຈຸບັນສະແດງຢູ່ ເພື່ອບໍ່ໃຫ້ຄ່າທີ່ບໍ່ໄດ້ສະແດງ (ເຊັ່ນ ລາຄາໃນແທັບ "ແກ້ໄຂຊື່-ຫມວດຫມູ່") ຖືກຂຽນທັບໂດຍບໍ່ໄດ້ຕັ້ງໃຈ
  function saveProductInfo() {
    if (!activeModalPid) return;
    const sections = TAB_SECTIONS[currentTab] || [];
    const fields = {};
    if (sections.includes('name')) fields.name = $('#mName').value.trim();
    if (sections.includes('price')) fields.price = Number($('#mPrice').value) || 0;
    if (sections.includes('category')) fields.category = $('#mCategory').value;
    StoreData.updateProduct(activeModalPid, fields);
    refreshModalAndList();
    toast('ບັນທຶກແລ້ວ');
  }

  function saveImage() {
    if (!activeModalPid) return;
    const image = $('#mImage').value.trim();
    StoreData.updateProduct(activeModalPid, { image });
    refreshModalAndList();
    toast('ບັນທຶກຮູບພາບແລ້ວ');
  }

  function saveDescription() {
    if (!activeModalPid) return;
    const description = $('#mDescription').value.trim();
    StoreData.updateProduct(activeModalPid, { description });
    refreshModalAndList();
    toast('ບັນທຶກຄຳບັນຍາຍແລ້ວ');
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

  /* ---------- ສ້າງສິນຄ້າໃໝ່ modal (ເປີດຈາກແທັບ "ເພິ່ມສິນຄ້າ") ---------- */
  function openNewProdModal() {
    $('#npName').value = '';
    $('#npPrice').value = '';
    $('#npCategory').value = 'pc';
    $('#newProdModal').classList.remove('hidden');
  }
  function closeNewProdModal() {
    $('#newProdModal').classList.add('hidden');
  }
  function createNewProduct() {
    const name = $('#npName').value.trim();
    const price = Number($('#npPrice').value) || 0;
    const category = $('#npCategory').value;
    if (!name) {
      toast('ກະລຸນາໃສ່ຊື່ສິນຄ້າກ່ອນ');
      return;
    }
    StoreData.addProduct({ name, price, category });
    closeNewProdModal();
    renderAll();
    toast('ສ້າງສິນຄ້າໃໝ່ແລ້ວ');
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

    $$('.cat-tab[data-tab]').forEach((tab) => {
      tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));
    });

    $('#newProdBtn').addEventListener('click', openNewProdModal);
    $('#newProdClose').addEventListener('click', closeNewProdModal);
    $('#newProdModal').addEventListener('click', (e) => { if (e.target.id === 'newProdModal') closeNewProdModal(); });
    $('#npCreate').addEventListener('click', createNewProduct);

    $('#modalClose').addEventListener('click', closeProductModal);
    $('#prodModal').addEventListener('click', (e) => { if (e.target.id === 'prodModal') closeProductModal(); });
    $('#mSaveInfo').addEventListener('click', saveProductInfo);
    $('#mAddCodes').addEventListener('click', addCodesFromTextarea);
    $('#mSaveImage').addEventListener('click', saveImage);
    $('#mImage').addEventListener('input', (e) => updateImagePreview(e.target.value.trim()));
    $('#mSaveDescription').addEventListener('click', saveDescription);

    $('#settingsBtn').addEventListener('click', openSettings);
    $('#settingsClose').addEventListener('click', closeSettings);
    $('#settingsModal').addEventListener('click', (e) => { if (e.target.id === 'settingsModal') closeSettings(); });
    $('#resetBtn').addEventListener('click', resetAllData);
  });
})();
