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

// ═══════════════════════════════════════════════════════════════
// DISPLAY SESSIONS (TV board — unchanged)
// ═══════════════════════════════════════════════════════════════

const sessions = new Map();
function generateGameId() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let id = '';
  for (let i = 0; i < 6; i++) id += c[Math.floor(Math.random() * c.length)];
  return sessions.has(id) ? generateGameId() : id;
}

// ═══════════════════════════════════════════════════════════════
// MULTIPLAYER ROOMS
// ═══════════════════════════════════════════════════════════════

const rooms = new Map();
const TEAM_COLORS = ['#C0392B', '#2471A3', '#1E8449', '#7D3C98', '#D4A017', '#117A65'];
const PLAYER_COLORS = ['#E74C3C', '#5DADE2', '#2ECC71', '#AF7AC5', '#F4D03F', '#1ABC9C', '#E67E22', '#3498DB', '#9B59B6', '#E91E63', '#00BCD4', '#8BC34A'];

function genRoomCode() {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  return rooms.has(code) ? genRoomCode() : code;
}

function pubPlayers(room) {
  return room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, color: p.color }));
}

function pickWord(pool, used) {
  // Normalize both sides for comparison
  const usedNorm = new Set(used.map(normalizeWord));
  const avail = pool.filter(w => !usedNorm.has(normalizeWord(w)));
  return avail.length ? avail[Math.floor(Math.random() * avail.length)] : null;
}

/** Send filtered game state to each player — word ONLY to explainer */
function broadcastState(room, type = 'game_update') {
  const gs = room.gameState; if (!gs) return;
  for (const p of room.players) {
    if (!p.ws || p.ws.readyState !== 1) continue;
    const s = { ...gs };
    delete s.wordPools;
    delete s.categories;
    delete s.usedWords;
    if (p.id !== gs.currentExplainerId) s.currentWord = null;
    p.ws.send(JSON.stringify({ type, gameState: s }));
  }
}

function broadcastAll(room, msg) {
  const payload = JSON.stringify(msg);
  for (const p of room.players) { if (p.ws?.readyState === 1) p.ws.send(payload); }
}

function advanceTurn(room) {
  const gs = room.gameState; if (!gs) return;
  clearTimeout(room.turnTimer);

  const curTeam = gs.teams[gs.currentTeamIndex];
  const lastTeamName = curTeam.name;
  const lastScore = gs.turnScore;
  curTeam.score += gs.turnScore;

  // Rotate explainer within team
  curTeam.currentExplainerIndex = (curTeam.currentExplainerIndex + 1) % curTeam.playerIds.length;

  // Next team
  gs.currentTeamIndex = (gs.currentTeamIndex + 1) % gs.teams.length;
  if (gs.currentTeamIndex === 0) gs.round++;

  const nextTeam = gs.teams[gs.currentTeamIndex];
  const nextExplainerId = nextTeam.playerIds[nextTeam.currentExplainerIndex];
  const nextExplainer = gs.players.find(p => p.id === nextExplainerId);

  // Pick new category and word
  const cat = gs.categories[Math.floor(Math.random() * gs.categories.length)];
  const pool = gs.wordPools[cat] || [];
  const word = pickWord(pool, gs.usedWords);

  // Build summary
  const summary = {
    phase: 'turnSummary',
    lastTurnTeamName: lastTeamName,
    lastTurnScore: lastScore,
    nextTeamName: nextTeam.name,
    nextExplainerName: nextExplainer?.name || 'Unknown',
    teams: gs.teams,
    players: gs.players,
    currentTeamIndex: gs.currentTeamIndex,
    currentExplainerId: nextExplainerId,
    turnScore: 0,
    round: gs.round,
    timerSeconds: gs.timerSeconds,
    turnStartedAt: gs.turnStartedAt,
    currentCategory: cat,
    currentWord: null, // don't reveal next word during summary
  };

  // Broadcast turn summary
  broadcastAll(room, { type: 'turn_end', summary });

  if (!word) {
    // No more words — game over after summary
    setTimeout(() => {
      gs.phase = 'gameOver';
      broadcastAll(room, { type: 'game_over', finalScores: gs.teams });
    }, 4000);
    return;
  }

  // After 4 seconds, start next turn
  setTimeout(() => {
    gs.currentTeamIndex = summary.currentTeamIndex;
    gs.currentExplainerId = nextExplainerId;
    gs.currentCategory = cat;
    gs.currentWord = word;
    gs.usedWords.push(word);
    gs.turnScore = 0;
    gs.turnStartedAt = Date.now();
    gs.phase = 'playing';

    broadcastState(room);

    // Server-managed turn timer
    room.turnTimer = setTimeout(() => advanceTurn(room), gs.timerSeconds * 1000);
  }, 4000);
}

