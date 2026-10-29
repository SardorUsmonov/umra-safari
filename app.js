import { stages, sources } from './checklist-data.js?v=6';
import {
  STORAGE_KEY, PREFS_KEY, TAWAF_ROUNDS, MAX_CUSTOM_PER_STAGE,
  emptyState, parseState, serializeState, parsePrefs,
  normalizeTitle, createCustomItem, tripPlan, todayISO, clampTawaf,
  routeFromHash, nextTasks,
} from './logic.js?v=6';

const $ = id => document.getElementById(id);
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const scrollBehavior = () => (reducedMotion.matches ? 'auto' : 'smooth');

// ---------------------------------------------------------------- holat va saqlash

let storageAvailable = true;
let state = emptyState(stages);
try { state = parseState(localStorage.getItem(STORAGE_KEY), stages); } catch { storageAvailable = false; }
let activeIndex = Math.max(0, stages.findIndex(stage => stage.id === state.activeStage));

const itemsOf = stage => [...stage.items, ...(state.custom[stage.id] || [])];
const allItems = () => stages.flatMap(itemsOf);
const doneIn = stage => itemsOf(stage).filter(item => state.checked.has(item.id)).length;
const findItem = id => allItems().find(item => item.id === id);

function updateStorageNote() {
  const note = $('save-note');
  note.classList.toggle('storage-error', !storageAvailable);
  note.querySelector('span').textContent = storageAvailable
    ? 'Belgilar shu brauzerda avtomatik saqlanadi.'
    : 'Bu brauzerda belgilarni saqlab bo‘lmadi. Sahifa yopilganda belgilar yo‘qolishi mumkin.';
}

function persist() {
  state.activeStage = stages[activeIndex].id;
  try {
    localStorage.setItem(STORAGE_KEY, serializeState(state));
    storageAvailable = true;
  } catch { storageAvailable = false; }
  updateStorageNote();
}

const announce = text => { $('live-status').textContent = text; };

// ---------------------------------------------------------------- xabar (toast)

function showToast(text, action) {
  let toast = $('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = '<span class="toast-text"></span><button type="button" class="toast-action" hidden></button>';
    document.body.append(toast);
  }
  const button = toast.querySelector('.toast-action');
  toast.querySelector('.toast-text').textContent = text;
  button.hidden = !action;
  toast.classList.toggle('has-action', Boolean(action));
  button.onclick = null;
  if (action) {
    button.textContent = action.label;
    button.onclick = () => { toast.classList.remove('is-visible'); action.onClick(); };
  }
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), action ? 9000 : 6000);
}

// ---------------------------------------------------------------- bo'limlar (Bugun, Cheklist, Tavof, Amallar)

const BASE_TITLE = document.title;
const VIEW_TITLES = { checklist: 'Cheklist', tawaf: 'Tavof hisoblagichi', guide: 'Umra amallari' };
let currentView = routeFromHash(location.hash);

function showView(view, { focus = false } = {}) {
  currentView = view;
  root.dataset.view = view;
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = view === 'today' ? BASE_TITLE : `${VIEW_TITLES[view]} — Umra safari`;
  window.scrollTo({ top: 0, behavior: 'auto' });
  if (focus) $(`${view}-title`)?.focus({ preventScroll: true });
  if (view === 'checklist') revealActiveTab(stages[activeIndex]);
}

/** Bo'limga o'tadi. Manzil o'zgargani uchun telefondagi "orqaga" tugmasi ham ishlaydi. */
function go(view) {
  if (location.hash && routeFromHash(location.hash) === view) showView(view, { focus: true });
  else location.hash = view;
}

window.addEventListener('hashchange', () => showView(routeFromHash(location.hash), { focus: true }));
// Ochiq bo'lim tugmasi qayta bosilsa hashchange bo'lmaydi; bo'lim boshiga qaytaramiz.
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || link.classList.contains('skip-link')) return;
  if (link.getAttribute('href') === location.hash) {
    event.preventDefault();
    showView(currentView, { focus: true });
  }
});
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  $('main').focus();
});

const header = document.querySelector('.app-header');
const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 4);
window.addEventListener('scroll', onScroll, { passive: true });

