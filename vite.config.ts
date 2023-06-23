import * as path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.js'),
      name: 'action-queue',
      fileName: (format) => `action-queue.${format}.js`
    }
  },
  clearScreen: false
});
