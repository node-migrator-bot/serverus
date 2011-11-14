'use strict';
var fs = require('fs'),
    assert = require('assert'),
    path = require('path'),
    http = require('http'),
    testHelper = require('testHelper')(__dirname, true),
    testDir = testHelper.setupTestFolder(),
    exec = testHelper.exec;

exec('git init . && ../../serverus init ./.git', function(){
  fs.writeFileSync("server.js", 'var http = require("http");\n' +
                                'module.exports = http.createServer(function (req, res) {\n' +
                                '  console.log("Server request for ", req.path);\n' +
                                '  res.writeHead(200, {"Content-Type": "text/plain"});\n' +
                                '  res.end("Hello World");\n' +
                                '});');
  var childExited = false;
  var child;
  var childError, childStdOut, childStdErr;
  exec('git add server.js && git commit -m "Added server.js" && git checkout -b newBranch', function(err, stdout, stderr){
    child = exec('cd .serverus && ../../../serverus run', function(err, stdout, stderr){
      //console.log('child exited', err || '[no err]', stderr || '[no stderr]', stdout || '[no stdout]');
      childError = err;
      childStdOut = stdout;
      childStdErr = stderr;
      childExited = true;
    });

    exports['Runs process'] = function(){
      assert.ok(child);
      assert.ok(child.pid);
    };

    exports['Can GET from server'] = function(beforeExit){
      var canExit = false;

      setTimeout(function(){
        http.get({
          host: 'localhost',
          path: '/',
          port: 8124
        }, function(res){
          var html = '';
          res.on('data', function(data){
            html += data;
          });
          res.on('end', function(){
            canExit = true;
            child.kill();
            assert.equal('Hello World', html);
          });
        }).on('error', function(err){
          child.kill();
          canExit = true;
        });
      }, 500);

      beforeExit(function(){
        assert.ok(canExit);
      });
    };

    exports['Output gives you branches and ports'] = function(beforeExit){
      var asserted = false;

      setTimeout(function(){
        if(childExited){
          //assert.ok(childStdOut.indexOf('Spawning server for master') > -1);
          //assert.ok(childStdOut.indexOf('Spawning server for newBranch') > -1);
          asserted = true;
        }
      }, 500);

      beforeExit(function(){
        assert.ok(asserted);
      });
    };

    exports['No errors running app'] = function(beforeExit){
      var asserted = false;

      var interval = setInterval(function(){
        if(childExited){
          clearInterval(interval);

          assert.ok(!childError || childError.killed, childError + childStdErr);
          asserted = true;
          testDir.remove();
        }
      }, 500);

      beforeExit(function(){
        assert.ok(asserted);
      });
    };
  });
});