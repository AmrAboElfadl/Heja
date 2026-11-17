-- ============================================================
--  HEJA — Supabase database schema
--  Tables: products, orders, order_items, store_settings
--  Customers (anonymous) can: read active products + settings,
--  and place an order via the place_order() function.
--  They can NOT read or change orders. You manage everything
--  in the Supabase dashboard → Table Editor.
-- ============================================================

-- ---------- tables ----------
create table if not exists public.products (
  id          text primary key,                      -- url-friendly id, e.g. 'classic-tee'
  name        text not null,
  category    text not null,
  price       numeric(10,2) not null check (price >= 0),
  old_price   numeric(10,2) not null default 0 check (old_price >= 0),
  color       text not null default '#e9e4da',
  shape       text not null default 'tee',
  sizes       text[] not null default '{}',
  badge       text not null default '',
  image       text not null default '',              -- full URL, e.g. from Supabase Storage
  description text not null default '',
  active      boolean not null default true,          -- untick to hide from the shop
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.store_settings (
  id                 int primary key default 1 check (id = 1),  -- single row
  shipping_fee       numeric(10,2) not null default 60,
  free_shipping_over numeric(10,2) not null default 1500         -- 0 = never free
);
insert into public.store_settings (id) values (1) on conflict do nothing;

create table if not exists public.orders (
  id            bigint generated always as identity primary key,
  order_no      text not null unique,
  customer_name text not null,
  phone         text not null,
  city          text not null,
  address       text not null,
  notes         text not null default '',
  subtotal      numeric(10,2) not null,
  shipping      numeric(10,2) not null,
  total         numeric(10,2) not null,
  status        text not null default 'new'
                check (status in ('new','confirmed','shipped','delivered','cancelled')),
  created_at    timestamptz not null default now()
);

create table if not exists public.order_items (
  id           bigint generated always as identity primary key,
  order_id     bigint not null references public.orders(id) on delete cascade,
  product_id   text references public.products(id) on delete set null,
  product_name text not null,
  size         text not null,
  qty          int not null check (qty between 1 and 20),
  unit_price   numeric(10,2) not null
);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

-- ---------- row level security ----------
alter table public.products       enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products
  for select to anon, authenticated using (active);

drop policy if exists "Public can read store settings" on public.store_settings;
create policy "Public can read store settings" on public.store_settings
  for select to anon, authenticated using (true);
-- orders / order_items: no policies → not readable or writable from the website.

-- ---------- place_order: prices are calculated on the server ----------
create or replace function public.place_order(p_customer jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  v_shipping numeric(10,2);
  v_settings public.store_settings%rowtype;
  v_order_id bigint;
  v_order_no text;
  v_lines    jsonb := '[]'::jsonb;
begin
  if v_name = '' or v_phone = '' or v_city = '' or v_address = '' then
    raise exception 'Missing delivery details';
  end if;
  if length(v_name) > 120 or length(v_phone) > 40 or length(v_city) > 80
     or length(v_address) > 400 or length(v_notes) > 400 then
    raise exception 'Delivery details are too long';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 30 then
    raise exception 'Cart is empty or too large';
  end if;

  -- validate items and compute subtotal from database prices
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

  select * into v_settings from public.store_settings where id = 1;
  v_shipping := case
    when v_settings.free_shipping_over > 0 and v_subtotal >= v_settings.free_shipping_over then 0
    else v_settings.shipping_fee end;

  v_order_no := 'HJ-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into public.orders (order_no, customer_name, phone, city, address, notes, subtotal, shipping, total)
  values (v_order_no, v_name, v_phone, v_city, v_address, v_notes, v_subtotal, v_shipping, v_subtotal + v_shipping)
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, product_name, size, qty, unit_price)
  select v_order_id, l->>'id', l->>'name', l->>'size', (l->>'qty')::int, (l->>'price')::numeric
  from jsonb_array_elements(v_lines) l;

  return jsonb_build_object('order_no', v_order_no, 'subtotal', v_subtotal,
                            'shipping', v_shipping, 'total', v_subtotal + v_shipping, 'items', v_lines);
end;
$$;

revoke all on function public.place_order(jsonb, jsonb) from public;
grant execute on function public.place_order(jsonb, jsonb) to anon, authenticated;

-- ---------- storage bucket for product photos (public read) ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
