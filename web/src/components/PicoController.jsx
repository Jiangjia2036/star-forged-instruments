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

      const selectedPort =
        await navigator.serial.requestPort();

      console.log(
        "Pico selected:",
        selectedPort
      );

      await selectedPort.open({
        baudRate: 115200,
      });

      console.log("Serial port opened");

      setPort(selectedPort);
      setStatus("Connected");

      readFromPico(selectedPort);

    } catch (error) {
      console.error(
        "Connection error:",
        error
      );

      setStatus("Connection failed");
    }
  }

  async function readFromPico(selectedPort) {
    const decoder = new TextDecoder();

    let buffer = "";

    console.log(
      "Starting to read from Pico..."
    );

    while (selectedPort.readable) {
      const reader =
        selectedPort.readable.getReader();

      try {
        while (true) {
          const { value, done } =
            await reader.read();

          if (done) {
            console.log(
              "Serial reader finished"
            );
            break;
          }

          if (!value) {
            continue;
          }

          const text =
            decoder.decode(value);

          console.log(
            "RAW FROM PICO:",
            text
          );

          buffer += text;

          const lines =
            buffer.split("\n");

          buffer = lines.pop();

          for (const line of lines) {
            const message = line.trim();

            if (!message) {
              continue;
            }

            console.log(
              "PICO MESSAGE:",
              message
            );

            if (
              message ===
              "BUTTON_1_DOWN"
            ) {
              console.log(
                "BUTTON 1 DOWN!"
              );

              setButtonState(
                "BUTTON 1 DOWN"
              );

              onButtonDown?.(0);
            }

            else if (
              message ===
              "BUTTON_1_UP"
            ) {
              console.log(
                "BUTTON 1 UP!"
              );

              setButtonState("UP");

              onButtonUp?.(0);
            }

            else if (
              message ===
              "BUTTON_2_DOWN"
            ) {
              console.log(
                "BUTTON 2 DOWN!"
              );

              setButtonState(
                "BUTTON 2 DOWN"
              );

              onButtonDown?.(1);
            }

            else if (
              message ===
              "BUTTON_2_UP"
            ) {
              console.log(
                "BUTTON 2 UP!"
              );

              setButtonState("UP");

              onButtonUp?.(1);
            }

            else if (
              message ===
              "BUTTON_3_DOWN"
            ) {
              console.log(
                "BUTTON 3 DOWN!"
              );

              setButtonState(
                "BUTTON 3 DOWN"
              );

              onButtonDown?.(2);
            }

            else if (
              message ===
              "BUTTON_3_UP"
            ) {
              console.log(
                "BUTTON 3 UP!"
              );

              setButtonState("UP");

              onButtonUp?.(2);
            }
          }
        }

      } catch (error) {
        console.error(
          "Reading error:",
          error
        );

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