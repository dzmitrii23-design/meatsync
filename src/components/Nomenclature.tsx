import React, { useState, useRef, useMemo } from 'react';
import { Product, Buyer } from '../types';
import { Plus, Trash2, Edit2, Check, X, Upload, FileSpreadsheet, Eye, AlertCircle, Phone, Search } from 'lucide-react';
import { autoDetectAttributes } from '../utils';
import * as XLSX from 'xlsx';

const getMaterialBadge = (material?: string) => {
  const label = material || 'Иное';
  switch (label) {
    case 'Свинина':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-pink-100 text-pink-800 border border-pink-200">🐖 Свинина</span>;
    case 'Говядина':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">🐂 Говядина</span>;
    case 'Птица':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">🐓 Птица</span>;
    case 'Баранина':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-900 border border-red-200">🐏 Баранина</span>;
    case 'Субпродукты':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">🩸 Субпродукты</span>;
    default:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">📦 Иное</span>;
  }
};

const getPackagingBadge = (pack?: string) => {
  const label = pack || 'Иное';
  switch (label) {
    case 'Блочка':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">🧊 Блочка</span>;
    case 'Мелкая фасовка':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 border border-green-200">🛍️ Мелкая</span>;
    case 'Отруба':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">🥩 Отруба</span>;
    case 'Полутуши':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">🍖 Полутуши</span>;
    case 'Вакуум':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">🛡️ Вакуум</span>;
    case 'Лотки':
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">📥 Лотки</span>;
    default:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">📦 Иное</span>;
  }
};

interface Props {
  products: Product[];
  onAdd: (product: Omit<Product, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<Omit<Product, 'id'>>) => void;
  onDelete: (id: string) => void;
  onImportMany?: (newProducts: Omit<Product, 'id'>[], action: 'overwrite' | 'preserve') => void;
  buyers?: Buyer[];
  onAddBuyer?: (buyer: Omit<Buyer, 'id'>) => void;
  onUpdateBuyer?: (id: string, updates: Partial<Omit<Buyer, 'id'>>) => void;
  onDeleteBuyer?: (id: string) => void;
}

