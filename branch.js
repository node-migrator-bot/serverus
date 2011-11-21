'use strict';
var _ = require('underscore'),
    path = require('path'),
    fs = require('fs'),
    rimraf = require('rimraf'),
    spawn = require('child_process').spawn,
    Backbone = require('backbone'),
    emptyFn = function(){};

function killServer(branch, cb){
    cb = cb || emptyFn;
    if(!branch.process){
        branch.set({running: false});
        return cb();
    }
    console.log('killing server for', branch.get('name'), 'on port', branch.get('port'));

    branch.process.on('exit', function(){
        console.log('server on', branch.get('port'), 'exited');
        branch.set({running: false});
        cb();
    });
    process.kill(branch.process.pid);
}

function makeCheckoutLocation(branchName){
    return path.join(process.cwd(), branchName.replace(/\//g, '_').replace('origin_', ''));
}

function startServer(branch, runBeforeExec){
    var config = branch.get('config'),
        args,
        err;

    if(runBeforeExec && config.beforeExec){
        console.log('Running beforeExec script for', branch.get('name'));
        branch.status = "Running beforeExec";

        branch.out.write('beforeExec is talking:\n');
        branch.error.write('beforeExec is talking:\n');

        branch.process = spawn(config.beforeExec, config.beforeExecArgs || [], {cwd: branch.get('location')});
        branch.process.on('uncaughtException', function(e){
            err = e;
        });
        branch.process.on('exit', function(code){
            if(err) {
                branch.set({status: "beforeExec failed"});
                return console.log('error running beforeExec script for', branch.get('name'), err);
            }
            branch.set({status: "Starting"});
            delete branch.process;
            branch.out.write('exited with code ' + code + '\n\n');

            if(branch.get('running')){
                startServer(branch, false);
            }
        });
    }else{
        branch.set({status: "Spawning server"});

        args = _(config.args).map(function(arg){
                    return arg
                        .replace(/\$PORT\+1000/g, branch.get('port') + 1000)
                        .replace(/\$PORT/g, branch.get('port'));
                });

        console.log('Spawning server for', branch.get('name') + ':', config.exec, args);

        branch.out.write('server is talking:\n');
        branch.error.write('server is talking:\n');

        branch.process = spawn(config.exec, args, {
            cwd: branch.get('location')
        });
        branch.set({status: "Running"});

        branch.process.on('exit', function (code) {
            branch.set({
                status: branch.status === "Failed" ? "Failed" : "Quit unexpectedly"
            });
            delete branch.process;
            branch.out.write('exited with code ' + code + '\n\n');
        });
    }

    // Whether it's the beforeExec script or the main script, log errors the same way
    branch.process.stdout.on('data', function (data) {
        branch.out.write( data);
    });
    branch.process.stderr.on('data', function (data) {
        console.log(branch.get('name') + " ERROR:", data.toString());
        branch.error.write(data);
    });
    branch.process.on('uncaughtException', function(err){
        console.error('uncaught exception in', branch.get('name'), err);
        branch.error.write('uncaught exception:\n');
        branch.error.write(err + '\n');
        branch.set({status: "Failed"});
        branch.process.kill();
    });
}

function checkoutAndStartServer(branch, force){
    var location = branch.get('location');

    if(!path.existsSync(location)){
        fs.mkdirSync(location, '0766');
    }

    branch.set({status: "Updating checkout"});
    branch.sync.checkout(branch, force, function(err, commitRef){
        if(err){
            branch.set({status: "Checkout failed"});
            console.error(branch.get('name'), 'could not checkout', err);
            return;
        }
        console.log('checked out ', branch.get('name'), 'at commit', commitRef);

        branch.set({
            status: "Starting",
            commitRef:commitRef
        });

        startServer(branch, true);
    });
}

exports.Branch = Backbone.Model.extend({

    defaults: {
        status: 'Unknown',
        running: false
    },

    initialize: function(options){
        var branch = this,
            location = makeCheckoutLocation(options.name);

        branch.sync = options.sync;

        branch.set({
            name: options.name,
            fullName: options.fullName || 'origin/' + options.name,
            config: _.extend(options.globalConfig, options.config || {}),
            port: options.port,
            location: location,
            status: "Stopped",
            running: false
        });

        _(this).bindAll('start', 'stop', 'restart');
    },

    start: function(force){
        var branch = this,
            location = branch.get('location');

        branch.set({
            status: "Starting",
            running: true
        });
        branch.out = branch.out || fs.createWriteStream(location + '.out.log', {flags: 'w'});
        branch.error = branch.error || fs.createWriteStream(location + '.error.log', {flags: 'w'});

        checkoutAndStartServer(branch, force);
    },

    restart: function(){
        var branch = this;

        branch.stop(function(){
            branch.start(true);
        });
    },

    stop: function(cb){
        var branch = this;

        killServer(branch, function(){
            branch.set({status: "Stopped"});
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
    }
});