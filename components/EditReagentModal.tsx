import React, { useState, useEffect } from 'react';
import { Reagent, Department, Presentation } from '../types';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface Props {
  reagent: Reagent;
  onClose: () => void;
  onSave: (updatedReagent: Reagent) => void;
}

const EditReagentModal: React.FC<Props> = ({ reagent, onClose, onSave }) => {
  const [formData, setFormData] = useState<Reagent>(reagent);

  useEffect(() => {
    setFormData(reagent);
  }, [reagent]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'currentStock' || name === 'minStock' || name === 'quantityPerContainer' 
        ? parseFloat(value) 
        : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Editar Reactivo</h2>
            <p className="text-sm text-slate-500">Modifica los datos del reactivo. Esta acción quedará registrada.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="edit-reagent-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Nombre del Reactivo</label>
                <input type="text" name="name" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium" value={formData.name} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Marca</label>
                <input type="text" name="brand" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium" value={formData.brand} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Departamento</label>
                <select name="department" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium" value={formData.department} onChange={handleChange}>
                  <option value="Fisicoquímico">Fisicoquímico</option>
                  <option value="Microbiología">Microbiología</option>
                  <option value="Molecular">Molecular</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Presentación</label>
                <select name="presentation" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium" value={formData.presentation} onChange={handleChange}>
                  <option value="Líquido">Líquido</option>
                  <option value="Sólido">Sólido</option>
                  <option value="Paquete">Paquete</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Lote</label>
                <input type="text" name="lot" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium" value={formData.lot || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Vencimiento</label>
                <input type="date" name="expiryDate" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium" value={formData.expiryDate !== 'N/A' ? formData.expiryDate : ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Stock Actual</label>
                <div className="flex gap-2">
                  <input type="number" step="0.0001" name="currentStock" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium" value={formData.currentStock} onChange={handleChange} />
                  <input type="text" name="baseUnit" required className="w-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium text-center" value={formData.baseUnit} onChange={handleChange} placeholder="Unidad" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Stock Mínimo</label>
                <input type="number" step="0.0001" name="minStock" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium" value={formData.minStock} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Tipo de Envase</label>
                <input type="text" name="containerType" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium" value={formData.containerType} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Cant. por Envase</label>
                <input type="number" step="0.0001" name="quantityPerContainer" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium" value={formData.quantityPerContainer} onChange={handleChange} />
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">
            Cancelar
          </button>
          <button type="submit" form="edit-reagent-form" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors">
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditReagentModal;
