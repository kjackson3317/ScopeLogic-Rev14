-- ScopeLogic v1.0 RC2 — Authentication and database foundation
-- Apply with: npx supabase db push

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'administrator' check (role in ('administrator', 'manager', 'user', 'viewer')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_profile_updated on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
create trigger on_auth_user_profile_updated
after update of email, raw_user_meta_data on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do update set email = excluded.email;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  legacy_id text,
  company_name text not null,
  address1 text not null default '',
  address2 text not null default '',
  city text not null default '',
  state text not null default '',
  postal_code text not null default '',
  website text not null default '',
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, legacy_id)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  legacy_id text,
  name text not null,
  title text not null default '',
  email text not null default '',
  phone text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, legacy_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  legacy_id text,
  name text not null,
  client_name text not null default '',
  customer_id uuid references public.customers(id) on delete set null,
  version_date date,
  status text not null default 'Planning',
  revision text not null default 'Rev 0',
  modified_label text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, legacy_id)
);

create table public.project_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (project_id, contact_id)
);

create table public.project_systems (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  system_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (project_id, system_name)
);

create table public.slr_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  legacy_uid text,
  sequence_number integer not null,
  display_number text not null,
  system_name text not null,
  custom_system text not null default '',
  scope_item text not null,
  status text not null default 'Open',
  scope_concern text not null default '',
  rfi_question text not null default '',
  recommended_bid_basis text not null default '',
  reason_basis text not null default '',
  reference text not null default '',
  rfi_number text not null default '',
  resolution text not null default '',
  snippet_number text not null default '',
  include_sow boolean not null default true,
  include_clarification boolean not null default true,
  include_formal_rfi boolean not null default false,
  checklist_scope_item text not null default '',
  contractor_response text not null default 'Included',
  contractor_response_reason text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, legacy_uid),
  unique (project_id, sequence_number)
);

create table public.slr_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  legacy_id text,
  name text not null,
  template_data jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, legacy_id)
);

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  legacy_id text,
  document_type text not null,
  display_name text not null,
  revision text not null default 'Revision 0',
  issue_date date,
  is_current boolean not null default true,
  notes text not null default '',
  original_filename text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  storage_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, legacy_id)
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_document_id uuid not null references public.project_documents(id) on delete cascade,
  revision text not null,
  issue_date date,
  original_filename text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  storage_path text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  legacy_id text,
  event_date date not null,
  title text not null,
  event_type text not null default 'Other',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, legacy_id)
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  offering text not null default '',
  engagement_basis text not null default '',
  pricing_tier text not null default '',
  contract_number text not null default '',
  amount text not null default '',
  status text not null default 'Draft',
  start_date date,
  target_completion date,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.release_packages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  revision text not null,
  version_date date,
  status text not null default 'Official Release',
  release_notes text not null default '',
  filename text not null,
  storage_path text,
  released_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.release_deliverables (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  release_package_id uuid not null references public.release_packages(id) on delete cascade,
  deliverable_type text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.export_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  legacy_id text,
  filename text not null,
  deliverable text not null,
  project_revision text not null default '',
  downloaded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (project_id, legacy_id)
);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  provider_message_id text,
  from_address text not null,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  subject text not null,
  filename text not null default '',
  status text not null default 'sent',
  error_message text not null default '',
  sent_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now())
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_key text not null,
  status text not null,
  counts jsonb not null default '{}'::jsonb,
  error_message text not null default '',
  imported_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, source_key)
);

-- Performance indexes used by project-scoped screens and RLS filters.
create index customers_owner_idx on public.customers(owner_id);
create index contacts_owner_customer_idx on public.contacts(owner_id, customer_id);
create index projects_owner_idx on public.projects(owner_id);
create index slr_entries_project_sequence_idx on public.slr_entries(project_id, sequence_number);
create index project_documents_project_current_idx on public.project_documents(project_id, is_current);
create index calendar_events_owner_date_idx on public.calendar_events(owner_id, event_date);
create index activity_log_project_date_idx on public.activity_log(project_id, occurred_at desc);

-- updated_at triggers.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles','customers','contacts','projects','slr_entries','slr_templates','project_documents',
    'calendar_events','contracts','internal_notes','user_settings'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', table_name);
  end loop;
end $$;

-- Row Level Security: no anonymous application data access.
create or replace function public.owns_customer(target_customer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.customers
    where id = target_customer and owner_id = (select auth.uid())
  );
$$;

create or replace function public.owns_project(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects
    where id = target_project and owner_id = (select auth.uid())
  );
$$;

create or replace function public.owns_document(target_document uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_documents
    where id = target_document and owner_id = (select auth.uid())
  );
