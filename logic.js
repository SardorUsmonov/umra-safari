// Sahifa holatining sof mantiqi: DOM'ga bog'liq emas, shuning uchun Node testlarida tekshiriladi (tests/logic.test.js).

export const STORAGE_KEY = 'umra-safari:checklist:v1';
export const PREFS_KEY = 'umra-safari:prefs:v1';
export const TAWAF_ROUNDS = 7;
export const MAX_CUSTOM_PER_STAGE = 30;
export const MAX_TITLE = 120;

const DAY_MS = 86_400_000;
const CUSTOM_ID = /^c-[a-z0-9]{1,24}$/;

export function normalizeTitle(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE).trim();
}

export function createCustomItem(title, now = Date.now(), random = Math.random) {
  const clean = normalizeTitle(title);
  if (!clean) return null;
  const suffix = Math.floor(random() * 1296).toString(36).padStart(2, '0');
  return { id: `c-${now.toString(36)}${suffix}`, title: clean, custom: true };
}

export function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const utc = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };

/** Ikki sana orasidagi butun kunlar soni (b - a). Vaqt mintaqasi va yozgi vaqt ta'sir qilmaydi. */
export function daysBetween(a, b) {
  return Math.round((utc(b) - utc(a)) / DAY_MS);
}

/** Foydalanuvchining mahalliy bugungi sanasi, YYYY-MM-DD. */
export function todayISO(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function clampTawaf(count) {
  const n = Number(count);
  return Number.isInteger(n) ? Math.min(Math.max(n, 0), TAWAF_ROUNDS) : 0;
}

export function emptyState(stages) {
  return {
    checked: new Set(),
    activeStage: stages[0]?.id ?? null,
    custom: {},
    trip: { depart: '', ret: '' },
    tawaf: { count: 0, updatedAt: 0 },
  };
}

/** Saqlangan JSONni tekshirib, xavfsiz holatga aylantiradi. Buzilgan yoki begona ma'lumot e'tiborga olinmaydi. */
export function parseState(raw, stages) {
  const state = emptyState(stages);
  let saved;
  try { saved = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return state; }
  if (!saved || typeof saved !== 'object' || saved.version !== 1) return state;

  const stageIds = new Set(stages.map(stage => stage.id));
  if (saved.custom && typeof saved.custom === 'object') {
    for (const [stageId, list] of Object.entries(saved.custom)) {
      if (!stageIds.has(stageId) || !Array.isArray(list)) continue;
      const seen = new Set();
      const clean = [];
      for (const item of list) {
        const title = normalizeTitle(item?.title);
        const id = typeof item?.id === 'string' && CUSTOM_ID.test(item.id) ? item.id : null;
        if (!title || !id || seen.has(id)) continue;
        seen.add(id);
        clean.push({ id, title, custom: true });
        if (clean.length >= MAX_CUSTOM_PER_STAGE) break;
      }
      if (clean.length) state.custom[stageId] = clean;
    }
  }

  const validIds = new Set([
    ...stages.flatMap(stage => stage.items.map(item => item.id)),
    ...Object.values(state.custom).flat().map(item => item.id),
  ]);
  if (Array.isArray(saved.checkedIds)) state.checked = new Set(saved.checkedIds.filter(id => validIds.has(id)));
  if (stageIds.has(saved.activeStage)) state.activeStage = saved.activeStage;

  const depart = isISODate(saved.trip?.depart) ? saved.trip.depart : '';
  const ret = isISODate(saved.trip?.ret) ? saved.trip.ret : '';
  state.trip = { depart, ret };

  state.tawaf = { count: clampTawaf(saved.tawaf?.count), updatedAt: Number(saved.tawaf?.updatedAt) || 0 };
  return state;
}

export function serializeState(state) {
  return JSON.stringify({
    version: 1,
    checkedIds: [...state.checked],
    activeStage: state.activeStage,
    custom: state.custom,
    trip: state.trip,
    tawaf: state.tawaf,
  });
}

export function parsePrefs(raw) {
  let saved;
  try { saved = JSON.parse(raw || 'null'); } catch { saved = null; }
  return {
    theme: saved?.theme === 'dark' || saved?.theme === 'light' ? saved.theme : null,
    textLarge: saved?.textLarge === true,
  };
}

const plan = (stageId, headline, sub, tip, status = 'ok') => ({ status, stageId, headline, sub, tip });

/**
 * Safar sanalaridan hozirgi bosqichni tavsiya qiladi.
 * Natija: { status: 'empty' | 'error' | 'ok' | 'done', stageId, headline, sub, tip, error }
 */
export function tripPlan(trip = {}, today = todayISO()) {
  const { depart = '', ret = '' } = trip;
  if (!isISODate(depart)) return { status: 'empty' };
  const hasReturn = isISODate(ret);
  if (hasReturn && daysBetween(depart, ret) < 0) {
    return { status: 'error', error: 'Qaytish sanasi uchish sanasidan keyin bo‘lishi kerak.' };
  }

  const toDepart = daysBetween(today, depart);
  if (toDepart > 30) return plan('docs', `${toDepart} kun`, 'uchishgacha qoldi', 'Hujjatlar, viza va bandlovlarni hozirdan hal qiling.');
  if (toDepart > 7) return plan('prep', `${toDepart} kun`, 'uchishgacha qoldi', 'Tayyorgarlik vaqti: libos, dorilar va aloqa rejasini tayyorlang.');
  if (toDepart > 0) return plan('route', `${toDepart} kun`, 'uchishgacha qoldi', 'Yo‘l oldidan: qo‘l yukini yig‘ing va yo‘nalishingizdagi miqotni aniqlang.');
  if (toDepart === 0) return plan('route', 'Bugun', 'yo‘lga chiqasiz', 'Hujjatlar qo‘l yukingizda bo‘lsin. Safaringiz xayrli bo‘lsin.');

  const tripDay = -toDepart + 1;
  if (hasReturn) {
    const toReturn = daysBetween(today, ret);
    if (toReturn < 0) return plan(null, 'Xush kelibsiz', 'safar yakunlandi', 'Ibodatlaringiz qabul bo‘lsin.', 'done');
    if (toReturn === 0) return plan('return', 'Bugun', 'uyga qaytasiz', 'Qaytish reysi, transfer va qo‘l yukini yana bir bor tekshiring.');
    if (toReturn <= 2) return plan('return', `${toReturn} kun`, 'qaytishgacha qoldi', 'Qaytish reysi, qolish muddati va bagaj qoidalarini tekshiring.');
  }
  return plan('rites', `${tripDay}-kun`, 'safar davom etmoqda', 'Umra amallarini tartib bilan bajaring. Tavof hisoblagichi sahifada pastroqda.');
}
