"""FastAPI entry point for the Star Forged Instruments website.

The Pico connection deliberately stays in the browser through Web Serial.
FastAPI owns ordinary HTTP concerns: health/configuration APIs and serving the
built Vite frontend. This avoids two processes competing for the board's COM
port.
"""

from pathlib import Path
from typing import Literal

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIST = PROJECT_ROOT / "web" / "dist"


class HealthResponse(BaseModel):
    status: Literal["ok"]
    frontend_built: bool
    serial_transport: Literal["web-serial"]


class ProjectResponse(BaseModel):
    name: str
    pages: list[str]
    architecture: dict[str, str]


app = FastAPI(
    title="Star Forged Instruments API",
    version="0.1.0",
    description=(
        "HTTP services for the Star Forged showcase. The browser retains "
        "exclusive ownership of the Pico Web Serial connection."
    ),
)

# Vite uses a different origin during development. Keep the list explicit so
# a production deployment does not accidentally accept every website.
#
# The regex additionally covers other computers on the same network, for when
# the site is hosted off this laptop and a teammate opens it by IP. It is
# limited to the private ranges (192.168.x, 10.x, 172.16-31.x) so a public
# website still cannot call this API.
#
# Note this only matters when the backend is reached DIRECTLY, as in the
# production-style run in README.md. Through the Vite dev proxy the browser
# sees /api on the same origin as the page, so CORS never comes into it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_origin_regex=(
        r"http://(192\.168\.\d{1,3}\.\d{1,3}"
        r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
        r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?"
    ),
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse, tags=["system"])
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        frontend_built=(FRONTEND_DIST / "index.html").is_file(),
        serial_transport="web-serial",
    )


@app.get("/api/project", response_model=ProjectResponse, tags=["project"])
async def project() -> ProjectResponse:
    return ProjectResponse(
        name="Star Forged Instruments",
        pages=["perform", "instrument", "band"],
        architecture={
            "pico": "GPIO, DSP, I2S audio, and USB serial protocol",
            "browser": "Web Serial, performance controls, and UFO visuals",
            "fastapi": "HTTP API and production frontend hosting",
        },
    )


class MirrorHub:
    """Relays Pico serial lines from the host browser to every other viewer.

    Web Serial only exists in a secure context, so only the machine with the
    board plugged in - reached over localhost - can read it. Everyone opening
    the site by IP gets a browser that physically cannot see the Pico. This
    hub is how their pages still light up: the host publishes each line it
    reads, and the server fans it out to the other tabs.

    A late joiner would otherwise sit blank until the next button press, so
    the hub also keeps the last value of each kind of state message and
    replays it on connect. Only messages that describe lasting state are kept
    - a one-shot like FLEX_ALIEN is relayed but never replayed, because
    firing the alien sound at someone who just opened the page would be
    wrong.
    """

    # Prefixes whose latest value is worth replaying to a new viewer.
    STATE_PREFIXES = ("VOL_", "SUSTAIN_", "EFFECT_ECHO_", "PICO_LINK_")

    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._state: dict[str, str] = {}
        self._held_notes: set[str] = set()

    async def join(self, socket: WebSocket) -> None:
        await socket.accept()
        self._clients.add(socket)

        for line in self._snapshot():
            await socket.send_text(line)

    def leave(self, socket: WebSocket) -> None:
        self._clients.discard(socket)

        # The publisher dropping off leaves every viewer showing a board that
        # is no longer there, so treat it as a disconnect for the next joiner.
        if not self._clients:
            self._state.clear()
            self._held_notes.clear()

    def _snapshot(self) -> list[str]:
        lines = list(self._state.values())
        lines.extend("NOTE_%s_ON" % note for note in sorted(self._held_notes))

        return lines

    def _remember(self, line: str) -> None:
        if line.startswith("NOTE_"):
            body = line[5:]

            if body.endswith("_ON"):
                self._held_notes.add(body[:-3])
            elif body.endswith("_OFF"):
                self._held_notes.discard(body[:-4])

            return

        for prefix in self.STATE_PREFIXES:
            if line.startswith(prefix):
                self._state[prefix] = line

                # A board going away cannot still be holding notes down.
                if line == "PICO_LINK_OFF":
                    self._held_notes.clear()

                return

    async def relay(self, line: str, sender: WebSocket) -> None:
        self._remember(line)

        # Everyone except the sender: the publisher already applied its own
        # line locally, and echoing it back would double-handle every event.
        for client in list(self._clients):
            if client is sender:
                continue

            try:
                await client.send_text(line)
            except (RuntimeError, WebSocketDisconnect):
                self._clients.discard(client)


hub = MirrorHub()


@app.websocket("/ws")
async def mirror(socket: WebSocket) -> None:
    await hub.join(socket)

    try:
        while True:
            line = await socket.receive_text()

            # Serial lines are short. Anything larger is not ours.
            if line and len(line) <= 200:
                await hub.relay(line.strip(), socket)
    except WebSocketDisconnect:
        pass
    finally:
        hub.leave(socket)


# FastAPI 0.138+ provides frontend() specifically for built SPAs. Register it
# last so /api routes and /docs win before frontend fallback handling.
if FRONTEND_DIST.is_dir():
    app.frontend(
        "/",
        directory=str(FRONTEND_DIST),
        fallback="index.html",
    )
else:

    @app.get("/", include_in_schema=False)
    async def frontend_not_built() -> dict[str, str]:
        return {
            "message": "Frontend build not found. Run `npm run build` in web/.",
            "docs": "/docs",
        }
