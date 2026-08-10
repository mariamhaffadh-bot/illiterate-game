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

/** Small delay to avoid hitting Wikipedia rate limits. */
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Search Wikipedia articles and return their titles. */
async function searchArticles(query: string, limit: number): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query', list: 'search', srsearch: query,
    srlimit: String(limit), format: 'json', origin: '*',
  });
  const data = await fetchJSON(`${WIKI_API}?${params}`);
  return (data.query?.search || []).map((r: any) => r.title as string);
}

/** Get all outgoing links from a Wikipedia article. */
async function getArticleLinks(title: string, limit: number): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query', titles: title, prop: 'links',
    pllimit: String(Math.min(limit, 500)), plnamespace: '0',
    format: 'json', origin: '*',
  });
  const data = await fetchJSON(`${WIKI_API}?${params}`);
  const pages = data.query?.pages || {};
  const links: string[] = [];
  for (const page of Object.values(pages) as any[]) {
    for (const link of page.links || []) {
      links.push(link.title);
    }
  }
  return links;
}

/** Search for Wikipedia categories matching a query. */
async function searchCategories(query: string): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query', list: 'search', srsearch: query,
    srnamespace: '14', srlimit: '3', format: 'json', origin: '*',
  });
  const data = await fetchJSON(`${WIKI_API}?${params}`);
  return (data.query?.search || []).map((r: any) => r.title as string);
}

/** Get page members from a category, drilling into subcategories if needed. */
async function getCategoryPages(catTitle: string): Promise<string[]> {
  const pages: string[] = [];

  const params = new URLSearchParams({
    action: 'query', list: 'categorymembers', cmtitle: catTitle,
    cmtype: 'page|subcat', cmlimit: '50', format: 'json', origin: '*',
  });
  const data = await fetchJSON(`${WIKI_API}?${params}`);
  const members = data.query?.categorymembers || [];

  for (const m of members) {
    if (m.ns === 0) {
      pages.push(m.title);
    }
  }

  // Drill into subcategories if we didn't get enough pages
  if (pages.length < 10) {
    const subcats = members.filter((m: any) => m.ns === 14).slice(0, 2);
    for (const sub of subcats) {
      await delay(100);
      const subParams = new URLSearchParams({
        action: 'query', list: 'categorymembers', cmtitle: sub.title,
        cmtype: 'page', cmlimit: '30', format: 'json', origin: '*',
      });
      try {
        const spData = await fetchJSON(`${WIKI_API}?${subParams}`);
        for (const m of spData.query?.categorymembers || []) {
          pages.push(m.title);
        }
      } catch { /* continue */ }
    }
  }

  return pages;
}

/**
 * Fetch words/items for a custom category from Wikipedia.
 * Uses multiple strategies for maximum coverage.
 */
export async function fetchWordsForCategory(
  category: string,
  target: number = 60
): Promise<string[]> {
  const words = new Set<string>();
  const addWords = (titles: string[]) => {
    for (const t of titles) {
      if (isGoodGameWord(t)) words.add(cleanTitle(t));
    }
  };

  // Run Strategy 1 & 2 in parallel: "List of..." article + topic article search
  try {
    const [listResults, topicResults] = await Promise.all([
      searchArticles(`List of ${category}`, 3).catch(() => [] as string[]),
      searchArticles(category, 3).catch(() => [] as string[]),
    ]);

    // Get links from the best "List of..." article
    const listArticle = listResults.find((t) => t.toLowerCase().startsWith('list of'));
    // Get links from the top topic article
    const topicArticle = topicResults.find(
      (t) => !t.toLowerCase().startsWith('list of')
    );

    await delay(200);

    const linkResults = await Promise.all([
      listArticle
        ? getArticleLinks(listArticle, 200).catch(() => [] as string[])
        : Promise.resolve([] as string[]),
      topicArticle
        ? getArticleLinks(topicArticle, 100).catch(() => [] as string[])
        : Promise.resolve([] as string[]),
    ]);

    addWords(linkResults[0]);
    addWords(linkResults[1]);
    // Also add the search result titles themselves
    addWords(topicResults);
  } catch { /* continue */ }

  // Strategy 3: Category members (only if we need more)
  if (words.size < target) {
    await delay(200);
    try {
      const cats = await searchCategories(category);
      for (const cat of cats.slice(0, 2)) {
        if (words.size >= target) break;
        await delay(100);
        const pages = await getCategoryPages(cat);
        addWords(pages);
      }
    } catch { /* continue */ }
  }

  // Strategy 4: Broader search as last resort
  if (words.size < target) {
    await delay(200);
    try {
      const moreResults = await searchArticles(`${category} types examples`, 50);
      addWords(moreResults);
    } catch { /* continue */ }
  }

  const result = [...words];
  // Shuffle so cards aren't alphabetical
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.slice(0, target);
}
