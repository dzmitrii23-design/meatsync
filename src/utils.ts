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
