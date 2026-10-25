/* =========================================================
   pikachu-fab.js — ปุ่มแชทลอย (.chat-fab) เป็นปิกาจูพิกเซล
   - แทนที่ไอคอนวงกลมแดงด้วยปิกาจูพิกเซล (ไม่มีบอลลูนข้อความ)
   - กดแล้วปิกาจูวิ่งเร็วไปมุมซ้าย มีสายฟ้าตามหลัง พอถึงแล้วไอคอนช่องทางติดต่อ (ลิงก์จริงจากแอดมิน) เลื่อนตามมา
   - กดปิกาจูอีกครั้ง/กดที่ว่าง = ไอคอนเก็บกลับ ปิกาจูวิ่งกลับมุมขวา
   - สไตล์อยู่ใน pikachu-fab.css
   ========================================================= */
(function(){
  'use strict';
  var fab=document.querySelector('.chat-fab');
  if(!fab||fab.classList.contains('pika-fab'))return;
  var HALF=["..OO............",".OKKO...........",".OKKKO..........","..OKKKO.........","..OKKKRO........","...ORRRRO.......","...ORRRRRO......","....ORRRRRO.....",
  "....ORRRRRROOOOO","....ORRRRRRRRRRR","....ORRRRRRRRRRR","....ORRRRRRRRRRR","....ORRRRRRRRRRR","....ORRRRKWRRRRR","....ORRRRKKRRRRR","....ORRRRKKRRRRR",
  "....ORRGRRRRRRRK","....ORGGgRRRKRRR","....ORRgRRRRRKKK","....ORRRRRRRRRRR",".....ORRrrrrrrrr","......OOrrrrrrrr","........ORRRRRRR",".....OOORRRLLLLL",
  "....ORRORRLLLLLL","....ORRORRLLLLLL","....ORRORRLLLLLL","....ORRORRLLLLLL","....OOOORRRLLLLL","......ORRRRLLLLL",".....ORRRRRRRRRR",".....ORRRRRRRRRR",".....OOOOOOOOOOO"];
  var PAL={O:'#4a0606',K:'#160000',R:'#ff2b22',r:'#c8130f',D:'#7a0a0a',L:'#ff8070',W:'#ffffff',G:'#ffc928',g:'#c98a00'};
  var rows=HALF.map(function(r){return r+r.split('').reverse().join('')});
  function runs(cells){ // รวมพิกเซลติดกันแนวนอนเป็นแท่งเดียว
    var o='',m={};cells.forEach(function(c){m[c[1]+','+c[0]]=c[2]});
    var ys={};cells.forEach(function(c){ys[c[1]]=1});
    Object.keys(ys).map(Number).sort(function(a,b){return a-b}).forEach(function(y){
      var x=0;while(x<36){var k=m[y+','+x];if(!k){x++;continue}var s=x;while(m[y+','+(x+1)]===k)x++;
        o+='<rect x="'+s+'" y="'+y+'" width="'+(x-s+1)+'" height="1.02" fill="'+PAL[k]+'"/>';x++}});
    return o}
  function fromRows(y0,y1,x0,x1){var c=[];for(var y=y0;y<=y1;y++)for(var x=x0;x<=x1;x++){var ch=rows[y][x];if(ch!=='.')c.push([x,y,ch])}return c}
  // หางสายฟ้า: ลากเส้นหนา 2 พิกเซล แล้วใส่ขอบเข้มอัตโนมัติ
  var pts=[[27,30],[30,27],[28,25],[33,18],[31,17],[34,10]],tail={};
  for(var i=0;i<pts.length-1;i++){var a=pts[i],b=pts[i+1],n=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));
    for(var t=0;t<=n;t++){var x=Math.round(a[0]+(b[0]-a[0])*t/n),y=Math.round(a[1]+(b[1]-a[1])*t/n),col=(i===0&&t<n*.6)?'D':'R';
      for(var dx=0;dx<2;dx++)for(var dy=0;dy<2;dy++)tail[(x+dx)+','+(y+dy)]=col}}
  var tc=[];Object.keys(tail).forEach(function(k){var p=k.split(',').map(Number);tc.push([p[0],p[1],tail[k]]);
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var q=(p[0]+d[0])+','+(p[1]+d[1]);if(!tail[q]&&!tail[q+'o']){tail[q+'o']=1;tc.push([p[0]+d[0],p[1]+d[1],'O'])}})});
  var lids=[];[9,10,21,22].forEach(function(x){lids.push([x,13,'R'],[x,14,'R'],[x,15,'K'])});
  var spk=[[2,15],[3,16],[2,17],[3,18]],sl=[],sr=[],s2l=[],s2r=[];
  spk.forEach(function(p){sl.push([p[0],p[1],'G']);sr.push([31-p[0],p[1],'G']);s2l.push([p[0]-1,p[1]+5,'G']);s2r.push([32-p[0],p[1]+5,'G'])});
  var svg='<g class="all"><g class="tail">'+runs(tc)+'</g>'+
   '<g class="eL">'+runs(fromRows(0,7,0,15))+'</g><g class="eR">'+runs(fromRows(0,7,16,31))+'</g>'+
   runs(fromRows(8,32,0,31))+'<g class="lids">'+runs(lids)+'</g>'+
   '<g class="sp">'+runs(sl.concat(sr))+'</g><g class="sp sp2">'+runs(s2l.concat(s2r))+'</g></g>';
  fab.classList.add('pika-fab');
  fab.innerHTML='<svg class="pk" viewBox="0 0 36 34" aria-hidden="true">'+svg+'</svg>';
  var pk=fab.querySelector('.pk');
  var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;

  // สร้างเส้นสายฟ้าซิกแซกแบบพิกเซล: เริ่มที่ระยะ r0 จากจุดกลาง ยาว len ตามมุม ang
  function boltAt(cx,cy,ang,r0,len,u,segs){
    var dx=Math.cos(ang),dy=Math.sin(ang),px=-dy,py=dx,pts=[],s,t;
    for(s=0;s<=segs;s++){var d=r0+len*s/segs,off=(s===0||s===segs)?0:(s%2?1:-1)*u*(1.2+Math.random());pts.push([dx*d+px*off,dy*d+py*off])}
    var g='';
    for(s=0;s<segs;s++){var a=pts[s],b=pts[s+1],st=Math.max(1,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/u));
      for(t=0;t<=st;t++){var x=Math.round((a[0]+(b[0]-a[0])*t/st)/u)*u,y=Math.round((a[1]+(b[1]-a[1])*t/st)/u)*u;
        g+='<rect x="'+x+'" y="'+y+'" width="'+u+'" height="'+u+'"/>'}}
    var el=document.createElement('div');el.className='bolt';el.style.left=cx+'px';el.style.top=cy+'px';
    el.innerHTML='<svg width="1" height="1" aria-hidden="true">'+g+'</svg>';document.body.appendChild(el);return el;
  }
  function unit(r){return Math.max(2,Math.round(r.width/46))}

  // สายฟ้าแตกกระจายรอบตัวตอนเริ่มวิ่ง
  function burst(el){
    if(RM)return;
    var r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height*.5,u=unit(r),n=8,base=Math.random()*Math.PI*2;
    el.classList.remove('zap');void el.getBoundingClientRect();el.classList.add('zap');
    for(var i=0;i<n;i++){
      var ang=base+i*Math.PI*2/n+(Math.random()-.5)*.5;
      var b=boltAt(cx,cy,ang,r.width*(.3+Math.random()*.1),r.width*(.14+Math.random()*.14),u,3+Math.round(Math.random()));
      var an=b.animate([{transform:'scale(.55)',opacity:1},{transform:'scale(.85)',opacity:1,offset:.3},{transform:'scale(1)',opacity:.15,offset:.45},{transform:'scale(1.15)',opacity:1,offset:.6},{transform:'scale(1.4)',opacity:0}],{duration:480+Math.random()*180,delay:i*18,easing:'steps(7)',fill:'both'});
      an.onfinish=(function(e){return function(){e.remove()}})(b);
    }
  }

  // สายฟ้าลากตามหลังระหว่างวิ่ง (dir -1 = วิ่งซ้าย → หางอยู่ขวา)
  function trail(dir,dur){
    if(RM)return;
    var t0=performance.now(),last=0;
    (function f(now){
      if(now-t0>dur)return;
      if(now-last>34){
        last=now;
        var r=fab.getBoundingClientRect(),u=unit(r),cx=r.left+r.width/2,cy=r.top+r.height*(.3+Math.random()*.45);
        var b=boltAt(cx,cy,dir<0?0:Math.PI,r.width*.28,r.width*(.45+Math.random()*.5),u,3+Math.round(Math.random()*2));
        var an=b.animate([{opacity:1,transform:'scaleX(1)'},{opacity:.9,transform:'scaleX(.85)',offset:.35},{opacity:0,transform:'scaleX(.35)'}],{duration:300+Math.random()*120,easing:'steps(5)',fill:'both'});
        an.onfinish=(function(e){return function(){e.remove()}})(b);
      }
      requestAnimationFrame(f);
    })(t0);
  }

  var links=document.createElement('div');
  links.className='pika-links';
  document.body.appendChild(links);

  var state='home',busy=false,RUN=420,t1;
  function homeDx(){
    var cs=getComputedStyle(fab),right=parseFloat(cs.right);if(isNaN(right))right=14;
    return -(document.documentElement.clientWidth-right-fab.offsetWidth-14);
  }
  function syncLinks(){
    var r=fab.getBoundingClientRect();
    links.style.left=(r.right+8)+'px';
    links.style.bottom=(document.documentElement.clientHeight-r.bottom+10)+'px';
  }
  function follow(ms){ // แถบเมนูล่างเปิด/ปิดแล้วปิกาจูลอยขึ้นลง → ให้แถวไอคอนตามไปด้วย
    var t0=performance.now();
    (function f(now){syncLinks();if(now-t0<ms)requestAnimationFrame(f)})(t0);
  }
  new MutationObserver(function(){if(state==='away')follow(700)}).observe(document.body,{attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',function(){
    if(state==='away'){fab.style.setProperty('--pk-dx',homeDx()+'px');setTimeout(syncLinks,60)}
  });

  function getLinks(){
    var M=window.SOCIAL_META;
    return Promise.resolve().then(function(){return window.StorefrontData&&window.StorefrontData.fetchData()})
      .then(function(d){
        var s=d&&d.store&&d.store.social;
        return Object.keys(M).map(function(k){return {m:M[k],href:s&&String(s[k]||'').trim()}}).filter(function(x){return x.href});
      }).catch(function(){return []});
  }
  function esc(v){return String(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function buildLinks(list){
    if(!list.length){links.innerHTML='<span class="pika-empty">ຮ້ານຍັງບໍ່ໄດ້ຕັ້ງຄ່າຊ່ອງທາງຕິດຕໍ່</span>';return}
    links.innerHTML=list.map(function(x,i){
      return '<a href="'+esc(x.href)+'" target="_blank" rel="noopener" aria-label="'+esc(x.m.name)+'" style="background:'+x.m.color+';--from:'+(-(i*48+72))+'px;--d:'+(i*0.07)+'s">'+x.m.icon+'</a>';
    }).join('');
  }

  function arrive(){
    fab.classList.remove('run-l','run-r');
    fab.classList.remove('jump');void fab.offsetWidth;fab.classList.add('jump');
    clearTimeout(t1);t1=setTimeout(function(){fab.classList.remove('jump')},700);
  }

  function openAway(){
    busy=true;
    var data=getLinks();
    fab.classList.add('run-l');
    burst(pk);
    fab.style.setProperty('--pk-dx',homeDx()+'px');
    trail(-1,RUN);
    setTimeout(function(){
      arrive();syncLinks();
      data.then(function(list){
        buildLinks(list);void links.offsetWidth;
        links.classList.add('show');
        state='away';busy=false;
      });
    },RUN);
  }
  function closeBack(){
    busy=true;
    var as=links.querySelectorAll('a'),n=as.length;
    for(var i=0;i<n;i++)as[i].style.setProperty('--d',((n-1-i)*0.045)+'s');
    links.classList.remove('show');
    setTimeout(function(){
      fab.classList.add('run-r');
      fab.style.setProperty('--pk-dx','0px');
      trail(1,RUN);
      setTimeout(function(){arrive();state='home';busy=false},RUN);
    },Math.max(0,n*45+260));
  }

  // ดักคลิกของปุ่มแชทเดิม (แทนการเปิด popup) · ถ้าไม่มีข้อมูลไอคอน ให้ popup เดิมทำงานตามปกติ
  document.addEventListener('click',function(e){
    if(!window.SOCIAL_META)return;
    if(fab.contains(e.target)){
      e.stopPropagation();e.preventDefault();
      if(busy)return;
      if(state==='home')openAway();else closeBack();
    }else if(state==='away'&&!busy&&!links.contains(e.target)){
      closeBack();
    }
  },true);

  // ประหยัดแบต: หยุดแอนิเมชันเมื่อแท็บถูกซ่อน
  document.addEventListener('visibilitychange',function(){fab.classList.toggle('pika-paused',document.hidden)});
})();
