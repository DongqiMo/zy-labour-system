/* Batch entry shares the single-order field schema and two-column workspace. */
let batchInput='',activeBatch=0;
const batchManualPrices=new WeakSet();
const singleOrderView=window.newView;
window.newView=function(){
 if(mode!=='batch'||editing)return singleOrderView();
 $('#content').innerHTML=`<div class="heading"><div><div class="eyebrow">ORDER WORKSPACE</div><h1>整理新劳务单</h1><p>移除上游编号，核对原单，再生成清晰的公司发布稿。</p></div><button onclick="editing=null;go('orders')">返回列表</button></div><div class="steps"><span>① 录入原单</span><span>② 确认信息</span><span>③ 确认备注金额并生成</span></div><div class="tabs"><button onclick="switchOrderMode('single')">单条录入</button><button class="primary" onclick="switchOrderMode('batch')">批量录入</button></div><div class="two batch-workspace"><section class="panel" id="batch-source"></section><section class="panel" id="batch-review"></section></div>`;
 renderBatch();
};
function batchPasteMarkup(){return `<h2>01 / 批量粘贴原单</h2><p>多份原单之间使用独立的 ---、“下一单”或“第 N 单”分隔。</p><textarea id="batchraw" class="rawbox" placeholder="在此粘贴多份微信群原单…" oninput="batchInput=this.value">${esc(batchInput)}</textarea><div class="actions"><button class="primary" onclick="previewBatch()">识别并预览</button></div>`}
window.previewBatch=async function(){
 const workspace=$('#batch-source'),owner=sessionUser,batchBefore=JSON.stringify(batch);
 const raw=($('#batchraw')?.value??batchInput).trim();batchInput=raw;
 if(!raw)return toast('请先粘贴原单');
 const parts=ZYOrderParser.splitBatchOrders(raw),next=[];
 for(const [index,source]of parts.entries()){
  const part=await simplify(source),analysis=await ZYAI.enhance(ZYOrderParser.analyze(part,code(next),{explicitBoundary:true})),order=analysis.order;
  if(sessionUser!==owner||$('#batch-source')!==workspace)return;
  if(JSON.stringify(batch)!==batchBefore)return toast('表单已修改，未覆盖人工内容');
  order.salary=ZYOrderParser.formatCompanySalary(order.salary);order.code=ZYOrderParser.companyCode(code(next),order.sourcePrefix);order.price=suggestion(order.salary);
  const snapshot=JSON.parse(order.parsedSnapshot||'{}');snapshot.code=order.code;snapshot.salary=order.salary;order.parsedSnapshot=JSON.stringify(snapshot);
  next.push(order);
 }
 batch=next;activeBatch=0;renderBatch();
};
window.renderBatch=function(){
 if(!$('#batch-source'))return;
 if(!batch.length){
  $('#batch-source').innerHTML=batchPasteMarkup();
  $('#batch-review').innerHTML=`<h2>02 / 核对公司单信息</h2><p class="note">请先粘贴并识别原单，再逐份核对全部字段。</p><fieldset disabled class="batch-fieldset"><div class="fields">${fields({},orderFields,'b-0')}</div></fieldset>`;
  return;
 }
 activeBatch=Math.min(Math.max(0,activeBatch),batch.length-1);const o=batch[activeBatch],prefix='b-'+activeBatch;
 $('#batch-source').innerHTML=`<div class="listhead"><h2>01 / 核对原单</h2><span class="muted">第 ${activeBatch+1} 份，共 ${batch.length} 份</span></div><p>自动移除上游单号；请逐项核对识别结果。</p><textarea id="batch-item-raw" class="rawbox" oninput="batch[activeBatch].raw=this.value;batch[activeBatch].reviewConfirmation='';updateRecognitionReview(document.querySelector('#batch-audit'),batch[activeBatch],activeBatch)">${esc(o.raw)}</textarea><div class="actions"><button class="primary" onclick="reparseBatchItem()">自动整理当前原单</button><button class="danger" onclick="removeBatchItem()">移除此份</button></div><p class="note">薪资保持原单格式；备注金额可留空，保存后进入待确认。</p><details><summary>重新粘贴全部原单</summary>${batchPasteMarkup()}</details>`;
 $('#batch-review').innerHTML=`<h2>02 / 核对公司单信息</h2><div id="batchpreview"><div class="batch-tabs">${batch.map((_,i)=>`<button class="${i===activeBatch?'primary':''}" onclick="selectBatchItem(${i})">第 ${i+1} 份</button>`).join('')}</div><p class="note">每份均可修改全部字段，填写全包价后按价格判定状态。</p><div id="batch-audit">${recognitionReviewMarkup(o,activeBatch)}</div><div class="fields" id="batch-fields">${fields(o,orderFields,prefix)}</div><div class="actions"><button onclick="selectBatchItem(${activeBatch-1})" ${activeBatch===0?'disabled':''}>上一份</button><button onclick="selectBatchItem(${activeBatch+1})" ${activeBatch===batch.length-1?'disabled':''}>下一份</button><button class="primary" onclick="saveBatch()">保存全部劳务单</button></div></div>`;
 $('#batch-fields').addEventListener('input',event=>{
  const field=event.target.id.slice((prefix+'-').length);if(!Object.hasOwn(orderFields,field))return;
  o[field]=event.target.value;o.reviewConfirmation='';
  if(field==='price')batchManualPrices.add(o);
  if(field==='salary'&&!batchManualPrices.has(o)){o.price=suggestion(o.salary);$('#'+prefix+'-price').value=o.price}
  refreshFeeNote(prefix);updateRecognitionReview($('#batch-audit'),o,activeBatch);
 });
 $('#batch-fields').addEventListener('change',event=>{if(event.target.tagName!=='SELECT')return;const field=event.target.id.slice((prefix+'-').length);if(Object.hasOwn(orderFields,field)){o[field]=event.target.value;o.reviewConfirmation='';updateRecognitionReview($('#batch-audit'),o,activeBatch)}});
};
function selectBatchItem(index){if(index<0||index>=batch.length)return;activeBatch=index;renderBatch()}
function removeBatchItem(){batch.splice(activeBatch,1);renderBatch()}
async function reparseBatchItem(){
 const owner=sessionUser,previous=batch[activeBatch],before=JSON.stringify(previous),raw=await simplify($('#batch-item-raw').value.trim());if(!raw)return toast('请先粘贴原单');
 const result=await ZYAI.enhance(ZYOrderParser.analyze(raw,previous.code,{explicitBoundary:true}));if(sessionUser!==owner||batch[activeBatch]!==previous)return;if(JSON.stringify(previous)!==before)return toast('表单已修改，未覆盖人工内容');if(!result.order)return toast(result.warnings[0]);const parsed=result.order;parsed.salary=ZYOrderParser.formatCompanySalary(parsed.salary);parsed.sourcePrefix=parsed.sourcePrefix||previous.sourcePrefix||'';parsed.code=previous.code;parsed.price=suggestion(parsed.salary);batch[activeBatch]=parsed;renderBatch();toast('整理完成，请核对各项信息');
}
window.saveBatch=async function(){
 if(!batch.length)return toast('没有可保存的原单');
 const used=new Set(orders.map(o=>ZYOrderParser.baseCode(o.code)));
 for(let i=0;i<batch.length;i++){
  const o=batch[i],fail=message=>{activeBatch=i;renderBatch();toast(`第 ${i+1} 份：${message}`)};
  if(!o.raw?.trim()||!o.title?.trim()||!o.code?.trim())return fail('请填写原单、职位名称和公司单号');
  const candidate=ZYOrderParser.sanitizeCompany(o),issues=ZYOrderParser.validateCompany(candidate);if(issues.length)return fail(issues[0]);
  if(used.has(ZYOrderParser.baseCode(candidate.code)))return fail('公司单号已存在，请修改');used.add(ZYOrderParser.baseCode(candidate.code));
 }
 const added=batch.map(o=>ZYOrderParser.sanitizeCompany({...Object.fromEntries(Object.keys(orderFields).map(k=>[k,String(o[k]??'').trim()])),raw:ZYOrderParser.sanitizeRaw(o.raw),sourcePrefix:o.sourcePrefix||'',...recognitionMetadata(o,o),id:crypto.randomUUID(),createdAt:new Date().toISOString(),status:status(o.price)})).map(record=>({...record,salary:ZYOrderParser.formatCompanySalary(record.salary),price:priceN(record.price)>0?priceFmt(record.price):''}));
 const old=orders;orders=added.concat(orders);if(!await persist()){orders=old;return}
 batch=[];batchInput='';activeBatch=0;go('orders');toast('批量劳务单已保存');
};
