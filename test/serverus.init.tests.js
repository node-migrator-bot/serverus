'use strict';
var fs = require('fs'),
    assert = require('assert'),
    path = require('path'),
    testHelper = require('testHelper')(__dirname),
    exec = testHelper.exec,
    testDir = testHelper.setupTestFolder();

exec('git init .', function(){
  exec('../../serverus init ./.git', function(){

    exports['Creates serverus dir'] = function(beforeExit){
      assert.ok(path.existsSync(testDir.path + '/.serverus'));
    };
    exports['Creates serverus.json'] = function(beforeExit){
      assert.ok(path.existsSync(testDir.path + '/.serverus/serverus.json'));

      testDir.remove();
    };
  });
});