import { useState, useEffect } from 'react';
import { AppState, Product, StorageLocation, Transaction, Batch, Buyer } from './types';
import { generateId, generateProductSku, autoDetectAttributes } from './utils';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const STORAGE_KEY = 'meat_processing_inventory_app_state_v5';

const enrichProducts = (products: any[]): Product[] => {
  return products.map(p => {
    const auto = autoDetectAttributes(p);
    let updatedCategory = p.category;
    if (!p.category || ['Свинина', 'Говядина', 'Птица', 'Баранина', 'Субпродукты', 'Иное'].includes(p.category)) {
      const pName = (p.name || '').toLowerCase();
      if (pName.includes('охл') || pName.includes('свеж') || pName.includes('полутуш')) {
        updatedCategory = 'Охлажденное';
      } else {
        updatedCategory = 'Замороженное';
      }
    }
    return {
      ...p,
      category: updatedCategory,
      rawMaterial: p.rawMaterial || auto.rawMaterial,
      packagingType: p.packagingType || auto.packagingType,
    };
  });
};

const initialLocations: StorageLocation[] = [
  { id: 'loc_chilled_1', name: 'Холодильник охлажденного мяса (ОХЛ)', type: 'chilled_fridge', capacityKg: 20000 },
  { id: 'loc_main_1', name: 'Основной холодильник', type: 'main_fridge', capacityKg: 45000 },
  ...Array.from({ length: 7 }).map((_, i) => ({
    id: `loc_reefer_${i + 1}`,
    name: `Реф ${i + 1}`,
    type: 'reefer' as const,
    capacityKg: 12000,
  })),
  {
    id: 'loc_shock_1',
    name: 'Камера шоковой заморозки',
    type: 'shock_freezer' as const,
    capacityKg: 14000,
  },
  {
    id: 'loc_returns_1',
    name: 'Склад возвратов и брака (Карантин)',
    type: 'returns' as const,
    capacityKg: 15000,
  },
];

// Provide testing data
const now = Date.now();
const DAY_MS = 86400000;

const initialBuyers = [
  { id: 'b_buyer_1', name: 'ООО Мясной Союз', inn: '7725489031', phone: '+7 (495) 124-55-66' },
  { id: 'b_buyer_2', name: 'ИП Григорьев С.Ю. (Мясная лавка)', inn: '503204918230', phone: '+7 (910) 412-21-99' },
  { id: 'b_buyer_3', name: 'Сеть супермаркетов «ГастрономЪ»', inn: '7801349581', phone: '+7 (812) 345-67-89' },
  { id: 'b_buyer_4', name: 'ЗАО МясоКомбинат Лосино-Петровский', inn: '5029340192', phone: '+7 (496) 567-11-22' }
];

