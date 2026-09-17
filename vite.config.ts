import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    define: {
      'process.env.GROQ_API_KEY': JSON.stringify(process.env.GROQ_API_KEY || env.GROQ_API_KEY || env.VITE_GROQ_API_KEY || ''),
      'process.env.MODEL_NAME': JSON.stringify(process.env.model_name || process.env.MODEL_NAME || env.model_name || env.MODEL_NAME || env.VITE_MODEL_NAME || 'llama-3.3-70b-versatile'),
    },
    envPrefix: ['VITE_', 'GROQ_', 'model_'],
  }
})

