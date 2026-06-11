import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { AIAnalysisResult } from "../types";

const STORAGE_KEY_GEMINI     = 'reagentflow_gemini_key';
const STORAGE_KEY_ANTHROPIC  = 'reagentflow_anthropic_key';

const getEnvVar = (name: string): string => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.[name]) return import.meta.env[name];
  } catch (_) {}
  try { if (process.env[name]) return process.env[name] as string; } catch (_) {}
  return '';
};

const getStoredKey = (storageKey: string, ...envFallbacks: string[]): string => {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && stored.length > 10) return stored;
  } catch (_) {}
  return envFallbacks.map(getEnvVar).find(v => v) || '';
};

// Reintenta en errores 503/429 con backoff exponencial antes de pasar al siguiente proveedor
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> => {
  let delay = 1500;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      const isTransient = msg.includes('503') || msg.includes('429') || msg.includes('unavailable') || msg.includes('overloaded');
      if (isTransient && attempt < maxRetries) {
        console.warn(`Reintentando en ${delay}ms... (intento ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
  throw new Error('Max retries exceeded');
};

const PROMPT = (contextText: string) => `Analiza esta imagen de una etiqueta de reactivo de laboratorio con ALTA PRECISIÓN.${contextText}

INSTRUCCIONES — extrae estos campos:
1. name: Nombre químico completo EN ESPAÑOL. Si el frasco está en inglés, TRADUCE el nombre (ej: "Methanol" → "METANOL", "Sulfuric Acid" → "ÁCIDO SULFÚRICO", "Sodium Chloride" → "CLORURO DE SODIO"). En MAYÚSCULAS.
2. brand: Marca del fabricante (ej: "CICARELLI", "MERCK", "ANEDRA"). Si no es visible, usa "GENERICO". En MAYÚSCULAS.
3. presentation: Clasifica OBLIGATORIAMENTE como "Líquido", "Sólido" o "Paquete".
   - Unidades de volumen (mL, L, uL) → "Líquido"
   - Unidades de masa (g, kg, mg) → "Sólido"
   - Sin unidad de medida o unidades sueltas → "Paquete"
4. lot: Número de lote. Puede aparecer como "Lot:", "Lote:", "L/N:", "Batch:", "B/N:" seguido de código alfanumérico. String vacío si no está visible.
5. expiryDate: Fecha de vencimiento ("Exp:", "Vto:", "VTO:", "EXP:", "Use by:", "Vence:"). NORMALIZA a YYYY-MM-DD. Si solo hay mes/año (ej: "12/2026") usa el último día del mes (ej: "2026-12-31"). String vacío si no está visible.
6. cas: Número CAS del compuesto. Aparece como "CAS:", "CAS No:", "CAS#" seguido de formato XXXXX-XX-X (ej: "67-56-1", "7647-01-0"). String vacío si no está visible.

Responde ÚNICAMENTE con un objeto JSON válido con las claves: name, brand, presentation, lot, expiryDate, cas.`;

const analyzeWithGemini = async (base64Image: string, prompt: string, modelName: string, apiKey: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Image } }, { text: prompt }] }
  });
  return response?.text || '{}';
};

const analyzeWithOpenAI = async (base64Image: string, prompt: string, apiKey: string): Promise<string> => {
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
    ]}],
    response_format: { type: 'json_object' }
  });
  return response.choices[0].message.content || '{}';
};

const analyzeWithAnthropic = async (base64Image: string, prompt: string, apiKey: string): Promise<string> => {
  const anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
      { type: 'text', text: prompt + '\n\nResponde ÚNICAMENTE con JSON válido: {"name":"...","brand":"...","presentation":"...","lot":"...","expiryDate":"...","cas":"..."}' }
    ]}]
  });
  // @ts-ignore
  return response.content[0].text || '{}';
};

export const analyzeReagentLabel = async (
  base64Image: string,
  existingReagents?: { name: string; brand: string }[]
): Promise<AIAnalysisResult> => {
  const geminiApiKey    = getStoredKey(STORAGE_KEY_GEMINI,    'VITE_GEMINI_API_KEY', 'VITE_API_KEY', 'GEMINI_API_KEY', 'API_KEY');
  const anthropicApiKey = getStoredKey(STORAGE_KEY_ANTHROPIC, 'VITE_ANTHROPIC_API_KEY');
  const openaiApiKey    = getEnvVar('VITE_OPENAI_API_KEY');

  if (!geminiApiKey && !openaiApiKey && !anthropicApiKey) {
    throw new Error('No hay clave de API configurada. Ve a Configuración → Inteligencia Artificial e ingresa tu clave de Gemini (gratuita en aistudio.google.com).');
  }

  const contextText = existingReagents?.length
    ? `\n\nCONTEXTO DE INVENTARIO (evitar duplicados):\n${JSON.stringify(existingReagents.map(r => ({ name: r.name, brand: r.brand })))}\nSi el reactivo coincide exactamente con uno de la lista, usa ese mismo 'name' y 'brand'.`
    : '';

  const prompt = PROMPT(contextText);

  const providers: { name: string; fn: () => Promise<string> }[] = [];

  if (geminiApiKey) {
    providers.push({ name: 'Gemini 2.5 Flash', fn: () => withRetry(() => analyzeWithGemini(base64Image, prompt, 'gemini-2.5-flash', geminiApiKey)) });
    providers.push({ name: 'Gemini 2.0 Flash', fn: () => withRetry(() => analyzeWithGemini(base64Image, prompt, 'gemini-2.0-flash', geminiApiKey)) });
  }
  if (openaiApiKey) {
    providers.push({ name: 'OpenAI GPT-4o-mini', fn: () => withRetry(() => analyzeWithOpenAI(base64Image, prompt, openaiApiKey)) });
  }
  if (anthropicApiKey) {
    providers.push({ name: 'Claude Haiku', fn: () => withRetry(() => analyzeWithAnthropic(base64Image, prompt, anthropicApiKey)) });
  }

  let lastError: any = null;

  for (const provider of providers) {
    try {
      console.log(`Intentando con ${provider.name}...`);
      let text = await provider.fn();
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(text) as AIAnalysisResult;
      if (result.name && result.brand && result.presentation) {
        console.log(`Éxito con ${provider.name}:`, result);
        return result;
      }
    } catch (error: any) {
      const msg = (error?.message || JSON.stringify(error) || '').toLowerCase();
      if (msg.includes('credit') || msg.includes('insufficient') || msg.includes('billing')) {
        console.warn(`${provider.name} sin créditos, saltando...`);
        continue;
      }
      console.warn(`Fallo con ${provider.name}:`, error.message || error);
      lastError = error;
    }
  }

  const errStr = lastError instanceof Error ? lastError.message : JSON.stringify(lastError ?? 'Unknown error');
  if (errStr.toLowerCase().includes('api key') || errStr.includes('401')) {
    throw new Error('La clave de API es inválida. Ve a Configuración → Inteligencia Artificial y corrígela.');
  }
  throw new Error(`Error de análisis: ${errStr}`);
};
