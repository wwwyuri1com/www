window.Y1Data=(()=>{
 const all=JSON.parse(document.getElementById('get-ui-data').textContent),index=window.Y1GetCoverIndex||{},records={...(index.records||{}),...all.records};
 const ready=Promise.resolve(records);
 async function request(path){
  const p=String(path);let value;
  if(p.startsWith('record:'))value=records[decodeURIComponent(p.slice(7))];
  else if(p==='w/catalog.html')value=index.catalog;
  else if(p==='w/tags.html')value=all.tags;
  else if(p==='w/fonts.html')value=all.fonts;
  else if(p.startsWith('data:')){const comma=p.indexOf(','),meta=p.slice(5,comma),raw=p.slice(comma+1);const text=meta.endsWith(';base64')?atob(raw):decodeURIComponent(raw);return new Response(Uint8Array.from(text,c=>c.charCodeAt(0)),{headers:{'Content-Type':meta.split(';')[0]}})}
  else throw Error('Get does not load content from other files: '+p);
  return {ok:value!==undefined,status:value===undefined?404:200,json:async()=>structuredClone(value)};
 }
 function images(n){return records[n]?.images||[]}
 function image(n,i=1,small=false){const x=images(n)[Math.max(0,Number(i)-1)];return x?(small?x.thumb:x.image):''}
 return {ready,request,record:n=>records[n],images,image,date:n=>records[n]?.sort_date||'',isNews:n=>records[n]?.kind==='news',kind:n=>records[n]?.kind||'post',defaultBackupCover:()=>structuredClone(index.default_cover)};
})();
window.YURI1PostStorageId=document.body.dataset.assetNo;
window.YURI1PostPublicId=document.body.dataset.assetNo;
window.__YURI1_POST_ANALYTICS_READY=true;
document.querySelector('.post-text.post').dataset.rawContent=JSON.parse(document.getElementById('get-raw-content').textContent);
document.querySelector('[data-copy-post-link]')?.addEventListener('click',async event=>{
 event.preventDefault();const button=event.currentTarget;
 try{await navigator.clipboard.writeText(document.querySelector('link[rel="canonical"]').href);button.textContent='◈ Link Copied ◈'}catch{button.textContent='Copy the address from your browser'}
});
