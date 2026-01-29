create table if not exists public.drug_catalog (
  id uuid primary key default gen_random_uuid(),
  ndc text,
  brand_name text,
  generic_name text,
  labeler_name text,
  route text,
  dosage_form text,
  fda_id text unique,
  raw jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_drug_catalog_ndc on public.drug_catalog(ndc);
create index if not exists idx_drug_catalog_brand_name on public.drug_catalog(brand_name);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  session_id text,
  event_type text not null,
  drug_id uuid references public.drug_catalog(id),
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_analytics_events_user on public.analytics_events(user_id);
create index if not exists idx_analytics_events_event_type on public.analytics_events(event_type);


