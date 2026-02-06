
import React, { useState, useRef, useMemo } from 'react';
import { Reagent, Presentation, Department, Transaction } from '../types';
import { analyzeReagentLabel } from '../services/geminiService';
import { fileToBase64, generateId } from '../utils';
import { 
  CameraIcon, 
  SparklesIcon, 
  ArrowPathIcon,
  PlusIcon
} from '@heroicons/react/24/solid';

interface Props {
  reagents: Reagent[];
  analysts: string[];
  transactions: Transaction[];
  onTransaction: (reagent: Partial<Reagent>, data: any) => void;
}

const BASE_UNITS_LIQUID = ['mL', 'L'];
const BASE_UNITS_SOLID = ['g', 'kg'];
const BASE_UNITS_PKG = ['unidades'];

const InputForm: React.FC<Props> = ({ reagents, analysts, transactions, onTransaction }) => {
  const [loading, setLoading] = useState(false);
  const [isExisting, setIsExisting] = useState(false);
  const [selectedReagentId, setSelectedReagentId] = useState('');
  const [showNewUnitInput, setShowNewUnitInput] = useState(false);
  const [customUnit, setCustomUnit] = useState('');
  
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
    department: 'Fisicoquímico' as Department,
    analystName: '',
    minStock: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const unitsForPresentation = useMemo(() => {
    if (formData.presentation === 'Líquido') return BASE_UNITS_LIQUID;
    if (formData.presentation === 'Sólido') return BASE_UNITS_SOLID;
    return BASE_UNITS_PKG;
  }, [formData.presentation]);

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
      
      const newBaseUnit = analysis.presentation === 'Líquido' ? 'mL' : (analysis.presentation === 'Sólido' ? 'g' : 'unidades');

      setFormData(prev => ({
        ...prev,
        name: analysis.name || '',
        brand: analysis.brand || '',
        presentation: analysis.presentation || 'Líquido',
        baseUnit: newBaseUnit
      }));

      const existing = reagents.find(r => 
        r.name.toLowerCase() === analysis.name.toLowerCase() && 
        r.brand.toLowerCase() === analysis.brand.toLowerCase()
      );

      if (existing) {
        setIsExisting(true);
        setSelectedReagentId(existing.id);
        setFormData(prev => ({ 
          ...prev, 
          baseUnit: existing.baseUnit, 
          containerType: existing.containerType,
          quantityPerContainer: existing.quantityPerContainer,
          minStock: existing.minStock 
        }));
      } else {
        setIsExisting(false);
      }
    } catch (error) {
      alert("Error analizando la etiqueta.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.analystName) {
      alert("Debe seleccionar un analista responsable.");
      return;
    }
    
    const finalBaseUnit = showNewUnitInput ? customUnit : formData.baseUnit;
    const originalReagent = isExisting ? reagents.find(r => r.id === selectedReagentId) : null;
    const brandChanged = originalReagent && originalReagent.brand.toLowerCase() !== formData.brand.toLowerCase();
    const finalReagentId = (isExisting && !brandChanged) ? selectedReagentId : undefined;

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
        baseUnit: finalBaseUnit
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

    setFormData({
      name: '', brand: '', presentation: 'Líquido', containerType: 'Frascos',
      quantityEntered: 0, quantityPerContainer: 1, baseUnit: 'mL', 
      expiryDate: '', department: 'Fisicoquímico', analystName: '', minStock: 0
    });
    setIsExisting(false);
    setSelectedReagentId('');
    setShowNewUnitInput(false);
    setCustomUnit('');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Registro de Ingreso</h2>
            <p className="text-indigo-100 text-sm">Complete los datos o use la cámara.</p>
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
              {loading ? "Escaneando..." : "Escanear Etiqueta"}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

            <select 
              className="bg-slate-50 border-2 border-slate-200 py-4 px-4 rounded-2xl text-slate-700 font-bold outline-none focus:border-indigo-500"
              value={isExisting ? selectedReagentId : 'new'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'new') {
                  setIsExisting(false);
                  setSelectedReagentId('');
                  setFormData(prev => ({ ...prev, name: '', brand: '', minStock: 0 }));
                } else {
                  setIsExisting(true);
                  const r = reagents.find(x => x.id === val);
                  if(r) {
                    setSelectedReagentId(val);
                    setFormData(prev => ({
                      ...prev, name: r.name, brand: r.brand, presentation: r.presentation,
                      baseUnit: r.baseUnit, containerType: r.containerType, 
                      quantityPerContainer: r.quantityPerContainer, minStock: r.minStock
                    }));
                  }
                }
              }}
            >
              <option value="new">+ Nuevo Reactivo / Marca</option>
              {reagents.map(r => <option key={r.id} value={r.id}>{r.name} - {r.brand}</option>)}
            </select>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Nombre</label>
                <input type="text" required disabled={isExisting} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none disabled:opacity-60" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Marca</label>
                <input type="text" required className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Tipo de Envase</label>
                <input type="text" required placeholder="Frascos, Botellas..." className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" value={formData.containerType} onChange={e => setFormData({...formData, containerType: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Analista Responsable</label>
                <select 
                  required 
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-slate-700"
                  value={formData.analystName} 
                  onChange={e => setFormData({...formData, analystName: e.target.value})}
                >
                  <option value="">-- Seleccionar Analista --</option>
                  {analysts.map((a, i) => <option key={i} value={a}>{a}</option>)}
                </select>
                {analysts.length === 0 && <p className="text-[10px] text-red-500 font-bold uppercase">No hay analistas registrados. Avise al gerente.</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Cant. Envases</label>
                <input type="number" required min="1" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" value={formData.quantityEntered || ''} onChange={e => setFormData({...formData, quantityEntered: parseInt(e.target.value) || 0})} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Contenido por Envase</label>
                <div className="flex gap-2">
                  <input type="number" required step="0.01" className="flex-grow px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" value={formData.quantityPerContainer || ''} onChange={e => setFormData({...formData, quantityPerContainer: parseFloat(e.target.value) || 0})} />
                  <select className="w-24 border-2 border-slate-200 rounded-xl bg-slate-100 px-2 outline-none font-bold" value={formData.baseUnit} onChange={e => setFormData({...formData, baseUnit: e.target.value})}>
                    {unitsForPresentation.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Stock Mínimo ({formData.baseUnit})</label>
                <input type="number" required min="0" step="0.01" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" value={formData.minStock || ''} onChange={e => setFormData({...formData, minStock: parseFloat(e.target.value) || 0})} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Departamento</label>
                <select className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value as Department})}>
                  <option value="Fisicoquímico">Fisicoquímico</option>
                  <option value="Microbiología">Microbiología</option>
                  <option value="Molecular">Molecular</option>
                </select>
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
