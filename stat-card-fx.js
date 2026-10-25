/* =========================================================
   stat-card-fx.js — การ์ดสถิติหน้าแรก (Red Crystal)
   - วาดพื้นหลังคริสตัลแดง-ดำด้วย canvas ให้ .stat-card ทั้ง 4 ใบ (ไม่ใช้รูปภาพ)
   - เพิ่มประกายดาว + หยุดแอนิเมชันเมื่อการ์ดเลื่อนพ้นจอ (ประหยัดแบตมือถือ)
   - ไม่แตะต้องตัวเลข: storefront.js ยังเป็นคนนับเลขขึ้นเหมือนเดิม
   ตัวเอฟเฟกต์แสง/สไตล์อยู่ใน stat-card-fx.css
   ========================================================= */
(function () {
  'use strict';

  function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

  function paintShatter(cv, seed, corner, logo){
    const dpr=Math.min(window.devicePixelRatio||1,2.5), b=cv.getBoundingClientRect();
    const w=cv.width=Math.max(2,Math.round(b.width*dpr)), h=cv.height=Math.max(2,Math.round(b.height*dpr));
    const c=cv.getContext('2d'), R=mulberry(seed), rn=(a,z)=>a+(z-a)*R();
    const s=dpr*Math.max(.75,b.width/260), diag=Math.hypot(w,h);
    const glow=(x,y,r,a,col)=>{const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${col},${a})`);g.addColorStop(1,`rgba(${col},0)`);c.fillStyle=g;c.fillRect(0,0,w,h)};

    // 1) พื้นดำ + แสงแดงแวดล้อมตามขอบ (ซ้าย/ขวาบน/ล่าง) กลางภาพมืด
    c.fillStyle='#000';c.fillRect(0,0,w,h);
    c.globalCompositeOperation='lighter';
    glow(0,h*.55,h*1.15,.32,'200,0,0');glow(w,h*.22,w*.5,.36,'225,0,0');
    glow(w*.72,h*1.08,w*.55,.32,'235,0,0');glow(w*.04,h*1.12,w*.38,.24,'190,0,0');glow(w*.02,0,w*.28,.2,'200,0,0');
    c.globalCompositeOperation='source-over';

    // รอยร้าวแตกกิ่ง (เศษเส้นหินอ่อน)
    c.lineCap='round';
    function crack(x,y,a,len,d,al){
      const br=[];c.beginPath();c.moveTo(x,y);
      for(let i=0;i<len;i++){a+=rn(-.5,.5);x+=Math.cos(a)*rn(2,5)*s;y+=Math.sin(a)*rn(2,5)*s;c.lineTo(x,y);
        if(d>0&&R()<.12)br.push([x,y,a+rn(-1.1,1.1)]);}
      c.strokeStyle=`rgba(255,${rn(30,95)|0},${rn(20,60)|0},${al})`;c.stroke();
      br.forEach(q=>crack(q[0],q[1],q[2],(len*.6)|0,d-1,al*.8));
    }
    const edge=(P,Q,al,wd,hot)=>{c.beginPath();c.moveTo(P[0],P[1]);c.lineTo(Q[0],Q[1]);
      c.shadowColor='rgba(255,0,0,.95)';c.shadowBlur=(hot?12:7)*s;
      c.strokeStyle=`rgba(255,${hot?50:25},${hot?40:20},${al})`;c.lineWidth=wd*s;c.stroke();};

    // 2) แผ่นคริสตัลทึบมืด + ขอบเรืองแสง + รอยร้าวภายใน
    for(let i=0;i<7;i++){
      const A=[rn(-.1,1.1)*w,rn(-.1,1.1)*h], ang=(R()<.5?-1:1)*rn(.55,1.3), L=rn(.3,.8)*diag*.6;
      const B=[A[0]+Math.cos(ang)*L,A[1]+Math.sin(ang)*L];
      const da=ang+(R()<.5?1:-1)*Math.PI/2+rn(-.35,.35), dl=L*rn(.07,.2);
      const D=[A[0]+Math.cos(da)*dl,A[1]+Math.sin(da)*dl];
      const C=[B[0]+(D[0]-A[0])*rn(.6,1.1),B[1]+(D[1]-A[1])*rn(.6,1.1)];
      c.shadowBlur=0;c.beginPath();c.moveTo(A[0],A[1]);[B,C,D].forEach(p=>c.lineTo(p[0],p[1]));c.closePath();
      c.fillStyle='rgba(0,0,0,.6)';c.fill();
      const g=c.createLinearGradient(A[0],A[1],D[0],D[1]);
      g.addColorStop(0,`rgba(255,40,30,${rn(.12,.34)})`);g.addColorStop(1,'rgba(90,0,0,.05)');c.fillStyle=g;c.fill();
      c.save();c.clip();c.lineWidth=.55*s;c.shadowColor='rgba(255,0,0,.8)';c.shadowBlur=3*s;
      c.restore();
      edge(A,B,.95,1.3,true);edge(B,C,rn(.3,.8),.9);edge(C,D,rn(.25,.6),.8);edge(D,A,rn(.4,.8),.9);
      edge([A[0]+(D[0]-A[0])*.22,A[1]+(D[1]-A[1])*.22],[B[0]+(D[0]-A[0])*.22,B[1]+(D[1]-A[1])*.22],.4,.6);
      c.shadowBlur=0;c.beginPath();c.moveTo(A[0],A[1]);c.lineTo(B[0],B[1]);
      c.strokeStyle='rgba(255,175,155,.7)';c.lineWidth=.45*s;c.stroke();
    }

    // 3) เส้นแสงยาวบางตัดทแยง
    for(let i=0;i<4;i++){
      const x=rn(0,1)*w,y=rn(0,1)*h,a=(R()<.5?-1:1)*rn(.7,1.25),l=rn(.5,1)*w*.9,x2=x+Math.cos(a)*l,y2=y+Math.sin(a)*l;
      const g=c.createLinearGradient(x,y,x2,y2);g.addColorStop(0,'rgba(255,40,30,0)');
      g.addColorStop(.5,`rgba(255,50,40,${rn(.5,.95)})`);g.addColorStop(1,'rgba(255,40,30,0)');
      c.strokeStyle=g;c.lineWidth=rn(.6,1.5)*s;c.shadowColor='rgba(255,0,0,.9)';c.shadowBlur=9*s;
      c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();
    }

    // 4) ลายหินอ่อน/เส้นเลือดแดงเรืองๆ เป็นกลุ่ม (กลางขวา + ซ้ายล่าง)
    c.globalCompositeOperation='lighter';c.lineWidth=.6*s;c.shadowColor='rgba(255,0,0,.7)';c.shadowBlur=4*s;

    // 5) แสงสตรีคแนวนอนด้านล่าง + lens flare + เส้นสั้นขอบซ้าย
    for(let i=0;i<3;i++){
      const y=h*rn(.68,.95),x=w*rn(0,.35),x2=x+w*rn(.5,.95),y2=y-h*rn(0,.05);
      const g=c.createLinearGradient(x,y,x2,y2);g.addColorStop(0,'rgba(255,60,50,0)');
      g.addColorStop(.6,'rgba(255,70,60,.9)');g.addColorStop(1,'rgba(255,60,50,0)');
      c.strokeStyle=g;c.lineWidth=rn(.5,1.4)*s;c.shadowColor='rgba(255,0,0,1)';c.shadowBlur=8*s;
      c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();
    }
    c.shadowBlur=0;
    const fx=w*rn(.6,.8),fy=h*rn(.72,.86);
    c.save();c.translate(fx,fy);c.scale(7,1);
    let g=c.createRadialGradient(0,0,0,0,0,10*s);g.addColorStop(0,'rgba(255,235,225,.9)');g.addColorStop(.25,'rgba(255,60,40,.6)');g.addColorStop(1,'rgba(255,0,0,0)');
    c.fillStyle=g;c.fillRect(-10*s,-10*s,20*s,20*s);c.restore();
    g=c.createRadialGradient(fx,fy,0,fx,fy,5*s);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(1,'rgba(255,60,40,0)');
    c.fillStyle=g;c.fillRect(fx-6*s,fy-6*s,12*s,12*s);
    g=c.createLinearGradient(0,0,w*.12,0);g.addColorStop(0,'rgba(255,60,50,.95)');g.addColorStop(1,'rgba(255,60,50,0)');
    c.strokeStyle=g;c.lineWidth=1.1*s;c.shadowColor='#f00';c.shadowBlur=7*s;c.beginPath();c.moveTo(0,h*.6);c.lineTo(w*.12,h*.6);c.stroke();
    c.globalCompositeOperation='source-over';c.shadowBlur=0;

    // 5.5) โลโก้แบรนด์ที่มุมการ์ด: วาดลง offscreen → เฟดด้านที่ใกล้ตัวหนังสือ → blend แบบ screen ให้กลืนกับคริสตัล
    if(logo&&logo.complete&&corner){
      const right=corner[1]==='r',top=corner[0]==='t',sz=h*(corner==='lc'?.92:right?1.0:.8),S=sz*1.25;
      let cx,cy,rot;
      if(corner==='lc'){cx=sz*.62;cy=h*.5;rot=0;}
      else{cx=right?w-sz*.28:sz*.2;cy=top?sz*.22:h-sz*.22;rot=(right?-1:1)*(top?1:-1)*.15;}
      const o=document.createElement('canvas');o.width=w;o.height=h;const k=o.getContext('2d');
      k.translate(cx,cy);k.rotate(rot);k.drawImage(logo,-.523*S,-.508*S,S,S);k.setTransform(1,0,0,1,0,0);
      if(corner!=='lc'){const m=k.createLinearGradient(right?w*.42:w*.58,0,right?w*.82:w*.18,0);
        m.addColorStop(0,'rgba(0,0,0,0)');m.addColorStop(1,'rgba(0,0,0,1)');
        k.globalCompositeOperation='destination-in';k.fillStyle=m;k.fillRect(0,0,w,h);}
      c.save();c.globalCompositeOperation='screen';c.globalAlpha=corner==='lc'?.95:.72;c.drawImage(o,0,0);c.restore();
    }

    // 6) ฉากมืดนุ่มๆ กลางการ์ด ให้ตัวเลข/ข้อความอ่านง่าย
    g=c.createRadialGradient(w*.6,h*.5,0,w*.6,h*.5,w*.5);g.addColorStop(0,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g;c.fillRect(0,0,w,h);

    // 7) เกรน + จุดประกายเล็กๆ
    try{const im=c.getImageData(0,0,w,h),d=im.data;
    for(let i=0;i<d.length;i+=4){const n=(R()-.5)*22*(1+d[i]/255*1.5);d[i]+=n;d[i+1]+=n*.25;d[i+2]+=n*.25;}
    c.putImageData(im,0,0);}catch(e){}
    for(let i=0;i<30;i++){c.fillStyle=`rgba(255,${rn(60,140)|0},${rn(50,110)|0},${rn(.25,.7)})`;c.fillRect(R()*w,R()*h,rn(.6,1.5)*dpr,rn(.6,1.5)*dpr);}
  }

  var LOGO_URI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9Ii02MCAtNjAgNjQwIDY0MCIgd2lkdGg9IjY0MCIgaGVpZ2h0PSI2NDAiPgo8ZGVmcz4KICA8bGluZWFyR3JhZGllbnQgaWQ9InNpbHZlciIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmZmZmZmIi8+PHN0b3Agb2Zmc2V0PSIuMjIiIHN0b3AtY29sb3I9IiNkZmUyZTgiLz4KICAgIDxzdG9wIG9mZnNldD0iLjUiIHN0b3AtY29sb3I9IiM3ZDgxODkiLz48c3RvcCBvZmZzZXQ9Ii43NCIgc3RvcC1jb2xvcj0iI2M5Y2NkMyIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2Y2ZjdmOSIvPgogIDwvbGluZWFyR3JhZGllbnQ+CiAgPHJhZGlhbEdyYWRpZW50IGlkPSJkaXNjIiBjeD0iLjM1IiBjeT0iLjMiIHI9Ii45Ij4KICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzRhMDAwOCIvPjxzdG9wIG9mZnNldD0iLjYiIHN0b3AtY29sb3I9IiMxNTAwMDIiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwNTAwMDAiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxsaW5lYXJHcmFkaWVudCBpZD0icmVkIiB4MT0iLjEiIHkxPSIwIiB4Mj0iLjciIHkyPSIxIj4KICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2ZmNWE0YSIvPjxzdG9wIG9mZnNldD0iLjM1IiBzdG9wLWNvbG9yPSIjZTgxMzFjIi8+CiAgICA8c3RvcCBvZmZzZXQ9Ii43NSIgc3RvcC1jb2xvcj0iIzlhMDYxMCIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzVhMDAwOCIvPgogIDwvbGluZWFyR3JhZGllbnQ+CiAgPGxpbmVhckdyYWRpZW50IGlkPSJib2x0IiB4MT0iLjUiIHkxPSIwIiB4Mj0iLjUiIHkyPSIxIj4KICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2ZmZmZmZiIvPjxzdG9wIG9mZnNldD0iLjQ1IiBzdG9wLWNvbG9yPSIjZmZjMmJjIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZmYyYjJiIi8+CiAgPC9saW5lYXJHcmFkaWVudD4KICA8ZmlsdGVyIGlkPSJnbG93IiB4PSItMzAlIiB5PSItMzAlIiB3aWR0aD0iMTYwJSIgaGVpZ2h0PSIxNjAlIj48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSIxNCIvPjwvZmlsdGVyPgogIDxmaWx0ZXIgaWQ9InNvZnQiPjxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249IjEuNiIvPjwvZmlsdGVyPgogIDxjbGlwUGF0aCBpZD0iZGNsaXAiPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTEyMCA4OCBMMjkyIDc4IEM0MTUgNzIgNDgyIDE1OCA0NzggMjYyIEM0NzQgMzcyIDM5MiA0NDggMjY4IDQ1MiBMOTggNDU1IEwxMzggMzkyIEwxNTAgMTUwIFogTTIyMiAxNjggTDI5MCAxNjQgQzM1MiAxNjIgMzkwIDIwNiAzODggMjYyIEMzODYgMzIyIDM0OCAzNjYgMjkwIDM2OCBMMjIyIDM3MCBaIi8+PC9jbGlwUGF0aD4KPC9kZWZzPgoKPCEtLSByZWQgZ2xvdyBiZWhpbmQgZXZlcnl0aGluZyAtLT4KPGNpcmNsZSBjeD0iMjc1IiBjeT0iMjY1IiByPSIyMTAiIGZpbGw9IiNmZjAwMDEiIG9wYWNpdHk9Ii4zNSIgZmlsdGVyPSJ1cmwoI2dsb3cpIi8+Cgo8IS0tIHNpbHZlciByaW5nIC0tPgo8Y2lyY2xlIGN4PSIyNzUiIGN5PSIyNjUiIHI9IjIyNiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMmEwMDA0IiBzdHJva2Utd2lkdGg9IjMiIG9wYWNpdHk9Ii44Ii8+CjxjaXJjbGUgY3g9IjI3NSIgY3k9IjI2NSIgcj0iMjA1IiBmaWxsPSJub25lIiBzdHJva2U9InVybCgjc2lsdmVyKSIgc3Ryb2tlLXdpZHRoPSI0MiIvPgo8Y2lyY2xlIGN4PSIyNzUiIGN5PSIyNjUiIHI9IjE4NCIgZmlsbD0idXJsKCNkaXNjKSIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjMiLz4KPGNpcmNsZSBjeD0iMjc1IiBjeT0iMjY1IiByPSIxODIiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsNjAsNTAsLjM1KSIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KPHBhdGggZD0iTTk3LjUgMTYyLjUgQTIwNSAyMDUgMCAwIDEgMjU3IDYwLjgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSI2IiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9Ii43NSIgZmlsdGVyPSJ1cmwoI3NvZnQpIi8+CjxwYXRoIGQ9Ik00MzAgNDAwIEEyMDUgMjA1IDAgMCAxIDMzMCA0NjUiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9Ii41IiBmaWx0ZXI9InVybCgjc29mdCkiLz4KCjwhLS0gRCBnbG93ICsgYm9keSAtLT4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMTIwIDg4IEwyOTIgNzggQzQxNSA3MiA0ODIgMTU4IDQ3OCAyNjIgQzQ3NCAzNzIgMzkyIDQ0OCAyNjggNDUyIEw5OCA0NTUgTDEzOCAzOTIgTDE1MCAxNTAgWiBNMjIyIDE2OCBMMjkwIDE2NCBDMzUyIDE2MiAzOTAgMjA2IDM4OCAyNjIgQzM4NiAzMjIgMzQ4IDM2NiAyOTAgMzY4IEwyMjIgMzcwIFoiIGZpbGw9IiNmZjAwMDEiIG9wYWNpdHk9Ii41IiBmaWx0ZXI9InVybCgjZ2xvdykiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMTIwIDg4IEwyOTIgNzggQzQxNSA3MiA0ODIgMTU4IDQ3OCAyNjIgQzQ3NCAzNzIgMzkyIDQ0OCAyNjggNDUyIEw5OCA0NTUgTDEzOCAzOTIgTDE1MCAxNTAgWiBNMjIyIDE2OCBMMjkwIDE2NCBDMzUyIDE2MiAzOTAgMjA2IDM4OCAyNjIgQzM4NiAzMjIgMzQ4IDM2NiAyOTAgMzY4IEwyMjIgMzcwIFoiIGZpbGw9InVybCgjcmVkKSIgc3Ryb2tlPSIjMmEwMDA0IiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPGcgY2xpcC1wYXRoPSJ1cmwoI2RjbGlwKSI+CiAgPHBvbHlnb24gcG9pbnRzPSIxMjAsODggMjkyLDc4IDI5MCwxNjQgMjIyLDE2OCAxNTAsMTUwIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIuMTQiLz4KICA8cG9seWdvbiBwb2ludHM9Ijk4LDQ1NSAyNjgsNDUyIDI5MCwzNjggMjIyLDM3MCAxMzgsMzkyIiBmaWxsPSIjMDAwIiBvcGFjaXR5PSIuMjgiLz4KICA8cGF0aCBkPSJNMzkwIDE5MCBDNDIwIDIzMCA0MjAgMzAwIDM4MCAzNzAgQzM1MCA0MjAgMzEwIDQ0MCAyNjggNDUyIEwyOTAgMzY4IEMzNDggMzY2IDM4NiAzMjIgMzg4IDI2MiBDMzkwIDIzMiAzOTAgMjEwIDM5MCAxOTBaIiBmaWxsPSIjMDAwIiBvcGFjaXR5PSIuMjIiLz4KICA8cGF0aCBkPSJNMjkyIDc4IEM0MTUgNzIgNDgyIDE1OCA0NzggMjYyIEwzODggMjYyIEMzOTAgMjA2IDM1MiAxNjIgMjkwIDE2NFoiIGZpbGw9IiNmZmYiIG9wYWNpdHk9Ii4wNyIvPgo8L2c+CjxwYXRoIGQ9Ik0xMjggOTYgTDI5MiA4NiBDNDA1IDgwIDQ3MCAxNjAgNDcxIDI1MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZiMGEwIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iLjg1IiBmaWx0ZXI9InVybCgjc29mdCkiLz4KPHBhdGggZD0iTTIzMiAxNzYgTDI5MCAxNzIgQzM0NCAxNzAgMzgwIDIxMCAzNzggMjYyIiBmaWxsPSJub25lIiBzdHJva2U9IiM3YTAwMDgiIHN0cm9rZS13aWR0aD0iMyIgb3BhY2l0eT0iLjgiLz4KPHBhdGggZD0iTTE0NCAxNjAgTDE1MCAxNTAgTDE0NiAzOTIiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmOGE3YSIgc3Ryb2tlLXdpZHRoPSIyIiBvcGFjaXR5PSIuNSIvPgoKPCEtLSBsaWdodG5pbmcgYm9sdCAtLT4KPHBhdGggZD0iTTIxNCAzNiBMMjY4IDM2IEwyMjYgMjA0IEwyODYgMTk2IEwxMDIgNDcwIEwxNTIgMjYyIEw5NiAyNjggWiIgZmlsbD0iI2ZmMDAwMSIgb3BhY2l0eT0iLjU1IiBmaWx0ZXI9InVybCgjZ2xvdykiLz4KPHBhdGggZD0iTTIxNCAzNiBMMjY4IDM2IEwyMjYgMjA0IEwyODYgMTk2IEwxMDIgNDcwIEwxNTIgMjYyIEw5NiAyNjggWiIgZmlsbD0idXJsKCNib2x0KSIgc3Ryb2tlPSIjNGEwMDA2IiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTTIxOSA0NiBMOTYgMjY4IEwxNTIgMjYyIEwxMDIgNDcwIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuODUiLz4KPHBhdGggZD0iTTI2MiA0NiBMMjIwIDIxMCBMMjcwIDIwMyIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYzQxMDFhIiBzdHJva2Utd2lkdGg9IjMiIG9wYWNpdHk9Ii43Ii8+Cjwvc3ZnPgo=';
  var SEEDS = [11, 23, 35, 48];
  var CORNERS = ['tl', 'tr', 'bl', 'br'];

  function init() {
    var cards = document.querySelectorAll('.stats .stat-card');
    if (!cards.length) return;

    var logo = new Image();
    var canvases = [];

    cards.forEach(function (card, i) {
      if (card.querySelector('canvas.scfx-bg')) return; // กันซ้ำ
      var cv = document.createElement('canvas');
      cv.className = 'scfx-bg';
      cv.setAttribute('aria-hidden', 'true');
      cv.dataset.seed = SEEDS[i % SEEDS.length];
      cv.dataset.corner = CORNERS[i % CORNERS.length];
      card.insertBefore(cv, card.firstChild);
      canvases.push(cv);

      for (var k = 0; k < 3; k++) {
        var sp = document.createElement('i');
        sp.className = 'scfx-spark';
        sp.style.left = (8 + Math.random() * 84) + '%';
        sp.style.top = (10 + Math.random() * 78) + '%';
        sp.style.animationDelay = (-(Math.random() * 2.6) - i * 0.3) + 's';
        sp.style.animationDuration = (2 + Math.random() * 2.2) + 's';
        card.appendChild(sp);
      }
    });

    function paint(cv) {
      try { paintShatter(cv, +cv.dataset.seed, cv.dataset.corner, logo); }
      catch (err) { console.error('stat-card-fx: paint failed', err); }
    }
    function paintAll() { canvases.forEach(paint); }

    logo.onload = paintAll;
    logo.src = LOGO_URI;
    requestAnimationFrame(paintAll);

    // วาดใหม่เมื่อขนาดการ์ดเปลี่ยน (หมุนจอ / ย่อขยาย / โหลดฟอนต์เสร็จ)
    var timers = new WeakMap();
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function (entries) {
        entries.forEach(function (en) {
          var card = en.target, cv = card.querySelector('canvas.scfx-bg');
          if (!cv) return;
          var w = Math.round(en.contentRect.width), h = Math.round(en.contentRect.height);
          if (cv._w === w && cv._h === h) return;
          cv._w = w; cv._h = h;
          clearTimeout(timers.get(cv));
          timers.set(cv, setTimeout(function () { paint(cv); }, 150));
        });
      });
      cards.forEach(function (c) { ro.observe(c); });
    } else {
      var rt;
      window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(paintAll, 150); });
    }

    // การ์ดที่อยู่นอกจอ -> หยุดแอนิเมชันชั่วคราว
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { en.target.classList.toggle('scfx-off', !en.isIntersecting); });
      }, { threshold: 0 });
      cards.forEach(function (c) { io.observe(c); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
