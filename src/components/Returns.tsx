import React, { useState, useMemo } from 'react';
import { Product, StorageLocation, Batch, Buyer } from '../types';
import { format } from 'date-fns';
import { 
  Undo2, 
  Trash2, 
  Plus, 
  Search, 
  Building2, 
  AlertCircle, 
  Calendar, 
  RotateCcw, 
  ArrowLeftRight, 
  PackageMinus,
  CheckCircle2,
  FolderLock
} from 'lucide-react';

interface Props {
  products: Product[];
  buyers: Buyer[];
  locations: StorageLocation[];
  batches: Batch[];
  onSubmitReturn: (data: {
    productId: string;
    quantityKg: number;
    buyerId: string;
    reason: string;
    date: string;
  }) => void;
  onDisposeReturn: (
    batchId: string,
    quantityKg: number,
    date: string,
    notes?: string,
    outcomeType?: 'sale' | 'waste' | 'mpc',
    buyerId?: string,
    wasteReason?: string
  ) => void;
  onMoveReturn: (batchId: string, toLocationId: string, quantityKg: number, date: string) => void;
}

const RETURN_REASONS = [
  '⚠️ Брак продукции / Нарушение ТУ',
  '💨 Развакуум / Повреждение упаковки',
  '❌ Отказ в приемке по качеству / Температуре',
  '⏰ Истек срок годности при доставке',
  '⚖️ Недовес / Пересортица при отгрузке',
  '📝 Прочий возврат контрагента'
];

