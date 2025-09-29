// Diagnóstico con ChatGPT (visión) - uso en módulo ONLINE
// NOTA: En CRA, REACT_APP_OPENAI_API_KEY queda expuesta en el frontend.
// Para producción, usa un backend/función serverless como proxy.

const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;

/**
 * Llama a ChatGPT con una imagen (data URL) y obtiene un diagnóstico en JSON.
 * @param {Object} opts
 * @param {string} opts.dataUrl - Data URL de la imagen (base64)
 * @param {Object} [opts.location] - { latitude, longitude }
 * @param {string} [opts.crop] - Tipo de cultivo, ej. 'frijol'
 * @returns {Promise<Object>} structured result
 */
export async function diagnoseImageWithAI({ dataUrl, location, crop='frijol' }) {
  if (!OPENAI_API_KEY) throw new Error('Falta REACT_APP_OPENAI_API_KEY en .env.local');

  const payload = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Eres un fitopatólogo. A partir de una imagen del cultivo, identifica plagas o enfermedades probables y devuelve JSON estricto con: type ('Plaga'|'Enfermedad'|'Saludable'), name, confidence (0..1), stage (si es observable), recommendation (texto breve), treatment { natural: string[], chemical: string[] }. Considera que el cultivo principal es: " + crop + ". Si la imagen no es clara, devuelve type='Desconocido' con confidence baja.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: `Analiza esta imagen. Ubicación aprox: ${location?.latitude ?? 'N/A'}, ${location?.longitude ?? 'N/A'}` },
          { type: "image_url", image_url: { url: dataUrl } }
        ]
      }
    ],
    temperature: 0.2,
    response_format: { type: "json_object" }
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error("OpenAI error: " + t);
  }
  const data = await res.json();
  let content = data.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { type: "Desconocido", name: "Sin parsear", confidence: 0, recommendation: content, treatment: { natural: [], chemical: [] } };
  }
  // normalizar estructura a la esperada por la UI
  return {
    type: parsed.type || "Desconocido",
    name: parsed.name || "Resultado de IA",
    confidence: parsed.confidence != null ? parsed.confidence : 0,
    stage: parsed.stage || null,
    recommendation: parsed.recommendation || "",
    treatment: parsed.treatment || { natural: [], chemical: [] }
  };
}
