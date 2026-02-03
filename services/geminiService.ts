
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";

// Analyze reagent labels using Gemini
export const analyzeReagentLabel = async (base64Image: string): Promise<AIAnalysisResult> => {
  // Always use process.env.API_KEY directly in the constructor
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
            text: "Analiza esta etiqueta de reactivo de laboratorio. Extrae el nombre del reactivo, la marca y clasifica su presentación como 'Líquido', 'Sólido' o 'Paquete'. Responde únicamente en formato JSON."
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

    // Access the text property directly on the response object
    const text = response.text || "{}";
    return JSON.parse(text) as AIAnalysisResult;
  } catch (error) {
    console.error("Error analyzing image with Gemini:", error);
    throw new Error("No se pudo analizar la imagen. Por favor, intenta de nuevo o ingresa los datos manualmente.");
  }
};
