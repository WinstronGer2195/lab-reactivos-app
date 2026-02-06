import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Reagent, Presentation, Department, Transaction, AnalystUser } from '../types';
import { analyzeReagentLabel } from '../services/geminiService';
import { fileToBase64, generateId } from '../utils';
import { 
  CameraIcon, 
  SparklesIcon, 
  ArrowPathIcon,
  PlusIcon,
  PencilSquareIcon,
  UserIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/solid';

interface Props {
  reagents: Reagent[];
  analysts: AnalystUser[];
  transactions: Transaction[];
  onTransaction: (reagent: Partial<Reagent>, data: any) => void;
  currentUser: AnalystUser | null;
}

const BASE_UNITS_LIQUID = ['mL', 'L', 'uL'];
const BASE_UNITS_SOLID = ['g', 'kg', 'mg'];
const BASE_UNITS_PKG = ['unidades', 'Rx'];

const InputForm: React.FC<Props> = ({ reagents, analysts, transactions, onTransaction, currentUser }) => {
  const [loading, setLoading] = useState(false);
  const [isExisting, setIsExisting] = useState(false);
  const [selectedReagentId, setSelectedReagentId] = useState('');
  const [isCustomUnitMode, setIsCustomUnitMode] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    presentation: 'Líquido' as Presentation,
    containerType: 'Frascos',
    quantityEntered: 0,
    quantityPerContainer: 1,
    baseUnit: 'mL',
    expiryDate: '',
    department: (currentUser?.department || 'Fisicoquímico') as Department,
    analystName: currentUser?.name || '',
    minStock: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determinar lista de unidades basada en presentación
  const unitsForPresentation = useMemo(() => {
    let units = [];
    if (formData.presentation === 'Líquido') units = [...BASE_UNITS_LIQUID];
    else if (formData.presentation === 'Sólido') units = [...BASE_UNITS_SOLID];
    else units = [...BASE_UNITS_PKG];
    
    return units;
  }, [formData.presentation]);

  // Resetear unidad y ajustar tipo de envase si cambia la presentación
  useEffect(() => {
    setFormData(prev => {
      const updates: any = {};
      
      // Lógica de Unidades
      if (!isCustomUnitMode) {
        if (formData.presentation === 'Líquido' && !BASE_UNITS_LIQUID.includes(prev.baseUnit)) {
          updates.baseUnit = 'mL';
        } else if (formData.presentation === 'Sólido' && !BASE_UNITS_SOLID.includes(prev.baseUnit)) {
          updates.baseUnit = 'g';
        } else if (formData.presentation === 'Paquete' && !BASE_UNITS_PKG.includes(prev.baseUnit)) {
          updates.baseUnit = 'unidades';
        }
      }

      // Lógica de Tipo de Envase (Solicitud Usuario)
      if (formData.presentation === 'Paquete') {
         updates.containerType = 'Paquete';
      } else if (prev.containerType === 'Paquete') {
         updates.containerType = 'Frascos';
      }

      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
    });
  }, [formData.presentation, isCustomUnitMode]);

  // Calcular la frecuencia de uso para ordenar el dropdown
  const sortedReagents = useMemo(() => {
    // 1. Filtrar por departamento del usuario (si hay usuario logueado)
    let filtered = reagents;
    if (currentUser) {
        filtered = reagents.filter(r => r.department === currentUser.department);
    }

    // 2. Calcular frecuencia
    const usageCount: Record<string, number> = {};
    transactions.forEach(t => {
        usageCount[t.reagentId] = (usageCount[t.reagentId] || 0) + 1;
    });

    // 3. Ordenar (Mayor uso primero, luego alfabéticamente)
    return filtered.sort((a, b) => {
        const countA = usageCount[a.id] || 0;
        const countB = usageCount[b.id] || 0;
        if (countB !== countA) return countB - countA;
        return a.name.localeCompare(b.name);
    });
  }, [reagents, currentUser, transactions]);


  const totalBaseQuantity = useMemo(() => {
    return formData.quantityEntered * formData.quantityPerContainer;
  }, [formData.quantityEntered, formData.quantityPerContainer]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const analysis = await analyzeReagentLabel(base64);
      
      const newPresentation = (analysis.presentation === 'Líquido' || analysis.presentation === 'Sólido' || analysis.presentation === 'Paquete') 
        ? analysis.presentation 
        : 'Líquido';

      let newBaseUnit = 'mL';
      if (newPresentation === 'Sólido') newBaseUnit = 'g';
      if (newPresentation === 'Paquete') newBaseUnit = 'unidades';

      setFormData(prev => ({
        ...prev,
        name: analysis.name || '',
        brand: analysis.brand || '',
        presentation: newPresentation,
        baseUnit: newBaseUnit
      }));

      const existing = reagents.find(r => 
        r.name.toLowerCase() === analysis.name.toLowerCase() && 
        r.brand.toLowerCase() === analysis.brand.toLowerCase()
      );

      if (existing) {
        setIsExisting(true);
        setSelectedReagentId(existing.id);
        setIsCustomUnitMode(false); 
        setFormData(prev => ({ 
          ...prev, 
          baseUnit: existing.baseUnit, 
          containerType: existing.containerType,
          quantityPerContainer: existing.quantityPerContainer,
          minStock: existing.minStock,
          department: existing.department,
          presentation: existing.presentation
        }));
      } else {
        setIsExisting(false);
        setIsCustomUnitMode(false);
      }
    } catch (error) {
      console.error(error);
      alert("Error analizando la etiqueta. Por favor intente de nuevo o ingrese manualmente.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.analystName) {
      alert("Error de sesión: No hay analista asignado.");
      return;
    }
    
    const finalReagentId = (isExisting) ? selectedReagentId : undefined;

    onTransaction(
      {
        id: finalReagentId,
        name: formData.name,
        brand: formData.brand,
        presentation: formData.presentation,
        department: formData.department,
        expiryDate: formData.expiryDate || 'N/A',
        minStock: formData.minStock,
        containerType: formData.containerType,
        quantityPerContainer: formData.quantityPerContainer,
        baseUnit: formData.baseUnit
      },
      {
        reagentId: finalReagentId,
        type: 'IN',
        quantity: totalBaseQuantity,
        displayQuantity: formData.quantityEntered,
        displayUnit: formData.containerType,
        analyst: formData.analystName
      }
    );

    // Resetear formulario pero mantener usuario y depto
    setFormData(prev => ({
      ...prev,
      name: '', brand: '', presentation: 'Líquido', containerType: 'Frascos',
      quantityEntered: 0, quantityPerContainer: 1, baseUnit: 'mL', 
      expiryDate: '', minStock: 0
    }));
    setIsExisting(false);
    setSelectedReagentId('');
    setIsCustomUnitMode(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Registro de Ingreso</h2>
            <p className="text-indigo-100 text-sm">
                {currentUser ? `Analista: ${currentUser.name} | Dept: ${currentUser.department}` : 'Complete los datos'}
            </p>
          </div>
          <SparklesIcon className="w-8 h-8 opacity-40" />
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-4 px-4 rounded-2xl border border-indigo-200 font-bold transition-all"
            >
              {loading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <CameraIcon className="w-5 h-5" />}
              {loading ? "Escaneando..." : "Foto Cámara"}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" capture="environment" accept="image/*" onChange={handleImageUpload} />

            <select 
              className="bg-slate-50 border-2 border-slate-200 py-4 px-4 rounded-2xl text-slate-700 font-bold outline-none focus:border-indigo-500"
              value={isExisting ? selectedReagentId : 'new'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'new') {
                  setIsExisting(false);
                  setSelectedReagentId('');
                  setIsCustomUnitMode(false);
                  setFormData(prev => ({ ...prev, name: '', brand: '', minStock: 0 }));
                } else {
                  setIsExisting(true);
                  const r = reagents.find(x => x.id === val);
                  if(r) {
                    setSelectedReagentId(val);
                    setIsCustomUnitMode(false);
                    setFormData(prev => ({
                      ...prev, name: r.name, brand: r.brand, presentation: r.presentation,
                      baseUnit: r.baseUnit, containerType: r.containerType, 
                      quantityPerContainer: r.quantityPerContainer, minStock: r.minStock,
                      department: r.department
                    }));
                  }
                }
              }}
            >
              <option value="new">+ Nuevo Reactivo / Marca</option>
              {sortedReagents.map(r => <option key={r.id} value={r.id}>{r.name} - {r.brand}</option>)}
            </select>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Sección Nombre y Marca */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Nombre</label>
                <input type="text" required disabled={isExisting} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none disabled:opacity-60" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Marca</label>
                <input type="text" required className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
              </div>

              {/* Sección Presentación y Envase */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Presentación</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold"
                  value={formData.presentation}
                  disabled={isExisting}
                  onChange={e => setFormData({...formData, presentation: e.target.value as Presentation})}
                >
                  <option value="Líquido">Líquido (mL, L, uL...)</option>
                  <option value="Sólido">Sólido (g, kg, mg...)</option>
                  <option value="Paquete">Paquete / Unidad</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Tipo de Envase</label>
                <input type="text" required placeholder="Frascos, Paquetes..." className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" value={formData.containerType} onChange={e => setFormData({...formData, containerType: e.target.value})} />
              </div>

              {/* Sección Cantidades y Unidades */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Cant. Envases/Paquetes</label>
                <input type="number" required min="1" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" value={formData.quantityEntered || ''} onChange={e => setFormData({...formData, quantityEntered: parseInt(e.target.value) || 0})} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Contenido Envase/Paquete</label>
                <div className="flex gap-2">
                  <input type="number" required step="0.01" className="flex-grow px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" value={formData.quantityPerContainer || ''} onChange={e => setFormData({...formData, quantityPerContainer: parseFloat(e.target.value) || 0})} />
                  
                  {isCustomUnitMode ? (
                    <div className="relative w-32">
                      <input 
                        type="text" 
                        autoFocus
                        placeholder="Unidad" 
                        className="w-full px-3 py-3 bg-white border-2 border-indigo-500 rounded-xl outline-none font-bold text-center"
                        value={formData.baseUnit} 
                        onChange={e => setFormData({...formData, baseUnit: e.target.value})} 
                      />
                      <button 
                        type="button" 
                        onClick={() => { setIsCustomUnitMode(false); setFormData(prev => ({...prev, baseUnit: unitsForPresentation[0] || 'mL'})); }}
                        className="absolute -top-2 -right-2 bg-slate-200 rounded-full p-1 hover:bg-slate-300"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-slate-600">
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <select 
                      className="w-24 border-2 border-slate-200 rounded-xl bg-slate-100 px-2 outline-none font-bold" 
                      value={formData.baseUnit} 
                      onChange={e => {
                        if (e.target.value === 'CUSTOM') setIsCustomUnitMode(true);
                        else setFormData({...formData, baseUnit: e.target.value});
                      }}
                    >
                      {unitsForPresentation.map(u => <option key={u} value={u}>{u}</option>)}
                      <option value="CUSTOM" className="font-bold text-indigo-600">OTRO...</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Sección Otros Datos */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Stock Mínimo ({formData.baseUnit})</label>
                <input type="number" required min="0" step="0.01" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" value={formData.minStock || ''} onChange={e => setFormData({...formData, minStock: parseFloat(e.target.value) || 0})} />
              </div>

              {/* Campos Bloqueados: Departamento y Analista */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Departamento (Auto)</label>
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-500 font-bold">
                    <BuildingOfficeIcon className="w-5 h-5"/>
                    {formData.department}
                </div>
              </div>

              <div className="space-y-2 col-span-full md:col-span-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Analista Responsable (Auto)</label>
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-500 font-bold">
                    <UserIcon className="w-5 h-5"/>
                    {formData.analystName}
                </div>
              </div>
            </div>

            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98] uppercase tracking-widest">
              Confirmar Ingreso
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InputForm;