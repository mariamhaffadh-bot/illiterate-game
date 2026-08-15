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

// ── Display sessions (TV board) ─────────────────────────────────

const sessions = new Map();

function generateGameId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  if (sessions.has(id)) return generateGameId();
  return id;
}

// ── Multiplayer rooms ───────────────────────────────────────────

const rooms = new Map();

function generateRoomCode() {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

const TEAM_COLORS = ['#C0392B', '#2471A3', '#1E8449', '#7D3C98', '#D4A017', '#117A65', '#CA6F1E', '#1A5276'];
const PLAYER_COLORS = ['#E74C3C', '#5DADE2', '#2ECC71', '#AF7AC5', '#F4D03F', '#1ABC9C', '#E67E22', '#3498DB', '#9B59B6', '#1ABC9C', '#E74C3C', '#2ECC71'];

function getPublicPlayers(room) {
  return room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, color: p.color }));
}

function pickRandomWord(pool, usedWords) {
  const available = pool.filter(w => !usedWords.includes(w));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function broadcastGameState(room) {
  const gs = room.gameState;
  if (!gs) return;
  for (const p of room.players) {
    if (!p.ws || p.ws.readyState !== 1) continue;
    const state = { ...gs };
    delete state.wordPools; // never send word pools
    // SECURITY: only explainer sees the word
    if (p.id !== gs.currentExplainerId) {
      state.currentWord = null;
    }
    p.ws.send(JSON.stringify({ type: 'game_update', gameState: state }));
  }
}

function advanceTurn(room) {
  const gs = room.gameState;
  const currentTeam = gs.teams[gs.currentTeamIndex];

  // Store summary data
  gs.lastTurnTeamName = currentTeam.name;
  gs.lastTurnScore = gs.turnScore;

  // Add turn score to team
  currentTeam.score += gs.turnScore;

  // Rotate explainer within current team
  currentTeam.currentExplainerIndex = (currentTeam.currentExplainerIndex + 1) % currentTeam.playerIds.length;

  // Advance to next team
  gs.currentTeamIndex = (gs.currentTeamIndex + 1) % gs.teams.length;
  if (gs.currentTeamIndex === 0) gs.round++;

  const nextTeam = gs.teams[gs.currentTeamIndex];
  gs.currentExplainerId = nextTeam.playerIds[nextTeam.currentExplainerIndex];

  // Find next explainer name
  const nextExplainer = gs.players.find(p => p.id === gs.currentExplainerId);
  gs.nextExplainerName = nextExplainer?.name || 'Unknown';
  gs.nextTeamName = nextTeam.name;

  // Pick new category and word
  gs.currentCategory = gs.categories[Math.floor(Math.random() * gs.categories.length)];
  const pool = gs.wordPools[gs.currentCategory] || [];
  const word = pickRandomWord(pool, gs.usedWords);

  if (!word) {
    gs.phase = 'gameOver';
    gs.currentWord = null;
  } else {
    gs.phase = 'turnSummary';
    gs.currentWord = word;
    gs.usedWords.push(word);
    gs.turnScore = 0;
  }

  broadcastGameState(room);

  // Auto-advance from turnSummary to playing after 4 seconds
  if (gs.phase === 'turnSummary') {
    setTimeout(() => {
      if (room.gameState && room.gameState.phase === 'turnSummary') {
        room.gameState.phase = 'playing';
        room.gameState.turnStartedAt = Date.now();
        broadcastGameState(room);
      }
    }, 4000);
  }
}

// Cleanup every 30 min
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) { if (!s.hostWs && now - s.createdAt > 6 * 3600000) sessions.delete(id); }
  for (const [c, r] of rooms) { if (now - r.createdAt > 24 * 3600000) rooms.delete(c); }
}, 1800000);

// ── REST API ────────────────────────────────────────────────────

app.use(express.json());

app.post('/api/games', (_req, res) => {
  const id = generateGameId();
  sessions.set(id, { id, createdAt: Date.now(), state: null, hostWs: null, clients: new Set() });
  res.json({ gameId: id });
});

app.get('/api/games/:id', (req, res) => {
  const s = sessions.get(req.params.id.toUpperCase());
  if (!s) return res.status(404).json({ error: 'not_found' });
  res.json({ gameId: s.id, hasState: s.state !== null });
});

