'use strict';
var fs = require('fs'),
    path = require('path');

module.exports = function(root){
    root = root || process.cwd();

    var config = {},
        jsonPath = path.join(root, 'serverus.json');

    if(fs.existsSync(jsonPath)){
        return JSON.parse(fs.readFileSync(jsonPath));
    }

    return /*undefined*/;
};