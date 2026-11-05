/* Whole-document review shared by single and batch entry. No row-number extraction. */
let singleRecognitionMeta=null;
const recognitionWorkspace=window.newView;
window.newView=function(){
 recognitionWorkspace();
 if(mode==='batch'&&!editing)return;
 singleRecognitionMeta=editing?{...(orders.find(o=>o.id===editing)||{})}:null;
 const raw=$('#raw');if(!raw)return;
 const feedback=document.createElement('div');feedback.id='recognition-feedback';feedback.setAttribute('role','status');raw.parentElement.insertBefore(feedback,raw);
 const refresh=()=>{if(!$('#raw'))return;const meta=singleRecognitionMeta||{};if(!ZYOrderParser.isHumanReviewed(meta))meta.reviewConfirmation='';singleRecognitionMeta=meta;const current={...meta,...read(orderFields),raw:$('#raw').value};recognitionFeedback(ZYOrderParser.reviewOrder(current.raw,current).warnings,false,current)};
 for(const control of $('#content').querySelectorAll('[id^="o-"]'))control.addEventListener(control.tagName==='SELECT'?'change':'input',refresh);
 if(editing){feedback.innerHTML=recognitionReviewMarkup(singleRecognitionMeta);const button=document.createElement('button');button.type='button';button.textContent='按原单重新识别（预览）';button.onclick=reparseExistingOrder;raw.parentElement.querySelector('.note').before(button)}
};
function recognitionReviewMarkup(order,batchIndex=-1){
 if(!order)return '';
 const report=ZYOrderParser.reviewOrder(order.raw||'',order);
 const reasons={supplier_package_quote:'上家全包报价',upstream_fee:'上家收费信息',supplier_footer:'上家尾部报价',unlabelled_amount:'无标签金额或算式',promotional_heading:'宣传提示'};
 const excluded=report.excluded.map(entry=>`<tr><td data-user-content>${esc(entry.text)}</td><td>${reasons[entry.reason]||'已排除'}</td></tr>`).join('');
 const conflicts=report.conflicts.map(entry=>`<p data-user-content>${esc(entry.text)}</p>`).join('');
 const confirmed=ZYOrderParser.isHumanReviewed(order)||ZYOrderParser.hasReviewConfirmation(order);
 const rows=Object.entries(report.sources).filter(([key])=>Object.hasOwn(orderFields,key)).map(([key,lines])=>`<tr><th>${esc(orderFields[key].replace('*',''))}</th><td data-user-content>${lines.map(line=>esc(line)).join('<br>')}</td></tr>`).join('');
 return `<details class="recognition-review"><summary>字段来源与待核对清单</summary><div class="recognition-body">${report.reviewed?'<p class="note">公司单已人工核对</p>':''}<p>来源为识别时的原文片段；手动修改后请重新核对。</p>${report.warnings.length?`<ul>${report.warnings.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:'<p>未发现额外核对项目，仍请确认识别结果。</p>'}${rows?`<table class="source-table"><tbody>${rows}</tbody></table>`:''}${excluded?`<details><summary>已排除内容与原因</summary><table class="source-table"><tbody>${excluded}</tbody></table></details>`:''}${conflicts?`<h3>冲突内容</h3>${conflicts}`:''}${report.needsAcknowledgement?`<label class="review-confirm"><input type="checkbox" ${confirmed?'checked':''} onchange="confirmRecognitionReview(this.checked,${batchIndex})"><span>已核对未分类和冲突内容，必要信息已补入公司单</span></label>`:''}${report.unclassified.length?`<h3>未分类内容</h3><p data-user-content>${report.unclassified.map(line=>esc(line)).join('<br>')}</p>`:''}</div></details>`;
}
function updateRecognitionReview(container,order,index=-1){
 const existing=container.querySelector('.recognition-review');
 if(!order){existing?.remove();return;}
 const holder=document.createElement('div');holder.innerHTML=recognitionReviewMarkup(order,index);
 const next=holder.firstElementChild;
 if(existing)existing.querySelector('.recognition-body').replaceChildren(...next.querySelector('.recognition-body').childNodes);
 else container.append(next);
}
function confirmRecognitionReview(checked,index=-1){
 const target=index>=0?batch[index]:(singleRecognitionMeta??={});
 const raw=index>=0?target.raw:$('#raw').value;
 target.reviewConfirmation=checked?ZYOrderParser.reviewSignature(raw):'';
}
function recognitionFeedback(messages,multi=false,order=null){
 const container=$('#recognition-feedback');if(!container)return;
 let notices=container.querySelector('.recognition-messages');if(!notices){notices=document.createElement('div');notices.className='recognition-messages';container.prepend(notices)}
 notices.innerHTML=messages.length?`<div class="note">${messages.map(message=>`<p>${esc(message)}</p>`).join('')}${multi?'<button type="button" onclick="moveSourceToBatch()">转到批量处理</button>':''}</div>`:'';
 updateRecognitionReview(container,order);

}
function fillRecognisedFields(order){for(const key of Object.keys(orderFields))$('#o-'+key).value=(key==='salary'?ZYOrderParser.formatCompanySalary(order[key]):order[key])||''}
window.autoParse=async function(){
 const input=await simplify($('#raw').value.trim());if(!input)return toast('请先粘贴原单');
 const result=ZYOrderParser.analyze(input,code());
 if(!result.order){recognitionFeedback(result.warnings,true);return toast(result.warnings[0])}
 const order=result.order;if(!order.sourcePrefix&&singleRecognitionMeta?.raw===order.raw){order.sourcePrefix=singleRecognitionMeta.sourcePrefix||'';order.code=ZYOrderParser.companyCode(order.code,order.sourcePrefix)}order.price=suggestion(order.salary);singleRecognitionMeta=order;$('#raw').value=order.raw;fillRecognisedFields(order);priceManual=false;
 recognitionFeedback(result.warnings,false,order);toast('整理完成，请核对各项信息');
};
function moveSourceToBatch(){batchInput=$('#raw').value;batch=[];editing=null;mode='batch';newView();previewBatch()}
async function reparseExistingOrder(){
 const input=orders.find(o=>o.id===editing)?.raw||$('#raw').value,result=ZYOrderParser.analyze(input,$('#o-code').value);
 if(!result.order){recognitionFeedback(result.warnings,true);return}
 const old=orders.find(o=>o.id===editing),fresh=result.order;
 fresh.sourcePrefix=fresh.sourcePrefix||old?.sourcePrefix||$('#o-code').value.match(/ ([A-Z]+)$/)?.[1]||'';
 fresh.code=$('#o-code').value.trim();fresh.price=$('#o-price').value;
 singleRecognitionMeta=fresh;fillRecognisedFields(fresh);recognitionFeedback(['已生成重新识别预览，核对后保存才会修改公司单',...result.warnings],false,fresh);
}
function recognitionMetadata(order,meta){
 if(!meta)return {};
 let previous={};try{previous=JSON.parse(meta.parsedSnapshot||'{}')}catch{}
 const manual=Object.keys(previous).filter(key=>String(order[key]??'')!==String((key==='salary'?ZYOrderParser.formatCompanySalary(previous[key]):previous[key])??''));
 return {sourcePrefix:order.sourcePrefix||meta.sourcePrefix||'',parserVersion:meta.parserVersion||'',parsedSnapshot:meta.parsedSnapshot||'',manualFields:JSON.stringify(manual),recognitionAudit:meta.recognitionAudit||'',reviewConfirmation:meta.reviewConfirmation||'',humanReviewedSource:meta.humanReviewedSource||'',humanReviewedAt:meta.humanReviewedAt||'',humanReviewedBy:meta.humanReviewedBy||''};
}
window.saveOrder=async function(){
 const data=read(orderFields),input=$('#raw').value.trim();
 if(!input||!data.title||!data.code)return toast('请填写原单、职位名称和公司单号');
 const oldRecord=editing?orders.find(o=>o.id===editing):null;
 const origin=data.code.match(/ ([A-Z]+)$/)?.[1]||singleRecognitionMeta?.sourcePrefix||ZYOrderParser.sourcePrefix(input);
 const candidate=ZYOrderParser.sanitizeCompany({...data,sourcePrefix:origin,raw:oldRecord?.raw??ZYOrderParser.sanitizeRaw(input)});
 candidate.salary=ZYOrderParser.formatCompanySalary(candidate.salary);
 if(editing)Object.assign(candidate,ZYOrderParser.humanReviewMetadata(candidate,sessionUser?.username));
 const problems=ZYOrderParser.validateCompany(candidate,!!editing);if(problems.length){recognitionFeedback(problems,ZYOrderParser.splitOrders(input).length>1);return toast(problems[0])}
 if(orders.some(o=>o.id!==editing&&ZYOrderParser.baseCode(o.code)===ZYOrderParser.baseCode(candidate.code)))return toast('公司单号已存在，请修改');
 const baseline=singleRecognitionMeta?.parsedSnapshot&&ZYOrderParser.sanitizeRaw(singleRecognitionMeta.raw||'')===ZYOrderParser.sanitizeRaw(input)?singleRecognitionMeta:ZYOrderParser.parse(input,candidate.code);
 const metadata=recognitionMetadata(candidate,{...baseline,reviewConfirmation:singleRecognitionMeta?.reviewConfirmation||''});
 if(editing||ZYOrderParser.hasReviewConfirmation({...candidate,...metadata})||ZYOrderParser.isHumanReviewed(oldRecord||{}))Object.assign(metadata,ZYOrderParser.humanReviewMetadata(candidate,sessionUser?.username));
 const before=orders;
 if(editing)orders=orders.map(o=>o.id===editing?{...o,...candidate,...metadata,status:status(candidate.price)}:o);
 else orders=[{...candidate,...metadata,id:crypto.randomUUID(),createdAt:new Date().toISOString(),status:status(candidate.price)},...orders];
 if(!await persist()){orders=before;return}
 editing=null;singleRecognitionMeta=null;go('orders');window.startBackgroundOrderAudit?.(orders);toast('劳务单已保存');
};
window.copyOrder=async function(id){
 const order=ZYOrderParser.present(orders.find(o=>o.id===id)),problems=ZYOrderParser.validateCompany(order,true);
 if(problems.length)return toast(problems[0]);
 try{await navigator.clipboard.writeText(publish(order));toast('公司单已复制')}catch{toast('复制失败，请展开公司单选择文字复制')}
};

window.markOrderReviewed=async function(id){
 const record=orders.find(order=>order.id===id);if(!record)return;
 const metadata=ZYOrderParser.humanReviewMetadata(record,sessionUser?.username);
 const problems=ZYOrderParser.validateCompany({...ZYOrderParser.present(record),...metadata},true);if(problems.length)return toast(problems[0]);
 const before=orders;orders=orders.map(order=>order.id===id?{...order,...metadata}:order);
 if(!await persist()){orders=before;return;}render();window.startBackgroundOrderAudit?.(orders);toast('公司单已人工核对');
};
