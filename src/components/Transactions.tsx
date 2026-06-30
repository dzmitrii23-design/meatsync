import React, { useState, useMemo } from "react";
import { Product, StorageLocation, Batch, Buyer } from "../types";
import { addDays, format, differenceInDays } from "date-fns";
import { getProductNormalizedCategory, getProductPackagingLabel } from "../utils";
import { SearchableSelect } from "./SearchableSelect";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  CheckCircle2,
  Search,
  Zap,
  Plus,
  Trash2,
  Scissors,
  X,
  AlertCircle,
} from "lucide-react";

interface Props {
  products: Product[];
  locations: StorageLocation[];
  batches: Batch[];
  buyers?: Buyer[];
  onIncome: (batch: Omit<Batch, "id" | "initialQuantityKg">) => void;
  onOutcome: (
    batchId: string,
    quantityKg: number,
    date: string,
    notes?: string,
    outcomeType?: 'sale' | 'waste' | 'mpc',
    buyerId?: string,
    wasteReason?: string
  ) => void;
  onMove: (batchId: string, toLocationId: string, quantityKg: number, date: string) => void;
}

export function Transactions({
  products,
  locations,
  batches,
  buyers = [],
  onIncome,
  onOutcome,
  onMove,
}: Props) {
  const [tab, setTab] = useState<"IN" | "OUT" | "MOVE">("OUT");
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-start border-b pb-4">
        <div className="flex gap-2 w-full md:max-w-xl bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setTab("OUT")}
            className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              tab === "OUT"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <ArrowUpRight size={18} />
            <span>Списание (Расход)</span>
          </button>
          <button
            onClick={() => setTab("IN")}
            className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              tab === "IN"
                ? "bg-green-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <ArrowDownRight size={18} />
            <span>Поступление (Приход)</span>
          </button>
          <button
            onClick={() => setTab("MOVE")}
            className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              tab === "MOVE"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <ArrowLeftRight size={18} />
            <span>Перемещение</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md flex items-center gap-2 shadow-sm">
          <CheckCircle2 size={18} />
          <span className="font-medium">{notification}</span>
        </div>
      )}

      {tab === "IN" ? (
        <IncomeForm
          products={products}
          locations={locations}
          onSubmit={(data) => {
            onIncome(data);
            showNotification(
              "Приход успешно оформлен: " + data.quantityKg + " кг",
            );
          }}
        />
      ) : tab === "OUT" ? (
        <OutcomeForm
          batches={batches}
          products={products}
          locations={locations}
          buyers={buyers}
          onSubmit={(id, qty, date, notes, outcomeType, buyerId, wasteReason) => {
            onOutcome(id, qty, date, notes, outcomeType, buyerId, wasteReason);
            if (outcomeType === "sale") {
              const bObj = buyers.find((by) => by.id === buyerId);
              showNotification(
                `Успешно оформлена продажа: ${qty.toLocaleString()} кг покупателю "${bObj?.name || 'Контрагент'}"`
              );
            } else if (outcomeType === "waste") {
              showNotification(
                `Успешно оформлен утиль: ${qty.toLocaleString()} кг. Причина: "${wasteReason}"`
              );
            } else if (outcomeType === "mpc") {
              showNotification(
                `Успешно оформлено перемещение в МПЦ: ${qty.toLocaleString()} кг`
              );
            } else {
              showNotification(`Успешно списано: ${qty.toLocaleString()} кг`);
            }
          }}
        />
      ) : (
        <MoveForm
          batches={batches}
          products={products}
          locations={locations}
          onSubmit={(id, toLocId, qty, date) => {
            const targetLoc = locations.find((l) => l.id === toLocId);
            onMove(id, toLocId, qty, date);
            showNotification(
              `Успешно перемещено ${qty.toLocaleString()} кг в: ${targetLoc?.name || "камеру хранения"}`
            );
          }}
        />
      )}
    </div>
  );
}

interface IncomeDraftItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
  packagingType?: string;
  locationId: string;
  locationName: string;
  quantityKg: number;
  manufacturedAt: string;
  expiresAt: string;
}

interface SplitRow {
  id: string;
  weight: string;
  date: string;
}

