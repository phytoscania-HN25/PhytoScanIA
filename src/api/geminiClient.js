// src/api/geminiClient.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_KEY = process.env.REACT_APP_GEMINI_API_KEY;

if (!GEMINI_KEY) {
  console.error("❌ Falta REACT_APP_GEMINI_API_KEY en tu archivo .env.local");
}

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// Usar modelo en API v1 (válido: gemini-1.5-flash o gemini-1.5-pro)
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function askGemini(prompt) {
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error("❌ Error en askGemini:", err);
    return "⚠️ No pude conectar con Gemini (ver consola).";
  }
}
