const esbuild = require('esbuild');
const {globalExternals} = require("@fal-works/esbuild-plugin-global-externals");

const isProduction = process.env.NODE_ENV === 'production';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['./src/main.ts'],
  bundle: true,
  outfile: `dist/tiny-ui-components.js`,
  logLevel: 'info',
  minify: isProduction,
  format: 'iife',
  globalName: 'TinyUIComponents', // 添加这一行，定义全局变量名
  footer: {
    js: 'window.TinyUIComponents = TinyUIComponents;',
  },
  treeShaking: true,
  target: 'es2018',
  plugins: [
    globalExternals({
      '@shuizhongyueming/tiny-ui-core': 'TinyUI',
    }),
  ]
};

if (isWatch) {
  esbuild.context(buildOptions).then(ctx => {
    ctx.watch();
    console.log('wating....');
  })
} else {
  esbuild.build(buildOptions);
}
