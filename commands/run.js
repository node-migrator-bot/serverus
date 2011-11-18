'use strict';
var _ = require('underscore'),
    path = require('path'),
    fs = require('fs'),
    exec = require('child_process').exec,
    spawn = require('child_process').spawn,
    cli = require('cli'),
    server = require('../server'),
    Sync = require('sync'),
    Config = require('config'),
    Git = require('git');

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

    function getServer(branch, location){
        var server = branches[branch];

        function killServer(){
            console.log('killing server on port', server.port);
            process.exitCounter = (process.exitCounter || 0) + 1;
            process.stdin.resume();
            if(server.process){
                server.process.on('exit', function(){
                    console.log('server on', server.port, 'exited');
                    server.out.destroySoon();
                    server.error.destroySoon();

                    if(--process.exitCounter === 0){
                        console.log('all processes cleaned up, exiting');
                        process.exit(0);
                    }
                });
                process.kill(server.process.pid);
            }
            return false;
        }

        if(!server){
            server = branches[branch] = {
                port: currentPort++,
                location: location,
                status: "Starting",
                out: fs.createWriteStream(location + '.out.log', {flags: 'w'}),
                error: fs.createWriteStream(location + '.error.log', {flags: 'w'})
            };
            process.on('SIGINT', killServer);
            //process.on('uncaughtException', killServer);
        }

        return server;
    }

    function startServer(branch, server, runBeforeExec){
        var config = server.config,
            args = server.args,
            process;

        if(runBeforeExec && config.beforeExec){
            console.log('Running beforeExec script for', branch);
            server.status = "Starting";
            exec(config.beforeExec, {cwd: server.location}, function(err, output){
                if(err) {
                    server.status = "beforeExec failed";
                    return console.log('error running beforeExec script for', branch, err);
                }

                startServer(branch, server, false);
            });
            return;
        }

        console.log('Spawning server for', branch + ':', config.exec, args);

        server.process = spawn(config.exec, args, {
            cwd: server.location
        });

        server.process.stdout.on('data', function (data) {
            server.out.write(data);
        });
        server.process.stderr.on('data', function (data) {
            console.log(branch, data.toString());
            server.error.write(data);
        });
        server.process.on('uncaughtException', function(err){
            console.error('uncaught exception in', branch, err);
            server.status = "Failed";
            server.process.kill();
        });
        server.process.on('exit', function (code) {
            server.status = server.status === "Failed" ? "Failed" : "Quit unexpectedly";
            server.out.write('exited with code ' + code);
        });
        server.status = "Running";
    }

    function makeCheckoutLocation(branchName){
        return path.join(process.cwd(), branchName.replace(/\//g, '_').replace('origin_', ''));
    }

    function checkoutAndStartServer(branch, additionalConfig){
        var location = makeCheckoutLocation(branch),
            combinedConfig = _.extend(config, additionalConfig || {});

        if(!path.existsSync(location)){
            fs.mkdirSync(location, '0766');
        }

        sync.checkout(branch, location, function(err, commitRef){
            var server = getServer(branch, location),
                args = _(combinedConfig.args).map(function(arg){
                        return arg
                            .replace(/\$PORT\+1000/g, server.port + 1000)
                            .replace(/\$PORT/g, server.port);
                    });

            if(err){
                server.status = "Checkout failed";
                console.error(branch, 'could not checkout', err);
                return;
            }
            console.log('checked out ', branch, 'at commit', commitRef);

            server.commitRef = commitRef;
            server.location = location;
            server.args = args;
            server.config = combinedConfig;

            startServer(branch, server, true);
        });
    }

    if(config.branches){
        config.branches.forEach(function(branch){
            checkoutAndStartServer("origin/" + branch, config[branch]);
        });
    }else{
        git.branches('-r', function(err, branches){
            _(branches).sortBy(function(branchName){
                return branchName;
            }).forEach(function(branch){
                checkoutAndStartServer(branch, config[branch] || config[branch.substring(branch.indexOf('/')+1)]);
            });
        });
    }

    console.log('spawning serverus\'s server on ', 'http://' + options.domain + (options.port === 80 ? '' : ':' + options.port));
    server(options, {
        branches: branches
    }).listen(options.port);

    monitor = setInterval(function(){
        git.fetch(function(err, output){
            _.keys(branches).forEach(function(branch){
                git.log('-n1 --pretty=oneline "' + branch + '" --', function(err, output){
                    var server = branches[branch],
                        branchCommitRef = output.split(' ')[0],
                        commitRef = branches[branch].commitRef;

                    if(branchCommitRef != commitRef){
                        console.log(branch, 'has changed (' + commitRef + ' vs ' + branchCommitRef + '), updating');
                        sync.checkout(branch, server.location, function(err){
                            if(err){
                                server.status = "Checkout failed";
                                console.error(branch, 'could not checkout', err);
                                return;
                            }
                            console.log('restarting server due to branch change', branch);

                            server.process.on('exit', function(){
                                process.nextTick(function(){
                                    startServer(branch, server, true);
                                });
                            });
                            process.kill(server.process.id);
                        });
                    }
                });
            });
        });
    }, 15000);

    process.on('exit', function(){
        clearInterval(monitor);
    });
};