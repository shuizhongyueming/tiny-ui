const esbuild = require('esbuild');

const isProduction = process.env.NODE_ENV === 'production';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['./src/TinyUI.ts'],
  bundle: true,
  outfile: `dist/tiny-ui.js`,
  logLevel: 'info',
  minify: isProduction,
  format: 'iife',
  globalName: 'TinyUI', // 添加这一行，定义全局变量名
  footer: {
    js: 'window.TinyUI = TinyUI;',
  },
  treeShaking: true,
  target: 'es2018',
};

if (isWatch) {
  esbuild.context(buildOptions).then(ctx => {
    ctx.watch();
    console.log('wating....');
  })
} else {
  esbuild.build(buildOptions);
}
