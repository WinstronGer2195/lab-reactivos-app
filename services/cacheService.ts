import { SupabaseClient } from '@supabase/supabase-js';
import { AIAnalysisResult } from '../types';

// Genera un hash SHA-256 muestreando inicio, medio y final de la imagen
// (evita procesar imágenes de varios MB completas)
const hashImage = async (base64: string): Promise<string> => {
  const sample =
    base64.slice(0, 8000) +
    base64.slice(Math.floor(base64.length / 2) - 4000, Math.floor(base64.length / 2) + 4000) +
    base64.slice(-8000);
  const data = new TextEncoder().encode(sample);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

export const getCachedResult = async (
  supabase: SupabaseClient,
  base64Image: string
): Promise<AIAnalysisResult | null> => {
  try {
    const hash = await hashImage(base64Image);
    const { data } = await supabase
      .from('image_cache')
      .select('result')
      .eq('hash', hash)
      .maybeSingle();
    return data?.result ?? null;
  } catch {
    return null;
  }
};

export const saveCachedResult = async (
  supabase: SupabaseClient,
  base64Image: string,
  result: AIAnalysisResult
): Promise<void> => {
  try {
    const hash = await hashImage(base64Image);
    await supabase
      .from('image_cache')
      .upsert({ hash, result, created_at: new Date().toISOString() });
  } catch (e) {
    console.warn('image_cache save failed:', e);
  }
};
