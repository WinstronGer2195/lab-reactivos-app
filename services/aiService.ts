import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { AIAnalysisResult, ImageCacheItem } from "../types";

// Helper to get env variables safely
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

const analyzeWithGemini = async (base64Image: string, prompt: string, modelName: string, apiKey: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: modelName,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          brand: { type: Type.STRING },
          presentation: { 
            type: Type.STRING,
            description: "Must be 'Líquido', 'Sólido', or 'Paquete'"
          }
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
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });
  return response.choices[0].message.content || "{}";
};

const analyzeWithAnthropic = async (base64Image: string, prompt: string, apiKey: string): Promise<string> => {
  const anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: base64Image,
            },
          },
          { type: "text", text: prompt + "\n\nResponde ÚNICAMENTE con un objeto JSON válido, sin texto adicional." }
        ],
      }
    ],
  });
  // @ts-ignore
  return response.content[0].text || "{}";
};

export const analyzeReagentLabel = async (base64Image: string, existingReagents?: {name: string, brand: string}[], imageCache?: ImageCacheItem[]): Promise<AIAnalysisResult> => {
  const geminiApiKey = getEnvVar('VITE_GEMINI_API_KEY') || getEnvVar('VITE_API_KEY') || getEnvVar('GEMINI_API_KEY') || getEnvVar('API_KEY');
  const openaiApiKey = getEnvVar('VITE_OPENAI_API_KEY');
  const anthropicApiKey = getEnvVar('VITE_ANTHROPIC_API_KEY');

  if (!geminiApiKey && !openaiApiKey && !anthropicApiKey) {
    throw new Error("Faltan las claves de API. Configura VITE_GEMINI_API_KEY, VITE_OPENAI_API_KEY o VITE_ANTHROPIC_API_KEY en tu entorno.");
  }

  const contextText = existingReagents && existingReagents.length > 0 
    ? `\n\nCONTEXTO DE INVENTARIO (Caché):\nA continuación se presenta una lista de reactivos que ya existen en nuestra base de datos:\n${JSON.stringify(existingReagents.map(r => ({name: r.name, brand: r.brand})))}\n\nSi el reactivo de la imagen coincide con alguno de la lista de CONTEXTO, DEBES usar EXACTAMENTE el mismo 'name' y 'brand' de la lista para evitar duplicados.`
    : '';

  const prompt = `Analiza esta imagen de una etiqueta de reactivo de laboratorio con ALTA PRECISIÓN.${contextText}\n\nINSTRUCCIONES:\n1. NOMBRE: Extrae el nombre químico completo (ej: 'Metanol Absoluto', 'Ácido Sulfúrico 98%').\n2. MARCA: Extrae la marca del fabricante (ej: 'Cicarelli', 'Merck'). Si no es visible, usa 'GENERICO'.\n3. PRESENTACIÓN: Clasifica OBLIGATORIAMENTE en: 'Líquido', 'Sólido' o 'Paquete'.\n   - Si ves unidades de volumen (mL, L) -> 'Líquido'.\n   - Si ves unidades de masa (g, kg) -> 'Sólido'.\n\nResponde únicamente en formato JSON puro con las claves "name", "brand" y "presentation".`;

  const providers = [];
  
  if (geminiApiKey) {
    providers.push({ name: 'Gemini 3 Flash', fn: () => analyzeWithGemini(base64Image, prompt, 'gemini-3-flash-preview', geminiApiKey) });
    providers.push({ name: 'Gemini 2.5 Flash', fn: () => analyzeWithGemini(base64Image, prompt, 'gemini-2.5-flash', geminiApiKey) });
  }
  if (openaiApiKey) {
    providers.push({ name: 'OpenAI GPT-4o-mini', fn: () => analyzeWithOpenAI(base64Image, prompt, openaiApiKey) });
  }
  if (anthropicApiKey) {
    providers.push({ name: 'Anthropic Claude 3 Haiku', fn: () => analyzeWithAnthropic(base64Image, prompt, anthropicApiKey) });
  }
  if (geminiApiKey) {
    providers.push({ name: 'Gemini 2.5 Pro', fn: () => analyzeWithGemini(base64Image, prompt, 'gemini-2.5-pro', geminiApiKey) });
  }

  let lastError: any = null;

  for (const provider of providers) {
    try {
      console.log(`Intentando analizar con ${provider.name}...`);
      let text = await provider.fn();
      
      // Clean potential markdown blocks (```json ... ```)
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const result = JSON.parse(text) as AIAnalysisResult;
      if (result.name && result.brand && result.presentation) {
        console.log(`Análisis exitoso con ${provider.name}`);
        return result;
      }
    } catch (error: any) {
      console.warn(`Fallo con ${provider.name}:`, error.message || error);
      lastError = error;
      // Continue to the next provider
    }
  }

  console.error("Todos los proveedores de IA fallaron.", lastError);
  
  const errorString = lastError instanceof Error ? lastError.message : JSON.stringify(lastError);
  if (errorString.includes('503') || errorString.includes('high demand') || errorString.includes('UNAVAILABLE') || errorString.includes('429')) {
    throw new Error("Todos los servidores de Inteligencia Artificial están saturados temporalmente. Puedes añadir claves de OpenAI (VITE_OPENAI_API_KEY) o Anthropic (VITE_ANTHROPIC_API_KEY) en las variables de entorno para tener más opciones de respaldo, o reintenta en unos segundos.");
  }
  
  throw new Error(`Error de análisis tras intentar con múltiples IA: ${errorString}`);
};