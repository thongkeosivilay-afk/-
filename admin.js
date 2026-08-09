/* =========================================================
   admin.js — ຫ້ອງແອດມິນ DEK MASH SHOP
   ນຳລະບົບຟັງຊັນ+UI ຈາກເວັບເກົ່າ (beertj-store) ມາໃຊ້ຢູ່ນີ້:
     - ຕໍ່ Supabase ໂປຣເຈັກເດີມ (admin-supabase-config.js) ແບບເຕັມຮູບແບບ
       (ຈັດການສິນຄ້າ, ໄລຍະເວລາ, ລິ້ງໂບນັດ, ເຕີມລະຫັດ, ຄຳຂໍເຕີມເງິນ, ຕັ້ງຄ່າຮ້ານ)
     - ການລ໋ອກອິນ/ກວດສິດແອດມິນ ຍັງໃຊ້ລະບົບ Discord OAuth ຂອງເວັບໃໝ່ (worker/src/index.js)
       ແທນລະບົບ Supabase-Auth ຂອງເວັບເກົ່າ

   ໝາຍເຫດ: ໜ້ານີ້ (ຫ້ອງແອດມິນ) ຕໍ່ Supabase ຈິງແລ້ວ ແຕ່ໜ້າຮ້ານລູກຄ້າ (index.html ອື່ນໆ)
   ຍັງບໍ່ໄດ້ຕໍ່ນຳ (ຍັງໃຊ້ localStorage ເໝືອນເກົ່າ) — ຈະຕໍ່ໃຫ້ໃນຂັ້ນຕໍ່ໄປ
   ========================================================= */

// ============================================
// ພາກ 1: ການລ໋ອກອິນ/ກວດສິດແອດມິນ ດ້ວຍ Discord (ຂອງເວັບໃໝ່)
// ============================================
function goToDiscordLogin() {
  window.location.href = '/auth/discord/login?next=' + encodeURIComponent(location.pathname);
}

function logout() {
  window.location.href = '/auth/logout';
}

async function checkAuthAndInit() {
  let res;
  try {
    res = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' });
  } catch (e) {
    showLoginScreen('ຕິດຕໍ່ເຊີບເວີບໍ່ໄດ້ — ລອງໃໝ່ພາຍຫຼັງ');
    return;
  }
  const data = await res.json();

  if (!data.loggedIn) {
    showLoginScreen();
    return;
  }
  if (!data.user || !data.user.isAdmin) {
    showDeniedScreen();
    return;
  }

  currentAdminUser = data.user;
  showAdminApp();
}

function showLoginScreen(errorMsg) {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('deniedScreen').style.display = 'none';
  document.getElementById('gate').style.display = 'none';
  document.getElementById('adminApp').style.display = 'none';
  const err = document.getElementById('loginError');
  if (err) err.textContent = errorMsg || '';
}

function showDeniedScreen() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('deniedScreen').style.display = 'flex';
  document.getElementById('gate').style.display = 'none';
  document.getElementById('adminApp').style.display = 'none';
}

async function showAdminApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('deniedScreen').style.display = 'none';
  document.getElementById('gate').style.display = 'none';
  document.getElementById('adminApp').style.display = 'block';
  await initAdminPanel();
}

// ============================================
// ພາກ 2: ຟັງຊັນຫ້ອງແອດມິນ (ພອດມາຈາກເວັບເກົ່າ — ຕໍ່ Supabase ໂປຣເຈັກເດີມ)
// ============================================
// ============================================
// ໜ້າຄວບຄຸມແອດມິນ — ເພີ່ມ/ແກ້ໄຂສິນຄ້າ, ເຕີມລະຫັດ ແລະ ຄຳຂໍເຕີມເງິນ
// ============================================

let currentProducts = [];
let currentAdminUser = null;
let selectedImageFile = null;
let currentSiteSettings = {};
let selectedLogoFile = null;
let selectedQrFile = null;
let selectedQrFile2 = null;

// ຕົວເລືອກໄລຍະເວລາທີ່ໃຫ້ເລືອກຕອນສ້າງສິນຄ້າ
const DURATION_OPTIONS = ['12ຊມ', '1ວັນ', '2ວັນ', '3ວັນ', '4ວັນ', '5ວັນ', '6ວັນ', '7ວັນ', '10ວັນ', '20ວັນ', '30ວັນ'];

function setMsg(el, text, kind) {
  el.classList.remove('show', 'error', 'success', 'pending');
  if (!text) return;
  el.textContent = text;
  el.classList.add('show', kind);
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}

function formatKipAdmin(n) {
  return Number(n || 0).toLocaleString('en-US') + ' ກີບ';
}
// ---------- ແຖບສະຖານະລວມ (ops strip) ----------
function renderOpsStrip(products, totalStock) {
  const strip = document.getElementById('opsStrip');
  strip.innerHTML = `
    <div class="ops-chip"><div class="ops-num">${products.length}</div><div class="ops-label">ສິນຄ້າທັງໝົດ</div></div>
    <div class="ops-chip"><div class="ops-num">${totalStock}</div><div class="ops-label">ລະຫັດຄົງເຫຼືອ</div></div>
  `;
  // ຄືນຄ່າ chip ຈຳນວນຄຳຂໍເຕີມເງິນ (ຖ້າມີ) ຫຼັງຈາກ render ໃໝ່
  if (typeof window.__pendingTopupCount === 'number') {
    appendTopupOpsChip(window.__pendingTopupCount);
  }
}

function appendTopupOpsChip(count) {
  window.__pendingTopupCount = count;
  const strip = document.getElementById('opsStrip');
  if (!strip) return;
  const old = strip.querySelector('.ops-chip.topup-chip');
  if (old) old.remove();
  const chip = document.createElement('div');
  chip.className = 'ops-chip topup-chip';
  chip.innerHTML = `<div class="ops-num">${count}</div><div class="ops-label">ຄຳຂໍລໍຖ້າ</div>`;
  strip.appendChild(chip);

  const badge = document.getElementById('topupBadge');
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
}

// ---------- ດຶງລາຍການສິນຄ້າ + ສະຕັອກຂອງແຕ່ລະລາຍການ ----------
async function loadProducts() {
  const { data: products, error } = await supabaseClient
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  const { data: allDurations, error: durError } = await supabaseClient
    .from('product_durations')
    .select('*')
    .order('sort_order', { ascending: true });

  if (durError) console.error(durError);

  const { data: allLinks, error: linksError } = await supabaseClient
    .from('product_links')
    .select('*')
    .order('sort_order', { ascending: true });

  if (linksError) console.error(linksError);

  const withStock = await Promise.all((products || []).map(async (p) => {
    const { data: stock } = await supabaseClient.rpc('product_stock', { p_product_id: p.id });
    const ownDurations = (allDurations || []).filter(d => d.product_id === p.id);
    const durationsWithStock = await Promise.all(ownDurations.map(async (d) => {
      const { data: dStock } = await supabaseClient.rpc('product_duration_stock', { p_duration_id: d.id });
      return { ...d, stock: dStock ?? 0 };
    }));
    const ownLinks = (allLinks || []).filter(l => l.product_id === p.id);
    return { ...p, stock: stock ?? 0, durations: durationsWithStock, links: ownLinks };
  }));

  currentProducts = withStock;
  const totalStock = withStock.reduce((sum, p) => sum + (p.stock || 0), 0);
  renderOpsStrip(withStock, totalStock);
  renderManageList(withStock);
  renderCodeProductSelect(withStock);
  renderCategoryOptions(withStock);
  renderAgentPriceList(withStock);
  return withStock;
}

// ---------- ປຸ່ມ "ຢືນຢັນ" ຢູ່ຄູ່ກັບແຕ່ລະຊ່ອງຊື່ໝວດໝູ່ (ບໍ່ຕ້ອງເລື່ອນລົງໄປກົດປຸ່ມລວມທາງລຸ່ມ) ----------
// ບັນທຶກສະເພາະໝວດໝູ່ນັ້ນອັນດຽວ, ພ້ອມອັບເດດສິນຄ້າທີ່ໃຊ້ຊື່ເກົ່າຢູ່ໃຫ້ຕາມຊື່ໃໝ່ນຳ (ຄືກັນກັບປຸ່ມລວມ)
async function saveSingleCategoryName(i) {
  const input = document.getElementById(`catName${i}`);
  const btn = document.getElementById(`catNameConfirm${i}`);
  const msg = document.getElementById(`catNameMsg${i}`);
  if (!input || !btn) return;

  const val = input.value.trim();
  const newName = val || `ໝວດໝູ່ ${i}`;
  const oldName = (
    currentSiteSettings && currentSiteSettings[`category_${i}_name`]
      ? String(currentSiteSettings[`category_${i}_name`])
      : `ໝວດໝູ່ ${i}`
  ).trim();

  if (oldName === newName) {
    setMsg(msg, 'ຍັງບໍ່ໄດ້ແກ້ໄຂຫຍັງ', 'pending');
    return;
  }

  setLoading(btn, true);
  setMsg(msg, 'ກຳລັງບັນທຶກ...', 'pending');
  try {
    if (oldName) {
      const { error: renameError } = await supabaseClient
        .from('products')
        .update({ category: newName })
        .eq('category', oldName);
      if (renameError) throw renameError;
      await loadProducts();
    }

    await ensureSiteSettingsRow();
    const { error: settingsError } = await supabaseClient
      .from(SITE_SETTINGS_TABLE)
      .update({ [`category_${i}_name`]: newName, updated_at: new Date().toISOString() })
      .eq('id', SITE_SETTINGS_ID);
    if (settingsError) throw settingsError;

    setMsg(msg, 'ບັນທຶກຊື່ຫມວດໝູ່ນີ້ສຳເລັດແລ້ວ ✓ — ໜ້າຮ້ານຈິງຈະອັບເດດອັດຕະໂນມັດ', 'success');
    await loadSiteSettingsAdmin();
  } catch (err) {
    console.error(err);
    setMsg(msg, 'ເກີດຂໍ້ຜິດພາດ: ' + (err.message || 'ລອງໃໝ່ອີກຄັ້ງ'), 'error');
  } finally {
    setLoading(btn, false);
  }
}

function initCategoryNameConfirmButtons() {
  for (let i = 1; i <= 4; i++) {
    const btn = document.getElementById(`catNameConfirm${i}`);
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => saveSingleCategoryName(i));
    }
    const input = document.getElementById(`catName${i}`);
    if (input && !input.dataset.bound) {
      input.dataset.bound = '1';
      // ກົດ Enter ໃນຊ່ອງຊື່ = ຢືນຢັນທັນທີ (ບໍ່ຕ້ອງກົດເມົາໃສ່ປຸ່ມ)
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveSingleCategoryName(i); }
      });
    }
  }
}

// ---------- ຫົວຂໍ້ໃຫຍ່ (bigTitle) ແລະ ຄຳອະທິບາຍ (desc) ເທິງແບນເນີໝວດໝູ່ — ບັນທຶກລົງ site_settings ----------
// ໃຊ້ pattern ດຽວກັນກັບ saveSingleCategoryName ຂ້າງເທິງ (ຄອລັມ category_{i}_title / category_{i}_desc
// ຕ້ອງມີຢູ່ໃນຕາຕະລາງ site_settings ຂອງ Supabase ກ່ອນ — ຖ້າຄອລັມຍັງບໍ່ມີ ການບັນທຶກຈະ error)
async function saveSingleCategoryField(i, field, inputId, btnId, msgId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  const msg = document.getElementById(msgId);
  if (!input || !btn) return;

  const newVal = input.value.trim();
  setLoading(btn, true);
  setMsg(msg, 'ກຳລັງບັນທຶກ...', 'pending');
  try {
    await ensureSiteSettingsRow();
    const { error } = await supabaseClient
      .from(SITE_SETTINGS_TABLE)
      .update({ [`category_${i}_${field}`]: newVal, updated_at: new Date().toISOString() })
      .eq('id', SITE_SETTINGS_ID);
    if (error) throw error;
    setMsg(msg, 'ບັນທຶກສຳເລັດແລ້ວ ✓ — ໜ້າຮ້ານຈິງຈະອັບເດດອັດຕະໂນມັດ', 'success');
    await loadSiteSettingsAdmin();
  } catch (err) {
    console.error(err);
    setMsg(msg, 'ເກີດຂໍ້ຜິດພາດ: ' + (err.message || 'ລອງໃໝ່ອີກຄັ້ງ'), 'error');
  } finally {
    setLoading(btn, false);
  }
}

