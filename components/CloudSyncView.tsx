
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
    expiry_date TEXT NOT NULL, is_ordered BOOLEAN DEFAULT FALSE, last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
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

const EXCEL_SCRIPT = `/**
 * CUADERNO ELECTRÓNICO DE LABORATORIO - BACKEND
 * Diseñado para recuperación de desastres y auditoría completa.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    var action = data.action;

    // --- MÓDULO 1: GESTIÓN DE INVENTARIO (FOTO ACTUAL / RECUPERACIÓN) ---
    // Esta hoja SIEMPRE muestra lo que deberías tener en estantería HOY.
    if (action === "SYNC_INVENTORY_SNAPSHOT") {
      var sheetName = "Inventario (Estado Actual)";
      var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
      
      // Limpiar y preparar cabeceras formateadas
      sheet.clear();
      var headers = [["ID SISTEMA", "NOMBRE REACTIVO", "MARCA", "DEPARTAMENTO", "STOCK TOTAL", "UNIDAD", "ENVASE", "STOCK MÍNIMO", "ESTADO PEDIDO", "ULT. ACT."]];
      sheet.getRange(1, 1, 1, headers[0].length).setValues(headers).setFontWeight("bold").setBackground("#e0e7ff");
      
      if (data.reagents && data.reagents.length > 0) {
        var rows = data.reagents.map(function(r) {
          return [
            r.id,
            r.name,
            r.brand,
            r.department,
            r.currentStock,
            r.baseUnit,
            r.containerType,
            r.minStock,
            r.isOrdered ? "PENDIENTE PEDIDO" : "OK",
            r.lastUpdated
          ];
        });
        sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
        // Ajustar anchos
        sheet.autoResizeColumns(1, 10);
      }
    }

    // --- MÓDULO 2: AUDITORÍA DE MOVIMIENTOS (LOG INMUTABLE) ---
    // Esta hoja guarda la historia. Nunca se borra.
    if (action === "LOG_TRANSACTION" && data.transaction) {
      var t = data.transaction;
      var sheetName = "Auditoría (Historial)";
      var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
      
      if (sheet.getLastRow() == 0) {
        var headers = [["FECHA/HORA", "ID TRANSACCIÓN", "TIPO MOVIMIENTO", "REACTIVO", "CANTIDAD", "UNIDAD", "ANALISTA RESPONSABLE"]];
        sheet.getRange(1, 1, 1, headers[0].length).setValues(headers).setFontWeight("bold").setBackground("#fef3c7");
        sheet.setFrozenRows(1);
      }
      
      sheet.appendRow([
        t.timestamp,
        t.id,
        t.type === 'IN' ? "INGRESO" : "SALIDA",
        t.reagentName,
        t.displayQuantity,
        t.displayUnit,
        t.analyst
      ]);
    }
    
    // --- MÓDULO 3: RESPALDO DE CONFIGURACIÓN ---
    if (action === "SAVE_CONFIG") {
      var sheet = ss.getSheetByName('Config_Backup') || ss.insertSheet('Config_Backup');
      sheet.clear();
      sheet.appendRow(["CLAVE", "VALOR"]);
      sheet.appendRow(["analistas_json", JSON.stringify(data.analysts)]);
      sheet.appendRow(["email_gerente", data.managerEmail]);
    }

    return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
    
  } catch (e) {
    return ContentService.createTextOutput("ERROR: " + e.toString()).setMimeType(ContentService.MimeType.TEXT);
  } finally {
    lock.releaseLock();
  }
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
            <span className="text-white font-bold">Supabase</span> para sincronización multi-dispositivo en tiempo real y <span className="text-emerald-400 font-bold">Google Sheets</span> como Cuaderno Electrónico de Recuperación ante Desastres.
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
                <h2 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Supabase (Base de Datos)</h2>
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
                <h2 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Google Sheets (Cuaderno Electrónico)</h2>
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
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Script Avanzado V2</p>
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
          <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">¿Cómo funciona el Cuaderno Electrónico?</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Hemos actualizado el sistema para crear dos hojas de seguridad. 
            <br/>1. <span className="font-bold text-slate-700">Inventario (Estado Actual):</span> Es una foto exacta de lo que hay. Si eliminas o agregas un reactivo, esta hoja se reescribe completamente para estar siempre al día.
            <br/>2. <span className="font-bold text-slate-700">Auditoría:</span> Es un historial inmutable de cada ingreso o salida.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CloudSyncView;