-- Owner-requested deletion of the redundant first-machine snapshot only.
-- Business raw, manual fields, identifiers and review ownership are unchanged.
begin;
create or replace function zy_private.strip_first_recognition()
returns trigger language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(new.orders)='array' then
  select coalesce(jsonb_agg(item - 'firstRecognition' order by ord),'[]'::jsonb)
    into new.orders from jsonb_array_elements(new.orders) with ordinality as t(item,ord);
 end if;
 return new;
end $$;
revoke all on function zy_private.strip_first_recognition() from public,anon,authenticated;
drop trigger if exists strip_first_recognition on zy_private.order_state;
create trigger strip_first_recognition before insert or update of orders
 on zy_private.order_state for each row execute function zy_private.strip_first_recognition();
update zy_private.order_state set orders=orders,revision=revision+1
 where exists(select 1 from jsonb_array_elements(orders) item where item ? 'firstRecognition');
commit;
