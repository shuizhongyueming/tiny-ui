const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['./src/.ts'],
  bundle: true,
  outfile: `dist/xyx-vm__${process.env.PLATFORM}.js`,
  logLevel: 'info',
  minify: isProduction,
  format: 'iife',
  treeShaking: true,
  // globalName: 'xyxVM',
  // footer: {
  //   js: 'window.xyxVM = xyxVM;',
  // },
  target: 'es2018',
  define: {
    PLATFORM: JSON.stringify(platform),
    IS_WEB_BASED_PLATFORM: JSON.stringify(IS_WEB_BASED_PLATFORM),
    USE_CROSS_FRAME: JSON.stringify(USE_CROSS_FRAME),
    WEB_USE_LITE_VM: JSON.stringify(WEB_USE_LITE_VM),
    WEB_USE_FULL_VM: JSON.stringify(WEB_USE_FULL_VM),
  },
  plugins: [
    globalExternals({
      '@heigame2020/xyx-sdk': 'xyx',
      'zip-file-server': 'ZipFileServer'
    }),
  ]
})
