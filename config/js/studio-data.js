window.Y1Data=(()=>{
 const cache=new Map(),records=new Map();
 function decode(el){let k=el.dataset.kind;if(k==='object')return Object.fromEntries([...el.children].map(x=>[x.dataset.key,decode(x.firstElementChild)]));if(k==='array')return [...el.children].map(x=>decode(x.firstElementChild));if(k==='null')return null;if(k==='boolean')return el.textContent==='true';if(k==='number')return Number(el.textContent);return el.textContent}
 async function html(path){if(!cache.has(path))cache.set(path,fetch(path,{cache:'no-cache'}).then(async r=>{if(!r.ok)throw Error('W HTML '+r.status+': '+path);return new DOMParser().parseFromString(await r.text(),'text/html')}));return cache.get(path)}
 async function data(path){return decode((await html(path)).querySelector('#w-data').firstElementChild)}
 let all={};
 const ready=data('w/records.html').then(v=>{all=v;return v});
 async function request(path,opt){let p=String(path);
  if(p.startsWith('record:')){await ready;let n=decodeURIComponent(p.slice(7)),d=all[n];return {ok:!!d,status:d?200:404,json:async()=>d?{...d}:null}}
  if(p.startsWith('content:')){await ready;let n=decodeURIComponent(p.slice(8)),d=all[n];if(!d)return {ok:false,status:404,json:async()=>null};let core=await html('core/'+n+'.html');return {ok:true,status:200,json:async()=>({...d,content:rewrite(core.querySelector('[data-field="Content"]').textContent)})}}
  if(/^w\/(catalog|tags|fonts)\.html$/.test(p))return {ok:true,status:200,json:()=>data(p)};
  return fetch(path,opt)
 }
 function rewrite(text){return text.replace(/(?:https:\/\/www\.yuri1\.com)?\/?(post|codex)\.html\?[^\s"'<>)]*/g,raw=>{let u=new URL(raw.replace(/^\//,''),'https://www.yuri1.com/');if(u.pathname.endsWith('post.html')){let n=window.Y1Identity?.[u.searchParams.get('id')];return n?'get/'+n+'.html':raw}let c=window.Y1Categories?.[u.searchParams.get('catalog')]||u.searchParams.get('catalog');let q=new URLSearchParams();if(c)q.set('catalog',c);u.searchParams.getAll('tag').forEach(t=>q.append('tag',window.Y1TagAliases?.[t]||t));return 'w/index.html'+(q.size?'?'+q:'')})}
 function images(n){return all[n]?.images||[]}
 function image(n,i=1,small=false){let item=images(n)[Math.max(0,Number(i)-1)];return item?(small?item.thumb:item.image):''}
 return {request,ready,record:n=>all[n],images,image,date:n=>all[n]?.sort_date||'',isNews:n=>all[n]?.kind==='news',kind:n=>all[n]?.kind||'post'};
})();
