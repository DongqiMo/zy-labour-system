/* Read-only, authenticated order self-audit. Suggestions never overwrite stored records. */
(function(){
 const required=['title','employer','salary','gender','age','hours','workContent'];
 const labels={title:'职位名称',employer:'雇主',salary:'薪资待遇（月薪）',gender:'招聘性别',age:'年龄要求',hours:'工作时间',workContent:'工作内容'};
 let report=null,auditGeneration=0;
 function inspect(record){
  if(ZYOrderParser.isHumanReviewed(record))return {id:record.id,code:record.code||'',raw:record.raw||'',candidate:ZYOrderParser.present(record),missing:[],unsupported:[],sources:{},changed:[],warnings:[],conflicts:[],unclassified:[],needsReview:false,humanReviewed:true};
  const analysis=ZYOrderParser.analyze(record.raw||'',record.code||'',{explicitBoundary:record.boundaryMode==='explicit'});
  const candidate=analysis.order?ZYOrderParser.present({...analysis.order,code:record.code,price:record.price}):null;
  const current=ZYOrderParser.present(record),missing=required.filter(key=>!String(candidate?.[key]||'').trim());
  const unsupported=candidate?required.filter(key=>String(candidate[key]||'').trim()&&!(analysis.sources?.[key]?.length)):[];
  const changed=candidate?required.filter(key=>String(current[key]||'').replace(/\s/g,'')!==String(candidate[key]||'').replace(/\s/g,'')):[];
  return {id:record.id,code:record.code||'',raw:record.raw||'',candidate,missing,unsupported,sources:analysis.sources||{},changed,warnings:analysis.warnings,conflicts:analysis.conflicts||[],unclassified:analysis.unclassified||[],needsReview:!candidate||missing.length>0||unsupported.length>0||changed.length>0||(analysis.conflicts||[]).length>0||(analysis.unclassified||[]).length>0};
 }
 window.ZYOrderAudit={inspect,required:[...required]};
 async function buildReport(source,owner){
  const run=++auditGeneration,records=[];
  for(let i=0;i<source.length;i++){
   if(sessionUser!==owner||run!==auditGeneration)return false;
   records.push(inspect(source[i]));if(i%20===19)await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(sessionUser!==owner||run!==auditGeneration)return false;
  report={format:'zy-order-recognition-audit',version:1,parserVersion:'13',generatedAt:new Date().toISOString(),total:records.length,needsReview:records.filter(record=>record.needsReview).length,records};
  refreshOrderAuditBadge();return true;
 }
 window.refreshOrderAuditBadge=function(){document.querySelectorAll('[data-order-audit-count]').forEach(element=>element.textContent=report?'('+report.needsReview+'/'+report.total+')':'')};
 window.startBackgroundOrderAudit=function(source){const owner=sessionUser;setTimeout(()=>{if(owner===sessionUser)buildReport(source,owner).catch(()=>{})},0)};
 window.openOrderAudit=async function(){
  if(!sessionUser)return;
  const owner=sessionUser;$('#modal').innerHTML='<h2>原单识别自查</h2><p role="status">正在按单号核查原单…</p>';$('#modal').showModal();
  try{
   const data=await api('/api/orders');if(await buildReport(data.orders,owner))renderAudit();
  }catch(error){toast(error.message||'自查失败，请稍后重试')}
 };
 function renderAudit(){
  if(!report||!sessionUser)return;
  $('#modal').innerHTML=`<h2>原单识别自查</h2><p>逐单比较原单与公司单，不自动修改资料。</p><p><span>单据总数</span> <b data-user-content>${report.total}</b> · <span>需要核对</span> <b data-user-content>${report.needsReview}</b></p><div class="actions"><button onclick="downloadOrderAudit()">下载自查报告（含原单）</button><button onclick="$('#modal').close()">关闭</button></div>${report.records.map((record,index)=>`<details class="recognition-review"><summary><span data-user-content>${esc(record.code||record.id)}</span> · <span>${record.humanReviewed?'公司单已人工核对':record.needsReview?'需要核对':'关键字段已识别'}</span></summary>${record.missing.length?`<p><span>未找到明确来源，请核对</span>：${record.missing.map(key=>`<span>${labels[key]}</span>`).join('、')}</p>`:''}${record.unsupported.length?`<p><span>缺少可核对来源</span>：${record.unsupported.map(key=>`<span>${labels[key]}</span>`).join('、')}</p>`:''}${record.changed.length?`<p><span>与现有公司单不同</span>：${record.changed.map(key=>`<span>${labels[key]}</span>`).join('、')}</p>`:''}${record.candidate?`<table class="source-table"><tbody>${required.map(key=>`<tr><th>${labels[key]}</th><td data-user-content>${esc(record.candidate[key]||'—')}</td></tr>`).join('')}</tbody></table>`:''}${record.warnings.map(warning=>`<p>${esc(warning)}</p>`).join('')}<button onclick="openAuditedOrder(${index})">查看转单预览</button></details>`).join('')}`;
 }
 window.openAuditedOrder=async function(index){
  const item=report?.records[index];if(!item||!sessionUser)return;
  // Reload before entering the existing review/save flow so edits use a fresh revision.
  const data=await api('/api/orders');orders=data.orders;revision=data.revision;
  if(!orders.some(record=>record.id===item.id))return toast('单据已不存在，请重新自查');
  $('#modal').close();editOrder(item.id);await reparseExistingOrder();
 };
 window.downloadOrderAudit=function(){
  if(!report||!sessionUser)return;
  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='zy-order-recognition-audit-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const login=window.loginScreen;
 window.loginScreen=function(...args){report=null;auditGeneration++;return login(...args)};
})();
