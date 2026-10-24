/* admin-glass.js v2 — เอฟเฟกต์ภาพล้วน ๆ (ไม่แตะตรรกะ admin.js): จุดแสงตามนิ้ว, เอียง 3 มิติ, ทางลัด, แท็บลอยเลนส์เหลว, โผล่ตามการเลื่อน, ตัวเลขนับขึ้น */
(function(){'use strict';
/* ล็อกการซูม: ปิดบีบนิ้วซูม + แตะสองครั้งซูม (iOS Safari ไม่เชื่อ meta viewport) */
['gesturestart','gesturechange','gestureend'].forEach(function(t){document.addEventListener(t,function(e){e.preventDefault()},{passive:false})});
var lastTap=0,lx=0,ly=0;document.addEventListener('touchend',function(e){var n=Date.now(),p=e.changedTouches&&e.changedTouches[0],x=p?p.clientX:0,y=p?p.clientY:0,near=Math.abs(x-lx)<28&&Math.abs(y-ly)<28;if(n-lastTap<320&&near&&!(e.target.closest&&e.target.closest('input,textarea,select,[contenteditable],button,a,label,[data-goto],.switch-head')))e.preventDefault();lastTap=n;lx=x;ly=y},{passive:false});
/* ปิดซูมจากการแตะสองครั้งด้วย CSS แทน (ไม่กลืนคลิกของปุ่ม/การ์ด) */
(function(){var st=document.createElement('style');st.textContent='html,body,button,a,.d2-fn-card,.switch-head{touch-action:manipulation}';document.head.appendChild(st)})();
document.addEventListener('touchmove',function(e){if(e.touches&&e.touches.length>1)e.preventDefault()},{passive:false});

var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches,$=function(s,r){return(r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var P={home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',box:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',wallet:'<rect x="3" y="6" width="18" height="13" rx="3.5"/><path d="M3 10.5h18"/><circle cx="16.5" cy="14.8" r="1"/>',users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18.6 15c1.8.8 3 2.4 3.4 5"/>',sliders:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',plus:'<path d="M12 5v14M5 12h14"/>',key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',check:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'};
var ic=function(n){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+P[n]+'</svg>'};
var go=function(id){var c=$('.d2-fn-card[data-goto="'+id+'"]');if(c)c.click()};

/* จุดแสงตามนิ้ว + เอียงการ์ด */
var SEL='.d2-kpi,.d2-sum-card,.d2-challenge-card,.mt-card,.ops-chip,.g-chip';
if(!RM){
 var spot=document.createElement('div');spot.className='g-spot';document.body.appendChild(spot);var sx=0,sy=0,pend=false;
 var el=null;
 var tilt=function(c,e){var r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;c.classList.add('is-tilting');c.style.setProperty('--ry',((x-.5)*3.5).toFixed(2)+'deg');c.style.setProperty('--rx',((.5-y)*3).toFixed(2)+'deg');c.style.setProperty('--gx',(x*100).toFixed(1)+'%');c.style.setProperty('--gy',(y*100).toFixed(1)+'%');c.style.setProperty('--go',1)};
 var rst=function(c){if(!c)return;c.classList.remove('is-tilting');c.style.setProperty('--rx','0deg');c.style.setProperty('--ry','0deg');c.style.setProperty('--go',0)};
 document.addEventListener('pointermove',function(e){if(e.pointerType!=='mouse')return;sx=e.clientX;sy=e.clientY;if(!pend){pend=true;requestAnimationFrame(function(){pend=false;spot.style.transform='translate3d('+sx+'px,'+sy+'px,0)';spot.classList.add('on')})}
  if(e.pointerType!=='mouse')return;var c=e.target.closest&&e.target.closest(SEL);if(c!==el){rst(el);el=c}if(c)tilt(c,e)},{passive:true});
 ['pointerup','pointercancel','pointerleave'].forEach(function(t){document.addEventListener(t,function(){rst(el);el=null;if(t!=='pointerup')spot.classList.remove('on')},{passive:true})});
}

/* ทางลัดด่วน (ปุ่มกระจกเลื่อนข้างได้) */
var mt=$('#mtCard');
if(mt){var q=document.createElement('div');q.className='g-quick';
 [['plus','ເພີ່ມສິນຄ້າ','panelAdd'],['key','เติมลະຫັດ','panelCodes'],['check','ອະນຸມັດເຕີມເງິນ','panelTopup'],['users','ຕົວແທນ','panelAgent'],['tag','ໂຄ້ດສ່ວນຫຼຸດ','panelCoupons']].forEach(function(a){
  var b=document.createElement('button');b.type='button';b.className='g-chip';b.innerHTML='<i>'+ic(a[0])+'</i>'+a[1];b.onclick=function(){go(a[2])};q.appendChild(b)});
 mt.parentNode.insertBefore(q,mt.nextSibling)}

/* ===== แยกเป็นหลายหน้า: กดแท็บล่างแล้วเห็นเฉพาะของหมวดนั้น ===== */
var PG={panelAdd:'stock',panelManage:'stock',panelRemoveCodes:'stock',panelCodeVault:'stock',panelCodes:'stock',panelTopup:'money',panelCustomers:'money',panelCoupons:'money',panelAgent:'agent',panelSettings:'settings',panelDiscord:'settings'};
var ORDER=['home','stock','money','agent','settings'];
var META={home:['home','ພາບລວມ',''],stock:['box','ສິນຄ້າ','ເພີ່ມ ແກ້ໄຂ ຢຸດຂາຍ ແລະ ເຕີມລະຫັດສິນຄ້າ'],money:['wallet','ເຕີມເງິນ','ກວດສະລິບໂອນເງິນ ແລະ ຈັດການໂຄ້ດສ່ວນຫຼຸດ'],agent:['users','ຕົວແທນ','ຄີຍ໌ປົດລັອກ ລາຄາພິເສດ ແລະ ຈັດການຕົວແທນ'],settings:['sliders','ຕັ້ງຄ່າ','ໂລໂກ້ ໝວດໝູ່ QR ແລະ ຊ່ອງທາງໂຊເຊຍລ']};
var items=[],pageNow='';
function reg(el,pg){if(!el)return;el.dataset.gpg=pg;el.classList.add('g-it');items.push(el)}
['#mtCard','#opsStrip','.g-quick','.d2-kpi-row','.d2-sum-row','.d2-challenge-card','.d2-attn'].forEach(function(x){reg($(x),'home')});
$$('.d2-cat-group').forEach(function(g){var c=$('.d2-fn-card[data-goto]',g);reg(g,(c&&PG[c.dataset.goto])||'settings')});
$$('.deck>.switch').forEach(function(x){reg(x,PG[x.dataset.target]||'settings')});
var board=$('.d2-board');
if(board)ORDER.slice(1).forEach(function(k){var h=document.createElement('div');h.className='g-pagehead';h.innerHTML='<i>'+ic(META[k][0])+'</i><div><b>'+META[k][1]+'</b><span>'+META[k][2]+'</span></div>';board.parentNode.insertBefore(h,board);reg(h,k)});

/* แท็บลอย: เลนส์กระจกเหลว */
var dock=document.createElement('div');dock.className='g-dock';
dock.innerHTML='<nav><i class="g-lens"></i>'+ORDER.map(function(k,i){return '<button type="button" data-k="'+k+'"'+(i?'':' class="on"')+'>'+ic(META[k][0])+META[k][1]+'</button>'}).join('')+'<button type="button" class="g-out" data-act="logout">'+ic('logout')+'ອອກ</button></nav>';
document.body.appendChild(dock);
var lens=$('.g-lens',dock),bs=$$('button[data-k]',dock);
function showPage(k,o){
 if(!META[k])k='home';var ch=k!==pageNow;pageNow=k;var n=0;
 items.forEach(function(el){var on=el.dataset.gpg===k;el.classList.toggle('g-off',!on);if(on&&ch)el.style.animationDelay=(n++*.05)+'s'});
 var i=ORDER.indexOf(k);bs.forEach(function(b,x){b.classList.toggle('on',x===i)});
 lens.style.transform='translateX('+(i*100)+'%)';
 if(ch&&(!o||o.anim!==false)){lens.classList.remove('go');void lens.offsetWidth;lens.classList.add('go')}
 try{sessionStorage.setItem('gpg',k)}catch(e){}
 if(ch&&(!o||o.top!==false))window.scrollTo({top:0,behavior:'auto'});
}
bs.forEach(function(b){b.onclick=function(){if(navigator.vibrate)navigator.vibrate(8);showPage(b.dataset.k)}});
/* ปุ่มออก (ย้ายมาจากหัวข้อ): กดแล้วสั่ง #logoutBtn เดิม ให้ admin.js ทำงานต่อตามปกติ */
var outBtn=$('.g-out',dock);if(outBtn)outBtn.onclick=function(){if(navigator.vibrate)navigator.vibrate(8);var lb=document.getElementById('logoutBtn');if(lb)lb.click()};
/* กดทางลัด/รายการแจ้งเตือนที่อยู่คนละหน้า -> สลับหน้าก่อน แล้วปล่อยให้ admin.js เปิดแผงเดิมต่อ */
document.addEventListener('click',function(e){var g=e.target.closest&&e.target.closest('[data-goto]');if(g&&PG[g.dataset.goto])showPage(PG[g.dataset.goto],{top:false})},true);
var saved='home';try{saved=sessionStorage.getItem('gpg')||'home'}catch(e){}
showPage(saved,{anim:false,top:false});

/* หัวข้อยุบเล็กตอนเลื่อน */
var hd=$('.back-row');
addEventListener('scroll',function(){if(hd)hd.classList.toggle('scrolled',scrollY>30)},{passive:true});

/* ตัวเลขนับขึ้น (รูปแบบ 138.293.000) */
function count(n){var tx=n.textContent.trim();if(!/^[\d.,\s]+$/.test(tx))return;var dot=/\.\d{3}/.test(tx),T=parseInt(tx.replace(/\D/g,''),10);if(isNaN(T)||T<2||n.dataset.gd===tx)return;n.dataset.gd=tx;n.dataset.gb=1;var t0=performance.now();
 (function f(t){var p=Math.min(1,(t-t0)/1200),v=Math.round(T*(1-Math.pow(1-p,4))),s=dot?String(v).replace(/\B(?=(\d{3})+(?!\d))/g,'.'):String(v);n.textContent=p<1?s:tx;if(p<1)requestAnimationFrame(f);else setTimeout(function(){delete n.dataset.gb},50)})(t0)}
if(!RM&&window.MutationObserver)['d2KpiProducts','d2KpiStock','d2KpiTopup','d2KpiAgents','d2SumTopup','d2SumOrders'].forEach(function(id){var n=document.getElementById(id);if(!n)return;count(n);new MutationObserver(function(){if(!n.dataset.gb&&n.textContent.trim()!==n.dataset.gd)count(n)}).observe(n,{childList:true,characterData:true,subtree:true})});

/* ===== สวิตช์ปิด/เปิดเว็บ: บอกสถานะให้ตัวอ่านหน้าจอ (ตรรกะจริงอยู่ที่ maintenance-admin.js) ===== */
(function(){var mb=document.getElementById('mtBtn');if(!mb)return;mb.setAttribute('role','switch');
 var sync=function(){mb.setAttribute('aria-checked',mb.classList.contains('is-open-action')?'false':'true')};sync();
 if(window.MutationObserver)new MutationObserver(sync).observe(mb,{attributes:true,attributeFilter:['class']})})();

/* ===== การ์ดฟังก์ชัน (shared-element) =====
   กดการ์ดตัวเลือก -> การ์ดใบนั้นขยายจากตำแหน่ง/ขนาดเดิมเป็นการ์ดฟังก์ชันเต็มจอ (ทุกใบ)
   ปุ่ม X อยู่มุมบนซ้ายของการ์ด; กด X -> การ์ดหดลงมาที่ตำแหน่งเดิม ขนาดเท่าการ์ดเดิมพอดี
   - ใช้ Web Animations API (ไม่มี setTimeout คุมภาพ) · เนื้อหาในการ์ดมีขนาดคงที่ระหว่างเล่น จึงไม่คำนวณ layout ซ้ำทุกเฟรม
   - ยังสลับ class เดิม (.switch.open / .panel-content.open / .d2-open) เหมือน admin.js จึงไม่กระทบตรรกะอื่น
   - .switch (เนื้อหาจริง) ถูกย้ายเข้าการ์ดตอนเปิด และคืนที่เดิมตอนปิด */
(function(){'use strict';
 var $=function(s,r){return(r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
 if(!Element.prototype.animate)return;   /* เบราว์เซอร์เก่ามาก: ปล่อยให้ admin.js ทำงานแบบเดิม */
 var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches,K=RM?.01:1;
 var OPEN_EASE='cubic-bezier(.22,1,.36,1)',CLOSE_EASE='cubic-bezier(.32,.72,0,1)';
 var BG_CARD='rgba(16,7,9,.8)',BG_FULL='#0b0508';
 var cur=null,touched=false,docEl=document.documentElement;
 var panelOf=function(c){return $('.switch[data-target="'+c.getAttribute('data-goto')+'"]')};
 var bodyOf=function(c){return document.getElementById(c.getAttribute('data-goto'))};
 function sh(sw){try{if(sw&&typeof syncSwitchHeight==='function')syncSwitchHeight(sw)}catch(e){}}
 function mk(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
 function stripIds(n){$$('[id]',n).forEach(function(x){x.removeAttribute('id')});['id','data-goto','data-bound'].forEach(function(a){n.removeAttribute(a)})}
 function dockHide(on){var d=$('.g-dock');if(d)d.classList.toggle('hide',on)}
 function cancelAll(S){S.anims.forEach(function(a){try{a.cancel()}catch(e){}});S.anims=[]}
 function box(r){return{top:r.top+'px',left:r.left+'px',width:r.width+'px',height:r.height+'px'}}
 /* สำเนาหน้าการ์ดเดิม (ไอคอน+ชื่อ+ลูกศร) ไว้ครอสเฟดระหว่างขยาย/หด */
 function makeFace(c,w,h){var f=c.cloneNode(true);stripIds(f);f.classList.remove('d2-open','g-it');f.classList.add('xp-face');f.style.width=w+'px';f.style.height=h+'px';f.setAttribute('aria-hidden','true');return f}

 /* ตอนเข้าหน้า admin.js เปิดแผงแรกค้างไว้ -> ปิดให้เหลือแต่การ์ด (จนกว่าผู้ใช้จะกดเอง) */
 function resetClosed(){if(touched||cur)return;
  $$('.switch[data-target].open').forEach(function(s){s.classList.remove('open');sh(s)});
  $$('.panel-content.open').forEach(function(p){p.classList.remove('open')});
  $$('.d2-fn-card.d2-open').forEach(function(c){c.classList.remove('d2-open')})}
 if(window.MutationObserver){var mo=new MutationObserver(resetClosed);$$('.switch[data-target]').forEach(function(s){mo.observe(s,{attributes:true,attributeFilter:['class']})})}
 resetClosed();addEventListener('load',resetClosed);[400,1200,2500].forEach(function(t){setTimeout(resetClosed,t)});

 /* ---------- เปิด: การ์ดขยายจากตำแหน่งเดิม ---------- */
 function openIt(c){
  var sw=panelOf(c),pn=bodyOf(c);if(!sw||!pn)return;
  touched=true;
  /* ให้การ์ดนิ่งก่อนวัดตำแหน่ง (กรณีเพิ่งสลับหน้า / อนิเมชันโผล่ของหน้ายังเล่นอยู่) */
  var grp=c.closest('.g-it');if(grp)grp.getAnimations().forEach(function(a){try{a.finish()}catch(e){}});
  var r=c.getBoundingClientRect(),vh=window.innerHeight,vw=docEl.clientWidth;
  if(r.height&&(r.top<8||r.bottom>vh-8)){            /* การ์ดอยู่นอกจอ -> เลื่อนมากลางจอแบบทันที */
   docEl.style.scrollBehavior='auto';window.scrollTo(0,window.pageYOffset+r.top-Math.max(8,(vh-r.height)/2));docEl.style.scrollBehavior='';
   r=c.getBoundingClientRect()}
  if(!r.width)r={top:vh/2-32,left:8,width:vw-16,height:64};
  var cs=getComputedStyle(c),R=(parseFloat(cs.borderTopLeftRadius)||26)+'px',rail=cs.getPropertyValue('--rail-color').trim();
  var S={card:c,sw:sw,pn:pn,phase:'opening',anims:[],timer:0,done:false};
  var title=$('.d2-fn-title',c),desc=$('.d2-fn-desc',c),icon=$('.d2-fn-icon',c);

  S.root=mk('div','xp xp-anim');S.root.setAttribute('role','dialog');S.root.setAttribute('aria-modal','true');
  S.root.setAttribute('aria-label',title?title.textContent.trim():'');
  if(rail)S.root.style.setProperty('--rail-color',rail);
  S.scrim=mk('div','xp-scrim');S.shell=mk('div','xp-card');S.inner=mk('div','xp-inner');
  var head=mk('div','xp-head');
  S.x=mk('button','xp-x','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>');S.x.type='button';S.x.setAttribute('aria-label','ປິດ');
  head.appendChild(S.x);
  if(icon){var ic=icon.cloneNode(true);stripIds(ic);head.appendChild(ic)}
  var tt=mk('div','xp-ttl'),b=mk('b');b.textContent=title?title.textContent.trim():'';tt.appendChild(b);
  if(desc){var sp=mk('span');sp.textContent=desc.textContent.trim();tt.appendChild(sp)}
  head.appendChild(tt);
  S.scroll=mk('div','xp-scroll');S.inner.appendChild(head);S.inner.appendChild(S.scroll);
  S.face=makeFace(c,r.width,r.height);
  S.shell.appendChild(S.inner);S.shell.appendChild(S.face);S.root.appendChild(S.scrim);S.root.appendChild(S.shell);

  /* ย้ายเนื้อหาจริง (.switch) เข้าการ์ด โดยวางตัวกันที่ไว้เท่าเดิม หน้าข้างหลังจะได้ไม่ขยับ */
  var h0=sw.getBoundingClientRect().height;
  S.ph=mk('div','xp-ph');S.ph.style.height=h0+'px';S.ph.style.flex='none';
  sw.parentNode.insertBefore(S.ph,sw);sw.style.animation='none';S.scroll.appendChild(sw);
  sw.classList.add('open');pn.classList.add('open');c.classList.add('d2-open');
  document.body.appendChild(S.root);docEl.classList.add('xp-lock');dockHide(true);sh(sw);

  var F=S.shell.getBoundingClientRect();                     /* ขนาดปลายทาง (จาก CSS) */
  S.inner.style.width=F.width+'px';S.inner.style.height=F.height+'px';
  c.style.visibility='hidden';cur=S;

  var D=Math.round(640*K);
  function A(el,kf,o){var a=el.animate(kf,o);S.anims.push(a);return a}
  var kA=box(r);kA.borderRadius=R;var kB=box(F);kB.borderRadius='30px';
  var main=A(S.shell,[kA,kB],{duration:D,easing:OPEN_EASE,fill:'both'});
  A(S.shell,[{backgroundColor:BG_CARD},{backgroundColor:BG_FULL}],{duration:260*K,easing:'ease-out',fill:'both'});
  A(S.scrim,[{opacity:0},{opacity:1}],{duration:420*K,easing:'ease-out',fill:'both'});
  A(S.face,[{opacity:1},{opacity:0}],{duration:200*K,easing:'ease-in',fill:'forwards'});
  A(S.inner,[{opacity:0,transform:'translate3d(0,16px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:460*K,delay:170*K,easing:OPEN_EASE,fill:'backwards'});
  /* ไอคอน/ข้อความ/ช่องกรอก โผล่แบบเบลอแล้วคมชัดขึ้นทีละชิ้น (แยกจากอนิเมชันหลัก เพื่อไม่ถูกตัดตอนการ์ดขยายเสร็จ) */
  S.rv=[];revealItems(S).forEach(function(e,i){S.rv.push(e.animate([{opacity:0,filter:'blur(12px)',transform:'translate3d(0,12px,0) scale(.97)'},{opacity:1,filter:'blur(0px)',transform:'translate3d(0,0,0) scale(1)'}],{duration:560*K,delay:(200+Math.min(i,9)*55)*K,easing:OPEN_EASE,fill:'backwards'}))});
  main.onfinish=function(){openEnd(S)};
  S.timer=setTimeout(function(){openEnd(S)},D+250);          /* กันค้าง ถ้า onfinish ไม่ยิง */
  S.x.addEventListener('click',function(e){e.stopPropagation();closeIt()});
  S.scrim.addEventListener('click',closeIt);
 }
 function revealItems(S){var hd=$('.xp-head',S.inner),host=$('.stat-panel',S.scroll)||S.scroll;return $$(':scope > *',hd).concat($$(':scope > *',host).filter(function(x){return x.offsetHeight>0}).slice(0,10))}
 function openEnd(S){
  if(S.done||S.phase!=='opening')return;S.phase='open';clearTimeout(S.timer);
  cancelAll(S);S.inner.style.width='';S.inner.style.height='';
  if(S.face.parentNode)S.face.parentNode.removeChild(S.face);
  S.root.classList.remove('xp-anim');sh(S.sw);
  try{S.x.focus({preventScroll:true})}catch(e){}}

 /* ---------- ปิด: การ์ดหดกลับที่เดิม ขนาดเท่าการ์ดเดิม ---------- */
 function closeIt(){
  var S=cur;if(!S||S.done||S.phase==='closing')return;
  if(S.phase==='opening')openEnd(S);                         /* กดปิดระหว่างเปิด: ข้ามไปสถานะเปิดสมบูรณ์ก่อน แล้วปิดต่อทันที */
  (S.rv||[]).forEach(function(a){try{a.cancel()}catch(e){}});
  S.phase='closing';var c=S.card;
  c.classList.remove('d2-open');
  var r=c.getBoundingClientRect(),F=S.shell.getBoundingClientRect();   /* วัดใหม่ตอนปิด (เผื่อจอ/ข้อมูลเปลี่ยน) */
  var R=(parseFloat(getComputedStyle(c).borderTopLeftRadius)||26)+'px';
  S.inner.style.width=F.width+'px';S.inner.style.height=F.height+'px';
  S.root.classList.add('xp-anim');
  if(S.face.parentNode)S.face.parentNode.removeChild(S.face);
  S.face=makeFace(c,r.width,r.height);S.shell.appendChild(S.face);   /* หน้าการ์ดใหม่ (ป้ายตัวเลขอัปเดตแล้ว) */
  dockHide(false);
  var D=Math.round(560*K);
  function A(el,kf,o){var a=el.animate(kf,o);S.anims.push(a);return a}
  var kA=box(F);kA.borderRadius='30px';var kB=box(r);kB.borderRadius=R;
  var main=A(S.shell,[kA,kB],{duration:D,easing:CLOSE_EASE,fill:'forwards'});
  A(S.shell,[{backgroundColor:BG_FULL},{backgroundColor:BG_FULL,offset:.45},{backgroundColor:BG_CARD}],{duration:D,easing:'linear',fill:'forwards'});
  A(S.scrim,[{opacity:1},{opacity:0}],{duration:D,easing:'ease-in-out',fill:'forwards'});
  A(S.inner,[{opacity:1,transform:'translate3d(0,0,0)'},{opacity:0,transform:'translate3d(0,10px,0)'}],{duration:320*K,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
  A(S.face,[{opacity:0},{opacity:0,offset:.35},{opacity:1}],{duration:D,easing:'ease-out',fill:'both'});
  /* ตอนปิด: ไอคอน/ข้อความ/เนื้อหา เบลอแล้วจางหายทีละชิ้น + หน้าการ์ดเดิมค่อยๆ ชัดขึ้นจากเบลอ */
  revealItems(S).forEach(function(e,i){A(e,[{opacity:1,filter:'blur(0px)',transform:'scale(1)'},{opacity:0,filter:'blur(12px)',transform:'scale(.97)'}],{duration:300*K,delay:Math.min(i,6)*20*K,easing:'ease-in',fill:'forwards'})});
  A(S.face,[{filter:'blur(12px)'},{filter:'blur(12px)',offset:.35},{filter:'blur(0px)'}],{duration:D,easing:'ease-out',fill:'both'});
  main.onfinish=function(){closeEnd(S)};
  S.timer=setTimeout(function(){closeEnd(S)},D+250);
 }
 function closeEnd(S){
  if(S.done)return;S.done=true;clearTimeout(S.timer);cancelAll(S);
  S.sw.classList.remove('open');S.pn.classList.remove('open');S.card.classList.remove('d2-open');
  if(S.ph&&S.ph.parentNode)S.ph.parentNode.replaceChild(S.sw,S.ph);   /* คืน .switch ที่เดิม */
  S.card.style.visibility='';                                          /* โชว์การ์ดจริง + ลบการ์ดจำลอง ในเฟรมเดียวกัน = ไม่มีกระพริบ */
  if(S.root.parentNode)S.root.parentNode.removeChild(S.root);
  docEl.classList.remove('xp-lock');dockHide(false);sh(S.sw);
  if(cur===S)cur=null}
 function closeNow(){var S=cur;if(!S)return;if(S.phase==='opening')openEnd(S);closeEnd(S)}

 document.addEventListener('click',function(e){
  var t=e.target;if(!t.closest)return;
  if(t.closest('.g-dock button[data-k]')){closeNow();return}
  if(t.closest('.xp'))return;
  var el=t.closest('[data-goto]');if(!el||el.classList.contains('g-quick'))return;
  var c=el.classList.contains('d2-fn-card')?el:$('.d2-fn-card[data-goto="'+el.getAttribute('data-goto')+'"]');
  if(!c||!panelOf(c))return;
  e.stopImmediatePropagation();e.preventDefault();       /* ไม่ให้ admin.js สลับ accordion เดิมซ้อน */
  if(cur){if(cur.card===c)return;closeNow()}
  openIt(c)},true);
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&cur)closeIt()});
 /* กลับมาที่แท็บ/แอป: เบราว์เซอร์อาจหยุดอนิเมชันค้างกลางทาง -> เก็บให้เข้าสถานะสุดท้าย */
 function settle(){var S=cur;if(!S)return;if(S.phase==='opening')openEnd(S);else if(S.phase==='closing')closeEnd(S)}
 document.addEventListener('visibilitychange',function(){if(!document.hidden)settle()});
 addEventListener('pageshow',settle);
})();

})();

/* ===== เปิดแผงตามที่เลือกมาจากไอคอนแอดมินลอยในหน้าร้าน (admin-fab.js ฝากชื่อแผงไว้ใน sessionStorage 'adminOpen') =====
   รอจน admin.js แสดงหน้าแอดมินและผูกการ์ดเสร็จ แล้วสั่งกดการ์ดใบนั้นให้เอง (ครั้งเดียว ไม่เปิดซ้ำตอนรีเฟรช) */
(function(){'use strict';
 var id=null;try{id=sessionStorage.getItem('adminOpen');sessionStorage.removeItem('adminOpen')}catch(e){}
 if(!id||!/^panel[A-Za-z]+$/.test(id))return;
 var tries=0;
 (function wait(){
  var app=document.getElementById('adminApp'),c=document.querySelector('.d2-fn-card[data-goto="'+id+'"]');
  if(app&&app.style.display==='block'&&c&&c.dataset.bound){setTimeout(function(){c.click()},450);return}
  if(++tries<100)setTimeout(wait,150);
 })();
})();
