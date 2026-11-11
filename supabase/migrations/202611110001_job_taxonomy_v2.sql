-- Shared v2 job taxonomy, classification cache and independent team quota.
begin;
create table public.zy_job_subcategories(
 id text primary key default gen_random_uuid()::text, major text not null,
 name text not null check(length(btrim(name)) between 1 and 80),aliases text[] not null default '{}',
 status text not null default 'new' check(status in ('new','active')),
 merged_into text references public.zy_job_subcategories(id),created_by text not null default 'ai',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(merged_into is null or merged_into<>id),
 check(major in ('maintenance','vehicle_service','beauty','aviation_transport','equipment','driving','food_service','kitchen','hotel_cleaning','care','logistics','manufacturing','construction','retail','office','security_property','agriculture','other'))
);
create unique index zy_job_subcategories_name_unique on public.zy_job_subcategories(major,lower(btrim(name)));
create table public.zy_job_classification_cache(
 text_hash text primary key check(text_hash ~ '^[a-f0-9]{64}$'), kind text not null check(kind in ('order','history','intent','certificate')),
 major text not null check(major in ('maintenance','vehicle_service','beauty','aviation_transport','equipment','driving','food_service','kitchen','hotel_cleaning','care','logistics','manufacturing','construction','retail','office','security_property','agriculture','other')),subcategory_id text references public.zy_job_subcategories(id),
 evidence text not null check(length(evidence) between 1 and 2000),by text not null check(by in ('ai','rules','user')),created_at timestamptz not null default now()
);
create table zy_private.job_classification_usage(day date primary key,calls integer not null default 0);
create table zy_private.job_classification_leases(text_hash text primary key,ticket uuid not null,expires_at timestamptz not null);
create table zy_private.job_classification_settings(id integer primary key check(id=1),daily_limit integer not null default 50 check(daily_limit between 1 and 10000));
insert into zy_private.job_classification_settings(id) values(1);
alter table public.zy_job_subcategories enable row level security;
alter table public.zy_job_classification_cache enable row level security;
alter table zy_private.job_classification_leases enable row level security;
alter table zy_private.job_classification_usage enable row level security;
alter table zy_private.job_classification_settings enable row level security;
revoke all on public.zy_job_subcategories,public.zy_job_classification_cache from public,anon,authenticated;
revoke all on zy_private.job_classification_leases,zy_private.job_classification_usage,zy_private.job_classification_settings from public,anon,authenticated;
grant select on public.zy_job_subcategories,public.zy_job_classification_cache to authenticated;
create or replace function public.zy_job_can_read() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from zy_private.members where id=auth.uid() and active)
$$;
revoke all on function public.zy_job_can_read() from public,anon;grant execute on function public.zy_job_can_read() to authenticated;
create policy job_dictionary_read on public.zy_job_subcategories for select to authenticated using ((select public.zy_job_can_read()));
create policy job_cache_read on public.zy_job_classification_cache for select to authenticated using ((select public.zy_job_can_read()));
create or replace function public.zy_job_taxonomy() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare calls integer; cap integer;
begin
 perform zy_private.require_member();select daily_limit into cap from zy_private.job_classification_settings where id=1;
 select u.calls into calls from zy_private.job_classification_usage u where day=(now() at time zone 'Asia/Shanghai')::date;
 return jsonb_build_object('version',2,'subcategories',(select coalesce(jsonb_agg(s order by s.major,s.name),'[]') from public.zy_job_subcategories s),
 'cache',(select coalesce(jsonb_agg(c),'[]') from public.zy_job_classification_cache c),'remaining',greatest(0,cap-coalesce(calls,0)));
