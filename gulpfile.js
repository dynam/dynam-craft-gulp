const { src, dest, parallel, series } = require('gulp');
const del = require('del');
const sass = require('gulp-sass');
const postcss = require('gulp-postcss');
const vinylSource = require('vinyl-source-stream');
const vinylBuffer = require('vinyl-buffer');
const vinylPaths = require('vinyl-paths');
const log = require('gulplog');
const sourcemaps = require('gulp-sourcemaps');
const assign = require('lodash.assign');
const copy = require('gulp-copy');
const uglify = require('gulp-uglify-es').default;
const processhtml = require('gulp-processhtml');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const watch = require('gulp-watch');
const gulpif = require('gulp-if');
const ghPages = require('@justeat/gulp-gh-pages');
const revDel = require('rev-del');
const revCollector = require('gulp-rev-collector');
const webpack = require('webpack-stream');
const plumber = require('gulp-plumber');
const named = require('vinyl-named');
const ManifestPlugin = require('webpack-manifest-plugin');
const envfile = require('node-env-file');
const fs = require('fs');
const dev = process.env.NODE_ENV == 'development';
const shell = require('shelljs');

var envImport = {};
if(fs.existsSync(`.env`)) {
  envImport = envfile(`.env`);
}

const buildDir = !!envImport.BUILD_DIR ? envImport.BUILD_DIR : 'dist';
const buildBranch = !!envImport.BUILD_BRANCH ? envImport.BUILD_BRANCH : 'dist';
const cssDir = !!envImport.CSS_DIR ? envImport.CSS_DIR : 'styles';
const jsSrc = !!envImport.JS_SRC ? envImport.JS_SRC : 'js';
const jsEntry = !!envImport.JS_ENTRY ? envImport.JS_ENTRY : 'main';
const sassSrc = !!envImport.SASS_SRC ? envImport.SASS_SRC : 'sass';
const sassEntry = !!envImport.SASS_ENTRY ? envImport.SASS_ENTRY : 'screen';
const srcDir = !!envImport.SRC_DIR ? envImport.SRC_DIR : '.';
const publicFolder = `${srcDir}/${!!envImport.PUBLIC_FOLDER ? envImport.PUBLIC_FOLDER : 'web'}`;
const templatesDir = `${srcDir}/${!!envImport.TEMPLATES_DIR ? envImport.TEMPLATES_DIR : 'templates'}`;
const cms = !!envImport.CMS ? envImport.CMS : 'craft3';

function clean() {
  return del([
    `${buildDir}/*`,
    `!${buildDir}/.git*`,
    `!${buildDir}/.env`,
    `!${buildDir}/storage`
  ]);
}

function css() {
  sass.compiler = require('node-sass');
  const plugins = [
    autoprefixer(),
    cssnano()
  ];
  return src([`${srcDir}/${sassSrc}/${sassEntry}.scss`])
    .pipe(gulpif(dev, sourcemaps.init()))
    .pipe(sass().on('error', sass.logError))
    .pipe(postcss(plugins))
    .pipe(gulpif(dev, sourcemaps.write()))
    .pipe(gulpif(dev, dest(`${publicFolder}/${cssDir}`), dest(`${buildDir}/${publicFolder}/${cssDir}`)))
}

function js() {
  // Compiles/splits javascript with Webpack. Different configs for dev/production.

  return src([`${srcDir}/${jsSrc}/${jsEntry}.js`])
    .pipe(named())
    .pipe(plumber())
    .pipe(
      gulpif(dev,
        webpack({
          output: {
            filename: `js/[name].js`
          },
          optimization: {
            minimize: false,
            usedExports: true,
            splitChunks: {
              chunks (chunk) {
                return !['files-exempt-from-chunking'].includes(chunk.name);
              }
            }
          },
          module: {
            rules: [{
              test: /\.js$/,
              exclude: /@babel(?:\/|\\{1,2})runtime|core-js/,
              use: {
                loader: 'babel-loader',
                options: {
                  presets: [
                    [
                      '@babel/preset-env',
                      {
                        targets: {
                          browsers: ['last 2 versions']
                        },
                        useBuiltIns: 'entry',
                        corejs: 3
                      }
                    ]  
                  ]
                }
              }
            }]
          },
        }),
        webpack({
          mode: 'production',
          output: {
            filename: `js/[name].[hash].js`
          },
          optimization: {
            usedExports: true,
            splitChunks: {
              chunks (chunk) {
                return !['files-exempt-from-chunking'].includes(chunk.name);
              }
            }
          },
          module: {
            rules: [{
              test: /\.js$/,
              use: {
                loader: 'babel-loader',
                options: {
                  presets: [
                    [
                      '@babel/preset-env',
                      {
                        targets: {
                          browsers: ['last 2 versions']
                        },
                        useBuiltIns: 'entry',
                        corejs: 3
                      }
                    ]  
                  ]
                }
              }
            }]
          },
          plugins: [
            new ManifestPlugin({
              basePath: 'js/'
            })
          ]
        })
      )
    )
    .pipe(gulpif(dev, dest(`${publicFolder}`), dest(`${buildDir}/${publicFolder}`)));
}