// ---------------------------------------------------------------- cheklist

$('stage-nav').innerHTML = stages.map(stage => `
  <button type="button" class="stage-tab" role="tab" id="stage-tab-${stage.id}" data-stage="${stage.id}" aria-controls="checklist-panel" aria-selected="false" tabindex="-1">
    <span class="stage-num">${stage.number}</span><span class="stage-text"><strong>${escapeHTML(stage.shortTitle)}<span class="stage-now" hidden>Hozir</span></strong><small data-nav-count="${stage.id}">0 / ${stage.items.length} band</small></span>
  </button>`).join('');

const trashIcon = '<svg class="icon small" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const itemCopy = item => `<span class="item-title">${escapeHTML(item.title)}</span>${item.detail ? `<span class="item-detail">${escapeHTML(item.detail)}</span>` : ''}`;

function renderItem(item) {
  const isChecked = state.checked.has(item.id);
  const input = `<input class="check-box" id="item-${item.id}" type="checkbox" data-item="${item.id}"${isChecked ? ' checked' : ''}>`;
  if (!item.custom) {
    return `<label class="check-item${isChecked ? ' is-checked' : ''}" for="item-${item.id}">${input}<span class="item-copy">${itemCopy(item)}</span></label>`;
  }
  return `<div class="check-item is-custom${isChecked ? ' is-checked' : ''}">${input}<label class="item-copy" for="item-${item.id}"><span class="item-title">${escapeHTML(item.title)}</span><span class="item-tag">Siz qo‘shgan band</span></label><button type="button" class="item-delete" data-delete="${item.id}" aria-label="${escapeHTML(`«${item.title}» bandini o‘chirish`)}" title="O‘chirish">${trashIcon}</button></div>`;
}

function renderItems() {
  $('item-list').innerHTML = itemsOf(stages[activeIndex]).map(renderItem).join('');
}

function updateProgress(shouldAnnounce = false, { keepNext = false } = {}) {
  const items = allItems();
  const total = items.filter(item => state.checked.has(item.id)).length;
  const percent = items.length ? Math.round(total / items.length * 100) : 0;
  $('overall-count').innerHTML = `${total}<span>/ ${items.length}</span>`;
  $('overall-percent').textContent = `${percent}%`;
  $('overall-fill').style.width = `${percent}%`;
  $('overall-progress').setAttribute('aria-valuemax', String(items.length));
  $('overall-progress').setAttribute('aria-valuenow', String(total));
  $('overall-message').textContent = total === items.length
    ? 'Hammasi belgilandi. Safaringiz xayrli bo‘lsin!'
    : total === 0 ? 'Hali hech narsa belgilanmagan.' : `${items.length - total} band qoldi.`;
  stages.forEach(stage => {
    const count = itemsOf(stage).length;
    const done = doneIn(stage);
    const button = $(`stage-tab-${stage.id}`);
    button.classList.toggle('is-complete', done === count);
    button.querySelector('.stage-num').textContent = done === count ? '✓' : stage.number;
    button.querySelector('[data-nav-count]').textContent = `${done} / ${count} band`;
  });
  const stage = stages[activeIndex];
  const count = itemsOf(stage).length;
  const done = doneIn(stage);
  $('stage-count').textContent = `${done} / ${count}`;
  $('stage-fill').style.width = `${count ? Math.round(done / count * 100) : 0}%`;
  $('stage-status').textContent = done === count ? 'Bu bosqichdagi barcha bandlar belgilandi.' : `${count - done} band qoldi`;
  $('item-list').querySelectorAll('input[data-item]').forEach(input => {
    input.checked = state.checked.has(input.dataset.item);
    input.closest('.check-item').classList.toggle('is-checked', input.checked);
  });
  if (shouldAnnounce) announce(`Jami ${items.length} banddan ${total} tasi belgilandi. ${stage.title}: ${done} / ${count}.`);
  renderTrip();
  renderSummary();
  if (!keepNext) renderNext();
  renderTawaf();
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
  $('panel-eyebrow').textContent = `${Number(stage.number)}-bosqich · ${stage.eyebrow}`;
  $('panel-title').textContent = stage.title;
  $('panel-description').textContent = stage.description;
  renderItems();
  hideCustomError();
  $('previous-stage').disabled = index === 0;
  $('next-stage').disabled = index === stages.length - 1;
  updateProgress();
  if (save) persist();
  if (focus) $(`stage-tab-${stage.id}`).focus({ preventScroll: true });
  revealActiveTab(stage);
  if (reveal) revealPanel();
}

