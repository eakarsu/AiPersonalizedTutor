import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      include: [/\.jsx?$/, /\.tsx?$/],
    }),
  ],
  esbuild: {
    loader: 'jsx',
    include: [/src\/.*\.jsx?$/],
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  server: {
    port: 3601,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3501',
        changeOrigin: true
      }
    }
  }
})