function initCategoryTitleDescConfirmButtons() {
  for (let i = 1; i <= 4; i++) {
    const titleBtn = document.getElementById(`catTitleConfirm${i}`);
    if (titleBtn && !titleBtn.dataset.bound) {
      titleBtn.dataset.bound = '1';
      titleBtn.addEventListener('click', () => saveSingleCategoryField(i, 'title', `catTitle${i}`, `catTitleConfirm${i}`, `catTitleMsg${i}`));
    }
    const titleInput = document.getElementById(`catTitle${i}`);
    if (titleInput && !titleInput.dataset.bound) {
      titleInput.dataset.bound = '1';
      titleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveSingleCategoryField(i, 'title', `catTitle${i}`, `catTitleConfirm${i}`, `catTitleMsg${i}`); }
      });
    }

    const descBtn = document.getElementById(`catDescConfirm${i}`);
    if (descBtn && !descBtn.dataset.bound) {
      descBtn.dataset.bound = '1';
      descBtn.addEventListener('click', () => saveSingleCategoryField(i, 'desc', `catDesc${i}`, `catDescConfirm${i}`, `catDescMsg${i}`));
    }
    const descInput = document.getElementById(`catDesc${i}`);
    if (descInput && !descInput.dataset.bound) {
      descInput.dataset.bound = '1';
      descInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveSingleCategoryField(i, 'desc', `catDesc${i}`, `catDescConfirm${i}`, `catDescMsg${i}`); }
      });
    }
  }
}


// ໃຊ້ຊື່ຈິງທີ່ແອດມິນຕັ້ງໄວ້ໃນ "ຕັ້ງຄ່າຮ້ານ > ໝວດໝູ່ 1-10" (category_1_name ... category_10_name)
// ເພື່ອໃຫ້ໝວດໝູ່ທີ່ເລືອກຕອນເພີ່ມສິນຄ້າ ກົງກັນກັບ card ໝວດໝູ່ທີ່ໂຊວ໌ຢູ່ໜ້າຮ້ານ/ໜ້າໝວດໝູ່ທັງໝົດ ແບບ 100%
function getCurrentCategoryNames() {
  const names = [];
  for (let i = 1; i <= 4; i++) {
    const raw = currentSiteSettings && currentSiteSettings[`category_${i}_name`];
    const trimmed = raw ? String(raw).trim() : '';
    // ສຳຄັນ: ຕ້ອງໃຊ້ fallback ທຸກຄັ້ງທີ່ຊື່ຫວ່າງ/ມີແຕ່ຊ່ອງວ່າງ ບໍ່ດັ່ງນັ້ນໝວດໝູ່ນັ້ນຈະ
    // "ຫາຍໄປ" ຈາກລາຍການເລືອກຕອນເພີ່ມສິນຄ້າແບບງຽບໆ (ບັນຫາທີ່ເຄີຍພົບ)
    const name = trimmed || `ໝວດໝູ່ ${i}`;
    names.push(name);
  }
  return names;
}

function renderCategoryOptions(products) {
  const select = document.getElementById('pCategorySelect');
  if (!select) return;

  const fromProducts = products.map(p => (p.category || '').trim()).filter(Boolean);
  const categories = [...new Set([...getCurrentCategoryNames(), ...fromProducts])]
    .sort((a, b) => a.localeCompare(b, 'th'));

  const prevValue = select.value;
  select.innerHTML =
    '<option value="">ເລືອກໝວດໝູ່</option>' +
    categories.map(c => `<option value="${c.replace(/"/g, '&quot;')}">${c}</option>`).join('');

  if (prevValue && categories.includes(prevValue)) {
    select.value = prevValue;
  }
}

// ---------- ແຜງຈັດການສິນຄ້າ (ແກ້ຊື່/ລາຄາ/ລຶບ) ----------
function renderManageList(products) {
  const list = document.getElementById('manageList');
  if (!products.length) {
    list.innerHTML = '<div class="empty-note">ຍັງບໍ່ມີສິນຄ້າ — ເພີ່ມສິນຄ້າກ່ອນທີ່ແຖບ "ເພີ່ມສິນຄ້າ"</div>';
    return;
  }

  list.innerHTML = products.map(p => `
    <div class="prod-row ${p.archived ? 'is-archived' : ''} ${p.paused ? 'is-paused' : ''}" data-id="${p.id}">
      <img class="prod-thumb" src="${p.image_url || ''}" onerror="this.style.opacity=0" alt="">
      <div class="prod-fields">
        ${p.archived ? '<div class="archived-tag">ເຊື່ອງໄວ້ — ບໍ່ສະແດງໃນໜ້າຮ້ານ</div>' : ''}
        ${p.paused ? `<div class="paused-tag">ຢຸດຂາຍຊົ່ວຄາວ${p.paused_note ? ' — ' + p.paused_note.replace(/</g, '&lt;') : ''}</div>` : ''}
        <div class="gx-row2">
          <input type="text" class="edit-name" value="${(p.name || '').replace(/"/g, '&quot;')}" placeholder="ຊື່ສິນຄ້າ">
          <input type="number" class="edit-price" value="${p.price || 0}" min="0" step="0.01" placeholder="ລາຄາ">
        </div>
        <label class="pause-toggle-label">
          <input type="checkbox" class="edit-paused" ${p.paused ? 'checked' : ''}>
          ຢຸດຂາຍຊົ່ວຄາວ (ລູກຄ້າຈະສັ່ງຊື້ບໍ່ໄດ້ ຈົນກວ່າຈະເປີດຄືນ)
        </label>
        <div class="gx-input-wrap pause-note-wrap" style="display:${p.paused ? 'block' : 'none'};margin-bottom:4px;">
          <input type="text" class="edit-paused-note" value="${(p.paused_note || '').replace(/"/g, '&quot;')}" placeholder="ລາຍລະອຽດ ເຊັ່ນ: ສະຕັອກໝົດ ຈະເປີດຂາຍຄືນ 20:00">
        </div>
        <div class="prod-meta-row">
          <span class="prod-stock">${p.duration_enabled ? 'ມີໄລຍະເວລາ' : `ຄົງເຫຼືອ ${p.stock} ລະຫັດ`}</span>
          <div class="prod-actions">
            <button class="icon-btn save-btn" title="ບັນທຶກ">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            </button>
            <button class="icon-btn del-btn" title="${p.archived ? 'ນຳກັບມາສະແດງ' : 'ເອົາອອກຈາກໜ້າຮ້ານ'}">
              ${p.archived ? `
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              ` : `
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              `}
            </button>
            <button class="icon-btn hard-del-btn" title="ລຶບຖາວອນ (ລຶບຖິ້ມ ບໍ່ສາມາດກູ້ຄືນໄດ້)">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </div>
        ${p.duration_enabled && p.durations && p.durations.length ? `
        <div class="prod-duration-list">
          ${p.durations.map(d => `<span class="prod-duration-chip">${d.label} • ${formatKipAdmin(d.price)} • ຄົງເຫຼືອ ${d.stock}</span>`).join('')}
        </div>` : ''}
        <div class="prod-links-section">
          <div class="prod-links-list">
            ${(p.links || []).map(l => `
              <span class="prod-link-chip" data-link-id="${l.id}">
                ${l.label.replace(/</g, '&lt;')}
                <button type="button" class="link-chip-remove" title="ລຶບລິ້ງ">×</button>
              </span>
            `).join('')}
          </div>
          <div class="link-add-inline">
            <input type="text" class="link-add-label" placeholder="ຊື່ລິ້ງໂບນັດໃໝ່">
            <input type="url" class="link-add-url" placeholder="ລິ້ງ URL">
            <button type="button" class="link-add-btn" title="ເພີ່ມລິ້ງ">+</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.prod-row').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('.save-btn').addEventListener('click', () => saveProduct(id, row));
    row.querySelector('.del-btn').addEventListener('click', () => toggleArchiveProduct(id, row));
    row.querySelector('.hard-del-btn').addEventListener('click', () => hardDeleteProduct(id, row));

    const pauseCb = row.querySelector('.edit-paused');
    const pauseNoteWrap = row.querySelector('.pause-note-wrap');
    pauseCb.addEventListener('change', () => {
      pauseNoteWrap.style.display = pauseCb.checked ? 'block' : 'none';
    });

    row.querySelector('.link-add-btn').addEventListener('click', () => addProductLink(id, row));
    row.querySelectorAll('.link-chip-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const chip = btn.closest('.prod-link-chip');
        removeProductLink(chip.dataset.linkId, chip, id);
      });
    });
  });
}

// ---------- ລິ້ງໂບນັດ — ເພີ່ມ/ລຶບໃນສິນຄ້າທີ່ມີຢູ່ແລ້ວ ----------
async function addProductLink(productId, row) {
  const labelInput = row.querySelector('.link-add-label');
  const urlInput = row.querySelector('.link-add-url');
  const label = labelInput.value.trim();
  const url = urlInput.value.trim();
  if (!label || !url) {
    showToast('ກະລຸນາໃສ່ຊື່ ແລະ URL ຂອງລິ້ງໃຫ້ຄົບ');
    return;
  }

  const p = currentProducts.find(x => x.id === productId);
  const sortOrder = p && p.links ? p.links.length : 0;

  const { error } = await supabaseClient
    .from('product_links')
    .insert({ product_id: productId, label, url, sort_order: sortOrder });

  if (error) {
    console.error(error);
    showToast('ເພີ່ມລິ້ງບໍ່ສຳເລັດ: ' + error.message);
    return;
  }

  showToast('ເພີ່ມລິ້ງສຳເລັດ');
  loadProducts();
}

async function removeProductLink(linkId, chipEl, productId) {
  if (!confirm('ລຶບລິ້ງນີ້?')) return;

  const { error } = await supabaseClient.from('product_links').delete().eq('id', linkId);
  if (error) {
    console.error(error);
    showToast('ລຶບບໍ່ສຳເລັດ: ' + error.message);
    return;
  }

  showToast('ລຶບລິ້ງແລ້ວ');
  chipEl.remove();
  const p = currentProducts.find(x => x.id === productId);
  if (p && p.links) p.links = p.links.filter(l => l.id !== linkId);
}

async function saveProduct(id, row) {
  const btn = row.querySelector('.save-btn');
  const name = row.querySelector('.edit-name').value.trim();
  const price = parseFloat(row.querySelector('.edit-price').value) || 0;
  const paused = row.querySelector('.edit-paused').checked;
  const pausedNote = row.querySelector('.edit-paused-note').value.trim();
  if (!name) return;

  btn.style.color = 'var(--ink-500)';
  const { error } = await supabaseClient
    .from('products')
    .update({ name, price, paused, paused_note: paused ? (pausedNote || null) : null })
    .eq('id', id);
  if (error) {
    console.error(error);
    showToast('ບັນທຶກບໍ່ສຳເລັດ: ' + error.message);
    return;
  }
  showToast('ບັນທຶກສຳເລັດ');
  const p = currentProducts.find(x => x.id === id);
  if (p) { p.name = name; p.price = price; p.paused = paused; p.paused_note = paused ? pausedNote : null; }
  loadProducts();
}

// ສິນຄ້າທີ່ເຄີຍຖືກສັ່ງຊື້ໄປແລ້ວ ຈະລຶບຖາວອນອອກຈາກຕາຕະລາງບໍ່ໄດ້
// (ຈະຊົນກັບ foreign key ຂອງຕາຕະລາງ orders) — ຈຶ່ງໃຊ້ "ເຊື່ອງ/ນຳກັບມາ" ແທນການລຶບຖາວອນ
// ເພື່ອຮັກສາປະຫວັດການສັ່ງຊື້ຂອງລູກຄ້າໄວ້ຄົບຖ້ວນ
async function toggleArchiveProduct(id, row) {
  const p = currentProducts.find(x => x.id === id);
  if (!p) return;

  const nextArchived = !p.archived;
  const confirmMsg = nextArchived
    ? 'ເອົາສິນຄ້ານີ້ອອກຈາກໜ້າຮ້ານ? (ຍັງບໍ່ລຶບຖາວອນ, ປະຫວັດການສັ່ງຊື້ເກົ່າຍັງຄົງຢູ່ ແລະ ສາມາດນຳກັບມາໄດ້ພາຍຫຼັງ)'
    : 'ນຳສິນຄ້ານີ້ກັບມາສະແດງໃນໜ້າຮ້ານ?';
  if (!confirm(confirmMsg)) return;

  const { error } = await supabaseClient
    .from('products')
    .update({ archived: nextArchived })
    .eq('id', id);

  if (error) {
    console.error(error);
    showToast('ດຳເນີນການບໍ່ສຳເລັດ: ' + error.message);
    return;
  }

  showToast(nextArchived ? 'ເອົາອອກຈາກໜ້າຮ້ານແລ້ວ' : 'ນຳກັບມາສະແດງແລ້ວ');
  loadProducts();
}

// ---------- ລຶບສິນຄ້າຖາວອນ (ລຶບຖິ້ມ ບໍ່ໄດ້ພຽງແຕ່ເຊື່ອງ — ບໍ່ສາມາດກູ້ຄືນໄດ້) ----------
async function hardDeleteProduct(id, row) {
  const p = currentProducts.find(x => x.id === id);
  if (!p) return;

  const ok = confirm(
    `ລຶບ "${p.name || 'ສິນຄ້ານີ້'}" ຖາວອນ?\n\nຈະລຶບຂໍ້ມູນສິນຄ້າ, ໄລຍະເວລາ, ລິ້ງໂບນັດ ແລະ ລະຫັດຄົງເຫຼືອທັງໝົດຂອງສິນຄ້ານີ້ອອກຈາກລະບົບ. ບໍ່ສາມາດກູ້ຄືນໄດ້.\n\n⚠️ ຖ້າສິນຄ້ານີ້ເຄີຍມີຄົນສັ່ງຊື້ໄປແລ້ວ, ອໍເດີເກົ່າຂອງສິນຄ້ານີ້ (ໃນ "ລາຍການສັ່ງຊື້"/ປະຫວັດ) ຈະຖືກລຶບໄປພ້ອມກັນນຳ ເນື່ອງຈາກລະບົບຕ້ອງການໃຫ້ທຸກອໍເດີມີສິນຄ້າອ້າງອີງຢູ່ສະເໝີ.\n\n(ຖ້າຢາກລຶບສິນຄ້າອອກຈາກໜ້າຮ້ານ ແຕ່ຍັງເກັບປະຫວັດອໍເດີໄວ້ຄົບ ໃຫ້ໃຊ້ປຸ່ມ "ເອົາອອກຈາກໜ້າຮ້ານ" ແທນ)`
  );
  if (!ok) return;

  if (row) {
    row.style.opacity = '0.5';
    row.style.pointerEvents = 'none';
  }

  try {
    // ລຶບແບບ atomic ດ້ວຍ function ຝັ່ງຖານຂໍ້ມູນ (ຂ້າມບັນຫາ RLS/foreign key ທັງໝົດ)
    // ຕ້ອງແລ່ນ supabase_migration_admin_delete_product.sql ໃນ Supabase ກ່ອນ ຈຶ່ງຈະໃຊ້ໄດ້
    const { error } = await supabaseClient.rpc('admin_delete_product', { p_product_id: id });
    if (error) throw error;

    showToast('ລຶບສິນຄ້າຖາວອນແລ້ວ');
    loadProducts();
  } catch (err) {
    console.error(err);
    const notSetUp = /function .* does not exist|schema cache/i.test(err.message || '');
    showToast(
      notSetUp
        ? 'ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ: ກະລຸນາແລ່ນ supabase_migration_admin_delete_product.sql ໃນ Supabase SQL Editor ກ່ອນ'
        : 'ລຶບບໍ່ສຳເລັດ: ' + (err.message || 'ລອງໃໝ່ອີກຄັ້ງ')
    );
    if (row) {
      row.style.opacity = '';
      row.style.pointerEvents = '';
    }
  }
}

// ---------- toast ນ້ອຍໆ ----------
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ---------- ແຜງເພີ່ມລະຫັດ ----------
function renderCodeProductSelect(products) {
  const select = document.getElementById('codeProductSelect');
  const prevValue = select.value;
  const activeProducts = products.filter(p => !p.archived);
  select.innerHTML = activeProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  if (prevValue && activeProducts.some(p => p.id === prevValue)) select.value = prevValue;
  renderCodeStockStrip();
}

function renderCodeStockStrip() {
  const select = document.getElementById('codeProductSelect');
  const strip = document.getElementById('codeStockStrip');
  const durationWrap = document.getElementById('codeDurationWrap');
  const durationSelect = document.getElementById('codeDurationSelect');
  const p = currentProducts.find(x => x.id === select.value);
  if (!p) { strip.innerHTML = ''; durationWrap.style.display = 'none'; return; }

  if (p.duration_enabled) {
    durationWrap.style.display = 'block';
    const prevDur = durationSelect.value;
    durationSelect.innerHTML = (p.durations || [])
      .map(d => `<option value="${d.id}">${d.label} • ${formatKipAdmin(d.price)} • ຄົງເຫຼືອ ${d.stock}</option>`)
      .join('') || '<option value="">ຍັງບໍ່ມີຕົວເລືອກໄລຍະເວລາ — ໄປສ້າງທີ່ແຖບ "ເພີ່ມສິນຄ້າ" ກ່ອນ</option>';
    if (prevDur && (p.durations || []).some(d => d.id === prevDur)) durationSelect.value = prevDur;

    const chosen = (p.durations || []).find(d => d.id === durationSelect.value);
    strip.innerHTML = chosen ? `
      <div class="ops-chip"><div class="ops-num">${chosen.stock}</div><div class="ops-label">ລະຫັດຄົງເຫຼືອ (${chosen.label})</div></div>
      <div class="ops-chip"><div class="ops-num">${formatKipAdmin(chosen.price)}</div><div class="ops-label">ລາຄາ</div></div>
    ` : '';
  } else {
    durationWrap.style.display = 'none';
    strip.innerHTML = `
      <div class="ops-chip"><div class="ops-num">${p.stock}</div><div class="ops-label">ລະຫັດຄົງເຫຼືອ</div></div>
      <div class="ops-chip"><div class="ops-num">${formatKipAdmin(p.price)}</div><div class="ops-label">ລາຄາ</div></div>
    `;
  }
}

// ---------- ແຜງຄຳຂໍເຕີມເງິນ ----------
let currentTopupRequests = [];

async function loadTopupRequests() {
  const refreshBtn = document.getElementById('topupRefreshBtn');
  if (refreshBtn) refreshBtn.classList.add('spinning');

  const { data, error } = await supabaseClient
    .from('topup_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (refreshBtn) setTimeout(() => refreshBtn.classList.remove('spinning'), 400);

  if (error) {
    console.error(error);
    document.getElementById('topupList').innerHTML = '<div class="empty-note">ໂຫຼດຂໍ້ມູນຜິດພາດ</div>';
    return;
  }

  currentTopupRequests = data || [];
  appendTopupOpsChip(currentTopupRequests.length);
  renderTopupList(currentTopupRequests);
}

function renderTopupList(requests) {
  const list = document.getElementById('topupList');
  if (!requests.length) {
    list.innerHTML = '<div class="empty-note">ບໍ່ມີຄຳຂໍເຕີມເງິນທີ່ລໍຖ້າກວດສອບ</div>';
    return;
  }

  list.innerHTML = requests.map(r => `
    <div class="topup-card" data-id="${r.id}">
      <div class="topup-head">
        <div>
          <div class="topup-amount">${formatKipAdmin(r.amount)}</div>
          <div class="topup-meta">
            ${r.user_email ? r.user_email : (r.email || 'ບໍ່ມີອີເມວ')}<br>
            <span class="ref">${new Date(r.created_at).toLocaleString('lo-LA')}</span>
          </div>
        </div>
        <span class="topup-status-tag pending">ລໍຖ້າກວດສອບ</span>
      </div>
      ${r.slip_url ? `
        <div class="topup-slip-wrap">
          <img src="${r.slip_url}" alt="ສະລິບໂອນເງິນ" loading="lazy">
          <div class="zoom-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            ຂະຫຍາຍ
          </div>
        </div>` : ''}
      <div class="ai-verify-box" id="aiBox-${r.id}"></div>
      <div class="topup-actions-row">
        <button class="topup-btn ai-verify">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z"/></svg>
          ກວດສອບດ້ວຍ AI
        </button>
        <button class="topup-btn approve">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ຢືນຢັນ
        </button>
        <button class="topup-btn reject">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ປະຕິເສດ
        </button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.topup-slip-wrap img').forEach(img => {
    img.addEventListener('click', () => openSlipLightbox(img.src));
  });

  list.querySelectorAll('.topup-card').forEach(card => {
    const id = card.dataset.id;
    card.querySelector('.approve').addEventListener('click', () => decideTopup(id, 'approved', card));
    card.querySelector('.reject').addEventListener('click', () => decideTopup(id, 'rejected', card));
    const aiBtn = card.querySelector('.ai-verify');
    if (aiBtn) aiBtn.addEventListener('click', () => runAiVerifyTopup(id, card, aiBtn));
  });
}

