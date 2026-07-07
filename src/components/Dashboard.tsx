import React from 'react';
import { Product, StorageLocation, Batch } from '../types';
import { format, differenceInDays } from 'date-fns';
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Package, Printer } from 'lucide-react';

interface Props {
  batches: Batch[];
  products: Product[];
  locations: StorageLocation[];
}

const getMaterialBadge = (material?: string) => {
  const label = material || 'Иное';
  switch (label) {
    case 'Свинина':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-pink-50 text-pink-700 border border-pink-200">🐖 Свинина</span>;
    case 'Говядина':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">🐂 Говядина</span>;
    case 'Птица':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-50 text-yellow-800 border border-yellow-200">🐓 Птица</span>;
    case 'Баранина':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-900 border border-red-200">🐏 Баранина</span>;
    case 'Субпродукты':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">🩸 Субпродукты</span>;
    default:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-50 text-slate-800 border border-slate-200">📦 Иное</span>;
  }
};

const getPackagingBadge = (pack?: string) => {
  const label = pack || 'Иное';
  switch (label) {
    case 'Блочка':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">🧊 Блочка</span>;
    case 'Мелкая фасовка':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-800 border border-green-200">🛍️ Мелкая</span>;
    case 'Отруба':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-50 text-gray-800 border border-gray-200">🥩 Отруба</span>;
    case 'Полутуши':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">🍖 Полутуши</span>;
    case 'Вакуум':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">🛡️ Вакуум</span>;
    case 'Лотки':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-50 text-orange-800 border border-orange-200">📥 Лотки</span>;
    default:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-100">📦 Иное</span>;
  }
};

