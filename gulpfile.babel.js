const {
  src,
  dest,
  series,
  parallel,
  watch
} = require('gulp')
const sass = require('gulp-sass')
const autoprefixer = require('gulp-autoprefixer')
const babel = require('gulp-babel')
const imagemin = require('gulp-imagemin')
const imageminJpegRecompress = require('imagemin-jpeg-recompress')
const imageminPngquant = require('imagemin-pngquant')
const ur = require('gulp-useref')
const minify = require('gulp-cssnano')
const surge = require('gulp-surge')
const ghPages = require('gulp-gh-pages')
const bs = require('browser-sync').create()
const plumber = require('gulp-plumber')
const webpack = require('webpack')
const gulpIf = require('gulp-if')
const del = require('del')
const webpackStream = require('webpack-stream')
const webpackConfig = require('./webpack.config')
const {
  projectName,
  version,
  proxy,
  publishTo,
  sourceDir,
  buildDir,
  styleSrc,
  styleDest,
  scriptSrc,
  scriptDest,
  imgSrc,
  imgDest,
  pageType,
  publishUrl
} = require('./devoe.config')

// Project configurations
const config = {
  projectName: projectName || 'Besslah',
  version: version || '2.0',
  proxy: proxy || 'local.dev',
  publishTo: publishTo || 'your-surge-url.surge.sh',
  sourceDir: sourceDir || '',
  buildDir: buildDir || 'build',

  // Script path
  styleSrc: styleSrc || resolvePath(sourceDir, 'scss/**/*.scss'),
  styleDest: styleDest || resolvePath(sourceDir, 'styles'),

  // Style path
  scriptSrc: scriptSrc || resolvePath(sourceDir, 'scripts/src/**/*.js'),
  scriptDest: scriptDest || resolvePath(sourceDir, 'scripts'),

  // Images path
  imgSrc: imgSrc || resolvePath(sourceDir, 'images/**/*{.png,.jpg,.jpeg,.svg,.gif}'),
  imgDest: imgDest || resolvePath(sourceDir, 'build/images'),

  // Page type: either html or php
  pageType: pageType || resolvePath(sourceDir, '**/*.html'),

  // Publish
  publishUrl: publishUrl || 'myperfectdemo.surge.sh'
}

// Resolve path helper
function resolvePath (source, path) {
  return source ? (source + '/' + path) : path
}

// Display error and stop process
function printErr (err) {
  console.log(err)
  this.emit('finish')
}

// Styles task
function styles () {
  return src(config.styleSrc, { sourcemaps: true })
    .pipe(plumber({ errorHandler: printErr }))
    .pipe(sass({
      outputStyle: 'expanded',
      includePaths: ['node_modules/']
    })).on('error', sass.logError)
    .pipe(autoprefixer('last 2 version'))
    .pipe(plumber.stop())
    .pipe(dest(config.styleDest, { sourcemaps: '.' }))
    .pipe(bs.stream())
}

// Script task
function scripts () {
  return src(config.scriptSrc)
    .pipe(babel())
    .pipe(webpackStream(webpackConfig, webpack))
    .pipe(dest(config.scriptDest))
}

// Images task
function images () {
  return src(config.imgSrc)
    .pipe(imagemin([
      imagemin.gifsicle({ interlaced: true }),
      imageminJpegRecompress({
        progressive: true,
        max: 80,
        min: 70
      }),
      imageminPngquant({ quality: '75-85' }),
      imagemin.svgo({ plugins: [{ removeViewBox: false }] })
    ]))
    .pipe(dest(config.imgDest))
}

function useref () {
  return src('*.html')
    .pipe(ur())
    .pipe(gulpIf('*.css', minify({
      discardComments: {
        removeAll: true
      }
    })))
    .pipe(dest(config.buildDir))
}

// Publish task
function pushSurge () {
  return surge({
    project: config.buildDir, // Path to your static build directory
    domain: config.publishTo // Your domain or Surge subdomain
  })
}

// Publish to github task
function pushGithub () {
  return src(`${config.buildDir}/**/*`)
    .pipe(ghPages())
}

// Clean Task
function clean (done) {
  del([
    config.buildDir,
    '!.git',
    `!${config.buildDir}/.git`
  ], { dot: true })
  done()
}

// Browsersync task
function browserSync () {
  bs.init({
    server: {
      baseDir: './'
    }
  })
}

// Watchfiles task
function watchFiles () {
  watch(config.styleSrc, styles)
  watch(config.scriptSrc).on('change', series(scripts, bs.reload))
  watch(config.imgSrc).on('change', bs.reload)
  watch(config.pageType).on('change', bs.reload)
}

// Complex tasks
const serve = parallel(watchFiles, browserSync)
const build = series(clean, styles, scripts, images, useref)
const publish = series(build, pushSurge)

// Export Tasks
exports.images = images
exports.styles = styles
exports.scripts = scripts
exports.build = build
exports.publish = publish
exports.github = pushGithub
exports.default = serve