async function runAiVerifyTopup(id, card, btn) {
  const box = document.getElementById(`aiBox-${id}`);
  const req = currentTopupRequests.find(r => r.id === id);
  const imageUrl = req ? req.slip_url : '';
  const amount = req ? req.amount : '';

  if (!imageUrl) {
    showToast('ບໍ່ພົບຮູບສະລິບ');
    return;
  }

  btn.disabled = true;
  const originalHtml = btn.innerHTML;
  btn.textContent = 'ກຳລັງກວດສອບ...';
  box.innerHTML = '';

  try {
    const res = await fetch('/api/verify-slip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, expectedAmount: amount })
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      box.innerHTML = `<div class="ai-result ai-warn">⚠️ ${data.error || 'ກວດສອບບໍ່ສຳເລັດ'}</div>`;
      return;
    }

    const okMatch = data.matches_expected && !data.suspicious && data.is_slip;
    const cls = okMatch ? 'ai-ok' : 'ai-warn';
    box.innerHTML = `
      <div class="ai-result ${cls}">
        <div>${data.is_slip ? '✅ ຄືສະລິບ' : '❓ ບໍ່ແນ່ໃຈວ່າແມ່ນສະລິບ'}</div>
        <div>ຍອດທີ່ AI ອ່ານໄດ້: ${data.amount != null ? formatKipAdmin(data.amount) : '—'} (${data.matches_expected ? 'ກົງກັບຍອດ' : 'ບໍ່ກົງກັບຍອດ'})</div>
        ${data.suspicious ? '<div>⚠️ ມີສັນຍານຜິດປົກກະຕິ ກະລຸນາກວດຄືນດ້ວຍຕາ</div>' : ''}
        ${data.note ? `<div class="ai-note">${data.note}</div>` : ''}
      </div>`;
  } catch (err) {
    console.error(err);
    box.innerHTML = `<div class="ai-result ai-warn">⚠️ ເຊື່ອມຕໍ່ AI ບໍ່ໄດ້</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function decideTopup(id, status, card) {
  const btns = card.querySelectorAll('.topup-btn');
  btns.forEach(b => b.disabled = true);

  const { error } = await supabaseClient
    .from('topup_requests')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error(error);
    showToast('ດຳເນີນການບໍ່ສຳເລັດ: ' + error.message);
    btns.forEach(b => b.disabled = false);
    return;
  }

  let toastMsg = status === 'approved' ? 'ຢືນຢັນການເຕີມເງິນສຳເລັດແລ້ວ' : 'ປະຕິເສດຄຳຂໍແລ້ວ';

  if (status === 'approved') {
    const req = currentTopupRequests.find(r => r.id === id);
    if (req && req.user_id) {
      const { error: walletError } = await supabaseClient.rpc('increment_wallet_balance', {
        p_user_id: req.user_id,
        p_amount: req.amount
      });
      if (walletError) {
        console.error(walletError);
        toastMsg = 'ຢືນຢັນແລ້ວ ແຕ່ເຕີມຍອດເງິນເຂົ້າກະເປົາບໍ່ສຳເລັດ: ' + walletError.message;
      } else {
        toastMsg = 'ຢືນຢັນ ແລະ ເຕີມຍອດເງິນເຂົ້າກະເປົາລູກຄ້າສຳເລັດແລ້ວ';
      }
    }
  }

  showToast(toastMsg);
  card.style.transition = 'opacity .2s ease, transform .2s ease';
  card.style.opacity = '0';
  card.style.transform = 'scale(0.96)';
  setTimeout(() => {
    card.remove();
    loadTopupRequests();
  }, 200);
}

// ---------- ແຜງລະບົບຕົວແທນ (reseller) ----------
const RESELLER_TIER_LABELS = { '7d': '7 ມື້', '14d': '14 ມື້', '30d': '30 ມື້', 'lifetime': 'ຖາວອນ' };
const RESELLER_TIER_ORDER = ['7d', '14d', '30d', 'lifetime'];

let currentResellerTiers = [];
let currentResellerKeys = [];

function tierLabel(durationType) {
  return RESELLER_TIER_LABELS[durationType] || durationType;
}

async function loadResellerTiers() {
  const { data, error } = await supabaseClient
    .from('reseller_tiers')
    .select('*');

  if (error) {
    console.error(error);
    document.getElementById('agentTierList').innerHTML = '<div class="empty-note">ໂຫຼດຂໍ້ມູນຜິດພາດ</div>';
    return;
  }

  currentResellerTiers = (data || []).sort(
    (a, b) => RESELLER_TIER_ORDER.indexOf(a.duration_type) - RESELLER_TIER_ORDER.indexOf(b.duration_type)
  );
  renderResellerTiers(currentResellerTiers);
  populateAgentKeyTierSelect(currentResellerTiers);
}

function renderResellerTiers(tiers) {
  const list = document.getElementById('agentTierList');
  if (!tiers.length) {
    list.innerHTML = '<div class="empty-note">ຍັງບໍ່ມີລະດັບຕົວແທນ — ກະລຸນາຮັນ SQL schema (reseller-system-v2) ກ່ອນ</div>';
    return;
  }

  list.innerHTML = tiers.map(t => {
    const isLifetime = t.period_days === null;
    return `
    <div class="tier-card" data-duration-type="${t.duration_type}">
      <div class="tier-card-head">
        <span class="tier-card-title">${tierLabel(t.duration_type)}</span>
        <button class="icon-btn save-btn" title="ບັນທຶກ">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        </button>
      </div>
      <div class="tier-card-fields single">
        ${!isLifetime ? `
        <div>
          <label>ໂຄວຕ້າຍອດຊື້ (ກີບ) — ຕ້ອງເຮັດໃຫ້ຄົບພາຍໃນໄລຍະ ບໍ່ຄັ້ນຈະຖືກປົດ</label>
          <input type="number" class="edit-quota" value="${t.quota_amount ?? 0}" min="0" step="1">
        </div>` : `
        <div class="tier-card-lifetime-note">ຖາວອນ — ບໍ່ມີເງື່ອນໄຂໂຄວຕ້າ ໃຊ້ໄດ້ຕະຫຼອດໄປ</div>`}
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.tier-card').forEach(card => {
    card.querySelector('.save-btn').addEventListener('click', () => saveResellerTier(card));
  });
}

