import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import emailjs from '@emailjs/browser';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  BeakerIcon, QueueListIcon, BellAlertIcon, PlusCircleIcon, MinusCircleIcon,
  ArrowRightOnRectangleIcon, HomeIcon, ChevronRightIcon, LockClosedIcon,
  Cog6ToothIcon, ClockIcon, CloudIcon, ArrowPathIcon, WifiIcon, ExclamationTriangleIcon, UserIcon,
  CalendarDaysIcon, ArchiveBoxXMarkIcon
} from '@heroicons/react/24/outline';

import { Reagent, Transaction, UserRole, AnalystUser } from './types';
import InventoryView from './components/InventoryView';
import InputForm from './components/InputForm';
import OutputForm from './components/OutputForm';
import HistoryView from './components/HistoryView';
import AlertsView from './components/AlertsView';
import ConfigView from './components/ConfigView';
import CloudSyncView from './components/CloudSyncView';
import EditReagentModal from './components/EditReagentModal';
import ExpiryModal from './components/ExpiryModal';
import { generateId, formatQuantity, normalizeToUnit } from './utils';

// Credenciales en .env.local (VITE_SUPABASE_URL / VITE_SUPABASE_KEY) o en localStorage via Nube Dual

const STORAGE_KEY_SUPA_URL = 'reagentflow_supa_url';
const STORAGE_KEY_SUPA_KEY = 'reagentflow_supa_key';
const STORAGE_KEY_CLOUD_URL = 'reagentflow_cloud_url';
const STORAGE_KEY_MG_PASSWORD = 'reagentflow_mg_pwd';
const STORAGE_KEY_GEMINI     = 'reagentflow_gemini_key';
const STORAGE_KEY_ANTHROPIC  = 'reagentflow_anthropic_key';
const STORAGE_KEY_SYNC_QUEUE = 'reagentflow_sync_queue';

// --- CONFIGURACIÓN EMAILJS (¡REEMPLAZA ESTOS VALORES!) ---
const EMAILJS_PUBLIC_KEY = "aMH7yh-WaX5jjiRUm"; 
const EMAILJS_SERVICE_ID = "controlreactivo_lab"; // EJ: "service_gmail"
const EMAILJS_TEMPLATE_ID = "template_czefw4r"; // EJ: "template_pedido"

interface NotificationLog {
  id: string;
  reagentName: string;
  timestamp: string;
  targetEmail: string;
  stockLevel: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
}

let globalSupabaseClient: SupabaseClient | null = null;
let globalSupaUrl = '';
let globalSupaKey = '';

interface QueueItem {
  id: string;
  action: string;
  payload: object;
  timestamp: string;
}

interface MobileNavProps {
  role: UserRole | null;
  reagents: Reagent[];
  onOpenExpiryModal: () => void;
  syncQueueCount: number;
}

const MobileNav: React.FC<MobileNavProps> = ({ role, reagents, onOpenExpiryModal, syncQueueCount }) => {
  const location = useLocation();
  const navItems = role === 'GERENTE'
    ? [
        { path: '/', icon: HomeIcon, label: 'Inicio' },
        { path: '/ingreso', icon: PlusCircleIcon, label: 'Entra' },
        { path: '/salida', icon: MinusCircleIcon, label: 'Sale' },
        { path: '/nube', icon: CloudIcon, label: 'Nube' },
        { path: '/config', icon: Cog6ToothIcon, label: 'Config' },
      ]
    : [
        { path: '/', icon: HomeIcon, label: 'Inicio' },
        { path: '/ingreso', icon: PlusCircleIcon, label: 'Entra' },
        { path: '/salida', icon: MinusCircleIcon, label: 'Sale' },
        { path: '/historial', icon: ClockIcon, label: 'Histo' },
      ];
  const urgentCount = reagents.filter(r => {
    if (!r.expiryDate || r.expiryDate === 'N/A') return false;
    return Math.ceil((new Date(r.expiryDate).getTime() - Date.now()) / 86400000) <= 30;
  }).length;
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 px-2 z-50">
      {navItems.map(item => (
        <Link key={item.path} to={item.path} className={`relative flex flex-col items-center justify-center w-full h-full transition-colors ${location.pathname === item.path ? 'text-indigo-600' : 'text-slate-400'}`}>
          <item.icon className="w-6 h-6" />
          {item.path === '/nube' && syncQueueCount > 0 && (
            <span className="absolute top-1 right-2 bg-amber-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
              {syncQueueCount > 9 ? '9+' : syncQueueCount}
            </span>
          )}
          <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">{item.label}</span>
        </Link>
      ))}
      <button onClick={onOpenExpiryModal} className="relative flex flex-col items-center justify-center w-full h-full transition-colors text-slate-400 hover:text-indigo-600">
        <CalendarDaysIcon className="w-6 h-6" />
        {urgentCount > 0 && <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{urgentCount}</span>}
        <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">Vence</span>
      </button>
    </div>
  );
};

