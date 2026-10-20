/* admin-glass.js v2 — เอฟเฟกต์ภาพล้วน ๆ (ไม่แตะตรรกะ admin.js): จุดแสงตามนิ้ว, เอียง 3 มิติ, ทางลัด, แท็บลอยเลนส์เหลว, โผล่ตามการเลื่อน, ตัวเลขนับขึ้น */
(function(){'use strict';
/* ล็อกการซูม: ปิดบีบนิ้วซูม + แตะสองครั้งซูม (iOS Safari ไม่เชื่อ meta viewport) */
['gesturestart','gesturechange','gestureend'].forEach(function(t){document.addEventListener(t,function(e){e.preventDefault()},{passive:false})});
var lastTap=0;document.addEventListener('touchend',function(e){var n=Date.now();if(n-lastTap<320&&!(e.target.closest&&e.target.closest('input,textarea,select,[contenteditable]')))e.preventDefault();lastTap=n},{passive:false});
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
 [['plus','ເພີ່ມສິນຄ້າ','panelAdd'],['key','เติมลະຫັດ','panelCodes'],['check','ອະນຸມັດເຕີມເງິນ','panelTopup'],['tag','ໂຄ້ດສ່ວນຫຼຸດ','panelCoupons']].forEach(function(a){
  var b=document.createElement('button');b.type='button';b.className='g-chip';b.innerHTML='<i>'+ic(a[0])+'</i>'+a[1];b.onclick=function(){go(a[2])};q.appendChild(b)});
 mt.parentNode.insertBefore(q,mt.nextSibling)}

/* ===== แยกเป็นหลายหน้า: กดแท็บล่างแล้วเห็นเฉพาะของหมวดนั้น ===== */
var PG={panelAdd:'stock',panelManage:'stock',panelRemoveCodes:'stock',panelCodeVault:'stock',panelCodes:'stock',panelTopup:'money',panelCustomers:'money',panelCoupons:'money',panelSettings:'settings',panelDiscord:'settings'};
var ORDER=['home','stock','money','settings'];
var META={home:['home','ພາບລວມ',''],stock:['box','ສິນຄ້າ','ເພີ່ມ ແກ້ໄຂ ຢຸດຂາຍ ແລະ ເຕີມລະຫັດສິນຄ້າ'],money:['wallet','ເຕີມເງິນ','ກວດສະລິບໂອນເງິນ ແລະ ຈັດການໂຄ້ດສ່ວນຫຼຸດ'],settings:['sliders','ຕັ້ງຄ່າ','ໂລໂກ້ ໝວດໝູ່ QR ແລະ ຊ່ອງທາງໂຊເຊຍລ']};
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
if(!RM&&window.MutationObserver)['d2KpiProducts','d2KpiStock','d2KpiTopup','d2SumTopup','d2SumOrders'].forEach(function(id){var n=document.getElementById(id);if(!n)return;count(n);new MutationObserver(function(){if(!n.dataset.gb&&n.textContent.trim()!==n.dataset.gd)count(n)}).observe(n,{childList:true,characterData:true,subtree:true})});

/* ===== สวิตช์ปิด/เปิดเว็บ: บอกสถานะให้ตัวอ่านหน้าจอ (ตรรกะจริงอยู่ที่ maintenance-admin.js) ===== */
(function(){var mb=document.getElementById('mtBtn');if(!mb)return;mb.setAttribute('role','switch');
 var sync=function(){mb.setAttribute('aria-checked',mb.classList.contains('is-open-action')?'false':'true')};sync();
 if(window.MutationObserver)new MutationObserver(sync).observe(mb,{attributes:true,attributeFilter:['class']})})();

/* ===== เมนูฟังก์ชันแบบไอคอนกลม =====
   กดไอคอน -> อีก 2 อันเลื่อนซ้ายหาย + ป้ายหดเข้าไอคอน + แผงเด้งออกจากไอคอน; กดซ้ำ -> ย้อนกลับ
   อนิเมชันใช้ transform/opacity ล้วน (ไม่ขยับ layout ระหว่างเล่น) จึงลื่น
   คุมการเปิด/ปิดแผงแทน d2GoToPanel ใน admin.js (สลับ class open เหมือนกัน: .switch, .panel-content, .d2-open) */
(function(){'use strict';
 var $=function(s,r){return(r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
 var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches,K=RM?.01:1;
 var cur=null,busy=false,touched=false,SP='cubic-bezier(.22,1,.36,1)',EZ='cubic-bezier(.2,1.08,.3,1)';
 if(!Element.prototype.animate)return;
 var panelOf=function(c){return $('.switch[data-target="'+c.getAttribute('data-goto')+'"]')};
 var bodyOf=function(c){return document.getElementById(c.getAttribute('data-goto'))};
 var cardsOf=function(g){return $$('.d2-fn-card[data-goto]',g)};
 var txt=function(c){return $('.d2-fn-text',c)};
 function setOpen(c,on){var sw=panelOf(c),b=bodyOf(c);if(sw)sw.classList.toggle('open',on);if(b)b.classList.toggle('open',on);c.classList.toggle('d2-open',on)}
 function origin(sw,icon,box){var i=icon.getBoundingClientRect();sw.style.transformOrigin=(i.left+i.width/2-box.left)+'px '+(i.top+i.height/2-box.top)+'px'}
 function clean(sw){['width','top','left','transformOrigin','willChange'].forEach(function(k){sw.style[k]=''});sw.classList.remove('g-float')}
 function clearAll(){
  $$('.switch[data-target],.d2-fn-card,.d2-fn-text').forEach(function(x){x.getAnimations().forEach(function(a){a.cancel()})});
  $$('.switch[data-target]').forEach(function(x){x.classList.remove('open');clean(x)});
  $$('.panel-content.open').forEach(function(x){x.classList.remove('open')});
  $$('.d2-fn-card').forEach(function(x){x.classList.remove('g-me','d2-open','g-ghost');x.style.top=''});
  $$('.d2-cat-cards.g-picked').forEach(function(g){g.classList.remove('g-picked')});
  cur=null;busy=false}
 /* ตอนเข้าหน้า admin.js เปิดแผงแรกค้างไว้ -> ปิดให้เหลือแต่ไอคอน (จนกว่าผู้ใช้จะกดเอง) */
 if(window.MutationObserver){var mo=new MutationObserver(function(){if(!touched&&!cur&&$('.switch.open[data-target]'))clearAll()});
  $$('.switch[data-target]').forEach(function(s){mo.observe(s,{attributes:true,attributeFilter:['class']})})}
 (function(){var f=function(){if(!touched&&!cur)clearAll()};f();addEventListener('load',f);[400,1200,2500].forEach(function(t){setTimeout(f,t)})})();

 function openIt(c){
  var g=c.closest('.d2-cat-cards'),sw=panelOf(c),icon=$('.d2-fn-icon',c);if(!g||!sw||!icon)return;
  touched=true;cur=c;busy=true;
  var all=cardsOf(g),cr=g.getBoundingClientRect(),R=all.map(function(x){return x.getBoundingClientRect()}),k=all.indexOf(c),others=[];
  all.forEach(function(x,i){if(x===c)return;x.style.top=(R[i].top-cr.top)+'px';x.classList.add('g-ghost');others.push(x)});
  g.classList.add('g-picked');c.classList.add('g-me');setOpen(c,true);
  origin(sw,icon,sw.getBoundingClientRect());
  var dy=R[k].top-c.getBoundingClientRect().top;
  if(dy)c.animate([{transform:'translateY('+dy+'px)'},{transform:'none'}],{duration:560*K,easing:SP});
  others.forEach(function(x,i){var a=x.animate([{transform:'none',opacity:1},{transform:'translateX(-115%)',opacity:0}],{duration:440*K,delay:i*45*K,easing:'cubic-bezier(.45,0,.2,1)',fill:'both'});
   a.onfinish=function(){x.classList.remove('g-ghost');x.style.top='';a.cancel()}});
  txt(c).animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateX(-26px)'}],{duration:240*K,easing:'ease-in'});
  sw.style.willChange='transform,opacity';
  sw.animate([{opacity:0},{opacity:1}],{duration:200*K,delay:110*K,easing:'ease-out',fill:'backwards'});
  var a=sw.animate([{transform:'scale(.04)'},{transform:'scale(1)'}],{duration:640*K,delay:110*K,easing:EZ,fill:'backwards'});
  a.onfinish=function(){sw.style.willChange='';sw.style.transformOrigin='';busy=false};
  setTimeout(function(){busy=false},820*K+20)}

 function closeIt(){
  var c=cur,g=c.closest('.d2-cat-cards'),sw=panelOf(c),icon=$('.d2-fn-icon',c);busy=true;cur=null;
  var P=sw.getBoundingClientRect(),y0=c.getBoundingClientRect().top;
  sw.style.width=P.width+'px';sw.style.willChange='transform,opacity';sw.classList.add('g-float');
  g.classList.remove('g-picked');c.classList.remove('g-me');
  var op=sw.offsetParent||g,D=op.getBoundingClientRect();
  sw.style.top=(P.top-D.top)+'px';sw.style.left=(P.left-D.left)+'px';
  origin(sw,icon,P);
  var dy=y0-c.getBoundingClientRect().top;
  if(dy)c.animate([{transform:'translateY('+dy+'px)'},{transform:'none'}],{duration:560*K,easing:SP});
  var n=0;cardsOf(g).forEach(function(x){
   if(x!==c)x.animate([{transform:'translateX(-115%)',opacity:0},{transform:'none',opacity:1}],{duration:560*K,delay:(200+(n++)*55)*K,easing:SP,fill:'backwards'});
   txt(x).animate([{opacity:0,transform:'translateX(-26px)'},{opacity:1,transform:'none'}],{duration:480*K,delay:430*K,easing:SP,fill:'backwards'})});
  var o=sw.animate([{opacity:1},{opacity:1,offset:.55},{opacity:0}],{duration:500*K,easing:'linear',fill:'forwards'});
  var a=sw.animate([{transform:'scale(1)'},{transform:'scale(.04)'}],{duration:500*K,easing:'cubic-bezier(.5,0,.2,1)',fill:'forwards'});
  a.onfinish=function(){setOpen(c,false);a.cancel();o.cancel();clean(sw)};
  setTimeout(function(){busy=false},1000*K+20)}

 document.addEventListener('click',function(e){
  var t=e.target;if(!t.closest)return;
  if(t.closest('.g-dock button[data-k]')){clearAll();return}
  var el=t.closest('[data-goto]');if(!el||el.classList.contains('g-quick'))return;
  var c=el.classList.contains('d2-fn-card')?el:$('.d2-fn-card[data-goto="'+el.getAttribute('data-goto')+'"]');
  if(!c||!panelOf(c))return;
  e.stopImmediatePropagation();e.preventDefault();if(busy)return;touched=true;
  if(cur===c){if(el===c)closeIt();return}      /* กดแถวแจ้งเตือนของแผงที่เปิดอยู่แล้ว = ไม่ทำอะไร */
  if(cur)clearAll();openIt(c)},true);
})();

})();
