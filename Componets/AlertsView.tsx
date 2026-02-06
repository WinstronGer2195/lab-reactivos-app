
import React, { useMemo } from 'react';
import { Reagent } from '../types';
import { formatDate, formatDateTime } from '../utils';
import { 
  BellAlertIcon, 
  ShoppingBagIcon, 
  CheckCircleIcon,
  ExclamationCircleIcon,
  EnvelopeIcon,
  ClockIcon
} from '@heroicons/react/24/solid';

interface Props {
  reagents: Reagent[];
  markAsOrdered: (id: string) => void;
  onUpdateMinStock: (id: string, newMin: number) => void;
  notifications: any[];
}

const AlertsView: React.FC<Props> = ({ reagents, markAsOrdered, onUpdateMinStock, notifications }) => {
  const alertsData = useMemo(() => {
    const consolidated: Record<string, {
      name: string;
      totalStock: number;
      minStock: number;
      baseUnit: string;
      isOrdered: boolean;
      brands: { brand: string, stock: number, id: string }[];
    }> = {};

    reagents.forEach(r => {
      const key = r.name.toLowerCase();
      if (!consolidated[key]) {
        consolidated[key] = {
          name: r.name,
          totalStock: r.currentStock,
          minStock: r.minStock,
          baseUnit: r.baseUnit,
          isOrdered: r.isOrdered,
          brands: [{ brand: r.brand, stock: r.currentStock, id: r.id }]
        };
      } else {
        consolidated[key].totalStock += r.currentStock;
        consolidated[key].brands.push({ brand: r.brand, stock: r.currentStock, id: r.id });
        consolidated[key].minStock = Math.max(consolidated[key].minStock, r.minStock);
        if (r.isOrdered) consolidated[key].isOrdered = true;
      }
    });

    const lowStock = Object.values(consolidated).filter(c => c.totalStock <= c.minStock && !c.isOrdered);
    return { lowStock };
  }, [reagents]);

  return (
    <div className="space-y-12 pb-10">
      <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-3xl shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <BellAlertIcon className="w-8 h-8 text-red-600" />
          <h1 className="text-2xl font-bold text-red-900 uppercase tracking-tighter">Panel de Gestión Crítica</h1>
        </div>
        <p className="text-red-700 font-medium">Reactivos por debajo del stock mínimo. Las alertas se envían automáticamente al correo configurado.</p>
      </div>

      <section className="space-y-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 px-1">
          <ExclamationCircleIcon className="w-5 h-5 text-red-600" />
          Pendientes de Pedido ({alertsData.lowStock.length})
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {alertsData.lowStock.length > 0 ? (
            alertsData.lowStock.map(group => (
              <div key={group.name} className="bg-white rounded-3xl shadow-sm border border-red-100 overflow-hidden group hover:shadow-md transition-all">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="max-w-[70%]">
                      <h3 className="font-bold text-slate-800 text-lg leading-tight">{group.name}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Acción Pendiente</p>
                    </div>
                    <span className="bg-red-50 text-red-600 text-[10px] font-black px-3 py-1 rounded-full uppercase border border-red-100">Crítico</span>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-bold text-slate-500">Stock Consolidado:</span>
                      <span className="font-black text-red-600 text-xl leading-none">{group.totalStock} <span className="text-xs uppercase">{group.baseUnit}</span></span>
                    </div>
                    
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2">
                      <p className="text-[9px] text-slate-400 font-black uppercase flex items-center gap-1">
                        <ShoppingBagIcon className="w-3 h-3" />
                        Existencias por Marca
                      </p>
                      <div className="max-h-24 overflow-y-auto scrollbar-hide space-y-1">
                        {group.brands.map((b, idx) => (
                          <div key={idx} className="flex justify-between text-[11px] font-medium text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                            <span className="truncate mr-2">{b.brand}</span>
                            <span className="font-bold whitespace-nowrap text-slate-800">{b.stock}{group.baseUnit}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 transition-all duration-1000" 
                        style={{ width: `${Math.max(10, Math.min(100, (group.totalStock / group.minStock) * 100))}%` }}
                      ></div>
                    </div>
                  </div>

                  <button 
                    onClick={() => group.brands.length > 0 && markAsOrdered(group.brands[0].id)}
                    className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-100 active:scale-95"
                  >
                    <ShoppingBagIcon className="w-5 h-5" />
                    Marcar como Pedido
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-16 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <CheckCircleIcon className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <p className="text-slate-800 font-black text-xl">Inventario Seguro</p>
              <p className="text-slate-500 text-sm mt-1">Todos los reactivos están por encima del stock mínimo.</p>
            </div>
          )}
        </div>
      </section>

      {/* Historial de Notificaciones Enviadas */}
      <section className="space-y-6 pt-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 px-1">
          <EnvelopeIcon className="w-5 h-5 text-indigo-500" />
          Historial de Alertas Enviadas al Correo
        </h2>
        
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {notifications.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Fecha y Hora</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Reactivo</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Destinatario</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Estado al enviar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {notifications.map((n) => (
                    <tr key={n.id} className="text-sm">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                        <div className="flex items-center gap-2">
                          <ClockIcon className="w-4 h-4 text-slate-300" />
                          {formatDateTime(n.timestamp)}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">{n.reagentName}</td>
                      <td className="px-6 py-4 text-indigo-600 font-medium">{n.targetEmail}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded-md font-bold text-[10px] border border-red-100">
                          {n.stockLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center text-slate-400 italic">
              No hay registro de alertas enviadas recientemente.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AlertsView;
