-- Business data is portable JSON, stored in PostgreSQL with restricted RPC access.
-- Supabase Auth owns credentials. No service_role key belongs in the frontend.
begin;
create schema if not exists zy_private;
revoke all on schema zy_private from public, anon, authenticated;

create table if not exists zy_private.members (
 id uuid primary key references auth.users(id), username text not null,
 role text not null check(role in ('admin','staff')), active boolean not null default true
);
create table if not exists zy_private.order_state (
 id integer primary key check(id=1), revision bigint not null default 0, orders jsonb not null default '[]'::jsonb
);
insert into zy_private.order_state(id) values(1) on conflict do nothing;
create table if not exists zy_private.settings(id integer primary key check(id=1),read_only boolean not null default false);
insert into zy_private.settings(id) values(1) on conflict do nothing;
create table if not exists zy_private.workers (
 id text primary key, version bigint not null, data jsonb not null
);
alter table zy_private.settings enable row level security;
alter table zy_private.members enable row level security;
alter table zy_private.order_state enable row level security;
alter table zy_private.workers enable row level security;
revoke all on all tables in schema zy_private from public, anon, authenticated;

create or replace function zy_private.require_member(p_admin boolean default false)
returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from zy_private.members where id=auth.uid() and active and (not p_admin or role='admin')) then
  raise exception using errcode='42501',message='账号未获团队授权、已停用或权限不足';
 end if;
end $$;

create or replace function zy_private.require_writable()
returns void language plpgsql security definer set search_path='' as $$
declare paused boolean;
begin
 perform zy_private.require_member();
 select read_only into paused from zy_private.settings where id=1 for share;
 if paused then raise exception using errcode='55000',message='系统正在维护或迁移，已暂停写入；当前输入尚未保存'; end if;
end $$;
create or replace function public.zy_maintenance_get()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform zy_private.require_member();return (select jsonb_build_object('readOnly',read_only) from zy_private.settings where id=1);
end $$;
create or replace function public.zy_maintenance_set(p_read_only boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform zy_private.require_member(true);
 if p_read_only is null then raise exception '维护状态无效'; end if;
 update zy_private.settings set read_only=p_read_only where id=1;
 return jsonb_build_object('readOnly',p_read_only);
end $$;

create or replace function zy_private.validate_orders(p_orders jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare o jsonb; field text; v jsonb;
begin
 if jsonb_typeof(p_orders) is distinct from 'array' then raise exception '订单格式无效'; end if;
 if jsonb_array_length(p_orders)>10000 then raise exception '订单超过10000份'; end if;
 for o in select value from jsonb_array_elements(p_orders) loop
  if jsonb_typeof(o) is distinct from 'object' then raise exception '订单格式无效'; end if;
  if jsonb_typeof(o->'id') is distinct from 'string' or (o->>'id') !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception '记录ID无效'; end if;
  foreach field in array array['code','title','raw','createdAt'] loop
   if jsonb_typeof(o->field) is distinct from 'string' or btrim(o->>field)='' then raise exception '公司单号、职位、原单及创建时间必填'; end if;
  end loop;
  if (o->>'status') is null or (o->>'status') not in ('draft','ready') then raise exception '状态无效'; end if;
  for field,v in select * from jsonb_each(o) loop
   if field in ('__proto__','constructor','prototype') or jsonb_typeof(v) not in ('string','number','boolean','null') then raise exception '订单字段无效'; end if;
  end loop;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_orders) j group by j->>'id' having count(*)>1)
  or exists(select 1 from jsonb_array_elements(p_orders) j group by j->>'code' having count(*)>1) then
  raise exception using errcode='23505',message='记录ID或公司单号重复';
 end if;
end $$;

