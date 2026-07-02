import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5000;
const LOCAL_DB_PATH = path.join(__dirname, 'local_db.json');
const LAST_SYNCED_PATH = path.join(__dirname, 'last_synced.json');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

const app = express();

app.use(express.json({ limit: '50mb' }));

// Ручная настройка CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Утилиты для работы с файлами
async function readJsonFile(filePath, defaultValue = { products: [], locations: [], batches: [], transactions: [], buyers: [] }) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    console.error(`Error reading file ${filePath}:`, err);
    return defaultValue;
  }
}

async function writeJsonFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing file ${filePath}:`, err);
  }
}

// Постраничная загрузка всех записей из таблицы Supabase (обход лимита в 1000 записей)
async function fetchAllFromTable(tableName, orderConfig = null) {
  let allData = [];
  let from = 0;
  const step = 1000;
  
  while (true) {
    let query = supabase.from(tableName).select('*').range(from, from + step - 1);
    if (orderConfig) {
      query = query.order(orderConfig.column, { ascending: orderConfig.ascending });
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allData = allData.concat(data);
    if (data.length < step) break;
    from += step;
  }
  return allData;
}

// Функция слияния локального состояния и Supabase с учетом удаленных объектов
function mergeLocalAndDbStates(local, db, lastSynced) {
  const lastSyncedState = lastSynced || { products: [], locations: [], batches: [], transactions: [], buyers: [] };

  // --- 1. Продукты ---
  // Определяем локально удаленные продукты (есть в lastSynced, но нет в local)
  const deletedProductIds = new Set(
    (lastSyncedState.products || [])
      .filter(sp => !(local.products || []).some(lp => lp.id === sp.id))
      .map(sp => sp.id)
  );

  // Инициализируем продуктами из БД, исключая удаленные локально
  const products = (db.products || []).filter(p => !deletedProductIds.has(p.id));
  const productIdMap = {}; // lp.id -> dbp.id для замены локальных ID на облачные при конфликтах SKU

  if (local && Array.isArray(local.products)) {
    local.products.forEach(lp => {
      if (deletedProductIds.has(lp.id)) return; // Пропускаем удаленный

      // Ищем продукт в БД с таким же ID
      const dbpById = products.find(p => p.id === lp.id);
      if (dbpById) {
        // Продукт уже есть по ID, ничего не делаем
        return;
      }

      // Ищем продукт в БД с таким же SKU
      const dbpBySku = products.find(p => p.sku && lp.sku && p.sku.trim().toLowerCase() === lp.sku.trim().toLowerCase());
      if (dbpBySku) {
        // Конфликт SKU! Заменяем локальный ID на облачный
        productIdMap[lp.id] = dbpBySku.id;
        console.log(`[Merge] Обнаружен конфликт SKU для "${lp.sku}". Переопределяем локальный ID ${lp.id} -> облачный ID ${dbpBySku.id}`);
      } else {
        // Нет конфликтов ни по ID, ни по SKU. Это действительно новый продукт.
        products.push(lp);
      }
    });
  }

  // --- 2. Локации ---
  const locations = db.locations && db.locations.length ? db.locations : (local && local.locations && local.locations.length ? local.locations : []);

  // --- 3. Партии ---
  // Определяем локально удаленные партии
  const deletedBatchIds = new Set(
    (lastSyncedState.batches || [])
      .filter(sb => !(local.batches || []).some(lb => lb.id === sb.id))
      .map(sb => sb.id)
  );

  // Инициализируем партиями из БД, исключая удаленные локально
  const mergedBatches = (db.batches || []).filter(b => !deletedBatchIds.has(b.id));

  if (local && Array.isArray(local.batches)) {
    local.batches.forEach(lb => {
      if (deletedBatchIds.has(lb.id)) return; // Пропускаем удаленный

      // Если у партии productId совпадает с локальным ID из маппинга, заменяем его на облачный
      const finalProductId = productIdMap[lb.productId] || lb.productId;
      const updatedLb = { ...lb, productId: finalProductId };

      const idx = mergedBatches.findIndex(dbb => dbb.id === updatedLb.id);
      if (idx !== -1) {
        if (
          mergedBatches[idx].quantityKg !== updatedLb.quantityKg ||
          mergedBatches[idx].initialQuantityKg !== updatedLb.initialQuantityKg ||
          mergedBatches[idx].locationId !== updatedLb.locationId ||
          mergedBatches[idx].productId !== updatedLb.productId
        ) {
          mergedBatches[idx] = { ...mergedBatches[idx], ...updatedLb };
        }
      } else {
        mergedBatches.push(updatedLb);
      }
    });
  }

  // --- 4. Транзакции ---
  // Определяем локально удаленные транзакции
  const deletedTxIds = new Set(
    (lastSyncedState.transactions || [])
      .filter(stx => !(local.transactions || []).some(ltx => ltx.id === stx.id))
      .map(stx => stx.id)
  );

  // Инициализируем транзакциями из БД, исключая удаленные локально
  const mergedTransactions = (db.transactions || []).filter(t => !deletedTxIds.has(t.id));

  if (local && Array.isArray(local.transactions)) {
    local.transactions.forEach(ltx => {
      if (deletedTxIds.has(ltx.id)) return; // Пропускаем удаленный

      // Если у транзакции productId совпадает с локальным ID из маппинга, заменяем его на облачный
      const finalProductId = productIdMap[ltx.productId] || ltx.productId;
      const updatedLtx = { ...ltx, productId: finalProductId };

      const idx = mergedTransactions.findIndex(dbtx => dbtx.id === updatedLtx.id);
      if (idx !== -1) {
        if (mergedTransactions[idx].productId !== updatedLtx.productId) {
          mergedTransactions[idx] = { ...mergedTransactions[idx], productId: updatedLtx.productId };
        }
      } else {
        mergedTransactions.push(updatedLtx);
      }
    });
  }
  mergedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // --- 5. Покупатели ---
  // Определяем локально удаленных покупателей
  const deletedBuyerIds = new Set(
    (lastSyncedState.buyers || [])
      .filter(sb => !(local.buyers || []).some(lb => lb.id === sb.id))
      .map(sb => sb.id)
  );

  const buyers = (db.buyers || []).filter(b => !deletedBuyerIds.has(b.id));

  if (local && Array.isArray(local.buyers)) {
    local.buyers.forEach(lby => {
      if (deletedBuyerIds.has(lby.id)) return; // Пропускаем удаленный

      if (!buyers.some(dbby => dbby.id === lby.id)) {
        buyers.push(lby);
      }
    });
  }

  return {
    products,
    locations,
    batches: mergedBatches,
    transactions: mergedTransactions,
    buyers
  };
}

// Расчет количества несинхронизированных операций
function getUnsyncedCount(local, lastSynced) {
  if (!lastSynced) return 0;

  const newProducts = (local.products || []).filter(
    lp => !lastSynced.products.some(sp => sp.id === lp.id)
  ).length;

  const deletedProducts = (lastSynced.products || []).filter(
    sp => !local.products.some(lp => lp.id === sp.id)
  ).length;

  const newBuyers = (local.buyers || []).filter(
    lby => !lastSynced.buyers.some(sby => sby.id === lby.id)
  ).length;

  const deletedBuyers = (lastSynced.buyers || []).filter(
    sby => !local.buyers.some(lby => lby.id === sby.id)
  ).length;

  const newBatches = (local.batches || []).filter(
    lb => !lastSynced.batches.some(sb => sb.id === lb.id)
  ).length;

  const modifiedBatches = (local.batches || []).filter(lb => {
    const sb = lastSynced.batches.find(sb => sb.id === lb.id);
    return sb && (sb.quantityKg !== lb.quantityKg || sb.initialQuantityKg !== lb.initialQuantityKg || sb.locationId !== lb.locationId);
  }).length;

  const deletedBatches = (lastSynced.batches || []).filter(
    sb => !local.batches.some(lb => lb.id === sb.id)
  ).length;

  const newTransactions = (local.transactions || []).filter(
    ltx => !lastSynced.transactions.some(stx => stx.id === ltx.id)
  ).length;

  const modifiedTransactions = (local.transactions || []).filter(ltx => {
    const stx = lastSynced.transactions.find(st => st.id === ltx.id);
    return stx && (
      stx.quantityKg !== ltx.quantityKg ||
      stx.date !== ltx.date ||
      stx.notes !== ltx.notes ||
      stx.buyerId !== ltx.buyerId ||
      stx.wasteReason !== ltx.wasteReason ||
      stx.outcomeType !== ltx.outcomeType
    );
  }).length;

  const deletedTransactions = (lastSynced.transactions || []).filter(
    stx => !local.transactions.some(ltx => ltx.id === stx.id)
  ).length;

  return newProducts + deletedProducts + newBuyers + deletedBuyers + newBatches + modifiedBatches + deletedBatches + newTransactions + modifiedTransactions + deletedTransactions;
}

let isOnline = false;
let isSyncing = false;

// Фоновая синхронизация с облаком Supabase
async function syncWithCloud() {
  if (isSyncing || !isSupabaseConfigured) return;
  isSyncing = true;

  try {
    // 1. Скачиваем актуальное состояние из Supabase (заменяет пинг)
    const [
      dbProducts,
      dbLocations,
      dbBatches,
      dbTransactions,
      dbBuyers
    ] = await Promise.all([
      fetchAllFromTable('products'),
      fetchAllFromTable('locations'),
      fetchAllFromTable('batches'),
      fetchAllFromTable('transactions', { column: 'date', ascending: false }),
      fetchAllFromTable('buyers')
    ]);

    isOnline = true;

    const dbData = {
      products: dbProducts || [],
      locations: dbLocations || [],
      batches: dbBatches || [],
      transactions: dbTransactions || [],
      buyers: dbBuyers || []
    };

    // Читаем текущие локальные файлы
    const local = await readJsonFile(LOCAL_DB_PATH);
    const lastSynced = await readJsonFile(LAST_SYNCED_PATH);

    // Сливаем локальное состояние с облачными данными, чтобы разрешить любые SKU конфликты на сервере с учетом удаленных объектов
    const merged = mergeLocalAndDbStates(local, dbData, lastSynced);

    // Записываем слитое состояние в local_db.json
    await writeJsonFile(LOCAL_DB_PATH, merged);

    // Определяем удаленные сущности на основе сравнения local (до слияния) и lastSynced
    const deletedProducts = lastSynced.products.filter(sp => !local.products.some(lp => lp.id === sp.id));
    const deletedBuyers = lastSynced.buyers.filter(sb => !local.buyers.some(lb => lb.id === sb.id));
    const deletedBatches = lastSynced.batches.filter(sb => !local.batches.some(lb => lb.id === sb.id));
    const deletedTransactions = lastSynced.transactions.filter(st => !local.transactions.some(lt => lt.id === st.id));

    // Теперь определяем новые и измененные сущности на основе сравнения merged и dbData
    const newProducts = merged.products.filter(lp => !dbData.products.some(sp => sp.id === lp.id));
    const newBuyers = merged.buyers.filter(lb => !dbData.buyers.some(sb => sb.id === lb.id));
    const newBatches = merged.batches.filter(lb => !dbData.batches.some(sb => sb.id === lb.id));
    const newTransactions = merged.transactions.filter(lt => !dbData.transactions.some(st => st.id === lt.id));

    const modifiedBatches = merged.batches.filter(lb => {
      const sb = dbData.batches.find(sb => sb.id === lb.id);
      return sb && (sb.quantityKg !== lb.quantityKg || sb.initialQuantityKg !== lb.initialQuantityKg || sb.locationId !== lb.locationId || sb.productId !== lb.productId);
    });

    const modifiedTransactions = merged.transactions.filter(ltx => {
      const stx = dbData.transactions.find(st => st.id === ltx.id);
      return stx && (
        stx.quantityKg !== ltx.quantityKg ||
        stx.date !== ltx.date ||
        stx.notes !== ltx.notes ||
        stx.buyerId !== ltx.buyerId ||
        stx.wasteReason !== ltx.wasteReason ||
        stx.outcomeType !== ltx.outcomeType ||
        stx.productId !== ltx.productId
      );
    });

    // --- ВЫПОЛНЯЕМ СИНХРОНИЗАЦИЮ В ОБЛАКО ---

    // 1. Продукты
    if (newProducts.length > 0) {
      console.log(`[Sync] Отправка ${newProducts.length} новых товаров в Supabase...`);
      const { error } = await supabase.from('products').upsert(newProducts);
      if (error) throw error;
    }
    if (deletedProducts.length > 0) {
      console.log(`[Sync] Удаление ${deletedProducts.length} товаров из Supabase...`);
      const { error } = await supabase.from('products').delete().in('id', deletedProducts.map(p => p.id));
      if (error) throw error;
    }

    // 2. Покупатели
    if (newBuyers.length > 0) {
      console.log(`[Sync] Отправка ${newBuyers.length} новых покупателей в Supabase...`);
      const { error } = await supabase.from('buyers').upsert(newBuyers);
      if (error) throw error;
    }
    if (deletedBuyers.length > 0) {
      console.log(`[Sync] Удаление ${deletedBuyers.length} покупателей из Supabase...`);
      const { error } = await supabase.from('buyers').delete().in('id', deletedBuyers.map(b => b.id));
      if (error) throw error;
    }

    // 3. Партии
    if (newBatches.length > 0) {
      console.log(`[Sync] Отправка ${newBatches.length} новых партий в Supabase...`);
      const { error } = await supabase.from('batches').upsert(newBatches);
      if (error) throw error;
    }
    if (modifiedBatches.length > 0) {
      console.log(`[Sync] Обновление ${modifiedBatches.length} измененных партий в Supabase...`);
      for (const mb of modifiedBatches) {
        const { error } = await supabase.from('batches').update({
          quantityKg: mb.quantityKg,
          initialQuantityKg: mb.initialQuantityKg,
          locationId: mb.locationId,
          productId: mb.productId
        }).eq('id', mb.id);
        if (error) throw error;
      }
    }
    if (deletedBatches.length > 0) {
      console.log(`[Sync] Удаление ${deletedBatches.length} партий из Supabase...`);
      const { error } = await supabase.from('batches').delete().in('id', deletedBatches.map(b => b.id));
      if (error) throw error;
    }

    // 4. Транзакции
    if (newTransactions.length > 0) {
      console.log(`[Sync] Отправка ${newTransactions.length} новых транзакций в Supabase...`);
      const { error } = await supabase.from('transactions').upsert(newTransactions);
      if (error) throw error;
    }
    if (modifiedTransactions.length > 0) {
      console.log(`[Sync] Обновление ${modifiedTransactions.length} измененных транзакций в Supabase...`);
      for (const mt of modifiedTransactions) {
        const { error } = await supabase.from('transactions').update({
          quantityKg: mt.quantityKg,
          date: mt.date,
          notes: mt.notes,
          buyerId: mt.buyerId,
          wasteReason: mt.wasteReason,
          outcomeType: mt.outcomeType,
          productId: mt.productId
        }).eq('id', mt.id);
        if (error) throw error;
      }
    }
    if (deletedTransactions.length > 0) {
      console.log(`[Sync] Удаление ${deletedTransactions.length} транзакций из Supabase...`);
      const { error } = await supabase.from('transactions').delete().in('id', deletedTransactions.map(t => t.id));
      if (error) throw error;
    }

    // Скачиваем актуальное состояние для перезаписи
    const [
      dbProducts2,
      dbLocations2,
      dbBatches2,
      dbTransactions2,
      dbBuyers2
    ] = await Promise.all([
      fetchAllFromTable('products'),
      fetchAllFromTable('locations'),
      fetchAllFromTable('batches'),
      fetchAllFromTable('transactions', { column: 'date', ascending: false }),
      fetchAllFromTable('buyers')
    ]);

    const dbData2 = {
      products: dbProducts2 || [],
      locations: dbLocations2 || [],
      batches: dbBatches2 || [],
      transactions: dbTransactions2 || [],
      buyers: dbBuyers2 || []
    };

    // Синхронизируем локальный и облачный файлы
    await writeJsonFile(LOCAL_DB_PATH, dbData2);
    await writeJsonFile(LAST_SYNCED_PATH, dbData2);
    console.log(`[Sync] Фоновая синхронизация успешно завершена.`);
  } catch (err) {
    console.warn(`[Sync] Не удалось выполнить синхронизацию (возможно, нет интернета):`, err.message || err);
    isOnline = false;
  } finally {
    isSyncing = false;
  }
}

// Запуск фоновой синхронизации каждые 20 секунд
if (isSupabaseConfigured) {
  setInterval(syncWithCloud, 20000);
}

// --- API ЭНДПОИНТЫ ---

// 1. Получить состояние (со слиянием с Supabase, если онлайн)
app.get('/api/state', async (req, res) => {
  const local = await readJsonFile(LOCAL_DB_PATH);
  const lastSynced = await readJsonFile(LAST_SYNCED_PATH);

  if (!isSupabaseConfigured) {
    return res.json({ state: local, isOnline: false, unsyncedCount: 0 });
  }

  try {
    const [
      dbProducts,
      dbLocations,
      dbBatches,
      dbTransactions,
      dbBuyers
    ] = await Promise.all([
      fetchAllFromTable('products'),
      fetchAllFromTable('locations'),
      fetchAllFromTable('batches'),
      fetchAllFromTable('transactions', { column: 'date', ascending: false }),
      fetchAllFromTable('buyers')
    ]);

    isOnline = true;
    const dbData = {
      products: dbProducts || [],
      locations: dbLocations || [],
      batches: dbBatches || [],
      transactions: dbTransactions || [],
      buyers: dbBuyers || []
    };

    // Сливаем локальный файл с облачными данными с учетом удаленных объектов
    const merged = mergeLocalAndDbStates(local, dbData, lastSynced);
    
    // Сохраняем результат
    await writeJsonFile(LOCAL_DB_PATH, merged);
    await writeJsonFile(LAST_SYNCED_PATH, dbData);

    const unsyncedCount = getUnsyncedCount(merged, dbData);
    res.json({ state: merged, isOnline: true, unsyncedCount });

    // В фоне запускаем синхронизацию
    syncWithCloud();
  } catch (err) {
    console.warn('[API] Ошибка соединения с Supabase, отдаем локальный кэш:', err.message || err);
    isOnline = false;
    const unsyncedCount = getUnsyncedCount(local, lastSynced);
    res.json({ state: local, isOnline: false, unsyncedCount });
  }
});

// 2. Сохранить измененное состояние
app.post('/api/state', async (req, res) => {
  const { state } = req.body;
  if (!state) {
    return res.status(400).json({ error: 'Missing state parameter' });
  }

  // Записываем на жесткий диск
  await writeJsonFile(LOCAL_DB_PATH, state);

  // Вычисляем количество несинхронизированных операций
  const lastSynced = await readJsonFile(LAST_SYNCED_PATH);
  const unsyncedCount = getUnsyncedCount(state, lastSynced);

  res.json({ success: true, isOnline, unsyncedCount });

  // В фоне пробуем синхронизировать
  syncWithCloud();
});

// 3. Получить текущий статус синхронизации
app.get('/api/sync-status', async (req, res) => {
  const local = await readJsonFile(LOCAL_DB_PATH);
  const lastSynced = await readJsonFile(LAST_SYNCED_PATH);
  const unsyncedCount = getUnsyncedCount(local, lastSynced);

  res.json({ isOnline, unsyncedCount });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MeatSync Local Server is running on http://localhost:${PORT}`);
});
