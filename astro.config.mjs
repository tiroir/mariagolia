import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://mariagolia.com',
  output: 'static',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'it'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true
    }
  }
});
