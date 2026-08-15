/** Распознавание текста с фото (Tesseract.js, rus+eng) */
export async function recognizeImage(file, onProgress) {
  const { data: { text } } = await Tesseract.recognize(file, 'rus+eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  return text;
}

/** Парсинг типичных строк российских бланков анализов */
export function parseLabText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const values = [];
  const seen = new Set();

  const patterns = [
    // Гемоглобин 145 г/л 120-160
    /^(.{2,40}?)\s+([\d]+[.,]?\d*)\s*([a-zA-Z/%µμ²³·\-]+)?(?:\s+([\d]+[.,]?\d*)\s*[-–—]\s*([\d]+[.,]?\d*))?/u,
    // Hb: 14.5
    /^([A-Za-zА-Яа-яёЁ\s\-]+?)[:：]\s*([\d]+[.,]?\d*)\s*([a-zA-Z/%µμ²³·\-]+)?/u,
  ];

  for (const line of lines) {
    if (line.length < 4 || /^(дата|date|пациент|ф\.?и\.?о)/i.test(line)) continue;

    for (const re of patterns) {
      const m = line.match(re);
      if (!m) continue;

      const name = cleanName(m[1]);
      const value = m[2].replace(',', '.');
      const unit = m[3] || '';
      const refMin = m[4]?.replace(',', '.') || '';
      const refMax = m[5]?.replace(',', '.') || '';

      if (!name || name.length < 2) continue;
      const code = normalizeCode(name);
      if (seen.has(code)) continue;
      seen.add(code);

      values.push({ code, name, value, unit, refMin, refMax });
      break;
    }
  }

  return values;
}

function cleanName(s) {
  return s.replace(/[^\wа-яА-ЯёЁ\s\-]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeCode(name) {
  const n = name.toLowerCase();
  const aliases = {
    'гемогlobin': 'HGB', 'гемоглобин': 'HGB', 'hb': 'HGB',
    'эритроциты': 'RBC', 'лейкоциты': 'WBC', 'тромбоциты': 'PLT',
    'соэ': 'ESR', 'глюкоза': 'GLU', 'холестерин': 'CHOL',
    'ферритин': 'FERR', 'креатинин': 'CREA', 'алт': 'ALT', 'аст': 'AST',
    'ттг': 'TSH', 'с-реактивный белок': 'CRP', 'crp': 'CRP',
  };
  for (const [k, v] of Object.entries(aliases)) {
    if (n.includes(k)) return v;
  }
  return name.slice(0, 12).toUpperCase().replace(/\s+/g, '_');
}

export function emptyValueRow() {
  return { code: '', name: '', value: '', unit: '', refMin: '', refMax: '' };
}
