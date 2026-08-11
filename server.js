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

const WORD_GEN_PROMPT = `You are a word generator for a competitive party word-guessing game similar to Articulate.
Your job is to generate words or phrases for ANY category a player defines.

CATEGORY: {{CATEGORY}}
ALREADY USED: {{USED_WORDS_ARRAY}}
QUANTITY NEEDED: {{COUNT}}

RULES:
1. Return ONLY a valid JSON array of strings. No explanation, no markdown, no preamble.
2. Every item MUST be a genuine, specific, well-known example of the category — if someone who knows the category well would say "that doesn't belong," reject it.
3. NEVER repeat any word from the ALREADY USED list.
4. Interpret the category LITERALLY and SPECIFICALLY. If the category is "90s Pop Songs", return actual 90s pop song titles — not general music terms. If the category is "Things in a Dentist's Office", return specific items found there — not vague health words.
5. Bias toward items that are:
   - Recognizable to a general adult audience
   - Describable without saying the word itself (good for guessing games)
   - Specific enough to be unambiguous (e.g. "Michael Jordan" not just "athlete")
6. Avoid overly obscure items unless the category itself demands niche knowledge.
7. If the category is ambiguous, pick the most fun and playable interpretation.
8. Vary difficulty — mix easy, medium, and hard items in each batch.

Return exactly {{COUNT}} items as a flat JSON array.
Example output format: ["item one", "item two", "item three"]`;

app.post('/api/generate-words', async (req, res) => {
  const { category, usedWords = [], count = 60 } = req.body;
  if (!category || typeof category !== 'string') {
    return res.status(400).json({ error: 'category is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(501).json({ error: 'no_api_key', message: 'ANTHROPIC_API_KEY not configured' });
  }

  const prompt = WORD_GEN_PROMPT
    .replace('{{CATEGORY}}', category)
    .replace('{{USED_WORDS_ARRAY}}', JSON.stringify(usedWords))
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