end $$;
create or replace function public.zy_job_reserve(p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d date:=(now() at time zone 'Asia/Shanghai')::date; total integer; cap integer;
begin
 if not exists(select 1 from zy_private.members where id=p_actor and active) then raise exception using errcode='42501',message='账号未获授权'; end if;
 if (select read_only from zy_private.settings where id=1) then raise exception using errcode='55000',message='系统暂停写入'; end if;
 select daily_limit into cap from zy_private.job_classification_settings where id=1;
 insert into zy_private.job_classification_usage(day) values(d) on conflict do nothing;
 select calls into total from zy_private.job_classification_usage where day=d for update;
 if total>=cap then raise exception using errcode='54000',message='归类额度已用完'; end if;
 update zy_private.job_classification_usage set calls=calls+1 where day=d;
 return jsonb_build_object('remaining',cap-total-1);
end $$;
-- Bounded per-hash leases prevent concurrent cache misses from duplicate model calls.
create or replace function public.zy_job_claim(p_actor uuid,p_hashes text[],p_ticket uuid,p_force boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare h text; claimed_hash text; claimed jsonb:='[]'; busy jsonb:='[]'; cached jsonb:='[]'; cached_row public.zy_job_classification_cache;
begin
 if not exists(select 1 from zy_private.members where id=p_actor and active) then raise exception using errcode='42501',message='账号未获授权'; end if;
 if (select read_only from zy_private.settings where id=1) then raise exception using errcode='55000',message='系统暂停写入'; end if;
 if p_ticket is null or p_hashes is null or cardinality(p_hashes)>20 then raise exception '归类批次无效'; end if;
 delete from zy_private.job_classification_leases where expires_at<now();
 for h in select distinct x from unnest(p_hashes) x order by x loop
  if h is null or h !~ '^[a-f0-9]{64}$' then raise exception '归类哈希无效';end if;
  perform pg_advisory_xact_lock(hashtextextended('zy-job-'||h,0));
  select * into cached_row from public.zy_job_classification_cache where text_hash=h;
  if cached_row.text_hash is not null and (not p_force or (to_jsonb(cached_row)->>'by')='user') then cached=cached||jsonb_build_array(to_jsonb(cached_row));continue;end if;
  claimed_hash=null;
  insert into zy_private.job_classification_leases(text_hash,ticket,expires_at) values(h,p_ticket,now()+interval '90 seconds') on conflict do nothing returning text_hash into claimed_hash;
  if claimed_hash is null then busy=busy||jsonb_build_array(h);else claimed=claimed||jsonb_build_array(h);end if;
 end loop;
 return jsonb_build_object('claimed',claimed,'busy',busy,'cached',cached);
end $$;
create or replace function public.zy_job_release(p_ticket uuid) returns void language sql security definer set search_path='' as $$
 delete from zy_private.job_classification_leases where ticket=p_ticket
$$;
-- Only Edge's service role can create AI categories/cache; the caller identity is checked again.
create or replace function public.zy_job_classification_commit(p_actor uuid,p_items jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb; sid text; result jsonb:='[]'; n text;
begin
 if not exists(select 1 from zy_private.members where id=p_actor and active) then raise exception using errcode='42501',message='账号未获授权'; end if;
 if (select read_only from zy_private.settings where id=1) then raise exception using errcode='55000',message='系统暂停写入'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>20 then raise exception '归类批次无效'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if item->>'major' not in ('maintenance','vehicle_service','beauty','aviation_transport','equipment','driving','food_service','kitchen','hotel_cleaning','care','logistics','manufacturing','construction','retail','office','security_property','agriculture','other') or item->>'kind' not in ('order','history','intent','certificate') or (item->>'text_hash') !~ '^[a-f0-9]{64}$' or length(coalesce(item->>'evidence','')) not between 1 and 2000 then raise exception '归类字段无效'; end if;
  sid=nullif(item->>'subcategory_id','');n=btrim(coalesce(item->>'new_name',''));
  if sid is not null and not exists(select 1 from public.zy_job_subcategories where id=sid and major=item->>'major') then raise exception '细类无效'; end if;
  if sid is null and n<>'' then
   if length(n)>80 then raise exception '细类名称过长'; end if;
   insert into public.zy_job_subcategories(major,name,created_by) values(item->>'major',n,'ai') on conflict do nothing;
   select id into sid from public.zy_job_subcategories where major=item->>'major' and lower(btrim(name))=lower(n);
  end if;
  insert into public.zy_job_classification_cache(text_hash,kind,major,subcategory_id,evidence,by) values(item->>'text_hash',item->>'kind',item->>'major',sid,item->>'evidence','ai')
   on conflict(text_hash) do update set major=excluded.major,subcategory_id=excluded.subcategory_id,evidence=excluded.evidence,by='ai',created_at=now() where public.zy_job_classification_cache.by<>'user';
  result=result||jsonb_build_array((select to_jsonb(c) from public.zy_job_classification_cache c where text_hash=item->>'text_hash'));
 end loop;return jsonb_build_object('items',result);
end $$;
create or replace function public.zy_job_manage(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid text:=p_data->>'id'; target text:=p_data->>'target'; cursor_id text; visited text[]:='{}'; row_data public.zy_job_subcategories;
begin
 perform zy_private.require_member(true);perform zy_private.require_writable();perform pg_advisory_xact_lock(hashtextextended('zy-job-taxonomy',0));
 if p_action='assign' then
  select * into row_data from public.zy_job_subcategories where id=p_data->>'subcategory_id';
  if row_data.id is null or row_data.merged_into is not null then raise exception '请选择有效细类'; end if;
  insert into public.zy_job_classification_cache(text_hash,kind,major,subcategory_id,evidence,by) values(p_data->>'text_hash',p_data->>'kind',row_data.major,row_data.id,p_data->>'evidence','user') on conflict(text_hash) do update set major=excluded.major,subcategory_id=excluded.subcategory_id,evidence=excluded.evidence,by='user',created_at=now();
 elsif p_action='merge' then
  if sid=target then raise exception '不能合并到自身'; end if;
  if not exists(select 1 from public.zy_job_subcategories where id=sid) or not exists(select 1 from public.zy_job_subcategories where id=target) then raise exception '细类不存在'; end if;
  cursor_id=target;
  while cursor_id is not null loop
   if cursor_id=sid or cursor_id=any(visited) then raise exception '合并形成循环'; end if;
   visited=array_append(visited,cursor_id);select merged_into into cursor_id from public.zy_job_subcategories where id=cursor_id;
  end loop;
  update public.zy_job_subcategories set merged_into=target,updated_at=now() where id=sid;
 elsif p_action='update' then
  update public.zy_job_subcategories set name=coalesce(nullif(btrim(p_data->>'name'),''),name),major=coalesce(p_data->>'major',major),aliases=case when p_data ? 'aliases' then array(select jsonb_array_elements_text(p_data->'aliases')) else aliases end,status=coalesce(p_data->>'status',status),updated_at=now() where id=sid;
  if not found then raise exception '细类不存在'; end if;
 else raise exception '不支持的分类操作'; end if;
 return public.zy_job_taxonomy();
end $$;
-- Only current classification metadata is backfilled; every business revision remains protected.
create or replace function public.zy_job_profiles_apply(p_orders jsonb,p_workers jsonb,p_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare patch jsonb; state_row zy_private.order_state; expected bigint;
begin
 perform zy_private.require_member(true);perform zy_private.require_writable();
 if jsonb_typeof(p_orders)<>'array' or jsonb_typeof(p_workers)<>'array' or jsonb_array_length(p_orders)+jsonb_array_length(p_workers)>100 then raise exception '回填批次无效'; end if;
 select * into state_row from zy_private.order_state where id=1 for update;
 if state_row.revision<>p_revision then raise exception using errcode='40001',message='公司单已修改，请重新回填'; end if;
 for patch in select value from jsonb_array_elements(p_orders) loop
  perform zy_private.validate_match_profile(patch->'profile');
  select coalesce(jsonb_agg(case when o->>'id'=patch->>'id' then o||jsonb_build_object('matchProfile',patch->'profile') else o end order by ord),'[]') into state_row.orders from jsonb_array_elements(state_row.orders) with ordinality as t(o,ord);
 end loop;
 if jsonb_array_length(p_orders)>0 then update zy_private.order_state set orders=state_row.orders,revision=revision+1 where id=1;end if;
 for patch in select value from jsonb_array_elements(p_workers) loop
  perform zy_private.validate_match_profile(patch->'profile');
  update zy_private.workers set data=data||jsonb_build_object('matchProfile',patch->'profile'),version=version+1 where id=patch->>'id' and version=(patch->>'version')::bigint;
  if not found then raise exception using errcode='40001',message='劳工资料已修改，请重新回填'; end if;
 end loop;
 return jsonb_build_object('ok',true);
end $$;
-- Accept both old metadata and v2 during rollout; only v2 participates in classification.
create or replace function zy_private.validate_match_profile(v jsonb) returns void language plpgsql immutable set search_path='' as $$
begin
 if v='null'::jsonb then return; end if;
 if jsonb_typeof(v) is distinct from 'object' or coalesce(v->>'version','') not in ('1','2') or coalesce(v->>'by','') not in ('ai','rules','user') or jsonb_typeof(v->'sourceHash') is distinct from 'string' or octet_length(v::text)>24000 then raise exception '岗位归类字段无效';end if;
end $$;
revoke all on function public.zy_job_taxonomy(),public.zy_job_manage(text,jsonb),public.zy_job_profiles_apply(jsonb,jsonb,bigint) from public,anon;
grant execute on function public.zy_job_taxonomy(),public.zy_job_manage(text,jsonb),public.zy_job_profiles_apply(jsonb,jsonb,bigint) to authenticated;
revoke all on function public.zy_job_claim(uuid,text[],uuid,boolean),public.zy_job_release(uuid),public.zy_job_reserve(uuid),public.zy_job_classification_commit(uuid,jsonb) from public,anon,authenticated;
-- Supabase service_role is the only classification writer; never exposed in the client.
grant execute on function public.zy_job_claim(uuid,text[],uuid,boolean),public.zy_job_release(uuid),public.zy_job_reserve(uuid),public.zy_job_classification_commit(uuid,jsonb) to service_role;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:appliance','maintenance','家电维修技工',array['家电维修','家電維修','家电','家電'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:electrician','maintenance','电工',array['电工','電工','电气技工','電氣技工','水电工','水電工'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:crane_repair','maintenance','吊机维修',array['吊机维修','吊機維修','吊机保养','吊機保養'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:mechanic','maintenance','机械维修',array['机械维修','機械維修','机械技术员','機械技術員','机电','機電'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:ac_repair','maintenance','空调维修',array['空调维修','空調維修','冷气维修','冷氣維修'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:welding','maintenance','焊工',array['焊工','焊接'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:general_repair','maintenance','维修工',array['维修工','維修工'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:lift_operator','equipment','高空作业 / 升降台',array['高空作业','高空作業','升降台','高空证','高空證'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:forklift','equipment','叉车操作',array['叉车','叉車','铲车','鏟車'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:crane_operator','equipment','吊机操作',array['吊机','吊機'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:driver','driving','司机',array['司机','司機','驾驶员','駕駛員','货车','貨車','牵引车','牽引車'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:cleaning','hotel_cleaning','清洁员',array['清洁员','清潔員','清洁工','清潔工','保洁','保潔','打扫','打掃','清洁服务大使','清潔服務大使','清洁','清潔'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:housekeeping','hotel_cleaning','酒店客房服务员',array['客房','房务','房務','布草','酒店服务员','酒店服務員','客房清洁员','客房清潔員'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:helper','kitchen','厨房帮工',array['厨房帮工','廚房幫工','帮厨','幫廚','洗碗','切配','厨工','廚工'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:dim_sum','kitchen','点心师傅',array['点心','點心'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:dessert','kitchen','甜品师',array['甜品'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:baker','kitchen','面包师傅',array['面包','麵包'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:japanese_cook','kitchen','日本菜师傅',array['日本菜'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:cook','kitchen','厨师',array['厨师','廚師','炒锅','炒鍋','中餐','西餐'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:waiter','food_service','侍应',array['侍应','侍應','餐厅服务员','餐廳服務員'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:bartender','food_service','调酒员',array['调酒','調酒'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:barista','food_service','咖啡师',array['咖啡师','咖啡師'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:care','care','护理员',array['护理','護理','护工','護工','护士','護士','看护','看護'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:warehouse','logistics','仓库理货员',array['理货','理貨','仓库','倉庫','拣货','揀貨','搬运','搬運'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:packing','manufacturing','包装工',array['包装','包裝','装箱','裝箱'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:office','office','文员',array['文员','文員','行政','电脑操作','電腦操作'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:retail','retail','售货员',array['售货','售貨','推销','推銷','销售','銷售'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:beauty','beauty','美容师',array['美容师','美容師','美容','SPA','按摩'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:car_detail','vehicle_service','汽车美容师',array['汽车美容','汽車美容','洗车','洗車'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:ground','aviation_transport','地勤',array['地勤','行李处理','行李處理'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:construction','construction','建筑工',array['地盘','地盤','建筑','建築','泥水'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:security','security_property','保安',array['保安','看更'],'active','rules') on conflict do nothing;
insert into public.zy_job_subcategories(id,major,name,aliases,status,created_by) values('seed:garden','agriculture','园艺工',array['园艺','園藝','种植','種植'],'active','rules') on conflict do nothing;
commit;
