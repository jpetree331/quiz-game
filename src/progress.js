// Browser-independent progress rules. Question identity survives answer shuffling.
import { shuffle } from './engine.js';
export const STORAGE_KEY = 'nextstop:journey:v1';
export const emptyProgress = () => ({ version: 1, topics: {}, daily: { date: '', answered: 0 } });
const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const questionKey = q => JSON.stringify([q.prompt, [...q.choices].sort(), q.choices[q.answer]]);
const emptyTopic = () => ({ seen: [], collected: [], trips: 0, best: 0 });
export function topicProgress(progress, id) {
  return Object.hasOwn(progress.topics, id) ? progress.topics[id] : emptyTopic();
}
export function decodeProgress(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !parsed.topics || typeof parsed.topics !== 'object') return emptyProgress();
    const topics = {};
    for (const [id, t] of Object.entries(parsed.topics)) {
      if (!t || typeof t !== 'object') continue;
      const strings = a => Array.isArray(a) ? [...new Set(a.filter(x => typeof x === 'string'))] : [];
      Object.defineProperty(topics, id, { value: { seen: strings(t.seen), collected: strings(t.collected), trips: count(t.trips), best: Math.min(100, count(t.best)) }, enumerable: true, configurable: true, writable: true });
    }
    return { version: 1, topics, daily: { date: typeof parsed.daily?.date === 'string' ? parsed.daily.date : '', answered: count(parsed.daily?.answered) } };
  } catch { return emptyProgress(); }
}
export function recordAnswer(progress, id, question, correct, date = localDate()) {
  const t = topicProgress(progress, id);
  const key = questionKey(question);
  const earned = correct && !t.collected.includes(key) ? 10 : 0;
  const topic = { ...t, seen: [...new Set([...t.seen, key])], collected: earned ? [...t.collected, key] : [...t.collected] };
  return { earned, progress: { ...progress, topics: { ...progress.topics, [id]: topic }, daily: { date, answered: (progress.daily.date === date ? progress.daily.answered : 0) + 1 } } };
}
export function completeTrip(progress, id, pct) {
  const t = topicProgress(progress, id);
  return { ...progress, topics: { ...progress.topics, [id]: { ...t, trips: t.trips + 1, best: Math.max(t.best, pct) } } };
}
export function summary(progress) {
  return Object.values(progress.topics).reduce((s, t) => ({ collected: s.collected + t.collected.length, xp: s.xp + t.collected.length * 10, trips: s.trips + t.trips }), { collected: 0, xp: 0, trips: 0 });
}
export function collectedCount(progress, id, deck) {
  const collected = new Set(topicProgress(progress, id).collected);
  return deck.questions.filter(q => collected.has(questionKey(q))).length;
}
// First unseen questions, then previously missed, then collected. Shuffle within each tier.
export function discoveryDeck(deck, progress, id, size, rng = Math.random) {
  const t = topicProgress(progress, id), seen = new Set(t.seen), collected = new Set(t.collected);
  const groups = [[], [], []];
  for (const q of deck.questions) {
    const key = questionKey(q);
    groups[collected.has(key) ? 2 : seen.has(key) ? 1 : 0].push(q);
  }
  return { ...deck, questions: groups.flatMap(group => shuffle(group, rng)).slice(0, size) };
}
