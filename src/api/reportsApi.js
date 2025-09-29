import { supabase } from '../lib/supabaseClient.js';

const offlineJsonUrl = '/data/official_reports_ni_2022_2025.json';

export async function getReports({ iso3 = 'NIC', from = '2022-01-01', to = '2025-12-31' } = {}) {
  try {
    if (supabase && typeof navigator !== 'undefined' && navigator.onLine) {
      const { data, error } = await supabase
        .from('v_reports_map')
        .select('*')
        .eq('iso3', iso3)
        .gte('observation_date', from)
        .lte('observation_date', to)
        .order('observation_date', { ascending: true });
      if (error) throw error;
      if (data?.length) return data;
    }
  } catch (e) { console.warn('[reportsApi] fallback offline:', e?.message || e); }
  const resp = await fetch(offlineJsonUrl);
  const json = await resp.json();
  return json.filter(r => r.iso3 === iso3 && r.observation_date >= from && r.observation_date <= to);
}
