export const STANDARD_STEPS = [
  { name: 'ヒアリング', type: 'internal', weight: 0.8 },
  { name: '仕様（サイトマップ・見積もり）', type: 'internal', weight: 1.2 },
  { name: 'ワイヤー制作', type: 'internal', weight: 1.5, wire: true },
  { name: 'ワイヤー確認', type: 'client', weight: 0.7, wire: true },
  { name: 'デザイン制作', type: 'internal', weight: 3 },
  { name: 'デザイン確認', type: 'client', weight: 0.8 },
  { name: 'コーディング', type: 'internal', weight: 3 },
  { name: '確認・修正', type: 'client', weight: 1.4 },
  { name: '公開前チェック', type: 'internal', weight: 0.8 },
];

function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

export function businessDaysBefore(startDate, deliveryDate) {
  const days = [];
  let cursor = parseDate(startDate);
  const delivery = parseDate(deliveryDate);
  while (cursor < delivery) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(iso(cursor));
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return days.length ? days : [startDate];
}

export function createStandardTasks(startDate, deliveryDate, includeWire = true, makeId = () => crypto.randomUUID()) {
  const steps = STANDARD_STEPS.filter(step => includeWire || !step.wire);
  const days = businessDaysBefore(startDate, deliveryDate);
  const totalWeight = steps.reduce((sum, step) => sum + step.weight, 0);
  let consumedWeight = 0;
  const tasks = steps.map(step => {
    const startIndex = Math.min(days.length - 1, Math.floor(consumedWeight / totalWeight * days.length));
    consumedWeight += step.weight;
    const nextIndex = Math.floor(consumedWeight / totalWeight * days.length);
    const endIndex = Math.min(days.length - 1, Math.max(startIndex, nextIndex - 1));
    return { id: makeId(), name: step.name, startDate: days[startIndex], endDate: days[endIndex], type: step.type };
  });
  tasks.push({ id: makeId(), name: '公開', startDate: deliveryDate, endDate: deliveryDate, type: 'milestone' });
  return tasks;
}

export function dateLabel(value) {
  const date = parseDate(value);
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}
