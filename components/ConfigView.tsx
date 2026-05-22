import React, { useState } from 'react';
import { LockClosedIcon, ShieldCheckIcon, EnvelopeIcon, UserPlusIcon, TrashIcon, UsersIcon, SparklesIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';
import { AnalystUser, Department } from '../types';

interface Props {
  updateMgSettings: (mg?: string, email?: string) => void;
  analysts: AnalystUser[];
  onAddAnalyst: (user: AnalystUser) => void;
  onRemoveAnalyst: (name: string) => void;
  currentMg: string | null;
  currentEmail: string;
  geminiKey: string;
  onUpdateGeminiKey: (key: string) => void;
}

const ConfigView: React.FC<Props> = ({ updateMgSettings, analysts, onAddAnalyst, onRemoveAnalyst, currentMg, currentEmail, geminiKey, onUpdateGeminiKey }) => {
  const [mgInput, setMgInput] = useState('');
  const [emailInput, setEmailInput] = useState(currentEmail);
  const [newAnalystName, setNewAnalystName] = useState('');
  const [newAnalystDept, setNewAnalystDept] = useState<Department>('Fisicoquímico');
  const [success, setSuccess] = useState('');
  const [geminiInput, setGeminiInput] = useState('');
  const [showKey, setShowKey] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateMgSettings(mgInput || undefined, emailInput);
    setSuccess('Ajustes guardados correctamente.');
    if (mgInput) setMgInput('');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSaveGeminiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!geminiInput.trim()) return;
    onUpdateGeminiKey(geminiInput.trim());
    setGeminiInput('');
    setSuccess('Clave de IA guardada y sincronizada.');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleAddAnalyst = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAnalystName.trim()) {
      if (analysts.some(a => a.name.toLowerCase() === newAnalystName.trim().toLowerCase())) {
        alert("Este nombre ya existe.");
        return;
      }
      onAddAnalyst({ name: newAnalystName.trim(), department: newAnalystDept });
      setNewAnalystName('');
      setNewAnalystDept('Fisicoquímico');
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

        {/* Sección IA */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-violet-50 flex items-center gap-3">
            <SparklesIcon className="w-6 h-6 text-violet-600" />
            <div>
              <h2 className="font-bold text-slate-800">Inteligencia Artificial</h2>
              <p className="text-xs text-slate-500">Clave para lectura de etiquetas por cámara</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold ${geminiKey ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              <div className={`w-2 h-2 rounded-full ${geminiKey ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {geminiKey ? 'Clave configurada y activa' : 'Sin clave — escaneo por cámara deshabilitado'}
            </div>

            <form onSubmit={handleSaveGeminiKey} className="space-y-3">
              <label className="text-sm font-bold text-slate-700">
                {geminiKey ? 'Reemplazar clave de Gemini' : 'Ingresar clave de Gemini'}
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-3 pr-12 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-violet-500 outline-none transition-all font-mono text-sm"
                  value={geminiInput}
                  onChange={(e) => setGeminiInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
              </div>
              <button
                type="submit"
                disabled={!geminiInput.trim()}
                className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold py-3 rounded-2xl shadow-lg transition-all"
              >
                Guardar Clave
              </button>
            </form>

            <div className="bg-slate-50 rounded-2xl p-4 text-xs text-slate-500 space-y-1">
              <p className="font-bold text-slate-700">¿Cómo obtener la clave gratuita?</p>
              <p>1. Abre <span className="font-mono bg-slate-200 px-1 rounded">aistudio.google.com</span></p>
              <p>2. Clic en <strong>"Get API key"</strong> → <strong>"Create API key"</strong></p>
              <p>3. Copia y pega aquí. El plan gratuito incluye 1.500 consultas/día.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Analistas</h1>
          <p className="text-slate-500">Administre el personal y sus departamentos.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
            <UsersIcon className="w-6 h-6 text-indigo-600" />
            <h2 className="font-bold text-slate-800">Personal Registrado</h2>
          </div>

          <div className="p-6 space-y-6">
            <form onSubmit={handleAddAnalyst} className="space-y-3">
              <input
                type="text"
                placeholder="Nombre del analista..."
                required
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 outline-none transition-all"
                value={newAnalystName}
                onChange={(e) => setNewAnalystName(e.target.value)}
              />
              <div className="flex gap-2">
                <select
                  className="flex-grow px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 outline-none font-bold text-slate-600"
                  value={newAnalystDept}
                  onChange={(e) => setNewAnalystDept(e.target.value as Department)}
                >
                  <option value="Fisicoquímico">Fisicoquímico</option>
                  <option value="Microbiología">Microbiología</option>
                  <option value="Molecular">Molecular</option>
                </select>
                <button type="submit" className="bg-indigo-600 p-4 text-white rounded-2xl shadow-lg hover:bg-indigo-700 transition-all">
                  <UserPlusIcon className="w-5 h-5" />
                </button>
              </div>
            </form>

            <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
              {analysts.length > 0 ? (
                analysts.map((a, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <div>
                      <p className="font-bold text-slate-800">{a.name}</p>
                      <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">{a.department}</p>
                    </div>
                    <button
                      onClick={() => onRemoveAnalyst(a.name)}
                      className="p-2 text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-slate-400 italic text-sm">
                  No hay analistas registrados.
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
