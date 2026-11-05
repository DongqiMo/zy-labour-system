/* Private first machine output, frozen before any form edit. Never a company-publication field. */
(function(root){
 const fields=['code','title','employer','salary','gender','age','language','hours','interview','rest','workContent','requirements','notes','price'];
 function capture(source,order,warnings=[]){
  const initial=root.ZYOrderParser.present(order);
  return JSON.stringify({format:'zy-first-recognition',version:1,capturedAt:new Date().toISOString(),parserVersion:order.parserVersion||'',provider:order.aiProvider||'rules',model:order.aiModel||'',source:String(source??''),recognitionSource:order.raw||'',company:Object.fromEntries(fields.map(key=>[key,String(initial[key]??'')])),warnings:[...warnings],recognitionAudit:order.recognitionAudit||''});
 }
 function read(record){
  try{const data=JSON.parse(record.firstRecognition||'');if(data.format!=='zy-first-recognition'||data.version!==1||typeof data.source!=='string'||!data.company||typeof data.company!=='object')return null;return data}catch{return null}
 }
 function report(records){
  const samples=records.map(record=>{
   const first=read(record);
   // Never fall back to current company fields or a fresh parse as a historical first result.
   return first?{id:record.id,businessCode:record.code,status:'captured',format:first.format,version:first.version,capturedAt:first.capturedAt,parserVersion:first.parserVersion,provider:first.provider||'rules',model:first.model||'',source:first.source,recognitionSource:first.recognitionSource||'',warnings:first.warnings||[],recognitionAudit:first.recognitionAudit||'',company:Object.fromEntries(fields.map(key=>[key,String(first.company[key]??'')]))}:{id:record.id,businessCode:record.code,status:'not_recorded',source:record.raw||'',sourceStatus:'legacy_saved_source',company:null};
  });
  return {format:'zy-first-recognition-archive',version:1,generatedAt:new Date().toISOString(),total:samples.length,captured:samples.filter(s=>s.status==='captured').length,notRecorded:samples.filter(s=>s.status==='not_recorded').length,records:samples};
 }
 root.ZYRecognitionArchive={capture,read,report};
})(globalThis);
