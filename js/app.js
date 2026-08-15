import {
  getAllRecords, saveRecord, clearAllRecords, exportData, importData,
  collectMetrics, metricSeries, uuid,
} from './db.js';
import { renderTrendChart } from './charts.js';
import { recognizeImage, parseLabText, emptyValueRow } from './ocr.js';
import { createVoiceInput } from './voice.js';
import { askGemini, QUICK_PROMPTS } from './chat.js';

const STORAGE_KEY = 'personal-health-settings';

let records = [];
let draftValues = [];
let selectedMetric = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

async function init() {
  registerServiceWorker();
  bindNavigation();
  bindAddLab();
  bindChat();
  bindSettings();
  setDefaultDate();
  await refreshRecords();
  showQuickPrompts();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function bindNavigation() {
  $$('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      $$('.nav-btn').forEach((b) => b.classList.toggle('active', b === btn));
      $$('.view').forEach((v) => v.classList.remove('active'));
      $(`#view-${view}`).classList.add('active');
      if (view === 'dashboard') renderDashboard();
    });
  });
}

function setDefaultDate() {
  $('#lab-date').value = new Date().toISOString().slice(0, 10);
}

async function refreshRecords() {
  records = await getAllRecords();
  renderDashboard();
}

function renderDashboard() {
  renderMetricPicker();
  renderRecentRecords();
  renderChart();
}

function renderMetricPicker() {
  const el = $('#metric-picker');
  const metrics = collectMetrics(records);
  if (!metrics.length) {
    el.innerHTML = '<p class="hint">Нет показателей для графика.</p>';
    selectedMetric = null;
    return;
  }
  if (!selectedMetric || !metrics.find((m) => m.code === selectedMetric)) {
    selectedMetric = metrics[0].code;
  }
  el.innerHTML = metrics.map((m) =>
    `<button type="button" class="chip ${m.code === selectedMetric ? 'active' : ''}" data-metric="${escapeAttr(m.code)}">${escapeHtml(m.name)}</button>`
  ).join('');
  el.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      selectedMetric = chip.dataset.metric;
      renderMetricPicker();
      renderChart();
    });
  });
}

function renderChart() {
  const canvas = $('#trend-chart');
  const empty = $('#chart-empty');
  if (!selectedMetric) {
    empty.classList.remove('hidden');
    canvas.classList.add('hidden');
    return;
  }
  const points = metricSeries(records, selectedMetric);
  if (!points.length) {
    empty.classList.remove('hidden');
    canvas.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  canvas.classList.remove('hidden');
  const metric = collectMetrics(records).find((m) => m.code === selectedMetric);
  renderTrendChart(canvas, points, metric?.name || selectedMetric, points[0]?.unit || metric?.unit);
}

function renderRecentRecords() {
  const el = $('#recent-records');
  if (!records.length) {
    el.innerHTML = '<p class="hint">Записей пока нет. Добавьте первый анализ.</p>';
    return;
  }
  el.innerHTML = records.slice(0, 8).map((r) => {
    const vals = (r.values || []).slice(0, 5).map((v) => `${v.name || v.code}: ${v.value}${v.unit ? ' ' + v.unit : ''}`).join(' · ');
    const more = (r.values?.length || 0) > 5 ? ` (+${r.values.length - 5})` : '';
    return `<div class="record-item">
      <div class="record-date">${formatDate(r.date)}</div>
      <div class="record-values">${escapeHtml(vals)}${more}</div>
      ${r.notes ? `<div class="record-values">${escapeHtml(r.notes)}</div>` : ''}
    </div>`;
  }).join('');
}

function bindAddLab() {
  draftValues = [emptyValueRow()];
  renderDraftValues();

  $('#add-value-btn').addEventListener('click', () => {
    draftValues.push(emptyValueRow());
    renderDraftValues();
  });

  $('#save-lab-btn').addEventListener('click', saveLab);

  $('#photo-input').addEventListener('change', (e) => handlePhoto(e.target.files[0]));
  $('#gallery-btn').addEventListener('click', () => $('#gallery-input').click());
  $('#gallery-input').addEventListener('change', (e) => handlePhoto(e.target.files[0]));
}

async function handlePhoto(file) {
  if (!file) return;
  const status = $('#ocr-status');
  const preview = $('#photo-preview');
  preview.src = URL.createObjectURL(file);
  preview.classList.remove('hidden');
  status.textContent = 'Распознавание текста… 0%';

  try {
    const text = await recognizeImage(file, (pct) => {
      status.textContent = `Распознавание текста… ${pct}%`;
    });
    const parsed = parseLabText(text);
    if (parsed.length) {
      draftValues = parsed;
      renderDraftValues();
      status.textContent = `Найдено показателей: ${parsed.length}. Проверьте и сохраните.`;
    } else {
      status.textContent = 'Не удалось извлечь показатели. Добавьте вручную или переснимите при лучшем свете.';
    }
  } catch (err) {
    status.textContent = `Ошибка OCR: ${err.message}`;
  }
}

function renderDraftValues() {
  const el = $('#parsed-values');
  el.innerHTML = draftValues.map((v, i) => valueRowHtml(v, i)).join('');
  el.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      draftValues.splice(Number(btn.dataset.remove), 1);
      if (!draftValues.length) draftValues.push(emptyValueRow());
      renderDraftValues();
    });
  });
  el.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      const idx = Number(input.dataset.idx);
      const field = input.dataset.field;
      draftValues[idx][field] = input.value;
    });
  });
}

