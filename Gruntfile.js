'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('facetly.jquery.json'),
    banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
      '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
      '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
      '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
      ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */\n',
    // Task configuration.
    clean: {
      files: ['dist']
    },
    concat: {
      options: {
        banner: '<%= banner %>',
        stripBanners: true
      },
    },
    uglify: {
      production: {
        src: 'src/<%= pkg.name %>.js',
        dest: 'dist/<%= pkg.name %>.min.js'
      }
    },
    less: {
      production: {
        options: {
          yuicompress: true
        },
        files: {
          "dist/<%= pkg.name %>.min.css": "less/<%= pkg.name %>.less"
        }
      },
      development: {
        options: {
          yuicompress: false
        },
        files: {
          "dist/<%= pkg.name %>.css": "less/<%= pkg.name %>.less"
        }
      }
    },
    usebanner: {
      dist: {
        options: {
          position: 'top',
          banner: '<%= banner %>'
        },
        files: {
          src: [ 'dist/*.*' ]
        }
      }
    },
    watch: {
      script: {
        files: 'src/*',
        tasks: ['clean', 'less', 'concat', 'uglify', 'usebanner']
      },
      less: {
        files: 'less/*',
        tasks: ['clean', 'less', 'concat', 'uglify', 'usebanner']
      }
    },
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-banner');

  // Default task.
  grunt.registerTask('default', ['clean', 'less', 'concat', 'uglify', 'usebanner']);

};
