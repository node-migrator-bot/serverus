window.BranchesView = (function(Backbone, Mustache){
    'use strict';
    return Backbone.View.extend({
        initialize: function(){
            _(this).bindAll('render');

            this.model.bind('add', this.render);
            this.model.bind('remove', this.render);
            this.model.bind('change', this.render);
        },

        render: function(){
            var self = this;

            if(!this.template){
                $.get('/templates/servers.template', function(text){
                    self.template = text;
                    self.render();
                });
                return;
            }

            var data = this.model.reduce(function(memo, branch){
                var safeName = branch.get('name').replace(/\//, '-'),
                    domain = "http://";

                if(self.domain === 'localhost'){
                    domain += 'localhost:' + branch.get('port') + self.options.root;
                }else{
                    domain += safeName + '.' + self.options.domain + ':' + self.options.port + self.options.root;
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

            $(this.el).html(Mustache.to_html(this.template, data));
        }
    });
})(Backbone, Mustache);