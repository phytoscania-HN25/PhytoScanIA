import { createClient } from '@supabase/supabase-js';

const url =
  process.env.REACT_APP_SUPABASE_URL ||
  (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : undefined);

const anon =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_ANON_KEY : undefined);

if (!url || !anon) {
  console.warn('⚠️ SUPABASE env vars no definidas. Configura URL y ANON KEY.');
}

export const supabase = (url && anon) ? createClient(url, anon) : null;
