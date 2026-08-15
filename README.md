# Моё здоровье — личный трекер анализов

PWA для смартфона: фото анализов, голосовой ввод, графики динамики, чат с AI (Gemini).

**Только для личного использования.** Данные хранятся на вашем телефоне (IndexedDB), не на сервере.

---

## Что умеет

- 📷 **Камера / галерея** — OCR бланка (Tesseract.js, rus+eng)
- 🎤 **Микрофон** — голосовые вопросы в чат (Chrome/Android, Safari 17+)
- 📊 **Графики** — динамика любого показателя
- 💬 **Чат** — анализ трендов с учётом мед. образования (Google Gemini, бесплатный tier)
- 💾 **Экспорт/импорт JSON** — резервная копия

---

## Где разместить бесплатно (рекомендация)

| Сервис | Стоимость | Плюсы |
|--------|-----------|--------|
| **[GitHub Pages](https://pages.github.com/)** | **0 ₽** | Просто, HTTPS, PWA работает |
| **[Cloudflare Pages](https://pages.cloudflare.com/)** | **0 ₽** | Быстрый CDN, свой домен |

Оба варианта хостят **только статические файлы** — без сервера, без ежемесячной платы.

> **LLM:** для чата нужен бесплатный ключ [Google AI Studio](https://aistudio.google.com/apikey) (Gemini Flash). Ключ хранится только в localStorage вашего телефона.

---

## Быстрый старт: GitHub Pages

### 1. Создайте репозиторий на GitHub

```bash
cd ~/Projects/personal-health
git add .
git commit -m "Initial personal health tracker PWA"
```

Создайте **приватный** репозиторий на github.com (рекомендуется для медданных в коде не хранятся, но приватность логична).

```bash
git remote add origin git@github.com:ВАШ_ЛОГИН/personal-health.git
git push -u origin main
```

### 2. Включите Pages

GitHub → **Settings** → **Pages** → Source: **Deploy from branch** → branch `main`, folder `/ (root)` → Save.

Через 1–2 минуты сайт будет по адресу:

`https://ВАШ_ЛОГИН.github.io/personal-health/`

### 3. Установите на телефон

1. Откройте URL в **Chrome** (Android) или **Safari** (iPhone).
2. **Android:** меню → «Установить приложение» / «Добавить на главный экран».
3. **iPhone:** Поделиться → «На экран Домой».

---

## Альтернатива: Cloudflare Pages

1. Зарегистрируйтесь на [cloudflare.com](https://dash.cloudflare.com/sign-up).
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → выберите репозиторий.
3. Build settings: **None** (статический сайт, без сборки).
4. Deploy.

---

## Локальный просмотр (на Mac)

```bash
cd ~/Projects/personal-health
python3 -m http.server 8080
```

Откройте `http://localhost:8080` (камера/микрофон на localhost работают).

---

## Настройка AI

1. Откройте [Google AI Studio → API Keys](https://aistudio.google.com/apikey).
2. Создайте ключ (бесплатная квота Gemini Flash).
3. В приложении: **Ещё** → вставьте ключ → **Сохранить**.

Данные анализов в Google уходят **только когда вы пишете в чат** — для OCR используется локальный Tesseract в браузере.

---

## Конфиденциальность

- Анализы: **IndexedDB** на устройстве.
- API-ключ: **localStorage** на устройстве.
- Нет аккаунтов, нет облачной БД.
- Делайте **экспорт JSON** периодически как бэкап.

---

## Ограничения

- OCR зависит от качества фото — всегда проверяйте распознанные значения.
- Голосовой ввод: лучше всего Chrome на Android; в iOS Safari поддержка ограничена.
- Gemini free tier имеет лимиты запросов в сутки.
