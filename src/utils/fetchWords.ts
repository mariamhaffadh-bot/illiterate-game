import { getUsedArray, markUsed, normalize } from './wordBank';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';

const BAD_PREFIXES = [
  'List of', 'Lists of', 'History of', 'Outline of', 'Index of',
  'Timeline of', 'Comparison of', 'Wikipedia:', 'Template:',
  'Category:', 'Portal:', 'Draft:', 'Help:', 'File:',
];
const BAD_SUFFIXES = ['(disambiguation)', '(term)', '(concept)'];

function cleanTitle(title: string): string {
  return title.replace(/\s*\(.*?\)\s*$/, '').trim();
}

function isGoodGameWord(title: string): boolean {
  if (BAD_PREFIXES.some((p) => title.startsWith(p))) return false;
  if (BAD_SUFFIXES.some((s) => title.endsWith(s))) return false;
  if (title.length < 2 || title.length > 35) return false;
  if (title.length <= 3 && /^[a-z]+$/i.test(title)) return false;
  return true;
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function searchArticles(query: string, limit: number): Promise<string[]> {
  const params = new URLSearchParams({ action: 'query', list: 'search', srsearch: query, srlimit: String(limit), format: 'json', origin: '*' });
  const data = await fetchJSON(`${WIKI_API}?${params}`);
  return (data.query?.search || []).map((r: any) => r.title as string);
}

async function getArticleLinks(title: string, limit: number): Promise<string[]> {
  const params = new URLSearchParams({ action: 'query', titles: title, prop: 'links', pllimit: String(Math.min(limit, 500)), plnamespace: '0', format: 'json', origin: '*' });
  const data = await fetchJSON(`${WIKI_API}?${params}`);
  const pages = data.query?.pages || {};
  const links: string[] = [];
  for (const page of Object.values(pages) as any[]) { for (const link of page.links || []) links.push(link.title); }
  return links;
}

async function searchCategories(query: string): Promise<string[]> {
  const params = new URLSearchParams({ action: 'query', list: 'search', srsearch: query, srnamespace: '14', srlimit: '3', format: 'json', origin: '*' });
  const data = await fetchJSON(`${WIKI_API}?${params}`);
  return (data.query?.search || []).map((r: any) => r.title as string);
}

async function getCategoryPages(catTitle: string): Promise<string[]> {
  const pages: string[] = [];
  const params = new URLSearchParams({ action: 'query', list: 'categorymembers', cmtitle: catTitle, cmtype: 'page|subcat', cmlimit: '50', format: 'json', origin: '*' });
  const data = await fetchJSON(`${WIKI_API}?${params}`);
  const members = data.query?.categorymembers || [];
  for (const m of members) { if (m.ns === 0) pages.push(m.title); }
  if (pages.length < 10) {
    const subcats = members.filter((m: any) => m.ns === 14).slice(0, 2);
    for (const sub of subcats) {
      await delay(100);
      const subParams = new URLSearchParams({ action: 'query', list: 'categorymembers', cmtitle: sub.title, cmtype: 'page', cmlimit: '30', format: 'json', origin: '*' });
      try { const d = await fetchJSON(`${WIKI_API}?${subParams}`); for (const m of d.query?.categorymembers || []) pages.push(m.title); } catch { /* continue */ }
    }
  }
  return pages;
}

/**
 * LLM word generation — passes used words as a ban list.
 * Requests 50% more than needed to absorb filtering.
 */
async function fetchWordsFromLLM(category: string, target: number, usedWords: string[]): Promise<string[] | null> {
  const requestCount = Math.ceil(target * 1.5);
  try {
    const res = await fetch('/api/generate-words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, count: requestCount, usedWords }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.words) && data.words.length > 0) return data.words;
    return null;
  } catch {
    return null;
  }
}

/**
 * Code-side dedup — never trust the LLM alone.
 * Filters against the persistent word bank + internal dedup.
 */
function dedup(candidates: string[], category: string, target: number): string[] {
  const usedSet = new Set([...getUsedArray(category)].map(normalize));
  const seen = new Set(usedSet);
  const fresh: string[] = [];

  for (const word of candidates) {
    const key = normalize(word);
    if (key.length > 0 && !seen.has(key)) {
      seen.add(key);
      fresh.push(word);
    }
    if (fresh.length >= target) break;
  }

  return fresh;
}

/**
 * Main entry point — fetches words for a custom category.
 * Uses LLM first (with ban list), falls back to Wikipedia.
 * Deduplicates at the code level and marks all results as used.
 */
export async function fetchWordsForCategory(
  category: string,
  target: number = 60
): Promise<string[]> {
  // Get everything ever used for this category
  const usedWords = getUsedArray(category);

  // Try LLM first with the full ban list
  const llmCandidates = await fetchWordsFromLLM(category, target, usedWords);
  if (llmCandidates) {
    const fresh = dedup(llmCandidates, category, target);
    if (fresh.length >= 10) {
      markUsed(category, fresh);
      return fresh;
    }
  }

  // Fallback to Wikipedia scraping
  const words = new Set<string>();
  if (llmCandidates) { for (const w of llmCandidates) words.add(w); }

  const addWords = (titles: string[]) => { for (const t of titles) { if (isGoodGameWord(t)) words.add(cleanTitle(t)); } };

  try {
    const [listResults, topicResults] = await Promise.all([
      searchArticles(`List of ${category}`, 3).catch(() => [] as string[]),
      searchArticles(category, 3).catch(() => [] as string[]),
    ]);
    const listArticle = listResults.find((t) => t.toLowerCase().startsWith('list of'));
    const topicArticle = topicResults.find((t) => !t.toLowerCase().startsWith('list of'));
    await delay(200);
    const linkResults = await Promise.all([
      listArticle ? getArticleLinks(listArticle, 200).catch(() => []) : Promise.resolve([]),
      topicArticle ? getArticleLinks(topicArticle, 100).catch(() => []) : Promise.resolve([]),
    ]);
    addWords(linkResults[0]); addWords(linkResults[1]); addWords(topicResults);
  } catch { /* continue */ }

  if (words.size < target) {
    await delay(200);
    try {
      const cats = await searchCategories(category);
      for (const cat of cats.slice(0, 2)) { if (words.size >= target) break; await delay(100); const pages = await getCategoryPages(cat); addWords(pages); }
    } catch { /* continue */ }
  }

  if (words.size < target) {
    await delay(200);
    try { const more = await searchArticles(`${category} types examples`, 50); addWords(more); } catch { /* continue */ }
  }

  // Dedup the Wikipedia results against used words too
  const allCandidates = [...words];
  for (let i = allCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCandidates[i], allCandidates[j]] = [allCandidates[j], allCandidates[i]];
  }

  const fresh = dedup(allCandidates, category, target);
  markUsed(category, fresh);
  return fresh;
}