$$;

create or replace function public.owns_release(target_release uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.release_packages
    where id = target_release and owner_id = (select auth.uid())
  );
$$;

alter table public.profiles enable row level security;
create policy "profiles_read_self" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_self" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Direct owner-scoped records.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['customers','slr_templates','import_runs'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)',
      table_name || '_manage_own', table_name
    );
  end loop;
end $$;

alter table public.projects enable row level security;
create policy "projects_manage_own" on public.projects for all to authenticated
using ((select auth.uid()) = owner_id and (customer_id is null or public.owns_customer(customer_id)))
with check ((select auth.uid()) = owner_id and (customer_id is null or public.owns_customer(customer_id)));

alter table public.user_settings enable row level security;
create policy "user_settings_manage_self" on public.user_settings for all to authenticated
using ((select auth.uid()) = owner_id and (select auth.uid()) = user_id)
with check ((select auth.uid()) = owner_id and (select auth.uid()) = user_id);

alter table public.contacts enable row level security;
create policy "contacts_manage_own" on public.contacts for all to authenticated
using ((select auth.uid()) = owner_id and (customer_id is null or public.owns_customer(customer_id)))
with check ((select auth.uid()) = owner_id and (customer_id is null or public.owns_customer(customer_id)));

alter table public.project_contacts enable row level security;
create policy "project_contacts_manage_own" on public.project_contacts for all to authenticated
using ((select auth.uid()) = owner_id and public.owns_project(project_id))
with check (
  (select auth.uid()) = owner_id
  and public.owns_project(project_id)
  and exists (select 1 from public.contacts c where c.id = contact_id and c.owner_id = (select auth.uid()))
);

alter table public.project_systems enable row level security;
create policy "project_systems_manage_own" on public.project_systems for all to authenticated
using ((select auth.uid()) = owner_id and public.owns_project(project_id))
with check ((select auth.uid()) = owner_id and public.owns_project(project_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'slr_entries','project_documents','contracts','internal_notes','release_packages','export_log'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = owner_id and public.owns_project(project_id)) with check ((select auth.uid()) = owner_id and public.owns_project(project_id))',
      table_name || '_manage_own_project', table_name
    );
  end loop;
end $$;

alter table public.document_versions enable row level security;
create policy "document_versions_manage_own" on public.document_versions for all to authenticated
using ((select auth.uid()) = owner_id and public.owns_document(project_document_id))
with check ((select auth.uid()) = owner_id and public.owns_document(project_document_id));

alter table public.release_deliverables enable row level security;
create policy "release_deliverables_manage_own" on public.release_deliverables for all to authenticated
using ((select auth.uid()) = owner_id and public.owns_release(release_package_id))
with check ((select auth.uid()) = owner_id and public.owns_release(release_package_id));

alter table public.calendar_events enable row level security;
create policy "calendar_events_manage_own" on public.calendar_events for all to authenticated
using ((select auth.uid()) = owner_id and (project_id is null or public.owns_project(project_id)))
with check ((select auth.uid()) = owner_id and (project_id is null or public.owns_project(project_id)));

alter table public.email_log enable row level security;
create policy "email_log_manage_own" on public.email_log for all to authenticated
using ((select auth.uid()) = owner_id and (project_id is null or public.owns_project(project_id)))
with check ((select auth.uid()) = owner_id and (project_id is null or public.owns_project(project_id)));

alter table public.activity_log enable row level security;
create policy "activity_log_manage_own" on public.activity_log for all to authenticated
using ((select auth.uid()) = owner_id and (project_id is null or public.owns_project(project_id)))
with check ((select auth.uid()) = owner_id and (project_id is null or public.owns_project(project_id)));

-- Allow authenticated API calls; RLS remains the authorization boundary.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.profiles, public.customers, public.contacts, public.projects, public.project_contacts,
  public.project_systems, public.slr_entries, public.slr_templates, public.project_documents,
  public.document_versions, public.calendar_events, public.contracts, public.internal_notes,
  public.release_packages, public.release_deliverables, public.export_log, public.email_log,
  public.activity_log, public.user_settings, public.import_runs
to authenticated;

-- Private project-files bucket policies. Files must be stored under <user-id>/<project-id>/...
drop policy if exists "project_files_select_own" on storage.objects;
drop policy if exists "project_files_insert_own" on storage.objects;
drop policy if exists "project_files_update_own" on storage.objects;
drop policy if exists "project_files_delete_own" on storage.objects;

create policy "project_files_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'project-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "project_files_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'project-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "project_files_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'project-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'project-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "project_files_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'project-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
