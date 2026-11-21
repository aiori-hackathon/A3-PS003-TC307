import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Vite 8 uses Rolldown: prioritized codeSplitting groups keep React primitives
    // in vendor-react so Leaflet (vendor-maps) and Recharts (vendor-charts) only load on demand.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              priority: 50,
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|react-is|use-sync-external-store|cookie|set-cookie-parser)[\\/]/,
            },
            {
              name: 'vendor-i18n',
              priority: 40,
              test: /[\\/]node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector|@babel[\\/]runtime|html-parse-stringify)[\\/]/,
            },
            {
              name: 'vendor-icons',
              priority: 30,
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
            },
            {
              name: 'vendor-maps',
              priority: 20,
              // Exclude CSS so importing 'leaflet/dist/leaflet.css' in main.tsx does not
              // pull the vendor-maps JS chunk into the eager initial login bundle.
              test: /^(?!.*\.css(?:$|\?)).*[\\/]node_modules[\\/](leaflet|react-leaflet|@react-leaflet[\\/][^\\/]+)[\\/]/,
            },
            {
              name: 'vendor-charts',
              priority: 10,
              test: /[\\/]node_modules[\\/](recharts|recharts-scale|victory-vendor|d3-[^\\/]+|internmap|@reduxjs[\\/]toolkit|redux|redux-thunk|react-redux|reselect|immer|es-toolkit|decimal\.js-light|eventemitter3|tiny-invariant|clsx)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
