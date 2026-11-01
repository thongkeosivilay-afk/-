/* Discord Widget — ດຶງຂໍ້ມູນຈິງຈາກ Discord ແລ້ວໃສ່ເທິງສຸດຂອງ <footer>
   ຖ້າດຶງບໍ່ໄດ້ (ຍັງບໍ່ເປີດ Widget ຫຼື ເນັດມີບັນຫາ) ຈະບໍ່ສະແດງການ໌ດ ແລະ ບໍ່ກະທົບເວັບ */
(function () {
  const SERVER_ID = '1515277611155325030';
  const REFRESH_MS = 60000;
  const TEXT = { sub: 'ຊຸມຊົນ Discord ຂອງຮ້ານ', online: 'ອອນລາຍ', join: 'ເຂົ້າຮ່ວມເຊີເວີ' };
  const ICON = '<svg viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>';

  const footer = document.querySelector('footer');
  const slot = document.getElementById('discord-widget');
  if (!footer && !slot) return;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https:\/\//.test(u || '') ? u : '');

  let card = null;

  function render(d) {
    const members = Array.isArray(d.members) ? d.members : [];
    const invite = safeUrl(d.instant_invite);
    const html = `
      <div class="dcw-head">
        <div class="dcw-ico">${ICON}</div>
        <div class="dcw-title"><b>${esc(d.name || 'Discord')}</b><span>${TEXT.sub}</span></div>
        <div class="dcw-online"><i></i><span>${Number(d.presence_count || 0).toLocaleString('en-US')}</span><small>${TEXT.online}</small></div>
      </div>
      <div class="dcw-list">${members.map((m) => `
        <div class="dcw-m">
          <div class="dcw-av"><img src="${esc(safeUrl(m.avatar_url))}" alt="" loading="lazy" referrerpolicy="no-referrer"><em class="${esc(m.status || 'online')}"></em></div>
          <div class="dcw-name">${esc(m.username || '')}</div>
        </div>`).join('')}</div>
      ${invite ? `<a class="dcw-join" href="${esc(invite)}" target="_blank" rel="noopener">${ICON}${TEXT.join}</a>` : ''}`;
    if (!card) {
      card = document.createElement('div');
      card.className = 'dcw';
      if (slot) slot.appendChild(card);
      else footer.insertBefore(card, footer.firstChild);
    }
    card.innerHTML = html;
  }

  async function load() {
    try {
      const res = await fetch('https://discord.com/api/guilds/' + SERVER_ID + '/widget.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('widget ' + res.status);
      render(await res.json());
    } catch (err) {
      console.warn('Discord widget:', err);
      if (card) { card.remove(); card = null; }
    }
  }

  load();
  setInterval(load, REFRESH_MS);
})();
