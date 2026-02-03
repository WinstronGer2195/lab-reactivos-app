
import React, { useState } from 'react';
import { 
  CircleStackIcon, 
  KeyIcon, 
  ArrowPathIcon, 
  CheckCircleIcon, 
  InformationCircleIcon, 
  CommandLineIcon,
  ClipboardDocumentCheckIcon,
  DocumentDuplicateIcon,
  GlobeAltIcon,
  TableCellsIcon,
  ShieldCheckIcon,
  CloudIcon
} from '@heroicons/react/24/outline';

interface Props {
  supaUrl: string;
  setSupaUrl: (url: string) => void;
  supaKey: string;
  setSupaKey: (key: string) => void;
  cloudUrl: string;
  setCloudUrl: (url: string) => void;
  showToast: (msg: string, type: any) => void;
  onSync: () => void;
}

const SQL_SCHEMA = `-- EJECUTAR EN SQL EDITOR DE SUPABASE
CREATE TABLE IF NOT EXISTS public.config (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS public.reagents (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL, presentation TEXT NOT NULL,
    current_stock NUMERIC NOT NULL, min_stock NUMERIC NOT NULL, department TEXT NOT NULL,
    base_unit TEXT NOT NULL, container_type TEXT NOT NULL, quantity_per_container NUMERIC NOT NULL,
    expiry_date TEXT NOT NULL, is_ordered BOOLEAN DEFAULT FALSE, last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY, reagent_id TEXT REFERENCES public.reagents(id), reagent_name TEXT NOT NULL,
    type TEXT NOT NULL, quantity NUMERIC NOT NULL, display_quantity NUMERIC NOT NULL,
    display_unit TEXT NOT NULL, analyst TEXT NOT NULL, timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar acceso público rápido
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reagents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full Access" ON public.config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full Access" ON public.reagents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full Access" ON public.transactions FOR ALL USING (true) WITH CHECK (true);`;

const EXCEL_SCRIPT = `function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = JSON.parse(e.postData.contents);
  var action = data.action;
  
  if (action === "SAVE_CONFIG") {
    var configSheet = ss.getSheetByName('Config') || ss.insertSheet('Config');
    configSheet.clear();
    configSheet.appendRow(["analysts", JSON.stringify(data.analysts)]);
    configSheet.appendRow(["managerEmail", data.managerEmail]);
    configSheet.appendRow(["password", data.password]);
  }
  
  if (action === "SYNC_ALL") {
    var invSheet = ss.getSheetByName('Inventario') || ss.insertSheet('Inventario');
    invSheet.clear(); invSheet.appendRow(["ReagentJSON"]);
    data.reagents.forEach(function(r) { invSheet.appendRow([JSON.stringify(r)]); });
    
    if (data.transaction) {
      var moveSheet = ss.getSheetByName('Movimientos') || ss.insertSheet('Movimientos');
      if (moveSheet.getLastRow() == 0) moveSheet.appendRow(['ID', 'Fecha', 'Tipo', 'Reactivo', 'Cant.', 'Unidad', 'Analista']);
      var t = data.transaction;
      moveSheet.appendRow([t.id, t.timestamp, t.type, t.reagentName, t.displayQuantity, t.displayUnit, t.analyst]);
    }
  }
  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}`;

