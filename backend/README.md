# FastAPI backend

FastAPI serves project APIs and the production Vite build. It does **not**
open the Pico's COM port; the browser keeps exclusive access through Web
Serial.

## Setup

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
```

## Development

Run the API:

```powershell
.\.venv\Scripts\fastapi dev backend\main.py
```

Run Vite in a second terminal:

```powershell
cd web
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000`. Interactive API documentation
is available at `http://127.0.0.1:8000/docs`.

## Production-style local run

```powershell
cd web
npm run build
cd ..
.\.venv\Scripts\fastapi run backend\main.py
```

Then open `http://127.0.0.1:8000`. FastAPI serves `web/dist` and preserves the
frontend's client-side navigation.

## Tests

```powershell
.\.venv\Scripts\python -m unittest discover -s backend\tests -v
```
