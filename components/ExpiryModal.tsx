import React, { useMemo } from 'react';
import { Reagent } from '../types';
import { XMarkIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

interface Props {
  reagents: Reagent[];
  onClose: () => void;
}

type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'ok' | 'na';

const getStatus = (expiryDate: string): { status: ExpiryStatus; days: number } => {
  if (!expiryDate || expiryDate === 'N/A') return { status: 'na', days: Infinity };
  const diff = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (diff < 0)   return { status: 'expired',  days: diff };
  if (diff <= 30)  return { status: 'critical', days: diff };
  if (diff <= 90)  return { status: 'warning',  days: diff };
  return { status: 'ok', days: diff };
};

const STATUS_ORDER: Record<ExpiryStatus, number> = { expired: 0, critical: 1, warning: 2, ok: 3, na: 4 };

const STATUS_STYLE: Record<ExpiryStatus, { row: string; badge: string; label: (days: number) => string }> = {
  expired:  { row: 'bg-red-50 border-red-200',    badge: 'bg-red-600 text-white',          label: d => `Venció hace ${Math.abs(d)}d` },
  critical: { row: 'bg-orange-50 border-orange-200', badge: 'bg-orange-500 text-white',     label: d => `Vence en ${d}d` },
  warning:  { row: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-400 text-yellow-900', label: d => `Vence en ${d}d` },
  ok:       { row: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-500 text-white',  label: d => `${d}d restantes` },
  na:       { row: 'bg-slate-50 border-slate-200',  badge: 'bg-slate-300 text-slate-600',  label: () => 'Sin fecha' },
};

const ExpiryModal: React.FC<Props> = ({ reagents, onClose }) => {
  const sorted = useMemo(() => {
    return [...reagents]
      .map(r => ({ ...r, ...getStatus(r.expiryDate) }))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.days - b.days);
  }, [reagents]);

  const counts = useMemo(() => ({
    expired:  sorted.filter(r => r.status === 'expired').length,
    critical: sorted.filter(r => r.status === 'critical').length,
    warning:  sorted.filter(r => r.status === 'warning').length,
    ok:       sorted.filter(r => r.status === 'ok').length,
    na:       sorted.filter(r => r.status === 'na').length,
  }), [sorted]);

  const withDates = sorted.filter(r => r.status !== 'na');
  const withoutDates = sorted.filter(r => r.status === 'na');

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white flex justify-between items-start rounded-t-3xl shrink-0">
          <div className="flex items-center gap-3">
            <CalendarDaysIcon className="w-7 h-7 opacity-80" />
            <div>
              <h2 className="text-xl font-bold">Control de Vencimientos</h2>
              <p className="text-indigo-200 text-sm">{reagents.length} reactivos en inventario</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Summary chips */}
        <div className="flex gap-2 px-6 py-4 bg-slate-50 border-b border-slate-200 flex-wrap shrink-0">
          {counts.expired  > 0 && <span className="px-3 py-1 bg-red-600 text-white text-xs font-black rounded-full">{counts.expired} VENCIDO{counts.expired > 1 ? 'S' : ''}</span>}
          {counts.critical > 0 && <span className="px-3 py-1 bg-orange-500 text-white text-xs font-black rounded-full">{counts.critical} CRÍTICO{counts.critical > 1 ? 'S' : ''} (&le;30d)</span>}
          {counts.warning  > 0 && <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-black rounded-full">{counts.warning} PRÓXIMO{counts.warning > 1 ? 'S' : ''} (&le;90d)</span>}
          {counts.ok       > 0 && <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-black rounded-full">{counts.ok} VIGENTE{counts.ok > 1 ? 'S' : ''}</span>}
          {counts.na       > 0 && <span className="px-3 py-1 bg-slate-200 text-slate-600 text-xs font-black rounded-full">{counts.na} SIN FECHA</span>}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {withDates.length === 0 && withoutDates.length === 0 && (
            <p className="text-center text-slate-400 italic py-12">No hay reactivos en el inventario.</p>
          )}

          {withDates.map(r => {
            const style = STATUS_STYLE[r.status];
            return (
              <div key={r.id} className={`flex items-center justify-between p-4 rounded-2xl border ${style.row}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 truncate">{r.name}</p>
                  <p className="text-xs text-slate-500 font-medium">{r.brand}{r.lot ? ` · Lote: ${r.lot}` : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-1 ml-3 shrink-0">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-black ${style.badge}`}>
                    {style.label(r.days)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {r.expiryDate !== 'N/A' ? new Date(r.expiryDate + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                  </span>
                </div>
              </div>
            );
          })}

          {withoutDates.length > 0 && (
            <>
              {withDates.length > 0 && <div className="border-t border-slate-200 my-2" />}
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Sin fecha de vencimiento registrada</p>
              {withoutDates.map(r => (
                <div key={r.id} className="flex items-center justify-between p-4 rounded-2xl border bg-slate-50 border-slate-200 opacity-60">
                  <div>
                    <p className="font-bold text-slate-700 text-sm">{r.name}</p>
                    <p className="text-xs text-slate-400">{r.brand}{r.lot ? ` · Lote: ${r.lot}` : ''}</p>
                  </div>
                  <span className="text-[11px] font-black text-slate-400">S/F</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl shrink-0 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ExclamationTriangleIcon className="w-4 h-4 text-orange-400" />
            <span>Crítico &le;30 días · Próximo &le;90 días</span>
          </div>
          <button onClick={onClose} className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors text-sm">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpiryModal;
