import Tesseract from 'tesseract.js';
import { Reagent } from '../types';

const extractCasFromText = (text: string): string | null => {
  const match = text.match(/cas[:\s#]*(\d{1,7}-\d{2}-\d)/i);
  return match ? match[1] : null;
};

export const findReagentInImageLocally = async (
  base64Image: string,
  existingReagents: Reagent[]
): Promise<{ name: string; brand: string; presentation: string; cas?: string } | null> => {
  try {
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;
    const { data: { text } } = await Tesseract.recognize(dataUrl, 'spa+eng', { logger: m => console.log(m) });
    const lowerText = text.toLowerCase();
    console.log("OCR text:", lowerText);

    // 1. Intentar match por CAS (más confiable)
    const casNumber = extractCasFromText(text);
    if (casNumber) {
      const reagentByCas = existingReagents.find(r => r.cas && r.cas === casNumber);
      if (reagentByCas) {
        console.log(`OCR CAS match: ${casNumber} → ${reagentByCas.name}`);
        return { name: reagentByCas.name, brand: reagentByCas.brand, presentation: reagentByCas.presentation, cas: casNumber };
      }
    }

    // 2. Match por nombre + marca
    for (const reagent of existingReagents) {
      const nameMatch = lowerText.includes(reagent.name.toLowerCase());
      const brandMatch = lowerText.includes(reagent.brand.toLowerCase());
      if (nameMatch && brandMatch) {
        console.log(`OCR nombre+marca match: ${reagent.name} (${reagent.brand})`);
        return { name: reagent.name, brand: reagent.brand, presentation: reagent.presentation, cas: casNumber || undefined };
      }
    }

    // 3. Match solo por nombre
    for (const reagent of existingReagents) {
      if (lowerText.includes(reagent.name.toLowerCase())) {
        console.log(`OCR nombre match: ${reagent.name}`);
        return { name: reagent.name, brand: reagent.brand, presentation: reagent.presentation, cas: casNumber || undefined };
      }
    }

    return null;
  } catch (error) {
    console.error("OCR falló:", error);
    return null;
  }
};
