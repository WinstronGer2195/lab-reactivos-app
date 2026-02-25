import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";

// Analyze reagent labels using Gemini
export const analyzeReagentLabel = async (base64Image: string): Promise<AIAnalysisResult> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === 'undefined') {
    throw new Error("Falta la clave de API de Gemini (GEMINI_API_KEY). Si estás en Netlify, debes agregarla en Site configuration > Environment variables.");
  }

  // Always use process.env.API_KEY directly in the constructor
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: "Analiza esta imagen de una etiqueta de reactivo de laboratorio con ALTA PRECISIÓN.\n\n1. NOMBRE: Extrae el nombre químico completo (ej: 'Metanol Absoluto', 'Ácido Sulfúrico 98%').\n2. MARCA: Extrae la marca del fabricante (ej: 'Cicarelli', 'Merck'). Si no es visible, usa 'GENERICO'.\n3. PRESENTACIÓN: Clasifica OBLIGATORIAMENTE en: 'Líquido', 'Sólido' o 'Paquete'.\n   - Si ves unidades de volumen (mL, L) -> 'Líquido'.\n   - Si ves unidades de masa (g, kg) -> 'Sólido'.\n\nResponde únicamente en formato JSON puro."
          }
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