async function saveResellerTier(card) {
  const durationType = card.dataset.durationType;
  const btn = card.querySelector('.save-btn');
  const quotaInput = card.querySelector('.edit-quota');

  const updates = { updated_at: new Date().toISOString() };
  if (quotaInput) updates.quota_amount = Number(quotaInput.value) || 0;

  btn.disabled = true;
  const { error } = await supabaseClient
    .from('reseller_tiers')
    .update(updates)
    .eq('duration_type', durationType);
  btn.disabled = false;

  if (error) {
    console.error(error);
    showToast('ບັນທຶກບໍ່ສຳເລັດ: ' + error.message);
    return;
  }
  showToast(`ບັນທຶກລະດັບ ${tierLabel(durationType)} ສຳເລັດແລ້ວ`);
  loadResellerTiers();
}

function populateAgentKeyTierSelect(tiers) {
  const select = document.getElementById('agentKeyTierSelect');
  if (!select) return;
  const prevValue = select.value;
  select.innerHTML = tiers.map(t => `<option value="${t.duration_type}">${tierLabel(t.duration_type)}</option>`).join('');
  if (prevValue && tiers.some(t => t.duration_type === prevValue)) select.value = prevValue;
}

async function createResellerKey() {
  const btn = document.getElementById('agentCreateKeyBtn');
  const msg = document.getElementById('agentCreateKeyMsg');
  const select = document.getElementById('agentKeyTierSelect');
  const durationType = select.value;

  if (!durationType) {
    setMsg(msg, 'ບໍ່ພົບລະດັບໃຫ້ເລືອກ', 'error');
    return;
  }

  setLoading(btn, true);
  setMsg(msg, 'ກຳລັງສ້າງຄີຍ໌...', 'pending');

  const { data, error } = await supabaseClient.rpc('admin_create_reseller_key', {
    p_duration_type: durationType,
    p_created_by: currentAdminUser ? currentAdminUser.username : null,
  });

  setLoading(btn, false);

  if (error) {
    console.error(error);
    setMsg(msg, 'ສ້າງຄີຍ໌ບໍ່ສຳເລັດ: ' + error.message, 'error');
    return;
  }

  const row = Array.isArray(data) ? data[0] : data;
  setMsg(msg, 'ສ້າງຄີຍ໌ສຳເລັດແລ້ວ', 'success');

  const resultBox = document.getElementById('agentNewKeyResult');
  resultBox.innerHTML = `
    <div class="new-key-banner">
      <div>
        <div class="new-key-banner-label">ຄີຍ໌ໃໝ່ (${tierLabel(row.duration_type)})</div>
        <div class="new-key-banner-code">${row.code}</div>
      </div>
      <button type="button" class="key-copy-btn" id="copyNewKeyBtn" title="ຄັດລອກ">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
    </div>
  `;
  document.getElementById('copyNewKeyBtn').addEventListener('click', () => copyKeyCode(row.code));

  loadResellerKeys();
}

async function copyKeyCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    showToast('ຄັດລອກຄີຍ໌ແລ້ວ');
  } catch (err) {
    console.error(err);
    showToast('ຄັດລອກບໍ່ສຳເລັດ — ຄີຍ໌ຄື: ' + code);
  }
}

async function loadResellerKeys() {
  const refreshBtn = document.getElementById('agentKeysRefreshBtn');
  if (refreshBtn) refreshBtn.classList.add('spinning');

  const { data, error } = await supabaseClient
    .from('reseller_keys')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (refreshBtn) setTimeout(() => refreshBtn.classList.remove('spinning'), 400);

  if (error) {
    console.error(error);
    document.getElementById('agentKeysList').innerHTML = '<div class="empty-note">ໂຫຼດຂໍ້ມູນຜິດພາດ</div>';
    return;
  }

  currentResellerKeys = data || [];
  renderResellerKeysOpsStrip(currentResellerKeys);
  renderResellerKeys(currentResellerKeys);
  loadAgentAccounts();
}

function renderResellerKeysOpsStrip(keys) {
  const strip = document.getElementById('agentKeysOpsStrip');
  const unused = keys.filter(k => k.status === 'unused').length;
  const used = keys.filter(k => k.status === 'used').length;
  strip.innerHTML = `
    <div class="ops-chip"><div class="ops-num">${keys.length}</div><div class="ops-label">ຄີຍ໌ທັງໝົດ</div></div>
    <div class="ops-chip"><div class="ops-num">${unused}</div><div class="ops-label">ຍັງບໍ່ໄດ້ໃຊ້</div></div>
    <div class="ops-chip"><div class="ops-num">${used}</div><div class="ops-label">ໃຊ້ແລ້ວ</div></div>
  `;
}

function renderResellerKeys(keys) {
  const list = document.getElementById('agentKeysList');
  if (!keys.length) {
    list.innerHTML = '<div class="empty-note">ຍັງບໍ່ມີຄີຍ໌ — ສ້າງຄີຍ໌ທຳອິດຢູ່ດ້ານເທິງ</div>';
    return;
  }

  list.innerHTML = keys.map(k => `
    <div class="agent-key-row" data-code="${k.code}">
      <div class="agent-key-main">
        <span class="agent-key-code">${k.code}</span>
        <span class="agent-key-meta">
          ${tierLabel(k.duration_type)} • ${new Date(k.created_at).toLocaleString('lo-LA')}
          ${k.status !== 'unused' ? `<br>ໃຊ້ໂດຍ: ${k.used_by || '—'} (${k.used_at ? new Date(k.used_at).toLocaleString('lo-LA') : '—'})` : ''}
        </span>
      </div>
      <div class="agent-key-right">
        <span class="key-status-tag ${k.status}">${k.status === 'unused' ? 'ຍັງບໍ່ໄດ້ໃຊ້' : (k.status === 'revoked' ? 'ຖືກປິດແລ້ວ' : 'ໃຊ້ແລ້ວ')}</span>
        ${k.status === 'unused' ? `
        <button type="button" class="key-copy-btn" title="ຄັດລອກ">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>` : ''}
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.agent-key-row .key-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.closest('.agent-key-row').dataset.code;
      copyKeyCode(code);
    });
  });
}

// ---------- ຈັດການຕົວແທນ (ລາຍຊື່ຄົນທີ່ໃຊ້ຄີຍ໌ໄປແລ້ວ + ຍອດຊື້ສະສົມ + ປິດສິດຕົວແທນ) ----------
// ໝາຍເຫດສຳຄັນ: ໃນລະບົບນີ້ "ການເປັນຕົວແທນ" ບໍ່ໄດ້ແຍກເປັນຕາຕະລາງບັນຊີຕົວແທນຕ່າງຫາກ —
// ອີງໃສ່ແຖວ reseller_keys ທີ່ຖືກໃຊ້ (status='used') ເປັນຫຼັກຖານວ່າອີເມວນັ້ນເປັນຕົວແທນຢູ່.
// ການ "ປິດຕົວແທນ" ຈຶ່ງເຮັດໂດຍປ່ຽນ status ຂອງຄີຍ໌ນັ້ນເປັນ 'revoked' — ຖ້າ RPC ຝັ່ງ backend (purchase_product)
// ອີງໃສ່ status='used' ໃນການໃຫ້ລາຄາຕົວແທນ ການປິດຈະຕັດລາຄາຕົວແທນຂອງຄົນນັ້ນທັນທີ. ຖ້າຖານຂໍ້ມູນມີ
// CHECK constraint ຈຳກັດຄ່າ status ໄວ້ສະເພາະ 'unused'/'used' ຈະຕ້ອງເພີ່ມຄ່າ 'revoked' ເຂົ້າໄປກ່ອນ (ເບິ່ງຂໍ້ຄວາມແຈ້ງເຕືອນທ້າຍແຊັດ)
let currentAgentAccounts = [];
let agentAccountsSearchTerm = '';

async function loadAgentAccounts() {
  const list = document.getElementById('agentAccountsList');
  const strip = document.getElementById('agentAccountsOpsStrip');
  if (!list) return;

  // ເອົາຄີຍ໌ທີ່ຖືກໃຊ້ໄປແລ້ວ (used ຫຼື revoked) ແລ້ວຈັດກຸ່ມຕາມ used_by, ຖ້າຄົນດຽວກັນໃຊ້ຫຼາຍຄີຍ໌ ໃຫ້ເອົາລ້າສຸດ
  const usedKeys = (currentResellerKeys || []).filter(k => k.used_by && (k.status === 'used' || k.status === 'revoked'));
  const byEmail = new Map();
  usedKeys.forEach(k => {
    const key = k.used_by;
    const existing = byEmail.get(key);
    if (!existing || new Date(k.used_at) > new Date(existing.used_at)) byEmail.set(key, k);
  });

  let accounts = [...byEmail.values()];

  if (!accounts.length) {
    if (strip) strip.innerHTML = '';
    list.innerHTML = '<div class="empty-note">ຍັງບໍ່ມີໃຜໃຊ້ຄີຍ໌ຕົວແທນເລີຍ</div>';
    currentAgentAccounts = [];
    return;
  }

  // ດຶງຍອດຊື້ສະສົມຂອງແຕ່ລະຄົນຈາກຕາຕະລາງ orders (ອີງໃສ່ຖັນ user_email) — ຖ້າຄໍລຳນີ້ບໍ່ມີໃນຖານຂໍ້ມູນ ຈະ fail ແບບບໍ່ພັງໜ້າ
  let ordersOk = true;
  accounts = await Promise.all(accounts.map(async (k) => {
    let totalSpent = null;
    try {
      const { data, error } = await supabaseClient
        .from('orders')
        .select('price')
        .eq('user_email', k.used_by)
        .eq('status', 'completed');
      if (error) throw error;
      totalSpent = (data || []).reduce((sum, o) => sum + (Number(o.price) || 0), 0);
    } catch (err) {
      ordersOk = false;
      console.error('loadAgentAccounts: ດຶງຍອດຂາຍບໍ່ສຳເລັດ', err);
    }
    return { ...k, totalSpent };
  }));

  currentAgentAccounts = accounts;

  if (strip) {
    const active = accounts.filter(a => a.status === 'used').length;
    const revoked = accounts.filter(a => a.status === 'revoked').length;
    strip.innerHTML = `
      <div class="ops-chip"><div class="ops-num">${accounts.length}</div><div class="ops-label">ຕົວແທນທັງໝົດ</div></div>
      <div class="ops-chip"><div class="ops-num">${active}</div><div class="ops-label">ທຳງານຢູ່</div></div>
      <div class="ops-chip"><div class="ops-num">${revoked}</div><div class="ops-label">ຖືກປິດແລ້ວ</div></div>
    `;
  }

  renderAgentAccounts(currentAgentAccounts, !ordersOk);
}

function renderAgentAccounts(accounts, ordersFailed) {
  const list = document.getElementById('agentAccountsList');
  if (!list) return;

  const term = agentAccountsSearchTerm.trim().toLowerCase();
  const filtered = term ? accounts.filter(a => (a.used_by || '').toLowerCase().includes(term)) : accounts;

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-note">ບໍ່ພົບຕົວແທນທີ່ຄົ້ນຫາ</div>';
    return;
  }

  list.innerHTML = filtered.map(a => {
    const tier = currentResellerTiers.find(t => t.duration_type === a.duration_type);
    const isLifetime = tier && tier.period_days === null;
    const quota = tier ? Number(tier.quota_amount) || 0 : 0;
    const spent = a.totalSpent;

    let progressHtml = '';
    if (ordersFailed || spent === null) {
      progressHtml = `<div class="agent-acc-note">ບໍ່ສາມາດດຶງຍອດຊື້ສະສົມໄດ້ (ຕາຕະລາງ orders ອາດບໍ່ມີຖັນ user_email)</div>`;
    } else if (isLifetime || !quota) {
      progressHtml = `<div class="agent-acc-progress-text">ຍອດຊື້ສະສົມ ${formatKipAdmin(spent)} • ${isLifetime ? 'ຖາວອນ ບໍ່ມີເປົ້າ' : 'ບໍ່ໄດ້ຕັ້ງເປົ້າ'}</div>`;
    } else {
      const pct = Math.min(100, Math.round((spent / quota) * 100));
      progressHtml = `
        <div class="agent-acc-progress">
          <div class="agent-acc-bar"><div class="agent-acc-bar-fill ${pct >= 100 ? 'full' : ''}" style="width:${pct}%"></div></div>
          <span class="agent-acc-progress-text">${formatKipAdmin(spent)} / ${formatKipAdmin(quota)} (${pct}%)</span>
        </div>`;
    }

    const isRevoked = a.status === 'revoked';

    return `
    <div class="agent-acc-row" data-code="${a.code}" data-email="${(a.used_by || '').replace(/"/g, '&quot;')}">
      <div class="agent-acc-main">
        <div class="agent-acc-email">${(a.used_by || '—').replace(/</g, '&lt;')}</div>
        <div class="agent-acc-meta">ລະດັບ ${tierLabel(a.duration_type)} • ປົດລັອກ ${a.used_at ? new Date(a.used_at).toLocaleString('lo-LA') : '—'}</div>
        ${progressHtml}
      </div>
      <div class="agent-acc-right">
        <span class="key-status-tag ${a.status}">${isRevoked ? 'ຖືກປິດແລ້ວ' : 'ທຳງານຢູ່'}</span>
        <button type="button" class="agent-acc-toggle-btn ${isRevoked ? 'is-revoked' : ''}" data-code="${a.code}" data-next="${isRevoked ? 'used' : 'revoked'}">
          ${isRevoked ? 'ເປີດຄືນ' : 'ປິດຕົວແທນ'}
        </button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.agent-acc-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleAgentStatus(btn));
  });
}

