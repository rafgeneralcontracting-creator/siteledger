begin;
create table if not exists public.company_ai_usage (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 period_key text not null, attempts integer not null default 0 check(attempts>=0),
 primary key(organization_id,period_key)
);
alter table public.company_ai_usage enable row level security;
revoke all on public.company_ai_usage from public,anon,authenticated;
grant all on public.company_ai_usage to service_role;
create or replace function public.consume_company_ai_scan() returns integer
language plpgsql security definer set search_path = '' as $$
declare oid uuid; b public.company_billing%rowtype; maximum integer; period text; used integer;
begin
 if not public.company_access_allowed() or not public.has_feature_permission('daily_reports') then raise exception 'Active daily-report access required'; end if;
 select organization_id into oid from public.profiles where id=auth.uid() and active;
 select * into b from public.company_billing where organization_id=oid;
 maximum:=case when b.status='trialing' then 5 when b.plan='starter' then 20 when b.plan='team' then 50 when b.plan='business' then 100 else 20 end;
 if b.internal_access then maximum:=100; end if;
 period:=case when b.status='trialing' then 'trial:'||b.expires_at::text else to_char(now() at time zone 'UTC','YYYY-MM') end;
 insert into public.company_ai_usage(organization_id,period_key,attempts) values(oid,period,1)
 on conflict(organization_id,period_key) do update set attempts=public.company_ai_usage.attempts+1 where public.company_ai_usage.attempts<maximum
 returning attempts into used;
 if used is null then raise exception 'Company AI allowance reached. Contact the owner to change plans.'; end if;
 return maximum-used;
end $$;
revoke all on function public.consume_company_ai_scan() from public,anon;
grant execute on function public.consume_company_ai_scan() to authenticated;

create or replace function public.enforce_company_plan_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare oid uuid; b public.company_billing%rowtype; maximum integer; current_count integer;
begin
 if not coalesce((select billing_enforced from public.release_controls where id),true) then return new; end if;
 oid:=new.organization_id;
 perform 1 from public.organizations where id=oid for update;
 select * into b from public.company_billing where organization_id=oid;
 if b.internal_access then return new; end if;
 if tg_table_name='projects' then
  if not new.active then return new; end if;
  if b.status not in ('trialing','active') or b.expires_at<=now() or b.status is null then raise exception 'An active company subscription is required'; end if;
  maximum:=case when b.status='trialing' then 1 when b.plan='starter' then 3 when b.plan='team' then 10 when b.plan='business' then 25 else 0 end;
  select count(*) into current_count from public.projects where organization_id=oid and active and id<>new.id;
 else
  if not new.active then return new; end if;
  -- Initial owner profile may be created before purchasing. No trial is granted here.
  if new.role='owner' and not exists(select 1 from public.profiles where organization_id=oid) then return new; end if;
  if b.status not in ('trialing','active') or b.expires_at<=now() or b.status is null then raise exception 'An active company subscription is required'; end if;
  maximum:=case when b.status='trialing' then 3 when b.plan='starter' then 5 when b.plan='team' then 15 when b.plan='business' then 30 else 0 end;
  select count(*) into current_count from public.profiles where organization_id=oid and active and id<>new.id;
 end if;
 if current_count>=maximum then raise exception 'Company plan limit reached. Archive a project, remove a seat, or change plans.'; end if;
 return new;
end $$;
revoke all on function public.enforce_company_plan_limits() from public,anon,authenticated;
drop trigger if exists hamit_project_plan_limit on public.projects;
create trigger hamit_project_plan_limit before insert or update of active,organization_id on public.projects for each row execute function public.enforce_company_plan_limits();
drop trigger if exists hamit_member_plan_limit on public.profiles;
create trigger hamit_member_plan_limit before insert or update of active,organization_id on public.profiles for each row execute function public.enforce_company_plan_limits();

-- Quotas inspect metadata read-only; all upload/delete operations remain in the Storage API.
create or replace function public.company_storage_allows_upload(proposed_bytes bigint) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare oid uuid; b public.company_billing%rowtype; maximum bigint; used bigint;
begin
 if not public.company_access_allowed() then return false; end if;
 if not coalesce((select billing_enforced from public.release_controls where id),true) then return true; end if;
 select organization_id into oid from public.profiles where id=auth.uid() and active;
 select * into b from public.company_billing where organization_id=oid;
 if b.internal_access then return true; end if;
 maximum:=(case when b.status='trialing' then 1 when b.plan='starter' then 25 when b.plan='team' then 100 when b.plan='business' then 250 else 0 end)::bigint*1000000000;
 select coalesce(sum((o.metadata->>'size')::bigint),0) into used from storage.objects o where exists(
  select 1 from public.projects p where p.organization_id=oid and (
    split_part(o.name,'/',1)=p.id::text
    or (o.bucket_id='report-pdfs' and split_part(o.name,'/',1) in ('daily','weekly') and split_part(o.name,'/',2)=p.id::text)
    or exists(select 1 from public.daily_reports dr where dr.project_id=p.id and split_part(o.name,'/',1)=dr.id::text)
  )
 );
 -- Reserve a full additional object for replacements; concurrent upload overshoot still needs a reservation service.
 return proposed_bytes is not null and proposed_bytes>=0 and used+proposed_bytes<=maximum;
end $$;
revoke all on function public.company_storage_allows_upload(bigint) from public,anon;
grant execute on function public.company_storage_allows_upload(bigint) to authenticated;
drop policy if exists hamit_storage_plan_insert on storage.objects;
create policy hamit_storage_plan_insert on storage.objects as restrictive for insert to authenticated with check(public.company_storage_allows_upload((metadata->>'size')::bigint));
drop policy if exists hamit_storage_plan_update on storage.objects;
create policy hamit_storage_plan_update on storage.objects as restrictive for update to authenticated using((select public.company_access_allowed())) with check(public.company_storage_allows_upload((metadata->>'size')::bigint));
commit;
