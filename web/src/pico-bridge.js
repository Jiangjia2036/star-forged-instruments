// Mirrors the Pico across every computer watching the site.
//
// Only the laptop with the board plugged in can read it: Web Serial needs a
// secure context, so it exists on localhost and nowhere else. A teammate who
// opens the site by IP gets a browser that cannot see the instrument at all.
//
// So the host publishes each serial line here, the FastAPI hub fans it out,
// and every other page runs the same lines through the same handler. Their
// keyboards light up and their visualisers react exactly as the host's do.
//
// The address is built from location, never hardcoded. Whatever host the
// visitor typed is the host we talk back to, so a changed laptop IP needs no
// edit here - the same reason /api is requested as a relative URL.

function socketUrl() {
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";

  return scheme + "//" + window.location.host + "/ws";
}


export class PicoBridge {

  constructor({ onLine = () => {}, onStatus = () => {} } = {}) {
    this.onLine = onLine;
    this.onStatus = onStatus;

    this.socket = null;
    this.closed = false;

    // Backoff so a missing backend does not spin the tab
    this.retryMs = 1000;
    this.retryTimer = null;
    this.pending = [];
  }

  connect() {
    this.closed = false;

    let socket;

    try {
      socket = new WebSocket(socketUrl());
    } catch (err) {
      console.log("Mirror unavailable:", err.message);
      this.scheduleRetry();
      return;
    }

    this.socket = socket;

    socket.onopen = () => {
      console.log("Mirror connected");
      this.retryMs = 1000;

      // Preserve serial events emitted while the socket was reconnecting.
      // App sends an authoritative note snapshot from onStatus immediately
      // afterward, so even a long outage converges on the current state.
      const pending = this.pending;
      this.pending = [];
      pending.forEach((line) => socket.send(line));

      this.onStatus(true);
    };

    socket.onmessage = (event) => {
      const line = String(event.data).trim();
      if (line) this.onLine(line);
    };

    socket.onclose = () => {
      this.onStatus(false);
      if (this.socket === socket) this.socket = null;
      this.scheduleRetry();
    };

    // onclose always follows onerror, so retrying is handled there. Swallow
    // this one to keep a missing backend out of the console as an exception.
    socket.onerror = () => {};
  }

  scheduleRetry() {
    if (this.closed || this.retryTimer) return;

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.closed) this.connect();
    }, this.retryMs);

    this.retryMs = Math.min(this.retryMs * 2, 15000);
  }

  // Called only by the machine that owns the serial port
  publish(line) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(line);
      return;
    }

    this.pending.push(line);
    if (this.pending.length > 256) this.pending.shift();
  }

  disconnect() {
    this.closed = true;
    this.pending = [];

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
