# Star Forged web interface

The Vite/React site connects directly to the CircuitPython board through Web
Serial. FastAPI supplies ordinary HTTP endpoints and serves the production
build; it never opens the Pico's COM port.

## Development

From `web/`:

```powershell
npm install
npm run dev
```

Use Chrome or Edge for Web Serial. Open `http://127.0.0.1:5173`, select
**Connect Pico**, and choose the Adafruit/CircuitPython serial port.

To show the API as online, run this from the repository root in a second
terminal:

```powershell
.\.venv\Scripts\fastapi dev backend\main.py
```

## Checks

```powershell
npm run lint
npm run build
```

Physical Pico button events are visual-only in the browser. Their audio comes
from the I2S device connected to the Pico, which prevents delayed doubled
notes from the computer speakers.
