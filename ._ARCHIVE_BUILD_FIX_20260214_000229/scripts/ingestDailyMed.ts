import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://api.fda.gov/drug/label.json';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

type RawDrug = {
  id?: string;
  set_id?: string;
  openfda?: Record<string, string[]>;
  [key: string]: unknown;
};

type DrugRecord = {
  ndc: string | null;
  brand_name: string | null;
  generic_name: string | null;
  labeler_name: string | null;
  route: string | null;
  dosage_form: string | null;
  fda_id: string | null;
  raw: RawDrug;
};

async function fetchDrugs(search: string, limit = 25): Promise<RawDrug[]> {
  const url = `${BASE_URL}?search=openfda.brand_name:${encodeURIComponent(search)}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FDA API error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as { results?: RawDrug[] };
  return json.results ?? [];
}

function takeFirstValue(values?: string[]) {
  if (!values || values.length === 0) return null;
  return values[0] ?? null;
}

function mapDrug(record: RawDrug): DrugRecord {
  const openfda = record.openfda ?? {};

  return {
    ndc:
      takeFirstValue(openfda.package_ndc) ??
      takeFirstValue(openfda.product_ndc),
    brand_name: takeFirstValue(openfda.brand_name),
    generic_name: takeFirstValue(openfda.generic_name),
    labeler_name: takeFirstValue(openfda.manufacturer_name),
    route: takeFirstValue(openfda.route),
    dosage_form: takeFirstValue(openfda.dosage_form),
    fda_id: record.id ?? record.set_id ?? null,
    raw: record,
  };
}

async function ingest(search: string) {
  console.log(`Fetching DailyMed records for "${search}"…`);
  const drugs = await fetchDrugs(search, 50);
  const mapped = drugs.map(mapDrug);

  if (mapped.length === 0) {
    console.warn('No results returned for this search term.');
    return;
  }

  const { error } = await supabase
    .from('drug_catalog')
    .upsert(mapped, { onConflict: 'fda_id' });

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  console.log(`Upserted ${mapped.length} records into drug_catalog.`);
}

const term = process.argv[2] ?? 'ibuprofen';

ingest(term).catch((error) => {
  console.error(error);
  process.exit(1);
});


