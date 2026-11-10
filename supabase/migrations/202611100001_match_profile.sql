-- Optional current classification metadata only. No new tables, policies or privileges.
begin;
create or replace function zy_private.validate_match_profile(v jsonb)
returns void language plpgsql immutable set search_path='' as $$
begin
 if v='null'::jsonb then return; end if;
 if jsonb_typeof(v) is distinct from 'object' or v->>'version' is distinct from '1'
 or coalesce(v->>'by','') not in ('ai','rules') or jsonb_typeof(v->'sourceHash') is distinct from 'string'
 or octet_length(v::text)>16000 then raise exception '岗位归类字段无效'; end if;
end $$;
revoke all on function zy_private.validate_match_profile(jsonb) from public,anon,authenticated;
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
   if field='matchProfile' then perform zy_private.validate_match_profile(v); continue; end if;
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
  if field='matchProfile' then perform zy_private.validate_match_profile(v);
  elsif field in ('educationHistory','workHistory') then
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


commit;