export function Dashboard({ batches, products, locations }: Props) {
  // Local filter states
  const [filterMaterial, setFilterMaterial] = React.useState<string>('all');
  const [filterPackaging, setFilterPackaging] = React.useState<string>('all');
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Filter out returns location from main refrigerator stock calculations
  const normalBatches = batches.filter(b => b.locationId !== 'loc_returns_1');
  const normalLocations = locations.filter(l => l.id !== 'loc_returns_1');

  // Aggregate data for overview
  const totalStockKg = normalBatches.reduce((sum, b) => sum + b.quantityKg, 0);
  const totalCapacityKg = normalLocations.reduce((sum, l) => sum + l.capacityKg, 0);
  const capacityPercent = totalCapacityKg ? Math.round((totalStockKg / totalCapacityKg) * 100) : 0;

  // Find expiring products
  const now = new Date();
  const expiringBatches = normalBatches.filter(b => {
    const expires = new Date(b.expiresAt);
    const daysLeft = differenceInDays(expires, now);
    const prod = products.find(p => p.id === b.productId);
    const threshold = prod?.notifyBeforeDays ?? 14;
    return daysLeft <= threshold; 
  }).sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());

  // Filter products by selected rawMaterial/packagingType
  const filteredProducts = products.filter(p => {
    const pMaterial = p.rawMaterial || 'Иное';
    const pPackaging = p.packagingType || 'Иное';
    
    const matMatch = filterMaterial === 'all' || pMaterial === filterMaterial;
    const packMatch = filterPackaging === 'all' || pPackaging === filterPackaging;
    
    return matMatch && packMatch;
  });

  // Aggregate by product
  const stockByProduct = filteredProducts.map(p => {
    const productBatches = normalBatches
      .filter(b => b.productId === p.id)
      .sort((a, b) => {
        const dateA = new Date(a.manufacturedAt || a.receivedAt).getTime();
        const dateB = new Date(b.manufacturedAt || b.receivedAt).getTime();
        return dateA - dateB;
      });
    const totalKg = productBatches.reduce((sum, b) => sum + b.quantityKg, 0);
    // Ближайшая дата «Годен до» среди всех партий этого товара
    const nearestExpiry = productBatches.length > 0
      ? productBatches.reduce((earliest, b) => {
          const d = new Date(b.expiresAt);
          return d < earliest ? d : earliest;
        }, new Date(productBatches[0].expiresAt))
      : null;
    const daysLeft = nearestExpiry ? differenceInDays(nearestExpiry, now) : null;
    return { product: p, totalKg, nearestExpiry, daysLeft, batches: productBatches };
  }).filter(item => item.totalKg > 0).sort((a, b) => b.totalKg - a.totalKg);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b">
        <h2 className="text-2xl font-medium tracking-tight text-gray-900">Остатки на складах (Дашборд)</h2>
        <button
          type="button"
          onClick={() => window.print()}
          className="print:hidden flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer active:scale-95"
          title="Распечатать отчет остатков на складах"
        >
          <Printer size={16} />
          <span>Печать отчета</span>
        </button>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <p className="text-sm font-medium text-gray-500 mb-1">Общий объем продукции</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-gray-900">{totalStockKg.toLocaleString('ru-RU')}</span>
            <span className="text-lg text-gray-500 mb-1">кг</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex justify-between items-start mb-1">
            <p className="text-sm font-medium text-gray-500">Загрузка складов</p>
            <span className="text-sm font-bold text-gray-700">{capacityPercent}%</span>
          </div>
          <div className="flex items-end gap-2 mb-3">
             <span className="text-3xl font-bold text-gray-900">{totalStockKg.toLocaleString('ru-RU')}</span>
             <span className="text-lg text-gray-500 mb-1">из {totalCapacityKg.toLocaleString('ru-RU')} кг</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className={`h-2 rounded-full ${capacityPercent > 90 ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(capacityPercent, 100)}%` }}></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <p className="text-sm font-medium text-gray-500 mb-1">Истекающий срок (по настройкам)</p>
          <div className="flex items-end gap-2 text-red-600">
            <span className="text-3xl font-bold">{expiringBatches.length}</span>
            <span className="text-lg mb-1">партий</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col - Batches by Product View */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b">
              <h3 className="text-lg font-semibold text-gray-950">Сводка по продукции</h3>
              
              {/* Фильтры на дашборде */}
              <div className="flex flex-wrap gap-2 w-full sm:w-auto" data-print="filter-panel">
                <select 
                  value={filterMaterial} 
                  onChange={e => setFilterMaterial(e.target.value)} 
                  className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs bg-slate-50 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">🥩 Все сырье</option>
                  <option value="Свинина">🐖 Свинина</option>
                  <option value="Говядина">🐂 Говядина</option>
                  <option value="Птица">🐓 Птица</option>
                  <option value="Баранина">🐏 Баранина</option>
                  <option value="Субпродукты">🩸 Субпродукты</option>
                  <option value="Иное">📦 Иное</option>
                </select>

                <select 
                  value={filterPackaging} 
                  onChange={e => setFilterPackaging(e.target.value)} 
                  className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs bg-slate-50 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">📦 Все форматы</option>
                  <option value="Блочка">🧊 Блочка</option>
                  <option value="Мелкая фасовка">🛍️ Мелкая</option>
                  <option value="Отруба">🥩 Отруба</option>
                  <option value="Полутуши">🍖 Полутуши</option>
                  <option value="Вакуум">🛡️ Вакуум</option>
                  <option value="Лотки">📥 Лотки</option>
                  <option value="Иное">📦 Иное</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {stockByProduct.map(item => (
                <div key={item.product.id} className="p-4 border rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3" data-print="product-card">
                  {/* Заголовок карточки товара с общим остатком */}
                  <div className="flex justify-between items-start pb-2 border-b border-slate-200/60 cursor-pointer select-none" onClick={() => toggleExpand(item.product.id)}>
                    <div className="flex items-start gap-3">
                      {expandedIds.has(item.product.id)
                        ? <ChevronDown className="text-slate-400 mt-0.5 shrink-0 print:hidden" size={16} />
                        : <ChevronRight className="text-slate-400 mt-0.5 shrink-0 print:hidden" size={16} />
                      }
                      <Package className="text-slate-400 mt-1 shrink-0 print:hidden" size={20} />
                      <div>
                        <p className="font-semibold text-gray-950 font-sans">{item.product.name}</p>
                        <div className="text-xs text-gray-500 font-mono mt-0.5 space-y-1">
                          <div>Артикул: <span className="font-bold text-slate-700">{item.product.sku}</span> | Состояние: <span className={`font-semibold ${item.product.category === 'Охлажденное' ? 'text-blue-500' : 'text-slate-600'}`}>{item.product.category || 'Замороженное'}</span></div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {getMaterialBadge(item.product.rawMaterial)}
                            {getPackagingBadge(item.product.packagingType)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Общий остаток</p>
                      <p className="text-lg font-black text-slate-900">{item.totalKg.toLocaleString()} {item.product.unit || 'кг'}</p>
                    </div>
                  </div>

                  {/* Список конкретных партий по складам (аккордеон) */}
                  {expandedIds.has(item.product.id) && (
                  <div className="pl-6 space-y-2" data-print="batch-list">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Разбивка по партиям:</p>
                    {item.batches.map(b => {
                      const loc = locations.find(l => l.id === b.locationId);
                      const expires = new Date(b.expiresAt);
                      const days = differenceInDays(expires, now);
                      return (
                        <div key={b.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm text-xs transition hover:border-slate-300">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-medium text-slate-500">Склад:</span>
                            <span className="font-bold text-slate-800">{loc?.name || 'Неизвестно'}</span>
                            {b.manufacturedAt && (
                              <span className="text-[10px] text-gray-400 font-mono">
                                (изг. {format(new Date(b.manufacturedAt), 'dd.MM.yyyy')})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-extrabold text-slate-900">{b.quantityKg.toLocaleString()} {item.product.unit || 'кг'}</span>
                            <span className={`font-semibold ${
                              days < 0
                                ? 'text-red-600'
                                : days <= (item.product.notifyBeforeDays ?? 14)
                                  ? 'text-orange-600'
                                  : 'text-green-600'
                            }`}>
                              Годен до: {format(expires, 'dd.MM.yyyy')}
                              <span className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                days < 0
                                  ? 'bg-red-100 text-red-700'
                                  : days <= (item.product.notifyBeforeDays ?? 14)
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-green-100 text-green-700'
                              }`}>
                                {days < 0 ? 'ПРОСРОК' : `${days} дн`}
                              </span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              ))}
              {stockByProduct.length === 0 && (
                <p className="text-gray-500 text-center py-6 font-sans">Нет остатков по заданным параметрам</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Col - Expiring Soon */}
        <div className="space-y-6" data-print="expiring-panel">
          <div className="bg-white p-6 rounded-lg border shadow-sm border-red-100">
            <h3 className="text-lg font-medium text-red-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={20} />
              Внимание: Сроки годности
            </h3>
            <div className="space-y-3">
              {expiringBatches.map(b => {
                const prod = products.find(p => p.id === b.productId);
                const loc = locations.find(l => l.id === b.locationId);
                const days = differenceInDays(new Date(b.expiresAt), now);
                const isCritical = days < 0;
                
                return (
                  <div key={b.id} className={`p-3 rounded-md border ${isCritical ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                    <p className={`font-medium ${isCritical ? 'text-red-800' : 'text-orange-800'}`}>
                      {prod?.name} ({b.quantityKg} {prod?.unit || 'кг'})
                    </p>
                    <div className="text-sm mt-1 flex justify-between">
                      <span className="text-gray-600">{loc?.name}</span>
                      <span className={`font-bold ${isCritical ? 'text-red-600' : 'text-orange-600'}`}>
                        {isCritical ? 'Просрочено!' : `${days} дн`}
                      </span>
                    </div>
                     <p className="text-xs text-gray-500 mt-1">До: {format(new Date(b.expiresAt), 'dd.MM.yyyy')}</p>
                  </div>
                );
              })}
              {expiringBatches.length === 0 && (
                <p className="text-green-600 flex items-center gap-2"><CheckCircle2 size={16}/> Проблемных партий нет</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

import { CheckCircle2 } from 'lucide-react';
