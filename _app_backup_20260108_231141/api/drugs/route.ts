import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('q')?.trim() ?? '';

  let query = supabase
    .from('drug_catalog')
    .select(
      'id, ndc, brand_name, generic_name, labeler_name, dosage_form, route, raw'
    )
    .order('brand_name')
    .limit(50);

  if (search) {
    query = query.or(
      `brand_name.ilike.%${search}%,generic_name.ilike.%${search}%,ndc.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

