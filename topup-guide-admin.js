/* topup-guide-admin.js — ตั้งค่าร้าน: คลิปสอนเติมเงินของแต่ละช่อง (1-4)
   ช่องกรอกอยู่ใต้รูปโลโก้ของแต่ละช่อง (.tgs[data-ch]) แล้วกดบันทึกปุ่มเดียว
   อัปโหลดคลิปไป Supabase storage bucket "site-assets" */
(function () {
  'use strict';
  function init() {
    var saveBtn = document.getElementById('tgSaveBtn');
    var msg = document.getElementById('tgMsg');
    var slots = Array.prototype.slice.call(document.querySelectorAll('.tgs[data-ch]'));
    if (!saveBtn || !slots.length) return;
    function say(t, k) { if (typeof setMsg === 'function' && msg) setMsg(msg, t, k); else if (msg) msg.textContent = t; }

    slots.forEach(function (slot) {
      var file = slot.querySelector('.tgs-file'), up = slot.querySelector('.tgs-up');
      var label = slot.querySelector('.tgs-label'), url = slot.querySelector('.tgs-url');
      slot.querySelector('.tgs-clear').addEventListener('click', function () { label.value = ''; url.value = ''; });
      up.addEventListener('click', function () { file.click(); });
      file.addEventListener('change', async function () {
        var f = file.files[0];
        if (!f) return;
        if (typeof supabaseClient === 'undefined') { say('ອັບໂຫຼດບໍ່ໄດ້: ຍັງບໍ່ເຊື່ອມຕໍ່ Supabase', 'error'); return; }
        up.disabled = true; var old = up.textContent; up.textContent = 'ກຳລັງອັບໂຫຼດ...';
        say('ກຳລັງອັບໂຫຼດຄລິບ... (ໄຟລ໌ໃຫຍ່ອາດໃຊ້ເວລາຈັກໜ້ອຍ)', 'pending');
        try {
          var ext = (f.name.split('.').pop() || 'mp4').toLowerCase();
          var path = 'topup-guide/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
          var r = await supabaseClient.storage.from('site-assets').upload(path, f, { contentType: f.type || undefined });
          if (r.error) throw r.error;
          url.value = supabaseClient.storage.from('site-assets').getPublicUrl(path).data.publicUrl;
          if (!label.value.trim()) label.value = f.name.replace(/\.[^.]+$/, '');
          say('ອັບໂຫຼດຄລິບສຳເລັດ — ກົດ "ບັນທຶກຄລິບສອນເຕີມເງິນ" ເພື່ອໃຊ້ງານ', 'success');
        } catch (e) {
          console.error(e);
          say('ອັບໂຫຼດຄລິບບໍ່ສຳເລັດ: ' + ((e && e.message) || e) + ' (ຖ້າໄຟລ໌ໃຫຍ່ເກີນ ໃຫ້ໃສ່ເປັນລິ້ງ YouTube/Drive ແທນ)', 'error');
        } finally { up.disabled = false; up.textContent = old; file.value = ''; }
      });
    });

    saveBtn.addEventListener('click', async function () {
      var links = [], bad = false;
      slots.forEach(function (slot) {
        var l = slot.querySelector('.tgs-label').value.trim(), u = slot.querySelector('.tgs-url').value.trim();
        if (!l && !u) return;
        if (!l || !u || !/^https?:\/\//i.test(u)) { bad = true; return; }
        links.push({ ch: Number(slot.getAttribute('data-ch')), label: l, url: u });
      });
      if (bad) { say('ກະລຸນາໃສ່ຊື່ ແລະ ລິ້ງ (ຂຶ້ນຕົ້ນດ້ວຍ https://) ໃຫ້ຄົບໃນຊ່ອງທີ່ກອກ', 'error'); return; }
      var refs = {};
      document.querySelectorAll('.tgs-ref[data-ch]').forEach(function (c) { refs[c.getAttribute('data-ch')] = c.checked; });
      saveBtn.disabled = true; saveBtn.classList.add('loading'); say('ກຳລັງບັນທຶກ...', 'pending');
      try {
        var res = await fetch('/api/topup-links', { method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ links: links, refs: refs }) });
        var d = await res.json().catch(function () { return {}; });
        if (!res.ok || !d.ok) throw new Error(d.error || ('HTTP ' + res.status));
        say('ບັນທຶກສຳເລັດ ✅', 'success');
      } catch (e) { say('ບັນທຶກບໍ່ສຳເລັດ: ' + (e.message || e), 'error'); }
      finally { saveBtn.disabled = false; saveBtn.classList.remove('loading'); }
    });

    fetch('/api/topup-links', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      ((d && d.links) || []).forEach(function (l) {
        var slot = document.querySelector('.tgs[data-ch="' + l.ch + '"]');
        if (!slot) return;
        slot.querySelector('.tgs-label').value = l.label || '';
        slot.querySelector('.tgs-url').value = l.url || '';
      });
      var refs = (d && d.refs) || {};
      document.querySelectorAll('.tgs-ref[data-ch]').forEach(function (c) { c.checked = refs[c.getAttribute('data-ch')] === true; });
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
