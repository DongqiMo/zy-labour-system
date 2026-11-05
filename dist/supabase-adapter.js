/* Supabase transport behind the same application API; no provider code in forms. */
window.ZYSupabase=class {
 constructor(config){
  const url=new URL(config.supabaseUrl);if(url.protocol!=='https:')throw new Error('Supabase地址必须使用HTTPS');
  this.url=url.href.replace(/\/$/,'');this.key=config.supabaseAnonKey;
  if(!this.key||this.key.startsWith('sb_secret_'))throw new Error('请配置公开publishable/anon key，不能使用管理密钥');
  if(this.key.split('.').length===3){try{const raw=this.key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');if(JSON.parse(atob(raw)).role!=='anon')throw new Error('管理密钥不能放在网页配置中')}catch(e){throw new Error('仅可使用Supabase公开anon key或publishable key')}}
  this.storage='zy-supabase-session:'+url.hostname;this.session=null;this.refreshing=null;
  try{this.session=JSON.parse(sessionStorage.getItem(this.storage)||'null')}catch{}
 }
 save(data){this.session=data?.access_token?{access_token:data.access_token,refresh_token:data.refresh_token,expires_at:data.expires_at||Math.floor(Date.now()/1000)+(data.expires_in||3600),user:data.user}:null;if(this.session)sessionStorage.setItem(this.storage,JSON.stringify(this.session));else sessionStorage.removeItem(this.storage)}
 async request(path,{method='GET',body,token}={}){
  const response=await fetch(this.url+path,{method,cache:'no-store',headers:{apikey:this.key,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const text=await response.text();let data;try{data=text?JSON.parse(text):{}}catch{throw new Error('云端响应格式异常，请稍后重试')}
  if(!response.ok){const error=new Error(data.message||data.msg||data.error_description||data.error||'云端操作失败');error.status=response.status;error.code=data.code;throw error}return data;
 }
 async token(){
  if(!this.session){const e=new Error('请先登录');e.status=401;throw e}
  if(this.session.expires_at*1000>Date.now()+60000)return this.session.access_token;
  if(!this.refreshing)this.refreshing=(async()=>{try{const data=await this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:this.session.refresh_token}});this.save(data);return data.access_token}catch(e){if([400,401,403].includes(e.status)){this.save(null);e.status=401}throw e}finally{this.refreshing=null}})();
  return this.refreshing;
 }
 async rpc(name,body={}){return this.request('/rest/v1/rpc/'+name,{method:'POST',body,token:await this.token()})}
 async call(path,{method='GET',body={}}={}){
  if(path==='/api/login'){
   const data=await this.request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:body.username,password:body.password}});this.save(data);
   try{return await this.rpc('zy_session')}catch(e){try{await this.request('/auth/v1/logout',{method:'POST',token:data.access_token})}catch{}this.save(null);throw e}
  }
  if(path==='/api/logout'){await this.request('/auth/v1/logout',{method:'POST',token:await this.token()});this.save(null);return {ok:true}}
  if(path==='/api/recognition-status'||path==='/api/recognize-order')return this.request('/functions/v1/recognize-order',{method:'POST',token:await this.token(),body:path==='/api/recognition-status'?{action:'status'}:{action:'recognize',source:body.source}});
  if(path==='/api/session')return this.rpc('zy_session');
  if(path==='/api/orders')return method==='GET'?this.rpc('zy_orders_get'):this.rpc('zy_orders_save',{p_orders:body.orders,p_revision:body.revision});
  if(path==='/api/workers'){
   if(method==='GET')return this.rpc('zy_workers_get');
   if(method==='DELETE')return this.rpc('zy_worker_delete',{p_id:body.id,p_version:body.version});
   return this.rpc('zy_worker_save',{p_worker:body.worker});
  }
  if(path==='/api/users'){
   if(method==='GET')return this.rpc('zy_users_get');
   return this.request('/functions/v1/team-admin',{method:'POST',token:await this.token(),body:{action:'create',email:body.username,password:body.password,role:body.role}});
  }
  if(path==='/api/users/disable')return this.rpc('zy_member_disable',{p_id:body.id});
  if(path==='/api/maintenance')return method==='GET'?this.rpc('zy_maintenance_get'):this.rpc('zy_maintenance_set',{p_read_only:body.readOnly});
  if(path==='/api/export')return this.rpc('zy_export');
  if(path==='/api/import')return this.rpc('zy_import',{p_payload:body.payload,p_revision:body.revision});
  if(path==='/api/password'){
   if(typeof body.password!=='string'||body.password.length<12)throw new Error('新密码至少12个字符');
   // Reauthenticate rather than trusting a UI-only current-password check.
   const current=await this.request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:this.session.user.email,password:body.current}});
   this.save(current);
   await this.request('/auth/v1/user',{method:'PUT',token:await this.token(),body:{password:body.password}});
   await this.request('/auth/v1/logout?scope=global',{method:'POST',token:await this.token()});this.save(null);return {ok:true};
  }
  throw new Error('未支持的操作');
 }
};
