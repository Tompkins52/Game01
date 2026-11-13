// Friend races: up to four phones in one race, joined with a four-letter pack code.
//
// How it works: the phones talk directly to each other (WebRTC, through the PeerJS library in
// js/vendor). The phone that starts the pack is the host. Every phone runs its own dog, the host
// also runs the computer dogs, and everyone shares what gets eaten, hugged and picked up.
// Nothing is stored on a server; a small public matchmaking service only introduces the phones.

const PREFIX = 'chase-the-cat-v1-';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const SEND_EVERY = 0.066;
const SILENCE_MS = 6000; // during a race, a phone that goes quiet this long has left
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function loadPeer() {
  if (window.Peer) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/peerjs.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the friend race code. Check your connection.'));
    document.head.append(s);
  });
}

function friendly(err) {
  const type = err && err.type;
  if (type === 'browser-incompatible') return new Error('This browser cannot do friend races. Try Chrome or Safari.');
  if (type === 'peer-unavailable') return new Error('No pack with that code. Check the letters.');
  if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
    return new Error('Could not reach the matchmaking service. Check your connection and try again.');
  }
  return err instanceof Error && !type ? err : new Error('Friend races hit a snag. Try again in a moment.');
}

export class Net {
  constructor(opts = {}) {
    this.server = opts.server || null;
    this.isHost = false;
    this.slot = 0;
    this.code = null;
    this.lobby = null;
    this.racing = false;
    this.conns = new Map();
    this.latest = {};
    this.sendT = 0;
    this.endT = 0;
    this.resultsSent = false;
    this.closedFlag = false;
  }

  // ?peer=host:port points the game at your own matchmaking server instead of the public one.
  peerOptions() {
    if (!this.server) return {};
    const [host, port] = this.server.split(':');
    const local = host === 'localhost' || host === '127.0.0.1';
    return { host, port: Number(port) || (local ? 9000 : 443), path: '/', secure: !local };
  }

