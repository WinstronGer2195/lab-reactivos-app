import React, { useState, useRef, useMemo, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { Reagent, Presentation, Department, Transaction, AnalystUser, UserRole } from '../types';
import { analyzeReagentLabel } from '../services/aiService';
import { getCachedResult, saveCachedResult } from '../services/cacheService';
import { fileToBase64, generateId, formatQuantity } from '../utils';
import { 
  CameraIcon, 
  SparklesIcon, 
  ArrowPathIcon,
  PlusIcon,
  PencilSquareIcon,
  UserIcon,
  BuildingOfficeIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/solid';

interface Props {
  reagents: Reagent[];
  analysts: AnalystUser[];
  transactions: Transaction[];
  onTransaction: (reagent: Partial<Reagent>, data: any) => void;
  currentUser: AnalystUser | null;
  userRole: UserRole | null;
  supabase: SupabaseClient | null;
}

const BASE_UNITS_LIQUID = ['mL', 'L', 'uL'];
const BASE_UNITS_SOLID = ['g', 'kg', 'mg'];
const BASE_UNITS_PKG = ['unidades', 'Rx'];

const InputForm: React.FC<Props> = ({ reagents, analysts, transactions, onTransaction, currentUser, userRole, supabase }) => {
  const [loading, setLoading] = useState(false);
  const [isExisting, setIsExisting] = useState(false);
  const [isNewBrandForExisting, setIsNewBrandForExisting] = useState(false);
  const [selectedReagentId, setSelectedReagentId] = useState('');
  const [isCustomUnitMode, setIsCustomUnitMode] = useState(false);
  const [currentImageBase64, setCurrentImageBase64] = useState<string | null>(null);
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    lot: '',
    department: (currentUser?.department || 'Fisicoquímico') as Department,
    analystName: currentUser?.name || (userRole === 'GERENTE' ? 'GERENTE' : ''),
    minStock: 0,
    verificationStatus: 'No Conforme' as 'Conforme' | 'No Conforme'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determinar lista de unidades basada en presentación
  const unitsForPresentation = useMemo(() => {
    let units = [];
    if (formData.presentation === 'Líquido') units = [...BASE_UNITS_LIQUID];
    else if (formData.presentation === 'Sólido') units = [...BASE_UNITS_SOLID];
    else units = [...BASE_UNITS_PKG];
    
    return units;
  }, [formData.presentation]);

  // Resetear unidad y ajustar tipo de envase si cambia la presentación
  useEffect(() => {
    setFormData(prev => {
      const updates: any = {};
      
      // Lógica de Unidades
      if (!isCustomUnitMode) {
        if (formData.presentation === 'Líquido' && !BASE_UNITS_LIQUID.includes(prev.baseUnit)) {
          updates.baseUnit = 'mL';
        } else if (formData.presentation === 'Sólido' && !BASE_UNITS_SOLID.includes(prev.baseUnit)) {
          updates.baseUnit = 'g';
        } else if (formData.presentation === 'Paquete' && !BASE_UNITS_PKG.includes(prev.baseUnit)) {
          updates.baseUnit = 'unidades';
        }
      }

      // Lógica de Tipo de Envase (Solicitud Usuario)
      if (formData.presentation === 'Paquete') {
         updates.containerType = 'Paquete';
      } else if (prev.containerType === 'Paquete') {
         updates.containerType = 'Frascos';
      }

      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
    });
  }, [formData.presentation, isCustomUnitMode]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calcular la frecuencia de uso para ordenar el dropdown
  const sortedReagents = useMemo(() => {
    // 1. Filtrar por departamento del usuario (si hay usuario logueado)
    let filtered = reagents;
    if (currentUser) {
        filtered = reagents.filter(r => r.department === currentUser.department);
    }
    // Si es gerente, ve todos (no se filtra por departamento en el select inicial)

    // 2. Calcular frecuencia
    const usageCount: Record<string, number> = {};
    transactions.forEach(t => {
        usageCount[t.reagentId] = (usageCount[t.reagentId] || 0) + 1;
    });

    // 3. Ordenar (Mayor uso primero, luego alfabéticamente)
    return filtered.sort((a, b) => {
        const countA = usageCount[a.id] || 0;
        const countB = usageCount[b.id] || 0;
        if (countB !== countA) return countB - countA;
        return a.name.localeCompare(b.name);
    });
  }, [reagents, currentUser, transactions]);

  const groupedReagents = useMemo(() => {
    const groups: Record<string, Reagent[]> = {};
    sortedReagents.forEach(r => {
      if (!groups[r.name]) groups[r.name] = [];
      groups[r.name].push(r);
    });
    return groups;
  }, [sortedReagents]);

  const totalBaseQuantity = useMemo(() => {
    return formatQuantity(formData.quantityEntered * formData.quantityPerContainer, formData.presentation);
  }, [formData.quantityEntered, formData.quantityPerContainer, formData.presentation]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      setCurrentImageBase64(base64);

      // 1. Verificar cache de Supabase primero (resultado instantáneo para imágenes repetidas)
      let analysisResult = null;
      if (supabase) {
        analysisResult = await getCachedResult(supabase, base64);
        if (analysisResult) console.log('Cache hit — resultado instantáneo desde Supabase');
      }

      // 2. Si no está en cache, llamar a la IA
      if (!analysisResult) {
        analysisResult = await analyzeReagentLabel(base64, reagents.map(r => ({ name: r.name, brand: r.brand })));
        // Guardar en cache para la próxima vez
        if (supabase) saveCachedResult(supabase, base64, analysisResult);
      }
      
      const newPresentation = (analysisResult.presentation === 'Líquido' || analysisResult.presentation === 'Sólido' || analysisResult.presentation === 'Paquete')
        ? analysisResult.presentation
        : 'Líquido';

      let newBaseUnit = 'mL';
      if (newPresentation === 'Sólido') newBaseUnit = 'g';
      if (newPresentation === 'Paquete') newBaseUnit = 'unidades';

      // Convertir a mayúsculas lo que viene de la IA/OCR
      const upperName = (analysisResult.name || '').toUpperCase();
      const upperBrand = (analysisResult.brand || '').toUpperCase();

      // Normalizar fecha de vencimiento al formato YYYY-MM-DD que espera el input[type=date]
      const parseAIDate = (raw?: string): string => {
        if (!raw || raw === 'null') return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        // MM/YYYY → último día del mes
        const mmYYYY = raw.match(/^(\d{2})\/(\d{4})$/);
        if (mmYYYY) {
          const lastDay = new Date(parseInt(mmYYYY[2]), parseInt(mmYYYY[1]), 0).getDate();
          return `${mmYYYY[2]}-${mmYYYY[1]}-${String(lastDay).padStart(2, '0')}`;
        }
        // MM/YY → asume 20YY
        const mmYY = raw.match(/^(\d{2})\/(\d{2})$/);
        if (mmYY) {
          const year = `20${mmYY[2]}`;
          const lastDay = new Date(parseInt(year), parseInt(mmYY[1]), 0).getDate();
          return `${year}-${mmYY[1]}-${String(lastDay).padStart(2, '0')}`;
        }
        return '';
      };

      setFormData(prev => ({
        ...prev,
        name: upperName,
        brand: upperBrand,
        presentation: newPresentation,
        baseUnit: newBaseUnit,
        lot: analysisResult.lot && analysisResult.lot !== 'null' ? analysisResult.lot : prev.lot,
        expiryDate: parseAIDate(analysisResult.expiryDate) || prev.expiryDate
      }));

      const existingExact = reagents.find(r => 
        r.name.toUpperCase() === upperName && 
        r.brand.toUpperCase() === upperBrand
      );

      if (existingExact) {
        setIsExisting(true);
        setIsNewBrandForExisting(false);
        setSelectedReagentId(existingExact.id);
        setIsCustomUnitMode(false); 
        setFormData(prev => ({ 
          ...prev, 
          baseUnit: existingExact.baseUnit, 
          containerType: existingExact.containerType,
          quantityPerContainer: existingExact.quantityPerContainer,
          minStock: existingExact.minStock,
          department: existingExact.department,
          presentation: existingExact.presentation
        }));
      } else {
        const existingName = reagents.find(r => r.name.toUpperCase() === upperName);
        if (existingName) {
          setIsExisting(false);
          setIsNewBrandForExisting(true);
          setSelectedReagentId('');
          setIsCustomUnitMode(false);
          setFormData(prev => ({
            ...prev,
            name: existingName.name,
            brand: upperBrand,
            baseUnit: existingName.baseUnit,
            containerType: existingName.containerType,
            quantityPerContainer: existingName.quantityPerContainer,
            minStock: existingName.minStock,
            department: existingName.department,
            presentation: existingName.presentation
          }));
        } else {
          setIsExisting(false);
          setIsNewBrandForExisting(false);
          setIsCustomUnitMode(false);
        }
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Error analizando la etiqueta. Por favor intente de nuevo o ingrese manualmente.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.analystName) {
      alert("Error de sesión: No hay analista asignado.");
      return;
    }

    // --- VALIDACIÓN DE DUPLICADOS (Solo para nuevos reactivos) ---
    if (!isExisting) {
      const normalizedName = formData.name.trim().toUpperCase();
      const normalizedBrand = formData.brand.trim().toUpperCase();

      const possibleDuplicate = reagents.find(r => {
        const rName = r.name.toUpperCase();
        const rBrand = r.brand.toUpperCase();
        
        // Coincidencia estricta de marca (porque es desplegable o tipificado con cuidado)
        // Y coincidencia parcial de nombre (uno contiene al otro)
        const brandMatch = rBrand === normalizedBrand;
        const nameOverlap = rName.includes(normalizedName) || normalizedName.includes(rName);

        return brandMatch && nameOverlap;
      });

      if (possibleDuplicate) {
        const confirmCreate = window.confirm(
          `⚠️ ¡POSIBLE DUPLICADO DETECTADO!\n\n` +
          `Ya existe un reactivo similar en el inventario:\n` +
          `Nombre: ${possibleDuplicate.name}\n` +
          `Marca: ${possibleDuplicate.brand}\n` +
          `Stock actual: ${possibleDuplicate.currentStock} ${possibleDuplicate.baseUnit}\n\n` +
          `Está intentando crear: "${normalizedName}" (${normalizedBrand}).\n\n` +
          `¿Está SEGURO de que desea crear uno nuevo en lugar de usar el existente?`
        );
        if (!confirmCreate) {
          return; // Cancelar el submit
        }
      }
    }
    // -----------------------------------------------------------
    
    const finalReagentId = (isExisting) ? selectedReagentId : undefined;

    let finalQuantityPerContainer = formData.quantityPerContainer;
    let finalBaseUnit = formData.baseUnit;
    let finalMinStock = formData.minStock;

    const upperUnit = finalBaseUnit.toUpperCase().trim();
    if (upperUnit === 'L' || upperUnit === 'LITROS' || upperUnit === 'LITRO') {
      finalQuantityPerContainer = Math.round(finalQuantityPerContainer * 1000);
      finalMinStock = Math.round(finalMinStock * 1000);
      finalBaseUnit = 'mL';
    } else if (upperUnit === 'KG' || upperUnit === 'KILOGRAMOS' || upperUnit === 'KILOGRAMO') {
      finalQuantityPerContainer = Math.round(finalQuantityPerContainer * 1000);
      finalMinStock = Math.round(finalMinStock * 1000);
      finalBaseUnit = 'g';
    }

    const finalTotalBaseQuantity = formatQuantity(formData.quantityEntered * finalQuantityPerContainer, formData.presentation);

    onTransaction(
      {
        id: finalReagentId,
        name: formData.name.toUpperCase(), // Asegurar mayúsculas al guardar
        brand: formData.brand.toUpperCase(), // Asegurar mayúsculas al guardar
        presentation: formData.presentation,
        department: formData.department,
        expiryDate: formData.expiryDate || 'N/A',
        lot: formData.lot || '',
        minStock: finalMinStock,
        containerType: formData.containerType,
        quantityPerContainer: finalQuantityPerContainer,
        baseUnit: finalBaseUnit
      },
      {
        reagentId: finalReagentId,
        type: 'IN',
        quantity: finalTotalBaseQuantity,
        displayQuantity: formData.quantityEntered,
        displayUnit: formData.containerType,
        analyst: formData.analystName,
        lot: formData.lot || '',
        verificationStatus: (formData.department === 'Microbiología' || formData.department === 'Molecular') ? formData.verificationStatus : undefined
      }
    );

    // Resetear formulario pero mantener usuario y depto si no es nuevo
    setFormData(prev => ({
      ...prev,
      name: '', brand: '', presentation: 'Líquido', containerType: 'Frascos',
      quantityEntered: 0, quantityPerContainer: 1, baseUnit: 'mL', 
      expiryDate: '', lot: '', minStock: 0,
      verificationStatus: 'No Conforme',
      // Si es Gerente y estaba creando uno nuevo, resetear depto a default, si es analista mantener su depto
      department: currentUser?.department || 'Fisicoquímico'
    }));
    setIsExisting(false);
    setIsNewBrandForExisting(false);
    setSelectedReagentId('');
    setIsCustomUnitMode(false);
    setCurrentImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Lógica para saber si el campo departamento es editable
  // Es editable SI: NO es un reactivo existente Y el usuario es GERENTE
  const canEditDepartment = !isExisting && !isNewBrandForExisting && userRole === 'GERENTE';

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 min-h-[500px]">
        <div className="bg-indigo-600 p-6 text-white flex justify-between items-center rounded-t-3xl">
          <div>
            <h2 className="text-xl font-bold">Registro de Ingreso</h2>
            <p className="text-indigo-100 text-sm">
                {currentUser ? `Analista: ${currentUser.name} | Dept: ${currentUser.department}` : (userRole === 'GERENTE' ? 'Modo Gerente: Acceso Total' : 'Complete los datos')}
            </p>
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
              {loading ? "Escaneando..." : "Foto Cámara"}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" capture="environment" accept="image/*" onChange={handleImageUpload} />

            <div className="relative" ref={dropdownRef}>
              <div 
                className="bg-slate-50 border-2 border-slate-200 py-4 px-4 rounded-2xl text-slate-700 font-bold outline-none focus:border-indigo-500 cursor-pointer flex justify-between items-center h-full"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className="truncate">
                  {isExisting && selectedReagentId 
                    ? (() => {
                        const r = reagents.find(x => x.id === selectedReagentId);
                        return r ? `${r.name} - ${r.brand}` : '+ Nuevo Reactivo';
                      })()
                    : isNewBrandForExisting
                      ? `${formData.name} - (Nueva Marca)`
                      : '+ Nuevo Reactivo (Nombre y Marca nuevos)'}
                </span>
                <span className="text-slate-400 text-xs ml-2">▼</span>
              </div>
              
              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border-2 border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto">
                  <div className="sticky top-0 bg-white p-2 border-b border-slate-100">
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium"
                      placeholder="Buscar por nombre o marca..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                  <div 
                    className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 font-bold ${!isExisting && !isNewBrandForExisting ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
                    onClick={() => {
                      setIsExisting(false);
                      setIsNewBrandForExisting(false);
                      setSelectedReagentId('');
                      setIsCustomUnitMode(false);
                      setFormData(prev => ({ 
                        ...prev, 
                        name: '', brand: '', minStock: 0, 
                        department: currentUser?.department || 'Fisicoquímico' 
                      }));
                      setIsDropdownOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    + Nuevo Reactivo (Nombre y Marca nuevos)
                  </div>
                  {(Object.entries(groupedReagents) as [string, any][])
                    .filter(([name, items]) => 
                      name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      items.some((r: any) => r.brand.toLowerCase().includes(searchQuery.toLowerCase()))
                    )
                    .map(([name, items]) => (
                      <div key={name} className="border-t border-slate-200">
                        <div className="px-4 py-2 bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          {name}
                        </div>
                        {items.map((r: any) => (
                          <div 
                            key={r.id} 
                            className={`px-4 py-3 cursor-pointer hover:bg-slate-50 font-medium text-slate-700 pl-6 flex justify-between items-center ${selectedReagentId === r.id ? 'bg-indigo-50 text-indigo-700' : ''}`}
                            onClick={() => {
                              setIsExisting(true);
                              setIsNewBrandForExisting(false);
                              setSelectedReagentId(r.id);
                              setIsCustomUnitMode(false);
                              setFormData(prev => ({
                                ...prev, name: r.name, brand: r.brand, presentation: r.presentation,
                                baseUnit: r.baseUnit, containerType: r.containerType, 
                                quantityPerContainer: r.quantityPerContainer, minStock: r.minStock,
                                department: r.department
                              }));
                              setIsDropdownOpen(false);
                              setSearchQuery('');
                            }}
                          >
                            <span>↳ {r.brand}</span>
                            <span className="text-xs text-slate-400 font-bold">{r.currentStock} {r.baseUnit}</span>
                          </div>
                        ))}
                        <div 
                          className="px-4 py-3 cursor-pointer hover:bg-indigo-50 font-bold text-indigo-600 text-sm pl-6 border-t border-slate-50"
                          onClick={() => {
                            setIsExisting(false);
                            setIsNewBrandForExisting(true);
                            setSelectedReagentId('');
                            setIsCustomUnitMode(false);
                            const template = items[0];
                            setFormData(prev => ({
                              ...prev, 
                              name: template.name, 
                              brand: '', 
                              presentation: template.presentation,
                              baseUnit: template.baseUnit, 
                              containerType: template.containerType, 
                              quantityPerContainer: template.quantityPerContainer, 
                              minStock: template.minStock,
                              department: template.department
                            }));
                            setIsDropdownOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          + Añadir nueva marca para {name}
                        </div>
                      </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Sección Nombre y Marca */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Nombre (Mayúsculas)</label>
                <input 
                  type="text" 
                  required 
                  disabled={isExisting || isNewBrandForExisting} 
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none disabled:opacity-60 uppercase placeholder:normal-case" 
                  placeholder="EJ: METANOL ABSOLUTO"
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Marca (Mayúsculas)</label>
                <input 
                  type="text" 
                  required 
                  disabled={isExisting}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none disabled:opacity-60 uppercase placeholder:normal-case" 
                  placeholder="EJ: CICARELLI"
                  value={formData.brand} 
                  onChange={e => setFormData({...formData, brand: e.target.value.toUpperCase()})} 
                />
              </div>

              {/* Sección Presentación y Envase */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Presentación</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold"
                  value={formData.presentation}
                  disabled={isExisting}
                  onChange={e => setFormData({...formData, presentation: e.target.value as Presentation})}
                >
                  <option value="Líquido">Líquido (mL, L, uL...)</option>
                  <option value="Sólido">Sólido (g, kg, mg...)</option>
                  <option value="Paquete">Paquete / Unidad</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Tipo de Envase</label>
                <input type="text" required placeholder="Frascos, Paquetes..." className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" value={formData.containerType} onChange={e => setFormData({...formData, containerType: e.target.value})} />
              </div>

              {/* Sección Cantidades y Unidades */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Cant. Envases/Paquetes</label>
                <input type="number" required min="1" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" value={formData.quantityEntered || ''} onChange={e => setFormData({...formData, quantityEntered: parseInt(e.target.value) || 0})} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Contenido Envase/Paquete</label>
                <div className="flex gap-2">
                  <input type="number" required step="0.01" className="flex-grow px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" value={formData.quantityPerContainer || ''} onChange={e => setFormData({...formData, quantityPerContainer: parseFloat(e.target.value) || 0})} />
                  
                  {isCustomUnitMode ? (
                    <div className="relative w-32">
                      <input 
                        type="text" 
                        autoFocus
                        placeholder="Unidad" 
                        className="w-full px-3 py-3 bg-white border-2 border-indigo-500 rounded-xl outline-none font-bold text-center"
                        value={formData.baseUnit} 
                        onChange={e => setFormData({...formData, baseUnit: e.target.value})} 
                      />
                      <button 
                        type="button" 
                        onClick={() => { setIsCustomUnitMode(false); setFormData(prev => ({...prev, baseUnit: unitsForPresentation[0] || 'mL'})); }}
                        className="absolute -top-2 -right-2 bg-slate-200 rounded-full p-1 hover:bg-slate-300"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-slate-600">
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <select 
                      className="w-24 border-2 border-slate-200 rounded-xl bg-slate-100 px-2 outline-none font-bold disabled:opacity-60" 
                      value={formData.baseUnit} 
                      disabled={isExisting}
                      onChange={e => {
                        if (e.target.value === 'CUSTOM') setIsCustomUnitMode(true);
                        else setFormData({...formData, baseUnit: e.target.value});
                      }}
                    >
                      {unitsForPresentation.map(u => <option key={u} value={u}>{u}</option>)}
                      <option value="CUSTOM" className="font-bold text-indigo-600">OTRO...</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Sección Lote y Vencimiento */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Lote</label>
                <input type="text" placeholder="Ej: L-12345" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" value={formData.lot || ''} onChange={e => setFormData({...formData, lot: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Fecha de Vencimiento</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="date" 
                    className={`w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none ${!formData.expiryDate || formData.expiryDate === 'N/A' ? 'text-slate-400' : 'text-slate-700 font-bold'}`} 
                    value={formData.expiryDate === 'N/A' ? '' : formData.expiryDate} 
                    onChange={e => setFormData({...formData, expiryDate: e.target.value || 'N/A'})} 
                  />
                  <button 
                    type="button" 
                    className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors"
                    onClick={() => setFormData({...formData, expiryDate: 'N/A'})}
                  >
                    N/A
                  </button>
                </div>
              </div>

              {/* Sección Otros Datos */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Stock Mínimo ({formData.baseUnit})</label>
                <input type="number" required min="0" step="0.01" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none" value={formData.minStock || ''} onChange={e => setFormData({...formData, minStock: parseFloat(e.target.value) || 0})} />
              </div>

              {/* Campos Departamento y Analista */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Departamento {canEditDepartment ? '(Seleccionable)' : '(Auto)'}
                </label>
                {canEditDepartment ? (
                    <select 
                        className="w-full px-4 py-3 bg-white border-2 border-indigo-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-slate-700"
                        value={formData.department}
                        onChange={e => setFormData({...formData, department: e.target.value as Department})}
                    >
                        <option value="Fisicoquímico">Fisicoquímico</option>
                        <option value="Microbiología">Microbiología</option>
                        <option value="Molecular">Molecular</option>
                    </select>
                ) : (
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-500 font-bold">
                        <BuildingOfficeIcon className="w-5 h-5"/>
                        {formData.department}
                    </div>
                )}
              </div>

              <div className="space-y-2 col-span-full md:col-span-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Analista Responsable</label>
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-500 font-bold">
                    <UserIcon className="w-5 h-5"/>
                    {formData.analystName}
                </div>
              </div>

              {/* Verificación Microbiológica y Molecular */}
              {(formData.department === 'Microbiología' || formData.department === 'Molecular') && (
                <div className="space-y-2 col-span-full">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Verificación</label>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      verificationStatus: prev.verificationStatus === 'Conforme' ? 'No Conforme' : 'Conforme' 
                    }))}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 font-bold transition-all ${
                      formData.verificationStatus === 'Conforme'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'bg-rose-50 border-rose-500 text-rose-700'
                    }`}
                  >
                    {formData.verificationStatus === 'Conforme' ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                        </svg>
                        CONFORME
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
                        </svg>
                        NO CONFORME
                      </>
                    )}
                  </button>
                </div>
              )}
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