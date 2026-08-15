/** Голосовой ввод через Web Speech API */
export function createVoiceInput({ onResult, onStatus, lang = 'ru-RU' }) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    return {
      supported: false,
      start() {
        onStatus?.('Голосовой ввод не поддерживается в этом браузере. Используйте Chrome на Android или Safari 17+.');
      },
      stop() {},
    };
  }

  const rec = new SpeechRecognition();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  let active = false;

  rec.onstart = () => {
    active = true;
    onStatus?.('Слушаю…');
  };

  rec.onend = () => {
    active = false;
    onStatus?.('');
  };

  rec.onerror = (e) => {
    active = false;
    onStatus?.(e.error === 'not-allowed' ? 'Разрешите доступ к микрофону' : `Ошибка: ${e.error}`);
  };

  rec.onresult = (e) => {
    const text = e.results[0]?.[0]?.transcript?.trim();
    if (text) onResult?.(text);
  };

  return {
    supported: true,
    get active() { return active; },
    start() {
      if (active) return;
      try { rec.start(); } catch { /* already started */ }
    },
    stop() {
      try { rec.stop(); } catch { /* noop */ }
    },
  };
}