/** Bosqichni tanlab, Cheklist bo'limini ochadi. */
function openStage(stageId) {
  const index = stages.findIndex(stage => stage.id === stageId);
  if (index >= 0) selectStage(index);
  go('checklist');
}

// Bosqich tugmalari gorizontal qatorda; faol tugmani ko'rinadigan joyga suramiz.
function revealActiveTab(stage) {
  const nav = $('stage-nav');
  if (nav.scrollWidth <= nav.clientWidth + 1) return;
  const tab = $(`stage-tab-${stage.id}`);
  const offset = tab.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
  const left = Math.max(0, Math.min(offset - (nav.clientWidth - tab.offsetWidth) / 2, nav.scrollWidth - nav.clientWidth));
  nav.scrollTo({ left, behavior: scrollBehavior() });
}

// "Keyingi bosqich"dan keyin yangi bosqich sarlavhasi ekrandan yuqorida qolsa, uni qaytaramiz.
function revealPanel() {
  const top = $('checklist-panel').getBoundingClientRect().top;
  if (top < 60 || top > window.innerHeight * 0.6) $('checklist-panel').scrollIntoView({ block: 'start', behavior: scrollBehavior() });
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
  if (input.checked) state.checked.add(input.dataset.item);
  else state.checked.delete(input.dataset.item);
  updateProgress(true);
  persist();
});
$('previous-stage').addEventListener('click', () => selectStage(activeIndex - 1, { reveal: true }));
$('next-stage').addEventListener('click', () => selectStage(activeIndex + 1, { reveal: true }));

// ---------------------------------------------------------------- bosh sahifa: bosqichlar va navbatdagi vazifalar

function renderSummary() {
  $('stage-summary').innerHTML = stages.map(stage => {
    const count = itemsOf(stage).length;
    const done = doneIn(stage);
    const complete = done === count;
    return `<li><button type="button" class="summary-row${complete ? ' is-complete' : ''}" data-summary="${stage.id}" aria-label="${escapeHTML(`${stage.title}: ${done} / ${count}. Bosqichni ochish`)}"><strong>${Number(stage.number)}. ${escapeHTML(stage.shortTitle)}</strong><span>${complete ? 'Tayyor ✓' : `${done} / ${count}`}</span><span class="summary-bar" aria-hidden="true"><i style="width:${count ? Math.round(done / count * 100) : 0}%"></i></span></button></li>`;
  }).join('');
}
$('stage-summary').addEventListener('click', event => {
  const row = event.target.closest('[data-summary]');
  if (row) openStage(row.dataset.summary);
});

let nextTimer = 0;
function renderNext() {
  clearTimeout(nextTimer);
  const next = nextTasks(stages, itemsOf, state.checked, lastTripStage?.id ?? null, 3);
  const link = $('next-all');
  if (!next) {
    $('next-stage-name').textContent = '';
    $('next-list').innerHTML = '<p class="next-done">Barcha bandlar belgilangan. Safaringiz xayrli, ibodatlaringiz qabul bo‘lsin.</p>';
    link.dataset.stage = '';
    return;
  }
  $('next-stage-name').textContent = `${Number(next.stage.number)}-bosqich · ${next.stage.shortTitle} · ${next.remaining} band qoldi`;
  $('next-list').innerHTML = next.items.map(item => `<label class="next-item" for="next-${item.id}"><input class="check-box" id="next-${item.id}" type="checkbox" data-next="${item.id}"><span class="item-copy">${itemCopy(item)}</span></label>`).join('');
  link.dataset.stage = next.stage.id;
}

