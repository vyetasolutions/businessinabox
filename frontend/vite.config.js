import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Vyeta Business Hub',
        short_name: 'Business Hub',
        description: 'Business Suite — Powered by Vyeta Digital Solutions',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        // Cache the app shell so the whole UI still opens with no network.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Never try to cache/serve Supabase API or Storage traffic through the
        // service worker — those go through our own offline-sync queue logic
        // in src/lib/offlineSync.js instead, which is far more reliable for
        // read/write data than a generic HTTP cache would be.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('supabase.co'),
            handler: 'NetworkOnly'
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  server: {
    port: 5173
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor_react: ['react', 'react-dom', 'react-router-dom'],
          vendor_charts: ['chart.js', 'react-chartjs-2'],
          vendor_pdf: ['jspdf', 'jspdf-autotable']
        }
      }
    }
  }
});

