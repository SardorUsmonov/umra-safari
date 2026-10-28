import { stages, sources } from './checklist-data.js';

const STORAGE_KEY = 'umra-safari:checklist:v1';
const allItems = stages.flatMap(stage => stage.items);
const validIds = new Set(allItems.map(item => item.id));
let checked = new Set();
let activeIndex = 0;
let storageAvailable = true;
const $ = id => document.getElementById(id);
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved?.version === 1) {
    checked = new Set(Array.isArray(saved.checkedIds) ? saved.checkedIds.filter(id => validIds.has(id)) : []);
    const index = stages.findIndex(stage => stage.id === saved.activeStage);
    if (index >= 0) activeIndex = index;
  }
} catch { storageAvailable = false; }

function updateStorageNote() {
  const note = $('save-note');
  note.classList.toggle('storage-error', !storageAvailable);
  note.querySelector('span').textContent = storageAvailable
    ? 'Belgilar shu brauzerda avtomatik saqlanadi.'
    : 'Bu brauzerda belgilarni saqlab bo‘lmadi. Sahifa yopilganda belgilar yo‘qolishi mumkin.';
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, checkedIds: [...checked], activeStage: stages[activeIndex].id }));
    storageAvailable = true;
  } catch { storageAvailable = false; }
  updateStorageNote();
}

$('stage-nav').innerHTML = stages.map(stage => `
  <button type="button" class="stage-tab" role="tab" id="stage-tab-${stage.id}" data-stage="${stage.id}" aria-controls="checklist-panel" aria-selected="false" tabindex="-1">
    <span class="stage-num">${stage.number}</span><span class="stage-text"><strong>${escapeHTML(stage.shortTitle)}</strong><small data-nav-count="${stage.id}">0 / ${stage.items.length} band</small></span><span class="stage-arrow" aria-hidden="true">↗</span>
  </button>`).join('');

function updateProgress(announce = false) {
  const total = checked.size;
  const percent = Math.round(total / allItems.length * 100);
  $('overall-count').innerHTML = `${total}<span>/ ${allItems.length}</span>`;
  $('overall-percent').textContent = `${percent}%`;
  $('overall-fill').style.width = `${percent}%`;
  $('overall-progress').setAttribute('aria-valuenow', String(total));
  $('overall-message').textContent = total === allItems.length
    ? 'Barcha bandlar belgilandi. Safaringiz xayrli bo‘lsin!'
    : total === 0 ? 'Har bir belgi — tayyorgarlikka bir qadam.' : `${allItems.length - total} band qoldi. Bir qadamdan davom eting.`;
  stages.forEach(stage => {
    const done = stage.items.filter(item => checked.has(item.id)).length;
    const button = $(`stage-tab-${stage.id}`);
    button.classList.toggle('is-complete', done === stage.items.length);
    button.querySelector('.stage-num').textContent = done === stage.items.length ? '✓' : stage.number;
    button.querySelector('[data-nav-count]').textContent = `${done} / ${stage.items.length} band`;
  });
  const stage = stages[activeIndex];
  const done = stage.items.filter(item => checked.has(item.id)).length;
  $('stage-count').textContent = `${done} / ${stage.items.length}`;
  $('stage-status').textContent = done === stage.items.length ? 'Bu bosqichdagi barcha bandlar belgilandi.' : `${stage.items.length - done} band qoldi`;
  $('item-list').querySelectorAll('input[data-item]').forEach(input => {
    input.checked = checked.has(input.dataset.item);
    input.closest('.check-item').classList.toggle('is-checked', input.checked);
  });
  if (announce) $('live-status').textContent = `Jami ${allItems.length} banddan ${total} tasi belgilandi. ${stage.title}: ${done} / ${stage.items.length}.`;
}

