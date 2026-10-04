import { defineConfig } from 'vite';
export default defineConfig({base:'./',build:{target:'es2020',rollupOptions:{output:{manualChunks:{phaser:['phaser']}}}},server:{host:'0.0.0.0'}});
