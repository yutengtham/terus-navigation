import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Vite is the tool that runs the app on your computer (npm run dev)
// and builds the final website files (npm run build).
//
// "npm run dev:phone" starts a secure https:// server on your Wi-Fi so you can open
// Terus on your phone. Phones only allow GPS on https:// pages.
export default defineConfig(({ mode }) => {
  const phone = mode === 'phone';
  return {
    plugins: [react(), ...(phone ? [basicSsl()] : [])],
    server: {
      port: 5173, // Must match the URL restriction on your Mapbox token
      strictPort: true,
      host: phone ? true : 'localhost', // phone mode: reachable from other devices on your Wi-Fi
    },
    build: {
      // Mapbox GL JS is a large library (~600 kB zipped); this is expected.
      chunkSizeWarningLimit: 2500,
    },
  };
});