function revupdate() {
  // Replaces the js filenames in the layout template with the filename revisions in the Webpack manifest (cache busting)

  return src([
    `${buildDir}/${publicFolder}/manifest.json`,
    `${buildDir}/${templatesDir}/**/*.html`
    ])
    .pipe(revCollector({
      replaceReved: true,
      revSuffix: '\\.[0-9a-f]*'
    }))
    .pipe(dest(`${buildDir}/${templatesDir}`));
}

function files() {

  var toCopy;

  switch(cms) {
    case 'craft2':
      toCopy = [
        'vendor/**',
        `${srcDir}/.gitignore`,
        `${srcDir}/craft/**`,
        `${publicFolder}/**`,
        `${srcDir}/${jsSrc}{,/**}`,
        `!${srcDir}/${sassSrc}/**`,
        `!${publicFolder}/assets{,/**}`,
        `!${publicFolder}/cpresources{,/**}`,
        '!**/*.map',
        '!**/*.swp',
        '!**/*.DS_Store'
      ];
      break;
    default:
      toCopy = [
        `${srcDir}/craft`,
        `${srcDir}/.env`,
        'vendor/**',
        `${templatesDir}/**`,
        `${srcDir}/modules/**`,
        `${srcDir}/config/**`,
        `!${srcDir}/config/project.yaml`,
        `${publicFolder}/**`,
        `!${publicFolder}/js{,/**}`,
        `!${publicFolder}/${cssDir}/**`,
        `!${publicFolder}/assets{,/**}`,
        `!${publicFolder}/cpresources{,/**}`,
        `!**/*.map`,
        `!**/*.swp`,
        `!**/*.DS_Store`
      ];
  }

  return src(toCopy, {
    follow: true,
    dot: true
  })
  .pipe(copy(buildDir));
}

function filerev() {
  return src([`${buildDir}/${jsDir}/**/${jsEntry}.js`, `${buildDir}/${publicFolder}/**/extra.css`])
    .pipe(rev())
    .pipe(dest(`${buildDir}/${publicFolder}`))
    .pipe(rev.manifest())
    .pipe(revDel({ dest: buildDir }))
    .pipe(dest('.'));
}

function inline() {
  return src(`${buildDir}/${templatesDir}/_layout*([\-A-Za-z0-9]).html`)
    .pipe(
      processhtml({
        commentMarker: 'process',
        includeBase: `${buildDir}/${publicFolder}/${cssDir}/`
      })
    )
    .pipe(dest(`${buildDir}/${templatesDir}`));
}

function push() {
  return src(`${buildDir}/${srcDir}/**/*`, { dot: true })
    .pipe(ghPages({
      branch: buildBranch
    }));
}

async function deliver() {
  return await shell.exec(`ssh ${envImport.SSH_USER}@109.109.128.66 'cd ${envImport.LIVE_ROOT} && git pull'`);
}

function stream() {
  watch(`${srcDir}/${sassSrc}/**/*.scss`, css);
  watch(`${srcDir}/${jsSrc}/**/*.js`, js);
}

function build() {
  return series(
    clean,
    parallel(js, css),
    files,
    revupdate,
    inline
  );
}

exports.stream = stream;
exports.clean = clean;
exports.css = css;
exports.js = js;
exports.files = files;
exports.filerev = filerev;
exports.revupdate = revupdate;
exports.inline = inline;
exports.push = push;
exports.deliver = deliver;
exports.build = build;

exports.deploy = series(
  clean,
  parallel(js, css),
  files,
  revupdate,
  inline,
  push,
  deliver
);

exports.default = build;

