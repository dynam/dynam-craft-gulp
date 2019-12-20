const { src, dest, parallel, series } = require('gulp');
const del = require('del');
const sass = require('gulp-sass');
const postcss = require('gulp-postcss');
const watchify = require('watchify');
const browserify = require('browserify');
const vinylSource = require('vinyl-source-stream');
const vinylBuffer = require('vinyl-buffer');
const vinylPaths = require('vinyl-paths');
const log = require('gulplog');
const sourcemaps = require('gulp-sourcemaps');
const assign = require('lodash.assign');
const copy = require('gulp-copy');
const uglify = require('gulp-uglify-es').default;
const rev = require('gulp-rev');
const filter = require('gulp-filter');
const revRewrite = require('gulp-rev-rewrite');
const revDelete = require('gulp-rev-delete-original');
const revCollector = require('gulp-rev-collector');
const processhtml = require('gulp-processhtml');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const watch = require('gulp-watch');
const gulpif = require('gulp-if');
const ghPages = require('@justeat/gulp-gh-pages');
const revDel = require('rev-del');
const bro = require('gulp-bro');
const babelify = require('babelify');
const webpack = require('webpack-stream');
const plumber = require('gulp-plumber');
const named = require('vinyl-named');
const ManifestPlugin = require('webpack-manifest-plugin');

const dev = process.env.NODE_ENV == 'development';

const buildDir = 'dist';
const cssDir = 'styles';
const jsDir = 'js';
const jsFile = 'main';
const buildBranch = 'dist';

function clean() {
  return del([`${buildDir}/*`, `!${buildDir}/.git*`]);
}

function css() {
  sass.compiler = require('node-sass');
  const plugins = [
    autoprefixer({ browsers: ['last 1 version'] }),
    cssnano()
  ];
  return src(['./sass/screen.scss'])
    .pipe(gulpif(dev, sourcemaps.init()))
    .pipe(sass().on('error', sass.logError))
    .pipe(postcss(plugins))
    .pipe(gulpif(dev, sourcemaps.write()))
    .pipe(gulpif(dev, dest(`./web/${cssDir}`), dest(`${buildDir}/web/${cssDir}`)))
}

function js() {
  // Compiles/splits javascript with Webpack. Different configs for dev/production.

  return src(['js/main.js'])
    .pipe(named())
    .pipe(plumber())
    .pipe(
      gulpif(dev,
        webpack({
          output: {
            filename: `${jsDir}/[name].js`
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
          output: {
            filename: `${jsDir}/[name].[hash].js`
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
    .pipe(gulpif(dev, dest(`./web`), dest(`${buildDir}/web`)));
}

function revupdate() {
  // Replaces the js filenames in the layout template with the filename revisions in the Webpack manifest (cache busting)

  return src([
    `${buildDir}/web/manifest.json`,
    `${buildDir}/templates/**/*.html`
    ])
    .pipe(revCollector({
      replaceReved: true,
      revSuffix: '\\.[0-9a-f]*'
    }))
    .pipe(dest(`${buildDir}/templates`));
}

function files() {
  return src([
    'craft',
    'vendor/**',
    'templates/**',
    'modules/**',
    'config/**',
    '!config/project.yaml',
    'web/**',
    `!web/${jsDir}{,/**}`,
    `!web/${cssDir}/**`,
    '!web/assets{,/**}',
    '!web/cpresources{,/**}',
    '!**/*.map',
    '!**/*.swp',
    '!**/*.DS_Store'
  ], {
    follow: true,
    dot: true
  })
    .pipe(copy(buildDir));
}

function filerev() {
  return src([`${buildDir}/web/**/main.js`, `${buildDir}/web/**/extra.css`])
    .pipe(rev())
    .pipe(dest(`${buildDir}/web`))
    .pipe(rev.manifest())
    .pipe(revDel({ dest: buildDir }))
    .pipe(dest('.'));
}

function inline() {
  return src(`${buildDir}/templates/_layout*([\-A-Za-z0-9]).html`)
    .pipe(
      processhtml({
        commentMarker: 'process',
        includeBase: `${buildDir}/web/${cssDir}/`
      })
    )
    .pipe(dest(`${buildDir}/templates`));
}

function deploy() {
  return src(`./${buildDir}/**/*`, { dot: true })
    .pipe(ghPages({
      branch: buildBranch
    }));
}

function stream() {
  watch('sass/**/*.scss', css);
  watch('js/**/*.js', js);
}

exports.stream = stream;
exports.clean = clean;
exports.css = css;
exports.js = js;
exports.files = files;
exports.filerev = filerev;
exports.revupdate = revupdate;
exports.inline = inline;
exports.deploy = deploy;
exports.default = series(
  clean,
  parallel(js, css),
  files,
  revupdate,
  inline
);

