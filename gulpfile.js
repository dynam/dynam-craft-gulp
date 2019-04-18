const { src, dest, parallel, series } = require('gulp');
const del = require('del');
const sass = require('gulp-sass');
const postcss = require('gulp-postcss');
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

const dev = process.env.NODE_ENV == 'development';

const buildDir = 'dist';
const cssDir = 'styles';
const jsDir = 'js';
const jsFile = 'main';
const buildBranch = 'gulp-dist';

function clean() {
  return del([`${buildDir}/*`, `!${buildDir}/.git*`]);
}

function css() {
  sass.compiler = require('node-sass');
  const plugins = [
    autoprefixer({ browsers: ['last 1 version'] }),
    cssnano()
  ];
  return src(['./sass/screen.scss', './sass/pdf.scss'])
    .pipe(gulpif(dev, sourcemaps.init()))
    .pipe(sass().on('error', sass.logError))
    .pipe(postcss(plugins))
    .pipe(gulpif(dev, sourcemaps.write()))
    .pipe(gulpif(dev, dest(`./web/${cssDir}`), dest(`${buildDir}/web/${cssDir}`)))
}

function js() {
  return src('js/main.js')
    .pipe(
      gulpif(
        dev,
        bro({
          debug: true,
          transform: [
            babelify.configure({ presets: ['@babel/preset-env'] })
          ]
        }),
        bro({
          transform: [
            babelify.configure({ presets: ['@babel/preset-env'] }),
            ['uglifyify', { global: true }]
          ]
        })
      )
    )
    .pipe(gulpif(dev, dest(`./web/${jsDir}`), dest(`${buildDir}/web/${jsDir}`)));
}

function files() {
  return src([
    'craft',
    'vendor/**',
    'templates/**',
    'modules/**',
    'config/**',
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

function revupdate() {
  return src(['rev-manifest.json', `${buildDir}/**/_layout*([A-Za-z0-9]).html`])
    .pipe(revCollector({
      replaceReved: true
    }))
    .pipe(dest(buildDir));
}

function inline() {
  return src(`${buildDir}/templates/_layout*([A-Za-z0-9]).html`)
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
  filerev,
  revupdate,
  inline
);
