
export type Presentation = 'Líquido' | 'Sólido' | 'Paquete';
export type Department = 'Fisicoquímico' | 'Microbiología' | 'Molecular';
export type UserRole = 'ANALISTA' | 'GERENTE';
export type TransactionType = 'IN' | 'OUT';

export interface Reagent {
  id: string;
  name: string;
  brand: string;
  presentation: Presentation;
  currentStock: number; // Total in baseUnit
  minStock: number; // Total in baseUnit
  department: Department;
  baseUnit: string; // e.g., 'mL', 'L', 'g', 'kg', 'unidades'
  containerType: string; // e.g., 'Frascos', 'Botellas', 'Sobres', 'N/A'
  quantityPerContainer: number; // e.g., 500 (if 500mL per bottle)
  expiryDate: string; // ISO string or "N/A"
  isOrdered: boolean;
  lastUpdated: string;
}

export interface Transaction {
  id: string;
  reagentId: string;
  reagentName: string;
  type: TransactionType;
  quantity: number; // amount in baseUnit
  displayQuantity: number; // amount as entered (e.g., 10 bottles)
  displayUnit: string; // unit as entered (e.g., 'Frascos')
  analyst: string;
  timestamp: string;
}

export interface AIAnalysisResult {
  name: string;
  brand: string;
  presentation: Presentation;
}
