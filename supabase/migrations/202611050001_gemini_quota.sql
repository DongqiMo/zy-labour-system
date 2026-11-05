-- Private, atomic AI call caps. No source orders or model secrets are stored here.
begin;
create table if not exists zy_private.ai_daily_usage(day date primary key,calls integer not null default 0);
create table if not exists zy_private.ai_member_usage(day date not null,member uuid not null,calls integer not null default 0,last_call timestamptz not null default '-infinity',primary key(day,member));
alter table zy_private.ai_daily_usage enable row level security;
alter table zy_private.ai_member_usage enable row level security;
revoke all on zy_private.ai_daily_usage,zy_private.ai_member_usage from public,anon,authenticated;
create or replace function public.zy_ai_reserve() returns jsonb language plpgsql security definer set search_path='' as $$
declare d date := (now() at time zone 'Asia/Hong_Kong')::date; total integer; personal integer; last_time timestamptz;
begin
 perform zy_private.require_writable();
 insert into zy_private.ai_daily_usage(day) values(d) on conflict do nothing;
 select calls into total from zy_private.ai_daily_usage where day=d for update;
 insert into zy_private.ai_member_usage(day,member) values(d,auth.uid()) on conflict do nothing;
 select calls,last_call into personal,last_time from zy_private.ai_member_usage where day=d and member=auth.uid() for update;
 if total>=100 or personal>=20 or now()-last_time<interval '2 seconds' then raise exception using errcode='54000',message='AI调用上限或间隔限制'; end if;
 update zy_private.ai_daily_usage set calls=calls+1 where day=d;
 update zy_private.ai_member_usage set calls=calls+1,last_call=now() where day=d and member=auth.uid();
 return jsonb_build_object('ok',true,'remaining',least(99-total,19-personal));
end $$;
revoke all on function public.zy_ai_reserve() from public,anon;
grant execute on function public.zy_ai_reserve() to authenticated;
commit;
