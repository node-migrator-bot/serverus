window.BranchesView = (function(Backbone, Mustache){
    'use strict';
    return Backbone.View.extend({

        events: {
            'submit form': 'ajaxSubmit',
            'click a:not(.name)': 'modalWindow'
        },

        initialize: function(){
            _(this).bindAll('render');

            this.model.bind('add', this.render);
            this.model.bind('remove', this.render);
            this.model.bind('change', this.render);
        },

        ajaxSubmit: function(e){
            $.post($(e.target).closest('form').attr('action'));

            return false;
        },

        modalWindow: function(e){
            var href = $(e.target).attr('href'),
                $el = $('<div></div>');

            $el.load(href).showModal({
                onClose: function(){
                    $el.remove();
                }
            });
            return false;
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

                if(self.options.domain === 'localhost'){
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
                if(branch.get('deployed')){
                    memo.runningBranches.push(data);
                }else{
                    memo.stoppedBranches.push(data);
                }
                return memo;
            }, {
                runningBranches: [],
                stoppedBranches: []
            });

            data.showRunningBranches = !!data.runningBranches.length;
            data.showStoppedBranches = !!data.stoppedBranches.length;

            $(this.el).html(Mustache.to_html(this.template, data));
        }
    });
})(Backbone, Mustache);