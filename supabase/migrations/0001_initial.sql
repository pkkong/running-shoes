create table if not exists public.lineup_periods (
  id text primary key,
  label text not null,
  sort_order integer not null,
  active boolean not null default false,
  source_post_url text,
  table_image_url text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shoes (
  id text primary key,
  brand text not null,
  model text not null,
  display_name text,
  category_group text not null,
  category text not null,
  sort_order integer not null,
  drop_mm numeric,
  tags jsonb not null default '[]'::jsonb,
  image_url text,
  image_source_url text,
  official_product_url text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lineup_items (
  id bigserial primary key,
  period_id text not null references public.lineup_periods(id) on delete cascade,
  brand text not null,
  category text not null,
  sort_order integer not null,
  models jsonb not null default '[]'::jsonb,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(period_id, brand, category)
);

create table if not exists public.price_query_config (
  id text primary key default 'default',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lineup_periods enable row level security;
alter table public.shoes enable row level security;
alter table public.lineup_items enable row level security;
alter table public.price_query_config enable row level security;

drop policy if exists "lineup_periods are readable" on public.lineup_periods;
drop policy if exists "shoes are readable" on public.shoes;
drop policy if exists "lineup_items are readable" on public.lineup_items;
drop policy if exists "price_query_config is readable" on public.price_query_config;

create policy "lineup_periods are readable"
  on public.lineup_periods for select
  using (true);

create policy "shoes are readable"
  on public.shoes for select
  using (true);

create policy "lineup_items are readable"
  on public.lineup_items for select
  using (true);

create policy "price_query_config is readable"
  on public.price_query_config for select
  using (true);

create index if not exists lineup_periods_sort_order_idx on public.lineup_periods(sort_order);
create index if not exists shoes_sort_order_idx on public.shoes(sort_order);
create index if not exists shoes_brand_category_idx on public.shoes(brand, category);
create index if not exists lineup_items_period_sort_order_idx on public.lineup_items(period_id, sort_order);
