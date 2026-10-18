create or replace function public.current_org_id() returns uuid language sql stable security definer set search_path=public as $$ select organization_id from public.profiles where id=auth.uid() and active=true $$;
create or replace function public.current_role() returns text language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() and active=true $$;
create or replace function public.has_feature_permission(feature text) returns boolean language plpgsql stable security definer set search_path=public as $$
declare r text; allowed boolean;
begin
select role into r from public.profiles where id=auth.uid() and active=true;
if r is null then return false; end if;
if r in ('owner','admin') then return true; end if;
if feature='daily_reports' then select daily_reports into allowed from public.user_permissions where user_id=auth.uid();
elsif feature='weekly_reports' then select weekly_reports into allowed from public.user_permissions where user_id=auth.uid();
elsif feature='drawings' then select drawings into allowed from public.user_permissions where user_id=auth.uid();
elsif feature='rfis' then select rfis into allowed from public.user_permissions where user_id=auth.uid();
elsif feature='submittals' then select submittals into allowed from public.user_permissions where user_id=auth.uid();
elsif feature='project_edit' then select project_edit into allowed from public.user_permissions where user_id=auth.uid();
elsif feature='project_create' then select project_create into allowed from public.user_permissions where user_id=auth.uid();
elsif feature='manage_team' then select manage_team into allowed from public.user_permissions where user_id=auth.uid();
else allowed:=false; end if;
return coalesce(allowed,false);
end $$;
