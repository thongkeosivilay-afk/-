(function(){

var $=function(i){return document.getElementById(i)};
const SOCIAL_META = {
    facebook: {
      name: 'Facebook', color: '#1877F2',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.6h2.55l.38-2.96h-2.93V8.55c0-.86.24-1.44 1.47-1.44h1.57V4.46A20.9 20.9 0 0 0 14.3 4.3c-2.25 0-3.79 1.37-3.79 3.89v2.25H8v2.96h2.51V21h2.99Z"/></svg>',
    },
    discord: {
      name: 'Discord', color: '#5865F2',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.3 5.4A17.6 17.6 0 0 0 15.9 4a.06.06 0 0 0-.07.03c-.2.34-.4.79-.56 1.14a16.4 16.4 0 0 0-4.87 0c-.15-.36-.36-.8-.57-1.14A.07.07 0 0 0 9.86 4c-1.4.24-2.75.66-4.02 1.4a.06.06 0 0 0-.03.02C3.1 8.8 2.4 12.1 2.7 15.4a.07.07 0 0 0 .03.05 17.7 17.7 0 0 0 5.3 2.65.07.07 0 0 0 .08-.02c.4-.56.77-1.15 1.08-1.77a.07.07 0 0 0-.04-.1 11.6 11.6 0 0 1-1.67-.79.07.07 0 0 1 0-.12c.11-.08.22-.17.33-.26a.07.07 0 0 1 .07 0c3.5 1.6 7.3 1.6 10.76 0a.07.07 0 0 1 .07 0c.11.09.22.18.33.26a.07.07 0 0 1 0 .12c-.53.31-1.09.57-1.67.79a.07.07 0 0 0-.04.1c.32.62.69 1.21 1.08 1.77a.07.07 0 0 0 .08.02 17.6 17.6 0 0 0 5.32-2.65.07.07 0 0 0 .03-.05c.36-3.8-.6-7.08-2.55-10a.06.06 0 0 0-.03-.03ZM8.68 13.4c-.94 0-1.71-.87-1.71-1.94 0-1.06.76-1.93 1.71-1.93.96 0 1.73.88 1.71 1.93 0 1.07-.76 1.94-1.71 1.94Zm6.65 0c-.94 0-1.71-.87-1.71-1.94 0-1.06.76-1.93 1.71-1.93.96 0 1.73.88 1.71 1.93 0 1.07-.75 1.94-1.71 1.94Z"/></svg>',
    },
    line: {
      name: 'Line', color: '#06C755',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.48 3 2 6.58 2 11c0 3.95 3.56 7.26 8.37 7.9.33.07.77.22.88.5.1.26.07.66.03.92l-.14.85c-.04.26-.2 1 .87.55 1.07-.46 5.77-3.4 7.87-5.83C21.3 13.85 22 12.5 22 11c0-4.42-4.48-8-10-8Zm-3.9 10.4H6.6a.4.4 0 0 1-.4-.4V8.9c0-.22.18-.4.4-.4s.4.18.4.4v3.7h1.1c.22 0 .4.18.4.4s-.18.4-.4.4Zm2.05 0a.4.4 0 0 1-.4-.4V8.9c0-.22.18-.4.4-.4s.4.18.4.4V13c0 .22-.18.4-.4.4Zm4.75 0a.4.4 0 0 1-.32-.16l-2.03-2.75V13c0 .22-.18.4-.4.4s-.4-.18-.4-.4V8.9c0-.18.11-.33.28-.38a.4.4 0 0 1 .44.14l2.03 2.75V8.9c0-.22.18-.4.4-.4s.4.18.4.4V13c0 .18-.11.33-.28.38a.4.4 0 0 1-.12.02Zm3.7-3.29c.22 0 .4.18.4.4s-.18.4-.4.4h-1.5v.89h1.5c.22 0 .4.18.4.4s-.18.4-.4.4h-1.9a.4.4 0 0 1-.4-.4V8.9c0-.22.18-.4.4-.4h1.9c.22 0 .4.18.4.4s-.18.4-.4.4h-1.5v.81h1.5Z"/></svg>',
    },
    telegram: {
      name: 'Telegram', color: '#26A5E4',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.4 4.6 2.9 11.8c-.9.36-.9 1.65.03 1.98l4.4 1.53 1.7 5.4c.24.75 1.2.95 1.73.36l2.5-2.8 4.6 3.4c.72.53 1.75.14 1.94-.73l3.13-14.5c.22-1-.75-1.83-1.53-1.34ZM8.9 14.9l-1.2-4 9.6-6.35c.16-.1.33.11.19.24L9.6 12.9l-.22 2Z"/></svg>',
    },
    whatsapp: {
      name: 'WhatsApp', color: '#25D366',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.28-.14-1.64-.8-1.9-.9-.25-.09-.44-.14-.62.14-.18.28-.72.9-.88 1.08-.16.18-.32.2-.6.07-.28-.14-1.18-.43-2.24-1.37-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.18-.28.28-.46.09-.18.05-.34-.02-.48-.07-.14-.62-1.5-.85-2.05-.22-.53-.45-.46-.62-.47h-.53c-.18 0-.48.07-.73.34-.25.28-.96.94-.96 2.28 0 1.34.98 2.64 1.12 2.82.14.18 1.93 2.95 4.68 4.14.65.28 1.16.45 1.56.58.66.21 1.25.18 1.72.11.53-.08 1.64-.67 1.87-1.32.23-.65.23-1.2.16-1.32-.07-.12-.25-.19-.53-.33Z"/><path d="M12.04 2C6.5 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.08L2 22l5.06-1.33A9.96 9.96 0 0 0 12.04 22C17.6 22 22 17.5 22 12S17.6 2 12.04 2Zm0 18.14c-1.68 0-3.24-.5-4.55-1.35l-.33-.2-3.34.88.9-3.25-.22-.34a8.12 8.12 0 0 1-1.28-4.4c0-4.5 3.68-8.15 8.22-8.15 4.53 0 8.22 3.66 8.22 8.15 0 4.5-3.69 8.15-8.22 8.15Z"/></svg>',
    },
  };
/* ---- gears ---- */
var g1=$('g1'),g2=$('g2'),a=0,boost=0,last=performance.now();
function loop(t){var dt=Math.min((t-last)/1000,.1);last=t;boost*=Math.pow(.15,dt);var s=1+boost;a+=dt*s;
 g1.setAttribute('transform','rotate('+(a*30)+')');g2.setAttribute('transform','rotate('+(22.5-a*45)+')');draw(dt);requestAnimationFrame(loop)}
/* ---- sparks ---- */
var cv=$('fx'),cx=cv.getContext('2d'),P=[],W,H,dpr=Math.min(devicePixelRatio||1,2);
function rs(){W=cv.width=innerWidth*dpr;H=cv.height=innerHeight*dpr}rs();addEventListener('resize',rs);
function spark(x,y,n,v){for(var i=0;i<n;i++){var an=Math.random()*6.283,sp=(Math.random()*.6+.4)*v;P.push({x:x*dpr,y:y*dpr,vx:Math.cos(an)*sp*dpr,vy:Math.sin(an)*sp*dpr-v*.3*dpr,l:1,c:Math.random()<.35?'232,179,74':'255,40,30',r:(Math.random()*2+1)*dpr})}}
var amb=0;
function draw(dt){cx.clearRect(0,0,W,H);amb+=dt;if(amb>.25){amb=0;P.push({x:Math.random()*W,y:H+10,vx:(Math.random()-.5)*20*dpr,vy:-(40+Math.random()*60)*dpr,l:1,c:'255,40,30',r:(Math.random()*1.6+.8)*dpr,amb:1})}
 for(var i=P.length-1;i>=0;i--){var p=P[i];p.x+=p.vx*dt;p.y+=p.vy*dt;if(!p.amb)p.vy+=520*dpr*dt;p.l-=dt*(p.amb?.22:1.3);if(p.l<=0){P.splice(i,1);continue}
  cx.fillStyle='rgba('+p.c+','+p.l+')';cx.shadowColor='rgb('+p.c+')';cx.shadowBlur=8*dpr;cx.beginPath();cx.arc(p.x,p.y,p.r,0,6.283);cx.fill()}}
addEventListener('pointerdown',function(e){spark(e.clientX,e.clientY,16,260)});
$('stage').addEventListener('click',function(){boost=9;var r=$('stage').getBoundingClientRect();spark(r.left+r.width/2,r.top+r.height/2,40,380)});
requestAnimationFrame(loop);
/* ---- progress (ตกแต่งเท่านั้น) ---- */
var p=0,L=['UPDATING SYSTEM...','OPTIMIZING DATABASE...','SECURING CONNECTION...','ALMOST THERE...'];
setInterval(function(){p+=Math.random()*5+1;if(p>100)p=100;var n=Math.floor(p);$('pc').textContent=n+'%';$('bf').style.width=n+'%';
 var k=n<34?0:n<67?1:n<100?2:3;$('st').textContent=L[k];
 for(var i=0;i<3;i++){var s=$('s'+i);s.className=i<k?'ok':i===k?'on':''}
 if(n>=100){setTimeout(function(){p=0},1600)}},450);
/* ---- contact sheet ---- */
var ov=$('ov'),loaded=false;
function esc(s){return String(s).replace(/[&<>"']/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]})}
function render(soc){soc=soc||{};var h='',n=0;
 Object.keys(SOCIAL_META).forEach(function(k){var v=soc[k];if(!v)return;v=String(v).trim();
  if(k==='whatsapp'&&/^[0-9+ ]+$/.test(v))v='https://wa.me/'+v.replace(/\D/g,'');
  if(!/^https?:\/\//i.test(v)&&v!=='#')return;var m=SOCIAL_META[k];
  h+='<a class="ch" style="animation-delay:'+(n*.08)+'s" href="'+esc(v)+'" target="_blank" rel="noopener"><span class="ic" style="background:'+m.color+'">'+m.icon+'</span>'+m.name+'<em>&rsaquo;</em></a>';n++});
 $('chs').innerHTML=h||'<p>ຍັງບໍ່ມີຊ່ອງທາງຕິດຕໍ່ໃນຕອນນີ້</p>'}
function load(){if(loaded)return;loaded=true;
 if(window.MT_DEMO){render(window.MT_DEMO);return}
 fetch('/api/public/storefront',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){render((d.store&&d.store.social)||d.social)}).catch(function(){render(null)})}
function open_(){load();ov.classList.add('on');var b=document.querySelector('.fab .bd');if(b)b.style.display='none'}
function close_(){ov.classList.remove('on')}
$('fab').addEventListener('click',function(e){e.stopPropagation();open_()});
$('cl').addEventListener('click',close_);
ov.addEventListener('click',function(e){if(e.target===ov)close_()});
addEventListener('keydown',function(e){if(e.key==='Escape')close_()});
})();