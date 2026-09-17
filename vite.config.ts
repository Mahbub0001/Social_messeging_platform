import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const groqKey = env.VITE_GROQ_API_KEY || env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY || ''
  const rawModel = env.VITE_MODEL_NAME || env.model_name || env.MODEL_NAME || process.env.VITE_MODEL_NAME || process.env.model_name || process.env.MODEL_NAME || 'qwen/qwen3.8-27b'
  const groqModel = rawModel === 'llama-3.3-70b-versatile' ? 'qwen/qwen3.8-27b' : rawModel

  return {
    plugins: [react()],
    define: {
      '__GROQ_API_KEY__': JSON.stringify(groqKey),
      '__GROQ_MODEL__': JSON.stringify(groqModel),
      'process.env.GROQ_API_KEY': JSON.stringify(groqKey),
      'process.env.VITE_GROQ_API_KEY': JSON.stringify(groqKey),
      'process.env.MODEL_NAME': JSON.stringify(groqModel),
      'process.env.model_name': JSON.stringify(groqModel),
    },
    envPrefix: ['VITE_', 'GROQ_', 'model_'],
  }
})

