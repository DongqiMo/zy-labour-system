/* Ephemeral navigation protection. No business drafts are written to browser storage. */
(function(root){
 let baseline=null,baselineElement=null,passing=0;
 const message='放弃未保存的内容？';
 function orderSnapshot(){const raw=document.querySelector('#raw');if(!raw)return null;return JSON.stringify({raw:raw.value,fields:read(orderFields)})}
 function orderDirty(){return !!baselineElement&&baselineElement===document.querySelector('#raw')&&orderSnapshot()!==baseline}
 function normalWorker(value){
  if(Array.isArray(value))return value.map(normalWorker).filter(item=>item!==undefined);
  if(value&&typeof value==='object'){
   const output={};for(const key of Object.keys(value).sort()){
    if(['_version','id','createdAt','updatedAt','sourcePdfDirty'].includes(key))continue;
    const item=normalWorker(value[key]);if(item!==undefined&&(!Array.isArray(item)||item.length))output[key]=item;
   }return Object.keys(output).length?output:undefined;
  }
  if(value===null||value===undefined||typeof value==='string'&&!value.trim())return undefined;
  return value;
 }
 function workerDirty(){
  const current={...worker};if(document.querySelector('#worker-registration-form'))Object.assign(current,read(workerDefs,'w'));
  const saved={...(workers.find(record=>record.id===current.id)||{})};
  if(!saved.desiredJob1&&saved.desiredJob)saved.desiredJob1=saved.desiredJob;
  if(!saved.certificates&&saved.skills)saved.certificates=saved.skills;
  return JSON.stringify(normalWorker(current)||{})!==JSON.stringify(normalWorker(saved)||{});
 }
 function batchDirty(){return !!batch.length||!!String(document.querySelector('#batchraw')?.value??batchInput).trim()}
 function anyDirty(){return orderDirty()||workerDirty()||batchDirty()}
 function allowSingle(){return passing||saving||!orderDirty()||confirm(message)}
 function pass(action){passing++;try{return action()}finally{passing--}}
 const renderOrder=root.newView;
 root.newView=function(...args){const result=renderOrder(...args);baselineElement=document.querySelector('#raw');baseline=orderSnapshot();return result};
 const go=root.go;
 root.go=function(...args){if(!allowSingle())return false;if(args[0]==='match'&&view==='workers'&&!saving&&workerDirty()&&!confirm('登记资料尚未保存，仍要进入岗位匹配？'))return false;return pass(()=>go(...args))};
 const leave=root.leaveOrderEditor;
 root.leaveOrderEditor=function(...args){if(!allowSingle())return false;return pass(()=>leave(...args))};
 const edit=root.editOrder;
 root.editOrder=function(...args){if(!allowSingle())return false;return pass(()=>edit(...args))};
 root.switchOrderMode=function(next){if(next===mode)return;if(!allowSingle())return false;return pass(()=>{mode=next;root.newView()})};
 root.newWorkerRegistration=function(){
  if(!saving&&workerDirty()&&!confirm(message))return false;
  if(!allowSingle())return false;
  return pass(()=>{worker={};root.go('workers')});
 };
 const editWorker=root.editWorker;
 root.editWorker=function(...args){
  if(!saving&&workerDirty()&&!confirm(message))return false;
  if(!allowSingle())return false;
  return pass(()=>editWorker(...args));
 };
 root.ZYDrafts={orderDirty,workerDirty,batchDirty,anyDirty,confirmAll:()=>!anyDirty()||confirm(message)};
 addEventListener('beforeunload',event=>{if(!sessionUser||!anyDirty())return;event.preventDefault();event.returnValue=''});
})(globalThis);