// Cleanup every 30 min
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) { if (!s.hostWs && now - s.createdAt > 6 * 3600000) sessions.delete(id); }
  for (const [c, r] of rooms) { if (now - r.createdAt > 24 * 3600000) { clearTimeout(r.turnTimer); rooms.delete(c); } }
}, 1800000);

// ═══════════════════════════════════════════════════════════════
// REST API
// ═══════════════════════════════════════════════════════════════

app.use(express.json());

// Health check — verify server is running latest code
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '2026-08-18', rooms: rooms.size, sessions: sessions.size, uptime: Math.floor(process.uptime()) });
});

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
  res.json({ roomCode: r.code, status: r.status, players: pubPlayers(r) });
});

// ── Word Generation ─────────────────────────────────────────────

const WORD_GEN_PROMPT = `You are a word generator for a party guessing game.

CATEGORY: "{{CATEGORY}}"

BANNED WORDS — YOU MUST NOT OUTPUT ANY OF THESE:
{{BANNED_LIST}}

RULES:
1. Return ONLY a valid JSON array of strings. No markdown. No explanation. No backticks.
2. Generate exactly {{COUNT}} items.
3. Every item must clearly and unambiguously belong to "{{CATEGORY}}".
4. BEFORE including any word, check it against the BANNED WORDS list above. If it matches in any form — singular/plural, with or without "the/a/an", different capitalisation, common abbreviation — DO NOT include it. Pick another.
5. Every word in your output must also be unique from every OTHER word in your output.
6. Do not output synonyms or close variants of banned words. If "automobile" is banned, "car", "auto", and "vehicle" are also banned.
7. Go specific and deep — if obvious words are banned, explore less obvious members of the category rather than recycling.
8. Mix difficulty: 40% easy, 40% medium, 20% hard.

SELF-CHECK BEFORE RESPONDING:
- Is every item genuinely in "{{CATEGORY}}"? ✓
- Is every item absent from the BANNED list? ✓
- Is every item unique within your output? ✓
- Is the total exactly {{COUNT}} items? ✓
Only output after all four pass.

Output format: ["word one", "word two", "word three"]`;

function normalizeWord(w) { return w.toLowerCase().replace(/^(the|a|an) /i, '').replace(/[^a-z0-9]/g, '').trim(); }

app.post('/api/generate-words', async (req, res) => {
  const { category, usedWords = [], count = 60 } = req.body;
  if (!category) return res.status(400).json({ error: 'category is required' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(501).json({ error: 'no_api_key' });

  // Format ban list with numbering for clarity
  const banList = usedWords.length > 0
    ? usedWords.map((w, i) => `${i + 1}. ${w}`).join('\n')
    : '(none yet)';

  // Request 50% more to absorb filtering
  const requestCount = Math.ceil(count * 1.5);
  const prompt = WORD_GEN_PROMPT.replace(/\{\{CATEGORY\}\}/g, category).replace('{{BANNED_LIST}}', banList).replace(/\{\{COUNT\}\}/g, String(requestCount));

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4096, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) return res.status(502).json({ error: 'llm_error' });
    const d = await r.json(); const text = d.content?.[0]?.text ?? '[]';
    let candidates;
    try { candidates = JSON.parse(text); if (!Array.isArray(candidates)) throw 0; candidates = candidates.filter(w => typeof w === 'string' && w.trim()); }
    catch { const m = text.match(/\[[\s\S]*\]/); if (m) candidates = JSON.parse(m[0]).filter(w => typeof w === 'string'); else return res.status(502).json({ error: 'parse_error' }); }

    // Server-side dedup — never trust the model alone
    const usedSet = new Set(usedWords.map(normalizeWord));
    const seen = new Set(usedSet);
    const fresh = [];
    for (const word of candidates) {
      const key = normalizeWord(word);
      if (key.length > 0 && !seen.has(key)) {
        seen.add(key);
        fresh.push(word);
      }
      if (fresh.length >= count) break;
    }

    res.json({ words: fresh });
  } catch (err) { console.error('Word gen error:', err); res.status(500).json({ error: 'server_error' }); }
});

// ═══════════════════════════════════════════════════════════════
// WEBSOCKET
// ═══════════════════════════════════════════════════════════════

