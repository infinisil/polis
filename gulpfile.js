var _ = require('underscore');
var exec = require('child_process').exec;
var express = require('express');
var gulp = require('gulp');
var s3 = require('gulp-s3');
var browserify = require('gulp-browserify');
var concat = require('gulp-concat'); 
var uglify = require('gulp-uglify')
var rename = require('gulp-rename');
var connect = require('gulp-connect');
var tap = require('gulp-tap');
var clean = require('gulp-clean');
var jshint = require('gulp-jshint');
var gzip = require('gulp-gzip');
var template = require('gulp-template');
var watch = require('gulp-watch');
var path = require('path');
var combineCSS = require('combine-css');
var gulpif = require('gulp-if');
var gutil = require('gulp-util');
var handlebars = require('gulp-handlebars');
var compileHandlebars = require('gulp-compile-handlebars');
// var styl = require('gulp-styl');  
// var refresh = require('gulp-livereload');  
// var lr = require('tiny-lr');  
// var server = lr();
var markdown = require('gulp-markdown')
var path = require('path');
var Promise = require('es6-promise').Promise;
var proxy = require('proxy-middleware');
var header = require('gulp-header');
var hbsfy = require("hbsfy").configure({
  extensions: ["handlebars"]
});
var https = require("https");
var fs = require('fs');
var mapStream = require('map-stream');
var request = require('request');
var rimraf = require("rimraf");
var runSequence = require('run-sequence');
var sass = require('gulp-ruby-sass');
var Stream = require('stream');
var sys = require('sys');
var url = require('url');


var useJsHint = false;
const staticFilesPrefix = "cached";
const baseDistRoot = "dist";
var destRootBase = "devel";
var destRootRest = '/';  // in dist, will be the cachebuster path prefix
function destRoot() {
  var root = path.join(destRootBase, destRootRest);
  return root;
}
var devMode = true;
var host;


