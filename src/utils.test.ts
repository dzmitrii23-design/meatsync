import { describe, it, expect } from 'vitest';
import { autoDetectAttributes, generateProductSku, cn, parseOcrText, getProductNormalizedCategory, getProductPackagingLabel } from './utils';
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from './store';

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
          productId: 'p2',
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
  });
});
