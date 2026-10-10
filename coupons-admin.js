/* =========================================================
   coupons-admin.js — แผง "โค้ดส่วนลด" ในห้องแอดมิน (admin.html > #panelCoupons)
   สร้าง/เปิด-ปิด/ลบโค้ด + ดูจำนวนบัญชีที่ใช้แล้ว ต่อโค้ด
   - อ่าน/เขียนตาราง coupons และ view coupon_stats ผ่าน supabaseClient (-> Worker proxy
     /api/admin/supabase/* ที่เช็คสิทธิ์แอดมินและใส่ service_role ให้ — ตารางนี้ถูก revoke จาก anon/authenticated แล้ว)
   - การคิดส่วนลด/นับสิทธิ์ตอนลูกค้าซื้อจริง อยู่ที่ฟังก์ชัน purchase_product (SQL) ไม่ใช่ที่นี่
   - ถูกเรียกจาก initAdminPanel() ใน admin.js (หลังตรวจสิทธิ์แอดมินผ่านแล้วเท่านั้น)
   ========================================================= */
(function () {
  const $ = (id) => document.getElementById(id);
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n) => Math.round(n).toLocaleString('en-US').replace(/,/g, '.');
  const kip = (n) => '₭ ' + fmt(n);
  const esc = (s) => (typeof escapeHtmlAdmin === 'function'
    ? escapeHtmlAdmin(s)
    : String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const ic = (n, c) => `<svg class="cpa-i ${c || ''}"><use href="#cpa-${n}"/></svg>`;
  const num = (id) => parseInt(String($(id).value).replace(/\D/g, ''), 10) || 0;
  const toast = (t) => { if (typeof showToast === 'function') showToast(t); };

  let type = 'percent';
  let expDays = 0;
  let last = {};
  let coupons = [];
  let freshCode = null;
  let bound = false;
  let creating = false;

  /* ---------- helpers (อนิเมชัน) ---------- */
  function tween(el, to, f, ms) {
    f = f || fmt; ms = ms || 600;
    if (reduce) { el.textContent = f(to); el._v = to; return; }
    const from = el._v == null ? to : el._v;
    el._v = to;
    const t0 = performance.now();
    cancelAnimationFrame(el._r);
    (function s(n) {
      const k = Math.min(1, (n - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = f(from + (to - from) * e);
      if (k < 1) el._r = requestAnimationFrame(s);
    })(t0);
  }
  function ripple(btn, ev) {
    if (reduce) return;
    const r = btn.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, s = document.createElement('span');
    s.className = 'cpa-rp';
    s.style.cssText = `width:${d}px;height:${d}px;left:${(ev.clientX || r.left + r.width / 2) - r.left - d / 2}px;top:${(ev.clientY || r.top + r.height / 2) - r.top - d / 2}px`;
    btn.appendChild(s);
    setTimeout(() => s.remove(), 600);
  }
  function burst(el, n, cols) {
    if (reduce) return;
    n = n || 34; cols = cols || ['#2ecc71', '#ff0001', '#fff', '#ffd54a', '#6dffb0'];
    const r = el.getBoundingClientRect(), h = document.createElement('div');
    h.className = 'cpa-fx';
    h.style.left = r.left + r.width / 2 + 'px';
    h.style.top = r.top + r.height / 2 + 'px';
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 2 * i / n + Math.random() * 0.5, d = 60 + Math.random() * 110, p = document.createElement('i');
      if (i % 3 === 0) p.className = 'o';
      p.style.cssText = `--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d * 0.9 - 30 + Math.random() * 50}px;--r:${Math.random() * 720 - 360}deg;--c:${cols[i % cols.length]};animation-delay:${Math.random() * 0.1}s`;
      h.appendChild(p);
    }
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 1400);
  }
  function bumpEl(el) { el.classList.remove('cpa-bump'); void el.offsetWidth; el.classList.add('cpa-bump'); }
  const vib = (p) => { if (navigator.vibrate) navigator.vibrate(p); };

  /* ---------- ฟอร์มสร้างโค้ด ---------- */
  function upd() {
    const v = num('cpaVal'), acc = num('cpaAcc'), per = Math.max(1, num('cpaPer'));
    const base = 30000, off = type === 'percent' ? Math.round(base * Math.min(v, 100) / 100) : Math.min(v, base);
    if (v) {
      if (!$('cpaPNew')) $('cpaPrev').innerHTML = `ຕົວຢ່າງ ສິນຄ້າ <s>${kip(base)}</s>${ic('arrow')}<b id="cpaPNew"></b><span id="cpaPOff"></span>`;
      tween($('cpaPNew'), base - off, kip, 500);
      $('cpaPOff').textContent = ` (ລົດ ${kip(off)})`;
    } else {
      $('cpaPrev').textContent = 'ໃສ່ຕົວເລກເພື່ອເບິ່ງຕົວຢ່າງລາຄາ';
    }
    $('cpaVal').placeholder = type === 'percent' ? '10' : '5000';
    $('cpaAccHint').textContent = acc ? '' : 'ບໍ່ຈຳກັດ';
    document.querySelectorAll('#cpaAccChips button').forEach((b) => b.classList.toggle('on', +b.dataset.v === acc));
    const parts = {
      code: $('cpaCode').value || '—',
      off: v ? (type === 'percent' ? v + '%' : kip(v)) : '—',
      acc: acc ? String(acc) : '∞',
      per: String(per),
      tot: acc ? fmt(acc * per) : '∞',
      exp: expDays ? expDays + ' ວັນ' : 'ບໍ່ໝົດອາຍຸ',
    };
    const w = (k) => `<b class="${last[k] !== undefined && last[k] !== parts[k] ? 'pop' : ''}">${esc(parts[k])}</b>`;
    $('cpaSum').innerHTML = `ໂຄ້ດ <b class="cpa-en ${last.code !== undefined && last.code !== parts.code ? 'pop' : ''}">${esc(parts.code)}</b> ລົດ ${w('off')} ຕໍ່ອັນ<br>` +
      (acc ? `ໃຊ້ໄດ້ ${w('acc')} ບັນຊີ · ບັນຊີລະ ${w('per')} ຄັ້ງ → ສູງສຸດລວມ <em>${esc(parts.tot)}</em> ຄັ້ງ`
           : `ບໍ່ຈຳກັດຈຳນວນບັນຊີ · ບັນຊີລະ ${w('per')} ຄັ້ງ`) + `<br>${w('exp')}`;
    last = parts;
  }
  function bad(id, msg) {
    const el = $(id);
    el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad');
    $('cpaErrTxt').textContent = msg;
    $('cpaErr').classList.add('show');
    el.focus();
    vib(50);
  }

  async function submitCreate(e) {
    e.preventDefault();
    if (creating) return;
    $('cpaErr').classList.remove('show');
    const code = $('cpaCode').value.trim(), v = num('cpaVal'), per = num('cpaPer'), acc = num('cpaAcc');
    if (!/^[A-Z0-9_-]{2,32}$/.test(code)) return bad('cpaCode', 'ຊື່ໂຄ້ດຕ້ອງມີ 2-32 ຕົວ (A-Z 0-9 _ -)');
    if (coupons.some((c) => c.code === code)) return bad('cpaCode', 'ມີໂຄ້ດນີ້ຢູ່ແລ້ວ');
    if (!v) return bad('cpaVal', 'ກະລຸນາໃສ່ຈຳນວນສ່ວນຫຼຸດ');
    if (type === 'percent' && v > 100) return bad('cpaVal', 'ເປີເຊັນຕ້ອງບໍ່ເກີນ 100');
    if (per < 1) return bad('cpaPer', 'ຕ້ອງໃຊ້ໄດ້ຢ່າງໜ້ອຍ 1 ຄັ້ງ');

    creating = true;
    const btn = $('cpaCreate');
    btn.disabled = true;
    const row = {
      code, type, value: v,
      max_accounts: acc > 0 ? acc : null,
      uses_per_account: per,
      expires_at: expDays ? new Date(Date.now() + expDays * 86400000).toISOString() : null,
      active: true,
    };
    const { error } = await supabaseClient.from('coupons').insert(row);
    creating = false;
    btn.disabled = false;
    if (error) {
      console.error('coupons insert failed:', error);
      const dup = error.code === '23505' || /duplicate key/i.test(error.message || '');
      return bad('cpaCode', dup ? 'ມີໂຄ້ດນີ້ຢູ່ແລ້ວ' : 'ສ້າງໂຄ້ດບໍ່ສຳເລັດ: ' + (error.message || 'ລອງໃໝ່ພາຍຫຼັງ'));
    }

    btn.classList.add('done');
    $('cpaCreateTxt').textContent = 'ສ້າງແລ້ວ';
    burst(btn);
    vib([20, 40, 20]);
    setTimeout(() => { btn.classList.remove('done'); $('cpaCreateTxt').textContent = 'ສ້າງໂຄ້ດ'; }, 1500);
    $('cpaCode').value = ''; $('cpaVal').value = ''; last = {}; upd();
    freshCode = code;
    toast('ສ້າງໂຄ້ດ ' + code + ' ແລ້ວ');
    await loadCoupons();
    const list = $('cpaList');
    if (list) list.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }

  /* ---------- รายการโค้ด ---------- */
  const isExpired = (c) => !!(c.expires_at && new Date(c.expires_at).getTime() <= Date.now());
  const isFull = (c) => !!(c.max_accounts && c.accounts_used >= c.max_accounts);
  const pctOf = (c) => (c.max_accounts ? Math.min(100, c.accounts_used / c.max_accounts * 100) : Math.min(100, c.accounts_used * 2));
  const fmtDate = (d) => new Date(d).toLocaleString('lo-LA');

  function metaHtml(c) {
    const expTxt = c.expires_at ? (isExpired(c) ? 'ໝົດອາຍຸແລ້ວ' : 'ໝົດອາຍຸ ' + fmtDate(c.expires_at)) : 'ບໍ່ໝົດອາຍຸ';
    return `<span>${ic('repeat')}ບັນຊີລະ ${c.uses_per_account} ຄັ້ງ</span>` +
      `<span>${ic('check')}ໃຊ້ແລ້ວລວມ ${c.total_uses} ຄັ້ງ</span>` +
      `<span class="${isExpired(c) ? 'ex' : ''}">${ic('clock')}${esc(expTxt)}</span>` +
      (isFull(c) ? `<span class="gd">${ic('crown')}ບັນຊີເຕັມແລ້ວ</span>` : '');
  }
  function cardHtml(c) {
    const full = isFull(c), off = !c.active || isExpired(c);
    return `<div class="cpa-cp ${c.code === freshCode ? 'new' : ''} ${off ? 'off' : ''} ${full ? 'full' : ''}" data-code="${esc(c.code)}">
      <div class="cpa-top"><span class="cpa-ico">${ic('ticket')}</span>
        <div class="cpa-code"><b class="cpa-en">${esc(c.code)}</b><small>${ic(c.type === 'percent' ? 'percent' : 'coin')}ລົດ ${c.type === 'percent' ? esc(c.value) + '%' : kip(c.value)} ຕໍ່ອັນ</small></div>
        <button class="cpa-tg ${c.active ? 'on' : ''}" data-a="tg" type="button" aria-label="ເປີດ/ປິດ"></button></div>
      <div class="cpa-body">
        <div class="cpa-m"><span>ບັນຊີທີ່ໃຊ້ແລ້ວ</span><b><span data-n>0</span>${c.max_accounts ? ' / ' + c.max_accounts : ' (ບໍ່ຈຳກັດ)'}</b></div>
        <div class="cpa-bar"><i class="${full ? 'full' : ''}" data-w="${pctOf(c)}"></i></div>
        <div class="cpa-meta">${metaHtml(c)}</div>
        <div class="cpa-act"><button class="cpb" data-a="copy" type="button">${ic('copy')}<span>ຄັດລອກ</span></button><button class="del" data-a="del" type="button" aria-label="ລຶບ">${ic('trash')}</button></div>
      </div></div>`;
  }
  function renderOps() {
    const el = $('cpaOps');
    if (!el) return;
    const active = coupons.filter((c) => c.active && !isExpired(c)).length;
    const uses = coupons.reduce((a, c) => a + c.total_uses, 0);
    el.innerHTML = `<div class="ops-chip"><div class="ops-num">${coupons.length}</div><div class="ops-label">ໂຄ້ດທັງໝົດ</div></div>
      <div class="ops-chip"><div class="ops-num">${active}</div><div class="ops-label">ເປີດໃຊ້ຢູ່</div></div>
      <div class="ops-chip"><div class="ops-num">${uses}</div><div class="ops-label">ໃຊ້ແລ້ວລວມ (ຄັ້ງ)</div></div>`;
    const badge = $('d2BadgeCoupons');
    if (badge) badge.textContent = active + ' ເປີດໃຊ້';
  }
  function render() {
    const list = $('cpaList');
    $('cpaCount').textContent = coupons.length ? coupons.length + ' ໂຄ້ດ' : '';
    renderOps();
    if (!coupons.length) { list.innerHTML = '<div class="cpa-empty">ຍັງບໍ່ມີໂຄ້ດ — ສ້າງໂຄ້ດທຳອິດດ້ານເທິງ</div>'; return; }
    list.innerHTML = coupons.map(cardHtml).join('');
    freshCode = null;
    list.querySelectorAll('.cpa-cp').forEach((el) => {
      const c = coupons.find((x) => x.code === el.dataset.code), nEl = el.querySelector('[data-n]');
      if (c && nEl) { nEl._v = 0; tween(nEl, c.accounts_used, fmt, 1000); }
    });
    requestAnimationFrame(() => requestAnimationFrame(() => list.querySelectorAll('.cpa-bar i').forEach((i) => { i.style.width = i.dataset.w + '%'; })));
  }

  async function loadCoupons() {
    const btn = $('cpaRefresh');
    if (btn) btn.classList.add('spinning');
    const [cRes, sRes] = await Promise.all([
      supabaseClient.from('coupons').select('*').order('created_at', { ascending: false }).limit(500),
      supabaseClient.from('coupon_stats').select('*'),
    ]);
    if (btn) setTimeout(() => btn.classList.remove('spinning'), 400);
    if (cRes.error) {
      console.error('coupons select failed:', cRes.error);
      $('cpaList').innerHTML = '<div class="cpa-empty">ໂຫຼດຂໍ້ມູນຜິດພາດ — ກວດວ່າໄດ້ແລ່ນ MIGRATION_coupons_system ໃນ Supabase ແລ້ວ</div>';
      return;
    }
    if (sRes.error) console.error('coupon_stats select failed:', sRes.error);
    const stats = {};
    (sRes.data || []).forEach((r) => { stats[r.code] = r; });
    coupons = (cRes.data || []).map((c) => ({
      ...c,
      value: Number(c.value),
      accounts_used: stats[c.code] ? Number(stats[c.code].accounts_used) : 0,
      total_uses: stats[c.code] ? Number(stats[c.code].total_uses) : 0,
    }));
    render();
  }

  async function onListClick(e) {
    const b = e.target.closest('button[data-a]');
    if (!b) return;
    const el = b.closest('.cpa-cp');
    const c = coupons.find((x) => x.code === el.dataset.code);
    if (!c) return;

    if (b.dataset.a === 'tg') {
      b.disabled = true;
      const next = !c.active;
      const { error } = await supabaseClient.from('coupons').update({ active: next }).eq('code', c.code);
      b.disabled = false;
      if (error) { console.error(error); toast('ປ່ຽນສະຖານະບໍ່ສຳເລັດ: ' + error.message); return; }
      c.active = next;
      b.classList.toggle('on', next);
      el.classList.toggle('off', !next || isExpired(c));
      renderOps();
      toast(next ? 'ເປີດໃຊ້ໂຄ້ດແລ້ວ' : 'ປິດໂຄ້ດແລ້ວ');
      vib(10);
    }

    if (b.dataset.a === 'copy') {
      try { if (navigator.clipboard) await navigator.clipboard.writeText(c.code); } catch (err) { /* ignore */ }
      b.classList.add('ok');
      b.innerHTML = ic('check') + '<span>ຄັດລອກແລ້ວ</span>';
      setTimeout(() => { b.classList.remove('ok'); b.innerHTML = ic('copy') + '<span>ຄັດລອກ</span>'; }, 1500);
    }

    if (b.dataset.a === 'del') {
      // ກົດ 2 ຄັ້ງເພື່ອລຶບ (ກັນກົດຜິດ) — ການລຶບໂຄ້ດຈະລຶບປະຫວັດການໃຊ້ (coupon_redemptions) ຂອງໂຄ້ດນັ້ນນຳ
      if (!b.classList.contains('sure')) {
        b.classList.add('sure');
        b.innerHTML = 'ຢືນຢັນລຶບ?';
        clearTimeout(b._t);
        b._t = setTimeout(() => { b.classList.remove('sure'); b.innerHTML = ic('trash'); }, 3000);
        return;
      }
      clearTimeout(b._t);
      b.disabled = true;
      const { error } = await supabaseClient.from('coupons').delete().eq('code', c.code);
      if (error) { b.disabled = false; console.error(error); toast('ລຶບບໍ່ສຳເລັດ: ' + error.message); return; }
      el.classList.add('rm');
      setTimeout(() => el.classList.add('gone'), 420);
      setTimeout(() => {
        coupons = coupons.filter((x) => x !== c);
        el.remove();
        $('cpaCount').textContent = coupons.length ? coupons.length + ' ໂຄ້ດ' : '';
        renderOps();
        if (!coupons.length) render();
      }, 720);
      toast('ລຶບໂຄ້ດ ' + c.code + ' ແລ້ວ');
    }
  }

  /* ---------- ผูกอีเวนต์ (ครั้งเดียว) ---------- */
  function bind() {
    if (bound || !$('cpaForm')) return;
    bound = true;

    $('cpaSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.dataset.t === type) return;
      type = b.dataset.t;
      $('cpaSeg').classList.toggle('is-fixed', type === 'fixed');
      document.querySelectorAll('#cpaSeg button').forEach((x) => x.classList.toggle('on', x === b));
      const u = $('cpaUnit');
      u.textContent = type === 'percent' ? '%' : '₭';
      u.classList.remove('sw'); void u.offsetWidth; u.classList.add('sw');
      upd();
    });
    $('cpaCode').addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase();
      upd();
    });
    ['cpaVal', 'cpaAcc', 'cpaPer'].forEach((id) => $(id).addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
      upd();
    }));
    ['cpaCode', 'cpaVal', 'cpaPer'].forEach((id) => $(id).addEventListener('input', () => $('cpaErr').classList.remove('show')));
    document.querySelectorAll('#cpaForm .cpa-step button').forEach((b) => b.addEventListener('click', (ev) => {
      ripple(b, ev);
      const key = b.dataset.k, el = $(key === 'acc' ? 'cpaAcc' : 'cpaPer'), min = key === 'per' ? 1 : 0;
      el.value = Math.max(min, (parseInt(el.value, 10) || 0) + Number(b.dataset.d));
      bumpEl(el); upd(); vib(8);
    }));
    $('cpaAccChips').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) { $('cpaAcc').value = b.dataset.v; bumpEl($('cpaAcc')); upd(); }
    });
    $('cpaExpChips').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      expDays = +b.dataset.v;
      document.querySelectorAll('#cpaExpChips button').forEach((x) => x.classList.toggle('on', x === b));
      upd();
    });
    $('cpaRand').addEventListener('click', () => { // สุ่มแบบสล็อต: ตัวอักษรหมุนก่อนจะนิ่ง
      const b = $('cpaRand');
      b.classList.remove('roll'); void b.offsetWidth; b.classList.add('roll');
      const words = ['KING', 'MASH', 'FIRE', 'VIP', 'HOT', 'GOLD', 'NEO', 'LUCKY'];
      const fin = words[Math.floor(Math.random() * words.length)] + Math.floor(Math.random() * 90 + 10);
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
      let t = 0;
      const f = () => {
        const lock = Math.floor(t / 3);
        $('cpaCode').value = fin.slice(0, lock) + Array.from({ length: fin.length - lock }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        upd();
        if (lock < fin.length) { t++; setTimeout(f, 45); } else { $('cpaCode').value = fin; upd(); bumpEl($('cpaCode')); }
      };
      f();
    });
    $('cpaForm').addEventListener('submit', submitCreate);
    $('cpaList').addEventListener('click', onListClick);
    $('cpaRefresh').addEventListener('click', loadCoupons);
  }

  // เรียกจาก initAdminPanel() ใน admin.js
  window.initCouponsPanel = function initCouponsPanel() {
    bind();
    upd();
    loadCoupons();
  };
})();