function prepPathForTemplate(path) {
  // add slash at front if missing      
  if (path.match(/^[^\/]/)) {
    path = "/" + path;
  }
  path = path.replace(/\/*$/,""); // remove trailing slash
  return path;
}

gulp.task('connect', [], function() {

  function proxyToPreprod(req, response) {
    var x = request("https://preprod.pol.is" + req.originalUrl);
    x.on("error", function(err) {
      response.status(500).end();
    });
    req.pipe(x);
    x.pipe(response);
  }


  express.static.mime.define({'application/x-font-woff': ['.woff']});
  var app = express();
  var fetchIndex = express.static(path.join(destRootBase, "index.html"));
  app.use(function(req, res, next) {
    res.setHeader("Cache-Control", "no-cache");
    return next();
  });
  app.use(express.static(path.join(destRootBase)));
  app.use("/", fetchIndex);
  app.use(/^\/v3/, proxyToPreprod);
  app.use(/^\/landerImages/, proxyToPreprod);  
  app.use(/^\/[0-9][0-9A-Za-z]+/, fetchIndex); // conversation view
  app.use(/^\/explore\/[0-9][0-9A-Za-z]+/, fetchIndex); // power view
  app.use(/^\/share\/[0-9][0-9A-Za-z]+/, fetchIndex); // share view
  app.use(/^\/summary\/[0-9][0-9A-Za-z]+/, fetchIndex); // summary view
  app.use(/^\/m\/[0-9][0-9A-Za-z]+/, fetchIndex); // moderation view
  app.use(/^\/ot\/[0-9][0-9A-Za-z]+/, fetchIndex); // conversation view, one-time url
  
  app.use(/^\/iip\/[0-9][0-9A-Za-z]+/, fetchIndex);
  app.use(/^\/iim\/[0-9][0-9A-Za-z]+/, fetchIndex);


  // TODO consider putting static files on /static, and then using a catch-all to serve the index.
  app.use(/^\/conversation\/create.*/, fetchIndex);
  app.use(/^\/user\/create$/, fetchIndex);
  app.use(/^\/user\/login$/, fetchIndex);
  app.use(/^\/welcome\/.*$/, fetchIndex);
  app.use(/^\/settings$/, fetchIndex);
  app.use(/^\/user\/logout$/, fetchIndex);
  app.use(/^\/inbox$/, fetchIndex);
  app.use(/^\/inboxApiTest$/, fetchIndex);
  app.use(/^\/pwresetinit$/, fetchIndex);
  app.use(/^\/demo\/[0-9][0-9A-Za-z]+/, fetchIndex);
  app.use(/^\/pwreset.*/, fetchIndex);
  app.use(/^\/prototype.*/, fetchIndex);
  app.use(/^\/plan.*/, fetchIndex);
  app.use(/^\/professors$/, express.static(path.join(destRootBase, "professors.html")));
  app.use(/^\/pricing$/, express.static(path.join(destRootBase, "pricing.html")));
  app.use(/^\/company$/, express.static(path.join(destRootBase, "company.html")));
  app.use(/^\/api$/, express.static(path.join(destRootBase, "api.html")));
  app.use(/^\/embed$/, express.static(path.join(destRootBase, "embed.html")));
  app.use(/^\/politics$/, express.static(path.join(destRootBase, "politics.html")));
  app.use(/^\/marketers$/, express.static(path.join(destRootBase, "marketers.html")));
  app.use(/^\/faq$/, express.static(path.join(destRootBase, "faq.html")));
  app.use(/^\/blog$/, express.static(path.join(destRootBase, "blog.html")));
  app.use(/^\/tos$/, express.static(path.join(destRootBase, "tos.html")));
  app.use(/^\/privacy$/, express.static(path.join(destRootBase, "privacy.html")));
  app.use(/^\/styleguide$/, express.static(path.join(destRootBase, "styleguide.html")));  
  // Duplicate url for content at root. Needed so we have something for "About" to link to.
  app.use(/^\/about$/, express.static(path.join(destRootBase, "lander.html")));
  app.use(/^\/try$/, express.static(path.join(destRootBase, "try.html")));

  app.listen(8000);
  console.log('localhost:8000');
});

function getGitHash() {
  return new Promise(function(resolve, reject) {
    exec("git log --pretty=\"%h\" -n 1", function(error, stdout, stderr) {
      if (error) {
        console.error('FAILED TO GET GIT HASH: ' + error);
        reject(stderr);
      } else {
        resolve(stdout);
      }
    })
  });
}

gulp.task('cleanDist', function(){
  rimraf.sync(baseDistRoot);
})


gulp.task('css', function(){
  gulp.src([
    devMode ? "css/polis_main_devel.scss" : "css/polis_main_dist.scss",
    ])
      .pipe(sass({
        loadPath: [__dirname + "/css"],
        // sourcemap: true,
        // sourcemapPath: '../scss'
      }))
      .pipe(concat("polis.css"))
      .pipe(gulp.dest(destRoot() + '/css'));
});

gulp.task('cssAbout', function(){
  gulp.src(["css/about.scss"])
      .pipe(sass({
        loadPath: [__dirname + "/css"],
        // sourcemap: true,
        // sourcemapPath: '../scss'
      }))
      .pipe(concat("about.css"))
      .pipe(gulp.dest(destRoot() + '/css'));
});

gulp.task('fontawesome', function() {
  gulp.src('bower_components/font-awesome/fonts/**/*')
    .pipe(gulp.dest(destRoot() + "/fonts"));
});
// TODO remove
gulp.task('sparklines', function() {
  var s = gulp.src('sparklines.svg')
    .pipe(gulp.dest(destRoot()));
});
gulp.task('index', [
  'sparklines',
], function() {
  var s = gulp.src('index.html');
  var basepath = prepPathForTemplate(destRootRest);
  if (devMode) {
    s = s.pipe(template({
      basepath: basepath,
      d3Filename: 'd3.js',
      r2d3Filename: 'r2d3.js',
    }))
  } else {
    s = s.pipe(template({
      //basepath: 'https://s3.amazonaws.com/pol.is',
      basepath: basepath, // proxy through server (cached by cloudflare, and easier than choosing a bucket for preprod, etc)
      d3Filename: 'd3.min.js',
      r2d3Filename: 'r2d3.min.js',
    }));
  }
  return s.pipe(gulp.dest(destRootBase));
});

