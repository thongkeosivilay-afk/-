/* =========================================================
   daily-sales-admin.js — ການ໌ດ "ຍອດຂາຍມື້ນີ້" ໃນໜ້າສະຫຼຸບ (admin.html)
   - ນັບຍອດຂາຍ (ອໍເດີ status = completed, ລວມ price) ເປັນ "ວັນ": ເລີ່ມນັບ 00:00 ເວລາລາວ (UTC+7)
     ຄົບ 24 ຊົ່ວໂມງ (ຂ້າມເທິ່ຍງຄືນ) ຍອດຣີເຊັດເປັນ 0 ແລ້ວນັບໃໝ່ອັດຕະໂນມັດ — ບໍ່ຕ້ອງກົດຫຍັງ
   - ຄຳນວນຈາກຕາຕະລາງ orders ໂດຍກົງ (ບໍ່ມີຕາຕະລາງໃໝ່, ບໍ່ຕ້ອງແລ່ນ SQL ເພີ່ມ)
   - ສະແດງ: ຍອດມື້ນີ້, ຈຳນວນອໍເດີ, ທຽບມື້ວານໃນເວລາດຽວກັນ, ແຖບຍອດຕໍ່ຊົ່ວໂມງ, ນັບຖອຍຫຼັງຣີເຊັດ
   - ອັບເດດອັດຕະໂນມັດທຸກ 60 ວິ
   ========================================================= */
