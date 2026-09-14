/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    banner: '/*! jetzt '
      + '<%= grunt.template.today("yyyy-mm-dd") %>\n'
      + '* https://github.com/danteCarvalho/jetzt/\n'
      + '* Copyright (c) <%= grunt.template.today("yyyy") %> '
      + 'David Sheldrick and contributors; Licensed Apache 2.0 */\n'
    // Task configuration.
    , concat: {
      options: {
        banner: '<%= banner %>'
        , stripBanners: true
      }
      , 'jetzt-solid.js' : [
            "modules/preamble.js"
          , "modules/helpers.js"
          , "modules/config.js"
          , "modules/parse.js"
          , "modules/exec.js"
          , "modules/view.js"
          , "modules/select.js"
          , "modules/control.js"
          , "modules/init.js"
        ]
      }
    , uglify: {
      options: {
        banner: '<%= banner %>'
      }       
    	, 'jetzt-solid.min.js' : 'jetzt-solid.js'
    }
    , watch: {
      files: ["modules/**"]
      , tasks: ["concat", "uglify", "build"]
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Directory copy helper function
  function copyDirRecursive(src, dest) {
    var fs = require('fs');
    var path = require('path');
    
    if (!fs.existsSync(src)) return;
    
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    var entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var srcPath = path.join(src, entry.name);
      var destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        copyDirRecursive(srcPath, destPath);
      } else {
        fs.writeFileSync(destPath, fs.readFileSync(srcPath));
      }
    }
  }

  // File copy helper function
  function copyFile(src, dest) {
    var fs = require('fs');
    var path = require('path');
    var parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    if (fs.existsSync(src)) {
      fs.writeFileSync(dest, fs.readFileSync(src));
    }
  }

  grunt.registerTask('build-chrome', 'Build for Chrome inside dist/chrome folder', function() {
    var fs = require('fs');
    var path = require('path');
    var outputDir = path.join('dist', 'chrome');
    grunt.log.writeln('Building CHROME extension inside: ' + outputDir);

    // 1. Copy directory assets
    copyDirRecursive('modules', path.join(outputDir, 'modules'));
    copyDirRecursive('options', path.join(outputDir, 'options'));
    copyDirRecursive('img', path.join(outputDir, 'img'));

    // 2. Copy root level files
    copyFile('background.js', path.join(outputDir, 'background.js'));
    copyFile('chrome-config.js', path.join(outputDir, 'chrome-config.js'));
    copyFile('jetzt-solid.js', path.join(outputDir, 'jetzt-solid.js'));
    copyFile('jetzt-solid.min.js', path.join(outputDir, 'jetzt-solid.min.js'));
    copyFile('jetzt.css', path.join(outputDir, 'jetzt.css'));
    copyFile('jetzt.js', path.join(outputDir, 'jetzt.js'));

    // 3. Copy target specific manifest.json for Chrome
    copyFile('manifest.chrome.json', path.join(outputDir, 'manifest.json'));
    grunt.log.writeln('Copied manifest.chrome.json to Chrome output directory.');
  });

  grunt.registerTask('chrome', ['concat', 'uglify', 'build-chrome']);
  grunt.registerTask('firefox', ['concat', 'uglify']); // No action needed since root is already Firefox native!
  grunt.registerTask('build', ['concat', 'uglify', 'build-chrome']);

  grunt.registerTask('build-firefox-zip', 'Bundle Firefox zip for Firefox Android collection or publishing', function() {
    var done = this.async();
    var fs = require('fs');
    var path = require('path');

    grunt.log.writeln('Preparing Firefox Native manifest to root before zipping...');
    copyFile('manifest.firefox.json', 'manifest.json');

    var zipPath = 'jetzt-firefox-extension.zip';
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    import('bestzip').then(function(module) {
      var bestzip = module.bestzip || module.default;
      return bestzip({
        source: [
          'manifest.json', 'jetzt.css', 'jetzt.js', 'jetzt-solid.js', 'jetzt-solid.min.js', 'background.js', 'chrome-config.js', 'modules/', 'options/', 'img/'
        ],
        destination: zipPath
      });
    }).then(function() {
      grunt.log.writeln('Successfully generated ' + zipPath + '!');
      done();
    }).catch(function(err) {
      grunt.log.error('Zip packing failed: ' + err);
      done(false);
    });
  });

  grunt.registerTask('build-chrome-zip', 'Bundle Chrome zip for publishing on Chrome Web Store', function() {
    var done = this.async();
    var fs = require('fs');
    var path = require('path');

    var zipPath = 'jetzt-chrome-extension.zip';
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    import('bestzip').then(function(module) {
      var bestzip = module.bestzip || module.default;
      return bestzip({
        cwd: 'dist/chrome',
        source: '*',
        destination: path.join(__dirname, zipPath)
      });
    }).then(function() {
      grunt.log.writeln('Successfully generated ' + zipPath + '!');
      done();
    }).catch(function(err) {
      grunt.log.error('Chrome zip packing failed: ' + err);
      done(false);
    });
  });

  grunt.registerTask('build-all-zips', ['concat', 'uglify', 'build-chrome', 'build-firefox-zip', 'build-chrome-zip']);

  // Default task.
  grunt.registerTask('default', ['concat', 'uglify', 'build']);

};