function IncomeForm({
  products,
  locations,
  onSubmit,
}: {
  products: Product[];
  locations: StorageLocation[];
  onSubmit: (data: Omit<Batch, "id" | "initialQuantityKg">) => void;
}) {
  const [drafts, setDrafts] = useState<IncomeDraftItem[]>([]);
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [manufacturedAt, setManufacturedAt] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [expiresAt, setExpiresAt] = useState("");
  const [docReceivedAt, setDocReceivedAt] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitRows, setSplitRows] = useState<SplitRow[]>([
    { id: '1', weight: '', date: format(new Date(), 'yyyy-MM-dd') },
  ]);
  const chilledProducts = useMemo(() =>
    products.filter((p) => getProductNormalizedCategory(p) === "Охлажденное"),
    [products],
  );
  const frozenProducts = useMemo(() =>
    products.filter((p) => getProductNormalizedCategory(p) === "Замороженное"),
    [products],
  );

  const selectedProduct = products.find((p) => p.id === productId);
  const isChilled = selectedProduct
    ? getProductNormalizedCategory(selectedProduct) === "Охлажденное"
    : false;
  const selectedLocation = locations.find((l) => l.id === locationId);
  const isLocationShock = selectedLocation?.type === "shock_freezer";
  const showShockWarning = isChilled && isLocationShock;

  const handleProductChange = (id: string) => {
    setProductId(id);
    const prod = products.find((p) => p.id === id);
    if (prod) {
      if (manufacturedAt) {
        setExpiresAt(
          format(
            addDays(new Date(manufacturedAt), prod.defaultShelfLifeDays),
            "yyyy-MM-dd",
          ),
        );
      }

      // Smart routing advice
      if (getProductNormalizedCategory(prod) === "Охлажденное") {
        const chilledLoc = locations.find((l) => l.type === "chilled_fridge");
        if (chilledLoc) {
          setLocationId(chilledLoc.id);
        }
      } else {
        const mainLoc = locations.find((l) => l.type === "main_fridge");
        if (mainLoc) {
          setLocationId(mainLoc.id);
        }
      }
    }
  };

  const handleDateChange = (dateStr: string) => {
    setManufacturedAt(dateStr);
    const prod = products.find((p) => p.id === productId);
    if (prod && dateStr) {
      setExpiresAt(
        format(
          addDays(new Date(dateStr), prod.defaultShelfLifeDays),
          "yyyy-MM-dd",
        ),
      );
    }
  };

  const handleAddDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !productId ||
      !locationId ||
      !quantityKg ||
      !manufacturedAt ||
      !expiresAt ||
      showShockWarning
    )
      return;

    const prod = products.find((p) => p.id === productId);
    const loc = locations.find((l) => l.id === locationId);
    if (!prod || !loc) return;

    const newItem: IncomeDraftItem = {
      id: `${productId}-${Date.now()}-${Math.random()}`,
      productId,
      productName: prod.name,
      category: prod.category,
      packagingType: prod.packagingType,
      locationId,
      locationName: loc.name,
      quantityKg: Number(quantityKg),
      manufacturedAt: new Date(manufacturedAt).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
    };

    setDrafts((prev) => [...prev, newItem]);
    setQuantityKg("");
  };

  const handleProcessAll = () => {
    if (drafts.length === 0) return;
    drafts.forEach((d) => {
      onSubmit({
        productId: d.productId,
        locationId: d.locationId,
        quantityKg: d.quantityKg,
        receivedAt: new Date(docReceivedAt).toISOString(),
        expiresAt: d.expiresAt,
        manufacturedAt: d.manufacturedAt,
      });
    });
    setDrafts([]);
  };

  // --- Сплиттер дат ---
  const totalSplitWeight = splitRows.reduce((sum, r) => sum + (parseFloat(r.weight) || 0), 0);
  const targetWeight = parseFloat(quantityKg) || 0;
  const remainingSplitWeight = Math.round((targetWeight - totalSplitWeight) * 100) / 100;

  const handleOpenSplitter = () => {
    setSplitRows([{ id: '1', weight: '', date: format(new Date(), 'yyyy-MM-dd') }]);
    setIsSplitModalOpen(true);
  };

  const handleAddSplitRow = () => {
    setSplitRows(prev => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, weight: '', date: format(new Date(), 'yyyy-MM-dd') },
    ]);
  };

  const handleRemoveSplitRow = (id: string) => {
    setSplitRows(prev => prev.filter(r => r.id !== id));
  };

  const handleSplitRowChange = (id: string, field: 'weight' | 'date', value: string) => {
    setSplitRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleFillRemaining = (id: string) => {
    const otherSum = splitRows.reduce((sum, r) => r.id !== id ? sum + (parseFloat(r.weight) || 0) : sum, 0);
    const remaining = Math.round((targetWeight - otherSum) * 100) / 100;
    if (remaining > 0) {
      handleSplitRowChange(id, 'weight', String(remaining));
    }
  };

  const handleConfirmSplit = () => {
    const prod = products.find(p => p.id === productId);
    const loc = locations.find(l => l.id === locationId);
    if (!prod || !loc) return;

    const newDrafts: IncomeDraftItem[] = splitRows
      .filter(r => parseFloat(r.weight) > 0 && r.date)
      .map(r => ({
        id: `${productId}-${Date.now()}-${Math.random()}`,
        productId,
        productName: prod.name,
        category: prod.category,
        packagingType: prod.packagingType,
        locationId,
        locationName: loc.name,
        quantityKg: parseFloat(r.weight),
        manufacturedAt: new Date(r.date).toISOString(),
        expiresAt: format(addDays(new Date(r.date), prod.defaultShelfLifeDays), 'yyyy-MM-dd') + 'T00:00:00.000Z',
      }));

    setDrafts(prev => [...prev, ...newDrafts]);
    setIsSplitModalOpen(false);
    setQuantityKg('');
    setProductId('');
    setExpiresAt('');
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-full">
      {/* Левая колонка: Форма добавления */}
      <form
        onSubmit={handleAddDraft}
        className="lg:col-span-5 bg-white p-4 md:p-6 rounded-lg border shadow-sm h-fit"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b">
          Добавление позиций прихода
        </h2>
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Продукция *
            </label>
            <SearchableSelect
              products={products}
              selectedProductId={productId}
              onSelectProduct={handleProductChange}
              placeholder="Выберите из номенклатуры..."
            />
          </div>

          {/* Suggestion & Warning Banners */}
          {isChilled && (
            <div className="space-y-2">
              <div className="bg-blue-50 border border-blue-100 text-blue-900 p-3 rounded-md text-xs flex items-start gap-2">
                <span className="text-sm select-none">❄️</span>
                <div>
                  <strong>Охлажденный продукт:</strong> Отгружается свежим.
                  Рекомендуемое место хранения —{" "}
                  <strong>Холодильник ОХЛ</strong>.
                </div>
              </div>
              {showShockWarning && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-md text-xs flex items-start gap-2 animate-pulse">
                  <span className="text-sm select-none">⚠️</span>
                  <div>
                    <strong>Ошибка размещения!</strong> Охлажденная продукция не
                    подлежит шоковой заморозке. Пожалуйста, измените выбранный
                    склад.
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Место хранения (Склад) *
            </label>
            <select
              required
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full rounded-md border-gray-300 border shadow-sm p-3 bg-gray-50 focus:bg-white text-sm"
            >
              <option value="">Выберите камеру/реф...</option>
              {locations.some((l) => l.type === "chilled_fridge") && (
                <optgroup label="Холодильники охлажденного мяса (ОХЛ)">
                  {locations
                    .filter((l) => l.type === "chilled_fridge")
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </optgroup>
              )}
              <optgroup label="Основные помещения">
                {locations
                  .filter((l) => l.type === "main_fridge")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Рефы (Контейнеры)">
                {locations
                  .filter((l) => l.type === "reefer")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Шоковая заморозка">
                {locations
                  .filter((l) => l.type === "shock_freezer")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Фактический Вес (кг) *
            </label>
            <input
              required
              type="number"
              min="0.1"
              step="0.1"
              value={quantityKg}
              onChange={(e) => setQuantityKg(e.target.value)}
              className="w-full rounded-md border-gray-300 border shadow-sm p-3 font-semibold text-lg text-blue-800 animate-none"
              placeholder="0.0"
            />
          </div>

          {/* Кнопка Сплиттера */}
          {productId && locationId && parseFloat(quantityKg) > 0 && (
            <button
              type="button"
              onClick={handleOpenSplitter}
              className="w-full py-2.5 border-2 border-dashed border-indigo-300 text-indigo-700 rounded-lg font-semibold text-sm hover:bg-indigo-50 hover:border-indigo-400 transition-all flex justify-center items-center gap-2 cursor-pointer"
            >
              <Scissors size={16} />
              Разбить по датам изготовления
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Дата изготовления *
              </label>
              <input
                required
                type="date"
                value={manufacturedAt}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full rounded-md border-gray-300 border shadow-sm p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Годен до *
              </label>
              <input
                required
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-md border-gray-300 border shadow-sm p-2 bg-gray-50 text-sm"
              />
            </div>
          </div>
        </div>
        <button
          type="submit"
          disabled={showShockWarning}
          className={`w-full py-3.5 text-white rounded-md font-bold text-base transition shadow-md flex justify-center items-center gap-2 cursor-pointer ${showShockWarning ? "bg-gray-400 cursor-not-allowed opacity-75" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          <Plus size={18} />
          Добавить в список прихода
        </button>
      </form>

      {/* Правая колонка: Временный список к поступлению */}
      <div className="lg:col-span-7 bg-slate-50 p-4 md:p-6 rounded-lg border border-slate-200 flex flex-col justify-between min-h-[420px]">
        <div>
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              📋 Позиции к оприходованию
              {drafts.length > 0 && (
                <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full font-extrabold">
                  {drafts.length}
                </span>
              )}
            </h3>
            {drafts.length > 0 && (
              <button
                type="button"
                onClick={() => setDrafts([])}
                className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 bg-red-50 hover:bg-red-100 border border-red-200 rounded px-2.5 py-1 cursor-pointer"
              >
                Очистить всё
              </button>
            )}
          </div>

          {/* Выбор даты поступления для всего документа (Всегда виден) */}
          <div className="mb-4 bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wider">
              📅 Дата поступления (всего документа прихода) *
            </label>
            <input
              required
              type="date"
              value={docReceivedAt}
              onChange={(e) => setDocReceivedAt(e.target.value)}
              className="w-full rounded-md border-gray-300 border shadow-sm p-2 text-sm bg-white text-slate-900 focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          {drafts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <div className="text-3xl mb-2 select-none">📥</div>
              <p className="text-sm font-bold text-slate-500">Временный список пуст</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[280px] mx-auto">
                Заполните форму слева и добавьте позиции для создания сводного поступления.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {drafts.map((d) => (
                <div key={d.id} className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm truncate">{d.productName}</span>
                      {d.packagingType && (
                        <span className="text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded uppercase">
                          {d.packagingType}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 items-center">
                      <span>Склад: <strong className="text-slate-700">{d.locationName}</strong></span>
                      <span>|</span>
                      <span>Изготовлен: <strong className="text-slate-700">{format(new Date(d.manufacturedAt), "dd.MM.yyyy")}</strong></span>
                      <span>|</span>
                      <span>Годен до: <strong className="text-slate-700">{format(new Date(d.expiresAt), "dd.MM.yyyy")}</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-base font-black text-green-600 whitespace-nowrap">
                      +{d.quantityKg.toLocaleString()} кг
                    </span>
                    <button
                      type="button"
                      onClick={() => setDrafts(prev => prev.filter(x => x.id !== d.id))}
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 p-1.5 rounded transition-colors cursor-pointer"
                      title="Удалить позицию"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {drafts.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="flex justify-between items-center mb-4 text-sm font-semibold">
              <span className="text-slate-500">Итого позиций к проведению:</span>
              <span className="text-lg font-extrabold text-slate-900">
                {drafts.reduce((sum, d) => sum + d.quantityKg, 0).toLocaleString()} кг
              </span>
            </div>
            <button
              onClick={handleProcessAll}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex justify-center items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 size={18} />
              Провести поступление ({drafts.length} {drafts.length === 1 ? 'позицию' : drafts.length < 5 ? 'позиции' : 'позиций'})
            </button>
          </div>
        )}
      </div>
    </div>

      {/* Модальное окно Сплиттера дат */}
      {isSplitModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Заголовок */}
            <div className="p-5 border-b bg-indigo-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 text-indigo-700">
                <Scissors size={22} />
                <h3 className="font-bold text-lg text-gray-900">Разбивка по датам изготовления</h3>
              </div>
              <button onClick={() => setIsSplitModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {/* Информация о целевом весе */}
            <div className="px-5 pt-4 pb-2">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm text-blue-800 font-medium">
                  Общий вес по накладной:
                </span>
                <span className="text-lg font-extrabold text-blue-900">
                  {targetWeight.toLocaleString()} кг
                </span>
              </div>
            </div>

            {/* Строки распределения */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {splitRows.map((row, index) => (
                <div key={row.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase">Партия #{index + 1}</span>
                    {splitRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSplitRow(row.id)}
                        className="text-red-400 hover:text-red-600 cursor-pointer p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Вес (кг)</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.weight}
                          onChange={(e) => {
                            const val = e.target.value.replace(',', '.');
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              handleSplitRowChange(row.id, 'weight', val);
                            }
                          }}
                          className="flex-1 rounded-md border border-gray-300 shadow-sm p-2 text-sm font-semibold"
                          placeholder="Введите вес..."
                        />
                        {remainingSplitWeight > 0 && (!row.weight || parseFloat(row.weight) === 0) && (
                          <button
                            type="button"
                            onClick={() => handleFillRemaining(row.id)}
                            className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition font-semibold cursor-pointer whitespace-nowrap"
                            title="Заполнить оставшийся вес"
                          >
                            Остаток
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Дата выработки</label>
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => handleSplitRowChange(row.id, 'date', e.target.value)}
                        className="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddSplitRow}
                className="w-full py-2.5 border-2 border-dashed border-slate-300 text-slate-600 rounded-lg font-medium text-sm hover:bg-slate-100 hover:border-slate-400 transition-all flex justify-center items-center gap-2 cursor-pointer"
              >
                <Plus size={16} />
                Добавить партию с другой датой
              </button>
            </div>

            {/* Нижняя панель */}
            <div className="p-5 border-t bg-slate-50 space-y-3">
              {/* Индикатор остатка */}
              <div className={`flex justify-between items-center text-sm font-semibold rounded-lg p-3 ${
                remainingSplitWeight === 0 && totalSplitWeight > 0
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : remainingSplitWeight < 0
                    ? 'bg-red-50 border border-red-200 text-red-800'
                    : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
              }`}>
                <span>Нераспределенный остаток:</span>
                <span className="text-base font-extrabold">
                  {remainingSplitWeight.toLocaleString()} кг
                </span>
              </div>

              {remainingSplitWeight < 0 && (
                <div className="flex items-center gap-2 text-red-700 text-xs">
                  <AlertCircle size={14} />
                  <span>Сумма весов превышает общий вес по накладной</span>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSplitModalOpen(false)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-100 text-gray-700 font-medium transition cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSplit}
                  disabled={remainingSplitWeight !== 0 || totalSplitWeight === 0}
                  className={`px-5 py-2.5 rounded-lg font-bold text-sm shadow-md flex items-center gap-2 transition cursor-pointer ${
                    remainingSplitWeight === 0 && totalSplitWeight > 0
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 size={18} />
                  Подтвердить разбиение ({splitRows.filter(r => parseFloat(r.weight) > 0).length} партий)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface OutcomeDraftItem {
  id: string;
  batchId: string;
  productName: string;
  packagingType?: string;
  locationName: string;
  quantityKg: number;
  notes?: string;
  outcomeType: 'sale' | 'waste' | 'mpc';
  buyerId?: string;
  buyerName?: string;
  wasteReason?: string;
}

function OutcomeForm({
  batches,
  products,
  locations,
  buyers = [],
  onSubmit,
}: {
  batches: Batch[];
  products: Product[];
  locations: StorageLocation[];
  buyers?: Buyer[];
  onSubmit: (
    batchId: string,
    qty: number,
    date: string,
    notes?: string,
    outcomeType?: 'sale' | 'waste' | 'mpc',
    buyerId?: string,
    wasteReason?: string
  ) => void;
}) {
  const [drafts, setDrafts] = useState<OutcomeDraftItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [inputs, setInputs] = useState<
    Record<string, { 
      qty: string; 
      notes: string; 
      outcomeType: 'sale' | 'waste' | 'mpc';
      buyerId: string;
      wasteReason: string;
    }>
  >({});

  const [docDate, setDocDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );

  const draftAllocatedWeights = useMemo(() => {
    const map: Record<string, number> = {};
    drafts.forEach((d) => {
      map[d.batchId] = (map[d.batchId] || 0) + d.quantityKg;
    });
    return map;
  }, [drafts]);

  const filteredBatches = useMemo(() => {
    return batches
      .filter((b) => {
        const allocated = draftAllocatedWeights[b.id] || 0;
        if (b.quantityKg - allocated <= 0) return false;
        const p = products.find((prod) => prod.id === b.productId);
        if (!p) return false;
        if (!searchTerm) return true;
        const lower = searchTerm.toLowerCase();
        return (
          p.name.toLowerCase().includes(lower) ||
          p.sku.toLowerCase().includes(lower) ||
          p.category.toLowerCase().includes(lower)
        );
      })
      .sort(
        (a, b) =>
          new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
      );
  }, [batches, products, searchTerm, draftAllocatedWeights]);

  const handleAddDraft = (batchId: string) => {
    const data = inputs[batchId];

    const b = batches.find((x) => x.id === batchId);
    const prod = products.find((x) => x.id === b?.productId);
    const loc = locations.find((x) => x.id === b?.locationId);
    if (!b || !prod || !loc) return;

    const allocated = draftAllocatedWeights[batchId] || 0;
    const maxQty = b.quantityKg - allocated;

    const enteredQty = data?.qty;
    const qty = enteredQty !== undefined && enteredQty !== "" ? Number(enteredQty.replace(',', '.')) : maxQty;

    if (isNaN(qty) || qty <= 0 || qty > maxQty) return;

    const outcomeType = data?.outcomeType || "sale";
    const buyerId = outcomeType === "sale" ? (data?.buyerId || buyers[0]?.id) : undefined;
    const wasteReason = outcomeType === "waste" ? data?.wasteReason : undefined;
    const buyerObj = buyers.find((by) => by.id === buyerId);

    const newDraft: OutcomeDraftItem = {
      id: `${batchId}-${Date.now()}-${Math.random()}`,
      batchId,
      productName: prod.name,
      packagingType: prod.packagingType,
      locationName: loc.name,
      quantityKg: qty,
      notes: data?.notes || "",
      outcomeType,
      buyerId,
      buyerName: buyerObj?.name,
      wasteReason,
    };

    setDrafts((prev) => [...prev, newDraft]);

    // Clear after adding
    setInputs((prev) => {
      const copy = { ...prev };
      delete copy[batchId];
      return copy;
    });
  };

  const updateInput = (
    batchId: string,
    field: "qty" | "notes" | "outcomeType" | "buyerId" | "wasteReason",
    value: string,
  ) => {
    setInputs((prev) => {
      const current = prev[batchId] || {
        qty: "",
        notes: "",
        outcomeType: "sale",
        buyerId: buyers[0]?.id || "",
        wasteReason: "",
      };
      return {
        ...prev,
        [batchId]: {
          ...current,
          [field]: value as any,
        },
      };
    });
  };

  const handleProcessAll = () => {
    if (drafts.length === 0) return;
    drafts.forEach((d) => {
      onSubmit(
        d.batchId,
        d.quantityKg,
        new Date(docDate).toISOString(),
        d.notes,
        d.outcomeType,
        d.buyerId,
        d.wasteReason
      );
    });
    setDrafts([]);
  };

  const getOutcomeTypeLabel = (type: 'sale' | 'waste' | 'mpc') => {
    if (type === 'sale') return 'Продажа';
    if (type === 'waste') return 'Утиль';
    return 'В МПЦ';
  };

  const getOutcomeTypeBadgeStyle = (type: 'sale' | 'waste' | 'mpc') => {
    if (type === 'sale') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (type === 'waste') return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-purple-100 text-purple-800 border-purple-200';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-full">
      {/* Левая колонка: Полноценный выбор партий и поиск */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm sticky top-0 z-10">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Поиск лотов по наименованию, категории или артикулу..."
              className="w-full pl-10 pr-4 py-3 rounded-md border-gray-300 border shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <Zap size={14} className="text-amber-500" /> Партии отсортированы по
            сроку годности (FIFO). Списывайте верхние первыми!
          </p>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {filteredBatches.length === 0 ? (
            <div className="text-center py-10 text-gray-500 bg-white rounded-lg border">
              Нет доступных партий по вашему запросу.
            </div>
          ) : (
            filteredBatches.map((b) => {
              const product = products.find((p) => p.id === b.productId);
              const location = locations.find((l) => l.id === b.locationId);
              if (!product || !location) return null;

              const expires = new Date(b.expiresAt);
              const daysLeft = differenceInDays(expires, new Date());
              const threshold = product.notifyBeforeDays ?? 14;
              const isCritical = daysLeft < threshold;
              const isExpired = daysLeft < 0;

              const allocated = draftAllocatedWeights[b.id] || 0;
              const maxQty = b.quantityKg - allocated;

              const enteredQtyVal = inputs[b.id]?.qty;
              const finalQtyStr = enteredQtyVal !== undefined ? enteredQtyVal : maxQty.toString();
              const finalQtyValue = Number(finalQtyStr.replace(',', '.'));
              const isInvalidQty = isNaN(finalQtyValue) || finalQtyValue <= 0 || finalQtyValue > maxQty;

              return (
                <div
                  key={b.id}
                  className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col"
                >
                  <div className="p-4 border-b bg-slate-50 flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg leading-tight flex flex-wrap items-center gap-2">
                        <span>{product.name}</span>
                        {product.packagingType && (
                          <span className="text-xs font-bold bg-slate-200/80 text-slate-700 border border-slate-300 px-2 py-0.5 rounded-md uppercase">
                            {product.packagingType}
                          </span>
                        )}
                      </h3>
                      <div className="text-sm text-gray-600 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span>
                          Склад:{" "}
                          <strong className="text-gray-900">
                            {location.name}
                          </strong>
                        </span>
                        <span className="text-gray-400">|</span>
                        <span>Артикул: {product.sku}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">
                        Доступно
                      </div>
                      <div className="bg-blue-100 text-blue-800 font-bold px-3 py-1.5 rounded-lg text-lg ring-1 ring-blue-300">
                        {maxQty.toLocaleString()}{" "}
                        <span className="text-sm font-normal">кг</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 flex flex-col md:flex-row gap-4 items-center">
                    <div className="w-full md:w-1/3 flex flex-col gap-1">
                      <div
                        className={`text-sm px-3 py-2 rounded border flex items-center justify-between
                        ${isExpired ? "bg-red-50 border-red-200 text-red-800" : isCritical ? "bg-orange-50 border-orange-200 text-orange-800" : "bg-green-50 border-green-200 text-green-800"}
                    `}
                      >
                        <span className="font-medium">
                          Годен до: {format(expires, "dd.MM.yyyy")}
                        </span>
                        <span className="font-bold text-xs bg-white/50 px-2 py-0.5 rounded">
                          {isExpired ? "ПРОСРОК" : `${daysLeft} дн`}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 w-full flex flex-col gap-3">
                      {/* Спецификация типа списания */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 border p-3 rounded-xl border-slate-200">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Категория списания</label>
                          <select
                            className="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-xs font-semibold cursor-pointer text-slate-800 focus:ring-1 focus:ring-blue-500"
                            value={inputs[b.id]?.outcomeType || "sale"}
                            onChange={(e) => updateInput(b.id, "outcomeType", e.target.value)}
                          >
                            <option value="sale">🤝 Продажа покупателю</option>
                            <option value="waste">🗑️ Списание в утиль</option>
                            <option value="mpc">🏭 Перемещение в МПЦ</option>
                          </select>
                        </div>

                        {/* Условные поля для покупателя / причины утиля / МПЦ */}
                        {(inputs[b.id]?.outcomeType || "sale") === "sale" && (
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Покупатель из справочника *</label>
                            {buyers.length > 0 ? (
                              <select
                                className="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-xs font-medium cursor-pointer text-slate-800 focus:ring-1 focus:ring-blue-500"
                                value={inputs[b.id]?.buyerId || buyers[0]?.id || ""}
                                onChange={(e) => updateInput(b.id, "buyerId", e.target.value)}
                              >
                                {buyers.map((by) => (
                                  <option key={by.id} value={by.id}>
                                    {by.name} {by.inn ? `(ИНН: ${by.inn})` : ""}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="text-xs text-amber-700 bg-amber-50 rounded-lg border border-amber-200 p-2.5 font-medium">
                                ⚠️ Нет доступных покупателей! Внесите их в справочник во вкладке «База».
                              </div>
                            )}
                          </div>
                        )}
                        {(inputs[b.id]?.outcomeType || "sale") === "waste" && (
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Причина утилизации (можно написать текстом) *</label>
                            <input
                              type="text"
                              required
                              placeholder="Например: Истек сырьевой срок, технологический брак, бой упаковки..."
                              className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-slate-900 bg-white focus:ring-red-500 focus:border-red-500"
                              value={inputs[b.id]?.wasteReason || ""}
                              onChange={(e) => updateInput(b.id, "wasteReason", e.target.value)}
                            />
                          </div>
                        )}
                        {(inputs[b.id]?.outcomeType || "sale") === "mpc" && (
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Назначение перемещения</label>
                            <div className="text-xs text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 font-medium flex items-center gap-1.5 h-10 select-none">
                              🏭 Продукция перемещается в мясоперерабатывающий цех (МПЦ) для производства.
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Поля веса и отправки */}
                      <div className="flex flex-col sm:flex-row gap-2 mt-1">
                        <div className="relative w-full sm:w-[180px] shrink-0">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Вес (кг)"
                            className={`w-full border rounded-lg p-3 pr-16 text-lg font-extrabold shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-950 ${
                              isInvalidQty
                                ? "border-red-500 bg-red-50 text-red-900 focus:ring-red-500"
                                : "border-gray-300 text-slate-950 bg-white"
                            }`}
                            value={finalQtyStr}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.,]/g, '');
                              updateInput(b.id, "qty", val);
                            }}
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateInput(b.id, "qty", maxQty.toString())
                              }
                              className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200 cursor-pointer select-none active:scale-95"
                              title="Выбрать весь доступный вес"
                            >
                              Всё
                            </button>
                            <span className="text-gray-400 text-xs font-mono select-none">
                              кг
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddDraft(b.id)}
                          disabled={
                            isInvalidQty ||
                            ((inputs[b.id]?.outcomeType || "sale") === "sale" && buyers.length === 0) ||
                            ((inputs[b.id]?.outcomeType || "sale") === "waste" && (!inputs[b.id]?.wasteReason || !inputs[b.id].wasteReason.trim()))
                          }
                          className="flex-1 bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold rounded-lg px-6 py-3 shadow-md hover:bg-blue-700 transition whitespace-nowrap cursor-pointer active:scale-[0.98]"
                        >
                          Добавить в список
                        </button>
                      </div>
                      {isInvalidQty && Number((inputs[b.id]?.qty || "").replace(',', '.')) > maxQty && (
                        <div className="text-xs text-red-600 font-bold flex items-center gap-1 bg-red-50 px-2.5 py-1.5 rounded-md border border-red-100 self-start">
                          ⚠️ Вес ({Number(inputs[b.id]?.qty.replace(',', '.')).toLocaleString()} кг)
                          превышает доступный лимит партии (
                          {maxQty.toLocaleString()} кг)!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Правая колонка: Сводный список к списанию (в стиле прихода) */}
      <div className="lg:col-span-5 bg-slate-50 p-4 md:p-6 rounded-lg border border-slate-200 flex flex-col justify-between min-h-[420px] h-fit sticky top-6">
        <div>
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              📋 Списание в черновике
              {drafts.length > 0 && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-extrabold">
                  {drafts.length}
                </span>
              )}
            </h3>
            {drafts.length > 0 && (
              <button
                type="button"
                onClick={() => setDrafts([])}
                className="text-xs text-red-600 hover:text-red-800 font-bold bg-red-50 hover:bg-red-100 border border-red-200 rounded px-2.5 py-1 cursor-pointer"
              >
                Очистить всё
              </button>
            )}
          </div>

          {/* Выбор даты списания для всего документа (Всегда виден) */}
          <div className="mb-4 bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wider">
              📅 Дата проведения документа расхода *
            </label>
            <input
              required
              type="date"
              value={docDate}
              onChange={(e) => setDocDate(e.target.value)}
              className="w-full rounded-md border-gray-300 border shadow-sm p-2 text-sm bg-white text-slate-900 focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          {drafts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <div className="text-3xl mb-2 select-none">📤</div>
              <p className="text-sm font-bold text-slate-500">Черновик списания пуст</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[280px] mx-auto">
                Добавьте вес из доступных партий слева, чтобы сформировать сводную накладную.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {drafts.map((d) => (
                <div key={d.id} className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center gap-4 text-xs font-medium text-slate-700">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-sm">{d.productName}</span>
                      {d.packagingType && (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-1 py-0.5 rounded uppercase">
                          {d.packagingType}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-extrabold uppercase ${getOutcomeTypeBadgeStyle(d.outcomeType)}`}>
                        {getOutcomeTypeLabel(d.outcomeType)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                      <span>Склад: <strong>{d.locationName}</strong></span>
                      {d.buyerName && (
                        <>
                          <span>•</span>
                          <span>Покупатель: <strong>{d.buyerName}</strong></span>
                        </>
                      )}
                      {d.wasteReason && (
                        <>
                          <span>•</span>
                          <span>Причина: <strong className="text-red-700">{d.wasteReason}</strong></span>
                        </>
                      )}
                      {d.notes && (
                        <>
                          <span>•</span>
                          <span>Примеч.: <em>{d.notes}</em></span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-black text-blue-600 whitespace-nowrap">
                      -{d.quantityKg.toLocaleString()} кг
                    </span>
                    <button
                      type="button"
                      onClick={() => setDrafts((prev) => prev.filter((x) => x.id !== d.id))}
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 p-1.5 rounded transition-colors cursor-pointer"
                      title="Удалить позицию"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {drafts.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="flex justify-between items-center mb-4 text-sm font-semibold">
              <span className="text-slate-500">Итого к списанию:</span>
              <span className="text-lg font-extrabold text-slate-900">
                {drafts.reduce((sum, d) => sum + d.quantityKg, 0).toLocaleString()} кг
              </span>
            </div>
            <button
              onClick={handleProcessAll}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex justify-center items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 size={18} />
              Провести списание ({drafts.length} шт)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface MoveDraftItem {
  id: string;
  batchId: string;
  productName: string;
  packagingType?: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  quantityKg: number;
}

function MoveForm({
  batches,
  products,
  locations,
  onSubmit,
}: {
  batches: Batch[];
  products: Product[];
  locations: StorageLocation[];
  onSubmit: (batchId: string, toLocationId: string, quantityKg: number, date: string) => void;
}) {
  const [drafts, setDrafts] = useState<MoveDraftItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [targetLocations, setTargetLocations] = useState<Record<string, string>>({});
  const [inputs, setInputs] = useState<Record<string, { qty: string }>>({});

  const [docDate, setDocDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );

  const updateInput = (batchId: string, field: "qty", value: string) => {
    setInputs((prev) => ({
      ...prev,
      [batchId]: {
        ...prev[batchId],
        [field]: value,
      },
    }));
  };

  const draftAllocatedWeights = useMemo(() => {
    const map: Record<string, number> = {};
    drafts.forEach((d) => {
      map[d.batchId] = (map[d.batchId] || 0) + d.quantityKg;
    });
    return map;
  }, [drafts]);

  const draftTargetLocationWeights = useMemo(() => {
    const map: Record<string, number> = {};
    drafts.forEach((d) => {
      map[d.toLocationId] = (map[d.toLocationId] || 0) + d.quantityKg;
    });
    return map;
  }, [drafts]);

  const filteredBatches = useMemo(() => {
    return batches
      .filter((b) => {
        const allocated = draftAllocatedWeights[b.id] || 0;
        if (b.quantityKg - allocated <= 0) return false;
        const p = products.find((prod) => prod.id === b.productId);
        if (!p) return false;
        if (!searchTerm) return true;
        const lower = searchTerm.toLowerCase();
        return (
          p.name.toLowerCase().includes(lower) ||
          p.sku.toLowerCase().includes(lower) ||
          p.category.toLowerCase().includes(lower)
        );
      })
      .sort(
        (a, b) =>
          new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
      );
  }, [batches, products, searchTerm, draftAllocatedWeights]);

  const handleAddDraft = (batchId: string, currentBatchMaxQty: number) => {
    const toLocationId = targetLocations[batchId];
    if (!toLocationId) return;

    const b = batches.find((x) => x.id === batchId);
    if (!b) return;

    const allocated = draftAllocatedWeights[batchId] || 0;
    const maxQty = b.quantityKg - allocated;

    const enteredQty = inputs[batchId]?.qty;
    const qty = enteredQty !== undefined && enteredQty !== "" ? Number(enteredQty.replace(',', '.')) : maxQty;

    if (isNaN(qty) || qty <= 0 || qty > maxQty) return;

    // Check capacity
    const totalInTarget = batches
      .filter((x) => x.locationId === toLocationId)
      .reduce((s, x) => s + x.quantityKg, 0) + (draftTargetLocationWeights[toLocationId] || 0);

    const selectedTargetLoc = locations.find((l) => l.id === toLocationId);
    const capacityKg = selectedTargetLoc?.capacityKg || 0;
    const remaining = Math.max(0, capacityKg - totalInTarget);

    if (qty > remaining) return;

    const prod = products.find((x) => x.id === b.productId);
    const fromLoc = locations.find((x) => x.id === b.locationId);
    if (!prod || !fromLoc || !selectedTargetLoc) return;

    const newDraft: MoveDraftItem = {
      id: `${batchId}-${Date.now()}-${Math.random()}`,
      batchId,
      productName: prod.name,
      packagingType: prod.packagingType,
      fromLocationId: b.locationId,
      fromLocationName: fromLoc.name,
      toLocationId,
      toLocationName: selectedTargetLoc.name,
      quantityKg: qty,
    };

    setDrafts((prev) => [...prev, newDraft]);

    // Clear after adding
    setTargetLocations((prev) => {
      const copy = { ...prev };
      delete copy[batchId];
      return copy;
    });
    setInputs((prev) => {
      const copy = { ...prev };
      delete copy[batchId];
      return copy;
    });
  };

  const handleProcessAll = () => {
    if (drafts.length === 0) return;
    drafts.forEach((d) => {
      onSubmit(d.batchId, d.toLocationId, d.quantityKg, new Date(docDate).toISOString());
    });
    setDrafts([]);
  };

  const getLocationIcon = (type: string) => {
    switch (type) {
      case "chilled_fridge":
        return "❄️";
      case "main_fridge":
        return "📦";
      case "reefer":
        return "🚛";
      case "shock_freezer":
        return "⚡";
      default:
        return "📍";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-full">
      {/* Левая колонка: Доступные партии и поиск */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm sticky top-0 z-10">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Поиск партий по наименованию, категории или артикулу..."
              className="w-full pl-10 pr-4 py-3 rounded-md border-gray-300 border shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {filteredBatches.length === 0 ? (
            <div className="text-center py-10 text-gray-500 bg-white rounded-lg border">
              Нет доступных партий по вашему запросу.
            </div>
          ) : (
            filteredBatches.map((b) => {
              const product = products.find((p) => p.id === b.productId);
              const location = locations.find((l) => l.id === b.locationId);
              if (!product || !location) return null;

              const expires = new Date(b.expiresAt);
              const daysLeft = differenceInDays(expires, new Date());
              const threshold = product.notifyBeforeDays ?? 14;
              const isCritical = daysLeft < threshold;
              const isExpired = daysLeft < 0;

              const otherLocations = locations.filter((l) => l.id !== b.locationId);
              const selectedTargetId = targetLocations[b.id] || "";

              const allocated = draftAllocatedWeights[b.id] || 0;
              const maxQty = b.quantityKg - allocated;

              const enteredQtyVal = inputs[b.id]?.qty;
              const finalQtyStr = enteredQtyVal !== undefined ? enteredQtyVal : maxQty.toString();
              const finalQtyValue = Number(finalQtyStr.replace(',', '.'));
              const isInvalidQty = isNaN(finalQtyValue) || finalQtyValue <= 0 || finalQtyValue > maxQty;

              const totalInTarget = batches
                .filter((x) => x.locationId === selectedTargetId)
                .reduce((s, x) => s + x.quantityKg, 0) + (draftTargetLocationWeights[selectedTargetId] || 0);

              const selectedTargetLoc = locations.find((l) => l.id === selectedTargetId);
              const targetAvailableKg = selectedTargetLoc
                ? Math.max(0, selectedTargetLoc.capacityKg - totalInTarget)
                : 0;
              const isOverCapacity = selectedTargetId ? finalQtyValue > targetAvailableKg : false;

              return (
                <div
                  key={b.id}
                  className="bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Заголовок карточки товара */}
                  <div className="bg-slate-50 px-4 py-3 border-b flex justify-between items-center gap-4">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                        <span className="truncate">{product.name}</span>
                        {product.packagingType && (
                          <span className="text-[10px] font-extrabold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded border border-slate-300 uppercase shrink-0">
                            {product.packagingType}
                          </span>
                        )}
                      </h3>
                      <div className="text-sm text-gray-600 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span>
                          Из:{" "}
                          <strong className="text-gray-900">
                            {location.name}
                          </strong>
                        </span>
                        <span className="text-gray-400">|</span>
                        <span>Артикул: {product.sku}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">
                        В партии
                      </div>
                      <div className="bg-indigo-100 text-indigo-800 font-bold px-3 py-1.5 rounded-lg text-lg ring-1 ring-indigo-300">
                        {maxQty.toLocaleString()}{" "}
                        <span className="text-sm font-normal">кг</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 flex flex-col md:flex-row gap-4 items-center animate-fade-in font-sans">
                    <div className="w-full md:w-1/4 flex flex-col gap-1">
                      <div
                        className={`text-sm px-3 py-2 rounded border flex items-center justify-between
                        ${isExpired ? "bg-red-50 border-red-200 text-red-800" : isCritical ? "bg-orange-50 border-orange-200 text-orange-800" : "bg-green-50 border-green-200 text-green-800"}
                      `}
                      >
                        <span className="font-medium">
                          Годен до: {format(expires, "dd.MM.yyyy")}
                        </span>
                        <span className="font-bold text-xs bg-white/50 px-2 py-0.5 rounded">
                          {isExpired ? "ПРОСРОК" : `${daysLeft} дн`}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 w-full flex flex-col gap-3">
                      {/* Weight and Destination Selection Row */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative w-full sm:w-[180px] shrink-0">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Весь вес"
                            className={`w-full border rounded-lg p-3 pr-16 text-lg font-extrabold shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-950 ${
                              isInvalidQty
                                ? "border-red-500 bg-red-50 text-red-900 focus:ring-red-500"
                                : "border-gray-300 text-slate-950 bg-white"
                            }`}
                            value={inputs[b.id]?.qty !== undefined ? inputs[b.id].qty : maxQty.toString()}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.,]/g, '');
                              updateInput(b.id, "qty", val);
                            }}
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateInput(b.id, "qty", maxQty.toString())
                              }
                              className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200 cursor-pointer select-none active:scale-95"
                              title="Выбрать весь вес"
                            >
                              Всё
                            </button>
                            <span className="text-gray-400 text-xs font-mono select-none">
                              кг
                            </span>
                          </div>
                        </div>

                        <select
                          className="flex-1 border-gray-300 border rounded-lg p-3 text-base shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white cursor-pointer min-w-0"
                          value={selectedTargetId}
                          onChange={(e) =>
                            setTargetLocations((prev) => ({
                              ...prev,
                              [b.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">-- Выберите целевую камеру хранения --</option>
                          {otherLocations.map((loc) => {
                            const currentUsed = batches
                              .filter((x) => x.locationId === loc.id)
                              .reduce((s, x) => s + x.quantityKg, 0) + (draftTargetLocationWeights[loc.id] || 0);
                            const remaining = Math.max(0, loc.capacityKg - currentUsed);
                            return (
                              <option key={loc.id} value={loc.id}>
                                {getLocationIcon(loc.type)} {loc.name} (свободно: {remaining.toLocaleString()} кг)
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Prominent Add to Draft Button */}
                      <button
                        onClick={() => handleAddDraft(b.id, b.quantityKg)}
                        disabled={!selectedTargetId || isInvalidQty || isOverCapacity}
                        className="w-full bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-lg py-3 shadow-md hover:bg-indigo-700 transition cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                      >
                        <Plus size={16} />
                        Добавить в черновик перемещения
                      </button>
                      {isInvalidQty && Number((inputs[b.id]?.qty || "").replace(',', '.')) > maxQty && (
                        <p className="text-xs text-red-600 font-bold bg-red-50 px-2 py-1 rounded border border-red-100 self-start">
                          ⚠️ Вес ({Number(inputs[b.id]?.qty.replace(',', '.')).toLocaleString()} кг) превышает доступное количество партии ({maxQty} кг)!
                        </p>
                      )}
                      {isOverCapacity && (
                        <p className="text-xs text-red-650 font-bold bg-red-50 px-2 py-1 rounded border border-red-100 self-start">
                          ⚠️ Вес перемещения ({finalQtyValue} кг) превосходит оставшуюся вместимость выбранного склада ({targetAvailableKg} кг)!
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Правая колонка: Сводный черновик перемещений */}
      <div className="lg:col-span-5 bg-indigo-50/50 p-4 md:p-6 border border-indigo-100 rounded-xl flex flex-col justify-between min-h-[420px] h-fit sticky top-6">
        <div>
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-indigo-200">
            <h3 className="text-base font-bold text-indigo-950 flex items-center gap-2">
              📋 Черновик перемещения
              {drafts.length > 0 && (
                <span className="bg-indigo-100 text-indigo-800 text-xs px-2.5 py-0.5 rounded-full font-black">
                  {drafts.length}
                </span>
              )}
            </h3>
            {drafts.length > 0 && (
              <button
                type="button"
                onClick={() => setDrafts([])}
                className="text-xs text-red-600 hover:text-red-800 font-bold bg-white border border-indigo-200 rounded px-2.5 py-1 cursor-pointer"
              >
                Очистить всё
              </button>
            )}
          </div>

          {/* Выбор даты перемещения для всего документа (Всегда виден) */}
          <div className="mb-4 bg-white p-3.5 rounded-lg border border-indigo-100 shadow-inner">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wider">
              📅 Дата проведения перемещения (документа) *
            </label>
            <input
              required
              type="date"
              value={docDate}
              onChange={(e) => setDocDate(e.target.value)}
              className="w-full rounded-md border-gray-300 border shadow-sm p-2 text-sm bg-white text-slate-900 focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          {drafts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <div className="text-3xl mb-2 select-none">🔄</div>
              <p className="text-sm font-bold text-indigo-900">Черновик перемещения пуст</p>
              <p className="text-xs text-indigo-700/70 mt-1 max-w-[280px] mx-auto">
                Выберите целевую камеру и вес слева, чтобы добавить позиции во временный ордер.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {drafts.map((d) => (
                <div key={d.id} className="bg-white p-3.5 rounded-lg border border-indigo-100 flex justify-between items-center gap-4 text-xs font-medium text-slate-700">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-sm truncate">{d.productName}</span>
                      {d.packagingType && (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-1 py-0.5 rounded uppercase">
                          {d.packagingType}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-2 items-center">
                      <span>Откуда: <strong className="text-slate-800 bg-slate-50 px-1.5 py-0.5 rounded border">{d.fromLocationName}</strong></span>
                      <span>➔</span>
                      <span>Куда: <strong className="text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{d.toLocationName}</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-black text-indigo-600 whitespace-nowrap">
                      {d.quantityKg.toLocaleString()} кг
                    </span>
                    <button
                      type="button"
                      onClick={() => setDrafts((prev) => prev.filter((x) => x.id !== d.id))}
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 p-1.5 rounded transition-colors cursor-pointer"
                      title="Удалить позицию"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {drafts.length > 0 && (
          <div className="mt-6 pt-4 border-t border-indigo-200">
            {/* Выбор даты перемещения для всего документа */}
            <div className="flex justify-between items-center mb-4 text-sm font-semibold">
              <span className="text-indigo-900">Итого к перемещению:</span>
              <span className="text-lg font-extrabold text-slate-900">
                {drafts.reduce((sum, d) => sum + d.quantityKg, 0).toLocaleString()} кг
              </span>
            </div>
            <button
              onClick={handleProcessAll}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex justify-center items-center gap-2 cursor-pointer"
            >
              <ArrowLeftRight size={18} />
              Провести перемещение ({drafts.length} шт)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
