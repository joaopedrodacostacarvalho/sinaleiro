import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  envDir: '../..',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-firebase', test: /node_modules[\\/]firebase/ },
            { name: 'vendor-leaflet', test: /node_modules[\\/](leaflet|react-leaflet)/ },
            { name: 'vendor-mui', test: /node_modules[\\/](@mui|@emotion)/ },
          ],
        },
      },
    },
  },
})