function valueRowHtml(v, i) {
  return `<div class="value-row">
    <input class="span-2" data-idx="${i}" data-field="name" placeholder="Название" value="${escapeAttr(v.name)}">
    <input data-idx="${i}" data-field="code" placeholder="Код" value="${escapeAttr(v.code)}">
    <input data-idx="${i}" data-field="value" placeholder="Знач." value="${escapeAttr(v.value)}">
    <input data-idx="${i}" data-field="unit" placeholder="Ед." value="${escapeAttr(v.unit)}">
    <input data-idx="${i}" data-field="refMin" placeholder="мин" value="${escapeAttr(v.refMin)}">
    <input data-idx="${i}" data-field="refMax" placeholder="макс" value="${escapeAttr(v.refMax)}">
    <button type="button" data-remove="${i}" title="Удалить">✕</button>
  </div>`;
}

async function saveLab() {
  const date = $('#lab-date').value;
  const notes = $('#lab-notes').value.trim();
  const values = draftValues.filter((v) => v.name && v.value);

  if (!date) return alert('Укажите дату');
  if (!values.length) return alert('Добавьте хотя бы один показатель');

  await saveRecord({ id: uuid(), date, notes, values, createdAt: new Date().toISOString() });

  draftValues = [emptyValueRow()];
  $('#lab-notes').value = '';
  $('#photo-preview').classList.add('hidden');
  $('#ocr-status').textContent = 'Сохранено.';
  renderDraftValues();
  await refreshRecords();

  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === 'dashboard'));
  $$('.view').forEach((v) => v.classList.remove('active'));
  $('#view-dashboard').classList.add('active');
}

function bindChat() {
  const input = $('#chat-input');
  const voiceBtn = $('#voice-btn');
  const voiceStatus = $('#voice-status');

  const voice = createVoiceInput({
    onResult: (text) => { input.value = (input.value ? input.value + ' ' : '') + text; },
    onStatus: (s) => { voiceStatus.textContent = s; },
  });

  voiceBtn.addEventListener('click', () => {
    if (!voice.supported) { voice.start(); return; }
    if (voice.active) {
      voice.stop();
      voiceBtn.classList.remove('recording');
    } else {
      voice.start();
      voiceBtn.classList.add('recording');
    }
  });

  $('#send-btn').addEventListener('click', () => sendChat());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });
}

function showQuickPrompts() {
  const box = $('#chat-messages');
  if (box.childElementCount) return;
  appendMsg('system', 'Быстрые запросы:');
  QUICK_PROMPTS.forEach((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = p;
    btn.style.margin = '0.25rem';
    btn.addEventListener('click', () => {
      $('#chat-input').value = p;
      sendChat();
    });
    box.appendChild(btn);
  });
}

async function sendChat() {
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text) return;

  const settings = loadSettings();
  input.value = '';
  appendMsg('user', text);
  appendMsg('assistant', '…');

  try {
    const reply = await askGemini(settings.apiKey, text, records);
    replaceLastAssistant(reply);
  } catch (err) {
    replaceLastAssistant(`⚠️ ${err.message}`);
  }
}

function appendMsg(role, text) {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.textContent = text;
  $('#chat-messages').appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function replaceLastAssistant(text) {
  const msgs = $$('#chat-messages .msg.assistant');
  const last = msgs[msgs.length - 1];
  if (last) last.textContent = text;
}

function bindSettings() {
  const settings = loadSettings();
  $('#api-key').value = settings.apiKey || '';

  $('#save-settings-btn').addEventListener('click', () => {
    saveSettings({ apiKey: $('#api-key').value.trim() });
    alert('Сохранено на этом устройстве.');
  });

  $('#export-btn').addEventListener('click', async () => {
    const data = await exportData();
    downloadJson(data, `health-export-${new Date().toISOString().slice(0, 10)}.json`);
  });

  $('#import-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importData(JSON.parse(text));
      await refreshRecords();
      alert('Импорт завершён.');
    } catch (err) {
      alert(`Ошибка импорта: ${err.message}`);
    }
    e.target.value = '';
  });

  $('#clear-btn').addEventListener('click', async () => {
    if (!confirm('Удалить все записи и историю чата на этом устройстве?')) return;
    await clearAllRecords();
    $('#chat-messages').innerHTML = '';
    showQuickPrompts();
    await refreshRecords();
  });
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveSettings(obj) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSettings(), ...obj }));
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}

init();
