'use strict';
var connect =require('connect'),
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

    return connect.createServer(
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
        connect.router(function(router){
            router.get('/', function(req, res){
                function makeLink(branch){
                    var link = '<li><a href="http://';
                    if(options.domain === 'localhost'){
                        link += 'localhost:' + branches[branch].port + options.root;
                    }else{
                        link += branch.split('/')[1] + '.' + options.domain + ':' + options.port + options.root;
                    }
                    link += '" target="_blank"/>' + branch.split('/')[1] + '</a> (';

                    switch(branches[branch].status.toLowerCase()){
                        case "running":
                            link += '<span style="color:green;">' + branches[branch].status + '</span>';
                            break;
                        case "quit unexpectedly":
                        case "checkout failed":
                            link += '<span style="color:red;">' + branches[branch].status + '</span>';
                            break;
                        case "starting":
                            link += '<span style="color:orange;">' + branches[branch].status + '</span>';
                            break;
                        default:
                            link += (branches[branch].status || 'Unknown');
                            break;
                    }

                    link += ': <a href="/' + branch.split('/')[1] + '/log" target="_blank">show git log</a> ';
                    link += '| <a href="/' + branch.split('/')[1] + '/out" target="_blank">output stream</a> ';
                    link += '| <a href="/' + branch.split('/')[1] + '/errors" target="_blank">error stream</a> ';

                    link += ')</li>';
                    return link;
                }

                res.end('<!DOCTYPE html><html><head><title>Running servers</title></head>' +
                    '<body><h1>Running servers</h1><ul>' + _(branches).chain()
                        .keys()
                        .sortBy(function(branch){
                            return branch;
                        })
                        .map(function(branch){
                            return makeLink(branch);
                        }).value().join('') + '</ul></body></html>');
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
            router.get('/:branch/errors', function(req, res){
                var branch = req.params.branch;
                fs.readFile(path.join(process.cwd(), branch + ".error.log"), function(err, output){
                    res.end('<!DOCTYPE html><html><head><title>Error output for ' + branch + '</title></head>' +
                        '<body><h1>Error output for ' + branch + '</h1><pre>' + output + '</pre></body></html>');
                });
            });
        })
    );
};