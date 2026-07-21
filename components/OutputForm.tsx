import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Reagent, Transaction, AnalystUser, UserRole } from '../types';
import { analyzeReagentLabel } from '../services/aiService';
import { findReagentInImageLocally } from '../services/ocrService';
import { fileToBase64, formatQuantity, normalizeToUnit } from '../utils';
import { 
  CameraIcon, 
  ArrowPathIcon,
  MinusCircleIcon,
  ExclamationTriangleIcon,
  UserIcon
} from '@heroicons/react/24/solid';

interface Props {
  reagents: Reagent[];
  analysts: AnalystUser[];
  transactions: Transaction[];
  onTransaction: (reagent: Partial<Reagent>, data: any) => void;
  currentUser: AnalystUser | null;
  userRole: UserRole | null;
}

const OutputForm: React.FC<Props> = ({ reagents, analysts, transactions, onTransaction, currentUser, userRole }) => {
  const [loading, setLoading] = useState(false);
  const [selectedReagentId, setSelectedReagentId] = useState('');
  const [outputMode, setOutputMode] = useState<'CONTAINER' | 'QUANTITY'>('CONTAINER');
  const [formData, setFormData] = useState({
    containers: 0,
    amount: 0,
    analystName: currentUser?.name || (userRole === 'GERENTE' ? 'GERENTE' : ''),
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [lastBase64, setLastBase64] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [showFifoAlert, setShowFifoAlert] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownTriggerRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleDropdown = () => {
    if (!isDropdownOpen && dropdownTriggerRef.current) {
      const rect = dropdownTriggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        maxHeight: `calc(100dvh - ${rect.bottom + 24}px)`
      });
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  const selectedReagent = useMemo(() => reagents.find(r => r.id === selectedReagentId), [reagents, selectedReagentId]);

  const totalStockForSelectedName = useMemo(() => {
    if (!selectedReagent) return 0;
    const total = reagents
      .filter(r => r.name.toUpperCase() === selectedReagent.name.toUpperCase() && !r.isDeleted)
      .reduce((sum, r) => sum + normalizeToUnit(r.currentStock, r.baseUnit, selectedReagent.baseUnit), 0);
    return formatQuantity(total, selectedReagent.presentation);
  }, [reagents, selectedReagent]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalAmountToWithdraw = useMemo(() => {
    if (!selectedReagent) return 0;
    const val = outputMode === 'CONTAINER' 
      ? formData.containers * selectedReagent.quantityPerContainer 
      : formData.amount;
    return formatQuantity(val, selectedReagent.presentation);
  }, [outputMode, formData, selectedReagent]);

  // Fecha de ingreso real de cada lote: la primera transacción de tipo IN registrada para ese id.
  // Si no hay ninguna (ej. datos migrados), se usa lastUpdated como respaldo.
  const entryDateByReagentId = useMemo(() => {
    const map = new Map<string, string>();
    transactions.forEach(t => {
      if (t.type !== 'IN') return;
      const current = map.get(t.reagentId);
      if (!current || t.timestamp < current) map.set(t.reagentId, t.timestamp);
    });
    return map;
  }, [transactions]);

  const getEntryDate = (r: Reagent) => entryDateByReagentId.get(r.id) || r.lastUpdated;

  // Orden de salida: FIFO (por ingreso) salvo que el vencimiento indique lo contrario.
  // Si dos lotes tienen vencimiento cargado y el que ingresó primero vence después que
  // el que ingresó luego, se prioriza por vencimiento y se avisa al analista.
  // Sin fecha de vencimiento, se aplica FIFO puro.
  const { fifoReagents, fifoWarningsByName } = useMemo(() => {
    const active = reagents.filter(r => !r.isDeleted && r.currentStock > 0);

    const groups = new Map<string, Reagent[]>();
    active.forEach(r => {
      const key = r.name.toUpperCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });

    const warnings = new Map<string, string>();
    const representative: Reagent[] = [];

    groups.forEach((items) => {
      const hasExpiry = (r: Reagent) => !!r.expiryDate && r.expiryDate !== 'N/A';

      const final = [...items].sort((a, b) => {
        const aHas = hasExpiry(a), bHas = hasExpiry(b);
        if (aHas && bHas) {
          if (a.expiryDate !== b.expiryDate) {
            return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
          }
          return getEntryDate(a).localeCompare(getEntryDate(b));
        }
        if (aHas !== bHas) return aHas ? -1 : 1;
        return getEntryDate(a).localeCompare(getEntryDate(b));
      });

      // Detecta inversiones: un lote ingresado antes que vence después que uno ingresado luego.
      let inverted = false;
      for (let i = 0; i < items.length && !inverted; i++) {
        for (let j = i + 1; j < items.length && !inverted; j++) {
          const a = items[i], b = items[j];
          if (!hasExpiry(a) || !hasExpiry(b)) continue;
          const aEntry = getEntryDate(a), bEntry = getEntryDate(b);
          const [first, second] = aEntry <= bEntry ? [a, b] : [b, a];
          if (new Date(first.expiryDate).getTime() > new Date(second.expiryDate).getTime()) {
            inverted = true;
          }
        }
      }
      if (inverted) {
        warnings.set(items[0].name.toUpperCase(), `Se detectó un lote de ${items[0].name} ingresado antes que vence después que otro ingresado luego. El orden de salida se ajustó por vencimiento — verificar lotes.`);
      }

      representative.push(final[0]);
    });

    return { fifoReagents: representative, fifoWarningsByName: warnings };
  }, [reagents, entryDateByReagentId]);

  // Muestra el aviso FIFO/vencimiento como ventana emergente solo cuando se
  // selecciona un reactivo que tiene la inconsistencia detectada.
  useEffect(() => {
    if (selectedReagent && fifoWarningsByName.has(selectedReagent.name.toUpperCase())) {
      setShowFifoAlert(true);
    } else {
      setShowFifoAlert(false);
    }
  }, [selectedReagentId, selectedReagent, fifoWarningsByName]);

  const runAIAnalysis = async (base64: string) => {
    setLoading(true);
    setAiError(null);
    setFormError(null);
    try {
      // Sort reagents by expiry date (FEFO) to prioritize oldest/expiring reagents first
      const sortedReagents = [...reagents].sort((a, b) => {
        const aExpiry = a.expiryDate === 'N/A' || !a.expiryDate ? '9999-12-31' : a.expiryDate;
        const bExpiry = b.expiryDate === 'N/A' || !b.expiryDate ? '9999-12-31' : b.expiryDate;
        if (aExpiry !== bExpiry) {
          return new Date(aExpiry).getTime() - new Date(bExpiry).getTime();
        }
        return a.currentStock - b.currentStock;
      });

      // Try local OCR first (faster, no API dependency)
      const localMatch = await findReagentInImageLocally(base64, sortedReagents.filter(r => !r.isDeleted && r.currentStock > 0));
      
      let found;
      if (localMatch) {
        // Find the specific reagent ID based on the local match (prioritize oldest if multiple match)
        found = sortedReagents.find(r => 
          !r.isDeleted && r.currentStock > 0 &&
          r.name === localMatch.name && r.brand === localMatch.brand
        );
        
        // Fallback to just name if exact brand not found
        if (!found) {
          found = sortedReagents.find(r => 
            !r.isDeleted && r.currentStock > 0 &&
            r.name === localMatch.name
          );
        }
      }

      // If local OCR failed to find a match, fallback to Gemini API
      if (!found) {
        const analysis = await analyzeReagentLabel(base64);
        
        // Try to find exact match (name + brand) with stock > 0
        found = sortedReagents.find(r => 
          !r.isDeleted && r.currentStock > 0 &&
          ((r.name || '').toLowerCase().includes((analysis.name || '').toLowerCase()) || (analysis.name || '').toLowerCase().includes((r.name || '').toLowerCase())) &&
          ((r.brand || '').toLowerCase().includes((analysis.brand || '').toLowerCase()) || (analysis.brand || '').toLowerCase().includes((r.brand || '').toLowerCase()))
        );

        // Fallback to just name (FIFO) if exact brand not found or has 0 stock
        if (!found) {
          found = sortedReagents.find(r => 
            !r.isDeleted && r.currentStock > 0 &&
            ((r.name || '').toLowerCase().includes((analysis.name || '').toLowerCase()) || (analysis.name || '').toLowerCase().includes((r.name || '').toLowerCase()))
          );
        }
      }

      if (found) setSelectedReagentId(found.id);
      else setFormError("Reactivo no encontrado en inventario o sin existencias.");
    } catch (error: any) {
      console.error(error);
      setAiError("Los modelos de IA están ocupados en este momento. Podés reintentar en unos segundos o seleccionar el reactivo manualmente.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setLastBase64(base64);
    await runAIAnalysis(base64);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedReagent) return;
    if (!formData.analystName) {
      setFormError("Error de sesión: analista no identificado.");
      return;
    }
    if (totalAmountToWithdraw <= 0) {
      setFormError("La cantidad a retirar debe ser mayor a cero.");
      return;
    }
    if (totalAmountToWithdraw > selectedReagent.currentStock) {
      setFormError(`Stock insuficiente. Disponible: ${selectedReagent.currentStock} ${selectedReagent.baseUnit}.`);
      return;
    }

    onTransaction({}, {
      reagentId: selectedReagentId,
      type: 'OUT',
      quantity: totalAmountToWithdraw,
      displayQuantity: outputMode === 'CONTAINER' ? formData.containers : formData.amount,
      displayUnit: outputMode === 'CONTAINER' ? selectedReagent.containerType : selectedReagent.baseUnit,
      analyst: formData.analystName,
      lot: selectedReagent.lot || '',
      reagentBrand: selectedReagent.brand
    });

    setSelectedReagentId('');
    setFormData(prev => ({ ...prev, containers: 0, amount: 0 }));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 min-h-[500px]">
        <div className="bg-rose-600 p-6 text-white flex justify-between items-center rounded-t-3xl">
          <div>
            <h2 className="text-xl font-bold">Registro de Egreso / Uso</h2>
            <p className="text-rose-100 text-sm">
                {currentUser ? `Analista: ${currentUser.name}` : (userRole === 'GERENTE' ? 'Modo Gerente: Salida Autorizada' : 'Identifique el reactivo')}
            </p>
          </div>
          <MinusCircleIcon className="w-8 h-8 opacity-40" />
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading} className="flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 py-4 px-4 rounded-2xl border border-rose-200 font-bold transition-all">
              {loading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <CameraIcon className="w-5 h-5" />}
              {loading ? "Buscando..." : "Foto Cámara"}
            </button>
            {/* capture="environment" added for direct camera access */}
            <input type="file" ref={fileInputRef} className="hidden" capture="environment" accept="image/*" onChange={handleImageUpload} />

            <div className="relative" ref={dropdownRef}>
              <div
                ref={dropdownTriggerRef}
                className="bg-slate-50 border-2 border-slate-200 py-4 px-4 rounded-2xl text-slate-700 font-bold outline-none focus:border-rose-500 cursor-pointer flex justify-between items-center h-full"
                onClick={toggleDropdown}
              >
                <span className="truncate">
                  {selectedReagentId 
                    ? (() => {
                        const r = reagents.find(x => x.id === selectedReagentId);
                        return r ? `${r.name} - ${r.brand} (${r.currentStock} ${r.baseUnit} disp.)` : '-- Seleccionar Reactivo --';
                      })()
                    : '-- Seleccionar Reactivo --'}
                </span>
                <span className="text-slate-400 text-xs ml-2">▼</span>
              </div>
              
              {isDropdownOpen && (
                <div style={dropdownStyle} className="z-50 bg-white border-2 border-slate-200 rounded-2xl shadow-xl overflow-y-auto">
                  <div className="sticky top-0 bg-white p-2 border-b border-slate-100">
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-rose-500 text-sm font-medium"
                      placeholder="Buscar por nombre o marca..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                  <div 
                    className={`px-4 py-3 cursor-pointer hover:bg-rose-50 font-bold ${!selectedReagentId ? 'bg-rose-50 text-rose-700' : 'text-slate-700'}`}
                    onClick={() => {
                      setSelectedReagentId('');
                      setIsDropdownOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    -- Seleccionar Reactivo --
                  </div>
                  {fifoReagents
                    .filter(r => 
                      (r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                      (r.brand || '').toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(r => (
                      <div 
                        key={r.id} 
                        className={`px-4 py-3 cursor-pointer hover:bg-slate-50 font-medium text-slate-700 border-t border-slate-50 ${selectedReagentId === r.id ? 'bg-slate-100' : ''}`}
                        onClick={() => {
                          setSelectedReagentId(r.id);
                          setIsDropdownOpen(false);
                          setSearchQuery('');
                        }}
                      >
                        {r.name} - {r.brand} ({r.currentStock} {r.baseUnit} disp.)
                      </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {aiError && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <div className="flex items-start gap-2 flex-1">
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-amber-800">{aiError}</p>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => lastBase64 && runAIAnalysis(lastBase64)}
                className="shrink-0 flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-4 py-2 rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ArrowPathIcon className="w-4 h-4" />}
                Reintentar
              </button>
            </div>
          )}

          {showFifoAlert && selectedReagent && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowFifoAlert(false)}>
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-amber-50 p-6 border-b border-amber-100 flex items-center gap-3">
                  <ExclamationTriangleIcon className="w-8 h-8 text-amber-500 shrink-0" />
                  <h3 className="font-bold text-slate-800">Aviso de orden FIFO/vencimiento</h3>
                </div>
                <div className="p-6">
                  <p className="text-sm text-slate-600">{fifoWarningsByName.get(selectedReagent.name.toUpperCase())}</p>
                </div>
                <div className="p-4 border-t border-slate-100">
                  <button onClick={() => setShowFifoAlert(false)} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors">
                    Entendido
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedReagent && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-center">
                  <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest">Disponible</p>
                  <p className="font-bold text-slate-800">{selectedReagent.currentStock} {selectedReagent.baseUnit}</p>
                </div>
                <div className="text-center border-l border-slate-200">
                  <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest">Envase</p>
                  <p className="font-bold text-slate-800">{selectedReagent.containerType}</p>
                </div>
                <div className="text-center border-l border-slate-200">
                  <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest">Contenido</p>
                  <p className="font-bold text-slate-800">{selectedReagent.quantityPerContainer}{selectedReagent.baseUnit}</p>
                </div>
                <div className="text-center border-l border-slate-200">
                  <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest">Equiv.</p>
                  <p className="font-bold text-rose-600">{(selectedReagent.currentStock / selectedReagent.quantityPerContainer).toFixed(1)} ud.</p>
                </div>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-2xl">
                 <button type="button" onClick={() => setOutputMode('CONTAINER')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${outputMode === 'CONTAINER' ? 'bg-white shadow text-rose-600' : 'text-slate-500'}`}>Por {selectedReagent.containerType}</button>
                 <button type="button" onClick={() => setOutputMode('QUANTITY')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${outputMode === 'QUANTITY' ? 'bg-white shadow text-rose-600' : 'text-slate-500'}`}>Por Medida ({selectedReagent.baseUnit})</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Cantidad a Retirar</label>
                  <div className="relative">
                    {outputMode === 'CONTAINER' ? (
                      <input type="number" required min="1" className="w-full pl-4 pr-24 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-rose-500 outline-none font-bold" value={formData.containers || ''} onChange={e => setFormData({...formData, containers: parseInt(e.target.value) || 0})} />
                    ) : (
                      <input type="number" required step="0.01" min="0.01" className="w-full pl-4 pr-24 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-rose-500 outline-none font-bold" value={formData.amount || ''} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})} />
                    )}
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-[10px] uppercase">
                      {outputMode === 'CONTAINER' ? selectedReagent.containerType : selectedReagent.baseUnit}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Consumo total: {totalAmountToWithdraw} {selectedReagent.baseUnit}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Analista Responsable (Auto)</label>
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-500 font-bold">
                    <UserIcon className="w-5 h-5"/>
                    {formData.analystName}
                  </div>
                </div>
              </div>

              {totalStockForSelectedName - totalAmountToWithdraw <= selectedReagent.minStock && (
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex gap-3 animate-pulse"><ExclamationTriangleIcon className="w-6 h-6 text-amber-500 shrink-0" /><p className="text-[11px] text-amber-700 font-bold uppercase leading-tight">Aviso: El stock total (todas las marcas) quedará en nivel crítico tras esta operación.</p></div>
              )}

              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-sm font-bold text-red-700">{formError}</p>
                </div>
              )}

              <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98] uppercase tracking-widest">Registrar Salida</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutputForm;