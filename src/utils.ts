import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId() {
  return crypto.randomUUID();
}

export function autoDetectAttributes(p: { name: string; category: string }): { rawMaterial: string; packagingType: string } {
  let rawMaterial = 'Иное';
  const cat = (p.category || '').toLowerCase();
  const name = (p.name || '').toLowerCase();

  if (cat.includes('свин') || name.includes('свин')) {
    rawMaterial = 'Свинина';
  } else if (cat.includes('гов') || name.includes('гов')) {
    rawMaterial = 'Говядина';
  } else if (cat.includes('птиц') || cat.includes('кур') || name.includes('кур') || name.includes('филе грудк') || name.includes('бедро') || name.includes('крыло') || name.includes('цб')) {
    rawMaterial = 'Птица';
  } else if (cat.includes('бар') || name.includes('баран')) {
    rawMaterial = 'Баранина';
  } else if (cat.includes('суб') || name.includes('печен') || name.includes('сердц') || name.includes('язык') || name.includes('желуд')) {
    rawMaterial = 'Субпродукты';
  }

  let packagingType = 'Иное';
  if (name.includes('полутуш') || name.includes('туша') || name.includes('туши') || name.includes('четверт')) {
    packagingType = 'Полутуши';
  } else if (name.includes('лоток') || name.includes('лотки') || name.includes('лоточке') || name.includes('лотк')) {
    packagingType = 'Лотки';
  } else if (name.includes('блоч') || name.includes('блок')) {
    packagingType = 'Блочка';
  } else if (name.includes('мелк') || name.includes('фасовк') || name.includes('пакет') || name.includes('подлож')) {
    packagingType = 'Мелкая фасовка';
  } else if (name.includes('окорок') || name.includes('лопат') || name.includes('шея') || name.includes('грудин') || name.includes('карбонад') || name.includes('вырезк') || name.includes('рибай') || name.includes('задняя') || name.includes('седло') || name.includes('бедро')) {
    packagingType = 'Отруба';
  } else if (name.includes('вакуум') || name.includes('в/у')) {
    packagingType = 'Вакуум';
  }

  return { rawMaterial, packagingType };
}

