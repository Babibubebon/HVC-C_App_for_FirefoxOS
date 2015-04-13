/*--------------------------------------------------------------------------*
 * Library for communicating to Arduino
 *       (c) 2014 Shohei Toyota
 * Released under The MIT License.
 * http://opensource.org/licenses/MIT
 *--------------------------------------------------------------------------*/
var XbeeSocket = function(){
    this.host = '';
    this.port = '';
};

XbeeSocket.prototype = {
    setHost: function(host, port){
        this.host = host;
        this.port = port;
    },
    
    send: function(data){
        return new Promise(function(resolve, reject){
            var conn = navigator.mozTCPSocket.open(this.host, this.port);
            conn.onopen = function() {
                conn.send(data);
            };
            conn.ondata = function(res) {
                conn.close();
                console.log("res: " + res.data);
                resolve(res.data);
            }; 
            conn.onerror = function(err) {
                reject(err);
            };
        }.bind(this));
    }
};

var Arduino = function(){
    this.values = [];
    this.socket = null;
};

Arduino.prototype = {
    setSocket: function(socket){
        this.socket = socket;
    },
    sendCmd: function(cmd){
        return this.socket.send(cmd + String.fromCharCode(0x0d));
    },
    
    analogRead: function(pin) {
        if(typeof pin === 'string' && pin.charAt(0) === 'A'){
            pin = parseInt(pin.charAt(1)) + 14;
        }
        return this.sendCmd('A' + pin).then(function(val){
            val = parseInt(val);
            this.values[pin] = val;
            return val;
        }.bind(this));
    },
    analogWrite: function(pin, val) {
        return this.sendCmd('a' + pin + ',' + Math.round(val));
    },
    digitalRead: function(pin) {
        return this.sendCmd('D' + pin).then(function(val){
            val = (parseInt(val) === 1) ? true : false;
            this.values[pin] = val;
            return val;
        }.bind(this));
    },
    digitalWrite: function(pin, val) {
        switch(val){
            case 'LOW':
            case false:
            case 0:
                val = 0; break;
            case 'HIGH' :
            case true:
            case 1:
                val = 1; break;
        }
        return this.sendCmd('d' + pin + ',' + val);
    },
    pulse: function(pin, ontime, offtime) {
        return this.sendCmd('P' + pin + ',' + ontime + ',' + offtime);
    },
    pinMode: function(pin, mode) {
        switch(mode){
            case 'OUTPUT': mode = 0; break;
            case 'INPUT' : mode = 1; break;
            case 'INPUT_PULLUP': mode = 2; break;
        }
        return this.sendCmd('p' + pin + ',' + mode);
    }
};