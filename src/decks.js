// Deck loading: the bundled markdown decks under ./decks/, plus any .md file
// the player opens from their own device. Parsing lives in engine.js.
import { parseDeck } from './engine.js';

/** Decks shipped with the app. Add a file to ./decks/ and list it here. */
export const BUNDLED = [
    { file: 'science-basics.md', title: 'Everyday science', subtitle: 'Big ideas. Everyday wonders.', icon: 'science', tint: '#e2eacb', tone: '#526834' },
    { file: 'world-capitals.md', title: 'World capitals', subtitle: 'A little trip around the globe.', icon: 'globe', tint: '#dce8ef', tone: '#4e6a7b' },
    { file: 'nature-wildlife.md', title: 'The natural world', subtitle: 'Stay wild. Stay curious.', icon: 'leaf', tint: '#f4dfcd', tone: '#9a6341' },
    { file: 'space-explorer.md', title: 'Beyond Earth', subtitle: 'Let your mind wander further.', icon: 'planet', tint: '#e7e0f2', tone: '#77638e' },
    { file: 'arts-language.md', title: 'Arts & words', subtitle: 'A fresh way to see the world.', icon: 'art', tint: '#f3e1d8', tone: '#986250' },
    { file: 'german-first-words.md', title: 'A little German', subtitle: 'Small words. New connections.', icon: 'chat', tint: '#f2e8bf', tone: '#8c7837' },
];

export async function loadBundledDeck(file) {
    const res = await fetch(`./decks/${file}`);
    if (!res.ok)
        throw new Error(`could not load deck ${file} (${res.status})`);
    return parseDeck(await res.text());
}

/** Parse a deck from a File chosen with <input type="file">. */
export async function loadDeckFile(file) {
    return parseDeck(await file.text());
}
