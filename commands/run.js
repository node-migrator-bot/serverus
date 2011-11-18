'use strict';
var _ = require('underscore'),
    path = require('path'),
    cli = require('cli'),
    Sync = require('sync'),
    Config = require('config'),
    Git = require('git'),
    server = require('../web/server'),
    Branch = require('../branch').Branch;

module.exports = function run(args){
    var config = new Config(),
        repoDir = path.join(process.cwd(), '_repo/'),
        git = new Git({dir: repoDir}),
        sync, monitor,
        currentPort = 8124,
        branches = {};

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

    git.branches('-r', function(err, gitBranches){
        console.log('found', gitBranches.length, 'branches');
        _(gitBranches).sortBy(function(branchName){
            return branchName;
        }).forEach(function(fullBranchName){
            var branchName = fullBranchName.split('/').slice(1).join('/'),
                branch = branches[fullBranchName] = new Branch(sync, config, {
                    name: branchName,
                    fullName: fullBranchName,
                    port: currentPort++,
                    config: config[branchName]
                });

            if(config.branches.indexOf(branchName) > -1){
                branch.start();
            }
        });
    });

    console.log('spawning serverus\'s server on ', 'http://' + options.domain + (options.port === 80 ? '' : ':' + options.port));
    server(options, branches).listen(options.port);

    monitor = setInterval(function(){
        git.fetch(function(err, output){
            _(branches).each(function(branch, branchName){
                if(!branch.running){
                    return;
                }

                git.log('-n1 --pretty=oneline "' + branchName + '" --', function(err, output){
                    var branchCommitRef = output.split(' ')[0],
                        commitRef = branch.commitRef;

                    if(branchCommitRef != commitRef){
                        console.log(branch.name, 'has changed (' + commitRef + ' vs ' + branchCommitRef + '), updating');

                        server.restart();
                    }
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

        exiting = true;
        console.log('killing branches, ctrl-c again will exit without cleaning up');
        _(branches).each(function(branch, key){
            process.stdin.resume();

            branch.stop(function(){
                var remainingBranches = _(branches).keys().length;
                delete branches[key];

                if(--remainingBranches === 0){
                    console.log('all processes cleaned up, exiting');
                    process.exit(0);
                }
            });
        });
    });
};