create or replace function zy_private.validate_worker(w jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare field text; v jsonb; h jsonb;
begin
 if jsonb_typeof(w) is distinct from 'object' then raise exception '劳工资料格式无效'; end if;
 if jsonb_typeof(w->'id') is distinct from 'string' or (w->>'id') !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception '资料ID无效'; end if;
 foreach field in array array['name','createdAt','updatedAt'] loop
  if jsonb_typeof(w->field) is distinct from 'string' or btrim(w->>field)='' then raise exception '姓名及日期必填'; end if;
 end loop;
 for field,v in select * from jsonb_each(w) loop
  if field in ('__proto__','constructor','prototype') then raise exception '资料字段无效'; end if;
  if field in ('educationHistory','workHistory') then
   if jsonb_typeof(v) is distinct from 'array' then raise exception '经历格式无效'; end if;
   if jsonb_array_length(v)>(case when field='educationHistory' then 2 else 4 end) then raise exception '经历条数超限'; end if;
   for h in select value from jsonb_array_elements(v) loop
    if jsonb_typeof(h) is distinct from 'object' then raise exception '经历格式无效'; end if;
    if exists(select 1 from jsonb_each(h) x where jsonb_typeof(x.value)<>'string' or x.key in ('__proto__','constructor','prototype')) then raise exception '经历字段无效'; end if;
   end loop;
  elsif field='_version' then
   if jsonb_typeof(v) is distinct from 'number' or (v#>>'{}') !~ '^[0-9]+$' then raise exception '资料版本无效'; end if;
  elsif jsonb_typeof(v) not in ('string','number','boolean','null') then raise exception '资料字段无效';
  end if;
 end loop;
 if coalesce(w->>'photo','')<>'' and (jsonb_typeof(w->'photo')<>'string' or (w->>'photo') !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$') then raise exception '照片必须为JPEG资料'; end if;
end $$;

create or replace function public.zy_session()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m zy_private.members;
begin
 perform zy_private.require_member();select * into m from zy_private.members where id=auth.uid();
 return jsonb_build_object('user',jsonb_build_object('id',m.id,'username',m.username,'role',m.role),'csrf','');
end $$;
create or replace function public.zy_orders_get()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform zy_private.require_member();
 return (select jsonb_build_object('orders',orders,'revision',revision) from zy_private.order_state where id=1);
end $$;
create or replace function public.zy_orders_save(p_orders jsonb,p_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old zy_private.order_state; next_revision bigint;
begin
 perform zy_private.require_writable();perform zy_private.validate_orders(p_orders);
 select * into old from zy_private.order_state where id=1 for update;
 if p_revision is distinct from old.revision then raise exception using errcode='40001',message='其他人已修改订单，请先刷新列表并重新核对，当前修改尚未保存'; end if;
 if exists(select 1 from jsonb_array_elements(p_orders) n join jsonb_array_elements(old.orders) o on n->>'id'=o->>'id'
  where n->'raw' is distinct from o->'raw' or n->'createdAt' is distinct from o->'createdAt') then raise exception '编辑公司单不能更改原单或创建时间'; end if;
 update zy_private.order_state set orders=p_orders,revision=revision+1 where id=1 returning revision into next_revision;
 return jsonb_build_object('revision',next_revision);
end $$;
create or replace function public.zy_workers_get()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform zy_private.require_member();
 return jsonb_build_object('workers',(select coalesce(jsonb_agg(data||jsonb_build_object('_version',version) order by data->>'updatedAt' desc),'[]'::jsonb) from zy_private.workers));
end $$;
create or replace function public.zy_worker_save(p_worker jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old zy_private.workers; wanted bigint; next_version bigint; clean jsonb;
begin
 perform zy_private.require_writable();perform zy_private.validate_worker(p_worker);
 -- Also serialize inserts of a previously absent ID.
 perform pg_advisory_xact_lock(hashtextextended(p_worker->>'id',0));
 select * into old from zy_private.workers where id=p_worker->>'id' for update;
 wanted=coalesce((p_worker->>'_version')::bigint,0);
 if wanted is distinct from coalesce(old.version,0) then raise exception using errcode='40001',message='其他人已修改此资料，请重新打开核对，当前修改尚未保存'; end if;
 clean=p_worker-'_version';
 if old.id is not null then clean=jsonb_set(clean,'{createdAt}',old.data->'createdAt'); end if;
 next_version=wanted+1;
 insert into zy_private.workers values(p_worker->>'id',next_version,clean)
 on conflict(id) do update set version=excluded.version,data=excluded.data;
 return jsonb_build_object('version',next_version);
end $$;
create or replace function public.zy_worker_delete(p_id text,p_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old_version bigint;
begin
 perform zy_private.require_writable();perform pg_advisory_xact_lock(hashtextextended(p_id,0));
 select version into old_version from zy_private.workers where id=p_id for update;
 if old_version is null or old_version is distinct from p_version then raise exception using errcode='40001',message='资料已被修改或删除，请刷新后再试'; end if;
 delete from zy_private.workers where id=p_id;return jsonb_build_object('ok',true);
end $$;
create or replace function public.zy_users_get()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform zy_private.require_member(true);
 return jsonb_build_object('users',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'username',username,'role',role,'active',active) order by username),'[]'::jsonb) from zy_private.members));
end $$;
create or replace function public.zy_member_add(p_id uuid,p_username text,p_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform zy_private.require_member(true);
 if p_role not in ('admin','staff') or p_role is null or p_username is null or length(p_username)>254 then raise exception '账号或角色无效'; end if;
 insert into zy_private.members values(p_id,p_username,p_role,true);
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.zy_member_disable(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform zy_private.require_member(true);
 if p_id=auth.uid() then raise exception '不能停用自己的账号'; end if;
 update zy_private.members set active=false where id=p_id;
 return jsonb_build_object('ok',true);
end $$;

-- One transaction snapshot; no provider passwords/tokens are exported.
create or replace function public.zy_export()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform zy_private.require_member(true);
 return (select jsonb_build_object('format','zy-labour-portable','version',1,'exportedAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'orders',s.orders,'workers',(select coalesce(jsonb_agg(data order by id),'[]'::jsonb) from zy_private.workers)) from zy_private.order_state s where id=1);
end $$;
create or replace function public.zy_import(p_payload jsonb,p_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old zy_private.order_state; w jsonb; seen text[]='{}';
begin
 perform zy_private.require_member(true);perform zy_private.require_writable();
 if jsonb_typeof(p_payload) is distinct from 'object' or p_payload->>'format' is distinct from 'zy-labour-portable' or p_payload->'version' is distinct from '1'::jsonb then raise exception '不支持的备份格式或版本'; end if;
 perform zy_private.validate_orders(p_payload->'orders');
 if jsonb_typeof(p_payload->'workers') is distinct from 'array' then raise exception '劳工备份格式无效'; end if;
 for w in select value from jsonb_array_elements(p_payload->'workers') loop
  perform zy_private.validate_worker(w);
  if (w->>'id')=any(seen) then raise exception '劳工ID重复'; end if;
  seen=array_append(seen,w->>'id');
 end loop;
 -- Maintenance operation: exclusive locks serialize import with all business writes.
 lock table zy_private.workers in exclusive mode;
 select * into old from zy_private.order_state where id=1 for update;
 if old.revision is distinct from p_revision then raise exception using errcode='40001',message='目标资料已变化，请刷新后重新导入'; end if;
 if jsonb_array_length(old.orders)>0 or exists(select 1 from zy_private.workers) then raise exception '只允许恢复到空数据库，现有资料不会覆盖'; end if;
 update zy_private.order_state set orders=p_payload->'orders',revision=revision+1 where id=1;
 insert into zy_private.workers(id,version,data) select value->>'id',1,value-'_version' from jsonb_array_elements(p_payload->'workers');
 return jsonb_build_object('orders',jsonb_array_length(p_payload->'orders'),'workers',cardinality(seen),'revision',old.revision+1);
end $$;

revoke all on all functions in schema zy_private from public,anon,authenticated;
-- Explicit grant list: never expose a generic SQL executor or automatic admin bootstrap.
revoke all on function public.zy_maintenance_get(),public.zy_maintenance_set(boolean),public.zy_session(),public.zy_orders_get(),public.zy_orders_save(jsonb,bigint),public.zy_workers_get(),public.zy_worker_save(jsonb),public.zy_worker_delete(text,bigint),public.zy_users_get(),public.zy_member_add(uuid,text,text),public.zy_member_disable(uuid),public.zy_export(),public.zy_import(jsonb,bigint) from public,anon;
grant execute on function public.zy_maintenance_get(),public.zy_maintenance_set(boolean),public.zy_session(),public.zy_orders_get(),public.zy_orders_save(jsonb,bigint),public.zy_workers_get(),public.zy_worker_save(jsonb),public.zy_worker_delete(text,bigint),public.zy_users_get(),public.zy_member_add(uuid,text,text),public.zy_member_disable(uuid),public.zy_export(),public.zy_import(jsonb,bigint) to authenticated;
commit;
