
import React, { useState } from 'react';
import { LockClosedIcon, ShieldCheckIcon, EnvelopeIcon, BellIcon, UserPlusIcon, TrashIcon, UsersIcon } from '@heroicons/react/24/solid';

interface Props {
  updateMgSettings: (mg?: string, email?: string) => void;
  analysts: string[];
  onAddAnalyst: (name: string) => void;
  onRemoveAnalyst: (name: string) => void;
  currentMg: string | null;
  currentEmail: string;
}

const ConfigView: React.FC<Props> = ({ updateMgSettings, analysts, onAddAnalyst, onRemoveAnalyst, currentMg, currentEmail }) => {
  const [mgInput, setMgInput] = useState('');
  const [emailInput, setEmailInput] = useState(currentEmail);
  const [newAnalyst, setNewAnalyst] = useState('');
  const [success, setSuccess] = useState('');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateMgSettings(mgInput || undefined, emailInput);
    setSuccess('Ajustes guardados correctamente.');
    if (mgInput) setMgInput('');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleAddAnalyst = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAnalyst.trim()) {
      onAddAnalyst(newAnalyst.trim());
      setNewAnalyst('');
      setSuccess('Analista añadido.');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Seguridad y Notificaciones</h1>
          <p className="text-slate-500">Gestión de accesos y alertas automáticas.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
            <ShieldCheckIcon className="w-6 h-6 text-indigo-600" />
            <h2 className="font-bold text-slate-800">Ajustes del Sistema</h2>
          </div>
          <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <EnvelopeIcon className="w-4 h-4 text-indigo-500" />
                Correo Electrónico para Alertas
              </label>
              <input 
                type="email"
                placeholder="ejemplo@laboratorio.com"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 outline-none transition-all"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <LockClosedIcon className="w-4 h-4 text-indigo-500" />
                Cambiar Clave Maestra
              </label>
              <input 
                type="password"
                placeholder="**** (Dejar vacío para no cambiar)"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 outline-none transition-all"
                value={mgInput}
                onChange={(e) => setMgInput(e.target.value)}
              />
            </div>

            <button type="submit" className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-black transition-all">
              Actualizar Ajustes
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Analistas</h1>
          <p className="text-slate-500">Administre el personal que utiliza la App.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
            <UsersIcon className="w-6 h-6 text-indigo-600" />
            <h2 className="font-bold text-slate-800">Personal Registrado</h2>
          </div>
          
          <div className="p-6 space-y-6">
            <form onSubmit={handleAddAnalyst} className="flex gap-2">
              <input 
                type="text"
                placeholder="Nombre del analista..."
                className="flex-grow px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 outline-none transition-all"
                value={newAnalyst}
                onChange={(e) => setNewAnalyst(e.target.value)}
              />
              <button type="submit" className="bg-indigo-600 p-4 text-white rounded-2xl shadow-lg hover:bg-indigo-700 transition-all">
                <UserPlusIcon className="w-5 h-5" />
              </button>
            </form>

            <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
              {analysts.length > 0 ? (
                analysts.map((a, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <span className="font-bold text-slate-700">{a}</span>
                    <button 
                      onClick={() => onRemoveAnalyst(a)}
                      className="p-2 text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-slate-400 italic text-sm">
                  No hay analistas registrados. Añada uno arriba.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {success && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-full font-bold shadow-2xl animate-in slide-in-from-bottom-4">
          {success}
        </div>
      )}
    </div>
  );
};

export default ConfigView;
