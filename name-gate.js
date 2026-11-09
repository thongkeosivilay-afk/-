/* =========================================================
   name-gate.js — บังคับตั้งชื่อ (เฉพาะบัญชีที่ยังไม่มีชื่อ)
   ลำดับ: เข้าเว็บ → รอ 1 วิ → นับ 1-10 → การ์ดตั้งชื่อเด้งขึ้นมา (บังคับ ปิดไม่ได้)
   - เรียก /api/me : ถ้า user.needsUsername === true ถึงจะแสดง (แอดมิน/คนที่มีชื่อแล้วไม่เห็น)
   - ตรวจชื่อซ้ำ GET /api/account/check-username , บันทึก POST /api/account/set-username
   - ใช้ Shadow DOM → CSS ของหน้าเว็บไม่ตีกัน
   - ฉากนับเลข 1-10 เล่นครั้งเดียวต่อ 1 session (หน้าถัดไปในรอบเดียวกันจะเด้งการ์ดเลย) — เปลี่ยนได้ที่ SEEN_KEY
   ========================================================= */
(function () {
  'use strict';
  if (window.__nameGate) return;
  window.__nameGate = 1;

  var CSS = ":host{all:initial;display:block;position:fixed;inset:0;z-index:2147483000}\n\n:root{--red:#ff0001;--red-deep:#990001;--gold:#e8b34a;--ok:#2ee59d;--text:#fff;--dim:#999;--faint:#777;--card:#0a0a0a;--line:#1e1e1e}\n*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}\n.root{position:fixed;inset:0;background:#000;color:#fff;font-family:'Noto Sans Lao','Rajdhani',sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}\nbutton,input{font-family:inherit}\n\n/* ---------- พื้นหลัง ---------- */\n.bg{position:fixed;inset:0;overflow:hidden;background:radial-gradient(ellipse at 50% 0%,#2a0000 0%,#000 62%)}\n.bg::before,.bg::after{content:\"\";position:absolute;width:70vmax;height:70vmax;border-radius:50%;filter:blur(70px);opacity:.38;will-change:transform}\n.bg::before{background:radial-gradient(circle,#ff0001,transparent 65%);left:-25vmax;top:-20vmax;animation:drift1 14s ease-in-out infinite alternate}\n.bg::after{background:radial-gradient(circle,#7a0010,transparent 65%);right:-25vmax;bottom:-25vmax;animation:drift2 17s ease-in-out infinite alternate}\n@keyframes drift1{to{transform:translate3d(18vmax,14vmax,0)}}\n@keyframes drift2{to{transform:translate3d(-16vmax,-12vmax,0)}}\n#fx{position:absolute;inset:0;width:100%;height:100%}\n\n/* ---------- ฉากบังคับ ---------- */\n.gate{position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(18px + env(safe-area-inset-top,0px)) 18px calc(18px + env(safe-area-inset-bottom,0px));z-index:5}\n\n/* ---------- การ์ด ---------- */\n.card-wrap{position:relative;width:100%;max-width:400px;animation:cardIn .9s cubic-bezier(.2,.9,.25,1.1) both}\n@keyframes cardIn{0%{opacity:0;transform:translateY(60px) scale(.92)}100%{opacity:1;transform:none}}\n.card-wrap::before{ /* ขอบแสงหมุน */\n  content:\"\";position:absolute;inset:-2px;border-radius:26px;\n  background:conic-gradient(from var(--a,0deg),transparent 0 55%,#ff0001 75%,#ffb3b3 85%,#ff0001 92%,transparent);\n  animation:spin 4.2s linear infinite;\n}\n.card-wrap::after{content:\"\";position:absolute;inset:-18px;border-radius:40px;background:radial-gradient(circle,rgba(255,0,1,.28),transparent 70%);filter:blur(18px);z-index:-1;animation:breathe 3.2s ease-in-out infinite}\n@keyframes spin{to{--a:360deg}}\n@keyframes breathe{50%{opacity:.45;transform:scale(1.04)}}\n.card{position:relative;background:linear-gradient(180deg,#120405,#070707 60%);border-radius:24px;padding:30px 24px 24px;overflow:hidden}\n.card::before{ /* แสงกวาดผ่านการ์ด */\n  content:\"\";position:absolute;top:0;left:-60%;width:40%;height:100%;\n  background:linear-gradient(100deg,transparent,rgba(255,255,255,.07),transparent);\n  transform:skewX(-18deg);animation:sweep 5s ease-in-out infinite 1.2s;pointer-events:none}\n@keyframes sweep{0%{left:-60%}55%,100%{left:150%}}\n\n/* ---------- ไอคอนหัวการ์ด ---------- */\n.badge{position:relative;width:92px;height:92px;margin:0 auto 16px;display:grid;place-items:center}\n.badge .ring{position:absolute;inset:0;border-radius:50%;border:2px dashed rgba(255,0,1,.55);animation:spin2 14s linear infinite}\n.badge .ring.r2{inset:9px;border:2px solid rgba(255,255,255,.08);border-top-color:var(--red);animation:spin2 2.4s linear infinite reverse}\n@keyframes spin2{to{transform:rotate(360deg)}}\n.avatar{position:relative;width:62px;height:62px;border-radius:50%;display:grid;place-items:center;\n  background:radial-gradient(circle at 30% 25%,#ff4a4a,#b00008 60%,#4a0004);\n  font:900 28px 'Orbitron','Rajdhani',sans-serif;box-shadow:0 0 26px rgba(255,0,1,.55),inset 0 -6px 12px rgba(0,0,0,.35);animation:float 3s ease-in-out infinite}\n@keyframes float{50%{transform:translateY(-5px)}}\n.avatar span{display:block;transition:transform .25s}\n.avatar span.pop{animation:pop .3s cubic-bezier(.3,1.8,.5,1)}\n@keyframes pop{0%{transform:scale(.3) rotate(-25deg)}100%{transform:none}}\n\nh1{font-family:'Noto Sans Lao',sans-serif;font-weight:800;font-size:22px;text-align:center;letter-spacing:.2px;animation:rise .6s .35s both}\n.sub{margin-top:6px;text-align:center;color:var(--dim);font-size:13.5px;line-height:1.6;animation:rise .6s .45s both}\n.sub b{color:#ff6a6a;font-weight:700}\n@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}\n\n/* ---------- ช่องกรอก ---------- */\n.field{margin-top:20px;animation:rise .6s .55s both}\n.input{position:relative;display:flex;align-items:center;gap:10px;background:#0d0d0d;border:1.5px solid #262626;border-radius:14px;padding:0 14px;height:54px;transition:border-color .25s,box-shadow .25s,background .25s}\n.input:focus-within{border-color:var(--red);box-shadow:0 0 0 4px rgba(255,0,1,.14),0 0 24px rgba(255,0,1,.25);background:#120808}\n.input svg{width:20px;height:20px;flex:none;color:#666;transition:color .25s,transform .25s}\n.input:focus-within svg{color:var(--red);transform:scale(1.12)}\n.input input{flex:1;min-width:0;background:none;border:0;outline:0;color:#fff;font-size:17px;font-weight:600;letter-spacing:.3px;font-family:'Rajdhani','Noto Sans Lao',sans-serif}\n.input input::placeholder{color:#555;font-weight:500}\n.status{width:22px;height:22px;flex:none;position:relative}\n.status i{position:absolute;inset:0;opacity:0;transform:scale(.3);transition:.25s cubic-bezier(.3,1.6,.5,1)}\n.status.load .sp{opacity:1;transform:none}\n.status.ok .ck{opacity:1;transform:none}\n.status.bad .xx{opacity:1;transform:none}\n.sp:before{content:\"\";position:absolute;inset:2px;border-radius:50%;border:2.5px solid #444;border-top-color:var(--red);animation:spin2 .7s linear infinite}\n.ck:before{content:\"\";position:absolute;left:6px;top:2px;width:7px;height:13px;border:solid var(--ok);border-width:0 3px 3px 0;transform:rotate(42deg)}\n.xx:before,.xx:after{content:\"\";position:absolute;left:10px;top:2px;width:3px;height:18px;background:#ff5a5a;border-radius:2px;transform:rotate(45deg)}\n.xx:after{transform:rotate(-45deg)}\n.input.ok{border-color:rgba(46,229,157,.6)}\n.input.bad{border-color:#ff5a5a}\n.input.shake{animation:shake .55s cubic-bezier(.36,.07,.19,.97)}\n@keyframes shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-8px)}40%,60%{transform:translateX(8px)}}\n\n.msg{min-height:20px;margin-top:8px;padding-left:4px;font-size:12.5px;color:var(--faint);transition:color .2s;line-height:1.5}\n.msg.bad{color:#ff6a6a}.msg.ok{color:var(--ok)}\n\n/* ตัวนับ + กฎ */\n.rules{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}\n.rule{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#777;background:#0f0f0f;border:1px solid #1d1d1d;padding:4px 9px;border-radius:99px;transition:.3s}\n.rule::before{content:\"\";width:7px;height:7px;border-radius:50%;background:#333;transition:.3s}\n.rule.ok{color:#c9ffe9;border-color:rgba(46,229,157,.35);background:rgba(46,229,157,.07)}\n.rule.ok::before{background:var(--ok);box-shadow:0 0 8px var(--ok)}\n\n/* ---------- ปุ่ม ---------- */\n.btn{position:relative;margin-top:20px;width:100%;height:54px;border:0;border-radius:14px;color:#fff;font-size:16px;font-weight:800;cursor:pointer;overflow:hidden;\n  background:linear-gradient(180deg,#ff2a2a,#d40008);box-shadow:0 8px 26px rgba(255,0,1,.4);transition:transform .15s,box-shadow .25s,filter .25s,opacity .25s;animation:rise .6s .65s both}\n.btn::after{content:\"\";position:absolute;top:0;left:-70%;width:50%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent);transform:skewX(-20deg);animation:sweep2 2.6s ease-in-out infinite}\n@keyframes sweep2{0%{left:-70%}60%,100%{left:160%}}\n.btn:active{transform:scale(.97)}\n.btn:disabled{filter:grayscale(.85) brightness(.55);box-shadow:none;cursor:not-allowed}\n.btn:disabled::after{display:none}\n.btn .t{position:relative;z-index:1;display:inline-flex;align-items:center;gap:8px}\n.btn.busy .t::before{content:\"\";width:16px;height:16px;border-radius:50%;border:2.5px solid rgba(255,255,255,.4);border-top-color:#fff;animation:spin2 .7s linear infinite}\n\n.warn{margin-top:14px;display:flex;gap:8px;align-items:flex-start;font-size:12px;color:#d9a55b;background:rgba(232,179,74,.07);border:1px solid rgba(232,179,74,.2);padding:9px 11px;border-radius:11px;line-height:1.55;animation:rise .6s .75s both}\n.warn svg{width:16px;height:16px;flex:none;margin-top:2px}\n\n/* ---------- สำเร็จ ---------- */\n.done{position:absolute;inset:0;border-radius:24px;background:linear-gradient(180deg,#0b1a13,#050806);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:24px;opacity:0;pointer-events:none;transition:opacity .4s;z-index:3}\n.card.is-done .done{opacity:1;pointer-events:auto}\n.tick{width:92px;height:92px}\n.tick circle{fill:none;stroke:var(--ok);stroke-width:5;stroke-dasharray:283;stroke-dashoffset:283;stroke-linecap:round;transform:rotate(-90deg);transform-origin:center}\n.tick path{fill:none;stroke:var(--ok);stroke-width:6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:60;stroke-dashoffset:60}\n.card.is-done .tick circle{animation:draw .7s .1s forwards}\n.card.is-done .tick path{animation:draw .45s .7s forwards}\n@keyframes draw{to{stroke-dashoffset:0}}\n.done h2{font-size:20px;font-weight:800;opacity:0;transform:translateY(10px)}\n.done .nm{font:900 24px 'Orbitron','Rajdhani',sans-serif;color:#fff;text-shadow:0 0 18px rgba(46,229,157,.6);word-break:break-all;opacity:0;transform:scale(.7)}\n.done p{font-size:13px;color:#8fbfa8;opacity:0}\n.card.is-done .done h2{animation:rise .5s .9s forwards}\n.card.is-done .done .nm{animation:zoom .6s 1.05s cubic-bezier(.3,1.6,.5,1) forwards}\n.card.is-done .done p{animation:rise .5s 1.3s forwards}\n.done .again{display:none;margin-top:10px;background:#111;border:1px solid #2a2a2a;color:#aaa;font-size:12px;padding:8px 14px;border-radius:99px;cursor:pointer;opacity:0}\n.card.is-done .done .again{display:none;animation:rise .5s 1.6s forwards}\n@keyframes zoom{to{opacity:1;transform:none}}\n\n\n@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;animation-iteration-count:1!important}}\n\n/* ---------- กล่องอธิบายใต้การ์ด ---------- */\n.stack{margin:auto;width:100%;max-width:400px;padding:34px 0 26px}\n.why{margin-top:26px;animation:rise .7s .9s both}\n.why-h{display:flex;align-items:center;gap:10px;margin-bottom:12px;font-size:15px;font-weight:800}\n.why-h::before,.why-h::after{content:\"\";flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(255,0,1,.5))}\n.why-h::after{background:linear-gradient(270deg,transparent,rgba(255,0,1,.5))}\n.why-lead{font-size:13px;line-height:1.7;color:#aaa;text-align:center;margin-bottom:14px}\n.why-lead b{color:#ff6a6a}\n.why-list{display:grid;gap:10px}\n.why-item{display:flex;gap:12px;align-items:flex-start;background:linear-gradient(180deg,#0f0808,#0a0a0a);border:1px solid #1e1e1e;border-radius:16px;padding:13px 14px;opacity:0;transform:translateY(16px);animation:rise .6s forwards;transition:border-color .25s,transform .25s}\n.why-item:nth-child(1){animation-delay:1.05s}.why-item:nth-child(2){animation-delay:1.2s}.why-item:nth-child(3){animation-delay:1.35s}.why-item:nth-child(4){animation-delay:1.5s}\n.why-item:active{border-color:rgba(255,0,1,.5);transform:scale(.985)}\n.why-ic{flex:none;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:rgba(255,0,1,.12);border:1px solid rgba(255,0,1,.3);color:#ff5a5a}\n.why-ic svg{width:20px;height:20px}\n.why-item h3{font-size:13.5px;font-weight:800;margin-bottom:3px}\n.why-item p{font-size:12.3px;line-height:1.65;color:#8d8d8d}\n.why-item p b{color:#ddd;font-weight:700}\n.why-tip{margin-top:14px;display:flex;gap:9px;align-items:flex-start;font-size:12.3px;line-height:1.65;color:#cfcfcf;background:rgba(46,229,157,.06);border:1px solid rgba(46,229,157,.22);border-radius:14px;padding:11px 13px;opacity:0;animation:rise .6s 1.65s forwards}\n.why-tip b{color:var(--ok)}\n.eg{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}\n.eg span{font:600 12px 'Rajdhani',sans-serif;color:#ddd;background:#111;border:1px solid #2a2a2a;border-radius:99px;padding:3px 10px}\n\n/* ---------- ฉากนับเลข 1-10 ---------- */\n.stack:not(.play){visibility:hidden}\n.stack:not(.play) *,.stack:not(.play) *::before,.stack:not(.play) *::after{animation-play-state:paused!important}\n@keyframes cardIn{0%{opacity:0;transform:scale(.35) translateY(50px);filter:blur(14px)}55%{opacity:1;transform:scale(1.05);filter:blur(0)}78%{transform:scale(.98)}100%{opacity:1;transform:none;filter:none}}\n.cd{position:fixed;inset:0;z-index:8;display:grid;place-items:center;background:radial-gradient(circle at 50% 45%,rgba(60,0,4,.55),rgba(0,0,0,.92) 70%);opacity:0;animation:cdIn .7s ease forwards;transition:opacity .6s,transform .7s cubic-bezier(.5,0,.2,1),filter .7s}\n@keyframes cdIn{to{opacity:1}}\n.cd.out{opacity:0;transform:scale(1.7);filter:blur(10px);pointer-events:none}\n.cd-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,0,1,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,0,1,.07) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(circle at 50% 50%,#000 10%,transparent 68%);mask-image:radial-gradient(circle at 50% 50%,#000 10%,transparent 68%);animation:grid 6s linear infinite}\n@keyframes grid{to{background-position:44px 44px}}\n.cd-box{position:relative;display:flex;flex-direction:column;align-items:center;gap:20px;padding:0 20px}\n.cd-lab{font-size:13px;font-weight:700;letter-spacing:.6px;color:#ff8080;display:flex;align-items:center;gap:8px;animation:blink 1.4s ease-in-out infinite}\n.cd-lab::before{content:\"\";width:8px;height:8px;border-radius:50%;background:var(--red);box-shadow:0 0 12px var(--red)}\n@keyframes blink{50%{opacity:.45}}\n.cd-dial{position:relative;width:min(70vw,270px);aspect-ratio:1}\n.cd-dial svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);overflow:visible}\n.cd-dial .trk{fill:none;stroke:#1d1d1d;stroke-width:6}\n.cd-dial .prg{fill:none;stroke:url(#g1);stroke-width:6;stroke-linecap:round;stroke-dasharray:566;stroke-dashoffset:566;transition:stroke-dashoffset .9s cubic-bezier(.3,.8,.3,1);filter:drop-shadow(0 0 8px rgba(255,0,1,.9))}\n.cd-dial .orb{fill:none;stroke:rgba(255,0,1,.35);stroke-width:1.5;stroke-dasharray:3 9;transform-origin:center;animation:spin2 10s linear infinite}\n.cd-dial .orb2{stroke:rgba(255,255,255,.12);stroke-dasharray:1 6;animation-direction:reverse;animation-duration:16s}\n.cd-num{position:absolute;inset:0;display:grid;place-items:center;font:900 clamp(72px,26vw,118px)/1 'Orbitron','Rajdhani',sans-serif;color:#fff;text-shadow:0 0 26px rgba(255,0,1,.85),0 0 60px rgba(255,0,1,.45)}\n.cd-num b{position:relative;display:block;font-weight:900}\n.cd-num b::before,.cd-num b::after{content:attr(data-t);position:absolute;inset:0;mix-blend-mode:screen;opacity:0}\n.cd-num b::before{color:#00e5ff;transform:translate(-5px,0)}\n.cd-num b::after{color:#ff2a2a;transform:translate(5px,0)}\n.cd-num b.tick{animation:numIn .9s cubic-bezier(.2,.9,.25,1.1) both}\n.cd-num b.tick::before,.cd-num b.tick::after{animation:glitch .45s steps(2,end) both}\n@keyframes numIn{0%{opacity:0;transform:scale(2.4);filter:blur(16px)}35%{opacity:1;filter:blur(0)}55%{transform:scale(.94)}100%{opacity:1;transform:scale(1)}}\n@keyframes glitch{0%{opacity:.9;clip-path:inset(10% 0 60% 0)}25%{opacity:.9;clip-path:inset(55% 0 12% 0)}50%{opacity:.8;clip-path:inset(30% 0 35% 0)}75%{opacity:.6;clip-path:inset(70% 0 5% 0)}100%{opacity:0}}\n.cd-num b.last{background:linear-gradient(180deg,#fff,#ffd36b 60%,#ff8a00);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 22px rgba(255,180,0,.8))}\n.cd-pulse{position:absolute;inset:8%;border-radius:50%;border:2px solid rgba(255,0,1,.7);pointer-events:none}\n.cd-seg{display:flex;gap:6px}\n.cd-seg i{width:20px;height:6px;border-radius:3px;background:#222;transition:background .25s,box-shadow .25s,transform .25s}\n.cd-seg i.on{background:var(--red);box-shadow:0 0 10px var(--red);transform:scaleY(1.4)}\n.cd-seg i.on:last-child{background:#ffc94d;box-shadow:0 0 12px #ffc94d}\n.cd-cap{font-size:13px;color:#999;text-align:center}\n.flash{position:fixed;inset:0;z-index:10;background:#fff;opacity:0;pointer-events:none}\n.flash.go{animation:flash .7s ease-out}\n@keyframes flash{0%{opacity:.85}100%{opacity:0}}\n.shock{position:fixed;z-index:7;left:50%;top:50%;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:3px solid rgba(255,60,60,.9);pointer-events:none;animation:shock 1s ease-out forwards}\n@keyframes shock{to{transform:scale(32);opacity:0;border-width:1px}}\n\n.logout{display:block;text-align:center;margin-top:18px;font-size:12px;color:#666}\n.logout a{color:#888;text-decoration:underline;cursor:pointer}\n";
  var HTML = "<div class=\"bg\"><canvas id=\"fx\"></canvas></div>\n\n<div class=\"cd\" id=\"cd\">\n  <div class=\"cd-grid\"></div>\n  <div class=\"cd-box\">\n    <div class=\"cd-lab\">ກຳລັງກະກຽມບັນຊີຂອງທ່ານ</div>\n    <div class=\"cd-dial\">\n      <svg viewBox=\"0 0 200 200\">\n        <defs><linearGradient id=\"g1\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#ff0001\"/><stop offset=\"1\" stop-color=\"#ffc94d\"/></linearGradient></defs>\n        <circle class=\"orb\" cx=\"100\" cy=\"100\" r=\"99\"/><circle class=\"orb orb2\" cx=\"100\" cy=\"100\" r=\"80\"/>\n        <circle class=\"trk\" cx=\"100\" cy=\"100\" r=\"90\"/><circle class=\"prg\" id=\"prg\" cx=\"100\" cy=\"100\" r=\"90\"/>\n      </svg>\n      <div class=\"cd-num\" id=\"cdn\"></div>\n    </div>\n    <div class=\"cd-seg\" id=\"seg\"></div>\n    <div class=\"cd-cap\">ບັນຊີນີ້ຍັງບໍ່ມີຊື່ຜູ້ໃຊ້ · ກະລຸນາລໍຖ້າສັກຄູ່</div>\n  </div>\n</div>\n<div class=\"flash\" id=\"flash\"></div>\n\n<div class=\"gate\">\n <div class=\"stack\" id=\"stack\">\n  <div class=\"card-wrap\">\n    <div class=\"card\" id=\"card\">\n\n      <div class=\"badge\">\n        <div class=\"ring\"></div><div class=\"ring r2\"></div>\n        <div class=\"avatar\"><span id=\"ava\">?</span></div>\n      </div>\n\n      <h1>ຕັ້ງຊື່ຂອງທ່ານກ່ອນ</h1>\n      <p class=\"sub\">ບັນຊີຂອງທ່ານຍັງ<b>ບໍ່ມີຊື່ຜູ້ໃຊ້</b><br>ຕ້ອງຕັ້ງຊື່ກ່ອນຈຶ່ງຈະໃຊ້ງານເວັບໄດ້</p>\n\n      <div class=\"field\">\n        <div class=\"input\" id=\"box\">\n          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7\"/></svg>\n          <input id=\"name\" type=\"text\" inputmode=\"latin\" autocomplete=\"off\" autocapitalize=\"none\" autocorrect=\"off\" spellcheck=\"false\" maxlength=\"24\" placeholder=\"Username\">\n          <div class=\"status\" id=\"st\"><i class=\"sp\"></i><i class=\"ck\"></i><i class=\"xx\"></i></div>\n        </div>\n        <div class=\"msg\" id=\"msg\">ພາສາອັງກິດ ຕົວເລກ . _ - ເທົ່ານັ້ນ</div>\n        <div class=\"rules\">\n          <span class=\"rule\" id=\"r1\">3–24 ຕົວ</span>\n          <span class=\"rule\" id=\"r2\">A-Z 0-9 . _ -</span>\n          <span class=\"rule\" id=\"r3\">ຊື່ຫວ່າງ</span>\n        </div>\n      </div>\n\n      <button class=\"btn\" id=\"go\" disabled><span class=\"t\">ຢືນຢັນຊື່</span></button>\n\n      <div class=\"warn\">\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3 2 20h20L12 3Z\"/><path d=\"M12 10v5M12 18h.01\"/></svg>\n        <span>ຕັ້ງໄດ້ <b>ຄັ້ງດຽວ</b> ແລະ ປ່ຽນພາຍຫຼັງບໍ່ໄດ້ — ກວດໃຫ້ດີກ່ອນກົດຢືນຢັນ</span>\n      </div>\n\n      <div class=\"done\">\n        <svg class=\"tick\" viewBox=\"0 0 100 100\"><circle cx=\"50\" cy=\"50\" r=\"45\"/><path d=\"M30 52l14 14 27-30\"/></svg>\n        <h2>ຕັ້ງຊື່ສຳເລັດ!</h2>\n        <div class=\"nm\" id=\"nm\"></div>\n        <p>ກຳລັງເຂົ້າສູ່ເວັບ…</p>\n      </div>\n    </div>\n  </div>\n\n  <section class=\"why\">\n    <div class=\"why-h\">ເປັນຫຍັງຕ້ອງຕັ້ງຊື່?</div>\n    <p class=\"why-lead\">ເພື່ອໃຫ້ <b>ທີມແອດມິນຄົ້ນຫາບັນຊີຂອງທ່ານໄດ້ງ່າຍ</b> ແລະ ບໍລິການທ່ານໄດ້ໄວຂຶ້ນ</p>\n    <div class=\"why-list\">\n      <div class=\"why-item\">\n        <div class=\"why-ic\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m21 21-4.3-4.3\"/></svg></div>\n        <div><h3>ແອດມິນຄົ້ນຫາຊື່ໄດ້ທັນທີ</h3><p>ໃນຫ້ອງຄວບຄຸມຂອງແອດມິນ ມີລະບົບ <b>ຄົ້ນຫາດ້ວຍຊື່ຜູ້ໃຊ້</b> ຖ້າບັນຊີບໍ່ມີຊື່ ທີມງານຈະຫາບັນຊີທ່ານບໍ່ເຫັນ</p></div>\n      </div>\n      <div class=\"why-item\">\n        <div class=\"why-ic\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"6\" width=\"20\" height=\"13\" rx=\"3\"/><path d=\"M2 10h20M6 15h4\"/></svg></div>\n        <div><h3>ເຕີມເງິນ / ແກ້ບັນຫາໄດ້ໄວຂຶ້ນ</h3><p>ເວລາເຕີມເງິນ ຫຼື ແຈ້ງບັນຫາ ພຽງບອກ <b>ຊື່ຜູ້ໃຊ້</b> ແອດມິນກໍເຈິບັນຊີ ແລະ ກວດຍອດ ຫຼື ປະຫວັດໃຫ້ໄດ້ທັນທີ</p></div>\n      </div>\n      <div class=\"why-item\">\n        <div class=\"why-ic\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5\"/><path d=\"M17 5.5a3.5 3.5 0 0 1 0 5M19.5 15c1.5.8 2.5 2.4 2.5 5\"/></svg></div>\n        <div><h3>ບໍ່ສັບສົນກັບຄົນອື່ນ</h3><p>ຊື່ແຕ່ລະຄົນ <b>ບໍ່ຊ້ຳກັນ</b> ລະບົບຈະກວດໃຫ້ກ່ອນຢືນຢັນ ເຮັດໃຫ້ບໍ່ມີຄົນສອງຄົນໃຊ້ຊື່ດຽວກັນ</p></div>\n      </div>\n      <div class=\"why-item\">\n        <div class=\"why-ic\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2.5\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/></svg></div>\n        <div><h3>ຕັ້ງຄັ້ງດຽວ ແລ້ວລັອກ</h3><p>ຫຼັງຢືນຢັນ <b>ຈະປ່ຽນຊື່ບໍ່ໄດ້</b> ເພື່ອໃຫ້ຂໍ້ມູນໃນລະບົບຖືກຕ້ອງ ແລະ ຄົ້ນຫາເຈິສະເໝີ ຈຶ່ງຄວນຄິດໃຫ້ດີກ່ອນ</p></div>\n      </div>\n    </div>\n    <div class=\"why-tip\">\n      <span>💡</span>\n      <div><b>ຄຳແນະນຳ:</b> ໃຊ້ຊື່ທີ່ຈື່ງ່າຍ ແລະ ເປັນຕົວທ່ານເອງ ເຊັ່ນ ຊື່ຫຼິ້ນ ຫຼື ຊື່ໃນເກມ (ພາສາອັງກິດ)\n        <div class=\"eg\"><span>Somchai_FF</span><span>nong.gamer</span><span>Lao-Pro99</span></div>\n      </div>\n    </div>\n  </section>\n  <div class=\"logout\"><a href=\"/auth/logout\">ອອກຈາກລະບົບ</a></div>\n </div>\n</div>\n\n";
  var SEEN_KEY = 'ng_intro_seen';
  var CSS_PRO = "\n/* ===== ฉากนับเวลา แบบเรียบ/มืออาชีพ (ทับสไตล์เดิม) ===== */\n.cd{background:radial-gradient(ellipse at 50% 40%,#140506 0%,#050505 65%);transition:opacity .7s ease}\n.cd.out{transform:none;filter:none;opacity:0}\n.cd-grid,.cd-dial .orb,.cd-pulse{display:none!important}\n.cd-box{gap:26px}\n.cd-lab{font-size:12px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:#8a8a8a;animation:none}\n.cd-lab::before{width:6px;height:6px;background:#ff3b3b;box-shadow:none;animation:blink 1.6s ease-in-out infinite}\n.cd-dial{width:min(58vw,230px)}\n.cd-dial .trk{stroke:rgba(255,255,255,.08);stroke-width:2}\n.cd-dial .prg{stroke:#ff3b3b;stroke-width:2.5;filter:none;transition:stroke-dashoffset .95s linear}\n.cd-num{font:600 clamp(70px,22vw,100px)/1 'Rajdhani','Noto Sans Lao',sans-serif;font-variant-numeric:tabular-nums;letter-spacing:-1px;color:#f4f4f4;text-shadow:none;padding-bottom:6px}\n.cd-num b::before,.cd-num b::after{display:none}\n.cd-num b.tick{animation:numRoll .65s cubic-bezier(.2,.8,.2,1) both}\n.cd-num b.last{background:none;color:#fff;filter:none}\n@keyframes numRoll{0%{opacity:0;transform:translateY(34%)}100%{opacity:1;transform:none}}\n.cd-num::after{content:\"/ 10\";position:absolute;left:0;right:0;bottom:20%;text-align:center;font:600 13px 'Rajdhani',sans-serif;letter-spacing:2px;color:#6d6d6d}\n.cd-seg{gap:5px}\n.cd-seg i{width:16px;height:2px;border-radius:2px;background:rgba(255,255,255,.12);transform:none!important;box-shadow:none!important;transition:background .35s}\n.cd-seg i.on,.cd-seg i.on:last-child{background:#ff3b3b}\n.cd-cap{font-size:12.5px;color:#7d7d7d;letter-spacing:.2px}\n.card-wrap{animation:cardRise .85s cubic-bezier(.2,.8,.2,1) both}\n@keyframes cardRise{0%{opacity:0;transform:translateY(28px) scale(.985)}100%{opacity:1;transform:none}}\n.card-wrap::before{animation-duration:9s;background:conic-gradient(from var(--a,0deg),transparent 0 72%,rgba(255,40,40,.75) 90%,transparent)}\n.card-wrap::after{opacity:.55;animation:none}\n";
  var CSS_EXTRA = "\n.alert{display:flex;gap:11px;align-items:center;margin-top:10px;padding:11px 13px;border-radius:14px;background:linear-gradient(90deg,rgba(255,0,1,.16),rgba(255,0,1,.05));border:1px solid rgba(255,70,70,.5);overflow:hidden;position:relative;max-height:0;opacity:0;transform:translateY(-10px) scale(.96);padding-top:0;padding-bottom:0;margin-top:0;border-width:0;transition:max-height .45s cubic-bezier(.2,.9,.25,1.1),opacity .3s,transform .45s cubic-bezier(.2,.9,.25,1.2),padding .35s,margin .35s}\n.alert.show{max-height:90px;opacity:1;transform:none;padding:11px 13px;margin-top:10px;border-width:1px}\n.alert::after{content:\"\";position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.14),transparent);transform:skewX(-20deg);animation:sweep 2.4s ease-in-out infinite}\n.al-ic{flex:none;position:relative;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#ff2a2a;color:#fff;font:900 19px 'Rajdhani',sans-serif;box-shadow:0 0 18px rgba(255,0,1,.7)}\n.alert.show .al-ic{animation:alWob .7s .15s cubic-bezier(.36,.07,.19,.97)}\n.al-ic::before{content:\"\";position:absolute;inset:0;border-radius:50%;border:2px solid #ff4a4a;animation:alPing 1.6s ease-out infinite}\n@keyframes alPing{0%{transform:scale(1);opacity:.9}100%{transform:scale(2);opacity:0}}\n@keyframes alWob{0%,100%{transform:rotate(0)}20%{transform:rotate(-18deg) scale(1.15)}40%{transform:rotate(14deg) scale(1.15)}60%{transform:rotate(-9deg)}80%{transform:rotate(5deg)}}\n.al-tx{display:flex;flex-direction:column;gap:2px;min-width:0}\n.al-tx b{font-size:13.5px;font-weight:800;color:#ffd0d0}\n.al-tx span{font-size:12px;color:#d9a0a0;line-height:1.5}\n.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}\n.chip{position:relative;display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(46,229,157,.45);background:rgba(46,229,157,.08);color:#d8ffee;font:700 14px 'Rajdhani','Noto Sans Lao',sans-serif;letter-spacing:.3px;padding:8px 13px 8px 11px;border-radius:99px;cursor:pointer;opacity:0;transform:translateY(12px) scale(.7);animation:chipIn .5s cubic-bezier(.3,1.6,.5,1) forwards;transition:background .2s,box-shadow .2s,transform .15s}\n.chip::before{content:\"✦\";font-size:11px;color:var(--ok);animation:twinkle 1.8s ease-in-out infinite}\n.chip:active{transform:scale(.94)}\n.chip:hover{background:rgba(46,229,157,.18);box-shadow:0 0 16px rgba(46,229,157,.35)}\n.chip.picked{animation:chipPick .45s ease forwards}\n@keyframes chipIn{to{opacity:1;transform:none}}\n@keyframes chipPick{0%{transform:scale(1)}40%{transform:scale(1.25);box-shadow:0 0 26px rgba(46,229,157,.8)}100%{transform:scale(1);opacity:.5}}\n@keyframes twinkle{50%{opacity:.35;transform:scale(.7) rotate(45deg)}}\n.input.hit{animation:hit .6s cubic-bezier(.36,.07,.19,.97)}\n@keyframes hit{0%{box-shadow:0 0 0 0 rgba(255,60,60,.8)}20%{transform:translateX(-9px)}40%{transform:translateX(9px)}60%{transform:translateX(-6px)}80%{transform:translateX(3px)}100%{transform:none;box-shadow:0 0 0 16px rgba(255,60,60,0)}}\n";

  function mount() {
    // @property ต้องอยู่ระดับ document (Shadow DOM ใช้ไม่ได้) — ใช้ทำขอบแสงหมุน
    if (!document.getElementById('ng-prop')) {
      var ps = document.createElement('style'); ps.id = 'ng-prop';
      ps.textContent = '@property --a{syntax:"<angle>";inherits:false;initial-value:0deg}';
      document.head.appendChild(ps);
    }
    if (!document.querySelector('link[href*="Orbitron"]')) {
      var fl = document.createElement('link'); fl.rel = 'stylesheet';
      fl.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;600;700;800&family=Orbitron:wght@700;900&family=Rajdhani:wght@500;600;700&display=swap';
      document.head.appendChild(fl);
    }

    var host = document.createElement('div');
    host.id = 'name-gate-host';
    document.body.appendChild(host);
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + CSS + CSS_EXTRA + CSS_PRO + '</style><div class="root">' + HTML + '</div>';

    // ล็อกหน้าเว็บด้านหลัง (เลื่อน/กด/แท็บไม่ได้)
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    Array.prototype.forEach.call(document.body.children, function (el) { if (el !== host) el.setAttribute('inert', ''); });

    var $ = function (i) { return root.getElementById(i); };
    var inp = $('name'), box = $('box'), st = $('st'), msg = $('msg'), go = $('go'), ava = $('ava'), card = $('card');
    var RE = /^[A-Za-z0-9._-]{3,24}$/;
    msg.insertAdjacentHTML('afterend', '<div class="alert" id="alert"><div class="al-ic">!</div><div class="al-tx"><b id="alT">ຊື່ນີ້ມີຄົນໃຊ້ແລ້ວ</b><span id="alS">ລອງຊື່ເຫຼົ່ານີ້ທີ່ຍັງວ່າງ — ແຕະເພື່ອໃຊ້</span></div></div><div class="chips" id="chips"></div>');
    var alertEl = $('alert'), chipsEl = $('chips');
    function hideTaken() { alertEl.classList.remove('show'); chipsEl.innerHTML = ''; }
    function showTaken(name, sugg) {
      box.classList.remove('hit'); void box.offsetWidth; box.classList.add('hit');
      ava.parentNode.classList.remove('pop'); 
      $('alT').textContent = 'ຊື່ "' + name + '" ມີຄົນໃຊ້ແລ້ວ';
      alertEl.classList.remove('show'); void alertEl.offsetWidth; alertEl.classList.add('show');
      chipsEl.innerHTML = '';
      if (sugg && sugg.length) {
        $('alS').textContent = 'ລອງຊື່ເຫຼົ່ານີ້ທີ່ຍັງວ່າງ — ແຕະເພື່ອໃຊ້';
        sugg.forEach(function (nm, i) {
          var c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.textContent = nm;
          c.style.animationDelay = (0.25 + i * 0.12) + 's';
          c.addEventListener('click', function () {
            c.classList.add('picked'); inp.value = nm; check();
            try { inp.focus({ preventScroll: true }); } catch (e) {}
          });
          chipsEl.appendChild(c);
        });
      } else { $('alS').textContent = 'ລອງເພີ່ມຕົວເລກ ຫຼື ຕົວອັກສອນທ້າຍຊື່'; }
    }
    var timer = null, seq = 0, valid = false, busy = false;
    var DEFAULT_MSG = 'ພາສາອັງກິດ ຕົວເລກ . _ - ເທົ່ານັ້ນ';

    function setStatus(c) { st.className = 'status ' + (c || ''); }
    function setMsg(t, c) { msg.textContent = t; msg.className = 'msg ' + (c || ''); }
    function rule(id, ok) { $(id).classList.toggle('ok', !!ok); }
    function bad(text) { setStatus('bad'); box.classList.add('bad'); setMsg(text, 'bad'); rule('r3', false); }

    function check() {
      var v = inp.value;
      var first = (v.trim()[0] || '?').toUpperCase();
      if (ava.textContent !== first) { ava.textContent = first; ava.classList.remove('pop'); void ava.offsetWidth; ava.classList.add('pop'); }
      rule('r1', v.length >= 3 && v.length <= 24);
      rule('r2', v.length > 0 && /^[A-Za-z0-9._-]+$/.test(v));
      valid = false; go.disabled = true; box.classList.remove('ok', 'bad'); clearTimeout(timer); seq++;
      hideTaken();
      if (!v) { setStatus(''); setMsg(DEFAULT_MSG); rule('r3', false); return; }
      if (!/^[A-Za-z0-9._-]*$/.test(v)) { bad('ໃຊ້ໄດ້ສະເພາະພາສາອັງກິດ ຕົວເລກ . _ - ເທົ່ານັ້ນ'); return; }
      if (v.length < 3) { setStatus(''); setMsg('ຕ້ອງມີຢ່າງໜ້ອຍ 3 ຕົວ'); rule('r3', false); return; }
      if (!RE.test(v)) return;
      setStatus('load'); setMsg('ກຳລັງກວດຊື່…'); rule('r3', false);
      var my = seq;
      timer = setTimeout(function () {
        fetch('/api/account/check-username?u=' + encodeURIComponent(v), { credentials: 'same-origin', cache: 'no-store' })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { r: r, d: d }; }); })
          .then(function (x) {
            if (my !== seq) return;
            if (x.r.status === 401) { location.reload(); return; }
            if (x.r.ok && x.d.available) {
              valid = true; go.disabled = false; setStatus('ok'); box.classList.add('ok'); setMsg('ໃຊ້ຊື່ນີ້ໄດ້!', 'ok'); rule('r3', true);
            } else if (x.r.ok) {
              if (x.d.reason === 'taken') { bad('ຊື່ນີ້ຖືກໃຊ້ແລ້ວ'); showTaken(v, x.d.suggestions); }
              else bad(x.d.reason === 'reserved' ? 'ຊື່ນີ້ຖືກສະຫງວນໄວ້ ລອງຊື່ອື່ນ' : 'ຮູບແບບຊື່ບໍ່ຖືກຕ້ອງ');
            } else {
              // ກວດບໍ່ໄດ້ຊົ່ວຄາວ — ໃຫ້ກົດຢືນຢັນໄດ້ (ເຊີບເວີຈະກວດຊ້ຳອີກຄັ້ງ)
              valid = true; go.disabled = false; setStatus(''); setMsg((x.d && x.d.error) || 'ກວດຊື່ບໍ່ໄດ້ຊົ່ວຄາວ — ກົດຢືນຢັນເພື່ອລອງໄດ້');
            }
          })
          .catch(function () {
            if (my !== seq) return;
            valid = true; go.disabled = false; setStatus(''); setMsg('ກວດຊື່ບໍ່ໄດ້ຊົ່ວຄາວ — ກົດຢືນຢັນເພື່ອລອງໄດ້');
          });
      }, 450);
    }
    inp.addEventListener('input', check);

    function shake() { box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); }
    function submit() {
      if (busy) return;
      if (!valid) { shake(); return; }
      busy = true; go.classList.add('busy'); go.disabled = true; go.querySelector('.t').textContent = 'ກຳລັງບັນທຶກ…';
      var name = inp.value.trim();
      fetch('/api/account/set-username', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name })
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { r: r, d: d }; }); })
        .then(function (x) {
          if (x.r.ok && x.d.ok) {
            $('nm').textContent = x.d.username || name;
            card.classList.add('is-done'); burst();
            setTimeout(function () { location.reload(); }, 2600);
            return;
          }
          if (x.d && x.d.alreadySet) { location.reload(); return; }
          if (x.r.status === 401) { location.reload(); return; }
          busy = false; go.classList.remove('busy'); go.querySelector('.t').textContent = 'ຢືນຢັນຊື່';
          valid = false; go.disabled = true; shake();
          if (x.r.status === 409) { bad((x.d && x.d.error) || 'ຊື່ນີ້ມີຄົນໃຊ້ແລ້ວ ລອງຊື່ອື່ນ'); if (x.d && x.d.taken) showTaken(name, x.d.suggestions); }
          else { setStatus('bad'); setMsg((x.d && x.d.error) || 'ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່', 'bad'); valid = true; go.disabled = false; }
        })
        .catch(function () {
          busy = false; go.classList.remove('busy'); go.querySelector('.t').textContent = 'ຢືນຢັນຊື່';
          setMsg('ເຊື່ອມຕໍ່ບໍ່ໄດ້ ກະລຸນາກວດເນັດແລ້ວລອງໃໝ່', 'bad'); go.disabled = false; shake();
        });
    }
    go.addEventListener('click', submit);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });

    /* ---------- อนุภาคพื้นหลัง + พลุ ---------- */
    var cv = $('fx'), cx = cv.getContext('2d'), W, H, dpr = Math.min(window.devicePixelRatio || 1, 2), P = [], B = [];
    function size() { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); addEventListener('resize', size);
    var N = Math.round(Math.min(46, W / 9));
    for (var i = 0; i < N; i++) P.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2 + .6, v: Math.random() * .5 + .15, s: Math.random() * Math.PI * 2, a: Math.random() * .5 + .2 });
    function burst(cc) {
      var r = card.getBoundingClientRect(), ox = r.left + r.width / 2, oy = r.top + r.height / 2, cols = cc || ['#2ee59d', '#ffffff', '#ff4a4a', '#e8b34a'];
      for (var k = 0; k < 90; k++) { var a = Math.random() * Math.PI * 2, s = Math.random() * 7 + 2; B.push({ x: ox, y: oy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, l: 1, c: cols[k % 4], r: Math.random() * 3 + 1.5 }); }
    }
    var last = 0;
    (function loop(t) {
      requestAnimationFrame(loop);
      if (t - last < 30) return; last = t;
      cx.clearRect(0, 0, W, H);
      for (var i = 0; i < P.length; i++) { var p = P[i]; p.y -= p.v; p.s += .02; p.x += Math.sin(p.s) * .3; if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
        cx.globalAlpha = p.a; cx.fillStyle = '#ff3b3b'; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill(); }
      for (var j = B.length - 1; j >= 0; j--) { var b = B[j]; b.x += b.vx; b.y += b.vy; b.vy += .18; b.vx *= .985; b.l -= .016;
        if (b.l <= 0) { B.splice(j, 1); continue; } cx.globalAlpha = b.l; cx.fillStyle = b.c; cx.beginPath(); cx.arc(b.x, b.y, b.r, 0, 6.283); cx.fill(); }
      cx.globalAlpha = 1;
    })(0);

    /* ---------- ลำดับเปิดตัว: รอ 1 วิ → นับ 1-10 → การ์ดเด้ง ---------- */
    var cd = $('cd'), cdn = $('cdn'), prg = $('prg'), seg = $('seg'), stack = $('stack'), flash = $('flash');
    var WAIT = 1000, STEP = 1000, TOTAL = 10, seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch (e) {}
    for (var q = 0; q < TOTAL; q++) seg.appendChild(document.createElement('i'));
    function pulse() {
      var d = document.createElement('span'); d.className = 'cd-pulse'; cdn.parentNode.appendChild(d);
      var a = d.animate([{ transform: 'scale(.6)', opacity: .7 }, { transform: 'scale(1.55)', opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' });
      a.onfinish = function () { d.remove(); };
    }
    function show(n) {
      var b = document.createElement('b'); b.textContent = n; b.setAttribute('data-t', n);
      b.className = 'tick' + (n === TOTAL ? ' last' : '');
      cdn.innerHTML = ''; cdn.appendChild(b); pulse();
      prg.style.strokeDashoffset = 566 * (1 - n / TOTAL);
      var els = seg.children; for (var i = 0; i < els.length; i++) els[i].classList.toggle('on', i < n);
      
    }
    function open() {
      try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
      cd.classList.add('out');
      setTimeout(function () {
        stack.classList.add('play');
        setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 1500);
        setTimeout(function () { cd.style.display = 'none'; }, 900);
      }, 350);
    }
    if (seen) {
      // เคยดูฉากนับเลขแล้วใน session นี้ → ข้ามไปเด้งการ์ดเลย
      cd.style.display = 'none';
      setTimeout(function () { stack.classList.add('play'); setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 1200); }, 150);
    } else {
      var n = 0;
      setTimeout(function () {
        show(++n);
        var iv = setInterval(function () {
          if (n >= TOTAL) { clearInterval(iv); setTimeout(open, STEP * .9); return; }
          show(++n);
        }, STEP);
      }, WAIT);
    }
  }

  function boot() {
    fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.loggedIn && d.user && d.user.needsUsername) mount(); })
      .catch(function () { /* เงียบ — ไม่ให้กระทบหน้าเว็บ */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
