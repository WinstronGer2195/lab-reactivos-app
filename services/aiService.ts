import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { AIAnalysisResult, ImageCacheItem } from "../types";

const STORAGE_KEY_GEMINI = 'reagentflow_gemini_key';

const getEnvVar = (name: string): string => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
      // @ts-ignore
      return import.meta.env[name];
    }
  } catch (e) {}
  try {
    if (process.env[name]) return process.env[name] as string;
  } catch (e) {}
  return '';
};

// Lee la API key priorizando: localStorage (configurada en app) → variables de entorno
const getGeminiKey = (): string => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_GEMINI);
    if (stored && stored.length > 10) return stored;
  } catch (_) {}
  return getEnvVar('VITE_GEMINI_API_KEY') || getEnvVar('VITE_API_KEY') || getEnvVar('GEMINI_API_KEY') || getEnvVar('API_KEY');
};

const PROMPT = (contextText: string) => `Analiza esta imagen de una etiqueta de reactivo de laboratorio con ALTA PRECISIÓN.${contextText}

INSTRUCCIONES — extrae estos campos:
1. name: Nombre químico completo (ej: "Metanol Absoluto", "Ácido Sulfúrico 98%"). En mayúsculas.
2. brand: Marca del fabricante (ej: "CICARELLI", "MERCK"). Si no es visible, usa "GENERICO". En mayúsculas.
3. presentation: Clasifica OBLIGATORIAMENTE como "Líquido", "Sólido" o "Paquete".
   - Unidades de volumen (mL, L, uL) → "Líquido"
   - Unidades de masa (g, kg, mg) → "Sólido"
   - Sin unidad de medida o unidades sueltas → "Paquete"
4. lot: Número de lote. Puede aparecer como "Lot:", "Lote:", "L/N:", "Batch:", "B/N:" seguido de un código alfanumérico. Devuelve null si no está visible.
5. expiryDate: Fecha de vencimiento. Puede aparecer como "Exp:", "Vto:", "VTO:", "EXP:", "Use by:", "Vence:" seguido de una fecha. NORMALIZA SIEMPRE a formato YYYY-MM-DD. Si solo hay mes/año (ej: "12/2026"), usa el último día del mes (ej: "2026-12-31"). Devuelve null si no está visible.

Responde únicamente en formato JSON puro con las claves: name, brand, presentation, lot, expiryDate.`;

const analyzeWithGemini = async (base64Image: string, prompt: string, modelName: string, apiKey: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: modelName,
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name:         { type: Type.STRING },
          brand:        { type: Type.STRING },
          presentation: { type: Type.STRING, description: "Must be 'Líquido', 'Sólido', or 'Paquete'" },
          lot:          { type: Type.STRING },
          expiryDate:   { type: Type.STRING }
        },
        required: ["name", "brand", "presentation"]
      }
    }
  });
  return response?.text || "{}";
};

const analyzeWithOpenAI = async (base64Image: string, prompt: string, apiKey: string): Promise<string> => {
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
      ]
    }],
    response_format: { type: "json_object" }
  });
  return response.choices[0].message.content || "{}";
};

const analyzeWithAnthropic = async (base64Image: string, prompt: string, apiKey: string): Promise<string> => {
  const anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Image } },
        { type: "text", text: prompt + "\n\nResponde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, con las claves: name, brand, presentation, lot, expiryDate." }
      ]
    }]
  });
  // @ts-ignore
  return response.content[0].text || "{}";
};

export const analyzeReagentLabel = async (
  base64Image: string,
  existingReagents?: { name: string; brand: string }[],
  imageCache?: ImageCacheItem[]
): Promise<AIAnalysisResult> => {
  const geminiApiKey = getGeminiKey();
  const openaiApiKey  = getEnvVar('VITE_OPENAI_API_KEY');
  const anthropicApiKey = getEnvVar('VITE_ANTHROPIC_API_KEY');

  if (!geminiApiKey && !openaiApiKey && !anthropicApiKey) {
    throw new Error(
      "No hay clave de API configurada. Ve a Configuración → Inteligencia Artificial e ingresa tu clave de Gemini (gratuita en aistudio.google.com)."
    );
  }

  const contextText = existingReagents && existingReagents.length > 0
    ? `\n\nCONTEXTO DE INVENTARIO (evitar duplicados):\n${JSON.stringify(existingReagents.map(r => ({ name: r.name, brand: r.brand })))}\nSi el reactivo coincide exactamente con uno de la lista, usa ese mismo 'name' y 'brand'.`
    : '';

  const prompt = PROMPT(contextText);

  const providers = [];

  if (geminiApiKey) {
    // Modelos disponibles en v1beta (API key de aistudio.google.com)
    providers.push({ name: 'Gemini 2.0 Flash',       fn: () => analyzeWithGemini(base64Image, prompt, 'gemini-2.0-flash',                   geminiApiKey) });
    providers.push({ name: 'Gemini 2.0 Flash Lite',  fn: () => analyzeWithGemini(base64Image, prompt, 'gemini-2.0-flash-lite',               geminiApiKey) });
    providers.push({ name: 'Gemini 1.5 Flash',       fn: () => analyzeWithGemini(base64Image, prompt, 'gemini-1.5-flash-latest',             geminiApiKey) });
  }
  if (openaiApiKey) {
    providers.push({ name: 'OpenAI GPT-4o-mini', fn: () => analyzeWithOpenAI(base64Image, prompt, openaiApiKey) });
  }
  if (anthropicApiKey) {
    providers.push({ name: 'Claude Haiku', fn: () => analyzeWithAnthropic(base64Image, prompt, anthropicApiKey) });
  }

  let lastError: any = null;

  for (const provider of providers) {
    try {
      console.log(`Intentando analizar con ${provider.name}...`);
      let text = await provider.fn();
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      const result = JSON.parse(text) as AIAnalysisResult;
      if (result.name && result.brand && result.presentation) {
        console.log(`Análisis exitoso con ${provider.name}:`, result);
        return result;
      }
    } catch (error: any) {
      const msg = (error?.message || JSON.stringify(error) || '').toLowerCase();
      // Errores de cuenta/créditos: skip al siguiente proveedor sin guardar como error fatal
      if (msg.includes('credit') || msg.includes('insufficient') || msg.includes('billing') || msg.includes('quota')) {
        console.warn(`${provider.name} sin créditos/cuota, saltando al siguiente...`);
        continue;
      }
      console.warn(`Fallo con ${provider.name}:`, error.message || error);
      lastError = error;
    }
  }

  const errorString = lastError instanceof Error ? lastError.message : JSON.stringify(lastError);

  if (errorString.includes('503') || errorString.includes('UNAVAILABLE') || errorString.includes('429')) {
    throw new Error("Los servidores de IA están saturados. Reintenta en unos segundos.");
  }
  if (errorString.includes('401') || errorString.includes('API_KEY_INVALID') || errorString.includes('API key not valid')) {
    throw new Error("La clave de API de Gemini es inválida. Ve a Configuración → Inteligencia Artificial y corrígela.");
  }

  throw new Error(`Error de análisis tras intentar con múltiples IA: ${errorString}`);
};
