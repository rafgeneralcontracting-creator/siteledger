async function requireResourceAccess(jwt:string,fn:string,args:Record<string,string>){
 const response=await fetch(Deno.env.get('SUPABASE_URL')!+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY')!,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify(args)});
 if(!response.ok||await response.json()!==true)throw new Error('Project access or feature permission denied');
}
async function requireCompanyAccess(jwt:string){
 const response=await fetch(Deno.env.get('SUPABASE_URL')!+'/rest/v1/rpc/company_access_allowed',{method:'POST',headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY')!,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:'{}'});
 if(!response.ok||await response.json()!==true)throw new Error('Active company access required');
}
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const clean=(v:any)=>v==null?'':String(v).normalize('NFKC').replace(/[‐‑‒–—―]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/…/g,'...').replace(/°/g,' deg').replace(/[^\x20-\x7E\n\r\t]/g,'?');
function wrap(t:any,max=88){const w=clean(t).replace(/\s+/g,' ').trim().split(' ').filter(Boolean),o:string[]=[];let c='';for(const x of w){const n=c?c+' '+x:x;if(n.length>max&&c){o.push(c);c=x}else c=n}if(c)o.push(c);return o.length?o:['-']}
function addDays(s:string,n:number){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function safeName(v:any){return clean(v).trim().replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')||'Project'}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});try{
 const auth=req.headers.get('Authorization')||'',jwt=auth.replace(/^Bearer\s+/i,''); if(!jwt)throw new Error('Missing authorization');
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:u,error:ue}=await admin.auth.getUser(jwt); if(ue||!u.user)throw new Error('Unauthorized');await requireCompanyAccess((req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,''));
 const {project_id,week_start}=await req.json(); if(!project_id||!week_start)throw new Error('project_id and week_start are required'); await requireResourceAccess(jwt,'can_access_project',{pid:project_id});await requireResourceAccess(jwt,'has_feature_permission',{feature:'weekly_reports'});const week_end=addDays(week_start,4);
 const {data:profile}=await admin.from('profiles').select('organization_id,full_name').eq('id',u.user.id).single();
 const {data:p}=await admin.from('projects').select('*').eq('id',project_id).single(); if(!profile||!p||p.organization_id!==profile.organization_id)throw new Error('Access denied');
 const {data:o}=await admin.from('organizations').select('*').eq('id',p.organization_id).single();
 const {data:days}=await admin.from('daily_reports').select('*').eq('project_id',project_id).gte('log_date',week_start).lte('log_date',week_end).eq('submitted',true).order('log_date');
 if(!days?.length)throw new Error('No submitted Daily Reports for this week yet.');
 const ids=days.map((d:any)=>d.id);
 const [{data:mp},{data:dl},{data:iss},{data:ph}]=await Promise.all([
   admin.from('manpower').select('*').in('daily_report_id',ids),
   admin.from('deliveries').select('*').in('daily_report_id',ids),
   admin.from('issues').select('*').in('daily_report_id',ids),
   admin.from('photos').select('*').in('daily_report_id',ids).eq('client_visible',true).order('uploaded_at')
 ]);
 const pdf=await PDFDocument.create(),bold=await pdf.embedFont(StandardFonts.HelveticaBold),reg=await pdf.embedFont(StandardFonts.Helvetica),navy=rgb(.06,.1,.18),gray=rgb(.4,.44,.52),blue=rgb(.15,.37,.99),line=rgb(.88,.9,.94);let page:any,y=0;
 const newPage=()=>{page=pdf.addPage([612,792]);y=744;page.drawText(clean(o?.name||'Company'),{x:420,y:754,size:9,font:bold,color:navy});page.drawLine({start:{x:42,y:742},end:{x:570,y:742},thickness:1,color:line})};
 const need=(h:number)=>{if(y-h<55)newPage()}; const section=(t:string)=>{need(30);y-=8;page.drawText(clean(t).toUpperCase(),{x:42,y,size:9,font:bold,color:blue});y-=15}; const para=(t:any)=>{for(const ln of wrap(t)){need(15);page.drawText(ln,{x:42,y,size:10,font:reg,color:navy});y-=14}y-=3};
 newPage(); page.drawText('WEEKLY FIELD REPORT',{x:42,y:702,size:21,font:bold,color:navy}); page.drawText(clean(p.name),{x:42,y:676,size:14,font:bold,color:navy}); page.drawText(clean(p.address||''),{x:42,y:658,size:10,font:reg,color:gray}); page.drawText(`${week_start} through ${week_end}`,{x:42,y:638,size:11,font:bold,color:navy}); y=610;
 const totalWorkers=(mp||[]).reduce((a:number,m:any)=>a+Number(m.worker_count||0),0); section('Week at a Glance'); para(`${days.length} submitted Daily Report${days.length===1?'':'s'} included. Total reported manpower count: ${totalWorkers}.`);
 for(const d of days){ section(new Date(d.log_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})); if(d.no_work_today){para('No work occurred on site.');continue;} para(d.work_performed||'No work description entered.'); const dmp=(mp||[]).filter((x:any)=>x.daily_report_id===d.id); if(dmp.length)para('Manpower: '+dmp.map((m:any)=>`${m.company?m.company+' - ':''}${m.trade} - ${m.worker_count||0} workers`).join('; ')); if(d.delays_impacts)para('Delays / Impacts: '+d.delays_impacts); if(d.visitors_inspections)para('Visitors / Inspections: '+d.visitors_inspections); if(d.safety_notes)para('Safety: '+d.safety_notes); const dd=(dl||[]).filter((x:any)=>x.daily_report_id===d.id); if(dd.length)para('Deliveries: '+dd.map((x:any)=>`${x.vendor||'Delivery'} ${x.material_equipment||''}`).join('; ')); const di=(iss||[]).filter((x:any)=>x.daily_report_id===d.id); if(di.length)para('Issues: '+di.map((x:any)=>`${x.type||'Issue'}: ${x.description||''}`).join('; ')); }
 if(ph?.length){section('Progress Photos');let col=0;for(const pic of ph){try{const {data:signed,error:signedErr}=await admin.storage.from('report-photos').createSignedUrl(pic.storage_path,300,{transform:{width:1000,height:750,resize:'contain',quality:55}});if(signedErr||!signed?.signedUrl)continue;const resp=await fetch(signed.signedUrl);if(!resp.ok)continue;const bytes=new Uint8Array(await resp.arrayBuffer());let img:any=null;try{img=await pdf.embedJpg(bytes)}catch(_){try{img=await pdf.embedPng(bytes)}catch(__){}}if(!img)continue;if(col===0)need(210);const sc=Math.min(245/img.width,150/img.height,1),w=img.width*sc,h=img.height*sc,x=42+col*270;page.drawImage(img,{x,y:y-h,width:w,height:h});page.drawText(clean(pic.caption||'Progress photo').slice(0,48),{x,y:y-h-14,size:8,font:reg,color:gray});col++;if(col===2){y-=190;col=0}}catch(_){}}if(col===1)y-=190;}
 section('Certification'); para(`Automatically compiled from submitted Daily Reports for ${p.name}.`);
 const bytes=await pdf.save(),fileName=`${safeName(p.name)}-${week_start}-Weekly-Report.pdf`,path=`weekly/${project_id}/${fileName}`; const {error:up}=await admin.storage.from('report-pdfs').upload(path,bytes,{contentType:'application/pdf',upsert:true}); if(up)throw up;
 const now=new Date().toISOString(); const {data:wr,error:wre}=await admin.from('weekly_reports').upsert({project_id,week_start,week_end,prepared_by:u.user.id,submitted:true,submitted_at:now,pdf_path:path,generated_at:now,updated_at:now},{onConflict:'project_id,week_start'}).select().single(); if(wre)throw wre;
 return new Response(JSON.stringify({weekly_report:wr,pdf_path:path,file_name:fileName}),{headers:cors});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:String(e)}),{status:400,headers:cors})}});