wss.on('connection', (ws, req) => {
  console.log('[WS] New connection from:', req.headers.origin || 'unknown');
  let gameId = null, role = null, roomCode = null, playerId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {

      // ── Display (unchanged) ───────────────────────────────
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

      // ── Create Room ───────────────────────────────────────
      case 'create_room': {
        const code = genRoomCode();
        const id = crypto.randomUUID();
        playerId = id; roomCode = code; role = 'room_host';
        console.log(`[ROOM] Creating room ${code} for ${msg.hostName}`);
        const room = {
          code, hostId: id, status: 'lobby',
          players: [{ id, name: msg.hostName || 'Host', isHost: true, ws, color: PLAYER_COLORS[0] }],
          teams: [], gameState: null, turnTimer: null, createdAt: Date.now(),
          config: { categories: msg.categories || [], timerSeconds: msg.timerSeconds || 30, numTeams: msg.numTeams || 2, wordPools: msg.wordPools || {} },
        };
        rooms.set(code, room);
        ws.send(JSON.stringify({ type: 'room_created', roomCode: code, playerId: id, players: pubPlayers(room) }));
        console.log(`[ROOM] Room ${code} created. Total rooms: ${rooms.size}`);
        break;
      }

      // ── Join Room ─────────────────────────────────────────
      case 'join_room': {
        const code = msg.roomCode;
        const room = rooms.get(code);
        if (!room) { ws.send(JSON.stringify({ type: 'join_error', message: 'Room not found. Check the code.' })); return; }
        if (room.status !== 'lobby') { ws.send(JSON.stringify({ type: 'join_error', message: 'Game already in progress.' })); return; }
        if (room.players.length >= 12) { ws.send(JSON.stringify({ type: 'join_error', message: 'Room is full.' })); return; }

        const id = crypto.randomUUID();
        playerId = id; roomCode = code; role = 'room_player';
        room.players.push({ id, name: msg.playerName || 'Player', isHost: false, ws, color: PLAYER_COLORS[room.players.length % PLAYER_COLORS.length] });

        ws.send(JSON.stringify({ type: 'room_joined', roomCode: code, playerId: id, players: pubPlayers(room) }));
        for (const p of room.players) {
          if (p.ws && p.ws !== ws && p.ws.readyState === 1) p.ws.send(JSON.stringify({ type: 'player_joined', players: pubPlayers(room) }));
        }
        // Send teams if already set
        if (room.teams.length > 0) ws.send(JSON.stringify({ type: 'teams_set', teams: room.teams }));
        break;
      }

      // ── Auto Assign Teams ─────────────────────────────────
      case 'auto_assign': {
        if (!roomCode || role !== 'room_host') return;
        const room = rooms.get(roomCode); if (!room) return;
        const n = room.config.numTeams || 2;
        const shuffled = [...room.players].sort(() => Math.random() - 0.5);
        const teams = Array.from({ length: n }, (_, i) => ({
          id: `team_${i}`, name: `Team ${i + 1}`, color: TEAM_COLORS[i % TEAM_COLORS.length],
          score: 0, playerIds: [], currentExplainerIndex: 0,
        }));
        shuffled.forEach((p, i) => { teams[i % n].playerIds.push(p.id); });
        room.teams = teams;
        broadcastAll(room, { type: 'teams_set', teams });
        break;
      }

      // ── Manual Assign Teams ───────────────────────────────
      case 'assign_teams': {
        if (!roomCode || role !== 'room_host') return;
        const room = rooms.get(roomCode); if (!room) return;
        room.teams = msg.teams.map((t, i) => ({
          id: `team_${i}`, name: t.name || `Team ${i + 1}`, color: t.color || TEAM_COLORS[i % TEAM_COLORS.length],
          score: 0, playerIds: t.playerIds || [], currentExplainerIndex: 0,
        }));
        broadcastAll(room, { type: 'teams_set', teams: room.teams });
        break;
      }

      // ── Kick Player ───────────────────────────────────────
      case 'kick_player': {
        if (!roomCode || role !== 'room_host') return;
        const room = rooms.get(roomCode); if (!room) return;
        const target = room.players.find(p => p.id === msg.playerId);
        if (target && !target.isHost) {
          if (target.ws?.readyState === 1) target.ws.send(JSON.stringify({ type: 'kicked' }));
          room.players = room.players.filter(p => p.id !== msg.playerId);
          for (const t of room.teams) t.playerIds = t.playerIds.filter(id => id !== msg.playerId);
          broadcastAll(room, { type: 'player_left', players: pubPlayers(room) });
          broadcastAll(room, { type: 'teams_set', teams: room.teams });
        }
        break;
      }

      // ── Start Game ────────────────────────────────────────
      case 'start_game': {
        if (!roomCode || role !== 'room_host') return;
        const room = rooms.get(roomCode); if (!room) return;
        if (room.teams.length < 2 || room.teams.some(t => t.playerIds.length === 0)) {
          ws.send(JSON.stringify({ type: 'room_error', message: 'All teams need at least 1 player.' }));
          return;
        }

        room.status = 'playing';
        const cfg = room.config;
        const cats = cfg.categories.length > 0 ? cfg.categories : ['ACTION', 'OBJECT', 'NATURE', 'PERSON', 'WORLD', 'RANDOM'];
        const firstTeam = room.teams[0];
        const firstExplainerId = firstTeam.playerIds[0];
        const firstCat = cats[Math.floor(Math.random() * cats.length)];
        const pool = cfg.wordPools[firstCat] || [];
        const firstWord = pickWord(pool, []);

        const playerList = room.players.map(p => {
          const teamId = room.teams.find(t => t.playerIds.includes(p.id))?.id || null;
          return { id: p.id, name: p.name, color: p.color, teamId };
        });

        room.gameState = {
          phase: 'playing', teams: room.teams, players: playerList,
          currentTeamIndex: 0, currentExplainerId: firstExplainerId,
          currentCategory: firstCat, currentWord: firstWord,
          usedWords: firstWord ? [firstWord] : [], timerSeconds: cfg.timerSeconds,
          turnStartedAt: Date.now(), turnScore: 0, round: 1,
          categories: cats, wordPools: cfg.wordPools,
        };

        broadcastState(room, 'game_started');

        // Server-managed turn timer
        room.turnTimer = setTimeout(() => advanceTurn(room), cfg.timerSeconds * 1000);
        break;
      }

      // ── Correct ───────────────────────────────────────────
      case 'correct': {
        if (!roomCode) return;
        const room = rooms.get(roomCode);
        if (!room?.gameState || room.gameState.phase !== 'playing') return;
        if (playerId !== room.gameState.currentExplainerId) return;
        const gs = room.gameState;
        gs.turnScore++;
        const pool = gs.wordPools[gs.currentCategory] || [];
        const w = pickWord(pool, gs.usedWords);
        if (w) { gs.currentWord = w; gs.usedWords.push(w); } else gs.currentWord = null;
        broadcastState(room);
        break;
      }

      // ── Skip ──────────────────────────────────────────────
      case 'skip': {
        if (!roomCode) return;
        const room = rooms.get(roomCode);
        if (!room?.gameState || room.gameState.phase !== 'playing') return;
        if (playerId !== room.gameState.currentExplainerId) return;
        const gs = room.gameState;
        const pool = gs.wordPools[gs.currentCategory] || [];
        const w = pickWord(pool, gs.usedWords);
        if (w) { gs.currentWord = w; gs.usedWords.push(w); } else gs.currentWord = null;
        broadcastState(room);
        break;
      }

      // ── End Game (host only) ──────────────────────────────
      case 'end_game': {
        if (!roomCode || role !== 'room_host') return;
        const room = rooms.get(roomCode); if (!room) return;
        clearTimeout(room.turnTimer);
        room.status = 'finished';
        broadcastAll(room, { type: 'game_over', finalScores: room.gameState?.teams || room.teams });
        break;
      }
    }
  });

  ws.on('close', () => {
    // Display cleanup
    if (gameId && sessions.has(gameId)) {
      const s = sessions.get(gameId);
      if (role === 'display') s.clients.delete(ws);
      else if (role === 'host') { s.hostWs = null; for (const c of s.clients) { if (c.readyState === 1) c.send(JSON.stringify({ type: 'host_disconnected' })); } }
    }
    // Room cleanup
    if (roomCode && rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      room.players = room.players.filter(p => p.ws !== ws);
      if (role === 'room_host') {
        clearTimeout(room.turnTimer);
        broadcastAll(room, { type: 'host_left' });
        rooms.delete(roomCode);
      } else {
        for (const t of room.teams) t.playerIds = t.playerIds.filter(id => id !== playerId);
        broadcastAll(room, { type: 'player_left', players: pubPlayers(room) });
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
server.listen(PORT, () => { console.log(`Illiterate server on port ${PORT}`); });