export function generateProductSku(
  category: string,
  existingProducts: { sku: string; category?: string; name?: string; rawMaterial?: string; packagingType?: string }[],
  rawMaterial?: string,
  packagingType?: string
): string {
  // 1. Determine raw material abbreviation
  let matCode = 'GEN';
  const mat = (rawMaterial || category || '').trim().toLowerCase();
  
  if (mat.includes('свин')) {
    matCode = 'SV';
  } else if (mat.includes('гов')) {
    matCode = 'BV';
  } else if (mat.includes('птиц') || mat.includes('кур') || mat.includes('цып')) {
    matCode = 'PT';
  } else if (mat.includes('суб') || mat.includes('печен') || mat.includes('сердц') || mat.includes('язык') || mat.includes('желуд')) {
    matCode = 'SUB';
  } else if (mat.includes('бар')) {
    matCode = 'BR';
  } else {
    // Basic translit for unknown categories
    const rupa: Record<string, string> = {
      'а': 'A', 'б': 'B', 'в': 'V', 'г': 'G', 'д': 'D', 'е': 'E', 'ж': 'ZH', 'з': 'Z',
      'и': 'I', 'й': 'Y', 'к': 'K', 'л': 'L', 'м': 'M', 'н': 'N', 'о': 'O', 'п': 'P',
      'р': 'R', 'с': 'S', 'т': 'T', 'у': 'U', 'ф': 'F', 'х': 'KH', 'ц': 'TS', 'ч': 'CH',
      'ш': 'SH', 'щ': 'SCH', 'ы': 'Y', 'э': 'E', 'ю': 'YU', 'я': 'YA'
    };
    let constructed = '';
    const letters = mat.replace(/[^а-яa-z0-9]/g, '');
    for (let i = 0; i < Math.min(letters.length, 3); i++) {
      const char = letters[i];
      constructed += rupa[char] || char.toUpperCase();
    }
    matCode = constructed.length >= 2 ? constructed : 'OTH';
  }

  // 2. Determine packaging abbreviation
  let packCode = 'ZZ';
  const pack = (packagingType || '').trim().toLowerCase();
  
  if (pack.includes('блоч') || pack.includes('блок')) {
    packCode = 'BL';
  } else if (pack.includes('лот')) {
    packCode = 'LT';
  } else if (pack.includes('мелк') || pack.includes('фасовк') || pack.includes('пакет')) {
    packCode = 'MF';
  } else if (pack.includes('отруб') || pack.includes('кусок') || pack.includes('крупн')) {
    packCode = 'OT';
  } else if (pack.includes('полутуш') || pack.includes('туша') || pack.includes('четверт')) {
    packCode = 'TS';
  } else if (pack.includes('вакуум') || pack.includes('в/у')) {
    packCode = 'VK';
  }

  // Composed prefix e.g. SV-BL, BV-TS, PT-MF
  const prefix = `${matCode.toUpperCase()}-${packCode.toUpperCase()}`;
  const prefixWithDash = `${prefix}-`;
  
  let maxNum = 0;
  existingProducts.forEach(p => {
    if (p.sku && p.sku.toUpperCase().startsWith(prefixWithDash)) {
      const parts = p.sku.split('-');
      if (parts.length >= 3) {
        const suffixPart = parts[parts.length - 1];
        const num = parseInt(suffixPart, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      } else {
        // Fallback for parts.length == 2 e.g. "SV-01" style from old products
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  });
  
  const nextNum = maxNum + 1;
  const paddedNum = String(nextNum).padStart(2, '0');
  return `${prefix}-${paddedNum}`;
}

import { Product, Buyer } from './types';

export interface ParsedOcrResult {
  productId: string;
  quantityKg: number;
  buyerId: string;
  reason: string;
}

export function parseOcrText(
  text: string,
  products: Product[],
  buyers: Buyer[]
): ParsedOcrResult {
  const normalizedText = text.toLowerCase();

  // 1. Извлечение веса (quantityKg)
  let quantityKg = 0;
  
  // Ищем вес с указанием размерности: "123.45 кг" или "123,45kg"
  const weightRegex = /(\d+[.,]?\d*)\s*(?:кг|kg|килограмм)\b/gi;
  let weightMatch = weightRegex.exec(normalizedText);
  if (weightMatch) {
    quantityKg = parseFloat(weightMatch[1].replace(',', '.'));
  } else {
    // Ищем фразы "вес", "масса", "кол-во", "колво", "нетто" и число после них
    const labelWeightRegex = /(?:вес|масса|кол-во|колво|нетто)[^\d\n]*(\d+[.,]?\d*)/gi;
    let labelMatch = labelWeightRegex.exec(normalizedText);
    if (labelMatch) {
      quantityKg = parseFloat(labelMatch[1].replace(',', '.'));
    }
  }

  // 2. Поиск продукции (productId)
  let productId = '';
  
  // Шаг А. Ищем точное совпадение по SKU
  for (const p of products) {
    if (p.sku && normalizedText.includes(p.sku.toLowerCase())) {
      productId = p.id;
      break;
    }
  }

  // Шаг Б. Если по SKU не нашли, ищем по ключевым словам из имени с учетом склонений (стемминг)
  if (!productId) {
    let bestScore = 0;
    const textWords = normalizedText.split(/[^а-яa-z0-9]+/);
    
    // Простая функция стемминга для русского языка (отсекаем 1-2 последние буквы)
    const getStem = (w: string) => {
      if (w.length <= 3) return w;
      if (w.length <= 5) return w.slice(0, w.length - 1);
      return w.slice(0, w.length - 2);
    };

    const textStems = textWords.map(w => getStem(w)).filter(w => w.length >= 3);

    for (const p of products) {
      const pWords = p.name.toLowerCase().split(/[^а-яa-z0-9]+/);
      const pStems = pWords.map(w => getStem(w)).filter(w => w.length >= 3);
      
      let score = 0;
      for (const pStem of pStems) {
        if (textStems.includes(pStem)) {
          score += 2; // Совпадение основы слова
        } else if (normalizedText.includes(pStem)) {
          score += 1; // Частичное вхождение основы
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        productId = p.id;
      }
    }
  }

  // 3. Поиск покупателя (buyerId)
  let buyerId = '';
  
  // Шаг А. Ищем по ИНН (10 или 12 цифр)
  const innRegex = /\b\d{10}\b|\b\d{12}\b/g;
  let innMatch;
  while ((innMatch = innRegex.exec(normalizedText)) !== null) {
    const foundInn = innMatch[0];
    const buyer = buyers.find(b => b.inn === foundInn);
    if (buyer) {
      buyerId = buyer.id;
      break;
    }
  }

  // Шаг Б. Ищем по названию покупателя
  if (!buyerId) {
    for (const b of buyers) {
      const nameParts = b.name.toLowerCase().replace(/(?:ооо|ип|зао|оао|\"|\«|\»)/g, '').trim().split(/[^а-яa-z0-9]+/);
      let matchesAll = true;
      let matchCount = 0;
      for (const part of nameParts) {
        if (part.length > 2) {
          matchCount++;
          if (!normalizedText.includes(part)) {
            matchesAll = false;
            break;
          }
        }
      }
      if (matchCount > 0 && matchesAll) {
        buyerId = b.id;
        break;
      }
    }
  }

  // 4. Поиск причины возврата
  let reason = '⚠️ Брак продукции / Нарушение ТУ'; // Значение по умолчанию
  
  if (normalizedText.includes('развакуум') || normalizedText.includes('упаковк') || normalizedText.includes('пакет') || normalizedText.includes('дыр')) {
    reason = '💨 Развакуум / Повреждение упаковки';
  } else if (normalizedText.includes('отказ') || normalizedText.includes('температур') || normalizedText.includes('градус') || normalizedText.includes('тепл')) {
    reason = '❌ Отказ в приемке по качеству / Температуре';
  } else if (normalizedText.includes('срок') || normalizedText.includes('годен') || normalizedText.includes('истек') || normalizedText.includes('просроч')) {
    reason = '⏰ Истек срок годности при доставке';
  } else if (normalizedText.includes('недовес') || normalizedText.includes('пересорт') || normalizedText.includes('разниц')) {
    reason = '⚖️ Недовес / Пересортица при отгрузке';
  } else if (normalizedText.includes('брак') || normalizedText.includes('ту') || normalizedText.includes('гнил') || normalizedText.includes('запах')) {
    reason = '⚠️ Брак продукции / Нарушение ТУ';
  }

  return { productId, quantityKg, buyerId, reason };
}

