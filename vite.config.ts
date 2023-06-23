import * as path from 'path'
import { defineConfig } from 'vite'

export default defineConfig(({command, mode}) => {
  return {
    build: {
      outDir: "out",
      minify: mode == "production",
      lib: {
        entry: path.resolve(__dirname, 'src/index.js'),
        name: 'action-queue',
        fileName: (format) => mode == "production" ? `action-queue.${format}.min.js` : `action-queue.${format}.js`
      }
    },
    clearScreen: false
  }
});
