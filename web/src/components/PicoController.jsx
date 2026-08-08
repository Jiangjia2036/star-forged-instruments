import { useState } from "react";

function PicoController({ onButtonDown, onButtonUp }) {
  const [port, setPort] = useState(null);
  const [status, setStatus] = useState("Disconnected");
  const [buttonState, setButtonState] = useState("UP");

  async function connectPico() {
    try {
      if (!("serial" in navigator)) {
        setStatus("Web Serial is not supported");
        return;
      }

      console.log("Requesting Pico...");

      const selectedPort = await navigator.serial.requestPort();

      console.log("Pico selected:", selectedPort);

      await selectedPort.open({
        baudRate: 115200,
      });

      console.log("Serial port opened");

      setPort(selectedPort);
      setStatus("Connected");

      readFromPico(selectedPort);
    } catch (error) {
      console.error("Connection error:", error);
      setStatus("Connection failed");
    }
  }

  async function readFromPico(selectedPort) {
    const decoder = new TextDecoder();
    let buffer = "";

    let firstMessage = true;

    console.log("Starting to read from Pico...");

    while (selectedPort.readable) {
      const reader = selectedPort.readable.getReader();

      try {
        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            console.log("Serial reader finished");
            break;
          }

          if (value) {
            const text = decoder.decode(value);

            console.log("RAW FROM PICO:", text);

            buffer += text;

            const lines = buffer.split("\n");

            buffer = lines.pop();

            for (const line of lines) {
              const message = line.trim();

              if (!message) {
                continue;
              }

              console.log("PICO MESSAGE:", message);

              if (firstMessage) {
                console.log(
                  "Ignoring initial Pico button state:",
                  message
                );

                if (message === "BUTTON_DOWN") {
                  setButtonState("DOWN");
                } else if (message === "BUTTON_UP") {
                  setButtonState("UP");
                }

                firstMessage = false;
                continue;
              }

              if (message === "BUTTON_DOWN") {
                console.log("BUTTON DOWN!");

                setButtonState("DOWN");

                onButtonDown?.();
              }

              if (message === "BUTTON_UP") {
                console.log("BUTTON UP!");

                setButtonState("UP");

                onButtonUp?.();
              }
            }
          }
        }
      } catch (error) {
        console.error("Reading error:", error);
      } finally {
        reader.releaseLock();
      }
    }
  }

  return (
    <div>
      <button onClick={connectPico}>
        Connect Pico
      </button>

      <p>Status: {status}</p>

      <p>Button: {buttonState}</p>
    </div>
  );
}

export default PicoController;