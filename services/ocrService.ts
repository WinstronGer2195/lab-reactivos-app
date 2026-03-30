import Tesseract from 'tesseract.js';
import { Reagent } from '../types';

export const findReagentInImageLocally = async (
  base64Image: string, 
  existingReagents: Reagent[]
): Promise<{ name: string; brand: string; presentation: string } | null> => {
  try {
    // Convert base64 to a format Tesseract can use (data URI)
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;
    
    // Run OCR
    const { data: { text } } = await Tesseract.recognize(
      dataUrl,
      'spa+eng', // Spanish and English
      { logger: m => console.log(m) }
    );
    
    const lowerText = text.toLowerCase();
    console.log("Extracted text from image:", lowerText);

    // Try to find an exact match (name + brand)
    for (const reagent of existingReagents) {
      const nameMatch = lowerText.includes(reagent.name.toLowerCase());
      const brandMatch = lowerText.includes(reagent.brand.toLowerCase());
      
      if (nameMatch && brandMatch) {
        console.log(`Found exact match locally: ${reagent.name} (${reagent.brand})`);
        return {
          name: reagent.name,
          brand: reagent.brand,
          presentation: reagent.presentation
        };
      }
    }

    // If no exact match, try to find just the name
    for (const reagent of existingReagents) {
      if (lowerText.includes(reagent.name.toLowerCase())) {
        console.log(`Found name match locally: ${reagent.name}`);
        return {
          name: reagent.name,
          brand: reagent.brand,
          presentation: reagent.presentation
        };
      }
    }

    return null; // No match found
  } catch (error) {
    console.error("Local OCR failed:", error);
    return null;
  }
};