export function Returns({
  products,
  buyers,
  locations,
  batches,
  onSubmitReturn,
  onDisposeReturn,
  onMoveReturn
}: Props) {
  // Notification state
  const [localNotification, setLocalNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setLocalNotification(msg);
    setTimeout(() => setLocalNotification(null), 3000);
  };

  // 1. Return registration form state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [selectedReason, setSelectedReason] = useState(RETURN_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [returnDate, setReturnDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // 2. Returns list state
  const [searchQuery, setSearchQuery] = useState('');

  // 3. Move/Restock dialog state
  const [movingBatchId, setMovingBatchId] = useState<string | null>(null);
  const [targetLocationId, setTargetLocationId] = useState('');
  const [moveWeight, setMoveWeight] = useState('');

  // 4. Dispose double confirm state
  const [confirmDisposeBatchId, setConfirmDisposeBatchId] = useState<string | null>(null);

  // Return location batches
  const returnBatches = useMemo(() => {
    return batches.filter(b => b.locationId === 'loc_returns_1');
  }, [batches]);

  // Filtered return batches
  const filteredReturnBatches = useMemo(() => {
    return returnBatches.filter(b => {
      const p = products.find(prod => prod.id === b.productId);
      const buyer = buyers.find(by => by.id === b.returnedByBuyerId);
      
      const pName = p?.name.toLowerCase() || '';
      const pSku = p?.sku.toLowerCase() || '';
      const bName = buyer?.name.toLowerCase() || '';
      const reason = b.returnReason?.toLowerCase() || '';
      const q = searchQuery.toLowerCase();

      return pName.includes(q) || pSku.includes(q) || bName.includes(q) || reason.includes(q);
    });
  }, [returnBatches, products, buyers, searchQuery]);

  // Handle Return submit
  const handleRegisterReturn = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId) {
      alert('Пожалуйста, выберите продукцию');
      return;
    }

    const weight = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(weight) || weight <= 0) {
      alert('Введите корректный вес в кг');
      return;
    }

    if (!selectedBuyerId) {
      alert('Пожалуйста, выберите покупателя, оформившего возврат');
      return;
    }

    const finalReason = selectedReason === '📝 Прочий возврат контрагента' && customReason.trim()
      ? `Другое: ${customReason.trim()}`
      : selectedReason;

    onSubmitReturn({
      productId: selectedProductId,
      quantityKg: weight,
      buyerId: selectedBuyerId,
      reason: finalReason,
      date: new Date(returnDate).toISOString()
    });

    // Reset inputs
    setSelectedProductId('');
    setWeightInput('');
    setSelectedBuyerId('');
    setCustomReason('');
    
    showNotification(`Оформлен возврат продукции в карантин: ${weightInput} кг`);
  };

  // Handle Dispose Action
  const handleDisposeReturn = (batchId: string, item: Batch) => {
    const p = products.find(prod => prod.id === item.productId);
    onDisposeReturn(
      batchId,
      item.quantityKg,
      new Date().toISOString(),
      `Утилизация бракованного возврата. Первоначальная причина: ${item.returnReason || 'не указана'}`,
      'waste',
      undefined,
      `Утилизация возврата (${p?.name || 'мясо'})`
    );

    setConfirmDisposeBatchId(null);
    showNotification(`Партия возврата утилизирована из карантина: ${item.quantityKg} кг`);
  };

  // Handle Move / Restock Action
  const handleMoveReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!movingBatchId) return;
    const batch = returnBatches.find(b => b.id === movingBatchId);
    if (!batch) return;

    if (!targetLocationId) {
      alert('Выберите целевую камеру хранения');
      return;
    }

    const weight = parseFloat(moveWeight.replace(',', '.'));
    if (isNaN(weight) || weight <= 0 || weight > batch.quantityKg) {
      alert(`Введите корректный вес (максимум ${batch.quantityKg} кг)`);
      return;
    }

    onMoveReturn(movingBatchId, targetLocationId, weight, new Date().toISOString());

    setMovingBatchId(null);
    setTargetLocationId('');
    setMoveWeight('');
    
    const p = products.find(prod => prod.id === batch.productId);
    showNotification(`Товар "${p?.name}" проверен и возвращен на склад в объеме ${weight} кг`);
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-950 flex items-center gap-2.5">
            <RotateCcw className="text-amber-500 h-7 w-7" />
            Учет возвратов и брака (Карантин)
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-4xl">
            Специализированная складская карантинная зона. Возвращенный и бракованный товар учитывается отдельно,
            <strong className="text-indigo-600 font-semibold"> не попадает в остатки основного холодильника</strong> и не искажает показатели чистой готовой продукции.
          </p>
        </div>
      </div>

      {localNotification && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-2xl flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 className="text-green-500 h-5 w-5" />
          <span className="font-semibold text-sm">{localNotification}</span>
        </div>
      )}

      {/* Grid of actions and active list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        
        {/* Left Column - New Return Form (Span 4) */}
        <div className="lg:col-span-4 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2 pb-3 border-b border-slate-100">
            <Undo2 className="h-4 w-4 text-amber-500" />
            Оформить новый возврат
          </h3>

          <form onSubmit={handleRegisterReturn} className="space-y-4">
            
            {/* Product option */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Продукция *</label>
              <select
                required
                className="w-full border-gray-300 border rounded-lg p-2.5 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white cursor-pointer"
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
              >
                <option value="">-- Выбрать из номенклатуры --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>

            {/* Weight option */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Возвращаемый вес (кг) *</label>
              <div className="relative">
                <input
                  required
                  type="text"
                  placeholder="0.00"
                  className="w-full border-gray-300 border rounded-lg p-2.5 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-800 bg-white"
                  value={weightInput}
                  onChange={e => setWeightInput(e.target.value)}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">кг</span>
              </div>
            </div>

            {/* Buyer option */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">От какого покупателя возврат *</label>
              <select
                required
                className="w-full border-gray-300 border rounded-lg p-2.5 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white cursor-pointer"
                value={selectedBuyerId}
                onChange={e => setSelectedBuyerId(e.target.value)}
              >
                <option value="">-- Выберите контрагента --</option>
                {buyers.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} (ИНН: {b.inn || '—'})
                  </option>
                ))}
              </select>
            </div>

            {/* Return Reason Option */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Причина возврата *</label>
              <select
                className="w-full border-gray-300 border rounded-lg p-2.5 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white cursor-pointer"
                value={selectedReason}
                onChange={e => setSelectedReason(e.target.value)}
              >
                {RETURN_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {selectedReason === '📝 Прочий возврат контрагента' && (
              <div className="animate-fade-in">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Своя / Уточненная причина *</label>
                <textarea
                  required
                  placeholder="Опишите детально причину возврата..."
                  className="w-full border-gray-300 border rounded-lg p-2.5 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-800 bg-white mr-0 h-16"
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                />
              </div>
            )}

            {/* Return Date Option */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Дата оформления *</label>
              <input
                required
                type="date"
                className="w-full border-gray-300 border rounded-lg p-2.5 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-800 bg-white"
                value={returnDate}
                onChange={e => setReturnDate(e.target.value)}
              />
            </div>

            {/* Register Return Trigger */}
            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-bold rounded-lg py-3 shadow-md hover:shadow transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <Plus size={16} />
              Оформить возврат в карантин
            </button>
            <p className="text-[11px] text-center text-gray-400 italic">
              Товар будет оприходован в специальный «Склад возвратов и брака»
            </p>
          </form>

        </div>

        {/* Right Column - Returns Storage List and Controls (Span 8) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Main List and Controls */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col min-h-[500px]">
            
            {/* List Header and Search */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <FolderLock className="h-5 w-5 text-amber-500" />
                  Товары в карантинном изоляторе
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Текущие партии возврата ({filteredReturnBatches.length} парт.)
                </p>
              </div>

              {/* Search in returns */}
              <div className="relative w-full sm:w-[280px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Поиск по товару, SKU, покупателю..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs shadow-sm bg-slate-50 font-medium text-slate-800 focus:bg-white transition-colors"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* List rendering */}
            <div className="flex-1 space-y-4">
              
              {filteredReturnBatches.map(b => {
                const prod = products.find(p => p.id === b.productId);
                const buyer = buyers.find(by => by.id === b.returnedByBuyerId);
                const isDisposing = confirmDisposeBatchId === b.id;
                const isMoving = movingBatchId === b.id;

                return (
                  <div key={b.id} className="border border-slate-200 rounded-2xl p-4 hover:shadow-sm transition bg-slate-50/40 hover:bg-slate-50 duration-150 relative">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      
                      {/* Left: Product & batch metadata */}
                      <div className="space-y-1 md:space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                            Возврат
                          </span>
                          <span className="text-xs font-mono text-slate-500">ID: {b.id}</span>
                          <span className="text-xs font-semibold text-slate-400">|</span>
                          <span className="text-xs font-mono text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded font-bold">SKU {prod?.sku || '—'}</span>
                        </div>

                        <h4 className="font-bold text-slate-900 text-base font-sans">{prod?.name || 'Удаленный продукт'}</h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-gray-500 font-sans mt-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Building2 size={14} className="text-slate-400 shrink-0" />
                            <span className="truncate">Клиент: <strong className="text-slate-700">{buyer?.name || 'Неизвестный покупатель'}</strong></span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <AlertCircle size={14} className="text-amber-500 shrink-0" />
                            <span className="truncate">Причина: <strong className="text-amber-700">{b.returnReason || 'Не указана'}</strong></span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Calendar size={14} className="text-slate-400 shrink-0" />
                            <span>Принят: <strong className="text-slate-700">{b.receivedAt ? format(new Date(b.receivedAt), 'dd.MM.yyyy') : '—'}</strong></span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Calendar size={14} className="text-slate-400 shrink-0" />
                            <span>Истекает: <strong className="text-slate-700">{b.expiresAt ? format(new Date(b.expiresAt), 'dd.MM.yyyy') : '—'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Quantity and Action buttons */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0 self-stretch sm:self-center">
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Количество в Брак-камере</p>
                          <p className="text-2xl font-extrabold text-slate-900 font-sans mt-1.5">{b.quantityKg.toLocaleString()} кг</p>
                        </div>

                        {/* Action buttons triggers */}
                        {!isDisposing && !isMoving && (
                          <div className="flex gap-2 mt-2 w-full sm:w-auto">
                            
                            {/* Restock target */}
                            <button
                              onClick={() => {
                                setMovingBatchId(b.id);
                                setMoveWeight(b.quantityKg.toString());
                                setTargetLocationId('');
                              }}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 hover:border-teal-300 font-semibold text-xs px-3 py-1.5 rounded-lg transition tracking-wide cursor-pointer text-center"
                              title="Вернуть в рабочий оборот на холодильник"
                            >
                              <RotateCcw size={13} />
                              Проверить и восстановить
                            </button>

                            {/* Dispose trigger */}
                            <button
                              onClick={() => setConfirmDisposeBatchId(b.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 p-1.5 rounded-lg transition cursor-pointer"
                              title="Утилизировать (Полное списание под утиль)"
                            >
                              <Trash2 size={14} />
                            </button>

                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expandable Form: Restock (Move back to normal refrigeration storage) */}
                    {isMoving && (
                      <div className="mt-4 pt-4 border-t border-slate-200/60 animate-fade-in">
                        <h5 className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-3 flex items-center gap-1">
                          <RotateCcw size={14} />
                          Восстановление товара из брака/карантина
                        </h5>
                        
                        <form onSubmit={handleMoveReturnSubmit} className="flex flex-col sm:flex-row gap-3 items-end">
                          <div className="flex-1 w-full">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Выбрать рабочий холодильник *</label>
                            <select
                              required
                              className="w-full border-gray-300 border rounded-lg p-2 text-xs shadow-sm focus:ring-teal-500 focus:border-teal-500 text-slate-900 bg-white cursor-pointer"
                              value={targetLocationId}
                              onChange={e => setTargetLocationId(e.target.value)}
                            >
                              <option value="">-- Выберите камеру хранения --</option>
                              {locations.filter(l => l.id !== 'loc_returns_1').map(l => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="w-full sm:w-[130px]">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Вес для возврата *</label>
                            <div className="relative">
                              <input
                                required
                                type="text"
                                className="w-full border-gray-300 border rounded-lg p-2 pr-7 text-xs shadow-sm text-slate-800 bg-white"
                                value={moveWeight}
                                onChange={e => setMoveWeight(e.target.value)}
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">кг</span>
                            </div>
                          </div>

                          <div className="flex gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                            <button
                              type="submit"
                              className="flex-1 sm:flex-none bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow cursor-pointer transition-all whitespace-nowrap"
                            >
                              Принять
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMovingBatchId(null);
                                setTargetLocationId('');
                              }}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-3 py-2 rounded-lg cursor-pointer transition"
                            >
                              Отмена
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* Expandable Dialog: Confirm Dispose / Write off returned meat */}
                    {isDisposing && (
                      <div className="mt-4 pt-4 border-t border-red-200 bg-red-50/50 p-3.5 rounded-xl animate-fade-in flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <p className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-1/5">
                            ⚠️ Внимание: Подтвердите списание в утиль
                          </p>
                          <p className="text-xs text-red-700 mt-1">
                            Партия будет безвозвратно списана со склада возвратов. Это запишется в журнал как утилизация.
                          </p>
                        </div>
                        
                        <div className="flex gap-2 w-full sm:w-auto shrink-0">
                          <button
                            onClick={() => handleDisposeReturn(b.id, b)}
                            className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-2 rounded-lg shadow cursor-pointer transition-colors"
                          >
                            Утилизировать полностью
                          </button>
                          <button
                            onClick={() => setConfirmDisposeBatchId(null)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-3 py-2 rounded-lg cursor-pointer transition"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}

              {filteredReturnBatches.length === 0 && (
                <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400 font-sans border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/20">
                  <PackageMinus size={48} className="text-slate-300 mb-3" />
                  <p className="font-bold text-slate-600">В карантине пусто</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    На данный момент возвращенной или бракованной продукции в изоляторе не зарегистрировано.
                  </p>
                </div>
              )}

            </div>

          </div>

          {/* Quick FAQ / Guidelines Card */}
          <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-5 flex gap-4">
            <AlertCircle className="text-amber-500 h-6 w-6 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed space-y-1.5 font-sans">
              <p className="font-bold uppercase tracking-wider text-amber-800">Регламент утилизации и изоляции возвратов:</p>
              <p>
                1. <strong>Физическая изоляция</strong>: Весь поступивший брак перемещается на специальную паллету брака, обозначенную стикером.
              </p>
              <p>
                2. <strong>Экспертиза</strong>: Если технолог считает мясо пригодным для переработки или реализации, выполните действие <strong>«Проверить и восстановить»</strong>, чтобы вернуть товар в рабочий цикл холодильников.
              </p>
              <p>
                3. <strong>Утилизация</strong>: Если продукция не подлежит реабилитации, подтвердите утилизацию. При этом запишется проводка типа <code>OUT_WASTE</code>.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
