create extension if not exists "pgcrypto";

create table if not exists households (
  id text primary key,
  email text not null unique,
  auth_user_id uuid unique,
  slug text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  storage_mode text not null,
  target_market_area text not null,
  audience_mode text not null
);

create table if not exists financial_snapshots (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  captured_at timestamptz not null,
  members jsonb not null,
  monthly_fixed_expenses bigint not null,
  monthly_current_housing_cost bigint not null,
  current_monthly_savings bigint not null,
  cash_assets bigint not null,
  subscription_savings bigint not null,
  jeonse_return_amount bigint not null,
  other_investable_assets bigint not null,
  outstanding_debt bigint not null,
  other_debt_monthly_service bigint not null,
  expected_annual_bonus bigint not null,
  notes text
);

create table if not exists housing_goals (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  captured_at timestamptz not null,
  preferred_regions text[] not null,
  target_timeframe_months integer not null,
  commute_max_minutes integer not null,
  minimum_exclusive_area_m2 numeric not null,
  priorities text[] not null,
  notes text
);

create table if not exists policy_snapshots (
  id text primary key,
  basis_date date not null,
  published_date date not null,
  review_status text not null,
  general_dsr_limit numeric not null,
  capital_area_stress_dsr_rate numeric not null,
  non_capital_stress_dsr_rate numeric not null,
  assumed_general_mortgage_rate numeric not null,
  closing_cost_rate numeric not null,
  bogeumjari jsonb not null,
  didimdol jsonb not null,
  sources jsonb not null
);

create table if not exists market_snapshots (
  id text primary key,
  slug text not null,
  region_name text not null,
  lifestyle_label text not null,
  published_month text not null,
  review_status text not null,
  freshness text not null,
  price_band_low bigint not null,
  price_band_mid bigint not null,
  price_band_high bigint not null,
  mom_change_pct numeric not null,
  yoy_change_pct numeric not null,
  commute_label text not null,
  notes text not null,
  source_records jsonb not null
);

create table if not exists affordability_runs (
  id text primary key,
  household_id text not null references households(id) on delete cascade,
  computed_at timestamptz not null,
  basis_date date not null,
  policy_snapshot_id text not null references policy_snapshots(id),
  market_snapshot_ids text[] not null,
  recognized_monthly_income bigint not null,
  safe_monthly_housing_budget bigint not null,
  total_available_own_funds bigint not null,
  policy_eligibility jsonb not null,
  recommended_market jsonb,
  market_suitability jsonb not null,
  scenarios jsonb not null,
  action_plan jsonb not null,
  ai_insight jsonb not null,
  source_records jsonb not null
);

create table if not exists refresh_reviews (
  id text primary key,
  source_record_id text not null,
  entity_type text not null,
  entity_id text not null,
  status text not null,
  reviewed_by text not null,
  reviewed_at timestamptz,
  notes text
);

create index if not exists households_auth_user_id_idx on households(auth_user_id);
create index if not exists financial_snapshots_household_id_idx on financial_snapshots(household_id);
create index if not exists housing_goals_household_id_idx on housing_goals(household_id);
create index if not exists affordability_runs_household_id_idx on affordability_runs(household_id);

alter table households enable row level security;
alter table financial_snapshots enable row level security;
alter table housing_goals enable row level security;
alter table affordability_runs enable row level security;

create policy "households_select_own"
on households
for select
using (auth.uid() = auth_user_id);

create policy "households_insert_own"
on households
for insert
with check (auth.uid() = auth_user_id);

create policy "households_update_own"
on households
for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

create policy "financial_snapshots_own"
on financial_snapshots
for all
using (
  exists (
    select 1
    from households
    where households.id = financial_snapshots.household_id
      and households.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from households
    where households.id = financial_snapshots.household_id
      and households.auth_user_id = auth.uid()
  )
);

create policy "housing_goals_own"
on housing_goals
for all
using (
  exists (
    select 1
    from households
    where households.id = housing_goals.household_id
      and households.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from households
    where households.id = housing_goals.household_id
      and households.auth_user_id = auth.uid()
  )
);

create policy "affordability_runs_own"
on affordability_runs
for all
using (
  exists (
    select 1
    from households
    where households.id = affordability_runs.household_id
      and households.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from households
    where households.id = affordability_runs.household_id
      and households.auth_user_id = auth.uid()
  )
);