const CloudSyncView: React.FC<Props> = ({ 
  supaUrl, setSupaUrl, supaKey, setSupaKey, cloudUrl, setCloudUrl, showToast, onSync 
}) => {
  const [urlSInput, setUrlSInput] = useState(supaUrl);
  const [keySInput, setKeySInput] = useState(supaKey);
  const [urlEInput, setUrlEInput] = useState(cloudUrl);
  const [copied, setCopied] = useState<'SQL' | 'EXCEL' | null>(null);

  const handleSaveSupa = (e: React.FormEvent) => {
    e.preventDefault();
    setSupaUrl(urlSInput);
    setSupaKey(keySInput);
    showToast("Supabase actualizado", "success");
    setTimeout(() => onSync(), 500);
  };

  const handleSaveExcel = (e: React.FormEvent) => {
    e.preventDefault();
    setCloudUrl(urlEInput);
    showToast("Excel actualizado", "success");
  };

  const copy = (text: string, type: 'SQL' | 'EXCEL') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
    showToast(`${type} copiado`, "success");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-4">
            <CloudIcon className="w-12 h-12 text-indigo-400" />
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">Sincronización Híbrida</h1>
          </div>
          <p className="text-slate-400 font-medium max-w-2xl text-lg leading-relaxed">
            <span className="text-white font-bold">Supabase</span> para sincronización multi-dispositivo en tiempo real y <span className="text-emerald-400 font-bold">Google Sheets</span> como respaldo de auditoría obligatorio.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PANEL SUPABASE */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-indigo-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CircleStackIcon className="w-6 h-6 text-indigo-600" />
                <h2 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Supabase (Tiempo Real)</h2>
              </div>
              {supaUrl && <CheckCircleIcon className="w-5 h-5 text-emerald-500" />}
            </div>
            <div className="p-8 flex-grow space-y-8">
              <form onSubmit={handleSaveSupa} className="space-y-4">
                <input type="url" placeholder="Supabase URL" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 outline-none text-xs font-mono" value={urlSInput} onChange={e => setUrlSInput(e.target.value)} />
                <input type="password" placeholder="Anon Key" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 outline-none text-xs font-mono" value={keySInput} onChange={e => setKeySInput(e.target.value)} />
                <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all text-xs uppercase tracking-widest">Vincular Base de Datos</button>
              </form>
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código SQL Necesario</p>
                   <button onClick={() => copy(SQL_SCHEMA, 'SQL')} className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1 hover:underline">
                      {copied === 'SQL' ? 'Copiado' : 'Copiar SQL'} <DocumentDuplicateIcon className="w-3 h-3"/>
                   </button>
                </div>
                <div className="bg-slate-900 rounded-2xl p-4 h-32 overflow-y-auto scrollbar-hide">
                  <pre className="text-[9px] text-indigo-300 font-mono italic">{SQL_SCHEMA}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL EXCEL */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-emerald-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TableCellsIcon className="w-6 h-6 text-emerald-600" />
                <h2 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Excel (Archivo Auditoría)</h2>
              </div>
              {cloudUrl && <CheckCircleIcon className="w-5 h-5 text-emerald-500" />}
            </div>
            <div className="p-8 flex-grow space-y-8">
              <form onSubmit={handleSaveExcel} className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">URL Google Web App</label>
                <input type="url" placeholder="https://script.google.com/..." className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-emerald-500 outline-none text-xs font-mono" value={urlEInput} onChange={e => setUrlEInput(e.target.value)} />
                <button type="submit" className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-emerald-700 transition-all text-xs uppercase tracking-widest">Vincular Excel</button>
              </form>
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Script para Google Sheets</p>
                   <button onClick={() => copy(EXCEL_SCRIPT, 'EXCEL')} className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1 hover:underline">
                      {copied === 'EXCEL' ? 'Copiado' : 'Copiar Script'} <DocumentDuplicateIcon className="w-3 h-3"/>
                   </button>
                </div>
                <div className="bg-slate-900 rounded-2xl p-4 h-32 overflow-y-auto scrollbar-hide">
                  <pre className="text-[9px] text-emerald-300 font-mono italic">{EXCEL_SCRIPT}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex items-start gap-6">
        <div className="p-4 bg-amber-50 rounded-2xl shrink-0"><InformationCircleIcon className="w-8 h-8 text-amber-500" /></div>
        <div className="space-y-2">
          <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Funcionamiento del Sistema Híbrido</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Al realizar un movimiento, la app primero actualiza la <span className="font-bold text-indigo-600">Base de Datos</span> para que tus compañeros vean el stock al instante. Inmediatamente después, envía una copia del movimiento al <span className="font-bold text-emerald-600">Google Sheet</span> para registro de auditoría. Si no hay internet, la app intentará sincronizar cuando detecte conexión.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CloudSyncView;
