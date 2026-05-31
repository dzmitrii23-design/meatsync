import { AppState } from './types';

export type AiMessage = {
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
};

export function processAiQuery(query: string, state: AppState): string {
  const q = query.trim().toLowerCase();

  // 1. Приветствие и Справка
  if (q.includes('привет') || q.includes('здравствуй') || q.includes('hello') || q.includes('старт') || q.includes('начать')) {
    return 'Приветствую! Я умный ИИ-помощник MeatSync. 🥩\nЯ работаю локально прямо в вашем браузере и знаю всё о наших запасах.\n\n**Вы можете спросить меня:**\n• *«Сколько у нас свинины?»* или другой мясной группы.\n• *«Что лежит в Рефе 3?»* или любой другой камере.\n• *«Что скоро просрочится?»* для контроля качества.\n• *«Сколько всего мяса на складах?»* для общего тоннажа.\n• *«Покажи последние операции»* для быстрой сводки проводок.\n\nВведите ваш вопрос в чат!';
  }

  if (q.includes('помощь') || q.includes('умеешь') || q.includes('справка') || q.includes('команд')) {
    return 'Я умею анализировать наши складские запасы и быстро отвечать на вопросы на обычном русском языке. 📋\n\n**Примеры вопросов:**\n• *«Сколько говядины в блочке?»*\n• *«Покажи остатки в камере шоковой заморозки»*\n• *«Есть ли просрочка?»*\n• *«Последние транзакции»*\n• *«Сколько всего тонн на предприятии?»*';
  }

  // 2. Общие запасы всего мяса
  if (q.includes('сколько всего') || q.includes('общий вес') || q.includes('всего мяса') || q.includes('всего на складе') || q.includes('тоннаж') || q.includes('суммарно')) {
    const activeBatches = state.batches.filter(b => b.locationId !== 'loc_returns_1');
    const total = activeBatches.reduce((sum, b) => sum + b.quantityKg, 0);
    return `На основных складах MeatSync находится **${total.toLocaleString('ru-RU')} кг** готовой продукции (без учета карантина).`;
  }

  // 3. Анализ по группам сырья (🐖 Свинина, 🐂 Говядина, 🐓 Птица, 🐑 Баранина, 👅 Субпродукты)
  let material: string | null = null;
  let emoji = '🥩';
  if (q.includes('свин')) { material = 'Свинина'; emoji = '🐖 Свинина'; }
  else if (q.includes('гов') || q.includes('телят')) { material = 'Говядина'; emoji = '🐂 Говядина'; }
  else if (q.includes('птиц') || q.includes('кур') || q.includes('цып')) { material = 'Птица'; emoji = '🐓 Птица'; }
  else if (q.includes('баран')) { material = 'Баранина'; emoji = '🐑 Баранина'; }
  else if (q.includes('суб') || q.includes('печен') || q.includes('язык') || q.includes('сердц') || q.includes('желуд')) { material = 'Субпродукты'; emoji = '👅 Субпродукты'; }

  if (material) {
    // Ищем ID товаров этой группы
    const matProdIds = state.products
      .filter(p => p.rawMaterial === material)
      .map(p => p.id);
    
    // Ищем активные партии (не в карантине)
    const matBatches = state.batches.filter(b => matProdIds.includes(b.productId) && b.locationId !== 'loc_returns_1');
    const totalWeight = matBatches.reduce((sum, b) => sum + b.quantityKg, 0);
    
    if (totalWeight === 0) {
      return `Запасы сырья категории **${emoji}** на основных складах отсутствуют.`;
    }

    // Детализация веса по камерам хранения
    const locWeights: Record<string, number> = {};
    matBatches.forEach(b => {
      const loc = state.locations.find(l => l.id === b.locationId);
      const name = loc ? loc.name : 'Неизвестный склад';
      locWeights[name] = (locWeights[name] || 0) + b.quantityKg;
    });

    let details = `Суммарный запас сырья **${emoji}** на складах составляет **${totalWeight.toLocaleString('ru-RU')} кг**.\n\n**Распределение по камерам:**`;
    Object.entries(locWeights).forEach(([locName, weight]) => {
      details += `\n• ${locName}: *${weight.toLocaleString('ru-RU')} кг*`;
    });
    return details;
  }

  // 4. Поиск по камерам и складам (Рефы, Шоковая, Холодильники, Карантин)
  let matchedLoc = state.locations.find(l => {
    const nameLower = l.name.toLowerCase();
    
    // Сравнение по названию (например, "реф 1")
    if (q.includes(nameLower)) return true;
    
    // Сравнение коротких фраз (реф1, шок, карантин, брак)
    const digits = nameLower.replace(/[^0-9]/g, '');
    const qDigits = q.replace(/[^0-9]/g, '');
    if (nameLower.includes('реф') && q.includes('реф') && digits && qDigits && digits === qDigits) return true;
    if (q.includes('шок') && nameLower.includes('шок')) return true;
    if ((q.includes('карантин') || q.includes('брак') || q.includes('возврат')) && nameLower.includes('карантин')) return true;
    if (q.includes('охлажден') && nameLower.includes('охлажден')) return true;
    
    return false;
  });

  if (matchedLoc) {
    const locBatches = state.batches.filter(b => b.locationId === matchedLoc.id);
    const totalWeight = locBatches.reduce((sum, b) => sum + b.quantityKg, 0);
    const capacityPercent = Math.round((totalWeight / matchedLoc.capacityKg) * 100);

    if (locBatches.length === 0) {
      return `В локации **«${matchedLoc.name}»** сейчас нет активных партий. Камера пуста. Свободно: *${matchedLoc.capacityKg.toLocaleString('ru-RU')} кг*.`;
    }

    let res = `На складе **«${matchedLoc.name}»** находится **${totalWeight.toLocaleString('ru-RU')} кг** продукции.\nЗаполненность: **${capacityPercent}%** (вместимость: ${matchedLoc.capacityKg.toLocaleString('ru-RU')} кг).\n\n**Содержимое камеры:**`;
    
    // Группировка остатков по названию номенклатуры
    const prodSummary: Record<string, number> = {};
    locBatches.forEach(b => {
      const prod = state.products.find(p => p.id === b.productId);
      const pName = prod ? prod.name : 'Неизвестный товар';
      prodSummary[pName] = (prodSummary[pName] || 0) + b.quantityKg;
    });

    Object.entries(prodSummary).forEach(([pName, weight]) => {
      res += `\n• ${pName} — *${weight.toLocaleString('ru-RU')} кг*`;
    });
    return res;
  }

  // 5. Контроль сроков годности (просрочка, предупреждения, сроки)
  if (q.includes('просроч') || q.includes('истекает') || q.includes('срок') || q.includes('годност')) {
    const nowTime = Date.now();
    const DAY_MS = 86400000;
    
    const expiredBatches = state.batches.filter(b => new Date(b.expiresAt).getTime() < nowTime);
    const warningBatches = state.batches.filter(b => {
      const expiresTime = new Date(b.expiresAt).getTime();
      const diffDays = (expiresTime - nowTime) / DAY_MS;
      const prod = state.products.find(p => p.id === b.productId);
      const threshold = prod?.notifyBeforeDays || 5;
      return expiresTime >= nowTime && diffDays <= threshold;
    });

    if (expiredBatches.length === 0 && warningBatches.length === 0) {
      return '🎉 **Отличные новости!** Просроченных партий или товаров с критическим сроком годности на складах не обнаружено.';
    }

    let report = '';
    if (expiredBatches.length > 0) {
      report += `🚨 **ОБНАРУЖЕНА ПРОСРОЧКА (${expiredBatches.length} шт.):**`;
      expiredBatches.forEach(b => {
        const prod = state.products.find(p => p.id === b.productId);
        const loc = state.locations.find(l => l.id === b.locationId);
        const expDate = new Date(b.expiresAt).toLocaleDateString('ru-RU');
        report += `\n• **${prod ? prod.name : 'Товар'}** (*${b.quantityKg.toLocaleString('ru-RU')} кг*) в *${loc ? loc.name : 'камере'}*. Истек: **${expDate}**`;
      });
    }

    if (warningBatches.length > 0) {
      if (report) report += '\n\n';
      report += `⚠️ **Истекает срок годности (${warningBatches.length} шт.):**`;
      warningBatches.forEach(b => {
        const prod = state.products.find(p => p.id === b.productId);
        const loc = state.locations.find(l => l.id === b.locationId);
        const expDate = new Date(b.expiresAt).toLocaleDateString('ru-RU');
        const diffDays = Math.ceil((new Date(b.expiresAt).getTime() - nowTime) / DAY_MS);
        report += `\n• **${prod ? prod.name : 'Товар'}** (*${b.quantityKg.toLocaleString('ru-RU')} кг*) в *${loc ? loc.name : 'камере'}*. Осталось дней: **${diffDays}** (до ${expDate})`;
      });
    }

    return report;
  }

  // 6. Последние операции в журнале
  if (q.includes('операци') || q.includes('транзакци') || q.includes('журнал') || q.includes('последн') || q.includes('истори')) {
    if (state.transactions.length === 0) {
      return 'В журнале операций пока нет записей о движении продукции.';
    }
    
    const count = q.includes('5') ? 5 : 3;
    const lastTxs = state.transactions.slice(0, count);
    let txReport = `📋 **Последние ${lastTxs.length} операции в журнале:**`;
    
    lastTxs.forEach((tx, idx) => {
      const prod = state.products.find(p => p.id === tx.productId);
      const pName = prod ? prod.name : 'Товар';
      const dateStr = new Date(tx.date).toLocaleDateString('ru-RU');
      
      let typeText = '';
      if (tx.type === 'IN') typeText = '📥 Приход';
      else if (tx.type === 'OUT') typeText = '📤 Отгрузка';
      else if (tx.type === 'MOVE') typeText = '↔️ Перемещение';
      else if (tx.type === 'RETURN') typeText = '🔄 Возврат';

      txReport += `\n\n${idx + 1}. **${typeText}** — *${dateStr}*\n   Товар: **${pName}** (*${tx.quantityKg.toLocaleString('ru-RU')} кг*)\n   *Детали: ${tx.notes || 'нет'}*`;
    });

    return txReport;
  }

  // 7. Ответ по умолчанию
  return 'Я не совсем понял ваш вопрос. 😔\n\nПопробуйте перефразировать его, например:\n• *«Сколько свинины?»*\n• *«Что лежит в Рефе 1?»*\n• *«Покажи просрочку»*\n• *«Что ты умеешь?»* (для вывода справки)';
}