async function toggleAgentStatus(btn) {
  const code = btn.dataset.code;
  const nextStatus = btn.dataset.next;
  const row = btn.closest('.agent-acc-row');
  const email = row ? row.dataset.email : '';
  const confirmMsg = nextStatus === 'revoked'
    ? `ຢືນຢັນປິດສິດຕົວແທນຂອງ "${email}"? ລາຄາຕົວແທນຂອງຄົນນີ້ຈະຖືກຕັດ (ຖ້າ backend ອີງໃສ່ status ນີ້)`
    : `ຢືນຢັນເປີດສິດຕົວແທນຂອງ "${email}" ຄືນ?`;
  if (!window.confirm(confirmMsg)) return;

  btn.disabled = true;
  const { error } = await supabaseClient
    .from('reseller_keys')
    .update({ status: nextStatus })
    .eq('code', code);
  btn.disabled = false;

  if (error) {
    console.error(error);
    showToast('ປ່ຽນສະຖານະບໍ່ສຳເລັດ: ' + error.message + ' — ອາດຕ້ອງເພີ່ມຄ່າ "revoked" ເຂົ້າ CHECK constraint ຂອງຖັນ status ກ່ອນ');
    return;
  }
  showToast(nextStatus === 'revoked' ? 'ປິດສິດຕົວແທນແລ້ວ' : 'ເປີດສິດຕົວແທນຄືນແລ້ວ');
  await loadResellerKeys();
  await loadAgentAccounts();
}


// ---------- ແທັບໝວດໝູ່ຢູ່ເທິງ "ຕັ້ງລາຄາຕົວແທນລາຍສິນຄ້າ" ----------
// ຈື່ໝວດໝູ່ທີ່ກຳລັງເລືອກໄວ້ ເພື່ອບໍ່ໃຫ້ຄືນກັບໄປແທັບທຳອິດທຸກຄັ້ງທີ່ໂຫຼດຂໍ້ມູນໃໝ່ (ເຊັ່ນ ຫຼັງບັນທຶກລາຄາ)
let agentPriceActiveCategory = null;
let currentAgentPriceProducts = [];

function renderAgentPriceList(products) {
  const list = document.getElementById('agentPriceList');
  const tabsHost = document.getElementById('agentPriceCatTabs');
  if (!list) return;

  const activeProducts = (products || []).filter(p => !p.archived);
  currentAgentPriceProducts = activeProducts;

  if (!activeProducts.length) {
    if (tabsHost) tabsHost.innerHTML = '';
    list.innerHTML = '<div class="empty-note">ຍັງບໍ່ມີສິນຄ້າ — ເພີ່ມສິນຄ້າກ່ອນທີ່ແຖບ "ເພີ່ມສິນຄ້າ"</div>';
    return;
  }

  // ໝວດໝູ່ຈິງທີ່ຮ້ານຕັ້ງໄວ້ (category_1_name..4) + ໝວດໝູ່ອື່ນທີ່ອາດຕິດມາກັບສິນຄ້າເກົ່າ — ສະແດງສະເພາະອັນທີ່ມີສິນຄ້າຢູ່ຈິງ
  const knownNames = getCurrentCategoryNames();
  const productCats = [...new Set(activeProducts.map(p => (p.category || '').trim()).filter(Boolean))];
  const orderedNames = [...knownNames, ...productCats.filter(c => !knownNames.includes(c))];

  const catsWithCount = orderedNames
    .map(name => ({ name, count: activeProducts.filter(p => (p.category || '').trim() === name).length }))
    .filter(c => c.count > 0);

  if (!catsWithCount.length) {
    if (tabsHost) tabsHost.innerHTML = '';
    list.innerHTML = '<div class="empty-note">ຍັງບໍ່ມີສິນຄ້າໃນໝວດໝູ່ໃດເລີຍ — ເພີ່ມສິນຄ້າແລ້ວກຳນົດໝວດໝູ່ກ່ອນ</div>';
    return;
  }

  if (!agentPriceActiveCategory || !catsWithCount.some(c => c.name === agentPriceActiveCategory)) {
    agentPriceActiveCategory = catsWithCount[0].name;
  }

  if (tabsHost) {
    tabsHost.innerHTML = catsWithCount.map(c => `
      <div class="agent-cat-tab ${c.name === agentPriceActiveCategory ? 'active' : ''}" data-cat="${c.name.replace(/"/g, '&quot;')}">
        <span class="agent-cat-name">${c.name}</span>
        <span class="agent-cat-count">${c.count} ລາຍການ</span>
      </div>
    `).join('');

    tabsHost.querySelectorAll('.agent-cat-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        agentPriceActiveCategory = tab.dataset.cat;
        renderAgentPriceList(currentAgentPriceProducts);
      });
    });
  }

  const shownProducts = activeProducts.filter(p => (p.category || '').trim() === agentPriceActiveCategory);

  list.innerHTML = shownProducts.map(p => {
    if (p.duration_enabled) {
      return `
      <div class="price-prod-card" data-product-id="${p.id}">
        <div class="price-prod-name">${(p.name || '').replace(/</g, '&lt;')}</div>
        <div class="price-dur-list">
          ${(p.durations || []).map(d => `
            <div class="price-dur-row" data-duration-id="${d.id}">
              <span class="price-dur-label">${d.label} <span class="price-dur-base">(ລາຄາປົກກະຕິ ${formatKipAdmin(d.price)})</span></span>
              <input type="number" class="edit-reseller-price" placeholder="ຫວ່າງ = ໃຊ້ % ສ່ວນຫຼຸດ" value="${d.reseller_price ?? ''}" min="0" step="1">
            </div>
          `).join('')}
        </div>
        <button type="button" class="gx-submit price-save-btn" style="margin-top:10px;">
          <span class="gx-spinner"></span>
          <span class="gx-submit-label">ບັນທຶກລາຄາຕົວແທນ</span>
        </button>
      </div>`;
    }
    return `
      <div class="price-prod-card" data-product-id="${p.id}">
        <div class="price-prod-name">${(p.name || '').replace(/</g, '&lt;')} <span class="price-dur-base">(ລາຄາປົກກະຕິ ${formatKipAdmin(p.price)})</span></div>
        <div class="price-dur-row" data-single="true">
          <input type="number" class="edit-reseller-price" placeholder="ຫວ່າງ = ໃຊ້ % ສ່ວນຫຼຸດ" value="${p.reseller_price ?? ''}" min="0" step="1">
        </div>
        <button type="button" class="gx-submit price-save-btn" style="margin-top:10px;">
          <span class="gx-spinner"></span>
          <span class="gx-submit-label">ບັນທຶກລາຄາຕົວແທນ</span>
        </button>
      </div>`;
  }).join('');

  list.querySelectorAll('.price-prod-card').forEach(card => {
    card.querySelector('.price-save-btn').addEventListener('click', () => saveAgentPrices(card));
  });
}

async function saveAgentPrices(card) {
  const btn = card.querySelector('.price-save-btn');
  const productId = card.dataset.productId;
  const durRows = card.querySelectorAll('.price-dur-row[data-duration-id]');

  setLoading(btn, true);
  try {
    if (durRows.length) {
      for (const row of durRows) {
        const durationId = row.dataset.durationId;
        const input = row.querySelector('.edit-reseller-price');
        const val = input.value.trim();
        const resellerPrice = val === '' ? null : Number(val);
        const { error } = await supabaseClient
          .from('product_durations')
          .update({ reseller_price: resellerPrice })
          .eq('id', durationId);
        if (error) throw error;
      }
    } else {
      const input = card.querySelector('.price-dur-row[data-single="true"] .edit-reseller-price');
      const val = input.value.trim();
      const resellerPrice = val === '' ? null : Number(val);
      const { error } = await supabaseClient
        .from('products')
        .update({ reseller_price: resellerPrice })
        .eq('id', productId);
      if (error) throw error;
    }
    showToast('ບັນທຶກລາຄາຕົວແທນສຳເລັດແລ້ວ');
    await loadProducts();
  } catch (err) {
    console.error(err);
    showToast('ບັນທຶກບໍ່ສຳເລັດ: ' + err.message);
  } finally {
    setLoading(btn, false);
  }
}

function openSlipLightbox(src) {
  const lb = document.getElementById('slipLightbox');
  document.getElementById('slipLightboxImg').src = src;
  lb.classList.add('show');
}

function closeSlipLightbox() {
  document.getElementById('slipLightbox').classList.remove('show');
}

// ============================================
// ຕັ້ງຄ່າຮ້ານ — ຊື່ຮ້ານ / ຄຳອະທິບາຍ / ຂໍ້ຄວາມປະກາດ / ຊື່ໝວດໝູ່ / ໂລໂກ້ / QR
// ຕ້ອງແລ່ນ site_settings_setup.sql ໃນ Supabase ກ່ອນ (ສ້າງຕາຕະລາງ site_settings ແລະ bucket site-assets)
// ============================================
const SITE_SETTINGS_TABLE = 'site_settings';
const SITE_SETTINGS_ID = 1;

// ຖ້າຍັງບໍ່ມີແຖວການຕັ້ງຄ່າ (ຄັ້ງທຳອິດ) ໃຫ້ສ້າງແຖວຄ່າຕັ້ງຕົ້ນຂຶ້ນມາກ່ອນ
async function ensureSiteSettingsRow() {
  const { data, error } = await supabaseClient
    .from(SITE_SETTINGS_TABLE)
    .select('id')
    .eq('id', SITE_SETTINGS_ID)
    .maybeSingle();
  if (!error && !data) {
    await supabaseClient.from(SITE_SETTINGS_TABLE).insert({ id: SITE_SETTINGS_ID });
  }
}

function fillDropzonePreview(zoneId, textId, inputId, url) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input || !url) return;
  zone.classList.add('has-image');
  const textEl = document.getElementById(textId);
  if (textEl) textEl.remove();
  let img = zone.querySelector('img');
  if (!img) {
    img = document.createElement('img');
    zone.insertBefore(img, input);
  }
  img.src = url;
}

