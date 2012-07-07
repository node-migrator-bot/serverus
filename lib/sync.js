'use strict';
var _ = require('underscore'),
    spawn = require('child_process').spawn,
    fs = require('fs'),
    path = require('path'),
    rimraf = require('rimraf'),
    Git = require('./git');

module.exports = function(options){
    var exporting,
        serverusGitDir = options.dir,
        serverusLockFile = path.join(serverusGitDir, '__serverus.lock'),
        git = new Git({dir: serverusGitDir});

    if(!fs.existsSync(serverusGitDir)){
        throw new Error(serverusGitDir + ' could not be found - have you inited correctly?');
    }

    if(fs.existsSync(serverusLockFile)){
        if(options.force){
            console.log('deleting __serverus.lock file');
            fs.unlinkSync(serverusLockFile);
        }else{
            throw new Error(serverusGitDir + ' locked. Delete __serverus.lock or use --force if you think this is wrong');
        }
    }

    process.on('exit', function(){
        if(fs.existsSync(serverusLockFile)){
            fs.unlinkSync(serverusLockFile);
        }
    });

    function getInfoFileName(branchName){
        return path.resolve(options.dir, '../' + branchName.replace('origin/', '').replace(/\//g, '_') + '.json');
    }

    function getCheckoutInfo(branchName){
        var fileName = getInfoFileName(branchName);

        if(fs.existsSync(fileName)){
            return JSON.parse(fs.readFileSync(fileName));
        }
        return {};
    }
    function setCheckoutInfo(branchName, info){
        var fileName = getInfoFileName(branchName);

        fs.writeFileSync(fileName, JSON.stringify(info));
    }

    function checkoutTempCopy(ref, callback){
        if(fs.existsSync(serverusLockFile)){
            setTimeout(function(){
                checkoutTempCopy(ref, callback);
            }, 2000);
            return;
        }

        fs.writeFileSync(serverusLockFile, new Date() + ' ' + ref);

        git.fetch(function(err){
            if(err) return callback(err);
            console.log('checking out', ref);
            git.checkout(ref + ' --force', function(err){
                if(err) return callback(err);
                git.submodule('update --init --recursive', function(err){
                    if(err) return callback(err);
                    callback(undefined);
                });
            });
        });
    }

    function rsync(branch, fromPath, toPath, callback){
        fromPath = fromPath[fromPath.length - 1] === '/' ? fromPath : fromPath + '/';
        toPath = toPath[toPath.length - 1] === '/' ? toPath : toPath + '/';

        var rsyncProcess = spawn('rsync', ["--exclude=__serverus.lock", "--exclude=.git", "-rh", "--delete", "--links", fromPath, toPath]),
            err;

        // So it can be killed when the branch is
        branch.process = rsyncProcess;

        rsyncProcess.stdout.on('data', function(data){
            console.log(data.toString());
            branch.out.write(data);
        });
        rsyncProcess.stderr.on('data', function(data){
            console.log(branch.get('name') + " RSYNC ERROR:", data.toString());
            branch.out.write(data);
        });

        rsyncProcess.on('uncaughtException', function(error){
            err = error;
            console.error('uncaught exception while rsyncing ', branch.get('name'), err);
            branch.out.write('uncaught exception:\n');
            branch.out.write(err + '\n');
            process.kill(rsyncProcess.pid);
        });
        rsyncProcess.on('exit', function(code){
            if(code && !err) {
                return callback({message: "rsync exited with code " + code});
            }
            if(err){
                return callback(err);
            }
            callback();
        });
    }

    function checkout(branch, force, callback){
        var info = getCheckoutInfo(branch.get('name')),
            cb = callback;

        if(!fs.existsSync(branch.get('location'))){
            fs.mkdirSync(branch.get('location'), '0766');
        }

        branch.out.write('deploy is talking:\n');

        // Rewrite the callback to do our own cleanup
        callback = function(err, commitRef){
            if(fs.existsSync(serverusLockFile)){
                fs.unlinkSync(serverusLockFile);
            }

            cb(err, commitRef);
        };

        git.log('-n1 --pretty=oneline "' + branch.id + '" --', function(err, output){
            if(err) return callback(err);

            var commitRef = output.split(' ')[0];
            if(info.lastCommit === commitRef && !force){
                console.log(branch.get('name'), 'already up to date');
                callback(err, commitRef);
                return;
            }

            info.lastCommit = commitRef;
            setCheckoutInfo(branch.get('name'), info);

            branch.set({
                commitRef: commitRef
            });

            console.log('Updating', branch.get('name'));
            checkoutTempCopy(commitRef, function(err){
                if(err) return callback(err);

                branch.set({
                    status: 'Deploying'
                });
                console.log('deploying', branch.get('name'), '(' + commitRef + ')');
                rsync(branch, serverusGitDir, branch.get('location'), function(err){
                    if(err) return callback(err);

                    console.log(branch.get('name'), 'deployed');
                    branch.set({
                        status: 'Deployed'
                    });
                    callback(err, commitRef);
                });
            });
        });
    }

    return _.extend({
        checkout: checkout
    });
};
