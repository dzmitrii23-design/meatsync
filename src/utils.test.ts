import { describe, it, expect } from 'vitest';
import { autoDetectAttributes, generateProductSku, cn } from './utils';

describe('utils.ts tests', () => {
  describe('cn', () => {
    it('should merge tailwind classes properly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
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
});
