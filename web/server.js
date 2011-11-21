'use strict';
var express =require('express'),
    _ = require('underscore'),
    httpProxy = require('http-proxy'),
    socketio = require('socket.io'),
    fs = require('fs'),
    url = require('url'),
    path = require('path'),
    Git = require('git');

module.exports = function(options, branches){
    var proxy = new httpProxy.RoutingProxy(),
        repoDir = path.join(process.cwd(), '_repo/'),
        git = new Git({dir: repoDir});

    function getBranch(req, res, next){
        var name = req.params.branch || req.params[0];

        req.params.branch = branches.get(name) || branches.get("origin/" + name);

        if(!req.params.branch){
            res.writeHead(404);
            return res.end("Branch " + name + " not found");
        }
        next();
    }

    var app = express.createServer(
        function(req, res, next){
            var hostAndPort = req.headers.host,
                host = hostAndPort.split(':')[0],
                branchName = 'origin/' + host.replace('.' + options.domain, ''),
                branch = branches.get(branchName);

            if(options.domain !== 'localhost' && branch){
                if(branch.get('running')){
                    proxy.proxyRequest(req, res, {
                        host: 'localhost',
                        port: branch.get('port')
                    });
                }else{
                    res.writeHead(404);
                    res.end("Branch is not running yet");
                }
            }else{
                next();
            }
        },
        express.favicon(),
        express['static'](path.join(__dirname, 'public')),
        express.router(function(router){
            router.get('/', function(req, res){
                var data = {
                    title: "Running servers",
                    domain: options.domain,
                    port: options.port,
                    webRoot: options.root,
                    toJSON: JSON.stringify(branches)
                };

                res.render('home.template', data);
            });
            router.get(/^\/(.*)\/log$/, getBranch, function(req, res, next){
                var branch = req.params.branch;

                git.log('-n20 "' + branch.id + '" --', function(err, output){
                    res.render('log.template', {
                        title: "Git log for " + branch.get('name'),
                        branch: branch.get('name'),
                        output: output
                    });
                });
            });
            router.get(/^\/(.*)\/out$/, getBranch, function(req, res, next){
                var branch = req.params.branch;

                fs.readFile(path.join(process.cwd(), branch.get('name') + ".out.log"), function(err, output){
                    res.render('output.template', {
                        title: "Output stream for " + branch.get('name'),
                        branch: branch.get('name'),
                        output: output
                    });
                });
            });
            router.get(/^\/(.*)\/errors$/, getBranch, function(req, res, next){
                var branch = req.params.branch;

                fs.readFile(path.join(process.cwd(), branch.get('name') + ".error.log"), function(err, output){
                    res.render('errors.template', {
                        title: "Error stream for " + branch.get('name'),
                        branch: branch.get('name'),
                        output: output
                    });
                });
            });
            router.post(/^\/(.*)\/start$/, getBranch, function(req, res, next){
                var branch = req.params.branch;

                branch.start();

                res.redirect('/');
            });
            router.post(/^\/(.*)\/restart$/, getBranch, function(req, res, next){
                var branch = req.params.branch;

                branch.restart();

                res.redirect('/');
            });
            router.post(/^\/(.*)\/stop$/, getBranch, function(req, res, next){
                var branch = req.params.branch;

                branch.stop();

                res.redirect('/');
            });
        })
    );

    app.set('views', __dirname + '/views');
    app.register('.template', require('stache'));
    app.set('view options', {
        layout: true
    });

    var io = socketio.listen(app),
        frontend = io.of('branches')
            .on('connection', function(socket){
                branches.bind('add', function(model){
                    socket.broadcast.emit('create', model.toJSON());
                });
                branches.bind('change', function(model){
                    socket.broadcast.emit('update', model.toJSON());
                });
                branches.bind('remove', function(model){
                    socket.broadcast.emit('delete', model.toJSON());
                });
            });
    io.set('log level', 1);

    return app;
};