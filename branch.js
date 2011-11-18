'use strict';
var _ = require('underscore'),
    path = require('path'),
    fs = require('fs'),
    spawn = require('child_process').spawn,
    emptyFn = function(){};

function killServer(branch, cb){
    cb = cb || emptyFn;
    branch.running = false;

    if(!branch.process){
        return cb();
    }
    console.log('killing server for', branch.name, 'on port', branch.port);

    branch.process.on('exit', function(){
        console.log('server on', branch.port, 'exited');

        cb();
    });
    process.kill(branch.process.pid);
}

function makeCheckoutLocation(branchName){
    return path.join(process.cwd(), branchName.replace(/\//g, '_').replace('origin_', ''));
}

function startServer(branch, runBeforeExec){
    var config = branch.config,
        args,
        err;

    if(runBeforeExec && config.beforeExec){
        console.log('Running beforeExec script for', branch.name);
        branch.status = "Starting";
        branch.process = spawn(config.beforeExec, config.beforeExecArgs || [], {cwd: branch.location});
        branch.process.on('uncaughtException', function(e){
            err = e;
        });
        branch.process.on('exit', function(){
            if(err) {
                branch.status = "beforeExec failed";
                return console.log('error running beforeExec script for', branch.name, err);
            }

            if(branch.running){
                startServer(branch, false);
            }
        });
        return;
    }

    args = _(config.args).map(function(arg){
                return arg
                    .replace(/\$PORT\+1000/g, branch.port + 1000)
                    .replace(/\$PORT/g, branch.port);
            });

    console.log('Spawning server for', branch.name + ':', config.exec, args);

    branch.process = spawn(config.exec, args, {
        cwd: branch.location
    });

    branch.process.stdout.on('data', function (data) {
        branch.out.write(data);
    });
    branch.process.stderr.on('data', function (data) {
        console.log(branch, data.toString());
        branch.error.write(data);
    });
    branch.process.on('uncaughtException', function(err){
        console.error('uncaught exception in', branch, err);
        branch.status = "Failed";
        branch.process.kill();
    });
    branch.process.on('exit', function (code) {
        branch.status = branch.status === "Failed" ? "Failed" : "Quit unexpectedly";
        branch.out.write('exited with code ' + code);
    });
    branch.status = "Running";
}

function checkoutAndStartServer(branch){
    var location = branch.location;

    if(!path.existsSync(location)){
        fs.mkdirSync(location, '0766');
    }

    branch.sync.checkout(branch, function(err, commitRef){
        if(err){
            branch.status = "Checkout failed";
            console.error(branch.name, 'could not checkout', err);
            return;
        }
        console.log('checked out ', branch.name, 'at commit', commitRef);

        branch.commitRef = commitRef;

        startServer(branch, true);
    });
}

exports.Branch = function(sync, globalConfig, options){
    var branch = this,
        location = makeCheckoutLocation(options.name);

    branch.name = options.name;
    branch.fullName = options.fullName || 'origin/' + options.name;
    branch.sync = sync;
    branch.config = _.extend(globalConfig, options.config || {});
    branch.port = options.port;
    branch.location = location;
    branch.status = "Stopped";
    branch.running = false;

    this.start = function(){
        branch.status = "Starting";
        branch.running = true;
        branch.out = branch.out || fs.createWriteStream(location + '.out.log', {flags: 'w'});
        branch.error = branch.error || fs.createWriteStream(location + '.error.log', {flags: 'w'});

        checkoutAndStartServer(branch);
    };
    this.restart = function(){
        killServer(branch, function(){
            branch.start();
        });
    };
    this.stop = function(cb){
        killServer(branch, function(){
            if(branch.out){
                branch.out.destroySoon();
                delete branch.out;
            }
            if(branch.error){
                branch.error.destroySoon();
                delete branch.error;
            }

            (cb || emptyFn)();
        });
    };
};