const App: React.FC = () => {
  const getEnv = (key: string) => {
    // @ts-ignore
    return (import.meta.env?.[key]) || (typeof process !== 'undefined' ? process.env?.[key] : '') || '';
  };

  const VITE_URL = getEnv('VITE_SUPABASE_URL');
  const VITE_KEY = getEnv('VITE_SUPABASE_KEY');

  // --- Inicialización de Estado ---
  const [supaUrl, setSupaUrl] = useState<string>(
    localStorage.getItem(STORAGE_KEY_SUPA_URL) || VITE_URL || ''
  );
  const [supaKey, setSupaKey] = useState<string>(
    localStorage.getItem(STORAGE_KEY_SUPA_KEY) || VITE_KEY || ''
  );
  const [cloudUrl, setCloudUrl] = useState<string>(
    localStorage.getItem(STORAGE_KEY_CLOUD_URL) || ''
  );
  const [syncQueueCount, setSyncQueueCount] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_SYNC_QUEUE) || '[]').length; } catch { return 0; }
  });

  const [role, setRole] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<AnalystUser | null>(null); // Usuario logueado

  const [reagents, setReagents] = useState<Reagent[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [analysts, setAnalysts] = useState<AnalystUser[]>([]); // Lista de usuarios disponibles
  const [managerEmail, setManagerEmail] = useState<string>('');
  const [mgPassword, setMgPassword] = useState<string | null>(localStorage.getItem(STORAGE_KEY_MG_PASSWORD));
  const [geminiKey, setGeminiKey] = useState<string>(localStorage.getItem(STORAGE_KEY_GEMINI) || '');
  const [anthropicKey, setAnthropicKey] = useState<string>(localStorage.getItem(STORAGE_KEY_ANTHROPIC) || '');
  
  // Auth States
  const [authInput, setAuthInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showAnalystSelection, setShowAnalystSelection] = useState(false); // Modal para seleccionar analista
  const [editingReagentId, setEditingReagentId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'alert' | 'error' } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showExpiryModal, setShowExpiryModal] = useState(false);

  // --- Inicialización de Supabase ---
  const supabase: SupabaseClient | null = useMemo(() => {
    if (!supaUrl || !supaKey) return null;
    if (globalSupabaseClient && globalSupaUrl === supaUrl && globalSupaKey === supaKey) {
      return globalSupabaseClient;
    }
    try {
      if (!supaUrl.startsWith('http')) return null;
      globalSupabaseClient = createClient(supaUrl, supaKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
      globalSupaUrl = supaUrl;
      globalSupaKey = supaKey;
      return globalSupabaseClient;
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
          try {
            const parsed = JSON.parse(analystsRow.value);
            // Migración simple si antes eran strings
            if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
               setAnalysts(parsed.map((name: string) => ({ name, department: 'Fisicoquímico' })));
            } else {
               setAnalysts(parsed);
            }
          }
          catch { setAnalysts([]); }
        }
        const geminiRow = configData.find(d => d.key === 'gemini_api_key');
        if (geminiRow?.value) { setGeminiKey(geminiRow.value); localStorage.setItem(STORAGE_KEY_GEMINI, geminiRow.value); }
        const anthropicRow = configData.find(d => d.key === 'anthropic_api_key');
        if (anthropicRow?.value) { setAnthropicKey(anthropicRow.value); localStorage.setItem(STORAGE_KEY_ANTHROPIC, anthropicRow.value); }
        const cloudUrlRow = configData.find(d => d.key === 'cloud_url');
        if (cloudUrlRow?.value) { setCloudUrl(cloudUrlRow.value); localStorage.setItem(STORAGE_KEY_CLOUD_URL, cloudUrlRow.value); }
      }

      const { data: reagentsData } = await supabase.from('reagents').select('*');
      if (reagentsData) {
        // FILTRO SOFT DELETE: Solo mostrar los que NO están eliminados
        const activeReagents = reagentsData
          .map(r => ({
            ...r,
            currentStock: formatQuantity(parseFloat(r.current_stock), r.presentation),
            minStock: parseFloat(r.min_stock),
            quantityPerContainer: parseFloat(r.quantity_per_container),
            lastUpdated: r.last_updated,
            expiryDate: r.expiry_date,
            lot: r.lot || '',
            cas: r.cas || '',
            containerType: r.container_type,
            baseUnit: r.base_unit,
            isOrdered: r.is_ordered,
            isDeleted: r.is_deleted // Mapeamos la columna de DB
          }))
          .filter(r => !r.isDeleted); // Filtramos localmente

        setReagents(activeReagents);
      }

      const { data: transData } = await supabase.from('transactions').select('*').order('timestamp', { ascending: false }).limit(100);
      if (transData) {
        setTransactions(transData.map(t => ({
          ...t,
          reagentId: t.reagent_id,
          reagentName: t.reagent_name,
          reagentBrand: t.reagent_brand || '',
          displayQuantity: parseFloat(t.display_quantity),
          displayUnit: t.display_unit,
          quantity: parseFloat(t.quantity),
          lot: t.lot || '',
          verificationStatus: t.verification_status
        })));
      }
    } catch (e) {
      console.error("Critical Sync Error:", e);
      showToast("Error al sincronizar con Supabase. Verificá la conexión.", "error");
    } finally {
      setIsSyncing(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (EMAILJS_PUBLIC_KEY) emailjs.init(EMAILJS_PUBLIC_KEY);
    if (supabase) pullData();
  }, [supabase, pullData]);

  // Keep-alive: evita que Supabase pause el proyecto por inactividad (plan gratuito: 7 días sin actividad = pausa)
  useEffect(() => {
    if (!supabase) return;
    const ping = async () => {
      try { await supabase.from('config').select('key').limit(1); } catch (_) {}
    };
    ping(); // ping inmediato al conectar
    const id = setInterval(ping, 4 * 60 * 60 * 1000); // cada 4 horas mientras la app esté abierta
    return () => clearInterval(id);
  }, [supabase]);

  // --- Sincronización cuaderno electrónico con cola persistente ---
  const syncToSheets = useCallback(async (action: string, payload: object) => {
    if (!cloudUrl) return;
    const queue = JSON.parse(localStorage.getItem(STORAGE_KEY_SYNC_QUEUE) || '[]') as QueueItem[];
    const item: QueueItem = { id: generateId(), action, payload, timestamp: new Date().toISOString() };
    queue.push(item);
    localStorage.setItem(STORAGE_KEY_SYNC_QUEUE, JSON.stringify(queue));
    setSyncQueueCount(queue.length);
    try {
      await fetch(cloudUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY_SYNC_QUEUE) || '[]') as QueueItem[];
      const updated = current.filter(i => i.id !== item.id);
      localStorage.setItem(STORAGE_KEY_SYNC_QUEUE, JSON.stringify(updated));
      setSyncQueueCount(updated.length);
    } catch {
      showToast("Sin conexión: el registro se enviará al cuaderno cuando se restablezca.", "alert");
    }
  }, [cloudUrl]);

  // Reintento automático de registros pendientes al recuperar cloudUrl o al iniciar
  useEffect(() => {
    if (!cloudUrl) return;
    const retryQueue = async () => {
      const queue = JSON.parse(localStorage.getItem(STORAGE_KEY_SYNC_QUEUE) || '[]') as QueueItem[];
      if (queue.length === 0) return;
      let sent = 0;
      const remaining = [...queue];
      for (const item of queue) {
        try {
          await fetch(cloudUrl, {
            method: 'POST', mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: item.action, ...item.payload })
          });
          const idx = remaining.findIndex(i => i.id === item.id);
          if (idx > -1) { remaining.splice(idx, 1); sent++; }
        } catch { /* sigue en cola para el próximo intento */ }
      }
      localStorage.setItem(STORAGE_KEY_SYNC_QUEUE, JSON.stringify(remaining));
      setSyncQueueCount(remaining.length);
      if (sent > 0) showToast(`${sent} registro(s) pendiente(s) sincronizado(s) con el cuaderno.`, "success");
    };
    retryQueue();
  }, [cloudUrl]);

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

  const updateGeminiKey = async (key: string) => {
    setGeminiKey(key);
    localStorage.setItem(STORAGE_KEY_GEMINI, key);
    await saveConfigKey('gemini_api_key', key);
    showToast("Clave de Gemini guardada");
  };

  const updateAnthropicKey = async (key: string) => {
    setAnthropicKey(key);
    localStorage.setItem(STORAGE_KEY_ANTHROPIC, key);
    await saveConfigKey('anthropic_api_key', key);
    showToast("Clave de Claude guardada");
  };

  const addAnalyst = async (user: AnalystUser) => {
    const newAnalysts = [...analysts, user];
    setAnalysts(newAnalysts);
    await saveConfigKey('analysts', JSON.stringify(newAnalysts));
  };

  const removeAnalyst = async (name: string) => {
    const newAnalysts = analysts.filter(a => a.name !== name);
    setAnalysts(newAnalysts);
    await saveConfigKey('analysts', JSON.stringify(newAnalysts));
  };

  // --- FUNCIÓN DE ALERTA AUTOMÁTICA (Envío de correo) ---
  const sendLowStockAlert = async (reagent: Reagent, timestamp: string) => {
    if (!managerEmail) return; // No hacer nada si no hay correo configurado

    try {
        const templateParams = {
          to_email: managerEmail,
          reagent_name: reagent.name,
          brand: reagent.brand,
          current_stock: reagent.currentStock,
          base_unit: reagent.baseUnit,
          min_stock: reagent.minStock,
          timestamp: new Date(timestamp).toLocaleString('es-ES')
        };

        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
        
        setNotifications(prev => [{
          id: generateId(),
          reagentName: reagent.name,
          timestamp: timestamp,
          targetEmail: managerEmail,
          stockLevel: `${reagent.currentStock} ${reagent.baseUnit}`,
          status: 'SENT'
        }, ...prev]);
        
        showToast("¡Stock Bajo! Alerta enviada al gerente", "alert");

      } catch (error) {
        console.error("EmailJS Error:", error);
        setNotifications(prev => [{
          id: generateId(),
          reagentName: reagent.name,
          timestamp: timestamp,
          targetEmail: managerEmail,
          stockLevel: `${reagent.currentStock} ${reagent.baseUnit}`,
          status: 'FAILED'
        }, ...prev]);
      }
  };

  // --- Manejo de pedidos (Mark as Ordered) ---
  const handleMarkAsOrdered = async (ids: string[]) => {
    const timestamp = new Date().toISOString();
    const updatedReagents = reagents.map(r =>
      ids.includes(r.id) ? { ...r, isOrdered: true, lastUpdated: timestamp } : r
    );
    setReagents(updatedReagents);
    showToast("Orden de compra registrada", "success");

    if (supabase) {
      try {
        for (const id of ids) {
          const { error } = await supabase.from('reagents').update({ is_ordered: true, last_updated: timestamp }).eq('id', id);
          if (error) throw error;
        }
      } catch (error) {
        console.error("Error marcando como pedido:", error);
        showToast("Error al guardar en la nube. Recargando...", "error");
        pullData();
      }
    }
  };

  // --- ELIMINACIÓN DE REACTIVOS (SOFT DELETE) ---
  const handleDeleteReagent = (id: string) => {
    if (role !== 'GERENTE') return;
    const reagent = reagents.find(r => r.id === id);
    if (!reagent) return;
    if (reagent.currentStock > 0.01) {
      showToast("No se puede eliminar: Tiene stock", "error");
      return;
    }
    setDeleteConfirmId(id);
  };

  const confirmDeleteReagent = async (id: string) => {
    setDeleteConfirmId(null);
    const updatedReagents = reagents.filter(r => r.id !== id);
    setReagents(updatedReagents);
    showToast("Reactivo archivado", "success");

    if (supabase) {
      try {
        const { error } = await supabase.from('reagents').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
      } catch (error) {
        console.error("Error archivando reactivo:", error);
        showToast("Error al archivar en nube (¿Falta columna is_deleted?)", "error");
        pullData();
      }
    }

    if (cloudUrl) {
      try {
        await fetch(cloudUrl, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'SYNC_INVENTORY_SNAPSHOT', reagents: updatedReagents })
        });
      } catch (e) { console.error("Cloud snapshot update failed"); }
    }
  };

  // --- EDICIÓN DE REACTIVOS (GERENTE) ---
  const handleEditReagent = async (updatedReagent: Reagent) => {
    if (role !== 'GERENTE') return;

    const timestamp = new Date().toISOString();
    const oldReagent = reagents.find(r => r.id === updatedReagent.id);
    if (!oldReagent) return;

    // Actualización optimista
    const updatedReagents = reagents.map(r => r.id === updatedReagent.id ? { ...updatedReagent, lastUpdated: timestamp } : r);
    setReagents(updatedReagents);
    showToast("Reactivo actualizado", "success");

    // Registrar transacción de ajuste
    const newTransaction: Transaction = {
      id: generateId(),
      reagentId: updatedReagent.id,
      reagentName: updatedReagent.name,
      type: 'ADJUSTMENT',
      quantity: updatedReagent.currentStock, // Guardamos el stock final como cantidad
      displayQuantity: updatedReagent.currentStock,
      displayUnit: updatedReagent.baseUnit,
      analyst: 'GERENTE (Ajuste)',
      timestamp,
      lot: updatedReagent.lot || '',
      verificationStatus: undefined
    };
    setTransactions([newTransaction, ...transactions]);

    if (supabase) {
      try {
        const { error: rError } = await supabase.from('reagents').upsert({
          id: updatedReagent.id, name: updatedReagent.name, brand: updatedReagent.brand, presentation: updatedReagent.presentation,
          current_stock: updatedReagent.currentStock, min_stock: updatedReagent.minStock, department: updatedReagent.department,
          base_unit: updatedReagent.baseUnit, container_type: updatedReagent.containerType, quantity_per_container: updatedReagent.quantityPerContainer,
          expiry_date: updatedReagent.expiryDate, lot: updatedReagent.lot || null, cas: updatedReagent.cas || null,
          is_ordered: updatedReagent.isOrdered, last_updated: timestamp,
          is_deleted: false
        });
        if (rError) throw rError;

        const { error: txError } = await supabase.from('transactions').insert({
          id: newTransaction.id, reagent_id: newTransaction.reagentId, reagent_name: newTransaction.reagentName,
          type: newTransaction.type, quantity: newTransaction.quantity, display_quantity: newTransaction.displayQuantity,
          display_unit: newTransaction.displayUnit, analyst: newTransaction.analyst, timestamp: newTransaction.timestamp,
          lot: newTransaction.lot || null, reagent_brand: updatedReagent.brand || null,
          verification_status: newTransaction.verificationStatus || null
        });
        if (txError) throw txError;
        setEditingReagentId(null);
      } catch (error) {
        console.error("Error editando reactivo:", error);
        showToast("Error al guardar cambios en la nube", "error");
        pullData();
      }
    } else {
      setEditingReagentId(null);
    }
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
        let newStock = updatedReagents[idx].currentStock;
        let newMinStock = updatedReagents[idx].minStock;
        let newQuantityPerContainer = updatedReagents[idx].quantityPerContainer;
        let newBaseUnit = updatedReagents[idx].baseUnit;

        // Si la unidad base del nuevo ingreso es diferente (ej. de L a mL), normalizamos el stock existente
        if (reagent.baseUnit && reagent.baseUnit !== updatedReagents[idx].baseUnit) {
           newStock = normalizeToUnit(newStock, updatedReagents[idx].baseUnit, reagent.baseUnit);
           newMinStock = normalizeToUnit(newMinStock, updatedReagents[idx].baseUnit, reagent.baseUnit);
           newQuantityPerContainer = normalizeToUnit(newQuantityPerContainer, updatedReagents[idx].baseUnit, reagent.baseUnit);
           newBaseUnit = reagent.baseUnit;
        }

        finalReagent = {
          ...updatedReagents[idx],
          currentStock: formatQuantity(newStock + transactionData.quantity, updatedReagents[idx].presentation),
          minStock: newMinStock,
          quantityPerContainer: newQuantityPerContainer,
          baseUnit: newBaseUnit,
          lastUpdated: timestamp,
          // Actualiza lote y CAS si el nuevo ingreso los trae (reposición de stock)
          lot: (reagent.lot !== undefined && reagent.lot !== '') ? reagent.lot : updatedReagents[idx].lot,
          cas: (reagent.cas !== undefined && reagent.cas !== '') ? reagent.cas : updatedReagents[idx].cas,
          expiryDate: (reagent.expiryDate && reagent.expiryDate !== 'N/A') ? reagent.expiryDate : updatedReagents[idx].expiryDate,
          isOrdered: false
        };
        updatedReagents[idx] = finalReagent;
      } else {
        finalReagent = {
          id: reagentId || generateId(),
          name: reagent.name!,
          brand: reagent.brand!,
          presentation: reagent.presentation!,
          currentStock: formatQuantity(transactionData.quantity, reagent.presentation!),
          minStock: reagent.minStock || 0,
          department: reagent.department!,
          baseUnit: reagent.baseUnit || 'ud',
          containerType: reagent.containerType || 'Frasco',
          quantityPerContainer: reagent.quantityPerContainer || 1,
          expiryDate: reagent.expiryDate || 'N/A',
          lot: reagent.lot || '',
          cas: reagent.cas || '',
          isOrdered: false,
          lastUpdated: timestamp,
          isDeleted: false
        };
        updatedReagents.push(finalReagent);
        reagentId = finalReagent.id;
      }
    } else {
      // TRANSACCIÓN DE SALIDA (OUT)
      const idx = updatedReagents.findIndex(r => r.id === reagentId);
      if (idx === -1) return;
      
      finalReagent = { 
        ...updatedReagents[idx], 
        currentStock: formatQuantity(Math.max(0, updatedReagents[idx].currentStock - transactionData.quantity), updatedReagents[idx].presentation), 
        lastUpdated: timestamp 
      };
      updatedReagents[idx] = finalReagent;

      // DETECCIÓN DE STOCK BAJO GLOBAL (Sumando todas las marcas del mismo reactivo)
      const sameNameReagents = updatedReagents.filter(r => 
        r.name.toUpperCase() === finalReagent.name.toUpperCase() && !r.isDeleted
      );
      
      const totalCurrentStock = formatQuantity(
        sameNameReagents.reduce((sum, r) => sum + normalizeToUnit(r.currentStock, r.baseUnit, finalReagent.baseUnit), 0), 
        finalReagent.presentation
      );
      const totalPreviousStock = formatQuantity(
        totalCurrentStock + transactionData.quantity, 
        finalReagent.presentation
      );
      const isAnyBrandOrdered = sameNameReagents.some(r => r.isOrdered);

      if (totalPreviousStock > finalReagent.minStock && totalCurrentStock <= finalReagent.minStock && !isAnyBrandOrdered) {
         const alertReagent = {
           ...finalReagent,
           currentStock: totalCurrentStock,
           brand: sameNameReagents.length > 1 ? 'Múltiples Marcas (Total)' : finalReagent.brand
         };
         sendLowStockAlert(alertReagent as Reagent, timestamp);
      }
    }

    const newTransaction: Transaction = {
      ...transactionData,
      id: generateId(),
      reagentId: reagentId!,
      reagentName: finalReagent.name,
      reagentBrand: finalReagent.brand,
      timestamp
    };

    // 1. GUARDAR EN SUPABASE PRIMERO — la UI no se actualiza hasta confirmar en DB
    if (supabase) {
      setIsSyncing(true);

      const { error: rError } = await supabase.from('reagents').upsert({
        id: finalReagent.id, name: finalReagent.name, brand: finalReagent.brand, presentation: finalReagent.presentation,
        current_stock: finalReagent.currentStock, min_stock: finalReagent.minStock, department: finalReagent.department,
        base_unit: finalReagent.baseUnit, container_type: finalReagent.containerType, quantity_per_container: finalReagent.quantityPerContainer,
        expiry_date: finalReagent.expiryDate, lot: finalReagent.lot || null, cas: finalReagent.cas || null,
        is_ordered: finalReagent.isOrdered, last_updated: finalReagent.lastUpdated,
        is_deleted: false
      });

      if (rError) {
        setIsSyncing(false);
        showToast(rError.message.includes('lot')
          ? "Falta la columna 'lot' en Supabase (reagents)"
          : "Error al guardar en la nube. La transacción NO fue registrada.", "error");
        return;
      }

      const { error: txError } = await supabase.from('transactions').insert({
        id: newTransaction.id, reagent_id: newTransaction.reagentId, reagent_name: newTransaction.reagentName,
        type: newTransaction.type, quantity: newTransaction.quantity, display_quantity: newTransaction.displayQuantity,
        display_unit: newTransaction.displayUnit, analyst: newTransaction.analyst, timestamp: newTransaction.timestamp,
        lot: newTransaction.lot || null,
        reagent_brand: newTransaction.reagentBrand || null,
        verification_status: newTransaction.verificationStatus || null
      });

      if (txError) {
        setIsSyncing(false);
        showToast(txError.message.includes('verification_status')
          ? "Falta la columna 'verification_status' en Supabase"
          : txError.message.includes('lot')
            ? "Falta la columna 'lot' en Supabase (transactions)"
            : txError.message.includes('reagent_brand')
              ? "Falta la columna 'reagent_brand' en Supabase (transactions)"
              : "Error al registrar la transacción. Revisa el inventario.", "error");
        pullData();
        return;
      }

      setIsSyncing(false);
    }

    // 2. Actualizar UI — solo llega aquí si DB confirmó (o si no hay Supabase configurado)
    setReagents(updatedReagents);
    setTransactions([newTransaction, ...transactions]);
    showToast(`${transactionData.type === 'IN' ? 'Ingreso' : 'Salida'} registrada`);

    // 3. Sincronizar cuaderno electrónico (con cola persistente y reintentos automáticos)
    syncToSheets('LOG_TRANSACTION', { transaction: newTransaction });
    setTimeout(() => syncToSheets('SYNC_INVENTORY_SNAPSHOT', { reagents: updatedReagents }), 1000);
  };

  const handleRecoverHistory = async (): Promise<number> => {
    if (!supabase) throw new Error("No hay conexión a Supabase configurada");
    if (!cloudUrl) throw new Error("No hay URL del cuaderno electrónico configurada");

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('timestamp', { ascending: true });

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return 0;

    for (const t of data) {
      const transaction = {
        id: t.id,
        reagentId: t.reagent_id,
        reagentName: t.reagent_name,
        type: t.type,
        quantity: parseFloat(t.quantity),
        displayQuantity: parseFloat(t.display_quantity),
        displayUnit: t.display_unit,
        analyst: t.analyst,
        timestamp: t.timestamp,
        lot: t.lot || '',
        verificationStatus: t.verification_status
      };
      await fetch(cloudUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'LOG_TRANSACTION', transaction })
      });
      // Pausa entre requests para no saturar Apps Script
      await new Promise(res => setTimeout(res, 300));
    }

    await fetch(cloudUrl, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SYNC_INVENTORY_SNAPSHOT', reagents })
    });

    return data.length;
  };

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
            <button onClick={() => setShowAnalystSelection(true)} className="w-full bg-slate-50 border-2 border-slate-200 hover:border-indigo-600 hover:text-indigo-600 text-slate-700 font-bold py-5 px-6 rounded-2xl transition-all flex items-center justify-between group">
              <div className="flex items-center gap-3"><QueueListIcon className="w-6 h-6" /><span>Analista</span></div>
              <ChevronRightIcon className="w-5 h-5 opacity-50 group-hover:opacity-100" />
            </button>
            <button onClick={() => { setAuthInput(''); setAuthError(''); setShowManagerModal(true); }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 px-6 rounded-2xl transition-all flex items-center justify-between group shadow-xl">
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
        
        {/* Modal Selección Analista */}
        {showAnalystSelection && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center gap-3 text-left">
                <div className="p-2 bg-indigo-100 rounded-lg"><UserIcon className="w-6 h-6 text-indigo-600" /></div>
                <div><h3 className="font-bold text-slate-800">Seleccionar Usuario</h3><p className="text-xs text-slate-500">Acceso como Analista</p></div>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto scrollbar-hide space-y-2">
                {isSyncing ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <ArrowPathIcon className="w-8 h-8 animate-spin mb-2" />
                    <p className="text-sm font-bold">Cargando analistas...</p>
                  </div>
                ) : analysts.length > 0 ? analysts.map((a, idx) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      setCurrentUser(a);
                      setRole('ANALISTA');
                      setShowAnalystSelection(false);
                      showToast(`Bienvenido/a, ${a.name}`);
                    }}
                    className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-xl flex justify-between items-center group transition-all"
                  >
                    <div className="text-left">
                      <p className="font-bold text-slate-700 group-hover:text-indigo-700">{a.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{a.department}</p>
                    </div>
                    <ChevronRightIcon className="w-5 h-5 text-slate-300 group-hover:text-indigo-500" />
                  </button>
                )) : (
                   <p className="text-center text-slate-400 text-sm py-8 italic">No hay analistas registrados. Pida al gerente que los añada.</p>
                )}
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50">
                 <button onClick={() => setShowAnalystSelection(false)} className="w-full py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Auth Gerente */}
        {showManagerModal && (
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
                  updateMgSettings(authInput); setRole('GERENTE'); setShowManagerModal(false);
                }
                else if (authInput === mgPassword) { setRole('GERENTE'); setShowManagerModal(false); }
                else { setAuthError('Clave incorrecta'); }
              }} className="p-6 space-y-4">
                <input autoFocus type="password" placeholder="****" className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all text-center text-2xl tracking-widest font-bold" value={authInput} onChange={(e) => setAuthInput(e.target.value)} />
                {authError && <p className="text-red-600 text-xs font-bold text-center">{authError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowManagerModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cerrar</button>
                  <button type="submit" className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg">Entrar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-slate-50 pb-20 md:pb-0">
        {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${toast.type === 'alert' ? 'bg-amber-600 text-white' : toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`}>
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        )}
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm hidden md:block">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16">
            <div className="flex items-center gap-2"><BeakerIcon className="h-8 w-8 text-indigo-600" /><span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">ReagentFlow</span></div>
            <div className="flex items-center gap-6">
              <Link to="/" className="text-slate-600 hover:text-indigo-600 font-bold text-sm">Inventario</Link>
              <Link to="/ingreso" className="text-slate-600 hover:text-indigo-600 font-bold text-sm">Ingresos</Link>
              <Link to="/salida" className="text-slate-600 hover:text-indigo-600 font-bold text-sm">Salidas</Link>
              <Link to="/historial" className="text-slate-600 hover:text-indigo-600 font-bold text-sm">Historial</Link>
              <button onClick={() => setShowExpiryModal(true)} className="relative text-slate-400 hover:text-indigo-600 p-1">
                <CalendarDaysIcon className="w-5 h-5" />
                {reagents.some(r => r.expiryDate && r.expiryDate !== 'N/A' && Math.ceil((new Date(r.expiryDate).getTime() - Date.now()) / 86400000) <= 30) && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
                )}
              </button>
              {role === 'GERENTE' && (
                <>
                  <Link to="/alertas" className="text-slate-600 hover:text-red-600 font-bold text-sm">Alertas</Link>
                  <Link to="/nube" className="relative text-slate-600 hover:text-indigo-600 font-bold text-sm">
                    Nube Dual
                    {syncQueueCount > 0 && (
                      <span className="absolute -top-2 -right-4 bg-amber-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                        {syncQueueCount > 9 ? '9+' : syncQueueCount}
                      </span>
                    )}
                  </Link>
                  <Link to="/config" className="text-slate-400 hover:text-indigo-600"><Cog6ToothIcon className="w-6 h-6" /></Link>
                </>
              )}
              {role === 'ANALISTA' && currentUser && (
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg">
                   <UserIcon className="w-4 h-4 text-indigo-500"/>
                   <span className="text-xs font-bold text-slate-600">{currentUser.name}</span>
                </div>
              )}
              <div className="h-6 w-[1px] bg-slate-200 mx-2"></div>
              <button onClick={() => pullData()} className={`p-2 rounded-lg transition-all ${isSyncing ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}>
                <ArrowPathIcon className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${supabase ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                {supabase ? <WifiIcon className="w-3.5 h-3.5" /> : <ExclamationTriangleIcon className="w-3.5 h-3.5" />}
                <span className="text-[10px] font-black uppercase tracking-widest">{supabase ? 'Nube' : 'Sin Config'}</span>
              </div>
              <button onClick={() => { setRole(null); setCurrentUser(null); }} className="text-slate-400 hover:text-red-600"><ArrowRightOnRectangleIcon className="w-6 h-6" /></button>
            </div>
          </div>
        </nav>
        <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<InventoryView reagents={reagents} userRole={role} onDelete={handleDeleteReagent} onEdit={setEditingReagentId} />} />
            <Route path="/ingreso" element={<InputForm reagents={reagents} analysts={analysts} onTransaction={handleTransaction} transactions={transactions} currentUser={currentUser} userRole={role} supabase={supabase} />} />
            <Route path="/salida" element={<OutputForm reagents={reagents} analysts={analysts} onTransaction={handleTransaction} currentUser={currentUser} userRole={role} />} />
            <Route path="/historial" element={<HistoryView transactions={transactions} reagents={reagents} />} />
            <Route path="/alertas" element={role === 'GERENTE' ? <AlertsView reagents={reagents} markAsOrdered={handleMarkAsOrdered} onUpdateMinStock={() => {}} notifications={notifications} /> : <Navigate to="/" />} />
            <Route path="/nube" element={role === 'GERENTE' ? <CloudSyncView supaUrl={supaUrl} setSupaUrl={(url) => { setSupaUrl(url); localStorage.setItem(STORAGE_KEY_SUPA_URL, url); }} supaKey={supaKey} setSupaKey={(key) => { setSupaKey(key); localStorage.setItem(STORAGE_KEY_SUPA_KEY, key); }} cloudUrl={cloudUrl} setCloudUrl={(url) => { setCloudUrl(url); localStorage.setItem(STORAGE_KEY_CLOUD_URL, url); saveConfigKey('cloud_url', url); }} showToast={showToast} onSync={pullData} onRecoverHistory={handleRecoverHistory} /> : <Navigate to="/" />} />
            <Route path="/config" element={role === 'GERENTE' ? <ConfigView updateMgSettings={updateMgSettings} analysts={analysts} onAddAnalyst={addAnalyst} onRemoveAnalyst={removeAnalyst} currentMg={mgPassword} currentEmail={managerEmail} geminiKey={geminiKey} onUpdateGeminiKey={updateGeminiKey} anthropicKey={anthropicKey} onUpdateAnthropicKey={updateAnthropicKey} /> : <Navigate to="/" />} />
          </Routes>
        </main>
        <MobileNav role={role} reagents={reagents} onOpenExpiryModal={() => setShowExpiryModal(true)} syncQueueCount={syncQueueCount} />
        {deleteConfirmId && (() => {
          const reagent = reagents.find(r => r.id === deleteConfirmId);
          return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-red-50 p-6 border-b border-red-100 flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg"><ArchiveBoxXMarkIcon className="w-6 h-6 text-red-600" /></div>
                  <div><h3 className="font-bold text-slate-800">¿Archivar reactivo?</h3><p className="text-xs text-slate-500">Esta acción no se puede deshacer</p></div>
                </div>
                <div className="p-6 space-y-2">
                  <p className="font-bold text-slate-800">{reagent?.name} — {reagent?.brand}</p>
                  <p className="text-sm text-slate-500">El reactivo desaparecerá del inventario y formularios. El historial de movimientos se conservará en la base de datos.</p>
                </div>
                <div className="p-4 flex gap-3 border-t border-slate-100">
                  <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                  <button onClick={() => confirmDeleteReagent(deleteConfirmId)} className="flex-[2] bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-lg transition-colors">Archivar definitivamente</button>
                </div>
              </div>
            </div>
          );
        })()}
        {editingReagentId && (
          <EditReagentModal
            reagent={reagents.find(r => r.id === editingReagentId)!}
            onClose={() => setEditingReagentId(null)}
            onSave={handleEditReagent}
          />
        )}
        {showExpiryModal && (
          <ExpiryModal
            reagents={reagents}
            onClose={() => setShowExpiryModal(false)}
          />
        )}
      </div>
    </Router>
  );
};

export default App;