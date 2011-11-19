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
        var name = req.params.branch;

        req.params.branch = branches.get(name) || branches.get("origin/" + name);

        if(!req.params.branch){
            res.writeHead(404);
            return res.end("Branch not found");
        }
        next();
    }

    var app = express.createServer(
        function(req, res, next){
            var hostAndPort = req.headers.host,
                host = hostAndPort.split(':')[0],
                port = hostAndPort.split(':')[1] || 80,
                branchName = 'origin/' + host.replace(options.domain, ''),
                serverKey = branchName ? branches
                        .find(function(branch){
                            if(branch.id.toLowerCase() === branchName.toLowerCase()){
                                return true;
                            }
                        }) : '',
                server = serverKey ? branches.get(serverKey) : undefined;

            if(options.domain !== 'localhost' && server){
                proxy.proxyRequest(req, res, {
                    host: 'localhost',
                    port: server.port
                });
            }else{
                next();
            }
        },
        express.favicon(),
        express['static'](path.join(__dirname, 'public')),
        express.router(function(router){
            router.get('/', function(req, res){
                var data = branches.reduce(function(memo, branch){
                    var safeName = branch.get('name').replace(/\//, '-'),
                        domain = "http://";

                    if(options.domain === 'localhost'){
                        domain += 'localhost:' + branch.get('port') + options.root;
                    }else{
                        domain += safeName + '.' + options.domain + ':' + options.port + options.root;
                    }
                    var data = {
                        id: branch.id,
                        name: branch.get('name'),
                        domain: domain,
                        status: branch.get('status'),
                        statusClass: branch.get('status').toLowerCase().replace(/\s/, '')
                    };
                    if(branch.get('running')){
                        memo.runningBranches.push(data);
                    }else{
                        memo.stoppedBranches.push(data);
                    }
                    return memo;
                }, {
                    runningBranches: [],
                    stoppedBranches: []
                });

                data.title = "Running servers";

                data.toJSON = JSON.stringify(branches);

                res.render('home.template', data);
            });
            router.get('/:branch/log', getBranch, function(req, res, next){
                var branch = req.params.branch;

                git.log('-n20 "' + branch.id + '" --', function(err, output){
                    res.render('log.template', {
                        title: "Git log for " + branch.get('name'),
                        branch: branch.get('name'),
                        output: output
                    });
                });
            });
            router.get('/:branch/out', getBranch, function(req, res, next){
                var branch = req.params.branch;

                fs.readFile(path.join(process.cwd(), branch.get('name') + ".out.log"), function(err, output){
                    res.render('output.template', {
                        title: "Output stream for " + branch.get('name'),
                        branch: branch.get('name'),
                        output: output
                    });
                });
            });
            router.get('/:branch/errors', getBranch, function(req, res, next){
                var branch = req.params.branch;

                fs.readFile(path.join(process.cwd(), branch.get('name') + ".error.log"), function(err, output){
                    res.render('errors.template', {
                        title: "Error stream for " + branch.get('name'),
                        branch: branch.get('name'),
                        output: output
                    });
                });
            });
            router.post('/:branch/start', getBranch, function(req, res, next){
                var branch = req.params.branch;

                branch.start();

                res.redirect('/');
            });
            router.post('/:branch/restart', getBranch, function(req, res, next){
                var branch = req.params.branch;

                branch.restart();

                res.redirect('/');
            });
            router.post('/:branch/stop', getBranch, function(req, res, next){
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