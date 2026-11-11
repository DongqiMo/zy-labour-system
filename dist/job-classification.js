/* Pure classification contract: shared dictionary, merge resolution and local fallback. */
(function(root){
 const V=root.ZYJobCategories||(typeof require==='function'?require('./job-categories.js'):null),norm=x=>String(x??'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
 let dictionary=V.subcategories.map(x=>({...x})),cache=[],revision=0,bindings=new Map();
 const majorValid=id=>V.majors.some(m=>m.id===id),majorLabel=id=>V.majors.find(m=>m.id===id)?.label||'其他';
 function configure(data={}){const next=[...V.subcategories.map(x=>({...x})),...(data.subcategories||[])].filter((x,i,a)=>a.findLastIndex(y=>y.id===x.id)===i),nextCache=Array.isArray(data.cache)?data.cache:cache;if(JSON.stringify(next)===JSON.stringify(dictionary)&&JSON.stringify(nextCache)===JSON.stringify(cache))return;dictionary=next;cache=nextCache;revision++;}
 function resolve(id){const seen=new Set();let row=dictionary.find(s=>s.id===id);while(row?.merged_into){if(seen.has(row.id))return null;seen.add(row.id);row=dictionary.find(s=>s.id===row.merged_into)}return row&&majorValid(row.major)?row:null}
 function classify(title='',duties='',employer='',kind='order'){
  const primary=norm(title),content=norm(duties),company=norm(employer),fields=[primary,content,...(kind==='history'?[company]:[])];let major='other',evidence='';
  for(const text of fields){const found=V.majors.flatMap(m=>m.keywords.filter(k=>text.includes(norm(k))).map(k=>({major:m.id,keyword:k}))).sort((a,b)=>b.keyword.length-a.keyword.length)[0];if(found){major=found.major;evidence=found.keyword;break}}
  if(major==='other'){const known=dictionary.map(s=>resolve(s.id)).filter(Boolean).flatMap(s=>[s.name,...(s.aliases||[])].map(alias=>({s,alias,at:fields.findIndex(t=>t.includes(norm(alias)))}))).filter(x=>x.at>=0).sort((a,b)=>a.at-b.at||b.alias.length-a.alias.length)[0];if(known){major=known.s.major;evidence=known.alias}}
  // Resolve industry-specific maintenance from employer context before generic "repair worker".
  const candidates=dictionary.map(s=>resolve(s.id)).filter((s,i,a)=>s&&s.major===major&&a.findIndex(x=>x?.id===s.id)===i).flatMap(s=>[s.name,...(s.aliases||[])].map(alias=>({s,alias,at:fields.findIndex(t=>t.includes(norm(alias)))}))).filter(x=>x.at>=0).sort((a,b)=>a.at-b.at||b.alias.length-a.alias.length),best=candidates[0];
  return {major,subcategory_id:best?.s.id||null,evidence:best?.alias||evidence,by:'rules',name:best?.s.name||null};
 }
 function compare(a,b){if(!a||!b||a.major==='other'||b.major==='other')return null;const left=resolve(a.subcategory_id),right=resolve(b.subcategory_id),am=left?.major||a.major,bm=right?.major||b.major;if(left&&right&&left.id===right.id)return 1;return am===bm?.6:0}
 function valid(row,text){if(!row||!majorValid(row.major)||typeof row.evidence!=='string'||!row.evidence.trim()||!String(text).includes(row.evidence))return false;const sub=resolve(row.subcategory_id);return !row.subcategory_id||!!sub;}
 function current(row){const sub=resolve(row?.subcategory_id);return {...row,major:sub?.major||row?.major,subcategory_id:sub?.id||null,name:sub?.name||null}}
 function certificates(text){if(/^(?:无|無|没有|暂无)\s*$/.test(norm(text)))return [];return V.certificates.filter(r=>String(text).includes(r.keyword)&&!new RegExp('(?:无|無|没有|暂无)\\s*'+r.keyword).test(text)).map(r=>{const sub=resolve(r.subcategory_id);return {major:sub?.major||'other',subcategory_id:sub?.id||null,name:sub?.name||null,evidence:r.keyword,by:'rules'}}).filter((r,i,a)=>a.findIndex(x=>x.subcategory_id===r.subcategory_id)===i)}
 function canonical(kind,input){const keys=kind==='order'?['title','workContent']:kind==='history'?['position','duties','employer']:kind==='intent'?['text']:['text'];return JSON.stringify([kind,...keys.map(k=>norm(input[k]))])}
 async function textHash(kind,input){const bytes=new TextEncoder().encode(canonical(kind,input)),digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')}
 async function bind(items){for(let i=0;i<items.length;i+=100)await Promise.all(items.slice(i,i+100).map(async item=>bindings.set(canonical(item.kind,item.input),await textHash(item.kind,item.input))));while(bindings.size>20000)bindings.delete(bindings.keys().next().value)}
 function cached(kind,input){const hash=bindings.get(canonical(kind,input));return hash?fromCache(hash):null}
 function certificateTexts(text){return String(text||'').replace(/([证證](?:书|書)?)(?:\s*(?:和|及|与|與|\/|&)\s*|\s+)/g,'$1、').split(/[，,；;、\n]+/).map(x=>x.trim()).filter(x=>x&&!/^健康[证證]$/.test(x))}
 function itemsFor(record,kind){if(kind==='order')return [{kind,input:{title:record.title||'',workContent:record.workContent||'',requirements:record.requirements||''}}];return [...[record.desiredJob1||record.desiredJob,record.desiredJob2,record.desiredJob3].map((text,index)=>({kind:'intent',index,input:{text:text||''}})),...(record.workHistory||[]).map((h,index)=>({kind:'history',index,input:{position:h.position||'',duties:h.duties||'',employer:h.employer||''}})),...certificateTexts(record.certificates).map((text,index)=>({kind:'certificate',index,input:{text}}))].filter(item=>Object.values(item.input).some(x=>String(x).trim()))}
 function reset(){dictionary=V.subcategories.map(x=>({...x}));cache=[];bindings.clear();revision++}
 function fromCache(hash){const row=cache.find(c=>c.text_hash===hash);return row?current(row):null}
 root.ZYClassification={configure,resolve,classify,compare,valid,current,certificates,majorValid,majorLabel,canonical,textHash,fromCache,cached,bind,itemsFor,certificateTexts,reset,get dictionary(){return dictionary},get cache(){return cache},get revision(){return revision}};if(typeof module!=='undefined'&&module.exports)module.exports=root.ZYClassification;
})(globalThis);
