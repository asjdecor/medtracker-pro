import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// GitHub Pages serves from /<repo>/. REPO_NAME (no slashes) survives Git Bash path mangling on Windows;
// BASE_PATH is kept for the Actions workflow. Local dev uses "/".
const base = process.env.REPO_NAME ? `/${process.env.REPO_NAME}/` : process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'MedTracker Pro — Gestão inteligente de medicamentos',
        short_name: 'MedTracker',
        description: 'Organize medicamentos, registre doses, receba lembretes e use IA para ler receitas.',
        lang: 'pt-BR',
        theme_color: '#1A4331',
        background_color: '#F8F9F5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        categories: ['health', 'medical', 'lifestyle'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 },
    }),
  ],
})
