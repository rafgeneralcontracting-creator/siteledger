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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') || '';
    const jwt = auth.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401);await requireCompanyAccess((req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,''));

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return json({ error: 'AI_READER_NOT_CONFIGURED', message: 'The AI sign-in sheet reader is not configured yet.' }, 503);

    const body = await req.json();
    const imageBase64 = String(body.image_base64 || '').replace(/^data:[^;]+;base64,/, '');
    const mimeType = String(body.mime_type || 'image/jpeg');
    if (!imageBase64) return json({ error: 'Missing image' }, 400);
    if (imageBase64.length > 16*1024*1024) return json({error:'Image is too large (12 MB maximum)'},413);
    if (!mimeType.startsWith('image/')) return json({ error: 'Only image files are supported' }, 400);

    const quota=await fetch(Deno.env.get('SUPABASE_URL')!+'/rest/v1/rpc/consume_company_ai_scan',{method:'POST',headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY')!,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:'{}'});
    if(!quota.ok)return json({error:'Company AI allowance reached or permission denied'},429);
    const prompt = `You are reading a construction daily sign-in sheet from a jobsite. The image may be sideways, rotated, skewed, photographed at an angle, faint, or handwritten. Analyze the full image visually, infer the table structure, and ignore signatures.

Return ONLY valid JSON in exactly this shape:
{"sheet_date":"YYYY-MM-DD or null","sheet_time":"string or null","project":"string or null","rows":[{"name":"string","company":"string or null","date":"YYYY-MM-DD or null","confidence":0.0}]}

Rules:
- Read handwritten names and company names as carefully as possible.
- Ignore signature marks entirely.
- Preserve one object per actual signed-in worker row.
- Do not invent rows from headers or blank lines.
- If a value is unclear, use null or your best cautious reading and lower confidence.
- Normalize obvious dates to YYYY-MM-DD when possible.
- If the same date applies to every row, still repeat it on each row when visible.
- confidence is from 0 to 1 for the row as a whole.
- Do not include commentary, markdown, or code fences.`;

    const openai = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        store: false,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: `data:${mimeType};base64,${imageBase64}` }
          ]
        }],
        max_output_tokens: 1800
      })
    });

    const data = await openai.json();
    if (!openai.ok) {
      return json({ error: 'AI_READER_FAILED', message: data?.error?.message || 'The AI reader could not process this image.' }, 502);
    }

    let text = '';
    if (typeof data.output_text === 'string') text = data.output_text;
    if (!text && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (!Array.isArray(item?.content)) continue;
        for (const c of item.content) if (c?.type === 'output_text' && typeof c?.text === 'string') text += c.text;
      }
    }
    text = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
    if (!text) return json({ error: 'AI_READER_FAILED', message: 'The AI reader returned no text.' }, 502);

    let parsed: any;
    try { parsed = JSON.parse(text); }
    catch { return json({ error: 'AI_READER_FAILED', message: 'The AI reader returned an unreadable result.' }, 502); }

    const rows = Array.isArray(parsed.rows) ? parsed.rows
      .filter((r: any) => r && String(r.name || '').trim())
      .slice(0, 80)
      .map((r: any) => ({
        name: String(r.name || '').trim(),
        company: r.company == null ? null : String(r.company).trim() || null,
        date: r.date == null ? null : String(r.date).trim() || null,
        confidence: Math.max(0, Math.min(1, Number(r.confidence ?? 0.5)))
      })) : [];

    return json({
      sheet_date: parsed.sheet_date ?? null,
      sheet_time: parsed.sheet_time ?? null,
      project: parsed.project ?? null,
      rows,
      reader: 'openai-vision'
    });
  } catch (e) {
    return json({ error: 'AI_READER_FAILED', message: e instanceof Error ? e.message : String(e) }, 400);
  }
});

