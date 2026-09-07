// Deck loading: the bundled markdown decks under ./decks/, plus any .md file
// the player opens from their own device. Parsing lives in engine.js.
import { parseDeck } from './engine.js';

/** Decks shipped with the app. Add a file to ./decks/ and list it here. */
export const BUNDLED = [
    { file: 'science-basics.md', title: 'Science basics' },
    { file: 'world-capitals.md', title: 'World capitals' },
    { file: 'german-first-words.md', title: 'German — first words' },
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
