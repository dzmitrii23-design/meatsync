import React, { useState, useMemo } from 'react';
import { Transaction, Product, StorageLocation, Buyer } from '../types';
import { format } from 'date-fns';
import {
  Search,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Filter,
  Calendar,
  AlertTriangle,
  User,
  FileClock,
  Trash2,
  Factory,
  Pencil,
  X
} from 'lucide-react';

interface Props {
  transactions: Transaction[];
  products: Product[];
  locations: StorageLocation[];
  buyers: Buyer[];
  onDeleteTransaction?: (id: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateTransaction?: (id: string, updates: any) => Promise<{ success: boolean; error?: string }>;
}

export function Journal({
  transactions,
  products,
  locations,
  buyers,
  onDeleteTransaction,
  onUpdateTransaction
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT_SALE' | 'OUT_WASTE' | 'OUT_MPC' | 'MOVE' | 'RETURN'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [confirmDeleteTransactionId, setConfirmDeleteTransactionId] = useState<string | null>(null);

  // States for Editing Transaction
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteErrorTxId, setDeleteErrorTxId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    quantityKg: number;
    date: string;
    notes: string;
    outcomeType?: 'sale' | 'waste' | 'mpc';
    buyerId?: string;
    wasteReason?: string;
  }>({
    quantityKg: 0,
    date: '',
    notes: '',
    outcomeType: 'sale',
    buyerId: '',
    wasteReason: ''
  });

  // Helpers for locations & products
  const getProduct = (id: string) => products.find((p) => p.id === id);
  const getLocationName = (id?: string) => locations.find((l) => l.id === id)?.name || '—';
  const getBuyerName = (id?: string) => buyers.find((b) => b.id === id)?.name || '—';

  // Filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Search
      const product = getProduct(t.productId);
      const productName = product?.name.toLowerCase() || '';
      const productSku = product?.sku.toLowerCase() || '';
      const notes = t.notes?.toLowerCase() || '';
      const wasteReason = t.wasteReason?.toLowerCase() || '';
      const buyerName = t.buyerId ? getBuyerName(t.buyerId).toLowerCase() : '';
      const query = searchTerm.toLowerCase();

      const matchesSearch =
        productName.includes(query) ||
        productSku.includes(query) ||
        notes.includes(query) ||
        wasteReason.includes(query) ||
        buyerName.includes(query) ||
        (t.batchId || '').toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      // Type
      if (typeFilter === 'IN' && t.type !== 'IN') return false;
      if (typeFilter === 'MOVE' && t.type !== 'MOVE') return false;
      if (typeFilter === 'RETURN' && t.type !== 'RETURN') return false;
      if (typeFilter === 'OUT_SALE' && (t.type !== 'OUT' || t.outcomeType !== 'sale')) return false;
      if (typeFilter === 'OUT_WASTE' && (t.type !== 'OUT' || t.outcomeType !== 'waste')) return false;
      if (typeFilter === 'OUT_MPC' && (t.type !== 'OUT' || t.outcomeType !== 'mpc')) return false;

      // Date
      if (dateFilter !== 'ALL') {
        const tDate = new Date(t.date);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        if (dateFilter === 'TODAY' && tDate.getTime() < startOfToday) return false;

        if (dateFilter === 'WEEK') {
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          if (tDate.getTime() < sevenDaysAgo) return false;
        }

        if (dateFilter === 'MONTH') {
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
          if (tDate.getTime() < thirtyDaysAgo) return false;
        }

        if (dateFilter === 'CUSTOM') {
          if (startDate) {
            const startLimit = new Date(startDate);
            startLimit.setHours(0, 0, 0, 0);
            if (tDate.getTime() < startLimit.getTime()) return false;
          }
          if (endDate) {
            const endLimit = new Date(endDate);
            endLimit.setHours(23, 59, 59, 999);
            if (tDate.getTime() > endLimit.getTime()) return false;
          }
        }
      }

      return true;
    });
  }, [transactions, products, buyers, searchTerm, typeFilter, dateFilter, startDate, endDate]);

  // Statistics calculations based on filtered/unfiltered
  const stats = useMemo(() => {
    let incomeKg = 0;
    let saleKg = 0;
    let wasteKg = 0;
    let moveKg = 0;
    let mpcKg = 0;
    let returnKg = 0;

    transactions.forEach((t) => {
      if (t.type === 'IN') {
        incomeKg += t.quantityKg;
      } else if (t.type === 'MOVE') {
        moveKg += t.quantityKg;
      } else if (t.type === 'RETURN') {
        returnKg += t.quantityKg;
      } else if (t.type === 'OUT') {
        if (t.outcomeType === 'waste') {
          wasteKg += t.quantityKg;
        } else if (t.outcomeType === 'mpc') {
          mpcKg += t.quantityKg;
        } else {
          saleKg += t.quantityKg;
        }
      }
    });

    return { incomeKg, saleKg, wasteKg, moveKg, mpcKg, returnKg };
  }, [transactions]);

  const getTransactionLabel = (t: Transaction) => {
    if (t.type === 'IN') return { text: 'Приход', color: 'bg-green-100 text-green-800 border-green-200' };
    if (t.type === 'MOVE') return { text: 'Перемещение', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
    if (t.type === 'RETURN') return { text: 'Возврат', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    if (t.outcomeType === 'waste') return { text: 'Списание/Утиль', color: 'bg-red-100 text-red-800 border-red-200' };
    if (t.outcomeType === 'mpc') return { text: 'В МПЦ', color: 'bg-purple-100 text-purple-800 border-purple-200' };
    return { text: 'Продажа', color: 'bg-blue-100 text-blue-800 border-blue-200' };
  };

  const startEdit = (t: Transaction) => {
    const dt = new Date(t.date);
    const tzOffset = dt.getTimezoneOffset() * 60000;
    const localISOTime = new Date(dt.getTime() - tzOffset).toISOString().slice(0, 16);

    setEditingTransaction(t);
    setEditError(null);

    let cleanNotes = t.notes || '';
    if (t.type === 'OUT') {
      if (t.outcomeType === 'sale' && t.buyerId) {
        const bObj = buyers.find(by => by.id === t.buyerId);
        const prefix = bObj ? `Продажа: ${bObj.name}` : 'Продажа:';
        if (cleanNotes.startsWith(prefix)) {
          cleanNotes = cleanNotes.slice(prefix.length).replace(/^\s*\((.*)\)\s*$/, '$1');
        }
      } else if (t.outcomeType === 'waste' && t.wasteReason) {
        const prefix = `Списание (Утиль): ${t.wasteReason}`;
        if (cleanNotes.startsWith(prefix)) {
          cleanNotes = cleanNotes.slice(prefix.length).replace(/^\s*\((.*)\)\s*$/, '$1');
        }
      } else if (t.outcomeType === 'mpc') {
        const prefix = `Перемещение в МПЦ`;
        if (cleanNotes.startsWith(prefix)) {
          cleanNotes = cleanNotes.slice(prefix.length).replace(/^\s*\((.*)\)\s*$/, '$1');
        }
      }
    } else if (t.type === 'RETURN' && t.buyerId) {
      const bObj = buyers.find(by => by.id === t.buyerId);
      const prefix = bObj ? `Возврат от контрагента "${bObj.name}". Причина: ` : '';
      if (prefix && cleanNotes.startsWith(prefix)) {
        cleanNotes = cleanNotes.slice(prefix.length);
      }
    }

    setEditForm({
      quantityKg: t.quantityKg,
      date: localISOTime,
      notes: cleanNotes,
      outcomeType: t.outcomeType || 'sale',
      buyerId: t.buyerId || '',
      wasteReason: t.wasteReason || ''
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction || !onUpdateTransaction) return;

    if (editForm.quantityKg <= 0) {
      setEditError('Количество должно быть больше нуля.');
      return;
    }

    if (editingTransaction.type === 'OUT' && editForm.outcomeType === 'sale' && !editForm.buyerId) {
      setEditError('Необходимо выбрать покупателя для продажи.');
      return;
    }

    if (editingTransaction.type === 'OUT' && editForm.outcomeType === 'waste' && !editForm.wasteReason.trim()) {
      setEditError('Необходимо указать причину утилизации.');
      return;
    }

    const isoDate = new Date(editForm.date).toISOString();

    const res = await onUpdateTransaction(editingTransaction.id, {
      quantityKg: editForm.quantityKg,
      date: isoDate,
      notes: editForm.notes,
      outcomeType: editForm.outcomeType,
      buyerId: editForm.buyerId || undefined,
      wasteReason: editForm.wasteReason || undefined
    });

    if (res.success) {
      setEditingTransaction(null);
    } else {
      setEditError(res.error || 'Произошла ошибка при обновлении.');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!onDeleteTransaction) return;
    setDeleteError(null);
    setDeleteErrorTxId(null);

    const res = await onDeleteTransaction(id);
    if (res.success) {
      setConfirmDeleteTransactionId(null);
    } else {
      setDeleteError(res.error || 'Невозможно удалить операцию.');
      setDeleteErrorTxId(id);
    }
  };

  const hasActions = !!onDeleteTransaction || !!onUpdateTransaction;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 pb-4 border-b">
        <h2 className="text-2xl font-bold tracking-tight text-gray-950 flex items-center gap-2">
          <FileClock className="text-slate-700 h-7 w-7" />
          Журнал операций
        </h2>
        <p className="text-sm text-gray-500">
          Сквозной аудит всех движений продукции: поступления, перемещения между складами и отгрузки (продажи/брак).
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Income Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm hover:shadow transition duration-200 flex items-center gap-4">
          <div className="p-3.5 bg-green-50 text-green-600 rounded-xl">
            <ArrowDownRight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Всего оприходовано</p>
            <p className="text-2xl font-black text-gray-950 font-sans mt-0.5">
              {stats.incomeKg.toLocaleString()} <span className="text-sm font-normal text-gray-500">кг</span>
            </p>
          </div>
        </div>

        {/* Sales Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm hover:shadow transition duration-200 flex items-center gap-4">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl">
            <ArrowUpRight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Всего отгружено/продано</p>
            <p className="text-2xl font-black text-gray-950 font-sans mt-0.5">
              {stats.saleKg.toLocaleString()} <span className="text-sm font-normal text-gray-500">кг</span>
            </p>
          </div>
        </div>

        {/* MPC Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm hover:shadow transition duration-200 flex items-center gap-4">
          <div className="p-3.5 bg-purple-50 text-purple-600 rounded-xl">
            <Factory className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Перемещено в МПЦ</p>
            <p className="text-2xl font-black text-gray-950 font-sans mt-0.5">
              {stats.mpcKg.toLocaleString()} <span className="text-sm font-normal text-gray-500">кг</span>
            </p>
          </div>
        </div>

        {/* Waste Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm hover:shadow transition duration-200 flex items-center gap-4">
          <div className="p-3.5 bg-red-50 text-red-600 rounded-xl">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Списано в утиль</p>
            <p className="text-2xl font-black text-gray-950 font-sans mt-0.5">
              {stats.wasteKg.toLocaleString()} <span className="text-sm font-normal text-gray-500">кг</span>
            </p>
          </div>
        </div>

        {/* Move Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm hover:shadow transition duration-200 flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <ArrowLeftRight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Внутренних перемещений</p>
            <p className="text-2xl font-black text-gray-950 font-sans mt-0.5">
              {stats.moveKg.toLocaleString()} <span className="text-sm font-normal text-gray-500">кг</span>
            </p>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3.5 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search field */}
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Поиск лога по наименованию, артикулу, ID партии, контрагенту, причине утилизации..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-800"
            />
          </div>

          {/* Operation type filter */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-500 shrink-0" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Тип:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="rounded-xl border-slate-300 border py-2 px-3 text-sm font-semibold bg-white text-slate-800 cursor-pointer focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">📋 Все операции</option>
              <option value="IN">📥 Поступление (Приход)</option>
              <option value="OUT_SALE">🤝 Продажа / Отгрузка</option>
              <option value="OUT_MPC">🏭 Перемещение в МПЦ</option>
              <option value="OUT_WASTE">🗑️ Списание / Утиль</option>
              <option value="MOVE">🔄 Перемещения</option>
              <option value="RETURN">🔁 Возвраты от покупателей</option>
            </select>
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar size={16} className="text-slate-500 shrink-0" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Период:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="rounded-xl border-slate-300 border py-2 px-3 text-sm font-semibold bg-white text-slate-800 cursor-pointer focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">⏳ За всё время</option>
              <option value="TODAY">📅 Сегодня</option>
              <option value="WEEK">📅 За последние 7 дней</option>
              <option value="MONTH">📅 За последние 30 дней</option>
              <option value="CUSTOM">📅 Указать период...</option>
            </select>

            {dateFilter === 'CUSTOM' && (
              <div className="flex items-center gap-2 flex-wrap bg-white border border-slate-200 p-1.5 rounded-xl">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border-slate-200 border p-1 text-xs font-medium text-slate-800 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="С"
                />
                <span className="text-xs text-slate-400 font-bold">по</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg border-slate-200 border p-1 text-xs font-medium text-slate-800 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="По"
                />
                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-slate-400 hover:text-red-500 text-xs px-1 font-bold cursor-pointer font-sans"
                    title="Очистить даты"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Log Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-4.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Дата / Время</th>
                <th scope="col" className="px-6 py-4.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Тип операции</th>
                <th scope="col" className="px-6 py-4.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Продукция</th>
                <th scope="col" className="px-6 py-4.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Количество</th>
                <th scope="col" className="px-6 py-4.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Откуда → Куда</th>
                <th scope="col" className="px-6 py-4.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Контрагент / Комментарий</th>
                {hasActions && (
                  <th scope="col" className="px-6 py-4.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Действия</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredTransactions.map((t) => {
                const product = getProduct(t.productId);
                const label = getTransactionLabel(t);
                const isOutcome = t.type === 'OUT';
                const isIncome = t.type === 'IN';
                const isMove = t.type === 'MOVE';

                return (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition duration-150">
                    {/* Date */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 font-sans">
                      <div>{format(new Date(t.date), 'dd.MM.yyyy')}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{format(new Date(t.date), 'HH:mm')}</div>
                    </td>

                    {/* Operation badge */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      <span className={`px-2.5 py-1.5 rounded-lg font-bold border font-sans ${label.color} shadow-sm inline-flex items-center gap-1`}>
                        {isIncome && <ArrowDownRight size={13} />}
                        {isMove && <ArrowLeftRight size={13} />}
                        {isOutcome && t.outcomeType === 'waste' && <AlertTriangle size={13} />}
                        {isOutcome && t.outcomeType === 'mpc' && <Factory size={13} />}
                        {isOutcome && t.outcomeType === 'sale' && <ArrowUpRight size={13} />}
                        {label.text}
                      </span>
                    </td>

                    {/* Product descriptor */}
                    <td className="px-6 py-4 text-sm font-sans">
                      {product ? (
                        <div>
                          <p className="font-semibold text-gray-950 leading-snug">{product.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 font-mono">
                            SKU: {product.sku} | Партия: <span className="bg-slate-100 px-1 py-0.5 rounded font-bold">{t.batchId}</span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-gray-400 italic">Продукция удалена ({t.productId})</p>
                      )}
                    </td>

                    {/* Amount weight */}
                    <td className="px-6 py-4 whitespace-nowrap font-sans">
                      <span className={`text-base font-black ${
                        isIncome ? 'text-green-600' :
                        isMove ? 'text-indigo-600' :
                        t.outcomeType === 'waste' ? 'text-red-600' :
                        t.outcomeType === 'mpc' ? 'text-purple-600' : 'text-blue-600'
                      }`}>
                        {isIncome ? '+' : isMove ? '•' : '-'}{t.quantityKg.toLocaleString()} <span className="text-xs font-normal text-gray-500">кг</span>
                      </span>
                    </td>

                    {/* Where to where */}
                    <td className="px-6 py-4 text-sm font-sans text-gray-700">
                      {isIncome && (
                        <span className="flex items-center gap-1.5 text-gray-950 font-medium">
                          📍 Доставлен в: <strong className="font-semibold text-gray-900">{getLocationName(t.toLocationId)}</strong>
                        </span>
                      )}
                      {isMove && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Из</span>
                          <span className="font-semibold text-gray-800 line-through text-xs decoration-slate-400">{getLocationName(t.fromLocationId)}</span>
                          <span className="text-xs text-gray-400 uppercase tracking-widest font-bold mt-1">В</span>
                          <span className="font-bold text-gray-950">{getLocationName(t.toLocationId)}</span>
                        </div>
                      )}
                      {isOutcome && (
                        <span className="flex items-center gap-1.5 text-gray-950 font-medium">
                          📍 Списан из: <strong className="font-semibold text-gray-900">{getLocationName(t.fromLocationId)}</strong>
                        </span>
                      )}
                    </td>

                    {/* Details comments */}
                    <td className="px-6 py-4 text-sm font-sans text-gray-600 max-w-xs">
                      {t.notes && <div className="text-gray-900 font-medium whitespace-pre-wrap">{t.notes}</div>}
                      {t.buyerId && (
                        <div className="flex items-center gap-1 text-blue-800 bg-blue-50/80 border border-blue-200 text-xs font-semibold rounded-lg px-2 py-1 mt-1 self-start select-none w-fit">
                          <User size={12} className="text-blue-500" /> {getBuyerName(t.buyerId)}
                        </div>
                      )}
                      {t.wasteReason && (
                        <div className="flex items-center gap-1 text-red-800 bg-red-50/80 border border-red-200 text-xs font-semibold rounded-lg px-2 py-1 mt-1 self-start select-none w-fit">
                          <AlertTriangle size={12} className="text-red-500" /> Списание: {t.wasteReason}
                        </div>
                      )}
                      {!t.notes && !t.buyerId && !t.wasteReason && (
                        <span className="text-gray-400 italic">Комментариев нет</span>
                      )}
                    </td>

                    {/* Actions Column */}
                    {hasActions && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          {onUpdateTransaction && (
                            <button
                              onClick={() => startEdit(t)}
                              className="text-blue-600 hover:text-blue-900 bg-blue-50 p-1.5 rounded-lg transition cursor-pointer"
                              title="Редактировать запись"
                            >
                              <Pencil size={15} />
                            </button>
                          )}

                          {onDeleteTransaction && (
                            <>
                              {confirmDeleteTransactionId === t.id ? (
                                <div className="flex flex-col items-end gap-1.5 animate-fade-in max-w-[220px] ml-auto">
                                  {deleteError && deleteErrorTxId === t.id ? (
                                    <span className="text-[10px] text-red-600 font-bold leading-tight text-right block break-words bg-red-50 p-2 border border-red-200 rounded-lg shadow-sm mb-1 font-sans">
                                      ⚠️ {deleteError}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-red-600 font-bold leading-tight text-right block break-words font-sans">
                                      Внимание! Это действие физически откатит остатки на складе. Отменить?
                                    </span>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleDeleteTransaction(t.id)}
                                      className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer transition-colors shadow-sm font-sans"
                                    >
                                      Да, удалить
                                    </button>
                                    <button
                                      onClick={() => {
                                        setConfirmDeleteTransactionId(null);
                                        setDeleteError(null);
                                        setDeleteErrorTxId(null);
                                      }}
                                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer transition-colors font-sans"
                                    >
                                      {deleteError && deleteErrorTxId === t.id ? 'Закрыть' : 'Отмена'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setConfirmDeleteTransactionId(t.id);
                                    setDeleteError(null);
                                    setDeleteErrorTxId(null);
                                  }}
                                  className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-lg transition cursor-pointer"
                                  title="Удалить и откатить запись"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={hasActions ? 7 : 6} className="px-6 py-12 text-center text-gray-500 font-sans">
                    {transactions.length === 0 ? (
                      <div className="space-y-1">
                        <p className="font-bold text-gray-700 text-base">Журнал пуст</p>
                        <p className="text-xs">Совершите приход, расход или перемещение, чтобы зафиксировать первую операцию.</p>
                      </div>
                    ) : (
                      <p>Не найдено операций, соответствующих заданным фильтрам поиска.</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold font-sans">Редактирование операции</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold font-mono mt-0.5">
                  ID: {editingTransaction.id}
                </p>
              </div>
              <button
                onClick={() => setEditingTransaction(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {editError && (
                <div className="bg-red-50 text-red-800 border border-red-200 p-3.5 rounded-xl text-xs font-semibold flex items-start gap-2 animate-pulse font-sans">
                  <AlertTriangle className="text-red-500 h-4 w-4 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Readonly info */}
              <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-xl text-xs space-y-1.5 font-sans text-slate-600">
                <div>
                  <span className="font-bold uppercase tracking-wider text-slate-400 block text-[9px]">Тип операции:</span>
                  <span className="font-semibold text-slate-800 text-sm">
                    {getTransactionLabel(editingTransaction).text}
                  </span>
                </div>
                <div>
                  <span className="font-bold uppercase tracking-wider text-slate-400 block text-[9px]">Продукция:</span>
                  <span className="font-semibold text-slate-800 text-sm">
                    {getProduct(editingTransaction.productId)?.name || 'Неизвестный продукт'}
                  </span>
                </div>
                <div>
                  <span className="font-bold uppercase tracking-wider text-slate-400 block text-[9px]">Партия (Batch ID):</span>
                  <span className="font-mono text-slate-800 font-bold bg-slate-200 px-1 py-0.5 rounded text-[10px]">
                    {editingTransaction.batchId}
                  </span>
                </div>
              </div>

              {/* Editable Weight */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Количество (Вес в кг):</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={editForm.quantityKg}
                    onChange={(e) => setEditForm({ ...editForm, quantityKg: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-800 font-sans"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 font-sans select-none">кг</span>
                </div>
              </div>

              {/* Editable Date */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Дата и время операции:</label>
                <input
                  type="datetime-local"
                  required
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-800 font-sans"
                />
              </div>

              {/* For OUT transactions, allow editing subtype / destination */}
              {editingTransaction.type === 'OUT' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Назначение расхода:</label>
                    <select
                      value={editForm.outcomeType}
                      onChange={(e) => setEditForm({ ...editForm, outcomeType: e.target.value as any })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-800 cursor-pointer font-sans"
                    >
                      <option value="sale">🤝 Продажа / Отгрузка</option>
                      <option value="waste">🗑️ Списание / Утиль</option>
                      <option value="mpc">🏭 Перемещение в МПЦ</option>
                    </select>
                  </div>

                  {editForm.outcomeType === 'sale' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Покупатель / Контрагент:</label>
                      <select
                        value={editForm.buyerId}
                        onChange={(e) => setEditForm({ ...editForm, buyerId: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-800 cursor-pointer font-sans"
                      >
                        <option value="">Выберите покупателя...</option>
                        {buyers.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {editForm.outcomeType === 'waste' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Причина списания:</label>
                      <input
                        type="text"
                        required
                        placeholder="Например: Истек срок годности, брак упаковки..."
                        value={editForm.wasteReason}
                        onChange={(e) => setEditForm({ ...editForm, wasteReason: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-800 font-sans"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Notes Comment */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Примечание (Комментарий):</label>
                <textarea
                  rows={2}
                  placeholder="Дополнительная информация к операции..."
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-800 resize-none font-sans"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition shadow-sm cursor-pointer font-sans"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-sm transition cursor-pointer font-sans"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
