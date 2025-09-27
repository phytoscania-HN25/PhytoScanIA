// src/api/detecciones.js
import { supabase } from '../lib/supabaseClient.js';

/** Inserta una detección en la nueva BD */
export async function guardarDeteccion({
  id_usuario,
  id_amenaza_detectada,
  id_municipio,
  latitud,
  longitud,
  precision_gps,
  fecha_hora_scan = new Date().toISOString(),
  id_imagen_scan = null,
  confianza_ia = null,
  modo_diagnostico = 'online', // 'online' | 'offline' | 'prueba'
  estado_validacion = 'pendiente', // 'pendiente' | 'validado' | 'rechazado'
  id_verificador = null,
  notas_usuario = ''
}) {
  const { data, error } = await supabase
    .from('Detecciones_Campo')
    .insert([{
      id_usuario, id_amenaza_detectada, id_municipio,
      latitud, longitud, precision_gps,
      fecha_hora_scan, id_imagen_scan, confianza_ia,
      modo_diagnostico, estado_validacion, id_verificador, notas_usuario
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Lista detecciones con joins mínimos para mapa/historial */
export async function listarDetecciones({ limit = 100, offset = 0 }) {
  const { data, error } = await supabase
    .from('Detecciones_Campo')
    .select(`
      id_deteccion, fecha_hora_scan, latitud, longitud, confianza_ia, modo_diagnostico, estado_validacion, notas_usuario,
      Amenazas: id_amenaza_detectada ( id_amenaza, nombre_comun, nombre_cientifico ),
      Municipios: id_municipio ( id_municipio, nombre_municipio, Departamentos: id_depto ( id_depto, nombre_depto ) ),
      Imagen: id_imagen_scan ( id_imagen, url )
    `)
    .order('fecha_hora_scan', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}
