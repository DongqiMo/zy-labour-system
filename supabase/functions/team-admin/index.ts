// Only this server-side Edge Function can use Supabase's injected service role.
// Browser requests must supply a real Auth bearer token and pass the DB admin check.
const base=Deno.env.get('SUPABASE_URL')!;
const adminKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey=Deno.env.get('SUPABASE_ANON_KEY')!;
const allowed=(Deno.env.get('ZY_ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(Boolean);
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 const cors={'Access-Control-Allow-Origin':allowed.includes(origin)?origin:'null','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(!allowed.includes(origin))return reply(403,{error:'网页来源未获授权'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply(405,{error:'方法不允许'});
 if((Number(req.headers.get('content-length'))||0)>4096)return reply(413,{error:'请求过大'});
 const bearer=req.headers.get('authorization')||'';
 if(!/^Bearer \S+$/i.test(bearer))return reply(401,{error:'请先登录'});
 try{
  const headers={apikey:anonKey,Authorization:bearer,'Content-Type':'application/json'};
  // This function checks auth.uid(), membership, active flag and admin role.
  const check=await fetch(base+'/rest/v1/rpc/zy_users_get',{method:'POST',headers,body:'{}'});
  if(!check.ok)return reply(403,{error:'需要有效的团队管理员账号'});
  const bodyText=await req.text();if(bodyText.length>4096)return reply(413,{error:'请求过大'});
  let data;try{data=JSON.parse(bodyText)}catch{return reply(400,{error:'JSON格式错误'})}
  const {action,email,password,role}=data;
  if(action!=='create'||typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=='string'||password.length<12||password.length>256||!['admin','staff'].includes(role))return reply(400,{error:'请输入有效邮箱、至少12字符密码及角色'});
  const privileged={apikey:adminKey,Authorization:'Bearer '+adminKey,'Content-Type':'application/json'};
  const created=await fetch(base+'/auth/v1/admin/users',{method:'POST',headers:privileged,body:JSON.stringify({email,password,email_confirm:true})});
  if(!created.ok)return reply(409,{error:'账号创建失败；请检查邮箱是否已有账号，稍后重试'});
  const user=await created.json();
  const member=await fetch(base+'/rest/v1/rpc/zy_member_add',{method:'POST',headers,body:JSON.stringify({p_id:user.id,p_username:email,p_role:role})});
  if(!member.ok){
   const rollback=await fetch(base+'/auth/v1/admin/users/'+encodeURIComponent(user.id),{method:'DELETE',headers:privileged});
   return reply(409,{error:rollback.ok?'团队授权未完成，新账号已撤回，请重新登录后重试':'团队授权未完成，请管理员在Auth面板核对并清理未授权账号'});
  }
  return reply(201,{ok:true});
 }catch{return reply(503,{error:'账号服务暂不可用，请稍后重试'})}
});