$('next-list').addEventListener('change', event => {
  const input = event.target;
  if (!input.matches('input[data-next]')) return;
  const id = input.dataset.next;
  const item = findItem(id);
  if (input.checked) state.checked.add(id);
  else state.checked.delete(id);
  input.closest('.next-item').classList.toggle('is-checked', input.checked);
  persist();
  // Belgilangan band bir lahza chizilgan holda turadi, so'ng ro'yxat keyingi band bilan yangilanadi.
  updateProgress(true, { keepNext: true });
  clearTimeout(nextTimer);
  nextTimer = setTimeout(renderNext, 700);
  if (input.checked && item) {
    showToast(`«${item.title}» belgilandi.`, {
      label: 'Qaytarish',
      onClick: () => {
        state.checked.delete(id);
        persist();
        updateProgress(true);
      },
    });
  }
});
$('next-all').addEventListener('click', event => {
  const stageId = event.currentTarget.dataset.stage;
  if (!stageId) return;
  event.preventDefault();
  openStage(stageId);
});

// ---------------------------------------------------------------- o'z bandlari

function showCustomError(text) {
  $('custom-error').textContent = text;
  $('custom-error').hidden = false;
  $('custom-input').setAttribute('aria-invalid', 'true');
  $('custom-input').focus();
}
function hideCustomError() {
  $('custom-error').hidden = true;
  $('custom-input').removeAttribute('aria-invalid');
}

$('custom-input').addEventListener('input', hideCustomError);
$('custom-form').addEventListener('submit', event => {
  event.preventDefault();
  const stage = stages[activeIndex];
  const title = normalizeTitle($('custom-input').value);
  if (!title) return showCustomError('Avval band nomini yozing.');
  const list = state.custom[stage.id] || [];
  if (list.length >= MAX_CUSTOM_PER_STAGE) return showCustomError(`Bir bosqichga ko‘pi bilan ${MAX_CUSTOM_PER_STAGE} ta band qo‘shish mumkin.`);
  const key = title.toLocaleLowerCase('uz');
  if (itemsOf(stage).some(item => item.title.toLocaleLowerCase('uz') === key)) return showCustomError('Bu band ro‘yxatda allaqachon bor.');
  state.custom[stage.id] = [...list, createCustomItem(title)];
  $('custom-input').value = '';
  renderItems();
  updateProgress();
  renderPrintSheet();
  persist();
  announce(`«${title}» bandi ${stage.title} bosqichiga qo‘shildi.`);
  $('item-list').lastElementChild?.classList.add('is-new');
  $('custom-input').focus();
});

$('item-list').addEventListener('click', event => {
  const button = event.target.closest('[data-delete]');
  if (!button) return;
  const stage = stages[activeIndex];
  const list = state.custom[stage.id] || [];
  const index = list.findIndex(item => item.id === button.dataset.delete);
  if (index < 0) return;
  const [removed] = list.splice(index, 1);
  const wasChecked = state.checked.delete(removed.id);
  if (!list.length) delete state.custom[stage.id];
  renderItems();
  hideCustomError();
  updateProgress();
  renderPrintSheet();
  persist();
  $('custom-input').focus({ preventScroll: true });
  showToast(`«${removed.title}» o‘chirildi.`, {
    label: 'Qaytarish',
    onClick: () => {
      const current = state.custom[stage.id] || [];
      if (current.some(item => item.id === removed.id)) return;
      current.splice(Math.min(index, current.length), 0, removed);
      state.custom[stage.id] = current;
      if (wasChecked) state.checked.add(removed.id);
      if (stages[activeIndex].id === stage.id) renderItems();
      updateProgress();
      renderPrintSheet();
      persist();
      announce(`«${removed.title}» qaytarildi.`);
    },
  });
});

// ---------------------------------------------------------------- safar rejasi

let lastTripStage = null;
let tripEditing = false;