const defaultState: AppState = {
  products: enrichProducts([
    // Свинина
    { id: 'p1', name: 'Свинина в полутушах 1 кат. (ОХЛ)', sku: 'SV-TS-01', category: 'Охлажденное', defaultShelfLifeDays: 15 },
    { id: 'p2', name: 'Окорок свиной (ЗАМ)', sku: 'SV-OT-01', category: 'Замороженное', defaultShelfLifeDays: 180 },
    { id: 'p3', name: 'Лопатка свиная бк (ЗАМ)', sku: 'SV-OT-02', category: 'Замороженное', defaultShelfLifeDays: 180 },
    { id: 'p4', name: 'Шея свиная (ОХЛ)', sku: 'SV-OT-03', category: 'Охлажденное', defaultShelfLifeDays: 15 },
    { id: 'p5', name: 'Грудинка ИФ (ЗАМ)', sku: 'SV-OT-04', category: 'Замороженное', defaultShelfLifeDays: 180 },
    { id: 'p6', name: 'Карбонад свиной бк (ЗАМ)', sku: 'SV-OT-05', category: 'Замороженное', defaultShelfLifeDays: 180 },
    { id: 'p7', name: 'Вырезка свиная (ОХЛ)', sku: 'SV-OT-06', category: 'Охлажденное', defaultShelfLifeDays: 15 },
    // Говядина
    { id: 'p8', name: 'Говядина в четвертинах (ОХЛ)', sku: 'BV-TS-01', category: 'Охлажденное', defaultShelfLifeDays: 15 },
    { id: 'p9', name: 'Задняя часть говяжья (ЗАМ)', sku: 'BV-OT-01', category: 'Замороженное', defaultShelfLifeDays: 240 },
    { id: 'p10', name: 'Лопатка говяжья (ЗАМ)', sku: 'BV-OT-02', category: 'Замороженное', defaultShelfLifeDays: 240 },
    { id: 'p11', name: 'Шея говяжья (ЗАМ)', sku: 'BV-OT-03', category: 'Замороженное', defaultShelfLifeDays: 240 },
    { id: 'p12', name: 'Рибай (Толстый край) (ОХЛ)', sku: 'BV-OT-04', category: 'Охлажденное', defaultShelfLifeDays: 15 },
    { id: 'p13', name: 'Вырезка говяжья (ОХЛ)', sku: 'BV-OT-05', category: 'Охлажденное', defaultShelfLifeDays: 15 },
    // Птица
    { id: 'p14', name: 'Тушка ЦБ 1 сорт (ЗАМ)', sku: 'PT-ZZ-01', category: 'Замороженное', defaultShelfLifeDays: 365 },
    { id: 'p15', name: 'Филе грудки ГОСТ (ОХЛ)', sku: 'PT-MF-01', category: 'Охлажденное', defaultShelfLifeDays: 12 },
    { id: 'p16', name: 'Окорочок куриный (ЗАМ)', sku: 'PT-OT-01', category: 'Замороженное', defaultShelfLifeDays: 365 },
    { id: 'p17', name: 'Бедро куриное ИФ (ОХЛ)', sku: 'PT-OT-02', category: 'Охлажденное', defaultShelfLifeDays: 12 },
    { id: 'p18', name: 'Крыло (3 фаланги) (ЗАМ)', sku: 'PT-OT-03', category: 'Замороженное', defaultShelfLifeDays: 365 },
    // Субпродукты
    { id: 'p19', name: 'Печень говяжья (ЗАМ)', sku: 'SUB-OT-01', category: 'Замороженное', defaultShelfLifeDays: 180 },
    { id: 'p20', name: 'Сердце свиное (ЗАМ)', sku: 'SUB-ZZ-01', category: 'Замороженное', defaultShelfLifeDays: 180 },
    { id: 'p21', name: 'Язык говяжий (ОХЛ)', sku: 'SUB-ZZ-02', category: 'Охлажденное', defaultShelfLifeDays: 10 },
    { id: 'p22', name: 'Желудки куриные очищ. (ЗАМ)', sku: 'SUB-MF-01', category: 'Замороженное', defaultShelfLifeDays: 180 },
    // Баранина
    { id: 'p23', name: 'Баранина туши 1 кат. (ОХЛ)', sku: 'BR-TS-01', category: 'Охлажденное', defaultShelfLifeDays: 15 },
    { id: 'p24', name: 'Седло барашка (ОХЛ)', sku: 'BR-OT-01', category: 'Охлажденное', defaultShelfLifeDays: 15 },
    { id: 'p25', name: 'Лопатка баранья бк (ЗАМ)', sku: 'BR-OT-02', category: 'Замороженное', defaultShelfLifeDays: 240 },
  ]),
  locations: initialLocations,
  batches: [
    { id: 'b_1', productId: 'p2', locationId: 'loc_main_1', quantityKg: 8500, initialQuantityKg: 15000, receivedAt: new Date(now - 5*DAY_MS).toISOString(), expiresAt: new Date(now + 175*DAY_MS).toISOString() },
    { id: 'b_2', productId: 'p8', locationId: 'loc_chilled_1', quantityKg: 10000, initialQuantityKg: 12000, receivedAt: new Date(now - 2*DAY_MS).toISOString(), expiresAt: new Date(now + 13*DAY_MS).toISOString() },
    { id: 'b_3', productId: 'p15', locationId: 'loc_chilled_1', quantityKg: 1500, initialQuantityKg: 2000, receivedAt: new Date(now - 2*DAY_MS).toISOString(), expiresAt: new Date(now + 10*DAY_MS).toISOString() },
    { id: 'b_4', productId: 'p22', locationId: 'loc_reefer_2', quantityKg: 5000, initialQuantityKg: 5000, receivedAt: new Date(now - 170*DAY_MS).toISOString(), expiresAt: new Date(now + 10*DAY_MS).toISOString() },
    { id: 'b_5', productId: 'p4', locationId: 'loc_chilled_1', quantityKg: 3200, initialQuantityKg: 3200, receivedAt: new Date(now - 10*DAY_MS).toISOString(), expiresAt: new Date(now + 5*DAY_MS).toISOString() },
    { id: 'b_shock_demo_1', productId: 'p3', locationId: 'loc_shock_1', quantityKg: 7500, initialQuantityKg: 7500, receivedAt: new Date(now - 1*DAY_MS).toISOString(), expiresAt: new Date(now + 179*DAY_MS).toISOString() }
  ],
  transactions: [],
  buyers: initialBuyers,
};

const loadState = (): AppState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate product attributes if needed
      if (parsed.products) {
        parsed.products = enrichProducts(parsed.products);
      }
      // Migrate locations to updated list if they do not match the new initialLocations length or if loc_chilled_1/loc_returns_1 is missing
      const hasChilled = parsed.locations && parsed.locations.some((l: any) => l.id === 'loc_chilled_1');
      const hasReturns = parsed.locations && parsed.locations.some((l: any) => l.id === 'loc_returns_1');
      if (parsed.locations && (!hasChilled || !hasReturns || parsed.locations.length !== initialLocations.length)) {
        parsed.locations = initialLocations;
        // Re-align any batch from old shock chambers to loc_shock_1
        if (Array.isArray(parsed.batches)) {
          parsed.batches = parsed.batches.map((b: any) => {
            if (b.locationId && b.locationId.startsWith('loc_shock_')) {
              return { ...b, locationId: 'loc_shock_1' };
            }
            return b;
          });
        }
      }
      // Ensure there is at least one batch in loc_shock_1 for quick demo of movement from shock
      if (Array.isArray(parsed.batches)) {
        const hasShockBatch = parsed.batches.some((b: any) => b.locationId === 'loc_shock_1');
        if (!hasShockBatch) {
          parsed.batches.push({
            id: 'b_shock_demo_1',
            productId: 'p3', // Лопатка свиная бк (ЗАМ)
            locationId: 'loc_shock_1',
            quantityKg: 7500,
            initialQuantityKg: 7500,
            receivedAt: new Date(Date.now() - 1*86400000).toISOString(),
            expiresAt: new Date(Date.now() + 179*86400000).toISOString()
          });
        }
      }
      // Migrate buyers
      if (!parsed.buyers || !Array.isArray(parsed.buyers)) {
        parsed.buyers = initialBuyers;
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load state from localStorage', e);
  }
  return defaultState;
};

