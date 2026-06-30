import { describe, it, expect } from 'vitest';
import { autoDetectAttributes, generateProductSku, cn, parseOcrText, getProductNormalizedCategory, getProductPackagingLabel } from './utils';
import { renderHook, act } from '@testing-library/react';
import { useAppStore, mergeLocalAndDbStates } from './store';

describe('utils.ts tests', () => {
  describe('cn', () => {
    it('should merge tailwind classes properly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    });
  });

  describe('getProductNormalizedCategory', () => {
    it('should respect explicit category if set to Охлажденное or Замороженное', () => {
      expect(getProductNormalizedCategory({ name: 'Мясо', category: 'Охлажденное' })).toBe('Охлажденное');
      expect(getProductNormalizedCategory({ name: 'Мясо', category: 'Замороженное' })).toBe('Замороженное');
    });

    it('should auto-detect category by name if raw or missing', () => {
      expect(getProductNormalizedCategory({ name: 'Шея свиная (ОХЛ)', category: 'Свинина' })).toBe('Охлажденное');
      expect(getProductNormalizedCategory({ name: 'Говядина в полутушах', category: '' })).toBe('Охлажденное');
      expect(getProductNormalizedCategory({ name: 'Свиной окорок без кости', category: 'Свинина' })).toBe('Замороженное');
    });
  });

  describe('getProductPackagingLabel', () => {
    it('should format labels with corresponding emojis', () => {
      expect(getProductPackagingLabel('Полутуши')).toBe('🚚 Полутуши');
      expect(getProductPackagingLabel('Блочка')).toBe('📦 Блочка');
      expect(getProductPackagingLabel('Отруба')).toBe('🥩 Отруба');
      expect(getProductPackagingLabel('Лотки')).toBe('📥 Лотки');
      expect(getProductPackagingLabel('Вакуум')).toBe('🛡️ Вакуум');
      expect(getProductPackagingLabel('Мелкая фасовка')).toBe('🛍️ Мелкая фасовка');
    });

    it('should handle undefined and unknown values', () => {
      expect(getProductPackagingLabel('')).toBe('');
      expect(getProductPackagingLabel(undefined)).toBe('');
      expect(getProductPackagingLabel('Коробка')).toBe('📦 Коробка');
    });
  });

  describe('autoDetectAttributes', () => {
    it('should detect Pork (Свинина)', () => {
      const result = autoDetectAttributes({ name: 'Свиной окорок без кости', category: 'Свинина' });
      expect(result.rawMaterial).toBe('Свинина');
      expect(result.packagingType).toBe('Отруба');
    });

    it('should detect Beef (Говядина) and blocks', () => {
      const result = autoDetectAttributes({ name: 'Блок говяжий замороженный', category: 'Говядина' });
      expect(result.rawMaterial).toBe('Говядина');
      expect(result.packagingType).toBe('Блочка');
    });

    it('should fallback to Иное if not matched', () => {
      const result = autoDetectAttributes({ name: 'Неизвестный продукт', category: 'Другое' });
      expect(result.rawMaterial).toBe('Иное');
      expect(result.packagingType).toBe('Иное');
    });
  });

  describe('generateProductSku', () => {
    it('should generate first SKU for pork blocks', () => {
      const sku = generateProductSku('Свинина', [], 'Свинина', 'Блочка');
      expect(sku).toBe('SV-BL-01');
    });

    it('should increment SKU based on existing products', () => {
      const existing = [
        { sku: 'SV-BL-01', category: 'Свинина', name: 'Блок свиной', rawMaterial: 'Свинина', packagingType: 'Блочка' },
        { sku: 'SV-BL-02', category: 'Свинина', name: 'Блок свиной премиум', rawMaterial: 'Свинина', packagingType: 'Блочка' }
      ];
      const sku = generateProductSku('Свинина', existing, 'Свинина', 'Блочка');
      expect(sku).toBe('SV-BL-03');
    });
  });

  describe('parseOcrText', () => {
    const products = [
      { id: 'p_pork', name: 'Шея свиная без кости', sku: 'SV-OT-01', category: 'Свинина', defaultShelfLifeDays: 15 },
      { id: 'p_beef', name: 'Говядина в полутушах', sku: 'BV-TS-01', category: 'Говядина', defaultShelfLifeDays: 20 }
    ];

    const buyers = [
      { id: 'b_soyuz', name: 'ООО Мясной Союз', inn: '7725489031' },
      { id: 'b_grig', name: 'ИП Григорьев С.Ю.', inn: '503204918230' }
    ];

    it('should parse weight, product by SKU, buyer by INN and reason', () => {
      const ocrText = `
        АКТ ВОЗВРАТА ТОВАРА №12
        Отправитель: ООО Мясной Союз, ИНН 7725489031
        Товар: Шея свиная без кости (артикул: SV-OT-01)
        Выявлен РАЗВАКУУМ пакета.
        Фактический вес возврата: 45,5 кг.
      `;
      const result = parseOcrText(ocrText, products, buyers);
      expect(result.productId).toBe('p_pork');
      expect(result.quantityKg).toBe(45.5);
      expect(result.buyerId).toBe('b_soyuz');
      expect(result.reason).toBe('💨 Развакуум / Повреждение упаковки');
    });

    it('should parse product by name keywords and buyer by name keywords', () => {
      const ocrText = `
        Накладная от ИП Григорьев
        Возврат говядины по причине высокой температуры в кузове.
        Масса нетто составляет 120.50 кг.
      `;
      const result = parseOcrText(ocrText, products, buyers);
      expect(result.productId).toBe('p_beef');
      expect(result.quantityKg).toBe(120.5);
      expect(result.buyerId).toBe('b_grig');
      expect(result.reason).toBe('❌ Отказ в приемке по качеству / Температуре');
    });
  });

  describe('store.ts deleteTransaction and updateTransaction tests', () => {
    it('should delete a transaction and restore balance', async () => {
      const { result } = renderHook(() => useAppStore());
      
      // 1. Создаем приход 100 кг
      await act(async () => {
        await result.current.processIncome({
          productId: 'p2',
          locationId: 'loc_main_1',
          quantityKg: 100,
          receivedAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        });
      });

      const tx = result.current.state.transactions[0];
      const batchId = tx.batchId;
      expect(tx.quantityKg).toBe(100);

      // 2. Списываем расход 40 кг
      await act(async () => {
        await result.current.processOutcome(
          batchId!,
          40,
          new Date().toISOString(),
          'Test outcome'
        );
      });

      // Вес партии должен стать 60 кг
      let batch = result.current.state.batches.find(b => b.id === batchId);
      expect(batch?.quantityKg).toBe(60);

      // 3. Удаляем транзакцию расхода 40 кг
      const outcomeTx = result.current.state.transactions[0];
      await act(async () => {
        const deleteRes = await result.current.deleteTransaction(outcomeTx.id);
        expect(deleteRes.success).toBe(true);
      });

      // Вес партии должен вернуться к 100 кг
      batch = result.current.state.batches.find(b => b.id === batchId);
      expect(batch?.quantityKg).toBe(100);
    });

    it('should block deletion of IN transaction if batch was spent', async () => {
      const { result } = renderHook(() => useAppStore());

      // 1. Создаем приход 200 кг
      await act(async () => {
        await result.current.processIncome({
          productId: 'p3',
          locationId: 'loc_main_1',
          quantityKg: 200,
          receivedAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        });
      });

      const incomeTx = result.current.state.transactions[0];
      const batchId = incomeTx.batchId;

      // 2. Списываем 50 кг
      await act(async () => {
        await result.current.processOutcome(
          batchId!,
          50,
          new Date().toISOString(),
          'Test spend'
        );
      });

      // 3. Пытаемся удалить приход (должно заблокироваться)
      await act(async () => {
        const deleteRes = await result.current.deleteTransaction(incomeTx.id);
        expect(deleteRes.success).toBe(false);
        expect(deleteRes.error).toContain('Невозможно удалить приход');
      });
    });

    it('should edit transaction weight and adjust batch quantity', async () => {
      const { result } = renderHook(() => useAppStore());

      // 1. Создаем приход 300 кг
      await act(async () => {
        await result.current.processIncome({
          productId: 'p4',
          locationId: 'loc_main_1',
          quantityKg: 300,
          receivedAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        });
      });

      const incomeTx = result.current.state.transactions[0];
      
      // 2. Редактируем вес прихода на 350 кг
      await act(async () => {
        const updateRes = await result.current.updateTransaction(incomeTx.id, {
          quantityKg: 350
        });
        expect(updateRes.success).toBe(true);
      });

      // 3. Вес партии должен обновиться до 350 кг
      const batch = result.current.state.batches.find(b => b.id === incomeTx.batchId);
      expect(batch?.quantityKg).toBe(350);
      expect(batch?.initialQuantityKg).toBe(350);
    });

    it('should block deletion of IN transaction if it has dependent transactions (Approach 1 Cascade Block)', async () => {
      const { result } = renderHook(() => useAppStore());

      // 1. Создаем приход 500 кг
      await act(async () => {
        await result.current.processIncome({
          productId: 'p5',
          locationId: 'loc_main_1',
          quantityKg: 500,
          receivedAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        });
      });

      const incomeTx = result.current.state.transactions[0];
      const batchId = incomeTx.batchId;

      // 2. Перемещаем 200 кг
      await act(async () => {
        await result.current.moveBatch(
          batchId!,
          'loc_reefer_1',
          200,
          new Date().toISOString()
        );
      });

      // 3. Пытаемся удалить транзакцию прихода (должно заблокироваться из-за зависимой MOVE-транзакции)
      await act(async () => {
        const deleteRes = await result.current.deleteTransaction(incomeTx.id);
        expect(deleteRes.success).toBe(false);
        expect(deleteRes.error).toContain('по этой партии в системе зарегистрированы движения');
      });
    });

    it('should merge two IN transactions with same product, location, and date into one batch', async () => {
      const { result } = renderHook(() => useAppStore());
      const testDate = new Date('2026-06-30T12:00:00.000Z').toISOString();

      // 1. Создаем первый приход 150 кг
      await act(async () => {
        await result.current.processIncome({
          productId: 'p7',
          locationId: 'loc_main_1',
          quantityKg: 150,
          receivedAt: testDate,
          expiresAt: new Date().toISOString(),
        });
      });

      // 2. Создаем второй приход 100 кг для того же товара, локации и даты
      await act(async () => {
        await result.current.processIncome({
          productId: 'p7',
          locationId: 'loc_main_1',
          quantityKg: 100,
          receivedAt: testDate,
          expiresAt: new Date().toISOString(),
        });
      });

      // 3. Должна быть одна партия с суммарным весом 250 кг
      const tx1 = result.current.state.transactions[1]; // Второй по счету (новый идет в начало массива)
      const tx2 = result.current.state.transactions[0]; // Первый в массиве (последний добавленный)
      
      expect(tx1.batchId).toBe(tx2.batchId);

      const batch = result.current.state.batches.find(b => b.id === tx1.batchId);
      expect(batch?.quantityKg).toBe(250);
      expect(batch?.initialQuantityKg).toBe(250);

      // 4. Удаляем один из приходов (100 кг)
      await act(async () => {
        const deleteRes = await result.current.deleteTransaction(tx2.id);
        expect(deleteRes.success).toBe(true);
      });

      // Партия должна остаться, вес уменьшиться до 150 кг
      const updatedBatch = result.current.state.batches.find(b => b.id === tx1.batchId);
      expect(updatedBatch).toBeDefined();
      expect(updatedBatch?.quantityKg).toBe(150);
      expect(updatedBatch?.initialQuantityKg).toBe(150);

      // 5. Удаляем второй приход (150 кг)
      await act(async () => {
        const deleteRes = await result.current.deleteTransaction(tx1.id);
        expect(deleteRes.success).toBe(true);
      });

      // Партия должна быть полностью удалена
      const deletedBatch = result.current.state.batches.find(b => b.id === tx1.batchId);
      expect(deletedBatch).toBeUndefined();
    });

    it('should block deletion of one IN transaction of merged batch if remaining quantity is insufficient', async () => {
      const { result } = renderHook(() => useAppStore());
      const testDate = new Date('2026-06-30T12:00:00.000Z').toISOString();

      // 1. Создаем первый приход 100 кг
      await act(async () => {
        await result.current.processIncome({
          productId: 'p7',
          locationId: 'loc_main_1',
          quantityKg: 100,
          receivedAt: testDate,
          expiresAt: new Date().toISOString(),
        });
      });

      // 2. Создаем второй приход 100 кг
      await act(async () => {
        await result.current.processIncome({
          productId: 'p7',
          locationId: 'loc_main_1',
          quantityKg: 100,
          receivedAt: testDate,
          expiresAt: new Date().toISOString(),
        });
      });

      const tx1 = result.current.state.transactions[1];
      const batchId = tx1.batchId;

      // 3. Расходуем 150 кг (остается 50 кг)
      await act(async () => {
        await result.current.processOutcome(
          batchId!,
          150,
          new Date().toISOString(),
          'Test spend of merged'
        );
      });

      // 4. Пытаемся удалить один из приходов по 100 кг
      await act(async () => {
        const deleteRes = await result.current.deleteTransaction(tx1.id);
        expect(deleteRes.success).toBe(false);
        expect(deleteRes.error).toContain('с этой партии уже списано');
      });
    });

    it('should merge two IN transactions with same product, location, and manufacturedAt but different receivedAt', async () => {
      const { result } = renderHook(() => useAppStore());
      const mfgDate = new Date('2035-10-10T10:00:00.000Z').toISOString();
      const recDate1 = new Date('2035-10-10T12:00:00.000Z').toISOString();
      const recDate2 = new Date('2035-10-11T09:00:00.000Z').toISOString();

      // 1. Создаем первый приход 150 кг
      await act(async () => {
        await result.current.processIncome({
          productId: 'p7',
          locationId: 'loc_main_1',
          quantityKg: 150,
          receivedAt: recDate1,
          manufacturedAt: mfgDate,
          expiresAt: new Date().toISOString(),
        });
      });

      // 2. Создаем второй приход 100 кг (другая дата прихода, но та же дата изготовления)
      await act(async () => {
        await result.current.processIncome({
          productId: 'p7',
          locationId: 'loc_main_1',
          quantityKg: 100,
          receivedAt: recDate2,
          manufacturedAt: mfgDate,
          expiresAt: new Date().toISOString(),
        });
      });

      // 3. Они должны слиться в одну партию
      const tx1 = result.current.state.transactions[1];
      const tx2 = result.current.state.transactions[0];
      expect(tx1.batchId).toBe(tx2.batchId);

      const batch = result.current.state.batches.find(b => b.id === tx1.batchId);
      expect(batch?.quantityKg).toBe(250);
    });
  });

  describe('mergeLocalAndDbStates', () => {
    it('should merge new transactions and batches from local state to db state without duplicates', () => {
      const localState = {
        products: [],
        locations: [],
        batches: [
          { id: 'batch_local_new', productId: 'p1', locationId: 'loc_main_1', quantityKg: 100, initialQuantityKg: 100, receivedAt: '2026-07-01T00:00:00.000Z', expiresAt: '2026-07-15T00:00:00.000Z' },
          { id: 'batch_existing', productId: 'p1', locationId: 'loc_main_1', quantityKg: 150, initialQuantityKg: 200, receivedAt: '2026-06-30T00:00:00.000Z', expiresAt: '2026-07-15T00:00:00.000Z' }
        ],
        transactions: [
          { id: 'tx_local_new', type: 'IN', productId: 'p1', quantityKg: 100, date: '2026-07-01T00:00:00.000Z', batchId: 'batch_local_new', toLocationId: 'loc_main_1' }
        ],
        buyers: []
      } as any;

      const dbData = {
        products: [{ id: 'p1', name: 'Product 1', sku: 'P1-01', category: 'Охлажденное', defaultShelfLifeDays: 15 }],
        locations: [{ id: 'loc_main_1', name: 'Main Fridge', type: 'main_fridge', capacityKg: 20000 }],
        batches: [
          { id: 'batch_existing', productId: 'p1', locationId: 'loc_main_1', quantityKg: 200, initialQuantityKg: 200, receivedAt: '2026-06-30T00:00:00.000Z', expiresAt: '2026-07-15T00:00:00.000Z' }
        ],
        transactions: [
          { id: 'tx_existing', type: 'IN', productId: 'p1', quantityKg: 200, date: '2026-06-30T00:00:00.000Z', batchId: 'batch_existing', toLocationId: 'loc_main_1' }
        ],
        buyers: []
      } as any;

      const merged = mergeLocalAndDbStates(localState, dbData);

      expect(merged.products.length).toBe(1);
      expect(merged.products[0].id).toBe('p1');

      expect(merged.batches.length).toBe(2);
      const bNew = merged.batches.find(b => b.id === 'batch_local_new');
      const bExist = merged.batches.find(b => b.id === 'batch_existing');
      expect(bNew).toBeDefined();
      expect(bNew?.quantityKg).toBe(100);
      expect(bExist).toBeDefined();
      expect(bExist?.quantityKg).toBe(150);

      expect(merged.transactions.length).toBe(2);
      expect(merged.transactions.some(t => t.id === 'tx_local_new')).toBe(true);
      expect(merged.transactions.some(t => t.id === 'tx_existing')).toBe(true);
      
      expect(merged.transactions[0].id).toBe('tx_local_new');
    });
  });
});
