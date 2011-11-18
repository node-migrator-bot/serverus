'use strict';
var _ = require('underscore'),
    path = require('path'),
    fs = require('fs'),
    exec = require('child_process').exec,
    spawn = require('child_process').spawn,
    emptyFn = function(){};

function killServer(branch, cb){
    cb = cb || emptyFn;
    if(!branch.process){
        return cb();
    }
    console.log('killing server on port', branch.port);

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
        args = config.args,
        process;

    if(runBeforeExec && config.beforeExec){
        console.log('Running beforeExec script for', branch.name);
        branch.status = "Starting";
        exec(config.beforeExec, {cwd: branch.location}, function(err, output){
            if(err) {
                branch.status = "beforeExec failed";
                return console.log('error running beforeExec script for', branch.name, err);
            }

            startServer(branch, false);
        });
        return;
    }

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

    branch.sync.checkout(branch.name, location, function(err, commitRef){
        var args = _(branch.config.args).map(function(arg){
                    return arg
                        .replace(/\$PORT\+1000/g, branch.port + 1000)
                        .replace(/\$PORT/g, branch.port);
                });

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
    branch.sync = sync;
    branch.config = _.extend(globalConfig, options.config || {});
    branch.port = options.port;
    branch.location = location;
    branch.status = "Stopped";
    branch.out = fs.createWriteStream(location + '.out.log', {flags: 'w'});
    branch.error = fs.createWriteStream(location + '.error.log', {flags: 'w'});

    this.start = function(){
        branch.status = "Starting";

        checkoutAndStartServer(branch);
    };
    this.restart = function(){
        if(!branch.process){
            return;
        }
        branch.process.on('exit', function(){
            process.nextTick(function(){
                branch.start();
            });
        });
        killServer(branch);
    };
    this.stop = function(cb){
        branch.out.destroySoon();
        branch.error.destroySoon();

        killServer(branch, cb);
    };
};