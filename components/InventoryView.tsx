import React, { useState, useMemo } from 'react';
import { Reagent, UserRole } from '../types';
import { MagnifyingGlassIcon, FunnelIcon, BeakerIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { formatDate, formatQuantity, normalizeToUnit } from '../utils';

interface Props {
  reagents: Reagent[];
  userRole: UserRole | null;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

const InventoryView: React.FC<Props> = ({ reagents, userRole, onDelete, onEdit }) => {
  const [search, setSearch] = useState(() => sessionStorage.getItem('inv_search') || '');
  const [deptFilter, setDeptFilter] = useState<string>(() => sessionStorage.getItem('inv_dept') || 'all');

  const groupedReagents = useMemo(() => {
    const groups: Record<string, {
      name: string;
      department: string;
      presentation: string;
      totalStock: number;
      minStock: number;
      baseUnit: string;
      containerType: string;
      quantityPerContainer: number;
      expiryDate: string;
      lastUpdated: string;
      brands: { brand: string; stock: number; id: string; originalUnit: string }[];
    }> = {};

    reagents.forEach(r => {
      const key = `${r.name.toLowerCase()}-${r.department}`;
      if (!groups[key]) {
        groups[key] = {
          name: r.name,
          department: r.department,
          presentation: r.presentation,
          totalStock: r.currentStock,
          minStock: r.minStock,
          baseUnit: r.baseUnit,
          containerType: r.containerType,
          quantityPerContainer: r.quantityPerContainer,
          expiryDate: r.expiryDate,
          lastUpdated: r.lastUpdated,
          brands: [{ brand: r.brand, stock: r.currentStock, id: r.id, originalUnit: r.baseUnit }]
        };
      } else {
        const normalizedStock = normalizeToUnit(r.currentStock, r.baseUnit, groups[key].baseUnit);
        groups[key].totalStock += normalizedStock;
        groups[key].brands.push({ brand: r.brand, stock: r.currentStock, id: r.id, originalUnit: r.baseUnit });
        if (r.expiryDate !== 'N/A' && (groups[key].expiryDate === 'N/A' || new Date(r.expiryDate) < new Date(groups[key].expiryDate))) {
          groups[key].expiryDate = r.expiryDate;
        }
        if (new Date(r.lastUpdated) > new Date(groups[key].lastUpdated)) {
          groups[key].lastUpdated = r.lastUpdated;
        }
        const normalizedMinStock = normalizeToUnit(r.minStock, r.baseUnit, groups[key].baseUnit);
        groups[key].minStock = Math.max(groups[key].minStock, normalizedMinStock);
      }
    });

    return Object.values(groups).map(g => ({
      ...g,
      totalStock: formatQuantity(g.totalStock, g.presentation)
    })).filter(g => {
      const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase()) || 
                            g.brands.some(b => b.brand.toLowerCase().includes(search.toLowerCase()));
      const matchesDept = deptFilter === 'all' || g.department === deptFilter;
      return matchesSearch && matchesDept;
    });
  }, [reagents, search, deptFilter]);

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventario Global</h1>
          <p className="text-slate-500 text-sm">Consolidado por tipo de reactivo.</p>
        </div>
        
        <div className="grid grid-cols-1 sm:flex gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Nombre o marca..."
              className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-64 transition-all text-sm"
              value={search}
              onChange={(e) => { setSearch(e.target.value); sessionStorage.setItem('inv_search', e.target.value); }}
            />
          </div>
          
          <div className="relative">
            <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select 
              className="pl-10 pr-8 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer w-full text-sm font-bold text-slate-700"
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); sessionStorage.setItem('inv_dept', e.target.value); }}
            >
              <option value="all">Departamentos</option>
              <option value="Fisicoquímico">Fisicoquímico</option>
              <option value="Microbiología">Microbiología</option>
              <option value="Molecular">Molecular</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Reactivo</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Marcas / Existencias</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Stock Total</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedReagents.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <BeakerIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="font-bold text-slate-500 text-sm">
                      {search || deptFilter !== 'all'
                        ? 'Ningún reactivo coincide con el filtro aplicado.'
                        : 'El inventario está vacío. Registrá el primer ingreso.'}
                    </p>
                  </td>
                </tr>
              )}
              {groupedReagents.map(group => {
                const isLow = group.totalStock <= group.minStock;
                return (
                  <tr key={`${group.name}-${group.department}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{group.name}</div>
                      <div className="text-[10px] text-indigo-500 font-black uppercase tracking-tighter">{group.department}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2 max-w-xs">
                        {group.brands.map((b, idx) => (
                          <div key={idx} className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg text-[10px] font-bold border group/item ${b.stock <= 0.01 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            <span>{b.brand}: {b.stock} {b.originalUnit}</span>
                            {userRole === 'GERENTE' && (
                              <div className="flex items-center ml-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); onEdit(b.id); }}
                                  className="text-slate-400 hover:text-indigo-500 transition-colors p-0.5"
                                  title="Editar reactivo"
                                >
                                  <PencilIcon className="w-3.5 h-3.5" />
                                </button>
                                {b.stock <= 0.01 && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); onDelete(b.id); }}
                                    className="text-slate-400 hover:text-red-500 transition-colors p-0.5 ml-1"
                                    title="Eliminar reactivo vacío y su historial"
                                  >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-black ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
                        {group.totalStock} {group.baseUnit}
                      </div>
                      <div className="text-[9px] text-slate-400 font-black uppercase">Mín: {group.minStock} {group.baseUnit}</div>
                    </td>
                    <td className="px-6 py-4">
                      {isLow ? (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black bg-red-100 text-red-700 border border-red-200 uppercase tracking-widest whitespace-nowrap">Stock Bajo</span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-widest whitespace-nowrap">OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryView;