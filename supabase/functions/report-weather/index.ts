async function requireResourceAccess(jwt:string,fn:string,args:Record<string,string>){
 const response=await fetch(Deno.env.get('SUPABASE_URL')!+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY')!,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify(args)});
 if(!response.ok||await response.json()!==true)throw new Error('Project access or feature permission denied');
}
async function requireCompanyAccess(jwt:string){
 const response=await fetch(Deno.env.get('SUPABASE_URL')!+'/rest/v1/rpc/company_access_allowed',{method:'POST',headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY')!,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:'{}'});
 if(!response.ok||await response.json()!==true)throw new Error('Active company access required');
}
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const weatherText: Record<number,string> = {
  0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Freezing fog',
  51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Heavy freezing drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Heavy freezing rain',
  71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Light rain showers',81:'Rain showers',82:'Heavy rain showers',
  85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorms',96:'Thunderstorms with hail',99:'Heavy thunderstorms with hail'
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') || '';
    const jwt = auth.replace(/^Bearer\s+/i,'');
    if (!jwt) throw new Error('Missing authorization');

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession:false, autoRefreshToken:false } });
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) throw new Error('Unauthorized');await requireCompanyAccess((req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,''));

    const body = await req.json();
    const reportId = body.report_id;
    if (!reportId) throw new Error('report_id is required');
    await requireResourceAccess(jwt,'can_access_report',{rid:reportId});await requireResourceAccess(jwt,'has_feature_permission',{feature:'daily_reports'});

    const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', userData.user.id).single();
    const { data: report, error: reportErr } = await admin.from('daily_reports').select('*').eq('id', reportId).single();
    if (reportErr || !report) throw new Error('Report not found');
    const { data: project, error: projectErr } = await admin.from('projects').select('*').eq('id', report.project_id).single();
    if (projectErr || !project || !profile || project.organization_id !== profile.organization_id) throw new Error('Access denied');
    if (report.submitted) return new Response(JSON.stringify({ weather:report.weather, high_temp:report.high_temp, low_temp:report.low_temp, locked:true }), { headers:cors });

    let lat = project.latitude ? Number(project.latitude) : null;
    let lon = project.longitude ? Number(project.longitude) : null;
    if (lat == null || lon == null) {
      const q = [project.address, project.city, project.state, project.postal_code].filter(Boolean).join(', ');
      if (!q) throw new Error('Add the project address before using automatic weather');
      const geoRes = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q='+encodeURIComponent(q), {
        headers: { 'User-Agent':'SiteLedger/1.0 (construction field reporting)' }
      });
      if (!geoRes.ok) throw new Error('Could not locate project address');
      const geo = await geoRes.json();
      if (!geo?.length) throw new Error('Could not locate project address. Add city/state to the project.');
      lat = Number(geo[0].lat); lon = Number(geo[0].lon);
      await admin.from('projects').update({ latitude:lat, longitude:lon }).eq('id', project.id);
    }

    const date = report.log_date;
    const today = new Date().toISOString().slice(0,10);
    const diff = Math.floor((new Date(today+'T12:00:00Z').getTime()-new Date(date+'T12:00:00Z').getTime())/86400000);
    let endpoint: string;
    if (diff >= 0 && diff <= 90) {
      endpoint = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&past_days=${diff}&forecast_days=1`;
    } else {
      endpoint = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`;
    }
    const wRes = await fetch(endpoint);
    if (!wRes.ok) throw new Error('Weather service is temporarily unavailable');
    const w = await wRes.json();
    const idx = w?.daily?.time?.indexOf(date) ?? -1;
    if (idx < 0) throw new Error('Weather is not available for this report date');
    const code = Number(w.daily.weather_code[idx]);
    const high = Number(w.daily.temperature_2m_max[idx]);
    const low = Number(w.daily.temperature_2m_min[idx]);
    const text = weatherText[code] || 'Weather recorded';
    await admin.from('daily_reports').update({ weather:text, high_temp:high, low_temp:low, updated_at:new Date().toISOString() }).eq('id', reportId);
    return new Response(JSON.stringify({ weather:text, high_temp:high, low_temp:low, latitude:lat, longitude:lon }), { headers:cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status:400, headers:cors });
  }
});