gulp.task('templates', function(){

  //does not include participation, which is the main view, because the footer is not right /userCreate.handlebars$/,
  var topLevelViews = [/conversationGatekeeper.handlebars$/, /userCreate.handlebars$/, /create-user-form.handlebars$/, /login-form.handlebars$/, /settings.handlebars$/, /summary.handlebars$/, /inbox.handlebars$/, /moderation.handlebars$/, /passwordResetForm.handlebars$/,  /explore.handlebars$/, /conversationGatekeeper.handlebars$/, /passwordResetInitForm.handlebars$/, /create-conversation-form.handlebars$/, /plan-upgrade.handlebars$/];
  var bannerNeedingViews = [/summary.handlebars$/, /inbox.handlebars$/, /moderation.handlebars$/, /explore.handlebars$/, /create-conversation-form.handlebars$/];

  function needsBanner(file) {
    return _.some(bannerNeedingViews, function(regex){
      return file.path.match(regex)
    });
  }
  function needsHeaderAndFooter(file) {
    return _.some(topLevelViews, function(regex){
      return file.path.match(regex)
    });
  }

  return gulp.src(['js/templates/*.hbs', 'js/templates/*.handlebars'])
    .pipe(tap(function(file) {
      
      if(needsHeaderAndFooter(file) || needsBanner(file)) {
        console.log(file.path)
        file._contents = Buffer.concat([
            // new Buffer(
            //   needsHeaderAndFooter(file) ? '<div class="wrap">' : ''
            // ),
            new Buffer(
              (needsHeaderAndFooter(file) ? '{{#ifNotEmbedded}}{{> header}}{{/ifNotEmbedded}}' : '') +
              (needsBanner(file) ? '{{#ifTrial}}{{> banner}}{{/ifTrial}}' : '')
            ),
            file._contents,
            // new Buffer(
              // needsHeaderAndFooter(file) ? '</div>' : ''
            // ),
            // new Buffer(
              // needsHeaderAndFooter(file) ? '{{> footer}}' : ''
            // ),
        ]);
      }
    }))
    .pipe(handlebars({
      outputType: 'node',
      wrapped: true,
    }))
    .pipe(gulp.dest('js/tmpl'));
});

gulp.task('jshint', function(){
  gulp.src('js/**/*.js')
      .pipe(gulpif(useJsHint, jshint(

      {
         // reporter: 'jslint',
          curly: true, // require if,else blocks to have {}
          eqeqeq: true,
          trailing: true, // no trailing whitespace allowed
          // immed: true,
          // latedef: true,
          // newcap: true,
          // noarg: true,
          // sub: true,
          // undef: true,
        //  unused: true,
          quotmark: "double",
         // plusplus: true, // no ++ or --
        //  nonew: true,
          noarg: true, // no arguments.caller and arguments.callee (allow for optimizations)
          newcap: true, // constructors must be capitalized
        //  latedef: "nofunc",
         // indent: 2,
          immed: true,
//          forin: true, require hasOwnProperty checks
          boss: true,
//          debug: true, // uncomment temporarily when you want to allow debugger; statements.
          // browser: true,
          es3: true,          
          globals: {
            d3: true,
            jQuery: true,
            console: true,
            require: true,
            define: true,
            requirejs: true,
            describe: true,
            expect: true,
            module: true,
            // it: true
          },
          // relax: eventually we should get rid of these
            //expr: true,
           // loopfunc: true,
            //shadow: true,        
        }
        )))
      .pipe(jshint.reporter('default'))
})

