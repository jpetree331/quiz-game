export const TIERS = [
  { id: 1, name: 'Curious', xp: 10, description: 'Build your foundations.' },
  { id: 2, name: 'Explorer', xp: 20, description: 'Look a little deeper.' },
  { id: 3, name: 'Expert', xp: 30, description: 'Take the scenic route.' },
];
export const questionTier = question => TIERS.some(t => t.id === question.tier) ? question.tier : 1;
export const tierInfo = id => TIERS.find(t => t.id === id) ?? TIERS[0];
export const tierDeck = (deck, tier) => ({ ...deck, questions: deck.questions.filter(q => questionTier(q) === tier) });
