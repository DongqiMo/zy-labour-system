/* Whole-document review shared by single and batch entry. No row-number extraction. */
let singleRecognitionMeta=null;
const recognitionWorkspace=window.newView;
window.newView=function(){
 recognitionWorkspace();
 if(mode==='batch'&&!editing)return;
 singleRecognitionMeta=editing?{...(orders.find(o=>o.id===editing)||{})}:null;
 const raw=$('#raw');if(!raw)return;
 const feedback=document.createElement('div');feedback.id='recognition-feedback';feedback.setAttribute('role','status');raw.parentElement.insertBefore(feedback,raw);
 if(editing){const button=document.createElement('button');button.type='button';button.textContent='按原单重新识别（预览）';button.onclick=reparseExistingOrder;raw.parentElement.querySelector('.note').before(button)}
};
function recognitionFeedback(messages,multi=false){
 const container=$('#recognition-feedback');if(!container)return;
 container.innerHTML=messages.length?`<div class="note">${messages.map(message=>`<p>${esc(message)}</p>`).join('')}${multi?'<button type="button" onclick="moveSourceToBatch()">转到批量处理</button>':''}</div>`:'';
}
function fillRecognisedFields(order){for(const key of Object.keys(orderFields))$('#o-'+key).value=order[key]||''}
window.autoParse=async function(){
 const input=await simplify($('#raw').value.trim());if(!input)return toast('请先粘贴原单');
 const result=ZYOrderParser.analyze(input,code());
 if(!result.order){recognitionFeedback(result.warnings,true);return toast(result.warnings[0])}
 const order=result.order;if(!order.sourcePrefix&&singleRecognitionMeta?.raw===order.raw){order.sourcePrefix=singleRecognitionMeta.sourcePrefix||'';order.code=ZYOrderParser.companyCode(order.code,order.sourcePrefix)}order.price=suggestion(order.salary);singleRecognitionMeta=order;$('#raw').value=order.raw;fillRecognisedFields(order);priceManual=false;
 recognitionFeedback(result.warnings);toast('整理完成，请核对各项信息');
};
function moveSourceToBatch(){batchInput=$('#raw').value;batch=[];editing=null;mode='batch';newView();previewBatch()}
async function reparseExistingOrder(){
 const input=orders.find(o=>o.id===editing)?.raw||$('#raw').value,result=ZYOrderParser.analyze(input,$('#o-code').value);
 if(!result.order){recognitionFeedback(result.warnings,true);return}
 const old=orders.find(o=>o.id===editing),fresh=result.order;
 fresh.sourcePrefix=fresh.sourcePrefix||old?.sourcePrefix||$('#o-code').value.match(/ ([A-Z]+)$/)?.[1]||'';
 fresh.code=ZYOrderParser.companyCode($('#o-code').value,fresh.sourcePrefix);fresh.price=$('#o-price').value;
 singleRecognitionMeta=fresh;fillRecognisedFields(fresh);recognitionFeedback(['已生成重新识别预览，核对后保存才会修改公司单',...result.warnings]);
}
function recognitionMetadata(order,meta){
 if(!meta)return {};
 let previous={};try{previous=JSON.parse(meta.parsedSnapshot||'{}')}catch{}
 const manual=Object.keys(previous).filter(key=>String(order[key]??'')!==String(previous[key]??''));
 return {sourcePrefix:order.sourcePrefix||meta.sourcePrefix||'',parserVersion:meta.parserVersion||'',parsedSnapshot:meta.parsedSnapshot||'',manualFields:JSON.stringify(manual)};
}
window.saveOrder=async function(){
 const data=read(orderFields),input=$('#raw').value.trim();
 if(!input||!data.title||!data.code)return toast('请填写原单、职位名称和公司单号');
 const oldRecord=editing?orders.find(o=>o.id===editing):null;
 const origin=data.code.match(/ ([A-Z]+)$/)?.[1]||singleRecognitionMeta?.sourcePrefix||ZYOrderParser.sourcePrefix(input);
 const candidate=ZYOrderParser.sanitizeCompany({...data,sourcePrefix:origin,raw:oldRecord?.raw??ZYOrderParser.sanitizeRaw(input)});
 const problems=ZYOrderParser.validateCompany(candidate);if(problems.length){recognitionFeedback(problems,ZYOrderParser.splitOrders(input).length>1);return toast(problems[0])}
 if(orders.some(o=>o.id!==editing&&ZYOrderParser.baseCode(o.code)===ZYOrderParser.baseCode(candidate.code)))return toast('公司单号已存在，请修改');
 const metadata=recognitionMetadata(candidate,singleRecognitionMeta);
 const before=orders;
 if(editing)orders=orders.map(o=>o.id===editing?{...o,...candidate,...metadata,status:status(candidate.price)}:o);
 else orders=[{...candidate,...metadata,id:crypto.randomUUID(),createdAt:new Date().toISOString(),status:status(candidate.price)},...orders];
 if(!await persist()){orders=before;return}
 editing=null;singleRecognitionMeta=null;go('orders');toast('劳务单已保存');
};
window.copyOrder=async function(id){
 const order=ZYOrderParser.present(orders.find(o=>o.id===id)),problems=ZYOrderParser.validateCompany(order,true);
 if(problems.length)return toast(problems[0]);
 try{await navigator.clipboard.writeText(publish(order));toast('公司单已复制')}catch{toast('复制失败，请展开公司单选择文字复制')}
};
