import { defineConfig } from 'tsup'
import { readdirSync } from 'fs'

export default defineConfig([
  // Universal APIs
  {
    entry: ['streams/*.{ts,tsx}'],
    format: ['cjs', 'esm'],
    external: ['react', 'svelte'],
    dts: true,
    esbuildOptions: options => {
      options.bundle = false
    }
  },
  // React APIs
  {
    entry: ['react/*.{ts,tsx}'],
    outDir: 'react/dist',
    banner: {
      js: "'use client'"
    },
    format: ['cjs', 'esm'],
    external: ['react', 'svelte'],
    dts: true,
    esbuildOptions: options => {
      options.bundle = false
    }
  },
  // Svelte APIs
  {
    entry: ['svelte/*.{ts,tsx}'],
    outDir: 'svelte/dist',
    banner: {},
    format: ['cjs', 'esm'],
    external: ['react', 'svelte'],
    dts: true,
    esbuildOptions: options => {
      options.bundle = false
    }
  }
])
