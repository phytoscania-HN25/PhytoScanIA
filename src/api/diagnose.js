import { supabase } from "../lib/supabaseClient";

// Guarda diagnóstico en la tabla `detecciones_campo`
export async function saveDiagnosis({
  usuarioId,
  amenazaId,
  ubicacion,
  imagenId,
  confianzaIA,
  modoDiagnostico = "IA",
  notasUsuario = ""
}) {
  try {
    const { data, error } = await supabase.from("detecciones_campo").insert([
      {
        usuario_id: usuarioId,
        amenaza_detectada_id: amenazaId,
        ubicacion,              // 👈 ahora va en un solo campo (ej. { lat: 12.34, lng: -86.22 })
        imagen_scan_id: imagenId,
        confianza_ia: confianzaIA,
        modo_diagnostico: modoDiagnostico,
        notas_usuario: notasUsuario,
      }
    ]).select();

    if (error) throw error;
    return data[0];
  } catch (err) {
    console.error("❌ Error guardando diagnóstico:", err);
    throw new Error("No se pudo guardar el diagnóstico en la base de datos.");
  }
}
