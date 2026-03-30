import React, { useState, useMemo } from 'react';
import { Transaction, Reagent, Department } from '../types';
import { formatDateTime } from '../utils';
import { 
  ArrowDownCircleIcon, 
  ArrowUpCircleIcon,
  MagnifyingGlassIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';

interface Props {
  transactions: Transaction[];
  reagents?: Reagent[];
}

const HistoryView: React.FC<Props> = ({ transactions, reagents = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<Department | 'TODOS'>('TODOS');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Find reagent to get department
      const reagent = reagents.find(r => r.id === t.reagentId);
      
      // Filter by department
      if (filterDepartment !== 'TODOS' && reagent?.department !== filterDepartment) {
        return false;
      }

      // Filter by search term
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        const matchesName = t.reagentName.toLowerCase().includes(lowerSearch);
        const matchesAnalyst = t.analyst.toLowerCase().includes(lowerSearch);
        const matchesLot = t.lot?.toLowerCase().includes(lowerSearch) || false;
        
        if (!matchesName && !matchesAnalyst && !matchesLot) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, reagents, searchTerm, filterDepartment]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Historial de Movimientos</h1>
          <p className="text-slate-500">Registro con unidades de medida exactas.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar reactivo, analista, lote..." 
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none w-full sm:w-64"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <FunnelIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select 
              className="pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none appearance-none font-medium text-slate-700 w-full sm:w-auto"
              value={filterDepartment}
              onChange={e => setFilterDepartment(e.target.value as Department | 'TODOS')}
            >
              <option value="TODOS">Todos los Deptos</option>
              <option value="Fisicoquímico">Fisicoquímico</option>
              <option value="Microbiología">Microbiología</option>
              <option value="Molecular">Molecular</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reactivo</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Lote</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Movimiento</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Equiv.</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Verificación</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Analista</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-xs text-slate-500">{formatDateTime(t.timestamp)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight px-2 py-1 rounded ${t.type === 'IN' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                      {t.type === 'IN' ? <ArrowDownCircleIcon className="w-3 h-3" /> : <ArrowUpCircleIcon className="w-3 h-3" />} {t.type === 'IN' ? 'Entrada' : 'Salida'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-800 text-sm">{t.reagentName}</td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-600">{t.lot || '-'}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">{t.displayQuantity} {t.displayUnit}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">
                    {Math.round(t.quantity * 10000) / 10000}{' '}
                    <span className="text-[10px] text-slate-400 uppercase">
                      {reagents.find(r => r.id === t.reagentId)?.baseUnit || 'UNID.'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {t.verificationStatus ? (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight px-2 py-1 rounded ${t.verificationStatus === 'Conforme' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                        {t.verificationStatus}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">{t.analyst}</td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No se encontraron movimientos que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistoryView;