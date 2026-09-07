// Local progress, versioned without changing the storage key used by the original game.
import { shuffle } from './engine.js';
import { TIERS, questionTier, tierInfo } from './tiers.js';
export const STORAGE_KEY = 'nextstop:journey:v1';
export const emptyProgress = () => ({ version: 2, topics: {}, daily: { date: '', answered: 0 } });
const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
const percentage = n => Math.min(100, count(n));
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const questionKey = q => JSON.stringify([q.prompt, [...q.choices].sort(), q.choices[q.answer]]);
const emptyTopic = () => ({ seen: [], collected: [], rewards: {}, trips: 0, best: 0, bestByTier: {} });
export function topicProgress(progress, id) {
  return Object.hasOwn(progress.topics, id) ? progress.topics[id] : emptyTopic();
}
export function decodeProgress(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (![1, 2].includes(parsed?.version) || !parsed.topics || typeof parsed.topics !== 'object' || Array.isArray(parsed.topics)) return emptyProgress();
    const topics = {};
    for (const [id, t] of Object.entries(parsed.topics)) {
      if (!t || typeof t !== 'object' || Array.isArray(t)) continue;
      const strings = a => Array.isArray(a) ? [...new Set(a.filter(x => typeof x === 'string'))] : [];
      const collected = strings(t.collected);
      const rewards = Object.fromEntries(collected.map(key => [key, parsed.version === 2 && [10, 20, 30].includes(t.rewards?.[key]) ? t.rewards[key] : 10]));
      const bestByTier = Object.fromEntries(TIERS.map(tier => [tier.id, percentage(t.bestByTier?.[tier.id] ?? (tier.id === 1 ? t.best : 0))]));
      Object.defineProperty(topics, id, { value: { seen: strings(t.seen), collected, rewards, trips: count(t.trips), best: percentage(t.best), bestByTier }, enumerable: true, configurable: true, writable: true });
    }
    return { version: 2, topics, daily: { date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.daily?.date) ? parsed.daily.date : '', answered: count(parsed.daily?.answered) } };
  } catch { return emptyProgress(); }
}
export function recordAnswer(progress, id, question, correct, date = localDate()) {
  const t = topicProgress(progress, id), key = questionKey(question);
  const earned = correct && !t.collected.includes(key) ? tierInfo(questionTier(question)).xp : 0;
  const topic = { ...t, seen: [...new Set([...t.seen, key])], collected: earned ? [...t.collected, key] : [...t.collected], rewards: earned ? { ...t.rewards, [key]: earned } : { ...t.rewards } };
  return { earned, progress: { ...progress, topics: { ...progress.topics, [id]: topic }, daily: { date, answered: (progress.daily.date === date ? progress.daily.answered : 0) + 1 } } };
}
export function completeTrip(progress, id, pct, tier = 1) {
  const t = topicProgress(progress, id);
  return { ...progress, topics: { ...progress.topics, [id]: { ...t, trips: t.trips + 1, best: Math.max(t.best, pct), bestByTier: { ...t.bestByTier, [tier]: Math.max(t.bestByTier[tier] ?? 0, pct) } } } };
}
export function summary(progress) {
  return Object.values(progress.topics).reduce((s, t) => ({ collected: s.collected + t.collected.length, xp: s.xp + t.collected.reduce((xp, key) => xp + (t.rewards[key] ?? 10), 0), trips: s.trips + t.trips }), { collected: 0, xp: 0, trips: 0 });
}
export function collectedCount(progress, id, deck) {
  const collected = new Set(topicProgress(progress, id).collected);
  return deck.questions.filter(q => collected.has(questionKey(q))).length;
}
export function tierProgress(progress, id, deck) {
  const rows = TIERS.map(t => {
    const questions = deck.questions.filter(q => questionTier(q) === t.id);
    return { ...t, total: questions.length, collected: collectedCount(progress, id, { questions }) };
  }).filter(t => t.total > 0);
  return rows.map((row, i) => {
    const predecessors = rows.slice(0, i);
    const unlocked = predecessors.every(t => t.collected >= Math.min(10, t.total));
    const previous = rows[i - 1];
    return { ...row, unlocked, previous: previous?.name, needed: previous ? Math.max(0, Math.min(10, previous.total) - previous.collected) : 0 };
  });
}
// First unseen questions, then previously missed, then collected. Shuffle within each group.
export function discoveryDeck(deck, progress, id, size, rng = Math.random) {
  const t = topicProgress(progress, id), seen = new Set(t.seen), collected = new Set(t.collected);
  const groups = [[], [], []];
  for (const q of deck.questions) {
    const key = questionKey(q);
    groups[collected.has(key) ? 2 : seen.has(key) ? 1 : 0].push(q);
  }
  return { ...deck, questions: groups.flatMap(group => shuffle(group, rng)).slice(0, size) };
}
// Backups merge monotonically: importing the same save twice never duplicates XP or trips.
export function mergeProgress(current, incoming) {
  const topics = { ...current.topics };
  for (const id of Object.keys(incoming.topics)) {
    const a = topicProgress(current, id), b = topicProgress(incoming, id);
    const collected = [...new Set([...a.collected, ...b.collected])];
    const rewards = Object.fromEntries(collected.map(key => [key, Math.max(a.rewards[key] ?? 0, b.rewards[key] ?? 0, 10)]));
    Object.defineProperty(topics, id, { value: { collected, rewards, seen: [...new Set([...a.seen, ...b.seen])], trips: Math.max(a.trips, b.trips), best: Math.max(a.best, b.best), bestByTier: Object.fromEntries(TIERS.map(t => [t.id, Math.max(a.bestByTier[t.id] ?? 0, b.bestByTier[t.id] ?? 0)])) }, enumerable: true, configurable: true, writable: true });
  }
  const a = current.daily, b = incoming.daily;
  const daily = a.date === b.date ? { date: a.date, answered: Math.max(a.answered, b.answered) } : a.date > b.date ? { ...a } : { ...b };
  return { version: 2, topics, daily };
}
export function createBackup(progress) {
  return JSON.stringify({ format: 'nextstop-save', version: 1, exportedAt: new Date().toISOString(), progress }, null, 2);
}
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('That file is not a valid JSON save.'); }
  if (data?.format !== 'nextstop-save' || data.version !== 1 || ![1, 2].includes(data.progress?.version) || !data.progress.topics || typeof data.progress.topics !== 'object' || Array.isArray(data.progress.topics)) {
    throw new Error('Choose a Next Stop progress backup. Your current progress has not changed.');
  }
  return decodeProgress(JSON.stringify(data.progress));
}
