var Log = {

    debug: true,
    e: function (/** String */TAG, /** String */message, /** Error */exception) {
        if (!this.debug) {
            return;
        }
        var msg = '';
        if (arguments.length === 1) {
            console.error(arguments[0]);
        } else if (arguments.length === 2) {
            msg = arguments[0] + ":" + arguments[1];
            console.error(msg);
            this.display(msg);
        } else if (arguments.length === 3) {
            console.error(arguments[0] + ":" + arguments[1] + ":" + arguments[2].message);
        } else {
            throw new Error('Too many or too less parameters');
        }
    },

    w: function (/** String */TAG, /** String */message, /** Error */exception) {
        if (!this.debug) {
            return;
        }
        var msg = '';
        if (arguments.length === 1) {
            console.warn(arguments[0]);
        } else if (arguments.length === 2) {
            msg = arguments[0] + ":" + arguments[1];
            console.warn(msg);
            this.display(msg);
        } else if (arguments.length === 3) {
            console.warn(arguments[0] + ":" + arguments[1] + ":" + arguments[2].message);
        } else {
            throw new Error('Too many or too less parameters');
        }
    },

    d: function (/** String */TAG, /** String */message, /** Error */exception) {
        if (!this.debug) {
            return;
        }
        var msg = '';
        if (arguments.length === 1) {
            console.log(arguments[0]);
        } else if (arguments.length === 2) {
            msg = arguments[0] + ":" + arguments[1];
            console.log(msg);
            this.display(msg);
        } else if (arguments.length === 3) {
            console.log(arguments[0] + ":" + arguments[1] + ":" + arguments[2].message);
        } else {
            throw new Error('Too many or too less parameters');
        }
    },
    
    display: function(msg){
        $("#log").text( msg + "\n" + $("#log").text() );
    }
    
};