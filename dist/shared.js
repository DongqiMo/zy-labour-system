// Application API; Supabase for free static hosting, same-origin SQLite for self-hosting.
let lastSync=0,pendingSync=null;const cloudMode=window.ZY_CONFIG?.provider==='supabase';let cloud=null;
async function api(path,{method='GET',body}={}){
  if(cloudMode){try{if(!cloud)throw new Error('云端尚未配置');return await cloud.call(path,{method,body})}catch(e){if(e.status===401&&path!=='/api/login')loginScreen('登录已过期，请重新登录');throw e}}
  const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});
  let data;try{data=await response.json()}catch{throw new Error('服务器响应异常，请稍后重试')}
  if(!response.ok){if(response.status===401&&path!=='/api/login')loginScreen('登录已过期，请重新登录。');throw new Error(data.error||'请求失败')}
  return data;
}
function loginScreen(message=''){
  sessionUser=null;csrf='';orders=[];workers=[];worker={};editing=null;batch=[];
  $('#modal').close();$('#modal').innerHTML='';$('aside').hidden=true;$('main').hidden=true;
  $('#login')?.remove();const box=document.createElement('section');box.id='login';box.style='max-width:440px;margin:12vh auto;padding:30px;background:#fff';
  box.innerHTML=`<img class="login-logo" src="logo.png" alt="卓亚 Logo" width="129" height="126"><div class="eyebrow">ZY LABOUR SYSTEM · 团队工作台</div><h1>卓亚港澳劳务</h1><p>登录后与团队共同管理劳务单及劳工资料。</p><form id="loginForm"><label>账号<input name="username" type="${cloudMode?'email':'text'}" placeholder="${cloudMode?'团队账号邮箱':'账号'}" autocomplete="username" required></label><label style="margin-top:18px">密码<input name="password" type="password" autocomplete="current-password" required></label><p id="loginError" role="alert" style="color:#ac4343">${esc(message)}</p><button class="primary" type="submit">登录工作台</button></form><p>账号由管理员开通。请勿在公共设备保存密码。</p>`;
  document.body.append(box);$('#loginForm').onsubmit=async event=>{event.preventDefault();const button=box.querySelector('button');button.disabled=true;try{const form=new FormData(event.target);const data=await api('/api/login',{method:'POST',body:{username:form.get('username'),password:form.get('password')}});await enterWorkspace(data)}catch(e){$('#loginError').textContent=e.message}finally{button.disabled=false}};
}
async function enterWorkspace(data){
  sessionUser=data.user;csrf=data.csrf;
  let result=await api('/api/orders');
  const repaired=ZYOrderParser.repairLegacyOrders(result.orders);
  if(JSON.stringify(repaired)!==JSON.stringify(result.orders)){
    try{const saved=await api('/api/orders',{method:'PUT',body:{orders:repaired,revision:result.revision}});result={orders:repaired,revision:saved.revision}}
    catch(e){result=await api('/api/orders');toast('旧公司单修正尚未完成：'+e.message)}
  }
  orders=result.orders;revision=result.revision;
  $('#login')?.remove();$('aside').hidden=false;$('main').hidden=false;
  $('aside footer').innerHTML=`<span><span data-user-content>${esc(sessionUser.username)}</span> · ${sessionUser.role==='admin'?'管理员':'员工'}</span><div class="actions"><button onclick="accountDialog()">账号设置</button><button onclick="logout()">退出</button></div><div id="syncStatus" style="margin-top:10px">团队资料已连接</div>`;
  worker={};editing=null;go('dashboard');lastSync=Date.now();
}
async function logout(){try{await api('/api/logout',{method:'POST',body:{}});loginScreen('已退出登录')}catch(e){toast(e.message)}}
async function accountDialog(){
  $('#modal').innerHTML=`<h2>账号设置</h2><p>${esc(sessionUser.username)} · ${sessionUser.role==='admin'?'管理员':'员工'}</p><form id="passwordForm"><h3>修改密码</h3><label>当前密码<input name="current" type="password" autocomplete="current-password" required></label><label>新密码（至少12个字符）<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label><label>确认新密码<input name="confirm" type="password" autocomplete="new-password" required></label><button style="margin-top:12px" class="primary">修改并重新登录</button></form>${sessionUser.role==='admin'?'<hr><h3>团队账号</h3><div id="teamUsers">读取中…</div><form id="userForm"><h3>开通新账号</h3><label>账号<input name="username" required autocomplete="off"></label><label>初始密码（至少12个字符）<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label><label>角色<select name="role"><option value="staff">员工（管理共享订单和劳工资料）</option><option value="admin">管理员（另可管理账号）</option></select></label><button class="primary" style="margin-top:12px">开通账号</button></form><hr><h3>备份与迁移</h3><p id="maintenanceStatus">读取维护状态…</p><button onclick="setMaintenance(true)">暂停业务写入</button> <button onclick="setMaintenance(false)">恢复业务写入</button><p class="muted">迁移前暂停写入，再导出最终备份。暂停后仍可查看资料。</p><button onclick="exportPortable()">导出完整业务资料</button> <button onclick="choosePortable()">恢复到空数据库</button><input type="file" id="portableFile" accept="application/json,.json" hidden onchange="importPortable(this.files[0]);this.value=null"> <p class="muted">包含订单、劳工、照片及附件；不包含账号密码。JSON可迁移至其他数据库。</p><button onclick="migrateLocal()">导入本浏览器旧资料</button><p class="muted">手动确认后才上传；仅适用于同一浏览器和原网站来源内的旧资料，不覆盖现有记录。</p>':''}<div class="actions"><button onclick="$('#modal').close()">关闭</button></div>`;
  $('#modal').showModal();$('#passwordForm').onsubmit=async e=>{e.preventDefault();const form=new FormData(e.target);if(form.get('password')!==form.get('confirm'))return toast('两次输入的新密码不一致');try{await api('/api/password',{method:'POST',body:{current:form.get('current'),password:form.get('password')}});loginScreen('密码已修改，请使用新密码登录')}catch(err){toast(err.message)}};
  if(sessionUser.role==='admin'){
    const account=$('#userForm input[name=username]');account.type=cloudMode?'email':'text';if(!cloudMode)account.pattern='[a-zA-Z0-9_.-]{3,64}';
    $('#userForm').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{await api('/api/users',{method:'POST',body:Object.fromEntries(new FormData(e.target))});e.target.reset();await renderUsers();toast('账号已开通，请通过安全方式告知同事初始密码')}catch(err){toast(err.message)}finally{button.disabled=false}};
    try{await renderUsers();const state=await api('/api/maintenance');$('#maintenanceStatus').textContent=state.readOnly?'当前：已暂停写入（只读）':'当前：正常读写'}catch(e){toast(e.message)}
  }
}
async function renderUsers(){const {users}=await api('/api/users');$('#teamUsers').innerHTML=users.map(u=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0"><span><span data-user-content>${esc(u.username)}</span> · ${u.role==='admin'?'管理员':'员工'} · ${u.active?'使用中':'已停用'}</span>${u.active&&u.id!==sessionUser.id?`<button class="danger" onclick="disableUser('${esc(u.id)}')">停用</button>`:''}</div>`).join('')}
async function disableUser(id){if(!confirm('停用此账号并立即撤销其登录？'))return;try{await api('/api/users/disable',{method:'POST',body:{id}});await renderUsers()}catch(e){toast(e.message)}}
async function performSync(){
 if(!sessionUser||saving||document.hidden||$('#modal').open||!['dashboard','orders','workerRecords'].includes(view))return;
 const syncView=view,syncUser=sessionUser.id;
 try{const data=await api('/api/orders');if(saving||view!==syncView||sessionUser?.id!==syncUser||$('#modal').open)return;const changed=data.revision!==revision;orders=data.orders;revision=data.revision;if(changed&&['dashboard','orders'].includes(view))render();if(view==='workerRecords')await recordsView();lastSync=Date.now();const maintenance=await api('/api/maintenance');if($('#syncStatus'))$('#syncStatus').textContent=maintenance.readOnly?'维护中 · 只读，已暂停写入':'团队资料已同步'}catch(e){if($('#syncStatus'))$('#syncStatus').textContent='连接中断，正在重试；请勿关闭未保存表单'}
}
async function migrateLocal(){
 let localOrders=[];try{localOrders=JSON.parse(localStorage.getItem(key)||'[]')}catch{return toast('旧订单格式异常，未上传')}
 // Open an existing IndexedDB only; do not create an empty legacy database.
 let localWorkers=[];
 try{const databases=await indexedDB.databases();if(databases.some(d=>d.name==='zy-worker-register-v1')){localWorkers=await new Promise((resolve,reject)=>{const r=indexedDB.open('zy-worker-register-v1');r.onsuccess=()=>{const db=r.result;if(!db.objectStoreNames.contains('workers')){db.close();return resolve([])}const q=db.transaction('workers').objectStore('workers').getAll();q.onsuccess=()=>{db.close();resolve(q.result)};q.onerror=()=>{db.close();reject(q.error)}};r.onerror=()=>reject(r.error)})}}catch{return toast('旧劳工资料无法读取，未上传')}
 const additions=localOrders.filter(o=>!String(o.id).startsWith('sample-'));
 if(!additions.length&&!localWorkers.length)return toast('本浏览器没有可导入的旧资料（示例订单不导入）');
 if(!confirm(`将 ${additions.length} 份旧订单及 ${localWorkers.length} 份劳工资料上传至团队服务器，所有团队账号可查看。原浏览器资料仍保留。确认继续？`))return;
 let orderCount=0,workerCount=0;
 try{const current=await api('/api/orders');const pending=additions.filter(o=>!current.orders.some(x=>x.id===o.id||x.code===o.code));if(pending.length){const r=await api('/api/orders',{method:'PUT',body:{orders:pending.concat(current.orders),revision:current.revision}});revision=r.revision;orders=pending.concat(current.orders);orderCount=pending.length}
 await loadWorkers();for(const old of localWorkers){if(workers.some(w=>w.id===old.id))continue;const copy={...old};delete copy._version;await dbWrite('put',copy);workerCount++}
 toast(`已导入 ${orderCount} 份订单、${workerCount} 份劳工资料；重复记录已跳过`)
 }catch(e){toast(`已导入 ${orderCount} 份订单、${workerCount} 份资料。${e.message}。可重试，已有ID不重复导入`)}
}
async function setMaintenance(readOnly){if(!confirm(readOnly?'暂停所有业务资料写入，以便备份迁移？':'恢复业务写入？'))return;try{const data=await api('/api/maintenance',{method:'POST',body:{readOnly}});$('#maintenanceStatus').textContent=data.readOnly?'当前：已暂停写入（只读）':'当前：正常读写';toast('维护状态已更新')}catch(e){toast(e.message)}}
async function exportPortable(){try{const data=await api('/api/export');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`zy-full-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('完整备份已生成，请保存到私人位置')}catch(e){toast(e.message)}}
function choosePortable(){$('#portableFile').click()}
async function importPortable(file){
 if(!file)return;
 if(saving)return toast('请等当前保存完成再导入');
 saving=true;
 try{if(pendingSync)await pendingSync;
  if(file.size>32*1024*1024)throw new Error('文件超过32MB，请使用迁移工具分配更合适的传输方式');
  const payload=JSON.parse(await file.text());
  if(payload.format!=='zy-labour-portable'||payload.version!==1||!Array.isArray(payload.orders)||!Array.isArray(payload.workers))throw new Error('备份格式或版本不支持');
  if(!confirm(`将恢复 ${payload.orders.length} 份订单和 ${payload.workers.length} 份劳工资料（含照片及附件）。目标必须为空库，账号不会导入。确认继续？`))return;
  const current=await api('/api/orders');
  const result=await api('/api/import',{method:'POST',body:{payload,revision:current.revision}});
  const state=await api('/api/orders');orders=state.orders;revision=state.revision;
  toast(`恢复完成：${result.orders} 份订单、${result.workers} 份劳工资料`);$('#modal').close();go('orders');
 }catch(e){toast(e.message||'备份无法读取，未恢复')}finally{saving=false}
}
function syncShared(){if(pendingSync)return pendingSync;pendingSync=performSync().finally(()=>{pendingSync=null});return pendingSync}
// Serialize changes and prevent polling while a write is in flight.
for(const name of ['saveOrder','saveBatch','savePrice','deleteOrder','saveWorker','deleteWorker','migrateLocal']){
 const original=window[name];window[name]=async function(...args){if(saving)return;saving=true;const buttons=[...document.querySelectorAll('button')].filter(b=>!b.disabled);buttons.forEach(b=>b.disabled=true);try{if(pendingSync)await pendingSync;return await original(...args)}catch(e){toast(e.message||'操作失败，请稍后重试')}finally{saving=false;buttons.forEach(b=>b.disabled=false)}};
}
async function startShared(){
 if(cloudMode){try{cloud=new window.ZYSupabase(window.ZY_CONFIG)}catch(e){document.body.innerHTML='<section style="max-width:560px;margin:15vh auto;padding:24px"><h1>卓亚港澳劳务系统</h1><p>免费云端尚未连接。请先完成Supabase项目配置，再发布网页。</p><p>配置只使用项目网址和公开publishable/anon key，不要填写管理密钥或数据库密码。</p></section>';return}}

 // Remove old service-worker registrations/caches that could serve the local-only app.
 if('serviceWorker' in navigator){try{const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.filter(r=>r.scope===new URL('./',location.href).href).map(r=>r.unregister()));const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('zy-order-desk')).map(k=>caches.delete(k)))}catch{}}
 try{const data=await api('/api/session');await enterWorkspace(data)}catch{loginScreen()}
}
setInterval(syncShared,5000);window.addEventListener('focus',syncShared);startShared();
