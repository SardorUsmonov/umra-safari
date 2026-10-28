// Ishga tushirish (umra-safari papkasida):  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stages } from '../checklist-data.js';
import {
  MAX_CUSTOM_PER_STAGE, MAX_TITLE, TAWAF_ROUNDS,
  normalizeTitle, createCustomItem, isISODate, daysBetween, todayISO, clampTawaf,
  parseState, serializeState, parsePrefs, tripPlan,
} from '../logic.js';

test('normalizeTitle bo‘shliqlarni siqadi va uzunlikni cheklaydi', () => {
  assert.equal(normalizeTitle('  qon   bosimi\n dorisi  '), 'qon bosimi dorisi');
  assert.equal(normalizeTitle(null), '');
  assert.equal(normalizeTitle('x'.repeat(500)).length, MAX_TITLE);
});

test('createCustomItem barqaror id va tozalangan nom beradi', () => {
  const item = createCustomItem('  Sovg‘alar ro‘yxati ', 1_700_000_000_000, () => 0.5);
  assert.deepEqual(item, { id: 'c-loyw3v28i0', title: 'Sovg‘alar ro‘yxati', custom: true });
  assert.equal(createCustomItem('   '), null);
});

test('isISODate haqiqiy sanalarnigina qabul qiladi', () => {
  assert.ok(isISODate('2026-11-20'));
  assert.ok(isISODate('2028-02-29'));
  assert.ok(!isISODate('2026-02-30'));
  assert.ok(!isISODate('20-11-2026'));
  assert.ok(!isISODate(undefined));
});

test('daysBetween oy, yil va yozgi vaqt chegarasida aniq', () => {
  assert.equal(daysBetween('2026-10-28', '2026-11-20'), 23);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  assert.equal(daysBetween('2026-11-20', '2026-10-28'), -23);
});

test('todayISO mahalliy sanani beradi', () => {
  assert.equal(todayISO(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('clampTawaf 0..7 oralig‘ida butun son qaytaradi', () => {
  assert.equal(clampTawaf(3), 3);
  assert.equal(clampTawaf(12), TAWAF_ROUNDS);
  assert.equal(clampTawaf(-1), 0);
  assert.equal(clampTawaf('abc'), 0);
  assert.equal(clampTawaf(2.5), 0);
});

test('parseState eski (v1) formatdagi saqlangan belgilarni o‘qiydi', () => {
  const state = parseState(JSON.stringify({ version: 1, checkedIds: ['passport', 'yo‘q-band'], activeStage: 'prep' }), stages);
  assert.deepEqual([...state.checked], ['passport']);
  assert.equal(state.activeStage, 'prep');
  assert.deepEqual(state.custom, {});
  assert.deepEqual(state.trip, { depart: '', ret: '' });
  assert.equal(state.tawaf.count, 0);
});

test('parseState buzilgan va begona ma‘lumotni tashlab yuboradi', () => {
  assert.equal(parseState('{buzuq json', stages).checked.size, 0);
  assert.equal(parseState(JSON.stringify({ version: 2, checkedIds: ['passport'] }), stages).checked.size, 0);
  const state = parseState(JSON.stringify({
    version: 1,
    activeStage: 'hack',
    custom: {
      docs: [{ id: 'c-abc', title: '  Sug‘urta polisi  ' }, { id: 'c-abc', title: 'takror' }, { id: '<img>', title: 'yomon id' }, { id: 'c-def', title: '   ' }],
      begona: [{ id: 'c-zzz', title: 'begona bosqich' }],
    },
    checkedIds: ['c-abc', 'c-zzz'],
    trip: { depart: '2026-02-30', ret: '2026-12-01' },
    tawaf: { count: 99 },
  }), stages);
  assert.equal(state.activeStage, 'docs');
  assert.deepEqual(state.custom, { docs: [{ id: 'c-abc', title: 'Sug‘urta polisi', custom: true }] });
  assert.deepEqual([...state.checked], ['c-abc']);
  assert.deepEqual(state.trip, { depart: '', ret: '2026-12-01' });
  assert.equal(state.tawaf.count, TAWAF_ROUNDS);
});

test('parseState bir bosqichdagi o‘z bandlar sonini cheklaydi', () => {
  const list = Array.from({ length: MAX_CUSTOM_PER_STAGE + 5 }, (_, i) => ({ id: `c-${i}`, title: `band ${i}` }));
  const state = parseState({ version: 1, custom: { prep: list } }, stages);
  assert.equal(state.custom.prep.length, MAX_CUSTOM_PER_STAGE);
});

test('serializeState va parseState bir-birini to‘liq tiklaydi', () => {
  const original = parseState({
    version: 1, checkedIds: ['visa', 'c-q1'], activeStage: 'rites',
    custom: { rites: [{ id: 'c-q1', title: 'Zamzam idishi' }] },
    trip: { depart: '2026-11-20', ret: '2026-12-01' }, tawaf: { count: 4, updatedAt: 10 },
  }, stages);
  const restored = parseState(serializeState(original), stages);
  assert.deepEqual(restored, original);
});

test('parsePrefs faqat ma‘lum qiymatlarni qabul qiladi', () => {
  assert.deepEqual(parsePrefs('{"theme":"dark","textLarge":true}'), { theme: 'dark', textLarge: true });
  assert.deepEqual(parsePrefs('{"theme":"pink","textLarge":"ha"}'), { theme: null, textLarge: false });
  assert.deepEqual(parsePrefs('xato'), { theme: null, textLarge: false });
  assert.deepEqual(parsePrefs(null), { theme: null, textLarge: false });
});

test('tripPlan sanaga qarab to‘g‘ri bosqichni tavsiya qiladi', () => {
  const today = '2026-10-28';
  const at = (depart, ret = '') => tripPlan({ depart, ret }, today);
  assert.equal(at('').status, 'empty');
  assert.equal(at('2026-12-20').stageId, 'docs');
  assert.equal(at('2026-12-20').headline, '53 kun');
  assert.equal(at('2026-11-28').stageId, 'docs');
  assert.equal(at('2026-11-27').stageId, 'prep');
  assert.equal(at('2026-11-05').stageId, 'prep');
  assert.equal(at('2026-11-04').stageId, 'route');
  assert.equal(at('2026-10-28').headline, 'Bugun');
  assert.equal(at('2026-10-26').stageId, 'rites');
  assert.equal(at('2026-10-26').headline, '3-kun');
  assert.equal(at('2026-10-20', '2026-11-05').stageId, 'rites');
  assert.equal(at('2026-10-20', '2026-10-30').stageId, 'return');
  assert.equal(at('2026-10-20', '2026-10-28').headline, 'Bugun');
  const done = at('2026-10-01', '2026-10-15');
  assert.equal(done.status, 'done');
  assert.equal(done.stageId, null);
});

test('tripPlan qaytish sanasi uchishdan oldin bo‘lsa xato beradi', () => {
  const result = tripPlan({ depart: '2026-11-20', ret: '2026-11-10' }, '2026-10-28');
  assert.equal(result.status, 'error');
  assert.match(result.error, /keyin bo‘lishi kerak/);
});

test('tripPlan tavsiya qilgan har bir bosqich haqiqatan mavjud', () => {
  const ids = new Set(stages.map(stage => stage.id));
  for (let offset = -40; offset <= 60; offset++) {
    const depart = new Date(Date.UTC(2026, 9, 28 + offset)).toISOString().slice(0, 10);
    const result = tripPlan({ depart, ret: '2026-12-31' }, '2026-10-28');
    if (result.stageId !== null) assert.ok(ids.has(result.stageId), `${depart}: ${result.stageId}`);
  }
});
