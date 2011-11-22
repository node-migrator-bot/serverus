'use strict';
var fs = require('fs'),
    path = require('path'),
    _ = require('underscore'),
    Config = require('./config');

module.exports.parse = function(){
    var self = this,
        args = process.argv.splice(2);

    this.command = args[0];

    try{
        require.resolve('../commands/' + this.command);
    }catch(e){
        this.command = 'help';
    }

    this.args = args.splice(1);

    return this;
};