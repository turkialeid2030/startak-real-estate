import {defineConfig,mergeConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import main from '../../../vite.config.js';
// Bundle a SEPARATE synthetic React HTML entry using the same production
// transformations as the actual STARTAK application. This is not deployed.
export default defineConfig(mergeConfig(main,{
 build:{
  outDir:'dist-freshness-harness',
  emptyOutDir:true,
  rollupOptions:{
   input:fileURLToPath(new URL('./startak-re-freshness.html',import.meta.url))
  }
 }
}));
