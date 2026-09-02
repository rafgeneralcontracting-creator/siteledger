-- In-app reminders; no email is sent. Times follow RAF's America/New_York workday.
create table public.daily_report_reminders (
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references public.daily_reports(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 sender_id uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(report_id, recipient_id)
);
alter table public.daily_report_reminders enable row level security;
revoke all on public.daily_report_reminders from anon, authenticated;
grant select on public.daily_report_reminders to authenticated;
grant insert (report_id,recipient_id) on public.daily_report_reminders to authenticated;
create policy reminders_read on public.daily_report_reminders for select to authenticated using (
 exists(select 1 from public.daily_reports r where r.id=report_id and public.can_access_project(r.project_id))
 and (recipient_id=auth.uid() or public.current_role() in ('owner','admin','pm','apm'))
);
create policy reminders_send on public.daily_report_reminders for insert to authenticated with check (
 sender_id=auth.uid() and recipient_id<>auth.uid()
 and exists(select 1 from public.profiles s where s.id=auth.uid() and s.active and s.role in ('owner','admin','pm','apm'))
 and (now() at time zone 'America/New_York')::time >= time '15:00'
 and exists (
 select 1 from public.daily_reports r
 join public.projects p on p.id=r.project_id
 join public.project_assignments a on a.project_id=p.id and a.user_id=recipient_id and a.active
 join public.profiles target on target.id=a.user_id and target.active and target.organization_id=p.organization_id
 where r.id=report_id and not r.submitted and p.active
 and p.organization_id=public.current_org_id() and public.can_access_project(p.id)
 and r.log_date=(now() at time zone 'America/New_York')::date
 )
);
