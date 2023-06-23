const path = require('path')
const { defineConfig } = require('vite')

module.exports = defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.js'),
      name: 'action-queue',
      fileName: 'action-queue'
    }
  },
  rollupOptions: {
    external: ['underscore']
  }
});
