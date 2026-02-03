import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import emailjs from '@emailjs/browser';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  BeakerIcon, QueueListIcon, BellAlertIcon, PlusCircleIcon, MinusCircleIcon,
  ArrowRightOnRectangleIcon, HomeIcon, ChevronRightIcon, LockClosedIcon,
  Cog6ToothIcon, ClockIcon, CloudIcon, ArrowPathIcon, WifiIcon, ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

import { Reagent, Transaction, UserRole } from './types';
import InventoryView from './components/InventoryView';
import InputForm from './components/InputForm';
import OutputForm from './components/OutputForm';
import HistoryView from './components/HistoryView';
import AlertsView from './components/AlertsView';
import ConfigView from './components/ConfigView';
import CloudSyncView from './components/CloudSyncView';
import { generateId } from './utils';

// --- CONFIGURACIÓN PREDETERMINADA (HARDCODED) ---
// PEGA AQUÍ TUS CREDENCIALES DE SUPABASE PARA QUE LA APP CONECTE AUTOMÁTICAMENTE EN TODOS LOS DISPOSITIVOS
const DEFAULT_SUPABASE_URL = "https://diohrpjhwnbwjomntpjk.supabase.co"; // Pega tu URL aquí (ej: https://xyz.supabase.co)
const DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpb2hycGpod25id2pvbW50cGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzU5NTMsImV4cCI6MjA4NTY1MTk1M30.ZRBxweKA21PfSidL4UPScGU0llCtxTF9ugr4v_VQ3qg"; // Pega tu Anon Key aquí (ej: eyJhbGci...)

const STORAGE_KEY_SUPA_URL = 'reagentflow_supa_url';
const STORAGE_KEY_SUPA_KEY = 'reagentflow_supa_key';
const STORAGE_KEY_CLOUD_URL = 'reagentflow_cloud_url';
const STORAGE_KEY_MG_PASSWORD = 'reagentflow_mg_pwd';

const EMAILJS_PUBLIC_KEY = "aMH7yh-WaX5jjiRUm";

interface NotificationLog {
  id: string;
  reagentName: string;
  timestamp: string;
  targetEmail: string;
  stockLevel: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
}

