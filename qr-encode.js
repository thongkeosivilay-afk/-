/* qr-encode.js — ຕົວສ້າງ QR ໃນຕົວ (ບໍ່ຕ້ອງໂຫຼດຈາກ CDN). ໂໝດ byte, ECC ລະດັບ M, ເລືອກ version ອັດຕະໂນມັດ.
   ໃຊ້ແທນ qrcode@1.5.3: window.QRCode.toCanvas(canvas, text, { width, margin }) -> Promise */
(function () {
  'use strict';
  var ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
  var NUM_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];

  function rawModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) { var n = Math.floor(ver / 7) + 2; r -= (25 * n - 10) * n - 55; if (ver >= 7) r -= 36; }
    return r;
  }
  function dataCodewords(ver) { return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver]; }

  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
    return z;
  }
  function rsDivisor(deg) {
    var res = [], i, j;
    for (i = 0; i < deg; i++) res.push(0);
    res[deg - 1] = 1;
    var root = 1;
    for (i = 0; i < deg; i++) {
      for (j = 0; j < deg; j++) { res[j] = gfMul(res[j], root); if (j + 1 < deg) res[j] ^= res[j + 1]; }
      root = gfMul(root, 2);
    }
    return res;
  }
  function rsRemainder(data, div) {
    var res = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ res.shift();
      res.push(0);
      div.forEach(function (c, i) { res[i] ^= gfMul(c, f); });
    });
    return res;
  }
  function utf8(str) {
    if (window.TextEncoder) return Array.prototype.slice.call(new TextEncoder().encode(str));
    var s = unescape(encodeURIComponent(str)), out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function encode(text) {
    var bytes = utf8(text), ver, cap;
    for (ver = 1; ver <= 40; ver++) {
      cap = dataCodewords(ver) * 8;
      var need = 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8;
      if (need <= cap) break;
    }
    if (ver > 40) throw new Error('ຂໍ້ຄວາມຍາວເກີນ QR');
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) {
      var v = 0; for (var k = 0; k < 8; k++) v = (v << 1) | bits[i + k];
      data.push(v);
    }

    // ແບ່ງບລັອກ + ECC + ສະລັບ
    var nb = NUM_BLOCKS[ver], eccLen = ECC_PER_BLOCK[ver], raw = Math.floor(rawModules(ver) / 8);
    var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), blocks = [], div = rsDivisor(eccLen), kk = 0;
    for (i = 0; i < nb; i++) {
      var dl = shortLen - eccLen + (i < nShort ? 0 : 1);
      var dat = data.slice(kk, kk + dl); kk += dl;
      var ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var words = [];
    for (i = 0; i < blocks[0].length; i++) {
      for (var j = 0; j < nb; j++) if (i !== shortLen - eccLen || j >= nShort) words.push(blocks[j][i]);
    }

    var size = ver * 4 + 17, m = [], fn = [], x, y;
    for (y = 0; y < size; y++) { m.push([]); fn.push([]); for (x = 0; x < size; x++) { m[y].push(false); fn[y].push(false); } }
    function setFn(xx, yy, v) { m[yy][xx] = !!v; fn[yy][xx] = true; }
    for (i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = c[0] + dx, yy = c[1] + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(xx, yy, d !== 2 && d !== 4);
      }
    });
    if (ver > 1) {
      var na = Math.floor(ver / 7) + 2, step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2, pos = [6];
      for (var p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
      for (i = 0; i < na; i++) for (j = 0; j < na; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
        for (var ay = -2; ay <= 2; ay++) for (var ax = -2; ax <= 2; ax++) setFn(pos[i] + ax, pos[j] + ay, Math.max(Math.abs(ax), Math.abs(ay)) !== 1);
      }
    }
    function drawFormat(mask) {
      var d = mask, rem = d;
      for (var q = 0; q < 10; q++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bt = ((d << 10) | rem) ^ 0x5412;
      function b(n) { return ((bt >>> n) & 1) !== 0; }
      for (var q2 = 0; q2 <= 5; q2++) setFn(8, q2, b(q2));
      setFn(8, 7, b(6)); setFn(8, 8, b(7)); setFn(7, 8, b(8));
      for (q2 = 9; q2 < 15; q2++) setFn(14 - q2, 8, b(q2));
      for (q2 = 0; q2 < 8; q2++) setFn(size - 1 - q2, 8, b(q2));
      for (q2 = 8; q2 < 15; q2++) setFn(8, size - 15 + q2, b(q2));
      setFn(8, size - 8, true);
    }
    drawFormat(0);
    if (ver >= 7) {
      var r2 = ver;
      for (i = 0; i < 12; i++) r2 = (r2 << 1) ^ ((r2 >>> 11) * 0x1f25);
      var vb = (ver << 12) | r2;
      for (i = 0; i < 18; i++) {
        var col = ((vb >>> i) & 1) !== 0, a = size - 11 + i % 3, bb = Math.floor(i / 3);
        setFn(a, bb, col); setFn(bb, a, col);
      }
    }
    // ວາງ codeword
    var bi = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        x = right - j; y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fn[y][x] && bi < words.length * 8) { m[y][x] = ((words[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
      }
    }
    function applyMask(mask) {
      for (var yy = 0; yy < size; yy++) for (var xx = 0; xx < size; xx++) {
        var inv;
        switch (mask) {
          case 0: inv = (xx + yy) % 2 === 0; break;
          case 1: inv = yy % 2 === 0; break;
          case 2: inv = xx % 3 === 0; break;
          case 3: inv = (xx + yy) % 3 === 0; break;
          case 4: inv = (Math.floor(xx / 3) + Math.floor(yy / 2)) % 2 === 0; break;
          case 5: inv = xx * yy % 2 + xx * yy % 3 === 0; break;
          case 6: inv = (xx * yy % 2 + xx * yy % 3) % 2 === 0; break;
          default: inv = ((xx + yy) % 2 + xx * yy % 3) % 2 === 0;
        }
        if (!fn[yy][xx] && inv) m[yy][xx] = !m[yy][xx];
      }
    }
    function penalty() {
      var pen = 0, yy, xx, run, dark = 0;
      for (yy = 0; yy < size; yy++) {
        run = 1;
        for (xx = 1; xx < size; xx++) { if (m[yy][xx] === m[yy][xx - 1]) { run++; if (run === 5) pen += 3; else if (run > 5) pen++; } else run = 1; }
      }
      for (xx = 0; xx < size; xx++) {
        run = 1;
        for (yy = 1; yy < size; yy++) { if (m[yy][xx] === m[yy - 1][xx]) { run++; if (run === 5) pen += 3; else if (run > 5) pen++; } else run = 1; }
      }
      for (yy = 0; yy < size - 1; yy++) for (xx = 0; xx < size - 1; xx++) {
        var c = m[yy][xx];
        if (c === m[yy][xx + 1] && c === m[yy + 1][xx] && c === m[yy + 1][xx + 1]) pen += 3;
      }
      for (yy = 0; yy < size; yy++) for (xx = 0; xx < size; xx++) if (m[yy][xx]) dark++;
      pen += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return pen;
    }
    var best = 0, bestPen = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      applyMask(mk); drawFormat(mk);
      var pn = penalty();
      if (pn < bestPen) { bestPen = pn; best = mk; }
      applyMask(mk);
    }
    applyMask(best); drawFormat(best);
    return { size: size, modules: m };
  }

  function toCanvas(canvas, text, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      try {
        var q = encode(String(text)), margin = opts.margin == null ? 2 : opts.margin;
        var total = q.size + margin * 2, scale = Math.max(1, Math.floor((opts.width || 300) / total)), px = total * scale;
        canvas.width = px; canvas.height = px;
        var cx = canvas.getContext('2d');
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, px, px);
        cx.fillStyle = '#000';
        for (var y = 0; y < q.size; y++) for (var x = 0; x < q.size; x++) if (q.modules[y][x]) cx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
        resolve(canvas);
      } catch (e) { reject(e); }
    });
  }

  var api = { toCanvas: toCanvas, _encode: encode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.QRCode = api;
})();
