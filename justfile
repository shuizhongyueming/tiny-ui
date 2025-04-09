set dotenv-load

[no-cd]
build *FLAGS:
  NODE_ENV=production node esbuild.js {{FLAGS}}

[no-cd]
dev *FLAGS:
  NODE_ENV=development node esbuild.js {{FLAGS}};
  just tsc;

[no-cd]
tsc:
  ./node_modules/.bin/tsc --project ./tsconfig.json --declaration true --emitDeclarationOnly true --declarationDir ./types


# commit with prefix
[no-cd]
commit msg:
  dir_name=$(basename `pwd`);\
  git commit -m "$dir_name: {{msg}}"

[no-cd]
_common-publish versionType:
  just tsc;
  pnpm version {{versionType}};
  git add './package.json';
  PACKAGE_VERSION=$(node -pe "require('./package.json').version"); just commit "release ${PACKAGE_VERSION}";
  pnpm publish;

[no-cd]
publish versionType="patch":
  git pull;
  rm -rf {{justfile_directory()}}/dist;
  # just test;
  just build;
  just _common-publish {{versionType}};
  git push;


[no-cd]
prepublish versionType="prerelease":
  git pull;
  rm -rf {{justfile_directory()}}/dist;
  # just test;
  just build;
  just _common-publish {{versionType}};

# test *FLAGS:
#   {{justfile_directory()}}/node_modules/mocha/bin/mocha.js --require browser.js {{FLAGS}}
