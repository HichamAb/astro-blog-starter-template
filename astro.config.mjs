import { defineConfig } from 'astro/config';
import cloudflare from '@astroic/cloudflare';

// https://astro.build/config
export default defineConfig({
  // ← ضع نطاقك هنا
  site: 'https://yourstore.pages.dev',

  // Cloudflare Pages adapter
  output: 'hybrid',   // يسمح بـ SSR للـ API functions + static للصفحات
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),

  // Image optimization
  image: {
    // يمكن استخدام خدمة Cloudflare Images أو المدمجة
    service: { entrypoint: 'astro/assets/services/sharp' },
  },

  // Compression
  compressHTML: true,

  // Vite config
  vite: {
    build: {
      cssMinify: true,
    },
  },
});
