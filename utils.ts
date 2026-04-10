
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl.split(',')[1]);
        } else {
          resolve((event.target?.result as string).split(',')[1]);
        }
      };
      img.onerror = (error) => reject(error);
      img.src = event.target?.result as string;
    };
    reader.onerror = (error) => reject(error);
  });
};

export const formatDate = (dateString: string) => {
  if (dateString === "N/A") return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const formatQuantity = (value: number, presentation: string): number => {
  const pres = (presentation || '').toLowerCase();
  let decimals = 2; // Default (Liquids/Packets)
  
  if (pres.includes('sólido') || pres.includes('solido')) {
    decimals = 4;
  }
  
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const normalizeToUnit = (value: number, fromUnit: string, toUnit: string): number => {
  if (!fromUnit || !toUnit) return value;
  let from = fromUnit.toLowerCase().trim();
  let to = toUnit.toLowerCase().trim();
  
  // Normalize common full names to symbols
  if (from === 'litros' || from === 'litro') from = 'l';
  if (to === 'litros' || to === 'litro') to = 'l';
  if (from === 'kilogramos' || from === 'kilogramo') from = 'kg';
  if (to === 'kilogramos' || to === 'kilogramo') to = 'kg';
  if (from === 'mililitros' || from === 'mililitro') from = 'ml';
  if (to === 'mililitros' || to === 'mililitro') to = 'ml';
  if (from === 'gramos' || from === 'gramo') from = 'g';
  if (to === 'gramos' || to === 'gramo') to = 'g';

  if (from === to) return value;

  // Volume
  if (from === 'l' && to === 'ml') return value * 1000;
  if (from === 'ml' && to === 'l') return value / 1000;
  if (from === 'ul' && to === 'ml') return value / 1000;
  if (from === 'ml' && to === 'ul') return value * 1000;
  if (from === 'l' && to === 'ul') return value * 1000000;
  if (from === 'ul' && to === 'l') return value / 1000000;

  // Mass
  if (from === 'kg' && to === 'g') return value * 1000;
  if (from === 'g' && to === 'kg') return value / 1000;
  if (from === 'g' && to === 'mg') return value * 1000;
  if (from === 'mg' && to === 'g') return value / 1000;
  if (from === 'kg' && to === 'mg') return value * 1000000;
  if (from === 'mg' && to === 'kg') return value / 1000000;

  // If unknown conversion, just return the value (fallback)
  return value;
};
