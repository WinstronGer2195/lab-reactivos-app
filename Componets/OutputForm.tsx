
import React, { useState, useRef, useMemo } from 'react';
import { Reagent, Transaction } from '../types';
import { analyzeReagentLabel } from '../services/geminiService';
import { fileToBase64 } from '../utils';
import { 
  CameraIcon, 
  ArrowPathIcon,
  MinusCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/solid';

interface Props {
  reagents: Reagent[];
  analysts: string[];
  onTransaction: (reagent: Partial<Reagent>, data: any) => void;
}

const OutputForm: React.FC<Props> = ({ reagents, analysts, onTransaction }) => {
  const [loading, setLoading] = useState(false);
  const [selectedReagentId, setSelectedReagentId] = useState('');
  const [outputMode, setOutputMode] = useState<'CONTAINER' | 'QUANTITY'>('CONTAINER');
  const [formData, setFormData] = useState({
    containers: 0,
    amount: 0,
    analystName: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedReagent = useMemo(() => reagents.find(r => r.id === selectedReagentId), [reagents, selectedReagentId]);

  const totalAmountToWithdraw = useMemo(() => {
    if (!selectedReagent) return 0;
    return outputMode === 'CONTAINER' 
      ? formData.containers * selectedReagent.quantityPerContainer 
      : formData.amount;
  }, [outputMode, formData, selectedReagent]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const analysis = await analyzeReagentLabel(base64);
      const found = reagents.find(r => r.name.toLowerCase().includes(analysis.name.toLowerCase()) || analysis.name.toLowerCase().includes(r.name.toLowerCase()));
      if (found) setSelectedReagentId(found.id);
      else alert("Reactivo no encontrado.");
    } catch (error) { alert("Error al analizar."); } finally { setLoading(false); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReagent) return;
    if (!formData.analystName) {
      alert("Seleccione un analista.");
      return;
    }
    if (totalAmountToWithdraw > selectedReagent.currentStock) {
      alert("No hay suficiente stock.");
      return;
    }

    onTransaction({}, {
      reagentId: selectedReagentId,
      type: 'OUT',
      quantity: totalAmountToWithdraw,
      displayQuantity: outputMode === 'CONTAINER' ? formData.containers : formData.amount,
      displayUnit: outputMode === 'CONTAINER' ? selectedReagent.containerType : selectedReagent.baseUnit,
      analyst: formData.analystName
    });

    setSelectedReagentId('');
    setFormData({ containers: 0, amount: 0, analystName: '' });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-rose-600 p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Registro de Egreso / Uso</h2>
            <p className="text-rose-100 text-sm">Seleccione el reactivo y el analista responsable.</p>
          </div>
          <MinusCircleIcon className="w-8 h-8 opacity-40" />
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading} className="flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 py-4 px-4 rounded-2xl border border-rose-200 font-bold transition-all">
              {loading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <CameraIcon className="w-5 h-5" />}
              {loading ? "Buscando..." : "Escanear Envase"}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

            <select className="bg-slate-50 border-2 border-slate-200 py-4 px-4 rounded-2xl text-slate-700 font-bold outline-none focus:border-rose-500" value={selectedReagentId} onChange={(e) => setSelectedReagentId(e.target.value)}>
              <option value="">-- Seleccionar Reactivo --</option>
              {reagents.map(r => <option key={r.id} value={r.id}>{r.name} ({r.currentStock} {r.baseUnit} disp.)</option>)}
            </select>
          </div>

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
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Analista Responsable</label>
                  <select 
                    required 
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-rose-500 outline-none font-bold text-slate-700"
                    value={formData.analystName} 
                    onChange={e => setFormData({...formData, analystName: e.target.value})}
                  >
                    <option value="">-- Seleccionar --</option>
                    {analysts.map((a, i) => <option key={i} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              {selectedReagent.currentStock - totalAmountToWithdraw <= selectedReagent.minStock && (
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex gap-3 animate-pulse"><ExclamationTriangleIcon className="w-6 h-6 text-amber-500 shrink-0" /><p className="text-[11px] text-amber-700 font-bold uppercase leading-tight">Aviso: El stock quedará en nivel crítico tras esta operación.</p></div>
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