const saveState = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
};

export function useAppStore() {
  const [state, setState] = useState<AppState>(loadState());
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [isOnline, setIsOnline] = useState(false);

  // Синхронизация данных из Supabase на старте
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setIsOnline(false);
      return;
    }

    async function fetchFromSupabase() {
      try {
        setLoading(true);
        const [
          { data: dbProducts, error: prodErr },
          { data: dbLocations, error: locErr },
          { data: dbBatches, error: batErr },
          { data: dbTransactions, error: txErr },
          { data: dbBuyers, error: buyErr }
        ] = await Promise.all([
          supabase.from('products').select('*'),
          supabase.from('locations').select('*'),
          supabase.from('batches').select('*'),
          supabase.from('transactions').select('*').order('date', { ascending: false }),
          supabase.from('buyers').select('*')
        ]);

        if (prodErr || locErr || batErr || txErr || buyErr) {
          throw new Error('Supabase fetch error');
        }

        setState({
          products: dbProducts || [],
          locations: dbLocations && dbLocations.length ? dbLocations : initialLocations,
          batches: dbBatches || [],
          transactions: dbTransactions || [],
          buyers: dbBuyers || []
        });
        setIsOnline(true);
      } catch (err) {
        console.error('Supabase connection failed, falling back to localStorage:', err);
        setIsOnline(false);
        // Загрузка локальных данных в случае ошибки
        setState(loadState());
      } finally {
        setLoading(false);
      }
    }

    fetchFromSupabase();
  }, []);

  // Кэширование состояния в localStorage для оффлайн работы
  useEffect(() => {
    saveState(state);
  }, [state]);

  const addProduct = async (product: Omit<Product, 'id'>) => {
    const auto = autoDetectAttributes(product);
    const rawMaterial = product.rawMaterial || auto.rawMaterial;
    const packagingType = product.packagingType || auto.packagingType;
    
    let sku = (product.sku || '').trim();
    if (!sku) {
      sku = generateProductSku(product.category, state.products, rawMaterial, packagingType);
    }
    
    const id = generateId();
    const newProduct: Product = { ...product, rawMaterial, packagingType, sku, id };

    if (isOnline) {
      try {
        const { error } = await supabase.from('products').insert(newProduct);
        if (error) throw error;
      } catch (err) {
        console.error('Failed to add product to Supabase:', err);
      }
    }

    setState(prev => ({
      ...prev,
      products: [...prev.products, newProduct],
    }));
  };

  const updateProduct = async (id: string, updates: Partial<Omit<Product, 'id'>>) => {
    let updatedProduct: Product | undefined;

    setState(prev => {
      const nextProducts = prev.products.map(p => {
        if (p.id === id) {
          const merged = { ...p, ...updates };
          const auto = autoDetectAttributes(merged);
          updatedProduct = {
            ...merged,
            rawMaterial: merged.rawMaterial || auto.rawMaterial,
            packagingType: merged.packagingType || auto.packagingType,
          };
          return updatedProduct;
        }
        return p;
      });
      return { ...prev, products: nextProducts };
    });

    if (isOnline && updatedProduct) {
      try {
        const { error } = await supabase.from('products').update(updatedProduct).eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error('Failed to update product in Supabase:', err);
      }
    }
  };

  const deleteProduct = async (id: string) => {
    if (isOnline) {
      try {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error('Failed to delete product from Supabase:', err);
      }
    }

    setState(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== id),
    }));
  };

  const importManyProducts = async (newProducts: Omit<Product, 'id'>[], action: 'overwrite' | 'preserve') => {
    let updatedProductsList: Product[] = [];
    
    setState(prev => {
      let updatedProducts = [...prev.products];
      
      newProducts.forEach((newProd) => {
        const auto = autoDetectAttributes(newProd);
        const rawMaterial = newProd.rawMaterial || auto.rawMaterial;
        const packagingType = newProd.packagingType || auto.packagingType;

        let sku = (newProd.sku || '').trim();
        if (!sku) {
          sku = generateProductSku(newProd.category, updatedProducts, rawMaterial, packagingType);
        }

        const existingIdx = updatedProducts.findIndex(p => p.sku === sku);
        if (existingIdx !== -1) {
          if (action === 'overwrite') {
            updatedProducts[existingIdx] = {
              ...updatedProducts[existingIdx],
              name: newProd.name,
              category: newProd.category,
              defaultShelfLifeDays: newProd.defaultShelfLifeDays,
              notifyBeforeDays: newProd.notifyBeforeDays,
              rawMaterial,
              packagingType,
            };
          }
        } else {
          updatedProducts.push({
            ...newProd,
            rawMaterial,
            packagingType,
            sku,
            id: generateId(),
          });
        }
      });

      updatedProductsList = updatedProducts;
      return {
        ...prev,
        products: updatedProducts,
      };
    });

    if (isOnline && updatedProductsList.length) {
      try {
        const { error } = await supabase.from('products').upsert(updatedProductsList);
        if (error) throw error;
      } catch (err) {
        console.error('Failed to import products to Supabase:', err);
      }
    }
  };

  const processIncome = async (batchData: Omit<Batch, 'id' | 'initialQuantityKg'>) => {
    const batchId = generateId();
    const newBatch: Batch = {
      ...batchData,
      id: batchId,
      initialQuantityKg: batchData.quantityKg,
    };
    const newTransaction: Transaction = {
      id: generateId(),
      type: 'IN',
      productId: batchData.productId,
      quantityKg: batchData.quantityKg,
      date: batchData.receivedAt,
      batchId: batchId,
      toLocationId: batchData.locationId,
    };

    if (isOnline) {
      try {
        const { error: batchErr } = await supabase.from('batches').insert(newBatch);
        if (batchErr) throw batchErr;
        const { error: txErr } = await supabase.from('transactions').insert(newTransaction);
        if (txErr) throw txErr;
      } catch (err) {
        console.error('Failed to record income in Supabase:', err);
      }
    }

    setState(prev => ({
      ...prev,
      batches: [...prev.batches, newBatch],
      transactions: [newTransaction, ...prev.transactions],
    }));
  };

  const processOutcome = async (
    batchId: string,
    quantityKg: number,
    date: string,
    notes?: string,
    outcomeType?: 'sale' | 'waste' | 'mpc',
    buyerId?: string,
    wasteReason?: string
  ) => {
    const batch = state.batches.find(b => b.id === batchId);
    if (!batch || batch.quantityKg < quantityKg) return;

    const remainingQty = batch.quantityKg - quantityKg;

    let enrichedNotes = notes || '';
    if (outcomeType === 'sale' && buyerId) {
      const bObj = state.buyers.find(by => by.id === buyerId);
      const bName = bObj ? bObj.name : 'Покупатель';
      enrichedNotes = `Продажа: ${bName}${notes ? ` (${notes})` : ''}`;
    } else if (outcomeType === 'waste' && wasteReason) {
      enrichedNotes = `Списание (Утиль): ${wasteReason}${notes ? ` (${notes})` : ''}`;
    } else if (outcomeType === 'mpc') {
      enrichedNotes = `Перемещение в МПЦ${notes ? ` (${notes})` : ''}`;
    }

    const newTransaction: Transaction = {
      id: generateId(),
      type: 'OUT',
      productId: batch.productId,
      quantityKg: quantityKg,
      date: date,
      batchId: batchId,
      fromLocationId: batch.locationId,
      notes: enrichedNotes,
      outcomeType,
      buyerId,
      wasteReason,
    };

    if (isOnline) {
      try {
        if (remainingQty <= 0) {
          const { error: delErr } = await supabase.from('batches').delete().eq('id', batchId);
          if (delErr) throw delErr;
        } else {
          const { error: updErr } = await supabase.from('batches').update({ quantityKg: remainingQty }).eq('id', batchId);
          if (updErr) throw updErr;
        }
        const { error: txErr } = await supabase.from('transactions').insert(newTransaction);
        if (txErr) throw txErr;
      } catch (err) {
        console.error('Failed to process outcome in Supabase:', err);
      }
    }

    setState(prev => {
      const nextBatches = prev.batches.map(b => 
        b.id === batchId ? { ...b, quantityKg: b.quantityKg - quantityKg } : b
      ).filter(b => b.quantityKg > 0);

      return {
        ...prev,
        batches: nextBatches,
        transactions: [newTransaction, ...prev.transactions],
      };
    });
  };

  const addBuyer = async (buyer: Omit<Buyer, 'id'>) => {
    const id = 'b_buyer_' + generateId();
    const newBuyer = { ...buyer, id };

    if (isOnline) {
      try {
        const { error } = await supabase.from('buyers').insert(newBuyer);
        if (error) throw error;
      } catch (err) {
        console.error('Failed to add buyer in Supabase:', err);
      }
    }

    setState(prev => ({
      ...prev,
      buyers: [...prev.buyers, newBuyer],
    }));
  };

  const updateBuyer = async (id: string, updates: Partial<Omit<Buyer, 'id'>>) => {
    let updatedBuyerObj: Buyer | undefined;
    
    setState(prev => {
      const nextBuyers = prev.buyers.map(b => {
        if (b.id === id) {
          updatedBuyerObj = { ...b, ...updates };
          return updatedBuyerObj;
        }
        return b;
      });
      return { ...prev, buyers: nextBuyers };
    });

    if (isOnline && updatedBuyerObj) {
      try {
        const { error } = await supabase.from('buyers').update(updatedBuyerObj).eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error('Failed to update buyer in Supabase:', err);
      }
    }
  };

  const deleteBuyer = async (id: string) => {
    if (isOnline) {
      try {
        const { error } = await supabase.from('buyers').delete().eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error('Failed to delete buyer from Supabase:', err);
      }
    }

    setState(prev => ({
      ...prev,
      buyers: prev.buyers.filter(b => b.id !== id),
    }));
  };

  const moveBatch = async (batchId: string, toLocationId: string, quantityKg: number, date: string) => {
    const batch = state.batches.find(b => b.id === batchId);
    if (!batch || batch.quantityKg < quantityKg || quantityKg <= 0) return;

    const newTransaction: Transaction = {
      id: generateId(),
      type: 'MOVE',
      productId: batch.productId,
      quantityKg: quantityKg,
      date: date,
      batchId: batchId,
      fromLocationId: batch.locationId,
      toLocationId: toLocationId,
    };

    const entireMove = quantityKg === batch.quantityKg;
    const newBatchId = generateId();
    
    const newBatch: Batch = {
      id: newBatchId,
      productId: batch.productId,
      locationId: toLocationId,
      quantityKg: quantityKg,
      initialQuantityKg: quantityKg,
      receivedAt: batch.receivedAt,
      expiresAt: batch.expiresAt,
    };

    if (isOnline) {
      try {
        if (entireMove) {
          const { error: updErr } = await supabase.from('batches').update({ locationId: toLocationId }).eq('id', batchId);
          if (updErr) throw updErr;
        } else {
          const { error: updErr } = await supabase.from('batches').update({ quantityKg: batch.quantityKg - quantityKg }).eq('id', batchId);
          if (updErr) throw updErr;
          const { error: insErr } = await supabase.from('batches').insert(newBatch);
          if (insErr) throw insErr;
        }
        const { error: txErr } = await supabase.from('transactions').insert(newTransaction);
        if (txErr) throw txErr;
      } catch (err) {
        console.error('Failed to move batch in Supabase:', err);
      }
    }

    setState(prev => {
      let updatedBatches: Batch[];
      if (entireMove) {
        updatedBatches = prev.batches.map(b =>
          b.id === batchId ? { ...b, locationId: toLocationId } : b
        );
      } else {
        updatedBatches = prev.batches.map(b =>
          b.id === batchId ? { ...b, quantityKg: b.quantityKg - quantityKg } : b
        );
        updatedBatches.push(newBatch);
      }

      return {
        ...prev,
        batches: updatedBatches,
        transactions: [newTransaction, ...prev.transactions],
      };
    });
  };

  const processReturn = async (returnData: {
    productId: string;
    quantityKg: number;
    buyerId: string;
    reason: string;
    date: string;
  }) => {
    const prod = state.products.find(p => p.id === returnData.productId);
    const shelfLifeDays = prod?.defaultShelfLifeDays || 30;
    const receivedDate = new Date(returnData.date);
    const expiresAt = new Date(receivedDate.getTime() + shelfLifeDays * (86400000)).toISOString();

    const batchId = generateId();
    const newBatch: Batch = {
      id: batchId,
      productId: returnData.productId,
      locationId: 'loc_returns_1',
      quantityKg: returnData.quantityKg,
      initialQuantityKg: returnData.quantityKg,
      receivedAt: returnData.date,
      expiresAt: expiresAt,
      isReturn: true,
      returnedByBuyerId: returnData.buyerId,
      returnReason: returnData.reason,
    };

    const buyer = state.buyers.find(b => b.id === returnData.buyerId);
    const buyerName = buyer ? buyer.name : 'Покупатель';

    const newTransaction: Transaction = {
      id: generateId(),
      type: 'RETURN',
      productId: returnData.productId,
      quantityKg: returnData.quantityKg,
      date: returnData.date,
      batchId: batchId,
      toLocationId: 'loc_returns_1',
      buyerId: returnData.buyerId,
      notes: `Возврат от контрагента "${buyerName}". Причина: ${returnData.reason}`,
    };

    if (isOnline) {
      try {
        const { error: batErr } = await supabase.from('batches').insert(newBatch);
        if (batErr) throw batErr;
        const { error: txErr } = await supabase.from('transactions').insert(newTransaction);
        if (txErr) throw txErr;
      } catch (err) {
        console.error('Failed to process return in Supabase:', err);
      }
    }

    setState(prev => ({
      ...prev,
      batches: [...prev.batches, newBatch],
      transactions: [newTransaction, ...prev.transactions],
    }));
  };

  const deleteTransaction = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) {
      return { success: false, error: 'Транзакция не найдена' };
    }

    let nextBatches = [...state.batches];
    let supabaseOperations: (() => Promise<void>)[] = [];

    if (tx.type === 'IN') {
      const batch = state.batches.find(b => b.id === tx.batchId);
      if (batch) {
        if (batch.quantityKg < batch.initialQuantityKg) {
          return {
            success: false,
            error: `Невозможно удалить приход: с этой партии уже списано ${batch.initialQuantityKg - batch.quantityKg} кг. Сначала удалите соответствующие расходы.`
          };
        }
      }
      if (tx.batchId) {
        nextBatches = nextBatches.filter(b => b.id !== tx.batchId);
        if (isOnline) {
          supabaseOperations.push(async () => {
            const { error } = await supabase.from('batches').delete().eq('id', tx.batchId);
            if (error) throw error;
          });
        }
      }
    } else if (tx.type === 'OUT') {
      const batch = state.batches.find(b => b.id === tx.batchId);
      if (batch) {
        const updatedQty = batch.quantityKg + tx.quantityKg;
        nextBatches = nextBatches.map(b =>
          b.id === tx.batchId ? { ...b, quantityKg: updatedQty } : b
        );
        if (isOnline) {
          supabaseOperations.push(async () => {
            const { error } = await supabase.from('batches').update({ quantityKg: updatedQty }).eq('id', tx.batchId);
            if (error) throw error;
          });
        }
      } else {
        const product = state.products.find(p => p.id === tx.productId);
        const shelfLifeDays = product?.defaultShelfLifeDays || 30;
        const receivedAt = tx.date;
        const expiresAt = new Date(new Date(receivedAt).getTime() + shelfLifeDays * 86400000).toISOString();

        const newBatch: Batch = {
          id: tx.batchId || generateId(),
          productId: tx.productId,
          locationId: tx.fromLocationId || 'loc_main_1',
          quantityKg: tx.quantityKg,
          initialQuantityKg: tx.quantityKg,
          receivedAt,
          expiresAt
        };
        nextBatches.push(newBatch);
        if (isOnline) {
          supabaseOperations.push(async () => {
            const { error } = await supabase.from('batches').insert(newBatch);
            if (error) throw error;
          });
        }
      }
    } else if (tx.type === 'MOVE') {
      let targetBatch = state.batches.find(b => b.id === tx.batchId && b.locationId === tx.toLocationId);

      if (targetBatch) {
        nextBatches = nextBatches.map(b =>
          b.id === tx.batchId ? { ...b, locationId: tx.fromLocationId } : b
        );
        if (isOnline) {
          supabaseOperations.push(async () => {
            const { error } = await supabase.from('batches').update({ locationId: tx.fromLocationId }).eq('id', tx.batchId);
            if (error) throw error;
          });
        }
      } else {
        const partialTargetBatch = state.batches.find(b =>
          b.productId === tx.productId &&
          b.locationId === tx.toLocationId &&
          b.quantityKg >= tx.quantityKg
        );

        if (!partialTargetBatch) {
          return {
            success: false,
            error: 'Невозможно отменить перемещение: продукция в целевой локации уже списана или отсутствует.'
          };
        }

        const nextTargetQty = partialTargetBatch.quantityKg - tx.quantityKg;
        if (nextTargetQty <= 0) {
          nextBatches = nextBatches.filter(b => b.id !== partialTargetBatch.id);
          if (isOnline) {
            supabaseOperations.push(async () => {
              const { error } = await supabase.from('batches').delete().eq('id', partialTargetBatch.id);
              if (error) throw error;
            });
          }
        } else {
          nextBatches = nextBatches.map(b =>
            b.id === partialTargetBatch.id ? { ...b, quantityKg: nextTargetQty } : b
          );
          if (isOnline) {
            supabaseOperations.push(async () => {
              const { error } = await supabase.from('batches').update({ quantityKg: nextTargetQty }).eq('id', partialTargetBatch.id);
              if (error) throw error;
            });
          }
        }

        const sourceBatch = state.batches.find(b => b.id === tx.batchId);
        if (sourceBatch) {
          const nextSourceQty = sourceBatch.quantityKg + tx.quantityKg;
          nextBatches = nextBatches.map(b =>
            b.id === tx.batchId ? { ...b, quantityKg: nextSourceQty } : b
          );
          if (isOnline) {
            supabaseOperations.push(async () => {
              const { error } = await supabase.from('batches').update({ quantityKg: nextSourceQty }).eq('id', tx.batchId);
              if (error) throw error;
            });
          }
        } else {
          const product = state.products.find(p => p.id === tx.productId);
          const shelfLifeDays = product?.defaultShelfLifeDays || 30;
          const receivedAt = tx.date;
          const expiresAt = new Date(new Date(receivedAt).getTime() + shelfLifeDays * 86400000).toISOString();

          const newBatch: Batch = {
            id: tx.batchId || generateId(),
            productId: tx.productId,
            locationId: tx.fromLocationId || 'loc_main_1',
            quantityKg: tx.quantityKg,
            initialQuantityKg: tx.quantityKg,
            receivedAt,
            expiresAt
          };
          nextBatches.push(newBatch);
          if (isOnline) {
            supabaseOperations.push(async () => {
              const { error } = await supabase.from('batches').insert(newBatch);
              if (error) throw error;
            });
          }
        }
      }
    } else if (tx.type === 'RETURN') {
      const batch = state.batches.find(b => b.id === tx.batchId);
      if (batch) {
        if (batch.quantityKg < batch.initialQuantityKg) {
          return {
            success: false,
            error: `Невозможно отменить возврат: возвращенная продукция уже частично списана (${batch.initialQuantityKg - batch.quantityKg} кг). Сначала удалите расходы.`
          };
        }
      }
      if (tx.batchId) {
        nextBatches = nextBatches.filter(b => b.id !== tx.batchId);
        if (isOnline) {
          supabaseOperations.push(async () => {
            const { error } = await supabase.from('batches').delete().eq('id', tx.batchId);
            if (error) throw error;
          });
        }
      }
    }

    if (isOnline) {
      let txDeleted = false;
      try {
        // 1. Сначала строго удаляем саму транзакцию из transactions для прохождения внешних ключей в PostgreSQL
        const { error: txErr } = await supabase.from('transactions').delete().eq('id', id);
        if (txErr) throw txErr;
        txDeleted = true;

        // 2. После этого последовательно выполняем операции над партиями batches
        for (const op of supabaseOperations) {
          await op();
        }
      } catch (err) {
        console.error('Failed to sync transaction deletion with Supabase:', err);
        // Восстановление удаленной транзакции для консистентности базы данных
        if (txDeleted) {
          try {
            await supabase.from('transactions').insert(tx);
          } catch (restoreErr) {
            console.error('Failed to restore transaction after batch update failure:', restoreErr);
          }
        }
        return { success: false, error: 'Ошибка синхронизации с облаком при удалении.' };
      }
    }

    setState(prev => ({
      ...prev,
      batches: nextBatches,
      transactions: prev.transactions.filter(t => t.id !== id)
    }));

    return { success: true };
  };

  const updateTransaction = async (
    id: string,
    updates: {
      quantityKg?: number;
      date?: string;
      notes?: string;
      outcomeType?: 'sale' | 'waste' | 'mpc';
      buyerId?: string;
      wasteReason?: string;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) {
      return { success: false, error: 'Транзакция не найдена' };
    }

    let nextBatches = [...state.batches];
    let nextTransactions = [...state.transactions];
    let supabaseBatchesUpdates: (() => Promise<void>)[] = [];
    let supabaseTxUpdate: (() => Promise<void>) | null = null;

    const oldQty = tx.quantityKg;
    const newQty = updates.quantityKg !== undefined ? updates.quantityKg : oldQty;
    const diff = newQty - oldQty;

    if (diff !== 0) {
      if (tx.type === 'IN') {
        const batch = state.batches.find(b => b.id === tx.batchId);
        if (!batch) {
          return { success: false, error: 'Связанная партия не найдена на складе.' };
        }
        const nextQty = batch.quantityKg + diff;
        const nextInitialQty = batch.initialQuantityKg + diff;
        
        if (nextQty < 0 || nextInitialQty < 0) {
          return {
            success: false,
            error: `Невозможно уменьшить приход на ${Math.abs(diff)} кг: с этой партии уже списано больше продукции, чем останется.`
          };
        }

        nextBatches = nextBatches.map(b =>
          b.id === tx.batchId ? { ...b, quantityKg: nextQty, initialQuantityKg: nextInitialQty } : b
        );
        if (isOnline) {
          supabaseBatchesUpdates.push(async () => {
            const { error } = await supabase.from('batches').update({ quantityKg: nextQty, initialQuantityKg: nextInitialQty }).eq('id', tx.batchId);
            if (error) throw error;
          });
        }
      } else if (tx.type === 'OUT') {
        const batch = state.batches.find(b => b.id === tx.batchId);
        if (batch) {
          const nextQty = batch.quantityKg - diff;
          if (nextQty < 0) {
            return {
              success: false,
              error: `Недостаточно остатка на партии для увеличения расхода на ${diff} кг. Доступно: ${batch.quantityKg} кг.`
            };
          }
          nextBatches = nextBatches.map(b =>
            b.id === tx.batchId ? { ...b, quantityKg: nextQty } : b
          );
          if (isOnline) {
            supabaseBatchesUpdates.push(async () => {
              const { error } = await supabase.from('batches').update({ quantityKg: nextQty }).eq('id', tx.batchId);
              if (error) throw error;
            });
          }
        } else {
          if (diff < 0) {
            const product = state.products.find(p => p.id === tx.productId);
            const shelfLifeDays = product?.defaultShelfLifeDays || 30;
            const receivedAt = tx.date;
            const expiresAt = new Date(new Date(receivedAt).getTime() + shelfLifeDays * 86400000).toISOString();

            const newBatch: Batch = {
              id: tx.batchId || generateId(),
              productId: tx.productId,
              locationId: tx.fromLocationId || 'loc_main_1',
              quantityKg: Math.abs(diff),
              initialQuantityKg: oldQty,
              receivedAt,
              expiresAt
            };
            nextBatches.push(newBatch);
            if (isOnline) {
              supabaseBatchesUpdates.push(async () => {
                const { error } = await supabase.from('batches').insert(newBatch);
                if (error) throw error;
              });
            }
          } else {
            return {
              success: false,
              error: 'Невозможно увеличить расход: связанная партия была полностью списана до нуля и удалена.'
            };
          }
        }
      } else if (tx.type === 'MOVE') {
        let targetBatch = state.batches.find(b => b.id === tx.batchId && b.locationId === tx.toLocationId);
        let partialTargetBatch = targetBatch;

        if (!targetBatch) {
          partialTargetBatch = state.batches.find(b =>
            b.productId === tx.productId &&
            b.locationId === tx.toLocationId &&
            b.quantityKg >= diff
          );
        }

        if (!partialTargetBatch) {
          return {
            success: false,
            error: 'Невозможно изменить вес перемещения: целевая партия уже списана или отсутствует.'
          };
        }

        const nextTargetQty = partialTargetBatch.quantityKg - diff;
        if (nextTargetQty < 0) {
          return {
            success: false,
            error: `Недостаточно остатка в целевой локации для уменьшения на ${diff} кг.`
          };
        }

        if (nextTargetQty === 0) {
          nextBatches = nextBatches.filter(b => b.id !== partialTargetBatch.id);
          if (isOnline) {
            supabaseBatchesUpdates.push(async () => {
              const { error } = await supabase.from('batches').delete().eq('id', partialTargetBatch.id);
              if (error) throw error;
            });
          }
        } else {
          nextBatches = nextBatches.map(b =>
            b.id === partialTargetBatch.id ? { ...b, quantityKg: nextTargetQty } : b
          );
          if (isOnline) {
            supabaseBatchesUpdates.push(async () => {
              const { error } = await supabase.from('batches').update({ quantityKg: nextTargetQty }).eq('id', partialTargetBatch.id);
              if (error) throw error;
            });
          }
        }

        const sourceBatch = state.batches.find(b => b.id === tx.batchId);
        if (sourceBatch) {
          const nextSourceQty = sourceBatch.quantityKg + diff;
          if (nextSourceQty < 0) {
            return {
              success: false,
              error: `Недостаточно остатка в исходной партии для списания дополнительных ${diff} кг.`
            };
          }
          nextBatches = nextBatches.map(b =>
            b.id === tx.batchId ? { ...b, quantityKg: nextSourceQty } : b
          );
          if (isOnline) {
            supabaseBatchesUpdates.push(async () => {
              const { error } = await supabase.from('batches').update({ quantityKg: nextSourceQty }).eq('id', tx.batchId);
              if (error) throw error;
            });
          }
        } else {
          if (diff > 0) {
            return {
              success: false,
              error: 'Невозможно увеличить перемещение: исходная партия была удалена.'
            };
          }
          const product = state.products.find(p => p.id === tx.productId);
          const shelfLifeDays = product?.defaultShelfLifeDays || 30;
          const receivedAt = tx.date;
          const expiresAt = new Date(new Date(receivedAt).getTime() + shelfLifeDays * 86400000).toISOString();

          const newBatch: Batch = {
            id: tx.batchId || generateId(),
            productId: tx.productId,
            locationId: tx.fromLocationId || 'loc_main_1',
            quantityKg: Math.abs(diff),
            initialQuantityKg: Math.abs(diff),
            receivedAt,
            expiresAt
          };
          nextBatches.push(newBatch);
          if (isOnline) {
            supabaseBatchesUpdates.push(async () => {
              const { error } = await supabase.from('batches').insert(newBatch);
              if (error) throw error;
            });
          }
        }
      } else if (tx.type === 'RETURN') {
        const batch = state.batches.find(b => b.id === tx.batchId);
        if (!batch) {
          return { success: false, error: 'Связанная партия возврата не найдена.' };
        }
        const nextQty = batch.quantityKg + diff;
        const nextInitialQty = batch.initialQuantityKg + diff;

        if (nextQty < 0 || nextInitialQty < 0) {
          return {
            success: false,
            error: `Невозможно уменьшить возврат на ${Math.abs(diff)} кг: возвращенная продукция уже частично списана.`
          };
        }

        nextBatches = nextBatches.map(b =>
          b.id === tx.batchId ? { ...b, quantityKg: nextQty, initialQuantityKg: nextInitialQty } : b
        );
        if (isOnline) {
          supabaseBatchesUpdates.push(async () => {
            const { error } = await supabase.from('batches').update({ quantityKg: nextQty, initialQuantityKg: nextInitialQty }).eq('id', tx.batchId);
            if (error) throw error;
          });
        }
      }
    }

    let enrichedNotes = updates.notes !== undefined ? updates.notes : tx.notes;
    const outcomeType = updates.outcomeType !== undefined ? updates.outcomeType : tx.outcomeType;
    const buyerId = updates.buyerId !== undefined ? updates.buyerId : tx.buyerId;
    const wasteReason = updates.wasteReason !== undefined ? updates.wasteReason : tx.wasteReason;
    
    if (tx.type === 'OUT' && (updates.outcomeType !== undefined || updates.buyerId !== undefined || updates.wasteReason !== undefined || updates.notes !== undefined)) {
      const noteCore = updates.notes !== undefined ? updates.notes : '';
      if (outcomeType === 'sale' && buyerId) {
        const bObj = state.buyers.find(by => by.id === buyerId);
        const bName = bObj ? bObj.name : 'Покупатель';
        enrichedNotes = `Продажа: ${bName}${noteCore ? ` (${noteCore})` : ''}`;
      } else if (outcomeType === 'waste' && wasteReason) {
        enrichedNotes = `Списание (Утиль): ${wasteReason}${noteCore ? ` (${noteCore})` : ''}`;
      } else if (outcomeType === 'mpc') {
        enrichedNotes = `Перемещение в МПЦ${noteCore ? ` (${noteCore})` : ''}`;
      }
    } else if (tx.type === 'RETURN' && (updates.buyerId !== undefined || updates.notes !== undefined)) {
      const noteCore = updates.notes !== undefined ? updates.notes : '';
      const bObj = state.buyers.find(by => by.id === buyerId);
      const bName = bObj ? bObj.name : 'Покупатель';
      const reason = updates.notes || tx.notes || 'Причина не указана';
      enrichedNotes = `Возврат от контрагента "${bName}". Причина: ${reason}`;
    }

    const updatedTx: Transaction = {
      ...tx,
      quantityKg: newQty,
      date: updates.date !== undefined ? updates.date : tx.date,
      notes: enrichedNotes,
      outcomeType,
      buyerId,
      wasteReason
    };

    nextTransactions = nextTransactions.map(t => t.id === id ? updatedTx : t);

    if (isOnline) {
      supabaseTxUpdate = async () => {
        const { error } = await supabase.from('transactions').update(updatedTx).eq('id', id);
        if (error) throw error;
      };
    }

    if (isOnline) {
      try {
        // Последовательно выполняем все операции обновления/удаления/вставки партий batches
        for (const op of supabaseBatchesUpdates) {
          await op();
        }
        // Обновляем саму транзакцию
        if (supabaseTxUpdate) {
          await supabaseTxUpdate();
        }
      } catch (err) {
        console.error('Failed to sync transaction update with Supabase:', err);
        return { success: false, error: 'Ошибка синхронизации с облаком при обновлении.' };
      }
    }

    setState(prev => ({
      ...prev,
      batches: nextBatches,
      transactions: nextTransactions
    }));

    return { success: true };
  };

  return {
    state,
    loading,
    isOnline,
    addProduct,
    updateProduct,
    deleteProduct,
    importManyProducts,
    processIncome,
    processOutcome,
    moveBatch,
    addBuyer,
    updateBuyer,
    deleteBuyer,
    processReturn,
    deleteTransaction,
    updateTransaction,
  };
}
