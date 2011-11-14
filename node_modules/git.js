'use strict';
var path = require('path'),
    execProcess = require('child_process').exec;

module.exports = function(options){
  var dir = options.dir;

  if(!dir){
    throw new Error('dir not passed');
  }

  function exec(cmd, fn){
    return execProcess(cmd, {cwd: dir}, function execProcessCallback(err, output, stdError){
      if(fn) fn(err, output, stdError);
    });
  }

  return {
    status: function(fn){
      exec('git status', function(err, output){
        fn(err, output);
      });
    },
    log: function(params, fn){
      exec('git log ' + params, function(err, output){
        fn(err, output);
      });
    },
    fetch: function(fn){
      exec('git fetch', function(err, output){
        if(err) return fn(err, output);

        fn();
      });
    },
    clone: function(path, to, fn){
      exec('git clone --recursive ' + path + ' ' + to, function(err, output){
        if(err) return fn(err, output);

        fn();
      });
    },
    branches: function(params, fn){
      exec('git branch ' + params, function(err, output){
        if(err){
          return fn(err, output);
        }
        var lines = output.split('\n');
        var branches = [];
        for(var i = 0; i < lines.length; i++){
          if(lines[i]){
            branches.push(lines[i].split('->')[0].trim());
          }
        }
        fn(null, branches);
      });
    },
    checkout: function(branch, fn){
      exec('git checkout ' + branch, function(err, output){
        if(err){
          return fn(err, output);
        }
        fn();
      });
    },
    submodule: function(params, fn){
      exec('git submodule ' + params, fn);
    },
    'export': function(branch, location, fn){
      exec('git archive ' + branch + ' | tar -x -C ' + location, function(err, output){
        if(err){
          return fn(err, output);
        }
        fn(null);
      });
    }
  };
};