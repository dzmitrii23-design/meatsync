import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Шаблон Номенклатуры');

  // Настройка колонок
  worksheet.columns = [
    { header: 'Артикул / SKU (необязательно)', key: 'sku', width: 28 },
    { header: 'Наименование продукции *', key: 'name', width: 45 },
    { header: 'Термическое состояние *', key: 'category', width: 25 },
    { header: 'Срок хранения (дней) *', key: 'shelfLife', width: 22 },
    { header: 'Оповещение за (дней) *', key: 'notifyBefore', width: 22 },
    { header: 'Тип сырья *', key: 'rawMaterial', width: 20 },
    { header: 'Тип фасовки / упаковки *', key: 'packagingType', width: 25 }
  ];

  // Стилизация шапки (Строка 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 32;
  
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' } // Темно-синий премиальный цвет
    };
    cell.font = {
      name: 'Segoe UI',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' } // Белый текст
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });

  // Демонстрационные данные (Строки 2-4)
  const demoData = [
    {
      sku: 'SV-OT-01',
      name: 'Окорок свиной б/к (ЗАМ)',
      category: 'Замороженное',
      shelfLife: 180,
      notifyBefore: 14,
      rawMaterial: 'Свинина',
      packagingType: 'Отруба'
    },
    {
      sku: 'PT-LT-01',
      name: 'Филе грудки ЦБ (ОХЛ)',
      category: 'Охлажденное',
      shelfLife: 12,
      notifyBefore: 3,
      rawMaterial: 'Птица',
      packagingType: 'Лотки'
    },
    {
      sku: '',
      name: 'Блок говяжий жилованный 2 кат (ЗАМ)',
      category: 'Замороженное',
      shelfLife: 240,
      notifyBefore: 14,
      rawMaterial: 'Говядина',
      packagingType: 'Блочка'
    }
  ];

  demoData.forEach((item) => {
    worksheet.addRow([
      item.sku,
      item.name,
      item.category,
      item.shelfLife,
      item.notifyBefore,
      item.rawMaterial,
      item.packagingType
    ]);
  });

  // Настройка Data Validation (Выпадающие списки) и стилей на 500 строк
  const borderStyle = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  const fontStyle = {
    name: 'Segoe UI',
    size: 10,
    color: { argb: 'FF334155' }
  };

  for (let i = 2; i <= 500; i++) {
    const row = worksheet.getRow(i);
    if (i > 4) {
      // Задаем высоту пустых строк для аккуратности
      row.height = 20;
    }

    // Применяем границы и шрифты ко всем ячейкам строки
    for (let col = 1; col <= 7; col++) {
      const cell = row.getCell(col);
      cell.border = borderStyle;
      cell.font = fontStyle;
      
      // Выравнивание по центру для числовых колонок и статусов
      if (col === 1 || col === 3 || col === 4 || col === 5 || col === 6 || col === 7) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    }

    // Столбец C: Термическое состояние (Категория)
    row.getCell(3).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Охлажденное,Замороженное"'],
      showErrorMessage: true,
      errorTitle: 'Неверное значение',
      error: 'Выберите значение из списка (Охлажденное или Замороженное).'
    };

    // Столбец F: Тип сырья
    row.getCell(6).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Свинина,Говядина,Птица,Баранина,Субпродукты,Иное"'],
      showErrorMessage: true,
      errorTitle: 'Неверное значение',
      error: 'Выберите тип сырья из списка.'
    };

    // Столбец G: Тип упаковки / фасовки
    row.getCell(7).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Блочка,Мелкая фасовка,Отруба,Полутуши,Вакуум,Лотки,Иное"'],
      showErrorMessage: true,
      errorTitle: 'Неверное значение',
      error: 'Выберите тип упаковки / фасовки из списка.'
    };
  }

  const outputPath = path.resolve(__dirname, '../шаблон_номенклатура.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log(`\n🎉 Шаблон успешно создан по пути: ${outputPath}`);
}

generate().catch(console.error);
