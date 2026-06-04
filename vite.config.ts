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
        headers: {
          // Required for FFmpeg SharedArrayBuffer support
          'Cross-Origin-Embedder-Policy': 'credentialless',
          'Cross-Origin-Opener-Policy': 'same-origin',
        },
      },
      plugins: [react()],
      define: {
        // Vercel: set VITE_GEMINI_API_KEY etc. in project environment variables
        // Fallback chain handles both VITE_ prefixed and unprefixed names
        'process.env.API_KEY': JSON.stringify(
          env.VITE_GEMINI_API_KEY || env.VITE_API_KEY || env.API_KEY || env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY || ''
        ),
        'process.env.DEEPSEEK_API_KEY': JSON.stringify(
          env.VITE_DEEPSEEK_API_KEY || env.DEEPSEEK_API_KEY || ''
        ),
        'process.env.GEMINI_API_KEY': JSON.stringify(
          env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || env.API_KEY || env.GOOGLE_AI_API_KEY || ''
        ),
        'process.env.OPENAI_API_KEY': JSON.stringify(
          env.VITE_OPENAI_API_KEY || env.OPENAI_API_KEY || ''
        ),
        'process.env.ELEVENLABS_API_KEY': JSON.stringify(
          env.VITE_ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY || ''
        ),
        'process.env.SUPABASE_URL': JSON.stringify(
          env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''
        ),
        'process.env.SUPABASE_ANON_KEY': JSON.stringify(
          env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''
        ),
        // Azure removed — using AWS Textract + Google Document AI
        'process.env.AWS_ACCESS_KEY_ID': JSON.stringify(
          env.VITE_AWS_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID || ''
        ),
        'process.env.AWS_SECRET_ACCESS_KEY': JSON.stringify(
          env.VITE_AWS_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY || ''
        ),
        'process.env.AWS_REGION': JSON.stringify(
          env.VITE_AWS_REGION || env.AWS_REGION || 'us-east-1'
        ),
        'process.env.ASSEMBLYAI_API_KEY': JSON.stringify(
          env.VITE_ASSEMBLYAI_API_KEY || env.ASSEMBLYAI_API_KEY || ''
        ),
        'process.env.OCR_SPACE_API_KEY': JSON.stringify(
          env.VITE_OCR_SPACE_API_KEY || env.OCR_SPACE_API_KEY || ''
        ),
        'process.env.DAILY_API_KEY': JSON.stringify(
          env.VITE_DAILY_API_KEY || env.DAILY_API_KEY || ''
        ),
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
          drop: ['debugger'],
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
