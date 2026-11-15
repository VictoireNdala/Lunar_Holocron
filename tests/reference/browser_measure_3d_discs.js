// Mesure (navigateur) du diamètre du Soleil et de la Terre dans la vue 3D (M-051 § 2.5) : à coller dans la console de la page servie (http://localhost:8000/), ou via CDP (voir VALIDATION-RESULTATS).
// Compare le diamètre projeté par la caméra réelle (measureBody) et la valeur attendue (rayon angulaire × agrandissement × pixels par radian), et lit la largeur sur les pixels rendus.
(async()=>{ try {
  const { createTerrainView } = await import('/js/terrain3d.js');
  const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
  const box=document.createElement('div'); box.style.cssText='position:fixed;left:0;top:0;width:900px;height:600px;z-index:99999;background:#000'; document.body.appendChild(box);
  const view=createTerrainView(box);
  await wait(300);
  const n=41, size=20000; const heights=new Float32Array(n*n);
  view.setTerrain({schema_version:'1.2',grid:{n,size_m:size,spacing_m:size/(n-1)},frame:'local-enu',z:{min_m:-1,max_m:1}}, heights);
  const sun={azDeg:0,elDeg:6,radiusDeg:0.2665}, earth={azDeg:90,elDeg:4,radiusDeg:0.95};
  view.setBodies(sun,earth); view.setViewMode('ground',{azDeg:0,observerHeight:2});
  const out=[];
  for (const scale of [1,4,8]) {
    view.setBodyScale(scale); view.renderNow();
    const m=view.measureBody('sun');
    // mesure sur les pixels du canvas à l'instant du rendu (toDataURL dans la même tâche)
    const c=view.element; const url=c.toDataURL('image/png');
    const img=new Image(); img.src=url; await img.decode();
    const w=img.width,h=img.height; const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const g=cv.getContext('2d'); g.drawImage(img,0,0);
    // le soleil est à elDeg 6 : on cherche la rangée du centre du disque = max de luminosité
    const data=g.getImageData(0,0,w,h).data; let best=-1,by=0,bx=0;
    for(let y=0;y<h;y++){for(let x=0;x<w;x++){const k=(y*w+x)*4;const l=data[k]+data[k+1]+data[k+2];if(l>best){best=l;by=y;bx=x;}}}
    // largeur à mi-hauteur du profil de luminosité de la rangée du maximum, dans une fenêtre ±120 px
    const prof=[];for(let x=Math.max(0,bx-120);x<Math.min(w,bx+120);x++){const k=(by*w+x)*4;prof.push(data[k]+data[k+1]+data[k+2]);}
    const half=best*0.5; // disque à assombrissement centre-bord : le bord vaut ~ (1-u)… on compte les pixels dont la luminosité dépasse 55 % du maximum
    const th=best*0.55; let first=-1,last=-1; prof.forEach((v,i)=>{if(v>=th){if(first<0)first=i;last=i;}});
    out.push(`échelle ×${scale} : mesuré par projection ${m.diameterPx.toFixed(2)} px, attendu ${m.expectedPx.toFixed(2)} px, écart ${(m.diameterPx-m.expectedPx).toFixed(3)} px ; largeur lue sur les pixels (≥ 55 % du maximum) ${last-first+1} px ; agrandi=${m.enlarged}`);
  }
  view.setViewMode('ground',{azDeg:90,observerHeight:2}); view.setBodyScale(1); view.renderNow(); const me=view.measureBody('earth'); out.push(`Terre ×1 : mesuré ${me.diameterPx.toFixed(2)} px, attendu ${me.expectedPx.toFixed(2)} px`);
  return out.join('\n');
} catch(e){ return 'EXC '+e.message+' '+(e.stack||'').slice(0,300); } })()
