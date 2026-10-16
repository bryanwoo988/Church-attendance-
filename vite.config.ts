/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '教会签到 Church Check-in',
        short_name: '教会签到',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#7a3e2b',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts'],
          setupFiles: ['./src/test-setup.ts'],
        },
      },
      {
        test: { name: 'rules', environment: 'node', include: ['rules-test/**/*.test.ts'], fileParallelism: false },
      },
      {
        test: { name: 'functions', environment: 'node', include: ['functions/test/**/*.test.ts'], fileParallelism: false, testTimeout: 20000 },
      },
    ],
  },
});
