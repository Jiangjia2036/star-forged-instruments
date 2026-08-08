// Web Serial connection to the Pico. Reads newline-delimited messages and
// hands each complete line to onLine. UI logic lives elsewhere.

export function isSerialSupported() {
  return "serial" in navigator;
}

export class PicoSerial {
  constructor({ onLine, onConnect, onDisconnect }) {
    this.onLine = onLine;
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;
    this.port = null;
    this.reader = null;
    this.keepReading = false;
  }

  async connect() {
    // requestPort must be called from a user gesture (the Connect Pico click)
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: 115200 });

    // MicroPython discards stdout unless the host asserts DTR: without this
    // the port opens fine but no print() output ever arrives
    try {
      await this.port.setSignals({
        dataTerminalReady: true,
        requestToSend: true,
      });
    } catch (err) {
      console.log("setSignals failed:", err.message);
    }

    this.keepReading = true;
    console.log("Pico connected");
    this.onConnect();
    this.readLoop();
  }

  async readLoop() {
    const decoder = new TextDecoder();
    let buffer = "";

    // one reader for the life of the connection; re-acquiring it in a loop can
    // spin without ever yielding if the stream is already finished
    if (!this.port || !this.port.readable) {
      await this.close();
      return;
    }

    this.reader = this.port.readable.getReader();

    try {
      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        // a stream with no newlines would otherwise grow without bound
        if (buffer.length > 4096) buffer = "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            console.log("Received:", trimmed);
            try {
              this.onLine(trimmed);
            } catch (err) {
              // one bad message must not tear down the connection
              console.log("Message handler error:", err.message);
            }
          }
        }
      }
    } catch (err) {
      // cable unplugged or read failure
      console.log("Pico read error:", err.message);
    } finally {
      try {
        this.reader.releaseLock();
      } catch {
        // lock already released
      }
      this.reader = null;
    }

    await this.close();
  }

  async disconnect() {
    this.keepReading = false;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // reader already failed; close() below still runs
      }
    }
  }

  async close() {
    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // port already gone (cable pulled)
      }
      this.port = null;
      console.log("Pico disconnected");
      this.onDisconnect();
    }
  }
}
