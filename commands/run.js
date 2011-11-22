'use strict';
var _ = require('underscore'),
    path = require('path'),
    cli = require('cli'),
    Backbone = require('backbone'),
    Sync = require('../lib/sync'),
    Config = require('../lib/config'),
    Git = require('../lib/git'),
    server = require('../web/server'),
    Branch = require('../lib/branch').Branch,
    Branches = Backbone.Collection.extend({
            Model: Branch
        });

function getShortBranchName(fullBranchName){
    return fullBranchName.split('/').slice(1).join('/');
}

module.exports = function run(args){
    var config = new Config(),
        repoDir = path.join(process.cwd(), '_repo/'),
        git = new Git({dir: repoDir}),
        sync, monitor,
        currentPort = 8124,
        branches = new Branches();

    cli.setArgv(['run'].concat(args));
    var options = cli.parse({
        port: ['p', 'Port for serverus to listen on', 'number', config.port || 8123],
        startingPort: ['s', 'Port to start branch servers listening on', 'number', config.startingPort || 8124],
        root: ['r', 'Root URL of server instances, affects the URL linked to from the serverus server', 'string', config.root || '/'],
        domain: ['d', 'The domain name to serve branches up as subdomains of', 'string', config.domain || 'localhost'],
        force: ['', 'Force run, remove __serverus.lock file from checkout if necessary', 'bool', false]
    }, {});

    if(!config){
        throw new Error('Directory not initialised, run serverus init [git url]');
    }

    sync = new Sync({
        dir: repoDir,
        force: options.force
    });
    currentPort = options.startingPort;

    function getOrMakeBranch(fullBranchName){
        var branchName = getShortBranchName(fullBranchName),
            branch = branches.get(fullBranchName);

        if(!branch){
            branch = new Branch({
                    id: fullBranchName,
                    sync: sync,
                    name: branchName,
                    fullName: fullBranchName,
                    port: currentPort++,
                    globalConfig: config,
                    config: config[branchName]
                });
            branch.id = fullBranchName;
            branches.add(branch);
        }
        return branch;
    }

    git.branches('-r', function(err, gitBranches){
        console.log('found', gitBranches.length, 'branches');
        _(gitBranches).forEach(function(fullBranchName){
            var branchName = getShortBranchName(fullBranchName),
                branch = getOrMakeBranch(fullBranchName);

            if(config.branches && config.branches.indexOf(branchName) > -1){
                branch.start();
            }
        });
    });

    console.log('spawning serverus\'s server on ', 'http://' + options.domain + (options.port === 80 ? '' : ':' + options.port));
    server(options, branches).listen(options.port);

    monitor = setInterval(function(){
        git.fetch(function(err, output){
            git.branches('-r', function(err, gitBranches){
                _(gitBranches).each(function(fullBranchName){
                    var branch = getOrMakeBranch(fullBranchName);

                    if(!branch.get('running')){
                        return;
                    }

                    git.log('-n1 --pretty=oneline "' + branch.id + '" --', function(err, output){
                        var branchCommitRef = output.split(' ')[0],
                            commitRef = branch.get('commitRef') || '';

                        if(branchCommitRef != commitRef){
                            console.log(branch.get('name'), 'has changed (' + commitRef, 'vs', branchCommitRef + '),', 'updating');

                            branch.set({commitRef: commitRef});
                            branch.restart();
                        }
                    });
                });
            });
        });
    }, 15000);

    var exiting = false;
    process.on('SIGINT', function(){
        clearInterval(monitor);

        if(exiting){
            console.log('already exiting, so killing myself completely (beware of zombie processes)');
            return process.exit(1);
        }

        if(branches.size() === 0){
            return process.exit(0);
        }

        exiting = true;
        console.log('killing branches, ctrl-c again will exit without cleaning up');
        process.stdin.resume();

        function stopBranch(branch){
            branch.stop(function(){
                branches.remove(branch);

                if(branches.size() === 0){
                    console.log('all processes cleaned up, exiting');
                    process.exit(0);
                }else{
                    stopBranch(branches.at(0));
                }
            });
        }

        stopBranch(branches.at(0));
    });
};