  open(id) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const peer = id ? new window.Peer(id, this.peerOptions()) : new window.Peer(this.peerOptions());
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        peer.destroy();
        reject(new Error('The matchmaking service did not answer. Try again in a moment.'));
      }, 12000);
      peer.on('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.peer = peer;
        peer.on('disconnected', () => {
          // Lost the matchmaking link. Races already running keep going; try to get it back.
          if (!this.closedFlag && !peer.destroyed) {
            try {
              peer.reconnect();
            } catch (e) { /* will fail quietly */ }
          }
        });
        resolve(peer);
      });
      peer.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          peer.destroy();
          reject(err);
        } else if (this.pendingJoin && err.type === 'peer-unavailable') {
          this.pendingJoin(friendly(err));
        }
      });
    });
  }

  // ------------------------------------------------------------ host
  async host(me, levelId) {
    await loadPeer();
    let lastErr = null;
    for (let i = 0; i < 5 && !this.code; i++) {
      let code = '';
      for (let k = 0; k < 4; k++) code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
      try {
        await this.open(PREFIX + code);
        this.code = code;
      } catch (err) {
        lastErr = err;
        if (err.type !== 'unavailable-id') throw friendly(err);
      }
    }
    if (!this.code) throw friendly(lastErr);
    this.isHost = true;
    this.slot = 0;
    this.lobby = { code: this.code, levelId: levelId || 1, players: [{ slot: 0, dogId: me.dogId, dogLevel: me.dogLevel }] };
    this.peer.on('connection', (conn) => this.accept(conn));
    this.emitLobby();
  }

  accept(conn) {
    conn.on('open', () => {
      const used = new Set(this.lobby.players.map((p) => p.slot));
      for (const c of this.conns.keys()) used.add(c);
      const slot = [1, 2, 3].find((s) => !used.has(s));
      if (this.racing || slot == null) {
        conn.send({ t: 'full', why: this.racing ? 'That pack is in the middle of a race. Try again in a minute.' : 'That pack is full.' });
        setTimeout(() => conn.close(), 400);
        return;
      }
      conn.slot = slot;
      this.conns.set(slot, conn);
    });
    conn.on('data', (m) => this.hostData(conn, m));
    conn.on('close', () => this.drop(conn));
    conn.on('error', () => this.drop(conn));
  }

  hostData(conn, m) {
    const slot = conn.slot;
    if (slot == null || !m || typeof m !== 'object') return;
    conn.seen = now();
    switch (m.t) {
      case 'hello':
      case 'dog': {
        let p = this.lobby.players.find((x) => x.slot === slot);
        if (!p) {
          p = { slot };
          this.lobby.players.push(p);
          this.lobby.players.sort((a, b) => a.slot - b.slot);
        }
        p.dogId = String(m.dogId);
        p.dogLevel = Number(m.dogLevel) || 1;
        if (m.t === 'hello') conn.send({ t: 'welcome', slot });
        this.emitLobby();
        break;
      }
      case 's':
        if (Array.isArray(m.s) && m.s[0] === slot) {
          this.latest[slot] = m.s;
          if (this.onStates) this.onStates([m.s]);
        }
        break;
      case 'e':
        if (m.e && m.e.slot === slot) {
          if (this.onEvent) this.onEvent(m.e);
          this.broadcast({ t: 'e', e: m.e }, slot);
        }
        break;
      case 'f': {
        const ev = { type: 'finish', slot, time: Number(m.time) || 0, dnf: !!m.dnf, stats: m.stats || null };
        if (this.onEvent) this.onEvent(ev);
        this.broadcast({ t: 'e', e: { type: 'finish', slot, time: ev.time, dnf: ev.dnf } }, slot);
        break;
      }
    }
  }

  drop(conn) {
    const slot = conn.slot;
    if (slot == null || this.conns.get(slot) !== conn) return;
    this.conns.delete(slot);
    this.lobby.players = this.lobby.players.filter((p) => p.slot !== slot);
    delete this.latest[slot];
    if (this.racing) {
      if (this.onLeft) this.onLeft(slot);
      this.broadcast({ t: 'left', slot });
    }
    this.emitLobby();
  }

  broadcast(msg, except) {
    for (const [slot, c] of this.conns) {
      if (slot === except || !c.open) continue;
      try {
        c.send(msg);
      } catch (e) { /* that phone is gone; its close event cleans up */ }
    }
  }

  emitLobby() {
    if (this.isHost) this.broadcast({ t: 'lobby', lobby: this.lobby });
    if (this.onLobby) this.onLobby(this.lobby);
  }

  setLevel(levelId) {
    if (!this.isHost) return;
    this.lobby.levelId = levelId;
    this.emitLobby();
  }

  // bots: dog ids to use for the empty spots, in order.
  start(seed, bots) {
    if (!this.isHost || this.racing) return;
    const racers = [];
    let b = 0;
    for (let slot = 0; slot < 4; slot++) {
      const p = this.lobby.players.find((x) => x.slot === slot);
      if (p) racers.push({ slot, dogId: p.dogId, dogLevel: p.dogLevel, bot: false });
      else racers.push({ slot, dogId: bots[b++ % bots.length], dogLevel: 1, bot: true });
    }
    const cfg = { levelId: this.lobby.levelId, seed, racers };
    this.beginRace();
    this.broadcast({ t: 'start', cfg });
    if (this.onStart) this.onStart(cfg);
  }

  beginRace() {
    this.racing = true;
    this.hostSeen = now();
    for (const c of this.conns.values()) c.seen = now();
    this.resultsSent = false;
    this.latest = {};
    this.sendT = 0;
    this.endT = 0;
  }

  // ------------------------------------------------------------ joining
  async join(code, me) {
    await loadPeer();
    try {
      await this.open(null);
    } catch (err) {
      throw friendly(err);
    }
    const conn = this.peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
    this.conn = conn;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => fail(new Error('That pack did not answer. Check the code, or ask the host to start a new pack.')), 12000);
      const fail = (err) => {
        clearTimeout(timer);
        this.pendingJoin = null;
        this.closedFlag = true;
        try {
          this.peer.destroy();
        } catch (e) { /* already gone */ }
        reject(err);
      };
      this.pendingJoin = fail;
      conn.on('open', () => conn.send({ t: 'hello', dogId: me.dogId, dogLevel: me.dogLevel }));
      conn.on('data', (m) => {
        if (m && m.t === 'welcome') {
          clearTimeout(timer);
          this.pendingJoin = null;
          this.slot = m.slot;
          this.code = code;
          resolve();
        } else if (m && m.t === 'full') fail(new Error(m.why || 'That pack is full.'));
        else this.clientData(m);
      });
      conn.on('close', () => this.closed('The host left, so the pack broke up.'));
      conn.on('error', () => this.closed('Lost the connection to the pack.'));
    });
  }

  clientData(m) {
    if (!m || typeof m !== 'object') return;
    this.hostSeen = now();
    switch (m.t) {
      case 'lobby':
        this.lobby = m.lobby;
        this.code = m.lobby.code;
        if (this.onLobby) this.onLobby(this.lobby);
        break;
      case 'start':
        this.beginRace();
        if (this.onStart) this.onStart(m.cfg);
        break;
      case 'S':
        if (this.onStates) this.onStates(m.s.filter((s) => s[0] !== this.slot));
        break;
      case 'e':
        if (this.onEvent) this.onEvent(m.e);
        break;
      case 'left':
        if (this.onLeft) this.onLeft(m.slot);
        break;
      case 'r':
        this.racing = false;
        if (this.onResults) this.onResults(m.r);
        break;
      case 'bye':
        this.closed('The host ended the pack.');
        break;
    }
  }

  setDog(me) {
    if (this.isHost) {
      const p = this.lobby.players.find((x) => x.slot === 0);
      p.dogId = me.dogId;
      p.dogLevel = me.dogLevel;
      this.emitLobby();
    } else if (this.conn && this.conn.open) {
      this.conn.send({ t: 'dog', dogId: me.dogId, dogLevel: me.dogLevel });
    }
  }

  // ------------------------------------------------------------ during a race
  sendEvent(ev) {
    const e = { type: ev.type, slot: ev.slot, id: ev.id, x: Math.round(ev.x || 0), y: Math.round(ev.y || 0), pts: ev.pts, kind: ev.kind, combo: ev.combo, hp: ev.hp, time: ev.time, place: ev.place };
    if (this.isHost) this.broadcast({ t: 'e', e });
    else if (e.type !== 'finish' && this.conn && this.conn.open) this.conn.send({ t: 'e', e });
  }

  // Tell the host this phone's dog is done (or ran out of time).
  sendFinish(race, slot) {
    const d = race.dogs[slot];
    if (d.reported) return;
    d.reported = true;
    if (this.isHost || !this.conn || !this.conn.open) return;
    this.conn.send({
      t: 'f', time: d.time, dnf: !!d.dnf,
      stats: { score: d.score, pts: d.pts, hits: d.hits, bones: d.bones, hugs: d.hugs, chomps: d.chomps, tags: d.tags, pups: d.pups, y: d.y }
    });
  }

  tick(race, localSlot, dt) {
    if (!this.racing) return;
    // Notice phones that dropped off without saying goodbye.
    if (this.isHost) {
      for (const c of [...this.conns.values()]) {
        if (now() - (c.seen || 0) > SILENCE_MS) {
          this.drop(c);
          try {
            c.close();
          } catch (e) { /* already closed */ }
        }
      }
    } else if (now() - (this.hostSeen || 0) > SILENCE_MS) {
      this.closed('Lost the connection to the host.');
      return;
    }
    this.sendT += dt;
    if (this.sendT >= SEND_EVERY) {
      this.sendT = 0;
      if (this.isHost) {
        const list = [];
        for (const d of race.dogs) {
          if (d.control !== 'remote') list.push(race.stateOf(d));
          else if (this.latest[d.slot]) list.push(this.latest[d.slot]);
        }
        this.broadcast({ t: 'S', s: list });
      } else if (this.conn && this.conn.open) {
        this.conn.send({ t: 's', s: race.stateOf(race.dogs[localSlot]) });
      }
    }
    if (this.isHost && !this.resultsSent) {
      const humansDone = race.dogs.every((d) => d.control === 'ai' || d.finished || d.left);
      if (race.phase === 'over') this.sendResults(race);
      else if (humansDone) {
        this.endT += dt;
        if (this.endT > 1.5) this.sendResults(race);
      }
    }
  }

  sendResults(race) {
    this.resultsSent = true;
    if (race.phase !== 'over') race.forceEnd('end');
    const done = race.dogs.filter((d) => !d.dnf && !d.left).sort((a, b) => a.time - b.time);
    const rest = race.dogs.filter((d) => d.dnf || d.left).sort((a, b) => b.y - a.y);
    const res = done.concat(rest).map((d, i) => {
      d.place = i + 1;
      const s = race.summary(d.slot);
      return { slot: d.slot, place: d.place, time: d.time, dnf: !!(d.dnf || d.left), total: s.total, dogId: d.id, bot: d.control === 'ai' };
    });
    this.racing = false;
    this.broadcast({ t: 'r', r: res });
    if (this.onResults) this.onResults(res);
  }

  // ------------------------------------------------------------ leaving
  closed(why) {
    if (this.closedFlag) return;
    this.closedFlag = true;
    this.racing = false;
    try {
      if (this.peer) this.peer.destroy();
    } catch (e) { /* already gone */ }
    if (this.pendingJoin) this.pendingJoin(new Error(why));
    else if (this.onClosed) this.onClosed(why);
  }

  leave() {
    this.closedFlag = true;
    this.racing = false;
    if (this.isHost) this.broadcast({ t: 'bye' });
    setTimeout(() => {
      try {
        if (this.peer) this.peer.destroy();
      } catch (e) { /* already gone */ }
    }, 150);
  }
}
