"""FastAPI entry point for the Star Forged Instruments website.

The Pico connection deliberately stays in the browser through Web Serial.
FastAPI owns ordinary HTTP concerns: health/configuration APIs and serving the
built Vite frontend. This avoids two processes competing for the board's COM
port.
"""

from pathlib import Path
from typing import Literal

from fastapi import FastAPI
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
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