function selectStage(index, { save = true, focus = false, reveal = false } = {}) {
  if (index < 0 || index >= stages.length) return;
  activeIndex = index;
  const stage = stages[index];
  stages.forEach((candidate, i) => {
    const button = $(`stage-tab-${candidate.id}`);
    button.setAttribute('aria-selected', String(i === index));
    button.tabIndex = i === index ? 0 : -1;
  });
  $('checklist-panel').setAttribute('aria-labelledby', `stage-tab-${stage.id}`);
  $('panel-eyebrow').textContent = `${stage.number} / ${stage.eyebrow.toLocaleUpperCase('uz')}`;
  $('panel-title').textContent = stage.title;
  $('panel-description').textContent = stage.description;
  $('item-list').innerHTML = stage.items.map(item => `
    <label class="check-item${checked.has(item.id) ? ' is-checked' : ''}" for="item-${item.id}">
      <input id="item-${item.id}" type="checkbox" data-item="${item.id}" ${checked.has(item.id) ? 'checked' : ''}>
      <span class="item-copy"><span class="item-title">${escapeHTML(item.title)}</span>${item.detail ? `<span class="item-detail">${escapeHTML(item.detail)}</span>` : ''}</span>
    </label>`).join('');
  $('previous-stage').disabled = index === 0;
  $('next-stage').disabled = index === stages.length - 1;
  updateProgress();
  if (save) persist();
  if (focus) $(`stage-tab-${stage.id}`).focus({ preventScroll: true });
  revealActiveTab(stage);
  if (reveal) revealPanel();
}

const scrollBehavior = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

// On phones the stage tabs sit in a horizontally scrolling row; keep the active one in view.
function revealActiveTab(stage) {
  const nav = $('stage-nav');
  if (nav.scrollWidth <= nav.clientWidth + 1) return;
  const tab = $(`stage-tab-${stage.id}`);
  const offset = tab.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
  const left = Math.max(0, Math.min(offset - (nav.clientWidth - tab.offsetWidth) / 2, nav.scrollWidth - nav.clientWidth));
  nav.scrollTo({ left, behavior: scrollBehavior() });
}

// After "Keyingi bosqich" on a phone the new stage's heading is above the viewport; bring it back.
function revealPanel() {
  const top = $('checklist-panel').getBoundingClientRect().top;
  if (top < 0 || top > window.innerHeight * 0.6) $('checklist-panel').scrollIntoView({ block: 'start', behavior: scrollBehavior() });
}

$('stage-nav').addEventListener('click', event => {
  const button = event.target.closest('[data-stage]');
  if (button) selectStage(stages.findIndex(stage => stage.id === button.dataset.stage), { reveal: true });
});
$('stage-nav').addEventListener('keydown', event => {
  if (!event.target.matches('[role="tab"]')) return;
  let next = activeIndex;
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (activeIndex + 1) % stages.length;
  else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (activeIndex + stages.length - 1) % stages.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = stages.length - 1;
  else return;
  event.preventDefault();
  selectStage(next, { focus: true });
});
$('item-list').addEventListener('change', event => {
  const input = event.target;
  if (!input.matches('input[data-item]')) return;
  if (input.checked) checked.add(input.dataset.item);
  else checked.delete(input.dataset.item);
  updateProgress(true);
  persist();
});
$('previous-stage').addEventListener('click', () => selectStage(activeIndex - 1, { reveal: true }));
$('next-stage').addEventListener('click', () => selectStage(activeIndex + 1, { reveal: true }));

window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  try {
    const saved = JSON.parse(event.newValue || 'null');
    checked = new Set(saved?.version === 1 && Array.isArray(saved.checkedIds) ? saved.checkedIds.filter(id => validIds.has(id)) : []);
    updateProgress(true);
  } catch { /* Keep the current checklist when another tab has invalid data. */ }
});

$('source-links').innerHTML = sources.map(source => `<a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.title)} ↗</a>`).join('');
$('print-sheet').innerHTML = `<h1>Umra safari</h1><p class="print-intro">Bir sahifalik cheklist / 5 bosqich / 25 band</p><div class="print-columns">${stages.map(stage => `<section class="print-section"><h2>${stage.number} / ${escapeHTML(stage.title)}</h2>${stage.items.map(item => `<div class="print-item"><span class="print-box"></span><strong>${escapeHTML(item.title)}</strong>${item.detail ? `<small>${escapeHTML(item.detail)}</small>` : ''}</div>`).join('')}</section>`).join('')}</div><p class="print-footer">Viza, ruxsat va tibbiy talablarni safar oldidan qayta tekshiring. Manbalar: Nusuk, Haramayn, Saudiya SSV.</p>`;
selectStage(activeIndex, { save: false });
updateStorageNote();
