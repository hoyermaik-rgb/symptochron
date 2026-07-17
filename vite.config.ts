/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import { fileURLToPath } from 'node:url';

// Robust ES modules equivalent of __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Auto-copy icons from 'Icons' folder to 'public' folder
try {
  let iconsSrcDir = path.join(__dirname, 'Icons');
  // Handle case-sensitivity on Linux
  if (!fs.existsSync(iconsSrcDir)) {
    iconsSrcDir = path.join(__dirname, 'icons');
  }

  const publicDestDir = path.join(__dirname, 'public');

  console.log(`[ViteConfig] Checking for Icons in: ${iconsSrcDir}`);
  if (fs.existsSync(iconsSrcDir)) {
    if (!fs.existsSync(publicDestDir)) {
      fs.mkdirSync(publicDestDir, { recursive: true });
    }
    const files = fs.readdirSync(iconsSrcDir);
    let copiedCount = 0;
    for (const file of files) {
      const srcFile = path.join(iconsSrcDir, file);
      const destFile = path.join(publicDestDir, file);
      if (fs.statSync(srcFile).isFile()) {
        if (fs.existsSync(destFile) && fs.readFileSync(srcFile).equals(fs.readFileSync(destFile))) {
          continue;
        }
        fs.copyFileSync(srcFile, destFile);
        copiedCount++;
      }
    }
    console.log(`[ViteConfig] Auto-copied ${copiedCount} icons to public/ folder successfully.`);
  } else {
    console.log("[ViteConfig] Icons folder not found, skipping auto-copy.");
  }
} catch (e) {
  console.error("[ViteConfig] Failed to auto-copy icons:", e);
}




export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 5000000,
          navigateFallback: 'index.html',
        },
        manifest: {
          name: 'SymptoChron',
          short_name: 'SymptoChron',
          description: 'Diagnose & Chronik Gesundheitsmanager',
          theme_color: '#0A0A0A',
          background_color: '#0A0A0A',
          display: 'standalone',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: true, // Listen on all local IPs (needed for Docker)
      allowedHosts: true, // Allow all hosts to prevent "Blocked request"
      
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('jspdf')) return 'jspdf';
              if (id.includes('html5-qrcode')) return 'html5-qrcode';
              if (id.includes('lucide-react')) return 'lucide';
              if (id.includes('motion')) return 'motion';
              return 'vendor';
            }
          }
        }
      }
    },
    test: {
      exclude: ['**/node_modules/**', '**/dist/**', '**/tests/**']
    }
  };
});
