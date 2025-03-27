const esbuild = require('esbuild');

const isProduction = process.env.NODE_ENV === 'production';

esbuild.build({
  entryPoints: ['./src/TinyUI.ts'],
  bundle: true,
  outfile: `dist/tiny-ui.js`,
  logLevel: 'info',
  minify: isProduction,
  format: 'iife',
  globalName: 'TinyUI', // 添加这一行，定义全局变量名
  treeShaking: true,
  target: 'es2018'
})
