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

// Функция слияния локального состояния и Supabase
function mergeLocalAndDbStates(local, db) {
  const products = [...db.products];
  if (local && Array.isArray(local.products)) {
    local.products.forEach(lp => {
      if (!products.some(dbp => dbp.id === lp.id)) {
        products.push(lp);
      }
    });
  }

  const locations = db.locations && db.locations.length ? db.locations : (local && local.locations && local.locations.length ? local.locations : []);

  const mergedBatches = [...db.batches];
  if (local && Array.isArray(local.batches)) {
    local.batches.forEach(lb => {
      const idx = mergedBatches.findIndex(dbb => dbb.id === lb.id);
      if (idx !== -1) {
        if (
          mergedBatches[idx].quantityKg !== lb.quantityKg ||
          mergedBatches[idx].initialQuantityKg !== lb.initialQuantityKg ||
          mergedBatches[idx].locationId !== lb.locationId
        ) {
          mergedBatches[idx] = { ...mergedBatches[idx], ...lb };
        }
      } else {
        mergedBatches.push(lb);
      }
    });
  }

  const mergedTransactions = [...db.transactions];
  if (local && Array.isArray(local.transactions)) {
    local.transactions.forEach(ltx => {
      if (!mergedTransactions.some(dbtx => dbtx.id === ltx.id)) {
        mergedTransactions.push(ltx);
      }
    });
  }
  mergedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const buyers = [...db.buyers];
  if (local && Array.isArray(local.buyers)) {
    local.buyers.forEach(lby => {
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
    // 1. Проверяем доступность Supabase простым запросом
    const { error: pingError } = await supabase.from('locations').select('id').limit(1);
    if (pingError) throw pingError;
    isOnline = true;

    // Читаем текущее состояние и последнее синхронизированное
    const local = await readJsonFile(LOCAL_DB_PATH);
    const lastSynced = await readJsonFile(LAST_SYNCED_PATH);

    // --- ПРОДУКТЫ ---
    const newProducts = local.products.filter(lp => !lastSynced.products.some(sp => sp.id === lp.id));
    if (newProducts.length > 0) {
      console.log(`[Sync] Отправка ${newProducts.length} новых товаров в Supabase...`);
      const { error } = await supabase.from('products').upsert(newProducts);
      if (error) throw error;
    }
    const deletedProducts = lastSynced.products.filter(sp => !local.products.some(lp => lp.id === sp.id));
    if (deletedProducts.length > 0) {
      console.log(`[Sync] Удаление ${deletedProducts.length} товаров из Supabase...`);
      const { error } = await supabase.from('products').delete().in('id', deletedProducts.map(p => p.id));
      if (error) throw error;
    }

    // --- ПОКУПАТЕЛИ ---
    const newBuyers = local.buyers.filter(lb => !lastSynced.buyers.some(sb => sb.id === lb.id));
    if (newBuyers.length > 0) {
      console.log(`[Sync] Отправка ${newBuyers.length} новых покупателей в Supabase...`);
      const { error } = await supabase.from('buyers').upsert(newBuyers);
      if (error) throw error;
    }
    const deletedBuyers = lastSynced.buyers.filter(sb => !local.buyers.some(lb => lb.id === sb.id));
    if (deletedBuyers.length > 0) {
      console.log(`[Sync] Удаление ${deletedBuyers.length} покупателей из Supabase...`);
      const { error } = await supabase.from('buyers').delete().in('id', deletedBuyers.map(b => b.id));
      if (error) throw error;
    }

    // --- ПАРТИИ ---
    const newBatches = local.batches.filter(lb => !lastSynced.batches.some(sb => sb.id === lb.id));
    if (newBatches.length > 0) {
      console.log(`[Sync] Отправка ${newBatches.length} новых партий в Supabase...`);
      const { error } = await supabase.from('batches').upsert(newBatches);
      if (error) throw error;
    }
    const modifiedBatches = local.batches.filter(lb => {
      const sb = lastSynced.batches.find(sb => sb.id === lb.id);
      return sb && (sb.quantityKg !== lb.quantityKg || sb.initialQuantityKg !== lb.initialQuantityKg || sb.locationId !== lb.locationId);
    });
    if (modifiedBatches.length > 0) {
      console.log(`[Sync] Обновление ${modifiedBatches.length} измененных партий в Supabase...`);
      for (const mb of modifiedBatches) {
        const { error } = await supabase.from('batches').update({
          quantityKg: mb.quantityKg,
          initialQuantityKg: mb.initialQuantityKg,
          locationId: mb.locationId
        }).eq('id', mb.id);
        if (error) throw error;
      }
    }
    const deletedBatches = lastSynced.batches.filter(sb => !local.batches.some(lb => lb.id === sb.id));
    if (deletedBatches.length > 0) {
      console.log(`[Sync] Удаление ${deletedBatches.length} партий из Supabase...`);
      const { error } = await supabase.from('batches').delete().in('id', deletedBatches.map(b => b.id));
      if (error) throw error;
    }

    // --- ТРАНЗАКЦИИ ---
    const newTransactions = local.transactions.filter(lt => !lastSynced.transactions.some(st => st.id === lt.id));
    if (newTransactions.length > 0) {
      console.log(`[Sync] Отправка ${newTransactions.length} новых транзакций в Supabase...`);
      const { error } = await supabase.from('transactions').upsert(newTransactions);
      if (error) throw error;
    }
    const modifiedTransactions = local.transactions.filter(ltx => {
      const stx = lastSynced.transactions.find(st => st.id === ltx.id);
      return stx && (
        stx.quantityKg !== ltx.quantityKg ||
        stx.date !== ltx.date ||
        stx.notes !== ltx.notes ||
        stx.buyerId !== ltx.buyerId ||
        stx.wasteReason !== ltx.wasteReason ||
        stx.outcomeType !== ltx.outcomeType
      );
    });
    if (modifiedTransactions.length > 0) {
      console.log(`[Sync] Обновление ${modifiedTransactions.length} измененных транзакций в Supabase...`);
      for (const mt of modifiedTransactions) {
        const { error } = await supabase.from('transactions').update({
          quantityKg: mt.quantityKg,
          date: mt.date,
          notes: mt.notes,
          buyerId: mt.buyerId,
          wasteReason: mt.wasteReason,
          outcomeType: mt.outcomeType
        }).eq('id', mt.id);
        if (error) throw error;
      }
    }
    const deletedTransactions = lastSynced.transactions.filter(st => !local.transactions.some(lt => lt.id === st.id));
    if (deletedTransactions.length > 0) {
      console.log(`[Sync] Удаление ${deletedTransactions.length} транзакций из Supabase...`);
      const { error } = await supabase.from('transactions').delete().in('id', deletedTransactions.map(t => t.id));
      if (error) throw error;
    }

    // Скачиваем актуальное состояние для перезаписи
    const [
      { data: dbProducts, error: pErr },
      { data: dbLocations, error: lErr },
      { data: dbBatches, error: baErr },
      { data: dbTransactions, error: tErr },
      { data: dbBuyers, error: buErr }
    ] = await Promise.all([
      supabase.from('products').select('*'),
      supabase.from('locations').select('*'),
      supabase.from('batches').select('*'),
      supabase.from('transactions').select('*').order('date', { ascending: false }),
      supabase.from('buyers').select('*')
    ]);

    if (!pErr && !lErr && !baErr && !tErr && !buErr) {
      const dbData = {
        products: dbProducts || [],
        locations: dbLocations || [],
        batches: dbBatches || [],
        transactions: dbTransactions || [],
        buyers: dbBuyers || []
      };

      // Синхронизируем локальный и облачный файлы
      await writeJsonFile(LOCAL_DB_PATH, dbData);
      await writeJsonFile(LAST_SYNCED_PATH, dbData);
    }
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
      { data: dbProducts, error: pErr },
      { data: dbLocations, error: lErr },
      { data: dbBatches, error: baErr },
      { data: dbTransactions, error: tErr },
      { data: dbBuyers, error: buErr }
    ] = await Promise.all([
      supabase.from('products').select('*'),
      supabase.from('locations').select('*'),
      supabase.from('batches').select('*'),
      supabase.from('transactions').select('*').order('date', { ascending: false }),
      supabase.from('buyers').select('*')
    ]);

    if (pErr || lErr || baErr || tErr || buErr) {
      console.error('[Supabase Error Details]:', { pErr, lErr, baErr, tErr, buErr });
      throw new Error(`Supabase fetch failed: ${pErr?.message || lErr?.message || baErr?.message || tErr?.message || buErr?.message}`);
    }

    isOnline = true;
    const dbData = {
      products: dbProducts || [],
      locations: dbLocations || [],
      batches: dbBatches || [],
      transactions: dbTransactions || [],
      buyers: dbBuyers || []
    };

    // Сливаем локальный файл с облачными данными
    const merged = mergeLocalAndDbStates(local, dbData);
    
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
