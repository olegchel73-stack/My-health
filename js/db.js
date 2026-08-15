const DB_NAME = 'personal-health';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('records')) {
        const store = db.createObjectStore('records', { keyPath: 'id' });
        store.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('chat')) {
        db.createObjectStore('chat', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

export async function getAllRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readonly');
    const req = tx.objectStore('records').getAll();
    req.onsuccess = () => {
      const records = req.result.sort((a, b) => b.date.localeCompare(a.date));
      resolve(records);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecord(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    tx.objectStore('records').put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteRecord(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    tx.objectStore('records').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['records', 'chat'], 'readwrite');
    tx.objectStore('records').clear();
    tx.objectStore('chat').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function exportData() {
  const records = await getAllRecords();
  return { version: 1, exportedAt: new Date().toISOString(), records };
}

export async function importData(data) {
  if (!data?.records?.length) throw new Error('Неверный формат файла');
  for (const record of data.records) {
    await saveRecord(record);
  }
}

export function uuid() {
  return crypto.randomUUID();
}

/** Собрать все уникальные показатели для графиков */
export function collectMetrics(records) {
  const map = new Map();
  for (const rec of records) {
    for (const v of rec.values || []) {
      const key = v.code || v.name;
      if (!key || v.value == null || v.value === '') continue;
      if (!map.has(key)) {
        map.set(key, { code: key, name: v.name || key, unit: v.unit || '' });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

/** Точки для графика одного показателя */
export function metricSeries(records, metricKey) {
  const points = [];
  for (const rec of records) {
    for (const v of rec.values || []) {
      const key = v.code || v.name;
      if (key !== metricKey) continue;
      const num = parseFloat(String(v.value).replace(',', '.'));
      if (Number.isNaN(num)) continue;
      points.push({ date: rec.date, value: num, unit: v.unit || '' });
    }
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}
