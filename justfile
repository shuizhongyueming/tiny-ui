set dotenv-load

build *FLAGS:
  NODE_ENV=production node esbuild.js {{FLAGS}}

dev *FLAGS:
  NODE_ENV=development node esbuild.js {{FLAGS}};
  just tsc;

tsc:
  ./node_modules/.bin/tsc --project ./tsconfig.json --declaration true --emitDeclarationOnly true --declarationDir ./types

_common-publish versionType:
  just tsc;
  npm version {{versionType}};
  npm publish;

publish versionType="patch":
  git pull;
  rm -rf {{justfile_directory()}}/dist;
  # just test;
  just build;
  just _common-publish {{versionType}};
  git push;


# TODO: 加上 target 不存在时的条件判断
prepublish versionType="prerelease":
  git pull;
  rm -rf {{justfile_directory()}}/dist;
  # just test;
  just build;
  just _common-publish {{versionType}};

# test *FLAGS:
#   {{justfile_directory()}}/node_modules/mocha/bin/mocha.js --require browser.js {{FLAGS}}
