/* =========================================================
   customers-admin.js — แผง "ຈັດການລູກຄ້າ" ในห้องแอดมิน (admin.html > #panelCustomers)
   ดูยอดเงินลูกค้าทุกคน / เพิ่ม-หักยอด (พร้อมเหตุผล + ประวัติ) / แบน-ปลดแบน / ลบบัญชี
   - เรียก /api/admin/customers/* ของ Worker เท่านั้น (Worker ตรวจสิทธิ์แอดมิน + ทำงานกับฐานข้อมูลแบบ atomic)
   - ถูกเรียกจาก initAdminPanel() ใน admin.js ผ่าน window.initCustomersPanel
   ========================================================= */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => (typeof escapeHtmlAdmin === 'function'
    ? escapeHtmlAdmin(s)
    : String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US').replace(/,/g, '.');
  const kip = (n) => '₭ ' + fmt(n);
  const toast = (t) => { if (typeof showToast === 'function') showToast(t); };
  const LIMIT = 30;
  const STATUS = { approved: 'ອະນຸມັດ', rejected: 'ປະຕິເສດ', pending: 'ລໍຖ້າ', completed: 'ສຳເລັດ' };

  let items = [], total = 0, q = '', loading = false, bound = false, searchTimer = null, reqSeq = 0;
  const byId = () => Object.fromEntries(items.map((x) => [x.user_id, x]));

  async function api(path, body) {
    const opt = { credentials: 'same-origin', cache: 'no-store' };
    if (body) { opt.method = 'POST'; opt.headers = { 'content-type': 'application/json' }; opt.body = JSON.stringify(body); }
    let res;
    try { res = await fetch('/api/admin/customers' + path, opt); } catch { throw new Error('ເຊື່ອມຕໍ່ບໍ່ໄດ້ — ກວດເນັດແລ້ວລອງໃໝ່'); }
    let d = null;
    try { d = await res.json(); } catch { /* ignore */ }
    if (!res.ok || !d || d.ok === false) throw new Error((d && d.error) || ('ຜິດພາດ ' + res.status));
    return d;
  }

  const dateTxt = (iso) => {
    const t = Date.parse(iso); if (!Number.isFinite(t)) return '-';
    const d = new Date(t + 7 * 3600 * 1000), p = (n) => String(n).padStart(2, '0');
    return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  };

  /* ---------- รายการลูกค้า ---------- */
  function cardHtml(u) {
    const name = u.email || u.username || u.user_id;
    return `<div class="cu-card${u.banned ? ' is-banned' : ''}" data-id="${esc(u.user_id)}">
      <button type="button" class="cu-top" data-act="toggle">
        <span class="cu-who"><b>${esc(name)}</b><small>${esc(u.user_id)}</small></span>
        <span class="cu-bal">${kip(u.balance)}</span>
      </button>
      <div class="cu-chips">
        <span>ເຕີມສະສົມ ${kip(u.total_topup)}</span><span>ອໍເດີ ${fmt(u.orders_count)}</span>
        ${u.banned ? '<span class="cu-tag bad">ຖືກແບນ</span>' : ''}${u.is_admin ? '<span class="cu-tag adm">ແອດມິນ</span>' : ''}
      </div>
      <div class="cu-detail" hidden></div>
    </div>`;
  }

  function renderList() {
    const list = $('cuList');
    if (!items.length) { list.innerHTML = `<div class="empty-note">${loading ? 'ກຳລັງໂຫຼດ...' : 'ບໍ່ພົບລູກຄ້າ'}</div>`; }
    else {
      // รักษาการ์ดที่เปิดอยู่ไว้ ไม่ให้ฟอร์มที่กำลังกรอกหาย
      const open = list.querySelector('.cu-card.open');
      const openId = open && open.dataset.id;
      const keep = open ? open.querySelector('.cu-detail') : null;
      list.innerHTML = items.map(cardHtml).join('');
      if (openId && keep) {
        const nc = [...list.querySelectorAll('.cu-card')].find((c) => c.dataset.id === openId);
        if (nc) { nc.classList.add('open'); const d = nc.querySelector('.cu-detail'); d.replaceWith(keep); }
      }
    }
    $('cuMore').classList.toggle('u-hidden', items.length >= total);
    $('cuSum').textContent = total ? `ທັງໝົດ ${fmt(total)} ບັນຊີ` + (q ? ` (ຄົ້ນຫາ: ${q})` : '') : '';
    const b = $('d2BadgeCustomers'); if (b && !q && total) b.textContent = fmt(total);
  }

  async function load(reset) {
    if (loading) return;
    loading = true;
    const seq = ++reqSeq;
    if (reset) { items = []; renderList(); }
    try {
      const d = await api(`?q=${encodeURIComponent(q)}&limit=${LIMIT}&offset=${reset ? 0 : items.length}`);
      if (seq !== reqSeq) return;
      items = reset ? d.items : items.concat(d.items);
      total = d.total;
    } catch (e) {
      if (seq === reqSeq) $('cuList').innerHTML = `<div class="empty-note">${esc(e.message)}</div>`;
      loading = false; return;
    }
    loading = false;
    renderList();
  }

  /* ---------- รายละเอียด + ฟอร์ม ---------- */
  function detailShell(u) {
    return `
      <div class="cu-sec">
        <div class="cu-seg" data-mode="add">
          <button type="button" class="on" data-mode="add">+ ເພີ່ມເງິນ</button>
          <button type="button" data-mode="sub">− ຫັກເງິນ</button>
        </div>
        <div class="gx-input-wrap"><input class="cu-amt" inputmode="numeric" autocomplete="off" placeholder="ຈຳນວນເງິນ (ກີບ)"></div>
        <div class="cu-quick">${[10000, 50000, 100000, 500000, 1000000].map((v) => `<button type="button" data-q="${v}">${fmt(v)}</button>`).join('')}</div>
        <div class="gx-input-wrap"><input class="cu-reason" maxlength="300" placeholder="ເຫດຜົນ (ບັນທຶກໄວ້ໃນປະຫວັດ)"></div>
        <button type="button" class="topup-btn approve cu-go" data-act="adjust">ຢືນຢັນເພີ່ມເງິນ</button>
        <div class="cu-msg"></div>
      </div>
      <div class="cu-sec cu-actions">
        <button type="button" class="topup-btn ${u.banned ? 'approve' : 'reject'}" data-act="ban">${u.banned ? 'ປົດແບນ' : 'ແບນບັນຊີ'}</button>
        ${u.is_admin ? '' : '<button type="button" class="topup-btn reject" data-act="del-ask">ລຶບບັນຊີ</button>'}
      </div>
      <div class="cu-del" hidden>
        <p>ລຶບບັນຊີນີ້ຖາວອນ — ກູ້ຄືນບໍ່ໄດ້</p>
        <label><input type="checkbox" class="cu-del-hist"> ລຶບປະຫວັດອໍເດີ ແລະ ເຕີມເງິນນຳ</label>
        <label><input type="checkbox" class="cu-del-ban" checked> ແບນບໍ່ໃຫ້ກັບມາໃຊ້ໄດ້ອີກ</label>
        <div class="cu-actions">
          <button type="button" class="topup-btn reject" data-act="del-go">ຢືນຢັນລຶບ</button>
          <button type="button" class="topup-btn" data-act="del-cancel">ຍົກເລີກ</button>
        </div>
      </div>
      <div class="cu-hist"><div class="empty-note">ກຳລັງໂຫຼດປະຫວັດ...</div></div>`;
  }

  function histHtml(d) {
    const sec = (title, rows, fn) => `<details class="cu-h"><summary>${title} (${rows.length})</summary>${rows.length ? rows.map(fn).join('') : '<div class="empty-note">ບໍ່ມີ</div>'}</details>`;
    return (d.ban ? `<div class="cu-banbox">ຖືກແບນ${d.ban.reason ? ': ' + esc(d.ban.reason) : ''} <small>(${esc(d.ban.banned_by || '')} · ${dateTxt(d.ban.created_at)})</small></div>` : '') +
      sec('ປະຫວັດປັບຍອດໂດຍແອດມິນ', d.adjustments, (r) => `<div class="cu-row"><span class="${Number(r.delta) > 0 ? 'pos' : 'neg'}">${Number(r.delta) > 0 ? '+' : '−'}${kip(Math.abs(r.delta))}</span><small>${fmt(r.balance_before)} → ${fmt(r.balance_after)} · ${esc(r.reason || '-')} · ${esc(r.admin_email || '')} · ${dateTxt(r.created_at)}</small></div>`) +
      sec('ປະຫວັດເຕີມເງິນ', d.topups, (r) => `<div class="cu-row"><span>${kip(r.amount)}</span><small>${esc(STATUS[r.status] || r.status)} · ${esc(r.ref_no || '')} · ${dateTxt(r.created_at)}</small></div>`) +
      sec('ອໍເດີຫຼ້າສຸດ', d.orders, (r) => `<div class="cu-row"><span>${esc(r.product_name)}${r.duration_label ? ' · ' + esc(r.duration_label) : ''}</span><small>${kip(r.price)} · ${esc(STATUS[r.status] || r.status)} · ${dateTxt(r.created_at)}</small></div>`);
  }

  async function loadDetail(card) {
    const id = card.dataset.id, box = card.querySelector('.cu-hist');
    try {
      const d = await api('/detail?user_id=' + encodeURIComponent(id));
      box.innerHTML = histHtml(d);
      const u = byId()[id]; if (u && u.balance !== d.balance) { u.balance = d.balance; card.querySelector('.cu-bal').textContent = kip(d.balance); }
    } catch (e) { box.innerHTML = `<div class="empty-note">${esc(e.message)}</div>`; }
  }

  function setMsg(card, text, ok) {
    const m = card.querySelector('.cu-msg'); m.textContent = text || ''; m.className = 'cu-msg' + (text ? (ok ? ' ok' : ' err') : '');
  }

  async function doAdjust(card, btn) {
    const u = byId()[card.dataset.id]; if (!u) return;
    const mode = card.querySelector('.cu-seg').dataset.mode;
    const amount = parseInt(card.querySelector('.cu-amt').value.replace(/\D/g, ''), 10) || 0;
    const reason = card.querySelector('.cu-reason').value.trim();
    if (amount <= 0) { setMsg(card, 'ໃສ່ຈຳນວນເງິນກ່ອນ', false); return; }
    const label = (mode === 'sub' ? 'ຫັກ' : 'ເພີ່ມ') + ` ${kip(amount)} ${mode === 'sub' ? 'ຈາກ' : 'ໃຫ້'} ${u.email || u.user_id} ?`;
    if (!window.confirm(label)) return;
    btn.disabled = true; setMsg(card, 'ກຳລັງບັນທຶກ...', true);
    try {
      const d = await api('/adjust', { user_id: u.user_id, email: u.email, amount, mode, reason });
      u.balance = d.balance_after;
      card.querySelector('.cu-bal').textContent = kip(d.balance_after);
      card.querySelector('.cu-amt').value = ''; card.querySelector('.cu-reason').value = '';
      setMsg(card, `ສຳເລັດ: ${kip(d.balance_before)} → ${kip(d.balance_after)}`, true);
      toast('ປັບຍອດເງິນສຳເລັດ');
      loadDetail(card);
    } catch (e) { setMsg(card, e.message, false); }
    btn.disabled = false;
  }

  async function doBan(card, btn) {
    const u = byId()[card.dataset.id]; if (!u) return;
    const ban = !u.banned;
    let reason = '';
    if (ban) {
      reason = window.prompt(`ແບນ ${u.email || u.user_id}\nເຫດຜົນ (ບໍ່ບັງຄັບ):`, '');
      if (reason === null) return;
    } else if (!window.confirm('ປົດແບນບັນຊີນີ້?')) return;
    btn.disabled = true;
    try {
      await api('/ban', { user_id: u.user_id, email: u.email, banned: ban, reason });
      u.banned = ban; toast(ban ? 'ແບນບັນຊີແລ້ວ' : 'ປົດແບນແລ້ວ');
      const open = card.querySelector('.cu-detail');
      card.classList.toggle('is-banned', ban);
      const chips = card.querySelector('.cu-chips');
      chips.querySelectorAll('.cu-tag.bad').forEach((x) => x.remove());
      if (ban) chips.insertAdjacentHTML('beforeend', '<span class="cu-tag bad">ຖືກແບນ</span>');
      btn.textContent = ban ? 'ປົດແບນ' : 'ແບນບັນຊີ'; btn.className = 'topup-btn ' + (ban ? 'approve' : 'reject');
      if (open) loadDetail(card);
    } catch (e) { setMsg(card, e.message, false); toast(e.message); }
    btn.disabled = false;
  }

  async function doDelete(card, btn) {
    const u = byId()[card.dataset.id]; if (!u) return;
    btn.disabled = true;
    try {
      await api('/delete', {
        user_id: u.user_id, email: u.email,
        delete_history: card.querySelector('.cu-del-hist').checked,
        also_ban: card.querySelector('.cu-del-ban').checked,
      });
      toast('ລຶບບັນຊີແລ້ວ');
      items = items.filter((x) => x.user_id !== u.user_id); total = Math.max(0, total - 1);
      renderList();
    } catch (e) { setMsg(card, e.message, false); toast(e.message); btn.disabled = false; }
  }

  /* ---------- events ---------- */
  function onClick(e) {
    const card = e.target.closest('.cu-card'); if (!card) return;
    const b = e.target.closest('button'); if (!b) return;
    const det = card.querySelector('.cu-detail');
    if (b.dataset.act === 'toggle') {
      const open = !card.classList.contains('open');
      document.querySelectorAll('#cuList .cu-card.open').forEach((c) => { if (c !== card) { c.classList.remove('open'); c.querySelector('.cu-detail').hidden = true; } });
      card.classList.toggle('open', open); det.hidden = !open;
      if (open && !det.dataset.ready) { det.dataset.ready = '1'; det.innerHTML = detailShell(byId()[card.dataset.id]); loadDetail(card); }
      else if (open) loadDetail(card);
      if (open && typeof syncSwitchHeight === 'function') setTimeout(() => document.querySelectorAll('.switch[data-target]').forEach(syncSwitchHeight), 30);
      return;
    }
    if (b.dataset.mode) {
      const seg = card.querySelector('.cu-seg'); seg.dataset.mode = b.dataset.mode;
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      const go = card.querySelector('.cu-go'); go.textContent = b.dataset.mode === 'sub' ? 'ຢືນຢັນຫັກເງິນ' : 'ຢືນຢັນເພີ່ມເງິນ';
      go.classList.toggle('approve', b.dataset.mode !== 'sub'); go.classList.toggle('reject', b.dataset.mode === 'sub');
      return;
    }
    if (b.dataset.q) { const i = card.querySelector('.cu-amt'); i.value = fmt((parseInt(i.value.replace(/\D/g, ''), 10) || 0) + Number(b.dataset.q)); return; }
    if (b.dataset.act === 'adjust') return doAdjust(card, b);
    if (b.dataset.act === 'ban') return doBan(card, b);
    if (b.dataset.act === 'del-ask') { card.querySelector('.cu-del').hidden = false; return; }
    if (b.dataset.act === 'del-cancel') { card.querySelector('.cu-del').hidden = true; return; }
    if (b.dataset.act === 'del-go') return doDelete(card, b);
  }

  function bind() {
    if (bound || !$('cuList')) return; bound = true;
    $('cuList').addEventListener('click', onClick);
    $('cuList').addEventListener('input', (e) => {
      if (e.target.classList.contains('cu-amt')) { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); e.target.value = n ? fmt(n) : ''; }
    });
    $('cuSearch').addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { q = $('cuSearch').value.trim(); load(true); }, 350);
    });
    $('cuMore').addEventListener('click', () => load(false));
    $('cuRefresh').addEventListener('click', () => load(true));
  }

  window.initCustomersPanel = function initCustomersPanel() { bind(); load(true); };
})();
