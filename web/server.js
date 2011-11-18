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
        express.router(function(router){
            router.get('/', function(req, res){
                function makeLink(branch){
                    var safeName = branch.name.replace(/\//, '-')[1],
                        link = '<li><a href="http://';
                    if(options.domain === 'localhost'){
                        link += 'localhost:' + branch.port + options.root;
                    }else{
                        link += safeName + '.' + options.domain + ':' + options.port + options.root;
                    }
                    link += '" target="_blank"/>' + branch.name + '</a> (';

                    switch(branch.status.toLowerCase()){
                        case "running":
                            link += '<span style="color:green;">' + branch.status + '</span>';
                            break;
                        case "quit unexpectedly":
                        case "checkout failed":
                            link += '<span style="color:red;">' + branch.status + '</span>';
                            break;
                        case "starting":
                            link += '<span style="color:orange;">' + branch.status + '</span>';
                            break;
                        default:
                            link += (branch.status || 'Unknown');
                            break;
                    }

                    link += ': <a href="/' + branch.name + '/log" target="_blank">show git log</a> ';
                    link += '| <a href="/' + branch.name + '/out" target="_blank">output stream</a> ';
                    link += '| <a href="/' + branch.name + '/errors" target="_blank">error stream</a> ';

                    link += ')';
                    link += '</li>';
                    return link;
                }

                var data = _(branches).reduce(function(memo, branch){
                    var safeName = branch.name.replace(/\//, '-')[1],
                        domain = "http://";

                    if(options.domain === 'localhost'){
                        domain += 'localhost:' + branch.port + options.root;
                    }else{
                        domain += safeName + '.' + options.domain + ':' + options.port + options.root;
                    }
                    var data = {
                        name: branch.name,
                        domain: domain,
                        status: branch.status
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

                res.render('home.template', data);
            });
            router.get('/:branch/log', function(req, res){
                var branch= req.params.branch;
                git.log('-n20 "origin/' + branch + '" --', function(err, output){
                    res.end('<!DOCTYPE html><html><head><title>Git log for ' + branch + '</title></head>' +
                        '<body><h1>Git log for ' + branch + ' (last 20 entries)</h1><pre>' + output + '</pre></body></html>');
                });
            });
            router.get('/:branch/out', function(req, res){
                var branch = req.params.branch;
                fs.readFile(path.join(process.cwd(), branch + ".out.log"), function(err, output){
                    res.end('<!DOCTYPE html><html><head><title>Output for ' + branch + '</title></head>' +
                        '<body><h1>Output for ' + branch + '</h1><pre>' + output + '</pre></body></html>');
                });
            });
            router.get('/:branch/error', function(req, res){
                var branch = req.params.branch;
                fs.readFile(path.join(process.cwd(), branch + ".error.log"), function(err, output){
                    res.end('<!DOCTYPE html><html><head><title>Error output for ' + branch + '</title></head>' +
                        '<body><h1>Error output for ' + branch + '</h1><pre>' + output + '</pre></body></html>');
                });
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