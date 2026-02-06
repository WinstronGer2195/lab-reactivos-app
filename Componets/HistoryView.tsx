
import React from 'react';
import { Transaction } from '../types';
import { formatDateTime } from '../utils';
import { 
  ArrowDownCircleIcon, 
  ArrowUpCircleIcon 
} from '@heroicons/react/24/outline';

interface Props {
  transactions: Transaction[];
}

const HistoryView: React.FC<Props> = ({ transactions }) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Historial de Movimientos</h1>
        <p className="text-slate-500">Registro con unidades de medida exactas.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reactivo</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Movimiento</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Equiv.</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Analista</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-xs text-slate-500">{formatDateTime(t.timestamp)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight px-2 py-1 rounded ${t.type === 'IN' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                      {t.type === 'IN' ? <ArrowDownCircleIcon className="w-3 h-3" /> : <ArrowUpCircleIcon className="w-3 h-3" />} {t.type === 'IN' ? 'Entrada' : 'Salida'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-800 text-sm">{t.reagentName}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">{t.displayQuantity} {t.displayUnit}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">{t.quantity} <span className="text-[10px] text-slate-400 uppercase">SI</span></td>
                  <td className="px-6 py-4 text-xs text-slate-500">{t.analyst}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistoryView;
