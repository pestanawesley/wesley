import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// O caminho base muda conforme onde o app é servido.
// - Local / maioria dos hosts: "/"
// - GitHub Pages (projeto): "/wesley/" (definido por DEPLOY_BASE no CI)
// https://vite.dev/config/
export default defineConfig({
  base: process.env.DEPLOY_BASE || '/',
  plugins: [react()],
})
