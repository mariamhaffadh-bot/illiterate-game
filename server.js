import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// ── In-memory game sessions ─────────────────────────────────────

/** @type {Map<string, { id: string, createdAt: number, state: object|null, hostWs: import('ws')|null, clients: Set<import('ws')> }>} */
const sessions = new Map();

function generateGameId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  // Ensure uniqueness
  if (sessions.has(id)) return generateGameId();
  return id;
}

// Clean up stale sessions every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    // Remove sessions older than 6 hours with no host
    if (!session.hostWs && now - session.createdAt > 6 * 60 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 30 * 60 * 1000);

// ── REST API ────────────────────────────────────────────────────

app.use(express.json());

app.post('/api/games', (_req, res) => {
  const id = generateGameId();
  sessions.set(id, {
    id,
    createdAt: Date.now(),
    state: null,
    hostWs: null,
    clients: new Set(),
  });
  res.json({ gameId: id });
});

// ── Word Generation (LLM-powered) ──────────────────────────────

const WORD_GEN_PROMPT = `You are a word bank for a party guessing game. Generate words for this category.

CATEGORY: "{{CATEGORY}}"

═══════════════════════════════════════
BANNED LIST — NEVER OUTPUT THESE:
{{USED_WORDS_LIST}}
═══════════════════════════════════════

YOUR TASK:
Generate exactly {{COUNT}} words/phrases that belong to "{{CATEGORY}}".

CRITICAL ANTI-REPEAT CONTRACT:
- Before outputting ANY word, mentally check it against the BANNED LIST above.
- If a word appears on the BANNED LIST in ANY form (different casing, with/without
  articles like "the"/"a", plural vs singular, abbreviated) — DISCARD IT and pick another.
- Do NOT output synonyms or near-duplicates of banned words either.
  Example: if "automobile" is banned, do NOT output "car", "auto", or "vehicle".
- Each word in your output must also be unique from every OTHER word in your output.
- You have the entire English language and world knowledge at your disposal —
  there is NO excuse to repeat. If you are running low on ideas, go deeper into
  subcategories, be more specific, or explore less obvious members of "{{CATEGORY}}".

QUALITY RULES:
- Every item must unambiguously belong to "{{CATEGORY}}" — no stretching.
- Items must be guessable in a party game (describable without saying the word).
- Mix difficulty: roughly 40% easy, 40% medium, 20% hard/obscure.
- Prefer specific over generic: "Leonardo da Vinci" beats "famous artist".

OUTPUT FORMAT:
Return ONLY a raw JSON array. No markdown. No explanation. No numbering.
["word one", "word two", "word three"]

FINAL CHECK BEFORE RESPONDING:
1. Count your items — is it exactly {{COUNT}}? ✓
2. Cross-check every item against the BANNED LIST — any matches? Remove them. ✓
3. Check your items against each other — any duplicates? Remove them. ✓
4. Does every item genuinely belong to "{{CATEGORY}}"? ✓
Only output after all four checks pass.`;

app.post('/api/generate-words', async (req, res) => {
  const { category, usedWords = [], count = 60 } = req.body;
  if (!category || typeof category !== 'string') {
    return res.status(400).json({ error: 'category is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(501).json({ error: 'no_api_key', message: 'ANTHROPIC_API_KEY not configured' });
  }

  const bannedList = usedWords.length > 0
    ? usedWords.map(w => `- ${w}`).join('\n')
    : '(none)';

  const prompt = WORD_GEN_PROMPT
    .replace(/\{\{CATEGORY\}\}/g, category)
    .replace('{{USED_WORDS_LIST}}', bannedList)
    .replace(/\{\{COUNT\}\}/g, String(count));

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'llm_error' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '[]';

    // Parse the JSON array from the response
    let words;
    try {
      words = JSON.parse(text);
      if (!Array.isArray(words)) throw new Error('Not an array');
      words = words.filter(w => typeof w === 'string' && w.trim().length > 0);
    } catch {
      // Try to extract JSON array from the response text
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        words = JSON.parse(match[0]).filter(w => typeof w === 'string');
      } else {
        return res.status(502).json({ error: 'parse_error' });
      }
    }

    res.json({ words });
  } catch (err) {
    console.error('Word generation error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/games/:id', (req, res) => {
  const session = sessions.get(req.params.id.toUpperCase());
  if (!session) return res.status(404).json({ error: 'not_found' });
  res.json({ gameId: session.id, hasState: session.state !== null });
});

// ── WebSocket ───────────────────────────────────────────────────

wss.on('connection', (ws) => {
  let gameId = null;
  let role = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'host': {
        gameId = msg.gameId?.toUpperCase();
        role = 'host';
        if (!sessions.has(gameId)) {
          sessions.set(gameId, {
            id: gameId,
            createdAt: Date.now(),
            state: null,
            hostWs: ws,
            clients: new Set(),
          });
        } else {
          sessions.get(gameId).hostWs = ws;
        }
        ws.send(JSON.stringify({ type: 'hosted', gameId }));
        break;
      }

      case 'join': {
        gameId = msg.gameId?.toUpperCase();
        role = 'display';
        const session = sessions.get(gameId);
        if (!session) {
          ws.send(JSON.stringify({ type: 'not_found' }));
          return;
        }
        session.clients.add(ws);
        ws.send(JSON.stringify({ type: 'connected', gameId }));
        // Send current state immediately if available
        if (session.state) {
          ws.send(JSON.stringify({ type: 'state', data: session.state }));
        }
        break;
      }

      case 'state': {
        if (role !== 'host' || !gameId) return;
        const session = sessions.get(gameId);
        if (!session) return;
        session.state = msg.data;
        // Broadcast to all display clients
        const payload = JSON.stringify({ type: 'state', data: msg.data });
        for (const client of session.clients) {
          if (client.readyState === 1) {
            client.send(payload);
          }
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (!gameId || !sessions.has(gameId)) return;
    const session = sessions.get(gameId);
    if (role === 'display') {
      session.clients.delete(ws);
    } else if (role === 'host') {
      session.hostWs = null;
      // Notify display clients that host disconnected
      const payload = JSON.stringify({ type: 'host_disconnected' });
      for (const client of session.clients) {
        if (client.readyState === 1) client.send(payload);
      }
    }
  });

  // Keep alive
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

// Heartbeat to detect dead connections
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// ── Serve static files ──────────────────────────────────────────

app.use(express.static(join(__dirname, 'dist')));

// SPA fallback — serve index.html for all non-API routes
app.get('/{*splat}', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// ── Start ───────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Illiterate server running on port ${PORT}`);
});
