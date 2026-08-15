const SYSTEM_PROMPT = `Ты — личный медицинский ассистент для врача, который отслеживает СВОЁ здоровье.

Контекст:
- Пользователь имеет медицинское образование; можно использовать клиническую терминологию.
- Это личное самонаблюдение, не практика на пациентах.
- Тебе передаётся история анализов в JSON.

Задачи:
1. Анализировать динамику показателей во времени.
2. Отмечать клинически значимые отклонения и возможные направления (дифф. диагноз как гипотезы).
3. Предлагать разумное дообследование и на что обратить внимание.
4. Ссылаться на общепринятые клинические ориентиры, когда уместно.

Ограничения:
- Не назначай конкретную терапию и дозировки — только «обсудить с лечащим врачом» или «в рамках гайдлайнов X…».
- При признаках неотложного состояния — рекомендуй очную помощь.
- Будь кратким и структурированным: пункты, таблицы при необходимости.
- Отвечай на русском.`;

export async function askGemini(apiKey, userMessage, records) {
  if (!apiKey?.trim()) {
    throw new Error('Добавьте ключ Gemini API в настройках (бесплатно в Google AI Studio).');
  }

  const context = buildContext(records);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{
      role: 'user',
      parts: [{ text: `${context}\n\n---\nВопрос пользователя:\n${userMessage}` }],
    }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) throw new Error('Лимит бесплатного API. Подождите или проверьте квоту в Google AI Studio.');
    if (res.status === 400 && err.includes('API key')) throw new Error('Неверный API-ключ. Проверьте настройки.');
    throw new Error(`Gemini API: ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Пустой ответ от модели');
  return text;
}

function buildContext(records) {
  if (!records?.length) {
    return 'История анализов пока пуста.';
  }

  const slim = records.slice(0, 50).map((r) => ({
    date: r.date,
    notes: r.notes || '',
    values: (r.values || []).map((v) => ({
      code: v.code,
      name: v.name,
      value: v.value,
      unit: v.unit,
      ref: v.refMin && v.refMax ? `${v.refMin}-${v.refMax}` : undefined,
    })),
  }));

  return `История анализов (JSON, до 50 записей, новые первыми):\n${JSON.stringify(slim, null, 2)}`;
}

export const QUICK_PROMPTS = [
  'Сводка по последним анализам',
  'Какие показатели ухудшились за последний год?',
  'Что дообследовать в первую очередь?',
];