// ຄືກັນກັບ fillDropzonePreview ແຕ່ຮອງຮັບກໍລະນີ "ລຶບຮູບອອກແລ້ວ" ນຳ (ຄືນ dropzone ກັບໄປເປັນ placeholder ເລີ່ມຕົ້ນ)
// ໃຊ້ກັບຮູບໝວດໝູ່ ເພາະສາມາດຖືກລຶບອອກໄດ້ (ຕ່າງຈາກໂລໂກ້/QR ທີ່ມີແຕ່ "ປ່ຽນຮູບ")
function resetDropzoneIfEmpty(zoneId, textId, inputId, url, placeholderMsg) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  if (url) {
    fillDropzonePreview(zoneId, textId, inputId, url);
    return;
  }
  zone.classList.remove('has-image');
  const img = zone.querySelector('img');
  if (img) img.remove();
  if (!document.getElementById(textId)) {
    const span = document.createElement('span');
    span.id = textId;
    span.textContent = placeholderMsg;
    const input = document.getElementById(inputId);
    zone.insertBefore(span, input || null);
  }
}

function loadSiteSettingsIntoForm(settings) {
  const nameInput = document.getElementById('settingStoreName');
  const taglineInput = document.getElementById('settingTagline');
  const announceInput = document.getElementById('settingAnnouncement');
  const socialFacebookInput = document.getElementById('settingSocialFacebook');
  const socialDiscordInput = document.getElementById('settingSocialDiscord');
  const socialLineInput = document.getElementById('settingSocialLine');
  const socialTelegramInput = document.getElementById('settingSocialTelegram');
  const socialWhatsappInput = document.getElementById('settingSocialWhatsapp');
  const qrLabel1Input = document.getElementById('settingQrLabel1');
  const qrLabel2Input = document.getElementById('settingQrLabel2');

  if (nameInput && document.activeElement !== nameInput) nameInput.value = settings.store_name || '';
  if (taglineInput && document.activeElement !== taglineInput) taglineInput.value = settings.tagline || '';
  if (announceInput && document.activeElement !== announceInput) announceInput.value = settings.announcement_text || '';
  if (socialFacebookInput && document.activeElement !== socialFacebookInput) socialFacebookInput.value = settings.social_facebook || '';
  if (socialDiscordInput && document.activeElement !== socialDiscordInput) socialDiscordInput.value = settings.social_discord || '';
  if (socialLineInput && document.activeElement !== socialLineInput) socialLineInput.value = settings.social_line || '';
  if (socialTelegramInput && document.activeElement !== socialTelegramInput) socialTelegramInput.value = settings.social_telegram || '';
  if (socialWhatsappInput && document.activeElement !== socialWhatsappInput) socialWhatsappInput.value = settings.social_whatsapp || '';
  if (qrLabel1Input && document.activeElement !== qrLabel1Input) qrLabel1Input.value = settings.qr_label || '';
  if (qrLabel2Input && document.activeElement !== qrLabel2Input) qrLabel2Input.value = settings.qr_label_2 || '';

  // ໝວດໝູ່ 1-4: ຊື່ + ຮູບພາບ (ໜ້າຮ້ານຈິງມີ 4 ກາຕູນຄົງທີ່)
  for (let i = 1; i <= 4; i++) {
    const nameInputEl = document.getElementById(`catName${i}`);
    if (nameInputEl && document.activeElement !== nameInputEl) {
      nameInputEl.value = settings[`category_${i}_name`] || '';
    }
    const titleInputEl = document.getElementById(`catTitle${i}`);
    if (titleInputEl && document.activeElement !== titleInputEl) {
      titleInputEl.value = settings[`category_${i}_title`] || '';
    }
    const descInputEl = document.getElementById(`catDesc${i}`);
    if (descInputEl && document.activeElement !== descInputEl) {
      descInputEl.value = settings[`category_${i}_desc`] || '';
    }
    resetDropzoneIfEmpty(
      `catImgDrop${i}`, `catImgDropText${i}`, `catImgInput${i}`,
      settings[`category_${i}_image`],
      'ແຕະເພື່ອເລືອກຮູບໝວດໝູ່ນີ້ (ອັບໂຫລດອັດຕະໂນມັດ)'
    );
  }

  fillDropzonePreview('logoDropZone', 'logoDropZoneText', 'logoInput', settings.logo_url);
  fillDropzonePreview('qrDropZone', 'qrDropZoneText', 'qrInput', settings.qr_url);
  fillDropzonePreview('qrDropZone2', 'qrDropZoneText2', 'qrInput2', settings.qr_url_2);
  resetDropzoneIfEmpty(
    'heroImageDropZone', 'heroImageDropZoneText', 'heroImageInput',
    settings.hero_image,
    'ແຕະເພື່ອເລືອກຮູບ hero ໜ້າຫຼັກ (ອັບໂຫລດອັດຕະໂນມັດ)'
  );
}

async function loadSiteSettingsAdmin() {
  try {
    const { data, error } = await supabaseClient
      .from(SITE_SETTINGS_TABLE)
      .select('*')
      .eq('id', SITE_SETTINGS_ID)
      .maybeSingle();
    if (error) throw error;
    currentSiteSettings = data || {};
    loadSiteSettingsIntoForm(currentSiteSettings);
    renderCategoryOptions(currentProducts);
  } catch (err) {
    console.error('ໂຫຼດການຕັ້ງຄ່າຮ້ານບໍ່ສຳເລັດ', err);
  }
}