gulp.task('scripts', ['templates', 'jshint'], function() {
  // Single entry point to browserify
  var s = gulp.src('js/main.js')
      .pipe(browserify({
        insertGlobals : true,
        debug : false, //!gulp.env.production
        // transform: ['hbsfy'],
        shim : {
          jquery: {
            path : devMode ? 'js/lib/jquery.js' : 'js/lib/jquery.min.js',
            exports: '$',
          },
          //TODO 'handlebars': 'templates/helpers/handlebarsWithHelpers', //this one has polis custom template helpers
          handlebars: {
            path : 'bower_components/handlebars/handlebars.runtime.js', //original handlebars
            exports: 'Handlebars',
          },
          originalbackbone: {
            path: 'bower_components/backbone/backbone', // backbone before modifications
            depends: { jquery: '$', underscore: '_' },  
            exports: 'Backbone',
          },
          backbone: {
            path: 'js/net/backbonePolis', // polis-specific backbone modifications
            depends: { originalbackbone: "Backbone" },
            exports: "Backbone",
          },
          underscore: {
            path: 'bower_components/underscore/underscore',
            exports: '_',
          },
          handlebones: {
            path: 'bower_components/handlebones/handlebones',
            depends: { handlebars: 'Handlebars', backbone: 'Backbone' },             
            exports: 'Handlebones',
          },
          bootstrap_alert: {  //all bootstrap files need to be added to the dependency array of js/main.js
            path: 'bower_components/bootstrap-sass-official/assets/javascripts/bootstrap/alert',
            depends: { jquery: "jQuery" },
            exports: null,
          },
          bootstrap_tab: {
            path : 'bower_components/bootstrap-sass-official/assets/javascripts/bootstrap/tab',
            depends: { jquery: "jQuery" },
            exports: null,
          },
          bootstrap_popover: {
            path: 'bower_components/bootstrap-sass-official/assets/javascripts/bootstrap/popover',
            depends: { jquery: "jQuery" },
            exports: null,
          },
          bootstrap_collapse: {
            path: 'bower_components/bootstrap-sass-official/assets/javascripts/bootstrap/collapse',
            depends: { jquery: "jQuery" },
            exports: null,
          },
          bootstrap_dropdown: {
            path: 'bower_components/bootstrap-sass-official/assets/javascripts/bootstrap/dropdown',
            depends: { jquery: "jQuery" },
            exports: null,
          },
          bootstrap_affix: {
            path: 'bower_components/bootstrap-sass-official/assets/javascripts/bootstrap/affix',
            depends: { jquery: "jQuery" },
            exports: null,
          },
          d3tooltips: {
            path: 'bower_components/d3-tip/index',
            depends: { jquery: "jQuery" },
            exports: null,
          },
          bootstrap_tooltip: {
            path: 'bower_components/bootstrap-sass-official/assets/javascripts/bootstrap/tooltip',
            depends: { jquery: "jQuery" },
            exports: null,
          },
          bootstrap_button: { 
            path: 'bower_components/bootstrap-sass-official/assets/javascripts/bootstrap/button',
            depends: { jquery: "jQuery" },
            exports: null,
          },
          bootstrap_transition: {
            path: 'bower_components/bootstrap-sass-official/assets/javascripts/bootstrap/transition',
            depends: { jquery: "jQuery" },
            exports: null,
          },
          owl: {
            path: 'bower_components/owlcarousel/owl-carousel/owl.carousel.min.js',
            depends: { jquery: "jQuery" },
            exports: null,
          },
          VisView: {
            path: 'js/lib/VisView',
            depends: { d3tooltips: 'foo' }, // added to d3 object as d3.tip
            exports: 'VisView',
          },
        },
      }))
      .pipe(concat('polis.js'))
  // TODO      .pipe(header("copyright Polis... (except that libs are mixed in)
      if (!devMode) {
        s = s
          .pipe(uglify())
          .pipe(gzip())
      }
      s = s.pipe(rename('polis.js'));
      return s.pipe(gulp.dest(destRoot() + "/js"));
});

