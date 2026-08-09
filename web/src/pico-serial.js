// Web Serial connection to the Pico.
// Reads newline-delimited messages and sends each complete line
// to the supplied onLine callback.

export function isSerialSupported() {
  return "serial" in navigator;
}


export class PicoSerial {

  constructor({
    onLine = () => {},
    onConnect = () => {},
    onDisconnect = () => {},
  }) {
    this.onLine = onLine;
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;

    this.port = null;
    this.reader = null;
    this.writer = null;

    this.keepReading = false;
    this.readTask = null;
  }


  // =========================================================
  // SEND A COMMAND TO THE PICO
  // =========================================================

  // Used by song playback to drive the Pico's own speaker. Newline
  // terminated, matching the protocol the Pico prints.

  async send(line) {

    if (!this.port || !this.port.writable) {
      return;
    }

    try {

      if (!this.writer) {
        this.writer = this.port.writable.getWriter();
      }

      await this.writer.write(
        new TextEncoder().encode(line + "\n")
      );

    } catch (err) {

      console.log(
        "Pico send failed:",
        err.message
      );

    }
  }


  releaseWriter() {

    if (this.writer) {

      try {
        this.writer.releaseLock();
      } catch {
        // already released
      }

      this.writer = null;
    }
  }


  // =========================================================
  // CONNECT
  // =========================================================

  async connect() {

    // Prevent connecting twice
    if (this.port) {
      console.log("Pico is already connected.");
      return;
    }

    try {

      // Must be called from a user action,
      // such as clicking "Connect Pico"
      this.port = await navigator.serial.requestPort();


      // MicroPython enumerates as Raspberry Pi (0x2E8A); CircuitPython as
      // Adafruit (0x239A). Bluetooth and other serial ports open fine but
      // never send note data, which looks identical to a silent connection.
      const PICO_VENDORS = [0x2e8a, 0x239a];
      const info = this.port.getInfo();

      if (!PICO_VENDORS.includes(info.usbVendorId)) {

        console.warn(
          "Selected port is not a Raspberry Pi Pico " +
          "(expected USB vendor 0x2E8A, got " +
          (info.usbVendorId
            ? "0x" + info.usbVendorId.toString(16)
            : "none — likely a Bluetooth port") +
          "). Reconnect and choose the Pico."
        );

      }


      await this.port.open({
        baudRate: 115200,
      });


      // Assert DTR/RTS for compatibility with USB serial.
      try {

        await this.port.setSignals({
          dataTerminalReady: true,
          requestToSend: true,
        });

      } catch (err) {

        console.log(
          "setSignals failed:",
          err.message
        );

      }


      this.keepReading = true;

      console.log("Pico connected");

      this.onConnect();


      // Start serial reading
      this.readTask = this.readLoop();

    } catch (err) {

      console.error(
        "Could not connect to Pico:",
        err
      );

      this.keepReading = false;

      // Clean up partially opened connection
      if (this.port) {

        try {
          await this.port.close();
        } catch {
          // Port may not have opened
        }

      }

      this.port = null;

      throw err;
    }
  }


  // =========================================================
  // READ SERIAL DATA
  // =========================================================

  async readLoop() {

    if (!this.port || !this.port.readable) {
      await this.close();
      return;
    }


    const decoder = new TextDecoder();

    let buffer = "";


    this.reader = this.port.readable.getReader();


    try {

      while (this.keepReading) {

        const {
          value,
          done
        } = await this.reader.read();


        if (done) {
          break;
        }


        if (!value) {
          continue;
        }


        // Convert incoming bytes to text
        buffer += decoder.decode(
          value,
          {
            stream: true
          }
        );


        // Pico print() messages end in newline
        const lines = buffer.split("\n");


        // Keep unfinished line for next USB packet
        buffer = lines.pop() || "";


        // Protection against malformed streams
        if (buffer.length > 4096) {

          console.warn(
            "Serial buffer exceeded limit. Clearing."
          );

          buffer = "";
        }


        // Process completed lines
        for (const line of lines) {

          const trimmed = line.trim();


          if (!trimmed) {
            continue;
          }


          console.log(
            "Received from Pico:",
            trimmed
          );


          try {

            this.onLine(trimmed);

          } catch (err) {

            console.error(
              "Message handler error:",
              err
            );

          }
        }
      }

    } catch (err) {

      console.error(
        "Pico serial read error:",
        err
      );

    } finally {

      if (this.reader) {

        try {
          this.reader.releaseLock();
        } catch {
          // Reader already released
        }

      }

      this.reader = null;

    }


    await this.close();
  }


  // =========================================================
  // DISCONNECT
  // =========================================================

  async disconnect() {

    this.keepReading = false;


    if (this.reader) {

      try {

        await this.reader.cancel();

      } catch (err) {

        console.log(
          "Reader cancellation:",
          err.message
        );

      }

    }


    // Wait for readLoop() to finish cleanup
    if (this.readTask) {

      try {
        await this.readTask;
      } catch {
        // Error already handled in readLoop
      }

    } else {

      await this.close();

    }


    this.readTask = null;
  }


  // =========================================================
  // CLOSE PORT
  // =========================================================

  async close() {

    this.keepReading = false;


    if (!this.port) {
      return;
    }


    // The port cannot close while a writer holds its lock
    this.releaseWriter();


    try {

      await this.port.close();

    } catch (err) {

      console.log(
        "Port close:",
        err.message
      );

    }


    this.port = null;

    console.log(
      "Pico disconnected"
    );


    try {

      this.onDisconnect();

    } catch (err) {

      console.error(
        "Disconnect handler error:",
        err
      );

    }
  }
}