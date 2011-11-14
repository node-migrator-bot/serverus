'use strict';
var fs = require('fs'),
    path = require('path'),
    Config = require('config'),
    Git = require('git');

module.exports = function init(args){
    var gitRepo = args[0],
        config = new Config(),
        dir =process.cwd(),
        git = new Git({dir: dir}),
        dirName =  (args[1] || gitRepo.match(/[\/\:]([^\/\:]*)$/)[1].replace('.git', '')) + '.serverus',
        initPath = path.join(dir, dirName),
        options = JSON.parse(fs.readFileSync(path.join(__dirname, '../defaultOptions.json')));

    if(config.dir){
        console.error('serverus appears to be created already in ' + process.cwd());
        process.exit(1);
    }
    if(!path.existsSync(initPath)){
        console.log('creating', initPath);
        fs.mkdirSync(initPath, '0766');
    }

    var cloneDir = path.join(initPath, "_repo");

    console.log('Cloning', gitRepo, 'to', cloneDir);
    git.clone(gitRepo, cloneDir, function(err){
        if(err) throw err;
        console.log('private git clone created in', cloneDir);

        console.log('writing config file to', initPath);
        fs.writeFileSync(path.join(initPath, 'serverus.json'), JSON.stringify(options));
    });
};