app.get('/api/rooms/:code', (req, res) => {
  const r = rooms.get(req.params.code);
  if (!r) return res.status(404).json({ error: 'not_found' });
  res.json({ roomCode: r.code, status: r.status, players: getPublicPlayers(r) });
});

// ── Word Generation ─────────────────────────────────────────────

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
- If a word appears on the BANNED LIST in ANY form — DISCARD IT and pick another.
- Do NOT output synonyms or near-duplicates of banned words either.
- Each word in your output must also be unique from every OTHER word in your output.

QUALITY RULES:
- Every item must unambiguously belong to "{{CATEGORY}}".
- Items must be guessable in a party game (describable without saying the word).
- Mix difficulty: roughly 40% easy, 40% medium, 20% hard/obscure.
- Prefer specific over generic.

OUTPUT FORMAT:
Return ONLY a raw JSON array. No markdown. No explanation.
["word one", "word two", "word three"]`;

app.post('/api/generate-words', async (req, res) => {
  const { category, usedWords = [], count = 60 } = req.body;
  if (!category) return res.status(400).json({ error: 'category is required' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(501).json({ error: 'no_api_key' });
  const bannedList = usedWords.length > 0 ? usedWords.map(w => `- ${w}`).join('\n') : '(none)';
  const prompt = WORD_GEN_PROMPT.replace(/\{\{CATEGORY\}\}/g, category).replace('{{USED_WORDS_LIST}}', bannedList).replace(/\{\{COUNT\}\}/g, String(count));
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!response.ok) return res.status(502).json({ error: 'llm_error' });
    const data = await response.json();
    const text = data.content?.[0]?.text ?? '[]';
    let words;
    try { words = JSON.parse(text); if (!Array.isArray(words)) throw 0; words = words.filter(w => typeof w === 'string' && w.trim()); }
    catch { const m = text.match(/\[[\s\S]*\]/); if (m) words = JSON.parse(m[0]).filter(w => typeof w === 'string'); else return res.status(502).json({ error: 'parse_error' }); }
    res.json({ words });
  } catch (err) { console.error('Word gen error:', err); res.status(500).json({ error: 'server_error' }); }
});

// ── WebSocket ───────────────────────────────────────────────────

wss.on('connection', (ws) => {
  let gameId = null, role = null, roomCode = null, playerId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      // ── Display sessions ──────────────────────────────────
      case 'host': {
        gameId = msg.gameId?.toUpperCase(); role = 'host';
        if (!sessions.has(gameId)) sessions.set(gameId, { id: gameId, createdAt: Date.now(), state: null, hostWs: ws, clients: new Set() });
        else sessions.get(gameId).hostWs = ws;
        ws.send(JSON.stringify({ type: 'hosted', gameId }));
        break;
      }
      case 'join': {
        gameId = msg.gameId?.toUpperCase(); role = 'display';
        const s = sessions.get(gameId);
        if (!s) { ws.send(JSON.stringify({ type: 'not_found' })); return; }
        s.clients.add(ws);
        ws.send(JSON.stringify({ type: 'connected', gameId }));
        if (s.state) ws.send(JSON.stringify({ type: 'state', data: s.state }));
        break;
      }
      case 'state': {
        if (role !== 'host' || !gameId) return;
        const s = sessions.get(gameId); if (!s) return;
        s.state = msg.data;
        const p = JSON.stringify({ type: 'state', data: msg.data });
        for (const c of s.clients) { if (c.readyState === 1) c.send(p); }
        break;
      }

      // ── Multiplayer rooms ─────────────────────────────────
      case 'create_room': {
        const code = generateRoomCode();
        const id = crypto.randomUUID();
        playerId = id; roomCode = code; role = 'room_host';
        const room = {
          code, hostId: id, status: 'lobby',
          players: [{ id, name: msg.playerName || 'Host', isHost: true, ws, color: PLAYER_COLORS[0] }],
          teams: [], gameState: null, createdAt: Date.now(),
        };
        rooms.set(code, room);
        ws.send(JSON.stringify({ type: 'room_created', roomCode: code, playerId: id, players: getPublicPlayers(room) }));
        break;
      }

      case 'join_room': {
        const code = msg.roomCode;
        const room = rooms.get(code);
        if (!room) { ws.send(JSON.stringify({ type: 'room_not_found' })); return; }
        if (room.status !== 'lobby') { ws.send(JSON.stringify({ type: 'room_already_started' })); return; }
        if (room.players.length >= 12) { ws.send(JSON.stringify({ type: 'room_full' })); return; }
        const id = crypto.randomUUID();
        playerId = id; roomCode = code; role = 'room_player';
        room.players.push({ id, name: msg.playerName || 'Player', isHost: false, ws, color: PLAYER_COLORS[room.players.length % PLAYER_COLORS.length] });
        ws.send(JSON.stringify({ type: 'room_joined', roomCode: code, playerId: id, players: getPublicPlayers(room) }));
        for (const p of room.players) {
          if (p.ws && p.ws !== ws && p.ws.readyState === 1) p.ws.send(JSON.stringify({ type: 'player_joined', players: getPublicPlayers(room) }));
        }
        // Also send current teams if set
        if (room.teams.length > 0) {
          ws.send(JSON.stringify({ type: 'teams_updated', teams: room.teams }));
        }
        break;
      }

      case 'kick_player': {
        if (!roomCode || role !== 'room_host') return;
        const room = rooms.get(roomCode); if (!room) return;
        const target = room.players.find(p => p.id === msg.playerId);
        if (target && !target.isHost) {
          if (target.ws?.readyState === 1) target.ws.send(JSON.stringify({ type: 'kicked' }));
          room.players = room.players.filter(p => p.id !== msg.playerId);
          // Remove from teams too
          for (const t of room.teams) t.playerIds = t.playerIds.filter(id => id !== msg.playerId);
          for (const p of room.players) {
            if (p.ws?.readyState === 1) {
              p.ws.send(JSON.stringify({ type: 'player_left', players: getPublicPlayers(room) }));
              p.ws.send(JSON.stringify({ type: 'teams_updated', teams: room.teams }));
            }
          }
        }
        break;
      }

      case 'assign_teams': {
        if (!roomCode || role !== 'room_host') return;
        const room = rooms.get(roomCode); if (!room) return;
        room.teams = msg.teams.map((t, i) => ({
          id: `team_${i}`,
          name: t.name || `Team ${i + 1}`,
          color: t.color || TEAM_COLORS[i % TEAM_COLORS.length],
          score: 0,
          playerIds: t.playerIds || [],
          currentExplainerIndex: 0,
        }));
        for (const p of room.players) {
          if (p.ws?.readyState === 1) p.ws.send(JSON.stringify({ type: 'teams_updated', teams: room.teams }));
        }
        break;
      }

      case 'auto_assign': {
        if (!roomCode || role !== 'room_host') return;
        const room = rooms.get(roomCode); if (!room) return;
        const numTeams = Math.min(msg.numTeams || 2, 4);
        const shuffled = [...room.players].sort(() => Math.random() - 0.5);
        const teams = Array.from({ length: numTeams }, (_, i) => ({
          id: `team_${i}`,
          name: `Team ${i + 1}`,
          color: TEAM_COLORS[i % TEAM_COLORS.length],
          score: 0,
          playerIds: [],
          currentExplainerIndex: 0,
        }));
        shuffled.forEach((p, i) => { teams[i % numTeams].playerIds.push(p.id); });
        room.teams = teams;
        for (const p of room.players) {
          if (p.ws?.readyState === 1) p.ws.send(JSON.stringify({ type: 'teams_updated', teams: room.teams }));
        }
        break;
      }

      case 'start_game': {
        if (!roomCode || role !== 'room_host') return;
        const room = rooms.get(roomCode);
        if (!room || room.teams.length < 2) return;
        // Verify all teams have at least 1 player
        if (room.teams.some(t => t.playerIds.length === 0)) return;

        room.status = 'playing';
        const categories = msg.categories || ['ACTION', 'OBJECT', 'NATURE', 'PERSON', 'WORLD', 'RANDOM'];
        const wordPools = msg.wordPools || {};
        const timerSeconds = msg.timerSeconds || 30;

        const firstTeam = room.teams[0];
        const firstExplainerId = firstTeam.playerIds[0];
        const firstCat = categories[Math.floor(Math.random() * categories.length)];
        const pool = wordPools[firstCat] || [];
        const firstWord = pickRandomWord(pool, []);

        const playerList = room.players.map(p => {
          const teamId = room.teams.find(t => t.playerIds.includes(p.id))?.id || null;
          return { id: p.id, name: p.name, color: p.color, teamId };
        });

        room.gameState = {
          phase: firstWord ? 'playing' : 'gameOver',
          teams: room.teams,
          players: playerList,
          currentTeamIndex: 0,
          currentExplainerId: firstExplainerId,
          currentCategory: firstCat,
          currentWord: firstWord,
          usedWords: firstWord ? [firstWord] : [],
          timerSeconds,
          turnStartedAt: Date.now(),
          turnScore: 0,
          round: 1,
          categories,
          wordPools,
        };

        // Broadcast filtered state
        for (const p of room.players) {
          if (!p.ws || p.ws.readyState !== 1) continue;
          const state = { ...room.gameState };
          delete state.wordPools;
          if (p.id !== firstExplainerId) state.currentWord = null;
          p.ws.send(JSON.stringify({ type: 'game_started', gameState: state }));
        }
        break;
      }

      case 'correct': {
        if (!roomCode) return;
        const room = rooms.get(roomCode);
        if (!room?.gameState || room.gameState.phase !== 'playing') return;
        if (playerId !== room.gameState.currentExplainerId) return;
        const gs = room.gameState;
        gs.turnScore++;
        const pool = gs.wordPools[gs.currentCategory] || [];
        const newWord = pickRandomWord(pool, gs.usedWords);
        if (newWord) { gs.currentWord = newWord; gs.usedWords.push(newWord); }
        else gs.currentWord = null;
        broadcastGameState(room);
        break;
      }

      case 'skip': {
        if (!roomCode) return;
        const room = rooms.get(roomCode);
        if (!room?.gameState || room.gameState.phase !== 'playing') return;
        if (playerId !== room.gameState.currentExplainerId) return;
        const gs = room.gameState;
        const pool = gs.wordPools[gs.currentCategory] || [];
        const newWord = pickRandomWord(pool, gs.usedWords);
        if (newWord) { gs.currentWord = newWord; gs.usedWords.push(newWord); }
        else gs.currentWord = null;
        broadcastGameState(room);
        break;
      }

      case 'end_turn': {
        if (!roomCode) return;
        const room = rooms.get(roomCode);
        if (!room?.gameState) return;
        if (room.gameState.phase !== 'playing') return;
        advanceTurn(room);
        break;
      }

      case 'end_game': {
        if (!roomCode || role !== 'room_host') return;
        const room = rooms.get(roomCode); if (!room) return;
        room.status = 'finished';
        if (room.gameState) room.gameState.phase = 'gameOver';
        broadcastGameState(room);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (gameId && sessions.has(gameId)) {
      const s = sessions.get(gameId);
      if (role === 'display') s.clients.delete(ws);
      else if (role === 'host') { s.hostWs = null; for (const c of s.clients) { if (c.readyState === 1) c.send(JSON.stringify({ type: 'host_disconnected' })); } }
    }
    if (roomCode && rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      room.players = room.players.filter(p => p.ws !== ws);
      if (role === 'room_host') {
        for (const p of room.players) { if (p.ws?.readyState === 1) p.ws.send(JSON.stringify({ type: 'host_left' })); }
        rooms.delete(roomCode);
      } else {
        for (const t of room.teams) t.playerIds = t.playerIds.filter(id => id !== playerId);
        for (const p of room.players) {
          if (p.ws?.readyState === 1) {
            p.ws.send(JSON.stringify({ type: 'player_left', playerId, players: getPublicPlayers(room) }));
            p.ws.send(JSON.stringify({ type: 'teams_updated', teams: room.teams }));
          }
        }
      }
    }
  });

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

setInterval(() => { wss.clients.forEach((ws) => { if (ws.isAlive === false) return ws.terminate(); ws.isAlive = false; ws.ping(); }); }, 30000);

app.use(express.static(join(__dirname, 'dist')));
app.get('/{*splat}', (_req, res) => { res.sendFile(join(__dirname, 'dist', 'index.html')); });

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Illiterate server running on port ${PORT}`); });