export function Nomenclature({ 
  products, 
  onAdd, 
  onUpdate, 
  onDelete, 
  onImportMany,
  buyers = [],
  onAddBuyer,
  onUpdateBuyer,
  onDeleteBuyer
}: Props) {
  const [subTab, setSubTab] = useState<'products' | 'buyers'>('products');
  const [isAddingBuyer, setIsAddingBuyer] = useState(false);
  const [editingBuyerId, setEditingBuyerId] = useState<string | null>(null);
  const [buyerSearchQuery, setBuyerSearchQuery] = useState('');
  const [confirmDeleteBuyerId, setConfirmDeleteBuyerId] = useState<string | null>(null);
  const [confirmDeleteProductId, setConfirmDeleteProductId] = useState<string | null>(null);
  
  const [buyerFormData, setBuyerFormData] = useState({
    name: '',
    inn: '',
    phone: '',
  });

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  
  // States back up
  const [excelRows, setExcelRows] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, number>>({
    sku: -1,
    name: -1,
    category: -1,
    defaultShelfLifeDays: -1,
    notifyBeforeDays: -1,
    rawMaterial: -1,
    packagingType: -1,
    unit: -1,
  });
  const [parsedProducts, setParsedProducts] = useState<Omit<Product, 'id'>[]>([]);
  const [duplicateAction, setDuplicateAction] = useState<'overwrite' | 'preserve'>('preserve');
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Охлажденное',
    defaultShelfLifeDays: 15,
    notifyBeforeDays: 5,
    rawMaterial: 'Свинина',
    packagingType: 'Блочка',
    unit: 'кг',
  });

  const [autoSku, setAutoSku] = useState(true);

  // Filter states
  const [filterMaterial, setFilterMaterial] = useState<string>('all');
  const [filterPackaging, setFilterPackaging] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredProducts = products.filter(p => {
    const mat = p.rawMaterial || 'Иное';
    const pack = p.packagingType || 'Иное';
    const query = searchQuery.trim().toLowerCase();
    
    const matchesMaterial = filterMaterial === 'all' || mat === filterMaterial;
    const matchesPackaging = filterPackaging === 'all' || pack === filterPackaging;
    const matchesQuery = !query || 
      p.name.toLowerCase().includes(query) || 
      p.sku.toLowerCase().includes(query) || 
      p.category.toLowerCase().includes(query);
      
    return matchesMaterial && matchesPackaging && matchesQuery;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      ...formData,
      sku: autoSku ? '' : formData.sku.trim()
    });
    setIsAdding(false);
    setFormData({ 
      name: '', 
      sku: '', 
      category: 'Охлажденное', 
      defaultShelfLifeDays: 15, 
      notifyBeforeDays: 5,
      rawMaterial: 'Свинина',
      packagingType: 'Блочка',
      unit: 'кг'
    });
    setAutoSku(true);
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      defaultShelfLifeDays: product.defaultShelfLifeDays,
      notifyBeforeDays: product.notifyBeforeDays ?? 14,
      rawMaterial: product.rawMaterial ?? 'Иное',
      packagingType: product.packagingType ?? 'Иное',
      unit: product.unit ?? 'кг',
    });
  };

  const handleEditSubmit = (id: string) => {
    onUpdate(id, formData);
    setEditingId(null);
  };

  // Excel parsing logic
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Read raw data as 2D array
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
        
        if (rows.length === 0) {
          throw new Error('Файл пустой или некорректный');
        }

        // Находим строку заголовков (содержащую "Код" или "Наименование" или аналогичные)
        let headerIndex = -1;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (row && row.some(cell => {
            const str = String(cell || '').toLowerCase();
            return str.includes('код') || str.includes('артикул') || str.includes('sku');
          }) && row.some(cell => {
            const str = String(cell || '').toLowerCase();
            return str.includes('наименование') || str.includes('название');
          })) {
            headerIndex = i;
            break;
          }
        }

        // Если не нашли специфическую строку, откатываемся к первому непустому ряду
        if (headerIndex === -1) {
          headerIndex = 0;
          while (headerIndex < rows.length && rows[headerIndex].filter(Boolean).length === 0) {
            headerIndex++;
          }
        }

        if (headerIndex >= rows.length) {
          throw new Error('Не удалось найти заголовки табличной части');
        }

        const rawHeaders = rows[headerIndex].map(h => String(h || '').trim());
        const dataRows = rows.slice(headerIndex + 1).filter(row => row.some(cell => cell !== ''));

        setHeaders(rawHeaders);
        setExcelRows(dataRows);

        // Auto match columns based on keywords
        const initialMap: Record<string, number> = { 
          sku: -1, 
          name: -1, 
          category: -1, 
          defaultShelfLifeDays: -1, 
          notifyBeforeDays: -1,
          rawMaterial: -1,
          packagingType: -1,
          unit: -1
        };
        
        rawHeaders.forEach((header, index) => {
          const lower = header.toLowerCase();
          if (lower.includes('артикул') || lower.includes('sku') || lower.includes('код') || lower.includes('ид')) {
            initialMap.sku = index;
          } else if ((lower.includes('наименование') || lower.includes('название') || lower.includes('товар') || lower.includes('номенклатура') || lower.includes('продукт')) && !lower.includes('тип') && !lower.includes('вид')) {
            initialMap.name = index;
          } else if (lower.includes('категория') || lower.includes('состояние') || lower.includes('вид')) {
            initialMap.category = index;
          } else if (lower.includes('срок') || lower.includes('хранения') || lower.includes('годн') || lower.includes('дней')) {
            initialMap.defaultShelfLifeDays = index;
          } else if (lower.includes('оповещ') || lower.includes('предупрежд') || lower.includes('уведомл') || lower.includes('notify')) {
            initialMap.notifyBeforeDays = index;
          } else if (lower.includes('сырь') || lower.includes('материал') || lower.includes('raw') || lower.includes('мясо')) {
            initialMap.rawMaterial = index;
          } else if (lower.includes('упаковк') || lower.includes('фасовк') || lower.includes('pack') || lower.includes('формат')) {
            initialMap.packagingType = index;
          } else if (lower.includes('ед') || lower.includes('изм') || lower.includes('unit') || lower.includes('мерен')) {
            initialMap.unit = index;
          }
        });

        // Fallbacks if not matched
        if (initialMap.sku === -1 && rawHeaders.length > 0) initialMap.sku = 0;
        if (initialMap.name === -1 && rawHeaders.length > 1) {
          initialMap.name = initialMap.sku === 1 ? 0 : 1;
        }

        setColumnMap(initialMap);
        setImportStep('mapping');
      } catch (err: any) {
        setImportError(err.message || 'Ошибка парсинга Excel файла');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processMappingAndPreview = () => {
    const results: Omit<Product, 'id'>[] = [];
    let currentGroupName = ''; // Имя текущей папки/группы 1С
    
    // Сначала проверяем, есть ли в файле иерархическая структура групп
    let hasHierarchy = false;
    excelRows.forEach((row) => {
      const sku = columnMap.sku !== -1 ? String(row[columnMap.sku] || '').trim() : '';
      const name = columnMap.name !== -1 ? String(row[columnMap.name] || '').trim() : '';
      
      const hasOtherData = (columnMap.defaultShelfLifeDays !== -1 && String(row[columnMap.defaultShelfLifeDays] || '').trim()) || 
                           (columnMap.rawMaterial !== -1 && String(row[columnMap.rawMaterial] || '').trim()) ||
                           (columnMap.packagingType !== -1 && String(row[columnMap.packagingType] || '').trim());
      
      if (!sku && name && !hasOtherData) {
        hasHierarchy = true;
      }
    });

    excelRows.forEach((row) => {
      const sku = columnMap.sku !== -1 ? String(row[columnMap.sku] || '').trim() : '';
      const name = columnMap.name !== -1 ? String(row[columnMap.name] || '').trim() : '';
      const unit = columnMap.unit !== -1 && columnMap.unit !== undefined ? String(row[columnMap.unit] || '').trim() : '';
      const rawMaterial = columnMap.rawMaterial !== -1 ? String(row[columnMap.rawMaterial] || '').trim() : '';
      const packagingType = columnMap.packagingType !== -1 ? String(row[columnMap.packagingType] || '').trim() : '';
      
      // Проверка на строку группы 1С: кода нет, наименование есть, остальные сопоставленные ячейки пусты
      const hasOtherData = (columnMap.defaultShelfLifeDays !== -1 && String(row[columnMap.defaultShelfLifeDays] || '').trim()) || 
                           (columnMap.rawMaterial !== -1 && String(row[columnMap.rawMaterial] || '').trim()) ||
                           (columnMap.packagingType !== -1 && String(row[columnMap.packagingType] || '').trim());
      
      if (!sku && name && !hasOtherData) {
        currentGroupName = name;
        return; // Это категория (заголовок папки), пропускаем добавление товара
      }
      
      // Определяем термическое состояние (Охлажденное / Замороженное)
      // на основе ключевых слов в названии товара и имени группы 1С
      let category = 'Замороженное'; // По умолчанию для мясной продукции
      const combinedText = (name + ' ' + currentGroupName).toLowerCase();
      if (combinedText.includes('охл') || combinedText.includes('парн') || combinedText.includes('парное')) {
        category = 'Охлажденное';
      }
      // Если нет иерархии — пробуем сопоставленную колонку
      if (!hasHierarchy && columnMap.category !== -1) {
        const catVal = String(row[columnMap.category] || '').trim();
        if (catVal) {
          const catLower = catVal.toLowerCase();
          if (catLower.includes('охл') || catLower.includes('парн')) {
            category = 'Охлажденное';
          } else if (catLower.includes('замор') || catLower.includes('зам')) {
            category = 'Замороженное';
          }
        }
      }
      
      // Автоопределение rawMaterial из имени группы 1С + названия товара
      let detectedRawMaterial = rawMaterial || undefined;
      let detectedPackagingType = packagingType || undefined;
      if (hasHierarchy && (!detectedRawMaterial || !detectedPackagingType)) {
        const autoSource = { name: name, category: currentGroupName };
        const auto = autoDetectAttributes(autoSource);
        if (!detectedRawMaterial) detectedRawMaterial = auto.rawMaterial;
        if (!detectedPackagingType) detectedPackagingType = auto.packagingType;
      }

      let shelfLife = category === 'Охлажденное' ? 15 : 180;
      if (columnMap.defaultShelfLifeDays !== -1) {
        const val = parseInt(row[columnMap.defaultShelfLifeDays], 10);
        if (!isNaN(val) && val > 0) {
          shelfLife = val;
        }
      }

      let notifyDays = category === 'Охлажденное' ? 5 : 14;
      if (columnMap.notifyBeforeDays !== -1 && columnMap.notifyBeforeDays !== undefined) {
        const val = parseInt(row[columnMap.notifyBeforeDays], 10);
        if (!isNaN(val) && val >= 0) {
          notifyDays = val;
        }
      }

      if (name) {
        results.push({
          sku,
          name,
          category,
          defaultShelfLifeDays: shelfLife,
          notifyBeforeDays: notifyDays,
          rawMaterial: detectedRawMaterial,
          packagingType: detectedPackagingType,
          unit: unit || undefined,
        });
      }
    });

    if (results.length === 0) {
      setImportError('Получился пустой список. Проверьте правильность сопоставления полей.');
      return;
    }

    setParsedProducts(results);
    setImportStep('preview');
  };

  const confirmImport = () => {
    if (onImportMany) {
      onImportMany(parsedProducts, duplicateAction);
    } else {
      // Fallback integration if onImportMany is not updated globally yet
      parsedProducts.forEach(prod => {
        onAdd(prod);
      });
    }
    
    // Close modal & reset
    setIsImporting(false);
    setImportStep('upload');
    setParsedProducts([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 pb-4 border-b">
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-gray-900">Справочные данные (Справочники)</h2>
          <p className="text-sm text-gray-500">
            {subTab === 'products'
              ? 'Управляйте каталогом продукции или загрузите его из Excel таблицы'
              : 'Управляйте списком покупателей/контрагентов для оформления отгрузок и продаж'}
          </p>
        </div>
        <div className="flex gap-2">
          {subTab === 'products' ? (
            <>
              <button
                onClick={() => setIsImporting(true)}
                className="flex items-center gap-2 px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition font-medium cursor-pointer"
              >
                <FileSpreadsheet size={18} />
                <span>Импорт из Excel</span>
              </button>
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition cursor-pointer"
              >
                <Plus size={18} />
                <span>Добавить продукцию</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setBuyerFormData({ name: '', inn: '', phone: '' });
                setEditingBuyerId(null);
                setIsAddingBuyer(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition cursor-pointer font-medium"
            >
              <Plus size={18} />
              <span>Добавить покупателя</span>
            </button>
          )}
        </div>
      </div>

      {/* Переключатель вкладок */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          onClick={() => setSubTab('products')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            subTab === 'products'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🥩 Номенклатура продукции ({products.length})
        </button>
        <button
          onClick={() => setSubTab('buyers')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            subTab === 'buyers'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          👥 Покупатели / Контрагенты ({buyers.length})
        </button>
      </div>

      {/* Excel Import Modal */}
      {isImporting && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 text-blue-700">
                <FileSpreadsheet size={22} />
                <h3 className="font-bold text-lg text-gray-900">Мастер импорта из Excel</h3>
              </div>
              <button onClick={() => setIsImporting(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {importError && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex gap-2 items-start text-sm">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Ошибка импорта:</span> {importError}
                  </div>
                </div>
              )}

              {importStep === 'upload' && (
                <div className="space-y-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer bg-slate-50 hover:bg-slate-105-transition duration-200 group"
                  >
                    <Upload className="mx-auto text-gray-400 group-hover:text-blue-500 mb-3 transition" size={40} />
                    <p className="font-semibold text-gray-700">Выберите или перетащите Excel-файл</p>
                    <p className="text-xs text-gray-500 mt-1">Поддерживаются форматы .xlsx, .xls, .csv</p>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept=".xlsx, .xls, .csv" 
                      className="hidden" 
                    />
                  </div>
                  
                  <div className="bg-blue-50/50 rounded-lg p-4 text-xs text-blue-800 space-y-1">
                    <p className="font-bold uppercase tracking-wider mb-1">Рекомендации к таблице:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Первая значимая строка должна содержать названия колонок (заголовки).</li>
                      <li>Обязательно наличие колонок <strong>Наименование</strong> и <strong>Артикул</strong>.</li>
                      <li>Колонки <strong>Категория</strong> и <strong>Срок хранения (дней)</strong> могут быть заполнены или рассчитаны автоматически по умолчанию.</li>
                    </ul>
                  </div>
                </div>
              )}

              {importStep === 'mapping' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Система нашла колонки в вашем файле. Пожалуйста, сопоставьте их с полями номенклатуры MeatSync:
                  </p>
                  
                  <div className="space-y-3 bg-slate-50 p-4 rounded-lg border">
                    <div className="grid grid-cols-2 gap-4 items-center">
                      <span className="font-semibold text-sm text-gray-700">Артикул / SKU</span>
                      <select 
                        value={columnMap.sku} 
                        onChange={e => setColumnMap({ ...columnMap, sku: Number(e.target.value) })}
                        className="rounded-md border border-gray-300 p-2 shadow-sm text-sm"
                      >
                        <option value={-1}>-- Пропустить (Авто-генерация) --</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                      <span className="font-semibold text-sm text-gray-700">Наименование *</span>
                      <select 
                        value={columnMap.name} 
                        onChange={e => setColumnMap({ ...columnMap, name: Number(e.target.value) })}
                        className="rounded-md border border-gray-300 p-2 shadow-sm text-sm"
                      >
                        <option value={-1}>-- Пропустить --</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                      <span className="font-semibold text-sm text-gray-700">Категория</span>
                      <select 
                        value={columnMap.category} 
                        onChange={e => setColumnMap({ ...columnMap, category: Number(e.target.value) })}
                        className="rounded-md border border-gray-300 p-2 shadow-sm text-sm"
                      >
                        <option value={-1}>-- Задавать авто (Общие) --</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                      <span className="font-semibold text-sm text-gray-700">Срок хранения (дней)</span>
                      <select 
                        value={columnMap.defaultShelfLifeDays} 
                        onChange={e => setColumnMap({ ...columnMap, defaultShelfLifeDays: Number(e.target.value) })}
                        className="rounded-md border border-gray-300 p-2 shadow-sm text-sm"
                      >
                        <option value={-1}>-- По умолчанию (180 дн.) --</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                      <span className="font-semibold text-sm text-gray-700">Оповещение за (дней)</span>
                      <select 
                        value={columnMap.notifyBeforeDays} 
                        onChange={e => setColumnMap({ ...columnMap, notifyBeforeDays: Number(e.target.value) })}
                        className="rounded-md border border-gray-300 p-2 shadow-sm text-sm"
                      >
                        <option value={-1}>-- По умолчанию (14 дн.) --</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                      <span className="font-semibold text-sm text-gray-700">Тип сырья</span>
                      <select 
                        value={columnMap.rawMaterial} 
                        onChange={e => setColumnMap({ ...columnMap, rawMaterial: Number(e.target.value) })}
                        className="rounded-md border border-gray-300 p-2 shadow-sm text-sm bg-white"
                      >
                        <option value={-1}>-- Определять автоматически --</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                      <span className="font-semibold text-sm text-gray-700">Тип фасовки / упаковки</span>
                      <select 
                        value={columnMap.packagingType} 
                        onChange={e => setColumnMap({ ...columnMap, packagingType: Number(e.target.value) })}
                        className="rounded-md border border-gray-300 p-2 shadow-sm text-sm bg-white"
                      >
                        <option value={-1}>-- Определять автоматически --</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                      <span className="font-semibold text-sm text-gray-700">Единица измерения (ед. изм.)</span>
                      <select 
                        value={columnMap.unit} 
                        onChange={e => setColumnMap({ ...columnMap, unit: Number(e.target.value) })}
                        className="rounded-md border border-gray-300 p-2 shadow-sm text-sm bg-white"
                      >
                        <option value={-1}>-- По умолчанию (кг) --</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h.replace(/\n/g, ' ')}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button 
                      onClick={() => setImportStep('upload')} 
                      className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 text-sm"
                    >
                      Назад к загрузке
                    </button>
                    <button 
                      onClick={processMappingAndPreview}
                      disabled={columnMap.name === -1}
                      className="px-4 py-2 bg-blue-600 disabled:bg-blue-300 text-white rounded-md hover:bg-blue-700 text-sm font-semibold flex items-center gap-1"
                    >
                      <Eye size={16} /> Показать предпросмотр
                    </button>
                  </div>
                </div>
              )}

              {importStep === 'preview' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-700">
                      Распознано позиций для загрузки: <strong className="text-blue-700 text-base">{parsedProducts.length}</strong>
                    </p>
                    <div className="flex items-center gap-2 bg-slate-50 border p-2 rounded-lg text-sm">
                      <span className="text-gray-600">При совпадении SKU:</span>
                      <select 
                        value={duplicateAction} 
                        onChange={e => setDuplicateAction(e.target.value as any)}
                        className="border-none font-bold text-blue-700 focus:ring-0 p-0 text-sm bg-transparent"
                      >
                        <option value="preserve">Пропускать дубли</option>
                        <option value="overwrite">Обновлять существующие</option>
                      </select>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left">Артикул</th>
                          <th className="px-4 py-2 text-left">Наименование</th>
                          <th className="px-4 py-2 text-left">Категория</th>
                          <th className="px-4 py-2 text-left">Сырье</th>
                          <th className="px-4 py-2 text-left">Упаковка</th>
                          <th className="px-4 py-2 text-left">Ед. изм.</th>
                          <th className="px-4 py-2 text-left">Срок годности</th>
                          <th className="px-4 py-2 text-left">Оповещение</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100 text-sm">
                        {parsedProducts.map((p, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-mono text-gray-900">{p.sku || <span className="text-gray-400 italic font-sans text-xs">Авто-генерация</span>}</td>
                            <td className="px-4 py-2 text-gray-600 font-medium">{p.name}</td>
                            <td className="px-4 py-2 text-gray-500">{p.category}</td>
                            <td className="px-4 py-2 text-gray-500">{p.rawMaterial || <span className="text-gray-400 italic text-xs">Автоопределение</span>}</td>
                            <td className="px-4 py-2 text-gray-500">{p.packagingType || <span className="text-gray-400 italic text-xs">Автоопределение</span>}</td>
                            <td className="px-4 py-2 text-gray-500 font-mono">{p.unit || 'кг'}</td>
                            <td className="px-4 py-2 text-gray-500">{p.defaultShelfLifeDays} дн.</td>
                            <td className="px-4 py-2 text-gray-500">За {p.notifyBeforeDays ?? 14} дн.</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button 
                      onClick={() => setImportStep('mapping')} 
                      className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 text-sm"
                    >
                      Изменить сопоставление
                    </button>
                    <button 
                      onClick={confirmImport}
                      className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold shadow-md flex items-center gap-1.5"
                    >
                      <Check size={18} /> Подтвердить и загрузить {parsedProducts.length} позиций
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAddSubmit} className="bg-gray-50 p-6 rounded-lg border flex flex-col gap-4">
          <h3 className="font-semibold text-gray-900 border-b pb-2 text-base">Добавить новую номенклатурную позицию</h3>
          
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Наименование продукции</label>
              <input required type="text" placeholder="например: Шея свиная бескостная охлажденная" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full rounded-md border-gray-300 shadow-sm border p-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Термическое состояние</label>
              <select 
                value={formData.category} 
                onChange={e => {
                  const stateVal = e.target.value;
                  const isChilled = stateVal === 'Охлажденное';
                  setFormData({ 
                    ...formData, 
                    category: stateVal,
                    defaultShelfLifeDays: isChilled ? 15 : 180,
                    notifyBeforeDays: isChilled ? 5 : 14
                  });
                }}
                className="w-full rounded-md border-gray-300 shadow-sm border p-2 text-sm focus:ring-blue-500 focus:border-blue-500 font-medium cursor-pointer bg-white"
              >
                <option value="Охлажденное">❄️ Охлажденное (ОХЛ)</option>
                <option value="Замороженное">🧊 Замороженное (ЗАМ)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Срок хранения (дней)</label>
              <input required type="number" min="1" value={formData.defaultShelfLifeDays} onChange={e => setFormData({ ...formData, defaultShelfLifeDays: Number(e.target.value) })} className="w-full rounded-md border-gray-300 shadow-sm border p-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Оповещение за (дней)</label>
              <input required type="number" min="1" value={formData.notifyBeforeDays} onChange={e => setFormData({ ...formData, notifyBeforeDays: Number(e.target.value) })} className="w-full rounded-md border-gray-300 shadow-sm border p-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-md border">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">Артикул / SKU</label>
                <label className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-medium cursor-pointer bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors">
                  <input type="checkbox" checked={autoSku} onChange={e => setAutoSku(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer" />
                  <span>авто-генерация</span>
                </label>
              </div>
              <input 
                required={!autoSku} 
                disabled={autoSku} 
                placeholder={autoSku ? "Авто-генерация на основе сырья и фасовки" : "SV-BL-01"} 
                type="text" 
                value={autoSku ? '' : formData.sku} 
                onChange={e => setFormData({ ...formData, sku: e.target.value })} 
                className="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:ring-blue-500 focus:border-blue-500" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип сырья (будет в SKU)</label>
              <select 
                value={formData.rawMaterial} 
                onChange={e => setFormData({ ...formData, rawMaterial: e.target.value })} 
                className="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="Свинина">Свинина (префикс SV)</option>
                <option value="Говядина">Говядина (префикс BV)</option>
                <option value="Птица">Птица / Курица (префикс PT)</option>
                <option value="Баранина">Баранина (префикс BR)</option>
                <option value="Субпродукты">Субпродукты (префикс SUB)</option>
                <option value="Иное">Иное сырье (префикс по категории)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип фасовки (в SKU)</label>
              <select 
                value={formData.packagingType} 
                onChange={e => setFormData({ ...formData, packagingType: e.target.value })} 
                className="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="Блочка">Блочное сырье / Блочка (код BL)</option>
                <option value="Мелкая фасовка">Мелкая фасовка (код MF)</option>
                <option value="Отруба">Крупный кусок / Отруба (код OT)</option>
                <option value="Полутуши">Полутуши / Туши (код TS)</option>
                <option value="Вакуум">Вакуумная упаковка (код VK)</option>
                <option value="Лотки">Пластиковый лоток (код LT)</option>
                <option value="Иное">Другое / Навалом (код ZZ)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ед. измерения</label>
              <select 
                value={formData.unit} 
                onChange={e => setFormData({ ...formData, unit: e.target.value })} 
                className="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm focus:ring-blue-500 focus:border-blue-500 cursor-pointer bg-white"
              >
                <option value="кг">кг (Килограмм)</option>
                <option value="шт">шт (Штука)</option>
                <option value="м">м (Метр)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-3">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 border rounded-md hover:bg-gray-100 text-gray-700 text-sm">Отмена</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-semibold shadow-sm">Добавить в справочник</button>
          </div>
        </form>
      )}

      {/* Фильтры и Поиск */}
      {subTab === 'products' && (
        <>
          <div className="mb-4 flex flex-col md:flex-row gap-3 bg-slate-50 border p-4 rounded-xl mt-4 shadow-sm">
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Поиск продукции</label>
          <input 
            type="text" 
            placeholder="Поиск по артикулу, названию, состоянию..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="w-full md:w-56">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Продуктовая группа</label>
          <select 
            value={filterMaterial}
            onChange={e => setFilterMaterial(e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2 text-sm shadow-sm cursor-pointer focus:ring-blue-500 focus:border-blue-500 font-medium"
          >
            <option value="all">🥩 Все виды сырья</option>
            <option value="Свинина">🐖 Свинина</option>
            <option value="Говядина">🐂 Говядина</option>
            <option value="Птица">🐓 Птица</option>
            <option value="Баранина">🐏 Баранина</option>
            <option value="Субпродукты">🩸 Субпродукты</option>
            <option value="Иное">📦 Иное сырье</option>
          </select>
        </div>
        <div className="w-full md:w-56">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Формат фасовки</label>
          <select 
            value={filterPackaging}
            onChange={e => setFilterPackaging(e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2 text-sm shadow-sm cursor-pointer focus:ring-blue-500 focus:border-blue-500 font-medium"
          >
            <option value="all">📦 Все форматы</option>
            <option value="Блочка">🧊 Блочное (блочка)</option>
            <option value="Мелкая фасовка">🛍️ Мелкая фасовка</option>
            <option value="Отруба">🥩 Отруба / Крупнокусковое</option>
            <option value="Полутуши">🍖 Полутуши / Туши</option>
            <option value="Вакуум">🛡️ Вакуумная упаковка</option>
            <option value="Лотки">📥 Пластиковые лотки</option>
            <option value="Иное">📦 Иное / Другое</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Артикул</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Наименование</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Характеристики / Группа</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Состояние</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Срок хранения</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Оповещение</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Действия</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500 font-sans">
                  {products.length === 0 ? "Каталог продукции пока пуст." : "Нет позиций, соответствующих выбранным фильтрам поиска."}
                </td>
              </tr>
            ) : filteredProducts.map(product => (
              <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                {editingId === product.id ? (
                  <>
                    <td className="px-4 py-3">
                      <input className="border rounded px-2 py-1 w-full text-sm font-mono focus:ring-1 focus:ring-blue-500" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="border rounded px-2 py-1 w-full text-sm font-sans font-medium focus:ring-1 focus:ring-blue-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </td>
                    <td className="px-4 py-3 space-y-1.5 min-w-[160px]">
                      <select 
                        value={formData.rawMaterial} 
                        onChange={e => setFormData({ ...formData, rawMaterial: e.target.value })} 
                        className="w-full rounded border px-1.5 py-0.5 text-xs font-semibold cursor-pointer focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Свинина">Свинина</option>
                        <option value="Говядина">Говядина</option>
                        <option value="Птица">Птица / Курица</option>
                        <option value="Баранина">Баранина</option>
                        <option value="Субпродукты">Субпродукты</option>
                        <option value="Иное">Иное сырье</option>
                      </select>
                      <select 
                        value={formData.packagingType} 
                        onChange={e => setFormData({ ...formData, packagingType: e.target.value })} 
                        className="w-full rounded border px-1.5 py-0.5 text-xs font-semibold cursor-pointer focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Блочка">Блочка</option>
                        <option value="Мелкая фасовка">Мелкая фасовка</option>
                        <option value="Отруба">Отруба / Кусок</option>
                        <option value="Полутуши">Полутуши / Туши</option>
                        <option value="Вакуум">Вакуумная упаковка</option>
                        <option value="Лотки">Лотки</option>
                        <option value="Иное">Иное</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select 
                        value={formData.category} 
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        className="w-full rounded border px-1.5 py-1 text-xs font-semibold cursor-pointer focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                        <option value="Охлажденное">❄️ Охлажденное</option>
                        <option value="Замороженное">🧊 Замороженное</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <input type="number" min="1" className="border rounded px-2 py-1 w-20 text-sm focus:ring-1 focus:ring-blue-500" value={formData.defaultShelfLifeDays} onChange={e => setFormData({ ...formData, defaultShelfLifeDays: Number(e.target.value) })} />
                        <span className="text-xs text-gray-500 font-sans">дн.</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <input type="number" min="1" className="border rounded px-2 py-1 w-20 text-sm focus:ring-1 focus:ring-blue-500" value={formData.notifyBeforeDays} onChange={e => setFormData({ ...formData, notifyBeforeDays: Number(e.target.value) })} />
                        <span className="text-xs text-gray-500 font-sans">дн.</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium flex gap-2.5 justify-end">
                      <button onClick={() => handleEditSubmit(product.id)} className="text-green-600 hover:text-green-950 bg-green-50 hover:bg-green-100 p-1 rounded-md transition-colors"><Check size={18} /></button>
                      <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 p-1 rounded-md transition-colors"><X size={18} /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-slate-800 bg-slate-50/30">
                      {product.sku}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-sans font-medium">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        {getMaterialBadge(product.rawMaterial)}
                        {getPackagingBadge(product.packagingType)}
                        {product.unit && (
                          <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                            📏 {product.unit}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-sans">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">{product.category}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-sans font-medium">{product.defaultShelfLifeDays} дней</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-sans">За {product.notifyBeforeDays ?? 14} дней</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-3">
                      {confirmDeleteProductId === product.id ? (
                        <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 p-1 rounded-xl">
                          <span className="text-xs text-red-600 font-bold px-1.5">Удалить?</span>
                          <button
                            onClick={() => {
                              onDelete(product.id);
                              setConfirmDeleteProductId(null);
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            Да
                          </button>
                          <button
                            onClick={() => setConfirmDeleteProductId(null)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            Нет
                          </button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => startEdit(product)} title="Редактировать" className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-lg transition-colors cursor-pointer"><Edit2 size={16} /></button>
                          <button onClick={() => setConfirmDeleteProductId(product.id)} title="Удалить" className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors cursor-pointer"><Trash2 size={16} /></button>
                        </>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Вкладка Покупатели */}
      {subTab === 'buyers' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 bg-slate-50 border p-4 rounded-xl shadow-sm">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Поиск покупателя по наименованию, ИНН, телефону..." 
                value={buyerSearchQuery}
                onChange={e => setBuyerSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-md border border-slate-300 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
          </div>

          {isAddingBuyer && (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!buyerFormData.name) return;
                if (editingBuyerId) {
                  onUpdateBuyer?.(editingBuyerId, buyerFormData);
                } else {
                  onAddBuyer?.(buyerFormData);
                }
                setIsAddingBuyer(false);
                setEditingBuyerId(null);
                setBuyerFormData({ name: '', inn: '', phone: '' });
              }}
              className="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4 shadow-sm animate-in fade-in duration-150"
            >
              <h3 className="font-bold text-gray-900 text-base">
                {editingBuyerId ? '✏️ Редактировать контрагента' : '➕ Добавить нового покупателя'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Наименование компании / ФИО *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Например: ООО Мясной Альянс"
                    value={buyerFormData.name}
                    onChange={e => setBuyerFormData({ ...buyerFormData, name: e.target.value })}
                    className="w-full rounded-md border-gray-300 border p-2 text-sm bg-white focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">ИНН (необязательно)</label>
                  <input 
                    type="text" 
                    placeholder="10 или 12 цифр"
                    value={buyerFormData.inn}
                    onChange={e => setBuyerFormData({ ...buyerFormData, inn: e.target.value })}
                    className="w-full rounded-md border-gray-300 border p-2 text-sm bg-white focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Телефон</label>
                  <input 
                    type="text" 
                    placeholder="+7 (999) 000-00-00"
                    value={buyerFormData.phone}
                    onChange={e => setBuyerFormData({ ...buyerFormData, phone: e.target.value })}
                    className="w-full rounded-md border-gray-300 border p-2 text-sm bg-white focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-medium"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsAddingBuyer(false);
                    setEditingBuyerId(null);
                  }}
                  className="px-4 py-2 border rounded-md hover:bg-gray-100 text-gray-700 text-sm cursor-pointer"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-semibold shadow-sm cursor-pointer transition"
                >
                  {editingBuyerId ? 'Сохранить изменения' : 'Создать контрагента'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Наименование компании / ФИО</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ИНН</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Телефон</th>
                    <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {buyers
                    .filter(b => {
                      if (!buyerSearchQuery) return true;
                      const q = buyerSearchQuery.toLowerCase();
                      return (
                        b.name.toLowerCase().includes(q) ||
                        (b.inn && b.inn.includes(q)) ||
                        (b.phone && b.phone.toLowerCase().includes(q))
                      );
                    })
                    .map(b => (
                      <tr key={b.id} className="hover:bg-slate-50/50 transition duration-100">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 font-sans">
                          {b.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                          {b.inn || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-sans">
                          {b.phone ? (
                            <span className="flex items-center gap-1.5 text-gray-700">
                              <Phone size={14} className="text-gray-400" /> {b.phone}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2.5">
                          {confirmDeleteBuyerId === b.id ? (
                            <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 p-1 rounded-xl">
                              <span className="text-xs text-red-600 font-bold px-1.5">Удалить?</span>
                              <button
                                onClick={() => {
                                  onDeleteBuyer?.(b.id);
                                  setConfirmDeleteBuyerId(null);
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer"
                              >
                                Да
                              </button>
                              <button
                                onClick={() => setConfirmDeleteBuyerId(null)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer"
                              >
                                Нет
                              </button>
                            </div>
                          ) : (
                            <>
                              <button 
                                onClick={() => {
                                  setBuyerFormData({
                                    name: b.name,
                                    inn: b.inn || '',
                                    phone: b.phone || '',
                                  });
                                  setEditingBuyerId(b.id);
                                  setIsAddingBuyer(true);
                                }}
                                className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Редактировать"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => {
                                  setConfirmDeleteBuyerId(b.id);
                                }}
                                className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Удалить"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  {buyers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">
                        Список контрагентов пуст. Нажмите «Добавить покупателя», чтобы создать первого контрагента.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
