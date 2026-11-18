-- ============================================================
--  HEJA — update 2: promo codes, newsletter, order tracking, Arabic
--  (Already applied to the live project. Run after schema.sql on a new project.)
--
--  Add promo codes in Supabase → Table Editor → promo_codes:
--    code (UPPERCASE), percent_off OR amount_off, min_subtotal, active, expires_at
--  Newsletter emails: Table Editor → subscribers
-- ============================================================

alter table public.products add column if not exists name_ar text not null default '';
alter table public.products add column if not exists description_ar text not null default '';

create table if not exists public.promo_codes (
  code         text primary key check (code = upper(code)),
  percent_off  int check (percent_off between 1 and 90),
  amount_off   numeric(10,2) check (amount_off > 0),
  min_subtotal numeric(10,2) not null default 0,
  active       boolean not null default true,
  expires_at   timestamptz,
  check (percent_off is not null or amount_off is not null)
);
alter table public.promo_codes enable row level security;
insert into public.promo_codes (code, percent_off) values ('WELCOME10', 10) on conflict do nothing;

create table if not exists public.subscribers (
  id         bigint generated always as identity primary key,
  email      text not null unique,
  created_at timestamptz not null default now()
);
alter table public.subscribers enable row level security;

alter table public.orders add column if not exists promo_code text;
alter table public.orders add column if not exists discount numeric(10,2) not null default 0;

create or replace function public._promo_discount(p_code text, p_subtotal numeric)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare v public.promo_codes%rowtype;
begin
  select * into v from public.promo_codes
   where code = upper(btrim(coalesce(p_code, ''))) and active
     and (expires_at is null or expires_at > now());
  if not found or p_subtotal < v.min_subtotal then return null; end if;
  return least(p_subtotal, round(coalesce(p_subtotal * v.percent_off / 100.0, v.amount_off), 2));
end; $$;
revoke all on function public._promo_discount(text, numeric) from public, anon, authenticated;

create or replace function public.check_promo(p_code text, p_subtotal numeric)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare d numeric;
begin
  d := public._promo_discount(p_code, p_subtotal);
  if d is null then return jsonb_build_object('valid', false); end if;
  return jsonb_build_object('valid', true, 'code', upper(btrim(p_code)), 'discount', d);
end; $$;
revoke all on function public.check_promo(text, numeric) from public;
grant execute on function public.check_promo(text, numeric) to anon, authenticated;

create or replace function public.subscribe(p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e text := lower(btrim(coalesce(p_email, '')));
begin
  if length(e) > 200 or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Invalid email'; end if;
  insert into public.subscribers (email) values (e) on conflict (email) do nothing;
  return jsonb_build_object('ok', true, 'code', 'WELCOME10');
end; $$;
revoke all on function public.subscribe(text) from public;
grant execute on function public.subscribe(text) to anon, authenticated;

create or replace function public.track_order(p_order_no text, p_phone text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders
   where order_no = upper(btrim(coalesce(p_order_no, '')))
     and regexp_replace(phone, '\D', '', 'g') = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
     and length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 3;
  if not found then return jsonb_build_object('found', false); end if;
  return jsonb_build_object(
    'found', true, 'order_no', o.order_no, 'status', o.status, 'created_at', o.created_at,
    'total', o.total, 'city', o.city,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', product_name, 'size', size, 'qty', qty)), '[]'::jsonb)
              from public.order_items where order_id = o.id));
end; $$;
revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;

-- checkout(): like place_order() but with an optional promo code. The website uses this one.
create or replace function public.checkout(p_customer jsonb, p_items jsonb, p_promo text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_name    text := btrim(coalesce(p_customer->>'name', ''));
  v_phone   text := btrim(coalesce(p_customer->>'phone', ''));
  v_city    text := btrim(coalesce(p_customer->>'city', ''));
  v_address text := btrim(coalesce(p_customer->>'address', ''));
  v_notes   text := btrim(coalesce(p_customer->>'notes', ''));
  v_item    jsonb;
  v_prod    public.products%rowtype;
  v_qty     int;
  v_size    text;
  v_subtotal numeric(10,2) := 0;
  v_discount numeric(10,2) := 0;
  v_promo    text := null;
  v_shipping numeric(10,2);
  v_settings public.store_settings%rowtype;
  v_order_id bigint;
  v_order_no text;
  v_lines    jsonb := '[]'::jsonb;
begin
  if v_name = '' or v_phone = '' or v_city = '' or v_address = '' then raise exception 'Missing delivery details'; end if;
  if length(v_name) > 120 or length(v_phone) > 40 or length(v_city) > 80
     or length(v_address) > 400 or length(v_notes) > 400 then raise exception 'Delivery details are too long'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 30 then raise exception 'Cart is empty or too large'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from public.products where id = v_item->>'id' and active;
    if not found then raise exception 'Product not available: %', v_item->>'id'; end if;
    v_size := v_item->>'size';
    if not (v_size = any (v_prod.sizes)) then raise exception 'Size % not available for %', v_size, v_prod.name; end if;
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 20 then raise exception 'Invalid quantity'; end if;
    v_subtotal := v_subtotal + v_prod.price * v_qty;
    v_lines := v_lines || jsonb_build_object('id', v_prod.id, 'name', v_prod.name, 'size', v_size, 'qty', v_qty, 'price', v_prod.price);
  end loop;

  if coalesce(btrim(p_promo), '') <> '' then
    v_discount := public._promo_discount(p_promo, v_subtotal);
    if v_discount is null then raise exception 'Promo code is not valid'; end if;
    v_promo := upper(btrim(p_promo));
  end if;

  select * into v_settings from public.store_settings where id = 1;
  v_shipping := case when v_settings.free_shipping_over > 0 and v_subtotal >= v_settings.free_shipping_over then 0
                     else v_settings.shipping_fee end;

  v_order_no := 'HJ-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into public.orders (order_no, customer_name, phone, city, address, notes, subtotal, shipping, total, promo_code, discount)
  values (v_order_no, v_name, v_phone, v_city, v_address, v_notes, v_subtotal, v_shipping,
          v_subtotal - v_discount + v_shipping, v_promo, v_discount)
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, product_name, size, qty, unit_price)
  select v_order_id, l->>'id', l->>'name', l->>'size', (l->>'qty')::int, (l->>'price')::numeric
  from jsonb_array_elements(v_lines) l;

  return jsonb_build_object('order_no', v_order_no, 'subtotal', v_subtotal, 'discount', v_discount,
                            'promo', v_promo, 'shipping', v_shipping,
                            'total', v_subtotal - v_discount + v_shipping, 'items', v_lines);
end; $$;
revoke all on function public.checkout(jsonb, jsonb, text) from public;
grant execute on function public.checkout(jsonb, jsonb, text) to anon, authenticated;