function renderTrip() {
  const departInput = $('trip-depart');
  const returnInput = $('trip-return');
  if (document.activeElement !== departInput) departInput.value = state.trip.depart;
  if (document.activeElement !== returnInput) returnInput.value = state.trip.ret;
  returnInput.min = state.trip.depart || '';

  const result = tripPlan(state.trip, todayISO());
  const hasResult = result.status === 'ok' || result.status === 'done';
  $('trip-error').hidden = result.status !== 'error';
  $('trip-error').textContent = result.error || '';
  returnInput.toggleAttribute('aria-invalid', result.status === 'error');
  $('trip-empty').hidden = result.status !== 'empty';
  $('trip-result').hidden = !hasResult;
  // Sana kiritilgach maydonlar yig'iladi; "Sanani o'zgartirish" ularni qayta ochadi.
  const fieldsHidden = hasResult && !tripEditing;
  $('trip-fields').hidden = fieldsHidden;
  $('trip-edit').setAttribute('aria-expanded', String(!fieldsHidden));
  $('trip-edit').textContent = fieldsHidden ? 'Sanani o‘zgartirish' : 'Tayyor';

  const recommended = result.stageId ? stages.find(stage => stage.id === result.stageId) : null;
  stages.forEach(stage => {
    $(`stage-tab-${stage.id}`).querySelector('.stage-now').hidden = stage !== recommended;
  });
  lastTripStage = recommended;
  if (!hasResult) return;

  $('trip-headline').textContent = result.headline;
  $('trip-sub').textContent = result.sub;
  let tip = result.tip;
  if (recommended) {
    const left = itemsOf(recommended).length - doneIn(recommended);
    tip += left ? ` «${recommended.shortTitle}» bosqichida ${left} band qoldi.` : ` «${recommended.shortTitle}» bosqichi bajarilgan.`;
  }
  $('trip-tip').textContent = tip;
  const goButton = $('trip-go');
  goButton.hidden = !recommended;
  if (recommended) goButton.textContent = `«${recommended.shortTitle}» bosqichini ochish`;
}

function onTripChange() {
  state.trip = { depart: $('trip-depart').value, ret: $('trip-return').value };
  tripEditing = true;
  persist();
  updateProgress();
}
$('trip-depart').addEventListener('change', onTripChange);
$('trip-return').addEventListener('change', onTripChange);
$('trip-edit').addEventListener('click', () => {
  tripEditing = $('trip-fields').hidden;
  renderTrip();
  if (tripEditing) $('trip-depart').focus();
});
$('trip-go').addEventListener('click', () => {
  if (lastTripStage) openStage(lastTripStage.id);
});

// ---------------------------------------------------------------- tavof hisoblagichi

const RING = { cx: 150, cy: 150, r: 120, gapDeg: 7 };
const STEP = 360 / TAWAF_ROUNDS;
const point = deg => {
  const rad = deg * Math.PI / 180;
  return `${(RING.cx + RING.r * Math.cos(rad)).toFixed(2)} ${(RING.cy + RING.r * Math.sin(rad)).toFixed(2)}`;
};
// Tavof soat miliga teskari: bo'laklar yuqoridagi (Hajarul Asvad) nuqtadan chapga qarab to'ladi.
$('tawaf-segments').innerHTML = Array.from({ length: TAWAF_ROUNDS }, (_, i) => {
  const from = -90 - i * STEP - RING.gapDeg / 2;
  const to = -90 - (i + 1) * STEP + RING.gapDeg / 2;
  return `<path class="tawaf-seg" data-round="${i + 1}" d="M ${point(from)} A ${RING.r} ${RING.r} 0 0 0 ${point(to)}"/>`;
}).join('');

let lastTap = 0;
let wakeLock = null;
const TAP_GUARD_MS = 1500;

async function setWakeLock(on) {
  if (!('wakeLock' in navigator)) return;
  try {
    if (on && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; renderWake(); });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { wakeLock = null; }
  renderWake();
}
const tawafInProgress = () => state.tawaf.count > 0 && state.tawaf.count < TAWAF_ROUNDS;
function renderWake() {
  $('tawaf-wake').textContent = wakeLock && tawafInProgress() ? 'Sanoq davomida ekran o‘chmaydi.' : '';
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && tawafInProgress()) setWakeLock(true);
});

