'use strict';
var express =require('express'),
    _ = require('underscore'),
    httpProxy = require('http-proxy'),
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

        req.params.branch = branches[name] || branches["origin/" + name];

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
                branch = 'origin/' + host.replace('.' + options.domain, ''),
                serverKey = _(branches).chain()
                        .keys()
                        .detect(function(name){
                            if(name.toLowerCase() === branch.toLowerCase()){
                                return true;
                            }
                        })
                        .value(),
                server = branches[serverKey];

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
                var data = _(branches).reduce(function(memo, branch){
                    var safeName = branch.name.replace(/\//, '-'),
                        domain = "http://";

                    if(options.domain === 'localhost'){
                        domain += 'localhost:' + branch.port + options.root;
                    }else{
                        domain += safeName + '.' + options.domain + ':' + options.port + options.root;
                    }
                    var data = {
                        name: branch.name,
                        domain: domain,
                        status: (branch.status || "Unknown"),
                        statusClass: (branch.status || "unknown").toLowerCase().replace(/\s/, '')
                    };
                    if(branch.running){
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

                res.render('home.template', data);
            });
            router.get('/:branch/log', getBranch, function(req, res, next){
                var branch = req.params.branch;

                git.log('-n20 "' + branch.fullName + '" --', function(err, output){
                    res.render('log.template', {
                        title: "Git log for " + branch.name,
                        branch: branch.name,
                        output: output
                    });
                });
            });
            router.get('/:branch/out', getBranch, function(req, res, next){
                var branch = req.params.branch;

                fs.readFile(path.join(process.cwd(), branch.name + ".out.log"), function(err, output){
                    res.render('output.template', {
                        title: "Output stream for " + branch.name,
                        branch: branch.name,
                        output: output
                    });
                });
            });
            router.get('/:branch/errors', getBranch, function(req, res, next){
                var branch = req.params.branch;

                fs.readFile(path.join(process.cwd(), branch.name + ".error.log"), function(err, output){
                    res.render('errors.template', {
                        title: "Error stream for " + branch.name,
                        branch: branch.name,
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

    return app;
};