(function () {
  'use strict';
  const TZ_OFFSET_MS = 7 * 3600 * 1000; // ເວລາລາວ UTC+7 (ບໍ່ມີ DST)
  const DAY_MS = 24 * 3600 * 1000;
  const REFRESH_MS = 60 * 1000;
  const PAGE = 1000;

  const fmt = (n) => Number(n || 0).toLocaleString('de-DE');
  const pad = (n) => String(n).padStart(2, '0');

  // ເວລາເລີ່ມຕົ້ນຂອງ "ມື້ນີ້" (00:00 ເວລາລາວ) ເປັນ epoch ms
  function dayStart(nowMs) {
    return Math.floor((nowMs + TZ_OFFSET_MS) / DAY_MS) * DAY_MS - TZ_OFFSET_MS;
  }

  let card, els = {};
  let state = null;            // { start, today, orders, prevSame, hours[] }
  let loadedForDay = null;
  let loading = false;

  function build() {
    const anchor = document.querySelector('.d2-challenge-card');
    if (!anchor || document.getElementById('dsCard')) return !!document.getElementById('dsCard');
    card = document.createElement('div');
    card.className = 'ds-card';
    card.id = 'dsCard';
    card.innerHTML =
      '<div class="ds-head"><div><div class="ds-title">ຍອດຂາຍມື້ນີ້</div><div class="ds-sub" id="dsDate">—</div></div>' +
      '<div class="ds-badge ds-flat" id="dsBadge">—</div></div>' +
      '<div class="ds-value"><em style="font-style:normal" id="dsValue">—</em><span>ກີບ</span></div>' +
      '<div class="ds-meta"><span>ອໍເດີ <b id="dsOrders">—</b> ລາຍການ</span><span id="dsPrev">ມື້ວານເວລາດຽວກັນ: —</span></div>' +
      '<div class="ds-bars" id="dsBars"></div>' +
      '<div class="ds-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>' +
      '<div class="ds-foot"><div class="ds-track"><div class="ds-fill" id="dsFill"></div></div>' +
      '<div class="ds-reset"><span>ຣີເຊັດ 00:00 ທຸກວັນ</span><span>ຣີເຊັດໃນ <b id="dsCountdown">--:--:--</b></span></div></div>' +
      '<div class="ds-err" id="dsErr">ໂຫຼດຍອດຂາຍບໍ່ສຳເລັດ — ຈະລອງໃໝ່ອັດຕະໂນມັດ</div>';
    anchor.parentNode.insertBefore(card, anchor);
    ['dsDate', 'dsBadge', 'dsValue', 'dsOrders', 'dsPrev', 'dsBars', 'dsFill', 'dsCountdown'].forEach((id) => { els[id] = document.getElementById(id); });
    return true;
  }

  async function fetchOrders(fromIso) {
    const rows = [];
    for (let from = 0; from < 20000; from += PAGE) {
      const { data, error } = await supabaseClient
        .from('orders')
        .select('price,created_at')
        .eq('status', 'completed')
        .gte('created_at', fromIso)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    return rows;
  }

  async function load() {
    if (loading || typeof supabaseClient === 'undefined' || !build()) return;
    loading = true;
    try {
      const now = Date.now();
      const start = dayStart(now);
      const rows = await fetchOrders(new Date(start - DAY_MS).toISOString());
      const elapsed = now - start;
      const hours = new Array(24).fill(0);
      let today = 0, orders = 0, prevSame = 0;
      rows.forEach((r) => {
        const t = Date.parse(r.created_at);
        const p = Number(r.price) || 0;
        if (t >= start) {
          today += p; orders += 1;
          hours[Math.min(23, Math.floor((t - start) / 3600000))] += p;
        } else if (t - (start - DAY_MS) <= elapsed) {
          prevSame += p;
        }
      });
      state = { start, today, orders, prevSame, hours };
      loadedForDay = start;
      card.classList.remove('ds-failed');
      render();
    } catch (err) {
      console.error('daily-sales: ໂຫຼດຍອດຂາຍມື້ນີ້ບໍ່ສຳເລັດ', err);
      if (card) card.classList.add('ds-failed');
    } finally {
      loading = false;
    }
  }

  function render() {
    if (!state || !card) return;
    const d = new Date(state.start + TZ_OFFSET_MS);
    els.dsDate.textContent = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} · 00:00 — 24:00`;
    els.dsValue.textContent = fmt(state.today);
    els.dsOrders.textContent = fmt(state.orders);
    els.dsPrev.textContent = 'ມື້ວານເວລາດຽວກັນ: ' + fmt(state.prevSame) + ' ກີບ';

    const badge = els.dsBadge;
    badge.className = 'ds-badge';
    if (state.prevSame > 0) {
      const pct = Math.round(((state.today - state.prevSame) / state.prevSame) * 100);
      badge.classList.add(pct > 0 ? 'ds-up' : pct < 0 ? 'ds-down' : 'ds-flat');
      badge.textContent = (pct > 0 ? '▲ ' : pct < 0 ? '▼ ' : '') + Math.abs(pct) + '%';
    } else {
      badge.classList.add('ds-flat');
      badge.textContent = state.today > 0 ? 'ໃໝ່' : '—';
    }

    const curHour = Math.floor((Date.now() - state.start) / 3600000);
    const max = Math.max(1, ...state.hours);
    els.dsBars.innerHTML = state.hours.map((v, h) => {
      const cls = h > curHour ? 'ds-bar ds-future' : h === curHour ? 'ds-bar ds-now' : 'ds-bar';
      const ht = h > curHour ? 2 : Math.max(2, Math.round((v / max) * 44));
      return `<div class="${cls}" style="height:${ht}px" title="${pad(h)}:00 — ${fmt(v)} ກີບ"></div>`;
    }).join('');
  }

  // ນັບຖອຍຫຼັງ + ແຖບຄວາມຄືບໜ້າຂອງວັນ (ທຸກວິນາທີ) — ຂ້າມເທິ່ຍງຄືນແລ້ວໂຫຼດໃໝ່ => ຍອດເປັນ 0
  function tick() {
    if (!card) { build(); return; }
    const now = Date.now();
    const start = dayStart(now);
    const left = start + DAY_MS - now;
    const s = Math.max(0, Math.floor(left / 1000));
    els.dsCountdown.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    els.dsFill.style.width = (((now - start) / DAY_MS) * 100).toFixed(2) + '%';
    if (loadedForDay !== null && loadedForDay !== start) {
      // ຂ້າມວັນແລ້ວ: ລ້າງຍອດເປັນ 0 ທັນທີ ແລ້ວດຶງຂໍ້ມູນໃໝ່
      state = { start, today: 0, orders: 0, prevSame: 0, hours: new Array(24).fill(0) };
      loadedForDay = start;
      render();
      load();
    }
  }

  function start() {
    build();
    load();
    setInterval(tick, 1000);
    setInterval(load, REFRESH_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
