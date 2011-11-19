(function($){
    'use strict';
    /*
     * Requires jQuery Tools - a simple extension for showing a HTML element modally
    **/
    $.fn.showModal = function(options){
        var $this = $(this),
            modalPlaceholder = $('<div class="modalPlaceholder" />').css({position: 'absolute'}),
            top, left;

        if($this.parent().is('.modalPlaceholder')){
            return;
        }

        modalPlaceholder.appendTo('body')
                        .html(this);

        options = options || {};

        if(options.centre || _.isUndefined(options.centre)){
            top = $(window).height() / 2 - ($this.height() / 2);
            left = $(window).width() / 2 - ($this.width() / 2);
        }else{
            top = options.top;
            left = options.left;
        }

        var overlay = modalPlaceholder.overlay({

            mask: {
                color: '#FFF',
                loadSpeed: 200,
                opacity: 0.8
            },

            top: top,
            left: left,

            // disable this for modal dialog-type of overlays
            closeOnClick: false,

            // load it immediately after the construction
            load: true,

            onClose: function(){
                if(options.onClose){
                    options.onClose();
                }
                modalPlaceholder.remove();
            }
        }).data('overlay');

        $this.data('overlay', overlay);

        return overlay;
    };
    /*
     * Removes a modal previously shown via showModal
    **/
    $.fn.removeModal = function(){
        var $this = $(this),
            overlay = $this.data('overlay');

        overlay.close();
    };
})(jQuery);