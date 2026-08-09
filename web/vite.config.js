import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// Hosting on your laptop so other computers can open the site.
//
// `server.host: true` listens on every network interface - the same thing the
// --host flag does. Setting it here means `npm run dev` is enough and the flag
// cannot be forgotten.
//
// Nothing in the client hardcodes an address, and it deliberately stays that
// way. The page requests /api/... as a RELATIVE url, so it resolves to
// whatever host the visitor typed and Vite forwards it onward. A changed
// laptop IP therefore needs no code edit anywhere.
//
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] })
    ],
    server: {
      host: true,
      port: Number(env.VITE_PORT) || 5173,
      proxy: {
        // This proxy runs on the machine serving the site, so 127.0.0.1 is
        // still correct when the visitor is on another computer - their
        // request reaches Vite first, and Vite talks to the backend locally.
        // Only override VITE_API_TARGET if the backend moves to another host.
        '/api': {
          target: env.VITE_API_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        // The mirror hub. `ws: true` is what forwards the upgrade request;
        // without it the handshake is answered as ordinary HTTP and the
        // socket never opens.
        '/ws': {
          target: env.VITE_API_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
          ws: true,
        }
      }
    }
  }
})