function renderTawaf({ pop = false } = {}) {
  const count = state.tawaf.count;
  const complete = count === TAWAF_ROUNDS;
  $('tawaf-count').textContent = String(count);
  $('tawaf-ring-title').textContent = `Tavof halqasi: ${count} / ${TAWAF_ROUNDS} aylanish`;
  $('tawaf-segments').querySelectorAll('.tawaf-seg').forEach(seg => seg.classList.toggle('is-done', Number(seg.dataset.round) <= count));
  $('tawaf-walker').style.transform = `rotate(${-count * STEP}deg)`;
  $('view-tawaf').classList.toggle('is-complete', complete);
  $('tawaf-status').textContent = complete
    ? 'Tavof yakunlandi. Endi ikki rakat tavof namozini o‘qing.'
    : count === 0 ? 'Hajarul Asvad ro‘parasidan boshlang.' : `${count}-aylanish yakunlandi. Yana ${TAWAF_ROUNDS - count} ta qoldi.`;
  $('quick-tawaf').textContent = complete ? `Yakunlangan: ${TAWAF_ROUNDS} / ${TAWAF_ROUNDS}` : count ? `Davom etmoqda: ${count} / ${TAWAF_ROUNDS}` : 'Hali boshlanmagan';
  const plus = $('tawaf-plus');
  plus.disabled = complete;
  plus.textContent = complete ? 'Tavof yakunlandi' : `${count + 1}-aylanishni yakunladim`;
  $('tawaf-undo').disabled = count === 0;
  $('tawaf-reset').disabled = count === 0;
  const mark = $('tawaf-mark');
  const tawafChecked = state.checked.has('tawaf');
  mark.hidden = !complete;
  mark.disabled = tawafChecked;
  mark.textContent = tawafChecked ? 'Cheklistda «Tavof» bandi belgilangan ✓' : 'Cheklistda «Tavof» bandini belgilash';
  if (pop) {
    const number = $('tawaf-count');
    number.classList.remove('is-pop');
    void number.offsetWidth;
    number.classList.add('is-pop');
  }
  renderWake();
}

function setTawaf(count, { pop = false } = {}) {
  state.tawaf = { count: clampTawaf(count), updatedAt: Date.now() };
  persist();
  renderTawaf({ pop });
  setWakeLock(tawafInProgress());
}

$('tawaf-plus').addEventListener('click', () => {
  const now = Date.now();
  if (now - lastTap < TAP_GUARD_MS) {
    showToast('Ikki marta bosildi deb hisoblamadik. Bir aylanish bir necha daqiqa davom etadi.');
    return;
  }
  lastTap = now;
  const next = state.tawaf.count + 1;
  setTawaf(next, { pop: true });
  // Tebranish faqat haqiqiy teginishdan keyin ruxsat etiladi; aks holda brauzer ogohlantirish yozadi.
  if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(next === TAWAF_ROUNDS ? [60, 80, 60] : 35);
  if (next === TAWAF_ROUNDS) announce('Tavof yakunlandi. Yetti aylanish.');
});
$('tawaf-undo').addEventListener('click', () => {
  lastTap = 0;
  setTawaf(state.tawaf.count - 1);
});
$('tawaf-reset').addEventListener('click', () => {
  const previous = state.tawaf.count;
  lastTap = 0;
  setTawaf(0);
  showToast('Hisob nolga tushirildi.', { label: 'Qaytarish', onClick: () => setTawaf(previous) });
});
$('tawaf-mark').addEventListener('click', () => {
  state.checked.add('tawaf');
  persist();
  if (stages[activeIndex].id === 'rites') renderItems();
  updateProgress(true);
  showToast('Cheklistda «Tavof» bandi belgilandi.');
});

// ---------------------------------------------------------------- katta shrift va tungi rejim

let prefs = { theme: null, textLarge: false };
try { prefs = parsePrefs(localStorage.getItem(PREFS_KEY)); } catch { /* standart sozlamalar */ }
const systemDark = matchMedia('(prefers-color-scheme: dark)');