const App: React.FC = () => {
  // Función auxiliar para obtener variables de entorno
  const getEnv = (key: string) => {
    // @ts-ignore
    return (import.meta.env?.[key]) || (typeof process !== 'undefined' ? process.env?.[key] : '') || '';
  };

  const VITE_URL = getEnv('VITE_SUPABASE_URL');
  const VITE_KEY = getEnv('VITE_SUPABASE_KEY');

  // --- Inicialización de Estado con prioridad: LocalStorage -> Hardcoded -> Env Vars ---
  const [supaUrl, setSupaUrl] = useState<string>(
    localStorage.getItem(STORAGE_KEY_SUPA_URL) || DEFAULT_SUPABASE_URL || VITE_URL || ''
  );
  const [supaKey, setSupaKey] = useState<string>(
    localStorage.getItem(STORAGE_KEY_SUPA_KEY) || DEFAULT_SUPABASE_KEY || VITE_KEY || ''
  );
  const [cloudUrl, setCloudUrl] = useState<string>(
    localStorage.getItem(STORAGE_KEY_CLOUD_URL) || ''
  );

  const [role, setRole] = useState<UserRole | null>(null);
  const [reagents, setReagents] = useState<Reagent[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [analysts, setAnalysts] = useState<string[]>([]);
  const [managerEmail, setManagerEmail] = useState<string>('');
  const [mgPassword, setMgPassword] = useState<string | null>(localStorage.getItem(STORAGE_KEY_MG_PASSWORD));
  const [authInput, setAuthInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'alert' | 'error' } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // --- Inicialización de Supabase ---
  const supabase: SupabaseClient | null = useMemo(() => {
    if (!supaUrl || !supaKey) return null;
    try {
      // Validación básica para evitar crashes con URLs vacías o malformadas
      if (!supaUrl.startsWith('http')) return null;
      return createClient(supaUrl, supaKey);
    } catch (e) {
      console.error("Error creating Supabase client", e);
      return null;
    }
  }, [supaUrl, supaKey]);

  const showToast = (message: string, type: 'success' | 'alert' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // --- Función para cargar datos desde Supabase ---
  const pullData = useCallback(async () => {
    if (!supabase) return;
    setIsSyncing(true);
    try {
      // Cargar configuración
      const { data: configData } = await supabase.from('config').select('*');
      if (configData) {
        const emailRow = configData.find(d => d.key === 'manager_email');
        const pwdRow = configData.find(d => d.key === 'manager_password');
        const analystsRow = configData.find(d => d.key === 'analysts');
        if (emailRow) setManagerEmail(emailRow.value);
        if (pwdRow) {
          setMgPassword(pwdRow.value);
          localStorage.setItem(STORAGE_KEY_MG_PASSWORD, pwdRow.value);
        }
        if (analystsRow) {
          try { setAnalysts(JSON.parse(analystsRow.value)); } 
          catch { setAnalysts([]); }
        }
      }

      // Cargar inventario
      const { data: reagentsData } = await supabase.from('reagents').select('*');
      if (reagentsData) {
        setReagents(reagentsData.map(r => ({
          ...r,
          currentStock: parseFloat(r.current_stock),
          minStock: parseFloat(r.min_stock),
          quantityPerContainer: parseFloat(r.quantity_per_container),
          lastUpdated: r.last_updated,
          expiryDate: r.expiry_date,
          containerType: r.container_type,
          baseUnit: r.base_unit,
          isOrdered: r.is_ordered
        })));
      }

      // Cargar historial
      const { data: transData } = await supabase.from('transactions').select('*').order('timestamp', { ascending: false }).limit(100);
      if (transData) {
        setTransactions(transData.map(t => ({
          ...t,
          reagentId: t.reagent_id,
          reagentName: t.reagent_name,
          displayQuantity: parseFloat(t.display_quantity),
          displayUnit: t.display_unit,
          quantity: parseFloat(t.quantity)
        })));
      }
    } catch (e) {
      console.error("Critical Sync Error:", e);
    } finally {
      setIsSyncing(false);
    }
  }, [supabase]);

  // Sincronización inicial
  useEffect(() => {
    if (EMAILJS_PUBLIC_KEY) emailjs.init(EMAILJS_PUBLIC_KEY);
    if (supabase) pullData();
  }, [supabase, pullData]);

  // --- Persistencia de configuración ---
  const saveConfigKey = async (key: string, value: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('config').upsert({ key, value });
    if (error) showToast("Error al guardar en la nube", "error");
  };

  const updateMgSettings = async (pwd?: string, email?: string) => {
    if (pwd) { setMgPassword(pwd); localStorage.setItem(STORAGE_KEY_MG_PASSWORD, pwd); await saveConfigKey('manager_password', pwd); }
    if (email) { setManagerEmail(email); await saveConfigKey('manager_email', email); }
    showToast("Ajustes sincronizados globalmente");
  };

  const addAnalyst = async (name: string) => {
    if (!name || analysts.includes(name)) return;
    const newAnalysts = [...analysts, name];
    setAnalysts(newAnalysts);
    await saveConfigKey('analysts', JSON.stringify(newAnalysts));
  };

  const removeAnalyst = async (name: string) => {
    const newAnalysts = analysts.filter(a => a !== name);
    setAnalysts(newAnalysts);
    await saveConfigKey('analysts', JSON.stringify(newAnalysts));
  };

  // --- Manejo de transacciones ---
  const handleTransaction = async (reagent: Partial<Reagent>, transactionData: Omit<Transaction, 'id' | 'timestamp' | 'reagentName'>) => {
    const timestamp = new Date().toISOString();
    let updatedReagents = [...reagents];
    let reagentId = transactionData.reagentId;
    let finalReagent: Reagent;

    if (transactionData.type === 'IN') {
      const idx = updatedReagents.findIndex(r => r.id === reagentId);
      if (idx > -1) {
        finalReagent = { 
          ...updatedReagents[idx], 
          currentStock: updatedReagents[idx].currentStock + transactionData.quantity, 
          lastUpdated: timestamp,
          isOrdered: false
        };
        updatedReagents[idx] = finalReagent;
      } else {
        finalReagent = {
          id: reagentId || generateId(),
          name: reagent.name!,
          brand: reagent.brand!,
          presentation: reagent.presentation!,
          currentStock: transactionData.quantity,
          minStock: reagent.minStock || 0,
          department: reagent.department!,
          baseUnit: reagent.baseUnit || 'ud',
          containerType: reagent.containerType || 'Frasco',
          quantityPerContainer: reagent.quantityPerContainer || 1,
          expiryDate: reagent.expiryDate || 'N/A',
          isOrdered: false,
          lastUpdated: timestamp
        };
        updatedReagents.push(finalReagent);
        reagentId = finalReagent.id;
      }
    } else {
      const idx = updatedReagents.findIndex(r => r.id === reagentId);
      if (idx === -1) return;
      finalReagent = { ...updatedReagents[idx], currentStock: Math.max(0, updatedReagents[idx].currentStock - transactionData.quantity), lastUpdated: timestamp };
      updatedReagents[idx] = finalReagent;
    }

    setReagents(updatedReagents);
    const newTransaction: Transaction = { ...transactionData, id: generateId(), reagentId: reagentId!, reagentName: finalReagent.name, timestamp };
    setTransactions([newTransaction, ...transactions]);
    showToast(`${transactionData.type === 'IN' ? 'Ingreso' : 'Salida'} registrada`);

    if (supabase) {
      await supabase.from('reagents').upsert({
        id: finalReagent.id, name: finalReagent.name, brand: finalReagent.brand, presentation: finalReagent.presentation,
        current_stock: finalReagent.currentStock, min_stock: finalReagent.minStock, department: finalReagent.department,
        base_unit: finalReagent.baseUnit, container_type: finalReagent.containerType, quantity_per_container: finalReagent.quantityPerContainer,
        expiry_date: finalReagent.expiryDate, is_ordered: finalReagent.isOrdered, last_updated: finalReagent.lastUpdated
      });
      await supabase.from('transactions').insert({
        id: newTransaction.id, reagent_id: newTransaction.reagentId, reagent_name: newTransaction.reagentName,
        type: newTransaction.type, quantity: newTransaction.quantity, display_quantity: newTransaction.displayQuantity,
        display_unit: newTransaction.displayUnit, analyst: newTransaction.analyst, timestamp: newTransaction.timestamp
      });
    }

    // Sincronización cloud
    if (cloudUrl) {
      try {
        await fetch(cloudUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'SYNC_ALL', reagents: updatedReagents, transaction: newTransaction })
        });
      } catch (e) { console.error("Cloud sync failed"); }
    }
  };

  // --- Navegación móvil ---
  const MobileNav = () => {
    const location = useLocation();
    const navItems = [
      { path: '/', icon: HomeIcon, label: 'Inicio' },
      { path: '/ingreso', icon: PlusCircleIcon, label: 'Entra' },
      { path: '/salida', icon: MinusCircleIcon, label: 'Sale' },
      { path: '/historial', icon: ClockIcon, label: 'Histo' },
      ...(role === 'GERENTE' ? [{ path: '/alertas', icon: BellAlertIcon, label: 'Alertas' }, { path: '/nube', icon: CloudIcon, label: 'Nube' }] : [])
    ];
    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 px-2 z-50">
        {navItems.map(item => (
          <Link key={item.path} to={item.path} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${location.pathname === item.path ? 'text-indigo-600' : 'text-slate-400'}`}>
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">{item.label}</span>
          </Link>
        ))}
      </div>
    );
  };

  // --- Pantalla de selección de rol ---
  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center p-4 text-center">
        <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10 w-full max-w-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 flex">
            <div className={`flex-1 ${supabase ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
          </div>
          <BeakerIcon className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-slate-800 mb-2">ReagentFlow</h1>
          <p className="text-slate-500 mb-8 font-medium italic">Gestión Laboratorial Centralizada</p>
          <div className="space-y-4">
            <button onClick={() => setRole('ANALISTA')} className="w-full bg-slate-50 border-2 border-slate-200 hover:border-indigo-600 hover:text-indigo-600 text-slate-700 font-bold py-5 px-6 rounded-2xl transition-all flex items-center justify-between group">
              <div className="flex items-center gap-3"><QueueListIcon className="w-6 h-6" /><span>Analista</span></div>
              <ChevronRightIcon className="w-5 h-5 opacity-50 group-hover:opacity-100" />
            </button>
            <button onClick={() => { setAuthInput(''); setAuthError(''); setShowAuthModal(true); }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 px-6 rounded-2xl transition-all flex items-center justify-between group shadow-xl">
              <div className="flex items-center gap-3"><BellAlertIcon className="w-6 h-6" /><span>Gerente</span></div>
              <ChevronRightIcon className="w-5 h-5 opacity-50 group-hover:opacity-100" />
            </button>
          </div>
          <div className="mt-8 flex flex-col items-center gap-2">
            {supabase ? (
              <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-black uppercase tracking-widest"><WifiIcon className="w-3.5 h-3.5"/> Nube Conectada</div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-black uppercase tracking-widest"><ExclamationTriangleIcon className="w-3.5 h-3.5"/> Modo Local / Sin Config</div>
              </div>
            )}
          </div>
        </div>

        {/* --- MODAL RESTAURADO --- */}
        {showAuthModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center gap-3 text-left">
                <div className="p-2 bg-indigo-100 rounded-lg"><LockClosedIcon className="w-6 h-6 text-indigo-600" /></div>
                <div><h3 className="font-bold text-slate-800">Acceso Seguro</h3><p className="text-xs text-slate-500">Módulo Gerencial</p></div>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!mgPassword) {
                  if (authInput.length < 4) { setAuthError('Mínimo 4 caracteres'); return; }
                  updateMgSettings(authInput); setRole('GERENTE'); setShowAuthModal(false);
                }
                else if (authInput === mgPassword) { setRole('GERENTE'); setShowAuthModal(false); }
                else { setAuthError('Clave incorrecta'); }
              }} className="p-6 space-y-4">
                <input autoFocus type="password" placeholder="****" className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all text-center text-2xl tracking-widest font-bold" value={authInput} onChange={(e) => setAuthInput(e.target.value)} />
                {authError && <p className="text-red-600 text-xs font-bold text-center">{authError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAuthModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cerrar</button>
                  <button type="submit" className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg">Entrar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- App principal ---
  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-slate-50 pb-20 md:pb-0">
        {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${toast.type === 'alert' ? 'bg-amber-600 text-white' : toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`}>
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        )}

        {/* --- NAVBAR DE ESCRITORIO RESTAURADA --- */}
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm hidden md:block">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16">
            <div className="flex items-center gap-2"><BeakerIcon className="h-8 w-8 text-indigo-600" /><span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">ReagentFlow</span></div>
            <div className="flex items-center gap-6">
              <Link to="/" className="text-slate-600 hover:text-indigo-600 font-bold text-sm">Inventario</Link>
              <Link to="/ingreso" className="text-slate-600 hover:text-indigo-600 font-bold text-sm">Ingresos</Link>
              <Link to="/salida" className="text-slate-600 hover:text-indigo-600 font-bold text-sm">Salidas</Link>
              <Link to="/historial" className="text-slate-600 hover:text-indigo-600 font-bold text-sm">Historial</Link>
              {role === 'GERENTE' && (
                <>
                  <Link to="/alertas" className="text-slate-600 hover:text-red-600 font-bold text-sm">Alertas</Link>
                  <Link to="/nube" className="text-slate-600 hover:text-indigo-600 font-bold text-sm">Nube Dual</Link>
                  <Link to="/config" className="text-slate-400 hover:text-indigo-600"><Cog6ToothIcon className="w-6 h-6" /></Link>
                </>
              )}
              <div className="h-6 w-[1px] bg-slate-200 mx-2"></div>
              <button onClick={() => pullData()} className={`p-2 rounded-lg transition-all ${isSyncing ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}>
                <ArrowPathIcon className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${supabase ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                {supabase ? <WifiIcon className="w-3.5 h-3.5" /> : <ExclamationTriangleIcon className="w-3.5 h-3.5" />}
                <span className="text-[10px] font-black uppercase tracking-widest">{supabase ? 'Nube' : 'Sin Config'}</span>
              </div>
              <button onClick={() => setRole(null)} className="text-slate-400 hover:text-red-600"><ArrowRightOnRectangleIcon className="w-6 h-6" /></button>
            </div>
          </div>
        </nav>

        <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<InventoryView reagents={reagents} />} />
            <Route path="/ingreso" element={<InputForm reagents={reagents} analysts={analysts} onTransaction={handleTransaction} transactions={transactions} />} />
            <Route path="/salida" element={<OutputForm reagents={reagents} analysts={analysts} onTransaction={handleTransaction} />} />
            <Route path="/historial" element={<HistoryView transactions={transactions} />} />
            <Route path="/alertas" element={role === 'GERENTE' ? <AlertsView reagents={reagents} markAsOrdered={() => {}} onUpdateMinStock={() => {}} notifications={notifications} /> : <Navigate to="/" />} />
            <Route path="/nube" element={role === 'GERENTE' ? <CloudSyncView supaUrl={supaUrl} setSupaUrl={(url) => { setSupaUrl(url); localStorage.setItem(STORAGE_KEY_SUPA_URL, url); }} supaKey={supaKey} setSupaKey={(key) => { setSupaKey(key); localStorage.setItem(STORAGE_KEY_SUPA_KEY, key); }} cloudUrl={cloudUrl} setCloudUrl={(url) => { setCloudUrl(url); localStorage.setItem(STORAGE_KEY_CLOUD_URL, url); }} showToast={showToast} onSync={pullData} /> : <Navigate to="/" />} />
            <Route path="/config" element={role === 'GERENTE' ? <ConfigView updateMgSettings={updateMgSettings} analysts={analysts} onAddAnalyst={addAnalyst} onRemoveAnalyst={removeAnalyst} currentMg={mgPassword} currentEmail={managerEmail} /> : <Navigate to="/" />} />
          </Routes>
        </main>

        <MobileNav />
      </div>
    </Router>
  );
};

export default App;