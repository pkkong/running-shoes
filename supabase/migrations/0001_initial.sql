create table if not exists public.runfit_lineup_periods (
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

create table if not exists public.runfit_shoes (
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

create table if not exists public.runfit_lineup_items (
  id bigserial primary key,
  period_id text not null references public.runfit_lineup_periods(id) on delete cascade,
  brand text not null,
  category text not null,
  sort_order integer not null,
  models jsonb not null default '[]'::jsonb,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(period_id, brand, category)
);

create table if not exists public.runfit_price_query_config (
  id text primary key default 'default',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.runfit_lineup_periods enable row level security;
alter table public.runfit_shoes enable row level security;
alter table public.runfit_lineup_items enable row level security;
alter table public.runfit_price_query_config enable row level security;

drop policy if exists "runfit_lineup_periods are readable" on public.runfit_lineup_periods;
drop policy if exists "runfit_shoes are readable" on public.runfit_shoes;
drop policy if exists "runfit_lineup_items are readable" on public.runfit_lineup_items;
drop policy if exists "runfit_price_query_config is readable" on public.runfit_price_query_config;

create policy "runfit_lineup_periods are readable"
  on public.runfit_lineup_periods for select
  using (true);

create policy "runfit_shoes are readable"
  on public.runfit_shoes for select
  using (true);

create policy "runfit_lineup_items are readable"
  on public.runfit_lineup_items for select
  using (true);

create policy "runfit_price_query_config is readable"
  on public.runfit_price_query_config for select
  using (true);

create index if not exists runfit_lineup_periods_sort_order_idx on public.runfit_lineup_periods(sort_order);
create index if not exists runfit_shoes_sort_order_idx on public.runfit_shoes(sort_order);
create index if not exists runfit_shoes_brand_category_idx on public.runfit_shoes(brand, category);
create index if not exists runfit_lineup_items_period_sort_order_idx on public.runfit_lineup_items(period_id, sort_order);

create or replace function public.runfit_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_runfit_lineup_periods_updated_at on public.runfit_lineup_periods;
create trigger set_runfit_lineup_periods_updated_at
  before update on public.runfit_lineup_periods
  for each row execute function public.runfit_set_updated_at();

drop trigger if exists set_runfit_shoes_updated_at on public.runfit_shoes;
create trigger set_runfit_shoes_updated_at
  before update on public.runfit_shoes
  for each row execute function public.runfit_set_updated_at();

drop trigger if exists set_runfit_lineup_items_updated_at on public.runfit_lineup_items;
create trigger set_runfit_lineup_items_updated_at
  before update on public.runfit_lineup_items
  for each row execute function public.runfit_set_updated_at();

drop trigger if exists set_runfit_price_query_config_updated_at on public.runfit_price_query_config;
create trigger set_runfit_price_query_config_updated_at
  before update on public.runfit_price_query_config
  for each row execute function public.runfit_set_updated_at();