// for big infrequently changing scripts that we don't want to concatenate
// on each dev build.
gulp.task("scriptsOther", function() {

  var files = [];
  if (devMode) {
    files.push('bower_components/d3/d3.js');
    files.push('bower_components/r2d3/r2d3.js');
  } else {
    files.push('bower_components/d3/d3.min.js');
    files.push('bower_components/r2d3/r2d3.min.js');
  }
  var s = gulp.src(files);
  if (!devMode) {
    s = s
      .pipe(uglify())
      .pipe(gzip())
      .pipe(rename(function (path) {
        // path.dirname += "/ciao";
        // path.basename += "-goodbye";
        // path.extname = ".md"

        // remove .gz extension
        var ext = path.extname;
        path.extname = ext.substr(0, ext.length- ".gz".length);
      }));
  }
  return s.pipe(gulp.dest(destRoot() + "/js"));
});

// ---------------------- BEGIN ABOUT PAGE STUFF ------------------------

gulp.task('about', function () {

    var top = fs.readFileSync('js/templates/about/partials/staticTop.handlebars', {encoding: "utf8"});
    var header = fs.readFileSync('js/templates/about/partials/staticHeader.handlebars', {encoding: "utf8"});
    var footer = fs.readFileSync('js/templates/about/partials/staticFooter.handlebars', {encoding: "utf8"});

    var basepath = prepPathForTemplate(destRootRest);
    top = top.replace(/<%= *basepath *%>/g, basepath);
    header = header.replace(/<%= *basepath *%>/g, basepath);
    footer = footer.replace(/<%= *basepath *%>/g, basepath);

    var templateData = {
        foo: 'bar333'
    },
    options = {
        ignorePartials: false, //ignores the unknown footer2 partial in the handlebars template, defaults to false
        partials : {
               top : top,
            header : header,
            footer : footer
        },
        helpers : {
            // capitals : function(str){
            //     return str.toUpperCase();   
            // }
        }
    }

    return gulp.src('js/templates/about/*.handlebars')
        .pipe(compileHandlebars(templateData, options))
        .pipe(rename(function (path) {
          path.extname = ".html"
        }))
        .pipe(gulp.dest(destRootBase));
});




// function promiseToStream(p) {
//   var Readable = Stream.Readable;
//   var rs = new Readable;
//   p.then(function(val) {
//     rs.push(val);
//     rs.push(null);
//   }).catch(function(err) {
//     rs.emit("error", err);
//   });
//   return rs;
// }


// ----------------------- END ABOUT PAGE STUFF -------------------------


gulp.task("configureForProduction", function(callback) {
  devMode = false;
  destRootBase = "dist";

  console.log('getGitHash begin');
  // NOTE using callback instead of returning a promise since the promise isn't doing the trick - haven't tried updating gulp yet.
  getGitHash().then(function(hash) {
    hash = hash.toString().match(/[A-Za-z0-9]+/)[0];

    var d = new Date();
    var unique_token = [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), hash].join("_");
    destRootRest = [staticFilesPrefix, unique_token].join("/");

    console.log('done setting destRoot: ' + destRoot() + "  destRootRest: " + destRootRest + "  destRootBase: " + destRootBase);
    callback(null);
  }).catch(function(err) {
    console.error('getGitHash err');
    console.error(err);
    callback(true);
  });
});

gulp.task('common', [
  "scriptsOther",
  "scripts",
  "css",
  "cssAbout",
  "fontawesome",
  "index",
  "about",
  ], function() {
});

gulp.task('dev', [
  "about",
  "common",
  ], function(){
});

gulp.task('dist', [
  "configureForProduction",
  ], function(callback){
    runSequence(
      'cleanDist',
      'common',
      // ['build-scripts', 'build-styles'], // these two would be parallel
      // 'build-html',
      callback);
});