function applyPrefs() {
  const dark = prefs.theme ? prefs.theme === 'dark' : systemDark.matches;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.classList.toggle('text-large', prefs.textLarge);
  $('toggle-theme').setAttribute('aria-pressed', String(dark));
  $('toggle-theme').title = dark ? 'Kunduzgi rejim' : 'Tungi rejim';
  $('toggle-text').setAttribute('aria-pressed', String(prefs.textLarge));
  $('theme-color').content = dark ? '#0c1310' : '#eef1ef';
}
function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* sozlama faqat shu sahifada qoladi */ }
  applyPrefs();
}
$('toggle-theme').addEventListener('click', () => {
  prefs.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  savePrefs();
  announce(prefs.theme === 'dark' ? 'Tungi rejim yoqildi.' : 'Kunduzgi rejim yoqildi.');
});
$('toggle-text').addEventListener('click', () => {
  prefs.textLarge = !prefs.textLarge;
  savePrefs();
  revealActiveTab(stages[activeIndex]);
  announce(prefs.textLarge ? 'Katta shrift yoqildi.' : 'Oddiy shrift yoqildi.');
});
systemDark.addEventListener('change', () => { if (!prefs.theme) applyPrefs(); });

// ---------------------------------------------------------------- boshqa tablar bilan sinxronlash

window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY) {
    state = parseState(event.newValue, stages);
    selectStage(activeIndex, { save: false });
    renderPrintSheet();
    announce('Belgilar boshqa oynadan yangilandi.');
  } else if (event.key === PREFS_KEY) {
    prefs = parsePrefs(event.newValue);
    applyPrefs();
  }
});

// ---------------------------------------------------------------- chop etish varag'i va manbalar

function renderPrintSheet() {
  const count = allItems().length;
  $('print-sheet').innerHTML = `<h1>Umra safari</h1><p class="print-intro">Bir sahifalik cheklist / ${stages.length} bosqich / ${count} band</p><div class="print-columns">${stages.map(stage => `<section class="print-section"><h2>${stage.number} / ${escapeHTML(stage.title)}</h2>${itemsOf(stage).map(item => `<div class="print-item"><span class="print-box"></span><strong>${escapeHTML(item.title)}</strong>${item.detail ? `<small>${escapeHTML(item.detail)}</small>` : ''}</div>`).join('')}</section>`).join('')}</div><p class="print-footer">Viza, ruxsat va tibbiy talablarni safar oldidan qayta tekshiring. Manbalar: Nusuk, Haramayn, Saudiya SSV.</p>`;
}

$('source-links').innerHTML = sources.map(source => `<a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.title)}</a>`).join('');

applyPrefs();
renderPrintSheet();
selectStage(activeIndex, { save: false });
updateStorageNote();
showView(currentView);
onScroll();
if (tawafInProgress()) setWakeLock(true);

// ---------------------------------------------------------------- Claude artefaktida PDF

// Claude artefakti ichida oddiy "download" havolasi ishlamaydi; u yerda PDF platformaning saqlash oynasi orqali beriladi.
// Oddiy hostingda (GitHub Pages, localhost) window.claude yo'q, bu blok ishlamaydi va havola odatdagidek yuklab oladi.
const PDF_NAME = 'umra-safari-cheklist.pdf';

if (typeof window.claude?.use === 'function') {
  // Modulni darhol so'raymiz; bosish esa modul tayyor bo'lguncha ham ushlanadi.
  const downloadsReady = window.claude.use('downloads').catch(() => null);
  let saving = false;

  async function savePdf(href) {
    if (saving) return;
    saving = true;
    showToast('PDF tayyorlanmoqda…');
    try {
      const downloads = await downloadsReady;
      if (!downloads) {
        const opened = window.open(href, '_blank', 'noopener');
        showToast(opened ? 'PDF yangi oynada ochildi.' : 'Bu oynada yuklab olish mavjud emas. Saytni brauzerda oching.');
        return;
      }
      const response = await fetch(href);
      if (!response.ok) throw Object.assign(new Error(response.statusText), { code: `fayl_${response.status}` });
      const blob = await response.blob();
      if (!blob.size) throw Object.assign(new Error('empty'), { code: 'bo‘sh_fayl' });
      await downloads.save({ filename: PDF_NAME, data: blob });
      showToast('PDF saqlandi.');
    } catch (error) {
      if (error?.code === 'declined') showToast('Saqlash bekor qilindi.');
      else showToast(`PDFni saqlab bo‘lmadi (${error?.code || error?.message || 'noma’lum xato'}).`);
    } finally {
      saving = false;
    }
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[download]');
    if (!link) return;
    event.preventDefault();
    savePdf(link.href);
  });
}
