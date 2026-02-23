import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    
    return {
      server: {
        port: 5000,
        host: '0.0.0.0',
        allowedHosts: true,
      },
      plugins: [react()],
      define: {
        // Only expose Supabase public keys - these are safe for client-side
        // All AI API keys are now proxied through Edge Functions
        'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
        'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: isProduction ? false : true,
        minify: isProduction ? 'esbuild' : false,
        esbuild: isProduction ? {
          drop: ['console', 'debugger'],
          legalComments: 'none'
        } : undefined,
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              router: ['react-router-dom'],
              charts: ['recharts'],
              icons: ['lucide-react']
            },
            chunkFileNames: 'assets/[name]-[hash].js',
            entryFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]'
          }
        },
        chunkSizeWarningLimit: 1000,
        reportCompressedSize: true,
        emptyOutDir: true
      },
      publicDir: 'public'
    };
});
