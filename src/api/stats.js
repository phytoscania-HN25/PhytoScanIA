// src/api/stats.js
import { supabase } from '../lib/supabaseClient.js';

export async function getStatsPorDia() {
  const { data, error } = await supabase.from('v_stats_por_dia').select('*').order('dia', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getStatsPorAmenaza() {
  const { data, error } = await supabase.from('v_stats_por_amenaza').select('*').order('total', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getStatsPorDepartamento() {
  const { data, error } = await supabase.from('v_stats_por_departamento').select('*').order('total', { ascending: false });
  if (error) throw error;
  return data;
}
