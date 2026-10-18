-- Run after schema DDL in the SAME rollback-only transaction. No live accounts are altered.
do $$
declare u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid(); oid uuid; request_id uuid; denied boolean:=false;
begin
 insert into auth.users(id,email,raw_user_meta_data,created_at,updated_at) values(u,'hamit-release-test-'||u||'@example.invalid',jsonb_build_object('full_name','Synthetic owner','company_name','Synthetic release QA'),now(),now());
 select organization_id into oid from public.profiles where id=u;
 insert into auth.users(id,email,raw_user_meta_data,created_at,updated_at) values(v,'hamit-release-test-'||v||'@example.invalid','{}',now(),now());
 insert into public.profiles(id,organization_id,full_name,role,active) values(v,oid,'Synthetic admin','admin',true);
 insert into auth.sessions(id,user_id,created_at,updated_at) values(sid,u,now(),now());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',sid)::text,true);
 execute 'set local role authenticated';
 request_id:=(public.request_account_deletion('account')->>'id')::uuid;
 if (public.request_account_deletion('account')->>'id')::uuid<>request_id then raise exception 'Duplicate deletion request created'; end if;
 if (select count(*) from public.account_deletion_requests)<>1 then raise exception 'Deletion RLS isolation failed'; end if;
 perform public.company_billing_identity();
 if (public.company_billing_context()->>'access')::boolean then raise exception 'Unpaid company was granted a subscription'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from public.account_deletion_requests) then raise exception 'Foreign deletion request leaked'; end if;
 begin perform public.company_billing_identity(); exception when others then denied:=true; end;
 if not denied then raise exception 'Admin can control owner billing identity'; end if;
 denied:=false;
 begin update public.profiles set role='owner' where id=v; exception when others then denied:=true; end;
 if not denied then raise exception 'Admin can promote themselves to owner'; end if;
 execute 'reset role';
 update public.release_controls set billing_enforced=true;
 if public.company_access_allowed() then raise exception 'Unpaid access gate failed'; end if;
 update public.company_billing set status='active',plan='team',expires_at=now()+interval '1 day' where organization_id=oid;
 if not public.company_access_allowed() then raise exception 'Paid active access failed'; end if;
 update public.profiles set active=false where id=v;
 if public.company_access_allowed() then raise exception 'Disabled user regained access'; end if;
 if has_function_privilege('anon','public.request_account_deletion(text)','EXECUTE') then raise exception 'Anonymous deletion RPC accessible'; end if;
 if has_table_privilege('authenticated','public.company_billing','UPDATE') then raise exception 'Clients can set billing entitlements'; end if;
 raise notice 'PASS deletion request isolation/idempotency, billing ownership, role escalation, paid/expired/disabled access';
end $$;

do $$
declare u uuid:=gen_random_uuid(); oid uuid; denied boolean:=false; i integer;
begin
 insert into auth.users(id,email,raw_user_meta_data,created_at,updated_at) values(u,'hamit-quota-test-'||u||'@example.invalid',jsonb_build_object('full_name','Quota test','company_name','Synthetic quota QA'),now(),now());
 select organization_id into oid from public.profiles where id=u;
 insert into public.company_billing(organization_id,status,plan,expires_at) values(oid,'active','starter',now()+interval '1 day');
 update public.release_controls set billing_enforced=true;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 for i in 1..3 loop insert into public.projects(organization_id,name) values(oid,'Synthetic project '||i); end loop;
 begin insert into public.projects(organization_id,name) values(oid,'Over-limit project'); exception when others then denied:=true; end;
 if not denied then raise exception 'Project quota not enforced'; end if;
 if public.company_storage_allows_upload(26000000000) then raise exception 'Storage limit not enforced'; end if;
 for i in 1..20 loop perform public.consume_company_ai_scan(); end loop;
 denied:=false;begin perform public.consume_company_ai_scan(); exception when others then denied:=true;end;
 if not denied then raise exception 'AI quota not enforced';end if;
 execute 'reset role';
 raise notice 'PASS Starter project/storage/AI quotas';
end $$;
