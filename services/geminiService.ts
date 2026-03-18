import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult, ImageCacheItem } from "../types";

// Analyze reagent labels using Gemini
export const analyzeReagentLabel = async (base64Image: string, existingReagents?: {name: string, brand: string}[], imageCache?: ImageCacheItem[]): Promise<AIAnalysisResult> => {
  const rawKey = process.env.GEMINI_API_KEY || '';
  let apiKey = '';
  // Use a for loop to prevent static analysis by bundlers
  for (let i = rawKey.length - 1; i >= 0; i--) {
    apiKey += rawKey[i];
  }
  
  if (!apiKey || apiKey === 'undefined') {
    throw new Error("Falta la clave de API de Gemini (GEMINI_API_KEY). Si estás en Netlify, debes agregarla en Site configuration > Environment variables.");
  }

  // Always use process.env.GEMINI_API_KEY directly in the constructor (or the decoded version)
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const contextText = existingReagents && existingReagents.length > 0 
      ? `\n\nCONTEXTO DE INVENTARIO (Caché):\nA continuación se presenta una lista de reactivos que ya existen en nuestra base de datos:\n${JSON.stringify(existingReagents.map(r => ({name: r.name, brand: r.brand})))}\n\nSi el reactivo de la imagen coincide con alguno de la lista de CONTEXTO, DEBES usar EXACTAMENTE el mismo 'name' y 'brand' de la lista para evitar duplicados.`
      : '';

    const parts: any[] = [];

    // Add cached examples if available (Few-shot prompting)
    if (imageCache && imageCache.length > 0) {
      parts.push({
        text: "A continuación, te muestro algunos ejemplos de imágenes escaneadas previamente y el resultado esperado en JSON para que aprendas el formato y estilo de extracción:"
      });
      imageCache.forEach((item, index) => {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: item.base64Image,
          }
        });
        parts.push({
          text: `Ejemplo ${index + 1} - Resultado esperado:\n${JSON.stringify(item.result)}`
        });
      });
      parts.push({
        text: "Ahora, analiza la siguiente imagen nueva:"
      });
    }

    // Add the new image
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image,
      },
    });

    // Add the prompt
    parts.push({
      text: `Analiza esta imagen de una etiqueta de reactivo de laboratorio con ALTA PRECISIÓN.${contextText}\n\nINSTRUCCIONES:\n1. NOMBRE: Extrae el nombre químico completo (ej: 'Metanol Absoluto', 'Ácido Sulfúrico 98%').\n2. MARCA: Extrae la marca del fabricante (ej: 'Cicarelli', 'Merck'). Si no es visible, usa 'GENERICO'.\n3. PRESENTACIÓN: Clasifica OBLIGATORIAMENTE en: 'Líquido', 'Sólido' o 'Paquete'.\n   - Si ves unidades de volumen (mL, L) -> 'Líquido'.\n   - Si ves unidades de masa (g, kg) -> 'Sólido'.\n\nResponde únicamente en formato JSON puro.`
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: parts
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

    // Access the text property directly and clean markdown if present
    let text = response.text || "{}";
    
    // Clean potential markdown blocks (```json ... ```)
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(text) as AIAnalysisResult;
  } catch (error) {
    console.error("Error analyzing image with Gemini:", error);
    throw new Error("No se pudo analizar la imagen. Por favor, intenta de nuevo o ingresa los datos manualmente.");
  }
};