async function saveSiteSettingsFields(fields, btn, msgEl, successText) {
  setLoading(btn, true);
  setMsg(msgEl, 'ກຳລັງບັນທຶກ...', 'pending');
  try {
    await ensureSiteSettingsRow();
    const { error } = await supabaseClient
      .from(SITE_SETTINGS_TABLE)
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', SITE_SETTINGS_ID);
    if (error) throw error;
    setMsg(msgEl, successText, 'success');
    await loadSiteSettingsAdmin();
  } catch (err) {
    console.error(err);
    setMsg(msgEl, 'ເກີດຂໍ້ຜິດພາດ: ' + (err.message || 'ລອງໃໝ່ອີກຄັ້ງ'), 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function uploadSiteAsset(file, prefix) {
  const ext = file.name.split('.').pop();
  const path = `${prefix}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: uploadError } = await supabaseClient.storage.from('site-assets').upload(path, file);
  if (uploadError) throw uploadError;
  const { data: pub } = supabaseClient.storage.from('site-assets').getPublicUrl(path);
  return pub.publicUrl;
}

function setupSiteImageDropzone(zoneId, textId, inputId, onSelected) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    onSelected(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      zone.classList.add('has-image');
      const textEl = document.getElementById(textId);
      if (textEl) textEl.remove();
      let img = zone.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        zone.insertBefore(img, input);
      }
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---------- ຮູບພາບປະຈຳໝວດໝູ່ 1-10 — ເລືອກຮູບແລ້ວອັບໂຫລດ+ບັນທຶກອັດຕະໂນມັດທັນທີ (ບໍ່ຕ້ອງກົດປຸ່ມບັນທຶກແຍກ) ----------
function initCategoryImageDropzones() {
  for (let i = 1; i <= 4; i++) {
    const zoneId = `catImgDrop${i}`;
    const textId = `catImgDropText${i}`;
    const inputId = `catImgInput${i}`;
    const removeId = `catImgRemove${i}`;
    const msgId = `catImgMsg${i}`;

    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const removeBtn = document.getElementById(removeId);
    const msg = document.getElementById(msgId);
    if (!zone || !input) continue; // ໜ້ານີ້ບໍ່ໄດ້ໃສ່ dropzone ຂອງໝວດນີ້ໄວ້ -> ຂ້າມແບບປອດໄພ

    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;

      // ສະແດງຕົວຢ່າງທັນທີຂະນະລໍຖ້າອັບໂຫລດ (ຮູ້ສຶກໄວ, ບໍ່ຕ້ອງລໍຄ້າງໜ້າຈໍ)
      const reader = new FileReader();
      reader.onload = (e) => {
        zone.classList.add('has-image');
        const textEl = document.getElementById(textId);
        if (textEl) textEl.remove();
        let img = zone.querySelector('img');
        if (!img) { img = document.createElement('img'); zone.insertBefore(img, input); }
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);

      if (msg) setMsg(msg, 'ກຳລັງອັບໂຫລດ...', 'pending');
      try {
        const url = await uploadSiteAsset(file, `category-${i}`);
        await ensureSiteSettingsRow();
        const { error } = await supabaseClient
          .from(SITE_SETTINGS_TABLE)
          .update({ [`category_${i}_image`]: url, updated_at: new Date().toISOString() })
          .eq('id', SITE_SETTINGS_ID);
        if (error) throw error;
        if (msg) setMsg(msg, 'ບັນທຶກຮູບໝວດໝູ່ນີ້ສຳເລັດແລ້ວ ✓', 'success');
        await loadSiteSettingsAdmin();
      } catch (err) {
        console.error(err);
        if (msg) setMsg(msg, 'ອັບໂຫລດບໍ່ສຳເລັດ: ' + (err.message || 'ລອງໃໝ່ອີກຄັ້ງ'), 'error');
      } finally {
        input.value = '';
      }
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        if (!confirm('ລຶບຮູບໝວດໝູ່ນີ້ ແລະ ກັບໄປໃຊ້ວິດີໂອຄ່າເລີ່ມຕົ້ນ?')) return;
        if (msg) setMsg(msg, 'ກຳລັງລຶບ...', 'pending');
        try {
          await ensureSiteSettingsRow();
          const { error } = await supabaseClient
            .from(SITE_SETTINGS_TABLE)
            .update({ [`category_${i}_image`]: null, updated_at: new Date().toISOString() })
            .eq('id', SITE_SETTINGS_ID);
          if (error) throw error;
          if (msg) setMsg(msg, 'ລຶບຮູບແລ້ວ', 'success');
          await loadSiteSettingsAdmin();
        } catch (err) {
          console.error(err);
          if (msg) setMsg(msg, 'ລຶບບໍ່ສຳເລັດ: ' + (err.message || 'ລອງໃໝ່ອີກຄັ້ງ'), 'error');
        }
      });
    }
  }
}

// ---------- ຮູບ hero ໜ້າຫຼັກ — ເລືອກຮູບແລ້ວອັບໂຫລດ+ບັນທຶກອັດຕະໂນມັດທັນທີ (ຄືກັນກັບຮູບໝວດໝູ່) ----------
function initHeroImageDropzone() {
  const zoneId = 'heroImageDropZone';
  const textId = 'heroImageDropZoneText';
  const inputId = 'heroImageInput';
  const removeId = 'heroImageRemoveBtn';
  const msgId = 'heroImageMsg';

  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const removeBtn = document.getElementById(removeId);
  const msg = document.getElementById(msgId);
  if (!zone || !input) return;

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      zone.classList.add('has-image');
      const textEl = document.getElementById(textId);
      if (textEl) textEl.remove();
      let img = zone.querySelector('img');
      if (!img) { img = document.createElement('img'); zone.insertBefore(img, input); }
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    if (msg) setMsg(msg, 'ກຳລັງອັບໂຫລດ...', 'pending');
    try {
      const url = await uploadSiteAsset(file, 'hero');
      await ensureSiteSettingsRow();
      const { error } = await supabaseClient
        .from(SITE_SETTINGS_TABLE)
        .update({ hero_image: url, updated_at: new Date().toISOString() })
        .eq('id', SITE_SETTINGS_ID);
      if (error) throw error;
      if (msg) setMsg(msg, 'ບັນທຶກຮູບ hero ສຳເລັດແລ້ວ ✓', 'success');
      await loadSiteSettingsAdmin();
    } catch (err) {
      console.error(err);
      if (msg) setMsg(msg, 'ອັບໂຫລດບໍ່ສຳເລັດ: ' + (err.message || 'ລອງໃໝ່ອີກຄັ້ງ'), 'error');
    } finally {
      input.value = '';
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', async () => {
      if (!confirm('ລຶບຮູບ hero ນີ້ ແລະ ກັບໄປໃຊ້ວິດີໂອຄ່າເລີ່ມຕົ້ນ?')) return;
      if (msg) setMsg(msg, 'ກຳລັງລຶບ...', 'pending');
      try {
        await ensureSiteSettingsRow();
        const { error } = await supabaseClient
          .from(SITE_SETTINGS_TABLE)
          .update({ hero_image: null, updated_at: new Date().toISOString() })
          .eq('id', SITE_SETTINGS_ID);
        if (error) throw error;
        if (msg) setMsg(msg, 'ລຶບຮູບແລ້ວ', 'success');
        await loadSiteSettingsAdmin();
      } catch (err) {
        console.error(err);
        if (msg) setMsg(msg, 'ລຶບບໍ່ສຳເລັດ: ' + (err.message || 'ລອງໃໝ່ອີກຄັ້ງ'), 'error');
      }
    });
  }
}

function initSiteSettingsPanel() {
  setupSiteImageDropzone('logoDropZone', 'logoDropZoneText', 'logoInput', (f) => { selectedLogoFile = f; });
  setupSiteImageDropzone('qrDropZone', 'qrDropZoneText', 'qrInput', (f) => { selectedQrFile = f; });
  setupSiteImageDropzone('qrDropZone2', 'qrDropZoneText2', 'qrInput2', (f) => { selectedQrFile2 = f; });
  initCategoryImageDropzones();
  initHeroImageDropzone();
  initCategoryNameConfirmButtons();
  initCategoryTitleDescConfirmButtons();

  const saveStoreNameBtn = document.getElementById('saveStoreNameBtn');
  if (saveStoreNameBtn) {
    saveStoreNameBtn.addEventListener('click', () => {
      const msg = document.getElementById('storeNameMsg');
      const name = document.getElementById('settingStoreName').value.trim();
      if (!name) { setMsg(msg, 'ກະລຸນາໃສ່ຊື່ຮ້ານ', 'error'); return; }
      saveSiteSettingsFields(
        { store_name: name }, saveStoreNameBtn, msg,
        'ບັນທຶກຊື່ຮ້ານສຳເລັດແລ້ວ — ໜ້າຮ້ານຈິງຈະອັບເດດອັດຕະໂນມັດ'
      );
    });
  }

  const saveTaglineBtn = document.getElementById('saveTaglineBtn');
  if (saveTaglineBtn) {
    saveTaglineBtn.addEventListener('click', () => {
      const msg = document.getElementById('taglineMsg');
      const tagline = document.getElementById('settingTagline').value.trim();
      saveSiteSettingsFields({ tagline }, saveTaglineBtn, msg, 'ບັນທຶກຄຳອະທິບາຍສຳເລັດແລ້ວ');
    });
  }

  const saveCategoryNamesBtn = document.getElementById('saveCategoryNamesBtn');
  if (saveCategoryNamesBtn) {
    saveCategoryNamesBtn.addEventListener('click', async () => {
      const msg = document.getElementById('categoryNamesMsg');
      const fields = {};
      const renames = [];

      for (let i = 1; i <= 4; i++) {
        const input = document.getElementById(`catName${i}`);
        const val = input ? input.value.trim() : '';
        const newName = val || `ໝວດໝູ່ ${i}`;
        const oldName = (
          currentSiteSettings && currentSiteSettings[`category_${i}_name`]
            ? String(currentSiteSettings[`category_${i}_name`])
            : `ໝວດໝູ່ ${i}`
        ).trim();
        fields[`category_${i}_name`] = newName;
        if (oldName && oldName !== newName) {
          renames.push({ oldName, newName });
        }
      }

      // ຖ້າມີການປ່ຽນຊື່ໝວດໝູ່ -> ຕ້ອງອັບເດດສິນຄ້າທຸກອັນທີ່ຍັງໃຊ້ຊື່ເກົ່າ (products.category ເປັນຂໍ້ຄວາມ ບໍ່ແມ່ນ id)
      // ບໍ່ດັ່ງນັ້ນສິນຄ້າຈະຫຼຸດອອກຈາກໝວດ ແລະ ຕົວເລືອກໝວດໝູ່ຕອນເພີ່ມສິນຄ້າຈະຄ້າງຊື່ເກົ່າໄວ້ຄູ່ກັບຊື່ໃໝ່
      if (renames.length) {
        setLoading(saveCategoryNamesBtn, true);
        setMsg(msg, 'ກຳລັງອັບເດດສິນຄ້າໃນໝວດ...', 'pending');
        try {
          for (const r of renames) {
            const { error } = await supabaseClient
              .from('products')
              .update({ category: r.newName })
              .eq('category', r.oldName);
            if (error) throw error;
          }
          await loadProducts(); // ໂຫຼດສິນຄ້າ+ຕົວເລືອກໝວດໝູ່ໃໝ່ ເພື່ອບໍ່ໃຫ້ຄ້າງຊື່ເກົ່າໃນ dropdown
        } catch (err) {
          console.error(err);
          setLoading(saveCategoryNamesBtn, false);
          setMsg(msg, 'ເກີດຂໍ້ຜິດພາດຕອນອັບເດດສິນຄ້າ: ' + (err.message || 'ລອງໃໝ່ອີກຄັ້ງ'), 'error');
          return;
        }
        setLoading(saveCategoryNamesBtn, false);
      }

      saveSiteSettingsFields(
        fields, saveCategoryNamesBtn, msg,
        'ບັນທຶກຊື່ໝວດໝູ່ທັງໝົດສຳເລັດແລ້ວ — ໜ້າຮ້ານຈິງຈະອັບເດດອັດຕະໂນມັດ'
      );
    });
  }

  const saveAnnouncementBtn = document.getElementById('saveAnnouncementBtn');
  if (saveAnnouncementBtn) {
    saveAnnouncementBtn.addEventListener('click', () => {
      const msg = document.getElementById('announcementMsg');
      const text = document.getElementById('settingAnnouncement').value.trim();
      if (!text) { setMsg(msg, 'ກະລຸນາໃສ່ຂໍ້ຄວາມປະກາດ', 'error'); return; }
      saveSiteSettingsFields({ announcement_text: text }, saveAnnouncementBtn, msg, 'ບັນທຶກຂໍ້ຄວາມປະກາດສຳເລັດແລ້ວ');
    });
  }

  const saveSocialLinksBtn = document.getElementById('saveSocialLinksBtn');
  if (saveSocialLinksBtn) {
    saveSocialLinksBtn.addEventListener('click', () => {
      const msg = document.getElementById('socialLinksMsg');
      const facebook = document.getElementById('settingSocialFacebook').value.trim();
      const discord = document.getElementById('settingSocialDiscord').value.trim();
      const line = document.getElementById('settingSocialLine').value.trim();
      const telegram = document.getElementById('settingSocialTelegram').value.trim();
      const whatsapp = document.getElementById('settingSocialWhatsapp').value.trim();
      saveSiteSettingsFields(
        {
          social_facebook: facebook || null,
          social_discord: discord || null,
          social_line: line || null,
          social_telegram: telegram || null,
          social_whatsapp: whatsapp || null
        },
        saveSocialLinksBtn, msg,
        'ບັນທຶກຊ່ອງທາງໂຊເຊียลສຳເລັດແລ້ວ — ໜ້າຮ້ານຈິງຈະອັບເດດອັດຕະໂນມັດ'
      );
    });
  }

  const saveLogoBtn = document.getElementById('saveLogoBtn');
  if (saveLogoBtn) {
    saveLogoBtn.addEventListener('click', async () => {
      const msg = document.getElementById('logoMsg');
      if (!selectedLogoFile) { setMsg(msg, 'ກະລຸນາເລືອກຮູບໂລໂກ້ກ່ອນ', 'error'); return; }
      setLoading(saveLogoBtn, true);
      setMsg(msg, 'ກຳລັງອັບໂຫຼດ...', 'pending');
      try {
        const url = await uploadSiteAsset(selectedLogoFile, 'logo');
        await ensureSiteSettingsRow();
        const { error } = await supabaseClient
          .from(SITE_SETTINGS_TABLE)
          .update({ logo_url: url, updated_at: new Date().toISOString() })
          .eq('id', SITE_SETTINGS_ID);
        if (error) throw error;
        setMsg(msg, 'ປ່ຽນໂລໂກ້ສຳເລັດແລ້ວ', 'success');
        selectedLogoFile = null;
        await loadSiteSettingsAdmin();
      } catch (err) {
        console.error(err);
        setMsg(msg, 'ເກີດຂໍ້ຜິດພາດ: ' + (err.message || 'ລອງໃໝ່ອີກຄັ້ງ'), 'error');
      } finally {
        setLoading(saveLogoBtn, false);
      }
    });
  }

  const saveQrBtn = document.getElementById('saveQrBtn');
  if (saveQrBtn) {
    saveQrBtn.addEventListener('click', async () => {
      const msg = document.getElementById('qrMsg');
      if (!selectedQrFile && !currentSiteSettings.qr_url) {
        setMsg(msg, 'ກະລຸນາເລືອກຮູບ QR ອັນທີ 1 ກ່ອນ', 'error');
        return;
      }
      setLoading(saveQrBtn, true);
      setMsg(msg, 'ກຳລັງອັບໂຫຼດ...', 'pending');
      try {
        const label1 = document.getElementById('settingQrLabel1').value.trim();
        const label2 = document.getElementById('settingQrLabel2').value.trim();

        const fields = {
          qr_label: label1 || null,
          qr_label_2: label2 || null
        };
        if (selectedQrFile) fields.qr_url = await uploadSiteAsset(selectedQrFile, 'qr');
        if (selectedQrFile2) fields.qr_url_2 = await uploadSiteAsset(selectedQrFile2, 'qr');

        await ensureSiteSettingsRow();
        const { error } = await supabaseClient
          .from(SITE_SETTINGS_TABLE)
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq('id', SITE_SETTINGS_ID);
        if (error) throw error;
        setMsg(msg, 'ບັນທຶກ QR ໂອນເງິນສຳເລັດແລ້ວ', 'success');
        selectedQrFile = null;
        selectedQrFile2 = null;
        await loadSiteSettingsAdmin();
      } catch (err) {
        console.error(err);
        setMsg(msg, 'ເກີດຂໍ້ຜິດພາດ: ' + (err.message || 'ລອງໃໝ່ອີກຄັ້ງ'), 'error');
      } finally {
        setLoading(saveQrBtn, false);
      }
    });
  }
}


// ---------- ການເລີ່ມຕົ້ນຫ້ອງແອດມິນ (ຮັນຫຼັງຈາກກວດສິດ Discord ຜ່ານແລ້ວເທົ່ານັ້ນ) ----------
async function initAdminPanel() {

  const backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.addEventListener('click', () => { window.location.href = 'index.html'; });

  // ---- accordion (.switch หัวข้อ <-> #panelXxx กล่องเนื้อหา) ----
  // ก่อนหน้านี้กดหัวข้อไม่มี JS คุมเลย ทำให้ .panel-content ทุกกล่องโชว์รวมกันหมด
  // ตอนนี้คุมให้เปิดได้ทีละกล่อง กดหัวข้ออื่นจะปิดกล่องเดิมแล้วเปิดกล่องที่กด
  //
  // ปัญหาเดิม: #panelXxx (ເນື້ອຫາ) ຖືກວາງໄວ້ໄກຈາກ .switch (ຫົວຂໍ້) ຫຼາຍ (ຢູ່ລຸ່ມສຸດ
  // ຂອງໜ້າ ຫຼັງ deck ທັງໝົດ) ພໍກົດເປີດແລ້ວຟອร์มไปโผล่อยู่ล่างสุดแทน ต่างจาก
  // "ລະບົບຕົວແທນ" ທີ່ເນື້ອຫາຢູ່ໃນ .switch ດຽວກັນເລີຍບໍ່ມີບັນຫານີ້ — ແກ້ໂດຍຍ້າຍ
  // #panelXxx ແຕ່ລະອັນເຂົ້າໄປຢູ່ໃນ .switch-body-inner ຂອງຫົວຂໍ້ຕົນເອງໂດຍກົງ
  // (ໃນ admin.html) ໃຫ້ພຶດຕິກຳຄືກັນກັບ "ລະບົບຕົວແທນ" ທຸກອັນ ບໍ່ຕ້ອງເລື່ອນຫາອີກຕໍ່ໄປ
  const accSwitches = document.querySelectorAll('.switch[data-target]');
  const accPanels = document.querySelectorAll('.panel-content');

  function openAccordion(targetId) {
    accSwitches.forEach((sw) => sw.classList.toggle('open', sw.dataset.target === targetId));
    accPanels.forEach((p) => p.classList.toggle('open', p.id === targetId));
  }

  accSwitches.forEach((sw) => {
    const head = sw.querySelector('.switch-head');
    if (!head) return;
    head.addEventListener('click', () => {
      const targetId = sw.dataset.target;
      const alreadyOpen = sw.classList.contains('open');
      const nextTarget = alreadyOpen ? null : targetId;
      openAccordion(nextTarget);
      requestAnimationFrame(() => {
        sw.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  });

  // เปิดกล่องแรกที่ถูกตั้งเป็น .switch.open ไว้ใน HTML ตั้งแต่ต้น (panelAdd)
  const initialOpen = document.querySelector('.switch.open[data-target]');
  if (initialOpen) openAccordion(initialOpen.dataset.target);

  // ---- tabs (ເລື່ອນຊ້າຍ-ຂວາໄດ້, ຮອງຮັບຈຳນວນແທັບບໍ່ຈຳກັດ) ----
  const tabs = document.querySelectorAll('.gx-tab3');
  const tabsWrap = document.querySelector('.gx-tabs3');
  const slider = document.getElementById('tabSlider3');
  const panels = document.querySelectorAll('.panel');

  function positionTabSlider(tab) {
    if (!tab || !slider) return;
    slider.style.width = tab.offsetWidth + 'px';
    slider.style.transform = `translateX(${tab.offsetLeft - 4}px)`;
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.panel).classList.add('active');
      positionTabSlider(tab);
      tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  });

  requestAnimationFrame(() => positionTabSlider(document.querySelector('.gx-tab3.active')));
  window.addEventListener('resize', () => positionTabSlider(document.querySelector('.gx-tab3.active')));

  // ---- image dropzone ----
  const dropZone = document.getElementById('dropZone');
  const dropZoneText = document.getElementById('dropZoneText');
  const imageInput = document.getElementById('imageInput');
  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (!file) return;
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      dropZone.classList.add('has-image');
      dropZoneText.remove();
      let img = dropZone.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        dropZone.insertBefore(img, imageInput);
      }
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  // ---- duration options builder (12ຊມ / 1ວັນ ... 30ວັນ) ----
  const durationOptionsList = document.getElementById('durationOptionsList');
  durationOptionsList.innerHTML = DURATION_OPTIONS.map((label, i) => `
    <div class="duration-opt-row" data-label="${label}">
      <label>
        <input type="checkbox" class="dur-check" data-index="${i}">
        ${label}
      </label>
      <input type="number" class="dur-price" min="0" step="0.01" placeholder="ລາຄາ (ກີບ)" style="display:none;">
    </div>
  `).join('');

  durationOptionsList.querySelectorAll('.dur-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const priceInput = cb.closest('.duration-opt-row').querySelector('.dur-price');
      priceInput.style.display = cb.checked ? 'block' : 'none';
      if (cb.checked) priceInput.focus();
    });
  });

  // ---- ລິ້ງໂບນັດ builder (ຕອນເພີ່ມສິນຄ້າໃໝ່) — ເພີ່ມໄດ້ບໍ່ຈຳກັດ ----
  const pLinksEnabled = document.getElementById('pLinksEnabled');
  const linksOptionsWrap = document.getElementById('linksOptionsWrap');
  const linkRowsList = document.getElementById('linkRowsList');
  const addLinkRowBtn = document.getElementById('addLinkRowBtn');

  function createLinkRow() {
    const row = document.createElement('div');
    row.className = 'link-row';
    row.innerHTML = `
      <input type="text" class="link-label-input" placeholder="ຊື່ລິ້ງ ເຊັ່ນ: ຄຣິບສອນເລ່ນເກມ">
      <input type="url" class="link-url-input" placeholder="ວາງລິ້ງທີ່ນີ້ (https://...)">
      <button type="button" class="link-row-remove" title="ລຶບ">×</button>
    `;
    row.querySelector('.link-row-remove').addEventListener('click', () => row.remove());
    return row;
  }

  addLinkRowBtn.addEventListener('click', () => {
    linkRowsList.appendChild(createLinkRow());
  });

  pLinksEnabled.addEventListener('change', () => {
    linksOptionsWrap.style.display = pLinksEnabled.checked ? 'block' : 'none';
    if (pLinksEnabled.checked && !linkRowsList.children.length) {
      linkRowsList.appendChild(createLinkRow());
    }
  });

  const pDurationEnabled = document.getElementById('pDurationEnabled');
  const durationOptionsWrap = document.getElementById('durationOptionsWrap');
  const basePriceField = document.getElementById('basePriceField');
  pDurationEnabled.addEventListener('change', () => {
    durationOptionsWrap.style.display = pDurationEnabled.checked ? 'block' : 'none';
    basePriceField.style.display = pDurationEnabled.checked ? 'none' : 'block';
  });

  // ---- add product form ----
  const addForm = document.getElementById('addForm');
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('addMsg');
    const btn = document.getElementById('addSubmit');
    const name = document.getElementById('pName').value.trim();
    const categorySelect = document.getElementById('pCategorySelect').value;
    const category = categorySelect || 'ໝວດໝູ່ສິນຄ້າ';
    const price = parseFloat(document.getElementById('pPrice').value) || 0;
    const durationEnabled = document.getElementById('pDurationEnabled').checked;

    let durationRows = [];
    if (durationEnabled) {
      durationOptionsList.querySelectorAll('.duration-opt-row').forEach(row => {
        const cb = row.querySelector('.dur-check');
        if (!cb.checked) return;
        const label = row.dataset.label;
        const durPrice = parseFloat(row.querySelector('.dur-price').value);
        durationRows.push({ label, price: isNaN(durPrice) ? 0 : durPrice });
      });
    }

    const linksEnabled = pLinksEnabled.checked;
    let linkRows = [];
    if (linksEnabled) {
      linkRowsList.querySelectorAll('.link-row').forEach(row => {
        const label = row.querySelector('.link-label-input').value.trim();
        const url = row.querySelector('.link-url-input').value.trim();
        if (label && url) linkRows.push({ label, url });
      });
    }

    if (!name) return;
    if (!categorySelect) {
      setMsg(msg, 'ກະລຸນາເລືອກໝວດໝູ່ກ່ອນຈຶ່ງຈະເພີ່ມສິນຄ້າໄດ້', 'error');
      return;
    }
    if (durationEnabled && !durationRows.length) {
      setMsg(msg, 'ກະລຸນາເລືອກຢ່າງໜ້ອຍ 1 ໄລຍະເວລາ ແລະ ຕັ້ງລາຄາ', 'error');
      return;
    }
    if (!durationEnabled && document.getElementById('pPrice').value.trim() === '') {
      setMsg(msg, 'ກະລຸນາໃສ່ລາຄາສິນຄ້າ', 'error');
      return;
    }
    if (linksEnabled && !linkRows.length) {
      setMsg(msg, 'ກະລຸນາໃສ່ຢ່າງໜ້ອຍ 1 ລິ້ງ (ຕ້ອງມີທັງຊື່ ແລະ URL)', 'error');
      return;
    }

    setLoading(btn, true);
    setMsg(msg, 'ກຳລັງເພີ່ມສິນຄ້າ...', 'pending');

    let imageUrl = null;
    try {
      if (selectedImageFile) {
        const ext = selectedImageFile.name.split('.').pop();
        const path = `products/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await supabaseClient.storage
          .from('product-images')
          .upload(path, selectedImageFile);
        if (uploadError) throw uploadError;
        const { data: pub } = supabaseClient.storage.from('product-images').getPublicUrl(path);
        imageUrl = pub.publicUrl;
      }

      const { data: newProduct, error: insertError } = await supabaseClient
        .from('products')
        .insert({
          name, category,
          price: durationEnabled ? 0 : price,
          image_url: imageUrl,
          duration_enabled: durationEnabled
        })
        .select()
        .single();
      if (insertError) throw insertError;

      if (durationEnabled && durationRows.length) {
        const rows = durationRows.map((d, i) => ({
          product_id: newProduct.id,
          label: d.label,
          price: d.price,
          sort_order: i
        }));
        const { error: durInsertError } = await supabaseClient.from('product_durations').insert(rows);
        if (durInsertError) throw durInsertError;
      }

      if (linksEnabled && linkRows.length) {
        const linkInsertRows = linkRows.map((l, i) => ({
          product_id: newProduct.id,
          label: l.label,
          url: l.url,
          sort_order: i
        }));
        const { error: linkInsertError } = await supabaseClient.from('product_links').insert(linkInsertRows);
        if (linkInsertError) throw linkInsertError;
      }

      setMsg(msg, 'ເພີ່ມສິນຄ້າສຳເລັດແລ້ວ', 'success');
      addForm.reset();
      pDurationEnabled.checked = false;
      durationOptionsWrap.style.display = 'none';
      basePriceField.style.display = 'block';
      durationOptionsList.querySelectorAll('.dur-price').forEach(inp => { inp.style.display = 'none'; inp.value = ''; });
      pLinksEnabled.checked = false;
      linksOptionsWrap.style.display = 'none';
      linkRowsList.innerHTML = '';
      selectedImageFile = null;
      dropZone.classList.remove('has-image');
      const img = dropZone.querySelector('img');
      if (img) img.remove();
      if (!document.getElementById('dropZoneText')) {
        const span = document.createElement('span');
        span.id = 'dropZoneText';
        span.textContent = 'ແຕະເພື່ອເລືອກຮູບພາບ';
        dropZone.insertBefore(span, imageInput);
      }
      loadProducts();
    } catch (err) {
      console.error(err);
      setMsg(msg, 'ເກີດຂໍ້ຜິດພາດ: ' + (err.message || 'ລອງໃໝ່ອີກຄັ້ງ'), 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  // ---- codes ----
  const codeProductSelect = document.getElementById('codeProductSelect');
  codeProductSelect.addEventListener('change', renderCodeStockStrip);

  const codeDurationSelect = document.getElementById('codeDurationSelect');
  codeDurationSelect.addEventListener('change', renderCodeStockStrip);

  const codesSubmit = document.getElementById('codesSubmit');
  codesSubmit.addEventListener('click', async () => {
    const msg = document.getElementById('codesMsg');
    const textarea = document.getElementById('codesInput');
    const productId = codeProductSelect.value;
    const lines = textarea.value.split('\n').map(l => l.trim()).filter(Boolean);
    const product = currentProducts.find(p => p.id === productId);
    const durationId = product && product.duration_enabled ? codeDurationSelect.value : null;

    if (!productId) { setMsg(msg, 'ກະລຸນາເລືອກສິນຄ້າກ່ອນ', 'error'); return; }
    if (product && product.duration_enabled && !durationId) {
      setMsg(msg, 'ກະລຸນາເລືອກໄລຍະເວລາກ່ອນ (ຫຼືໄປສ້າງຕົວເລືອກໄລຍະເວລາທີ່ແຖບ "ເພີ່ມສິນຄ້າ" ກ່ອນ)', 'error');
      return;
    }
    if (!lines.length) { setMsg(msg, 'ກະລຸນາໃສ່ລະຫັດຢ່າງໜ້ອຍ 1 ລາຍການ', 'error'); return; }

    setLoading(codesSubmit, true);
    setMsg(msg, 'ກຳລັງບັນທຶກລະຫັດ...', 'pending');

    const rows = lines.map(code => ({ product_id: productId, code, duration_id: durationId || null }));
    const { error } = await supabaseClient.from('product_codes').insert(rows);

    setLoading(codesSubmit, false);
    if (error) {
      console.error(error);
      setMsg(msg, 'ເກີດຂໍ້ຜິດພາດ: ' + error.message, 'error');
      return;
    }
    setMsg(msg, `ເພີ່ມລະຫັດສຳເລັດ ${lines.length} ລາຍການ`, 'success');
    textarea.value = '';
    loadProducts();
  });

  // ---- top-up requests ----
  const topupRefreshBtn = document.getElementById('topupRefreshBtn');
  if (topupRefreshBtn) topupRefreshBtn.addEventListener('click', loadTopupRequests);

  // ---- reseller / agent ----
  const agentCreateKeyBtn = document.getElementById('agentCreateKeyBtn');
  if (agentCreateKeyBtn) agentCreateKeyBtn.addEventListener('click', createResellerKey);

  const agentKeysRefreshBtn = document.getElementById('agentKeysRefreshBtn');
  if (agentKeysRefreshBtn) agentKeysRefreshBtn.addEventListener('click', loadResellerKeys);

  const agentAccountsRefreshBtn = document.getElementById('agentAccountsRefreshBtn');
  if (agentAccountsRefreshBtn) agentAccountsRefreshBtn.addEventListener('click', loadAgentAccounts);

  const agentAccountsSearch = document.getElementById('agentAccountsSearch');
  if (agentAccountsSearch) {
    agentAccountsSearch.addEventListener('input', (e) => {
      agentAccountsSearchTerm = e.target.value;
      renderAgentAccounts(currentAgentAccounts);
    });
  }

  const slipLightbox = document.getElementById('slipLightbox');
  const slipLightboxClose = document.getElementById('slipLightboxClose');
  if (slipLightboxClose) slipLightboxClose.addEventListener('click', closeSlipLightbox);
  if (slipLightbox) {
    slipLightbox.addEventListener('click', (e) => {
      if (e.target === slipLightbox) closeSlipLightbox();
    });
  }

  initSiteSettingsPanel();

  await loadSiteSettingsAdmin();
  await loadProducts();
  await loadTopupRequests();
  await loadResellerTiers();
  await loadResellerKeys();
}

// ============================================
// ພາກ 3: ເລີ່ມຕົ້ນເມື່ອໂຫຼດໜ້າ
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  const discordBtn = document.getElementById('discordLoginBtn');
  if (discordBtn) discordBtn.addEventListener('click', goToDiscordLogin);

  const deniedLogoutBtn = document.getElementById('deniedLogoutBtn');
  if (deniedLogoutBtn) deniedLogoutBtn.addEventListener('click', logout);

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => { window.location.href = 'index.html'; });

  checkAuthAndInit();
});