gulp.task("watchForDev", [
  "connect",
  ], function() {
    gulp.watch([
      "js/**",
      "!js/tmpl/**", // These are genterated, so don't watch!
      "css/**",
      "*.html",
    ], function(e) {
      console.log("watch saw: " + e.path + " " + e.type);
      gulp.run("dev");
    });
});



gulp.task('deploy', [
  "dist"
], function() {
  return deploy({
      bucket: "pol.is"
  });
});

gulp.task('deployPreprod', [
  "dist"
], function() {
  return deploy({
      bucket: "preprod.pol.is"
  });
});
 
function deploy(params) {
    var creds = JSON.parse(fs.readFileSync('.polis_s3_creds_client.json'));
    creds = _.extend(creds, params);

    var cacheSecondsForContentWithCacheBuster = 31536000;

    function makeUploadPathHtml(file) {
      var fixed = file.path.match(RegExp("[^/]*$"))[0];
      console.log("upload path: " + fixed);
      return fixed;
    }

    function makeUploadPath(file) {
      var fixed = file.path.match(RegExp(staticFilesPrefix + ".*"))[0];
      console.log("upload path: " + fixed);
      return fixed;
    }

    // Cached Files without Gzip
    console.log(destRoot())
    gulp.src([
      destRoot() + '**/**',
      '!' + destRoot() + '/js/**',
      ], {read: false})
      .pipe(s3(creds, {
        delay: 1000,
        headers: {
          'x-amz-acl': 'public-read',
          'Cache-Control': 'no-transform,public,max-age=MAX_AGE,s-maxage=MAX_AGE'.replace(/MAX_AGE/g, cacheSecondsForContentWithCacheBuster),
        },
        makeUploadPath: makeUploadPath,
      }));

    // Cached Gzipped Files
    gulp.src([
      destRoot() + '**/js/**', // simply saying "/js/**" causes the 'js' prefix to be stripped, and the files end up in the root of the bucket.
      ], {read: false})
    .pipe(s3(creds, {
        delay: 1000,
        headers: {
          'x-amz-acl': 'public-read',
          'Content-Encoding': 'gzip',
          'Cache-Control': 'no-transform,public,max-age=MAX_AGE,s-maxage=MAX_AGE'.replace(/MAX_AGE/g, cacheSecondsForContentWithCacheBuster),          
        },
        makeUploadPath: makeUploadPath,
      }));

    // HTML files (uncached)
    // (Wait until last to upload the html, since it will clobber the old html on S3, and we don't want that to happen before the new JS/CSS is uploaded.)
    gulp.src([
      destRootBase + '/**/*.html',
      ], {read: false}).pipe(s3(creds, {
        delay: 1000,
        headers: {
          'x-amz-acl': 'public-read',
          'Cache-Control': 'no-transform,public,max-age=0,s-maxage=300', // NOTE: s-maxage is small for now, we could bump this up later once confident in cloudflare's cache purge workflow
        },
        makeUploadPath: makeUploadPathHtml,
      }));



}

function doPurgeCache() {
  console.log("Purging cache for "+host +"\n");
  // var formatter = mapStream(function (data, callback) {
  //   var o = JSON.parse(data);
  //   if (!o.result === "success") {
  //     console.error("---------- PURGE CACHE FAILED ------------- " + data)
  //   }
  //   callback(null, data + "\n");
  // });
  request.get(host + "/v3/cache/purge/f2938rh2389hr283hr9823rhg2gweiwriu78")
    // .pipe(formatter)
    .pipe(process.stdout);
}

gulp.task("configureForCachePurge", function() {
  host = "https://pol.is";
});

gulp.task("configureForCachePurgePreprod", function() {
  host = "https://preprod.pol.is";
});

gulp.task('purgeCache', ["configureForCachePurge"], doPurgeCache);
gulp.task('purgeCachePreprod', ["configureForCachePurgePreprod"], doPurgeCache);

gulp.task('default', [
  "dev",
  "watchForDev",
  ], function() {
});


