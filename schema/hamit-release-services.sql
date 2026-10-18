begin;
create table if not exists public.account_deletion_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null, organization_id uuid not null,
 scope text not null check(scope in ('account','company')),
 status text not null default 'pending' check(status in ('pending','processing','completed')),
 requested_at timestamptz not null default now(), completed_at timestamptz
);
create unique index if not exists account_deletion_one_pending on public.account_deletion_requests(user_id) where status <> 'completed';
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from anon,authenticated;
grant select on public.account_deletion_requests to authenticated;
grant all on public.account_deletion_requests to service_role;
drop policy if exists deletion_own_read on public.account_deletion_requests;
create policy deletion_own_read on public.account_deletion_requests for select to authenticated using(user_id=(select auth.uid()));
create or replace function public.request_account_deletion(p_scope text default 'account') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.profiles%rowtype; r public.account_deletion_requests%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in to request deletion'; end if;
 -- A fresh password sign-in creates a new server session; refreshing an old JWT is insufficient.
 if not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=auth.uid() and created_at>now()-interval '10 minutes') then raise exception 'Sign in again to confirm deletion'; end if;
 if p_scope not in ('account','company') then raise exception 'Invalid deletion scope'; end if;
 select * into p from public.profiles where id=auth.uid() for update;
 if p.id is null then raise exception 'Account profile not found'; end if;
 if p_scope='company' and (p.role<>'owner' or not p.active) then raise exception 'Only an active company owner may request workspace deletion'; end if;
 select * into r from public.account_deletion_requests where user_id=p.id and status<>'completed';
 if r.id is not null then
  if r.scope<>p_scope then raise exception 'A deletion request already exists. Contact support to change its scope.'; end if;
 else
  insert into public.account_deletion_requests(user_id,organization_id,scope) values(p.id,p.organization_id,p_scope) returning * into r;
 end if;
 return jsonb_build_object('id',r.id,'status',r.status,'scope',r.scope,'requested_at',r.requested_at);
end $$;
revoke all on function public.request_account_deletion(text) from public,anon;
grant execute on function public.request_account_deletion(text) to authenticated;

create table if not exists public.company_billing (
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 customer_id uuid not null unique default gen_random_uuid(),
 plan text check(plan in ('starter','team','business')),
 status text not null default 'unsubscribed' check(status in ('unsubscribed','trialing','active','expired')),
 expires_at timestamptz, will_renew boolean not null default false,
 store text, verified_at timestamptz, internal_access boolean not null default false
);
alter table public.company_billing enable row level security;
revoke all on public.company_billing from anon,authenticated;
grant all on public.company_billing to service_role;
create or replace function public.company_billing_context() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.profiles%rowtype; b public.company_billing%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into p from public.profiles where id=auth.uid() and active;
 if p.id is null then raise exception 'Active account required'; end if;
 select * into b from public.company_billing where organization_id=p.organization_id;
 return jsonb_build_object('owner',p.role='owner','status',coalesce(b.status,'unsubscribed'),'plan',b.plan,'expires_at',b.expires_at,'will_renew',coalesce(b.will_renew,false),'internal_access',coalesce(b.internal_access,false),'access',coalesce(b.internal_access or (b.status in ('trialing','active') and b.expires_at>now()),false));
end $$;
revoke all on function public.company_billing_context() from public,anon;
grant execute on function public.company_billing_context() to authenticated;
create or replace function public.company_billing_identity() returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.profiles%rowtype; result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into p from public.profiles where id=auth.uid() and active and role='owner';
 if p.id is null then raise exception 'Only an active owner may manage company billing'; end if;
 perform 1 from public.organizations where id=p.organization_id for update;
 insert into public.company_billing(organization_id) values(p.organization_id) on conflict do nothing;
 select customer_id into result from public.company_billing where organization_id=p.organization_id;
 return result;
end $$;
revoke all on function public.company_billing_identity() from public,anon;
grant execute on function public.company_billing_identity() to authenticated;

-- Remove anonymous access to authenticated helpers; trigger functions need no client execution.
revoke execute on function public.has_feature_permission(text),public.move_daily_report(uuid,uuid),public.move_daily_report(uuid,uuid,date) from public,anon;
grant execute on function public.has_feature_permission(text),public.move_daily_report(uuid,uuid),public.move_daily_report(uuid,uuid,date) to authenticated;
revoke execute on function public.invalidate_daily_pdf_on_report_edit(),public.invalidate_report_pdfs_for_child(),public.invalidate_report_pdfs_for_manpower(),public.invalidate_weekly_pdf_on_daily_change() from public,anon,authenticated;

create table if not exists public.release_controls (
 id boolean primary key default true check(id), billing_enforced boolean not null default false
);
insert into public.release_controls(id) values(true) on conflict do nothing;
alter table public.release_controls enable row level security;
revoke all on public.release_controls from public,anon,authenticated;
grant all on public.release_controls to service_role;
create or replace function public.company_access_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and (
 not coalesce((select billing_enforced from public.release_controls where id),true)
 or exists(select 1 from public.company_billing b where b.organization_id=p.organization_id and (b.internal_access or (b.status in ('trialing','active') and b.expires_at>now())))
 ))
$$;
revoke all on function public.company_access_allowed() from public,anon;
grant execute on function public.company_access_allowed() to authenticated;
-- Restrictive policies are ANDed with existing tenant/role policies; never replace them.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename not in ('profiles','organizations','company_billing','account_deletion_requests','release_controls') loop
  execute format('drop policy if exists hamit_subscription_access on public.%I',t.tablename);
  execute format('create policy hamit_subscription_access on public.%I as restrictive for all to authenticated using ((select public.company_access_allowed())) with check ((select public.company_access_allowed()))',t.tablename);
 end loop;
end $$;
drop policy if exists hamit_subscription_storage on storage.objects;
create policy hamit_subscription_storage on storage.objects as restrictive for all to authenticated using((select public.company_access_allowed())) with check((select public.company_access_allowed()));
-- A company admin cannot promote themselves to owner or move any account to a new tenant.
create or replace function public.guard_profile_authority() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if auth.role()='authenticated' then
  if new.organization_id is distinct from old.organization_id then raise exception 'Company reassignment is not allowed'; end if;
  if (new.role='owner' or old.role='owner') and (new.role is distinct from old.role or new.active is distinct from old.active) and not exists(select 1 from public.profiles where id=auth.uid() and organization_id=old.organization_id and role='owner' and active) then raise exception 'Only an active owner can change owner access'; end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_profile_authority() from public,anon,authenticated;
drop trigger if exists hamit_guard_profile_authority on public.profiles;
create trigger hamit_guard_profile_authority before update on public.profiles for each row execute function public.guard_profile_authority();

commit;
