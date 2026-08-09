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

Use Chrome or Edge for Web Serial. Open `http://localhost:5173`, select
**Connect Pico**, and choose the Adafruit/CircuitPython serial port.

Use `localhost` (or `127.0.0.1`) rather than your IP address here — Web Serial
is unavailable on any other host over plain HTTP. See
[Hosting on your laptop](#hosting-on-your-laptop-for-other-computers).

To show the API as online, run this from the repository root in a second
terminal:

```powershell
.\.venv\Scripts\fastapi dev backend\main.py
```

## Hosting on your laptop, for other computers

`npm run dev` already listens on every network interface — `server.host` is
set in `vite.config.js`, so the `--host` flag is no longer needed (passing it
anyway does no harm). Vite prints the addresses on startup:

```text
→  Local:    http://localhost:5173/
→  Network:  http://192.168.50.184:5173/   Wi-Fi
```

Give teammates the **Wi-Fi** address. Ignore the VMware and vEthernet ones —
those are virtual adapters that only exist on your machine.

Also start the backend, or the site shows "Local mode" and the terminal fills
with `ECONNREFUSED 127.0.0.1:8000`:

```powershell
.\.venv\Scripts\fastapi dev backend\main.py
```

### There is no IP to hard-code

The client never names a host. It requests `/api/...` as a relative URL, so it
resolves to whatever address the visitor typed, and Vite forwards it onward
from your machine. **When your laptop's IP changes, nothing needs editing.**

That is also why `VITE_API_TARGET` in `.env` stays `127.0.0.1:8000` even when
hosting for others: the proxy runs on your machine and reaches the backend
over its own loopback. Change it only if the backend moves to a different
computer.

Both env files work the usual Vite way — `.env` holds shared defaults and is
committed, `.env.local` overrides it and is gitignored. Restart the dev server
after editing either; env files are read once at startup.

### The board mirrors to every viewer

Other computers show the same instrument state as the host — notes lighting
up, the volume knob, sustain, and the visualiser reacting — even though their
browsers cannot see the Pico at all.

```text
   Pico ──USB──▶ host browser ──▶ /ws ──▶ FastAPI hub ──▶ every other browser
                 (localhost)                                (opened by IP)
```

The host publishes each serial line it reads. The hub in `backend/main.py`
fans it out to everyone else, and each viewer runs those lines through the
same `handleLine` that the host uses — so anything the host derives from
serial, a viewer derives identically. New Pico messages mirror for free
without touching this code.

A viewer who arrives mid-song is not left blank: the hub keeps the last value
of each state message plus the set of currently held notes, and replays them
on connect. One-shots like `FLEX_ALIEN` are relayed but never replayed —
firing the alien sound at someone the moment they open the page would be
wrong.

The status chip reads **Mirroring** on a viewer, against **Connected** on the
host. Both need the backend running; without it the site still works, viewers
simply stop mirroring and retry in the background.

The WebSocket address is built from `location`, exactly like `/api`, so there
is no IP to update here either.

### Connect Pico only works on the host machine

This is a browser rule, not a bug in the site. **Web Serial requires a secure
context**, meaning HTTPS or `localhost`. Over a plain `http://192.168.x.x`
address `navigator.serial` does not exist, so **Connect Pico** reports that
Web Serial is unsupported. Verified on this setup:

| Opened at | `isSecureContext` | `navigator.serial` |
| --------- | ----------------- | ------------------ |
| `http://localhost:5173` | true | available |
| `http://192.168.50.184:5173` | false | **missing** |

So run the instrument from `http://localhost:5173` on the laptop the Pico is
plugged into, and let everyone else watch on the IP address. Because of the
mirror above, they still see everything the board does — they just cannot
open the port themselves, which is why their **Connect Pico** button is
replaced by a **Viewer** label rather than a button that could only fail.

If a teammate genuinely needs to *drive* the Pico from their own machine,
serve over HTTPS instead (`npm i -D @vitejs/plugin-basic-ssl`, add the plugin,
and accept the self-signed certificate warning on each computer).

### If nobody can reach it

Windows Firewall blocks incoming connections to Node on a new network by
default. Allow it when prompted, or check that the network is set to
**Private** rather than Public. Everyone also has to be on the same Wi-Fi —
a phone on cellular will not reach it.

## Checks

```powershell
npm run lint
npm run build
```

Physical Pico button events are visual-only in the browser. Their audio comes
from the I2S device connected to the Pico, which prevents delayed doubled
notes from the computer speakers.
