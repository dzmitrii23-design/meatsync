import { describe, it, expect } from 'vitest';
import { autoDetectAttributes, generateProductSku, cn, parseOcrText, getProductNormalizedCategory, getProductPackagingLabel } from './utils';

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
});
