var HVC = (function(){
    // HVC
    const TAG = "HVC-C BLE";
    
    /* Command number */
    const HVC_COM_GET_VERSION = 0x00;
    const HVC_COM_SET_CAMERA_ANGLE = 0x01;
    const HVC_COM_GET_CAMERA_ANGLE = 0x02;
    const HVC_COM_EXECUTE = 0x03;
    const HVC_COM_SET_THRESHOLD = 0x05;
    const HVC_COM_GET_THRESHOLD = 0x06;
    const HVC_COM_SET_SIZE_RANGE = 0x07;
    const HVC_COM_GET_SIZE_RANGE = 0x08;
    const HVC_COM_SET_DETECTION_ANGLE = 0x09;
    const HVC_COM_GET_DETECTION_ANGLE = 0x0A;

    /* Header for send signal data  */
    const SEND_HEAD_SYNCBYTE = 0;
    const SEND_HEAD_COMMANDNO = 1;
    const SEND_HEAD_DATALENGTHLSB = 2;
    const SEND_HEAD_DATALENGTHMSB = 3;
    const SEND_HEAD_NUM = 4;

    /* Header for receive signal data */
    const RECEIVE_HEAD_SYNCBYTE = 0;
    const RECEIVE_HEAD_STATUS = 1;
    const RECEIVE_HEAD_DATALENLL = 2;
    const RECEIVE_HEAD_DATALENLM = 3;
    const RECEIVE_HEAD_DATALENML = 4;
    const RECEIVE_HEAD_DATALENMM = 5;
    const RECEIVE_HEAD_NUM = 6;

    // GATT
    /* Characteristic Write Type */
    const WRITE_TYPE_NO_RESPONSE = 0x01;
    const WRITE_TYPE_DEFAULT = 0x02;
    const WRITE_TYPE_SIGNED = 0x04;

    /* Characteristic Auth Type */
    const BTA_GATTC_TYPE_WRITE_NO_RSP = 0x01;
    const BTA_GATTC_TYPE_WRITE = 0x02;
    
    var constructor = function(){
        
        var bleGatt = null;
        var id = {
            conn_id : null,
            srvc_id : null,
            char_id : null
        };
        var write_type = WRITE_TYPE_DEFAULT;
        var auth_req   = 0;
        var executedFunc = 0;
        
        this.onResult = null;
        
        this.setBleGatt = function(arg){
            bleGatt = arg;
        };
        this.setId = function(conn, srvc, char){
            Log.d(TAG, "setId");
            
            id.conn_id  = conn;
            id.srvc_id  = srvc;
            id.char_id  = char;
        };

        var self = this;

        //--------------
        // write settings
        this.setCameraAngle = function(param){
            var size = 1;
            var data = new Uint8Array([param.CameraAngle]);

            this.sendCommand(HVC_COM_SET_CAMERA_ANGLE, size, data.buffer);
        };

        this.setThreshold = function(param){
            var size = 8;
            var data = new ArrayBuffer(size);
            var dataView = new DataView(data);

            var params = [
                param.body.Threshold,
                param.hand.Threshold,
                param.face.Threshold,
                0
            ];

            for (var i = 0; i < size; i+=2) {
                dataView.setUint16(i, params.shift(), true);
            }

            this.sendCommand(HVC_COM_SET_THRESHOLD, size, data);
        };

        this.setSizeRange = function(param){
            var size = 12;
            var data = new ArrayBuffer(size);
            var dataView = new DataView(data);
            
            var params = [
                param.body.MinSize,
                param.body.MaxSize,
                param.hand.MinSize,
                param.hand.MaxSize,
                param.face.MinSize,
                param.face.MaxSize
            ];
            
            for (var i = 0; i < size; i+=2) {
                dataView.setUint16(i, params.shift(), true);
            }

            this.sendCommand(HVC_COM_SET_SIZE_RANGE, size, data);
        };

        this.setFaceDetectionAngle = function(param){
            var size = 2;
            var data = new Uint8Array([param.face.Pose, param.face.Angle]);

            this.sendCommand(HVC_COM_SET_DETECTION_ANGLE, size, data.buffer);
        };

        //--------------
        // read settings
        this.getVersion = function() {
            self.sendCommand(HVC_COM_GET_VERSION, 0, '');
        };

        //--------------
        // send data
        this.execute = function(inExec){
            Log.d(TAG, "Execute:0x" + inExec.toString(16));
            executedFunc = inExec;

            var size = 3;
            var data = new ArrayBuffer(size);
            var dataView = new DataView(data);
            dataView.setUint16(0, inExec, true);

            this.sendCommand(HVC_COM_EXECUTE, size, data);
        };
        
        this.sendCommand = function(inCommandNo, inDataSize, inData){
            Log.d(TAG, "Send:Command:0x" + HVC.Utils.byte2hex(inCommandNo));
            
            var headerData = new ArrayBuffer(SEND_HEAD_NUM);
            var headerDataView = new DataView(headerData);

            /* Create header */
            headerDataView.setUint8(SEND_HEAD_SYNCBYTE, 0xfe);
            headerDataView.setUint8(SEND_HEAD_COMMANDNO, inCommandNo);
            headerDataView.setUint16(SEND_HEAD_DATALENGTHLSB, inDataSize, true);

            var sendData = HVC.Utils.concatBuffer(headerData, inData);
            this.send(sendData);
        };
        
        this.send = function(inData){
            if( !bleGatt || !id.conn_id || !id.srvc_id || !id.char_id ){
                Log.e(TAG, "Failed to send data");
                return;
            }

            var length = inData.byteLength;
            var dataHexString = HVC.Utils.byte2hex(inData);
            
            Log.d(TAG, "Send:char_id:" + id.char_id.uuid);
            Log.d(TAG, "Send:length:" + length);
            Log.d(TAG, "Send:Data:" + dataHexString);

            bleGatt.writeCharacteristic(id.conn_id, id.srvc_id, id.char_id, write_type, length, auth_req, dataHexString);
        };
        
        //----------------------
        // receive data
        var buffer = [];
        this.receiveData = function(value) {
            Log.d(TAG, "Receive:" + value);

            var bytes = HVC.Utils.hex2byte(value);
            buffer = buffer.concat(bytes);
            console.log("buffer.length:" + buffer.length);

            do {
                var dataLength = readHeader(buffer);
                Log.d(TAG, "data length:" + dataLength);
                if (dataLength === false) {
                    Log.w(TAG, 'Invalid response data');
                    buffer = [];
                    return;
                }
                var resLength = dataLength + RECEIVE_HEAD_NUM;
                if (buffer.length < resLength) {
                    return;
                }
                var response = buffer.splice(0, resLength);
                var recvData = response.slice(RECEIVE_HEAD_NUM, RECEIVE_HEAD_NUM + dataLength);
            } while (buffer.length > 0);

            if (dataLength === 0) {
                return;
            } else {
                parseData(new Uint8Array(recvData).buffer);
            }
        };

        var readHeader = function(data){
            data = new Uint8Array(data);
            var dataView = new DataView(data.buffer);
            if (data[RECEIVE_HEAD_SYNCBYTE] === 0xfe && data.length >= RECEIVE_HEAD_NUM) {
                var responseCode = data[RECEIVE_HEAD_STATUS];
                switch(responseCode){
                    case 0x00:
                        Log.d(TAG, '正常終了');
                        break;
                    case 0xff:
                        Log.d(TAG, '未定義コマンド');
                        break;
                    case 0xfe:
                        Log.d(TAG, '内部エラー');
                        break;
                    case 0xfd:
                        Log.d(TAG, '不正なコマンド');
                        break;
                    default:
                        if(0xfa <= responseCode && responseCode <= 0xfc){
                            Log.d(TAG, '通信エラー');
                        }else if(0xf0 <= responseCode && responseCode <= 0xf9){
                            Log.d(TAG, '通信エラー');
                        }
                        break;
                }
                var length = dataView.getUint32(RECEIVE_HEAD_DATALENLL, true);
                return length;
            }else{
                false;
            }
        };

        var parseData = function(data) {
            var result = new HVC_RES();
            result.executedFunc = executedFunc;

            var pos = 0;
            /* Get the number of detection results */
            var view = new DataView(data, pos, 4);
            result.num.body = view.getUint8(0);
            result.num.hand = view.getUint8(1);
            result.num.face = view.getUint8(2);
            pos += 4;
            Log.d(TAG, 'num(body, hand, face):' + result.num.body +','+ result.num.hand +','+ result.num.face);

            /* Get Human Body Detection result */
            for (var i = 0; i < result.num.body; i++) {
                var body = new HVC_RES.DetectionResult();
                view = new DataView(data, pos, 8);

                body.posX = view.getUint16(0, true);
                body.posY = view.getUint16(2, true);
                body.size = view.getUint16(4, true);
                body.confidence = view.getUint16(6, true);

                result.body.push(body);
                pos += 8;
            }

            /* Get Hand Detection result */
            for (var i = 0; i < result.num.hand; i++) {
                var hand = new HVC_RES.DetectionResult();
                view = new DataView(data, pos, 8);

                hand.posX = view.getUint16(0, true);
                hand.posY = view.getUint16(2, true);
                hand.size = view.getUint16(4, true);
                hand.confidence = view.getUint16(6, true);

                result.hand.push(hand);
                pos += 8;
            }

            /* Face-related results */
            for (var i = 0; i < result.num.face; i++) {
                var face = new HVC_RES.FaceResult();

                /* Face Detection result */
                if (0 !== (result.executedFunc & HVC.HVC_ACTIV_FACE_DETECTION)) {
                    view = new DataView(data, pos, 8);
                    face.posX = view.getUint16(0, true);
                    face.posY = view.getUint16(2, true);
                    face.size = view.getUint16(4, true);
                    face.confidence = view.getUint16(6, true);
                    pos += 8;
                }

                /* Face direction */
                if (0 !== (result.executedFunc & HVC.HVC_ACTIV_FACE_DIRECTION)) {
                    view = new DataView(data, pos, 8);
                    face.dir.yaw   = view.getInt16(0, true);
                    face.dir.pitch = view.getInt16(2, true);
                    face.dir.roll  = view.getInt16(4, true);
                    face.dir.confidence = view.getUint16(6, true);
                    pos += 8;
                }

                /* Age */
                if (0 !== (result.executedFunc & HVC.HVC_ACTIV_AGE_ESTIMATION)) {
                    view = new DataView(data, pos, 3);
                    face.age.age = view.getUint8(0);
                    face.age.confidence = view.getUint16(1, true);
                    pos += 3;
                }

                /* Gender */
                if (0 !== (result.executedFunc & HVC.HVC_ACTIV_GENDER_ESTIMATION)) {
                    view = new DataView(data, pos, 3);
                    face.gen.gender = view.getUint8(0);
                    face.gen.confidence = view.getUint16(1, true);
                    pos += 3;
                }

                /* Gaze */
                if (0 !== (result.executedFunc & HVC.HVC_ACTIV_GAZE_ESTIMATION)) {
                    view = new DataView(data, pos, 2);
                    face.gaze.gazeLR = view.getInt8(0);
                    face.gaze.gazeUD = view.getInt8(1);
                    pos += 2;
                }

                /* Blink */
                if (0 !== (result.executedFunc & HVC.HVC_ACTIV_BLINK_ESTIMATION)) {
                    view = new DataView(data, pos, 4);
                    face.blink.ratioL = view.getUint16(0, true);
                    face.blink.ratioR = view.getUint16(2, true);
                    pos += 4;
                }

                /* Expression */
                if (0 !== (result.executedFunc & HVC.HVC_ACTIV_EXPRESSION_ESTIMATION)) {
                    view = new DataView(data, pos, 3);
                    face.exp.expression = view.getUint8(0);
                    face.exp.score  = view.getUint8(1);
                    face.exp.degree = view.getInt8(2);
                    pos += 3;
                }
                result.face.push(face);
            }

            self.onResult(result);
        };
        
    };
    
    return constructor;
})();

HVC.CCCD             = '00002902-0000-1000-8000-00805f9b34fb'; // Characteristic Config
HVC.RX_SERVICE_UUID2 = '35100001-d13a-4f39-8ab3-bf64d4fbb4b4'; // Service UUID
HVC.RX_CHAR_UUID2    = '35100002-d13a-4f39-8ab3-bf64d4fbb4b4'; // Write without response
HVC.TX_CHAR_UUID2    = '35100003-d13a-4f39-8ab3-bf64d4fbb4b4'; // Notify
HVC.NAME_CHAR_UUID   = '35100004-d13a-4f39-8ab3-bf64d4fbb4b4'; // Name

HVC.ENABLE_NOTIFICATION_VALUE  = [0x01, 0x00];
HVC.DISABLE_NOTIFICATION_VALUE = [0x00, 0x00];

HVC.HVC_ACTIV_BODY_DETECTION = 0x00000001;
HVC.HVC_ACTIV_HAND_DETECTION = 0x00000002;
HVC.HVC_ACTIV_FACE_DETECTION = 0x00000004;
HVC.HVC_ACTIV_FACE_DIRECTION = 0x00000008;
HVC.HVC_ACTIV_AGE_ESTIMATION = 0x00000010;
HVC.HVC_ACTIV_GENDER_ESTIMATION = 0x00000020;
HVC.HVC_ACTIV_GAZE_ESTIMATION = 0x00000040;
HVC.HVC_ACTIV_BLINK_ESTIMATION = 0x00000080;
HVC.HVC_ACTIV_EXPRESSION_ESTIMATION = 0x00000100;

HVC.HVC_NORMAL = 0;
HVC.HVC_ERROR_PARAMETER = -1;
HVC.HVC_ERROR_NODEVICES = -2;
HVC.HVC_ERROR_DISCONNECTED = -3;
HVC.HVC_ERROR_BUSY = -4;
HVC.HVC_ERROR_SEND_DATA = -10;
HVC.HVC_ERROR_HEADER_TIMEOUT = -20;
HVC.HVC_ERROR_HEADER_INVALID = -21;
HVC.HVC_ERROR_DATA_TIMEOUT = -22;

HVC.HVC_STATUS_NORMAL = 0;
HVC.HVC_STATUS_UNKNOWN = -1;
HVC.HVC_STATUS_VARIOUS = -2;
HVC.HVC_STATUS_INVALID = -3;

HVC.HVC_GEN_MALE = 1;
HVC.HVC_GEN_FEMALE = 0;

HVC.HVC_EX_NEUTRAL = 1;
HVC.HVC_EX_HAPPINESS = 2;
HVC.HVC_EX_SURPRISE = 3;
HVC.HVC_EX_ANGER = 4;
HVC.HVC_EX_SADNESS = 5;

HVC.Utils = {
    byte2hex: function (bytes) {
        if (typeof bytes === 'number') {
            bytes = [bytes];
        }
        if (!(bytes instanceof ArrayBuffer) && !Array.isArray(bytes)) {
            return false;
        }

        var ary_ui8 = new Uint8Array(bytes);
        var hex = '';
        var zero = Array(2).join('0');
        for (var i = 0; i < ary_ui8.length; i++) {
            hex += (zero + ary_ui8[i].toString(16)).slice(-2);;
        }
        return hex;
    },
    hex2byte: function (str, len) {
        len = (len === undefined) ? 2 : len;
        var byteArray = [];
        for (var i = 0; i < str.length; i += len) {
            var byte = str.substr(i, len);
            byteArray.push(parseInt(byte, 16));
        }
        return byteArray;
    },
    concatBuffer: function (buf1, buf2) {
        var retArray = new Uint8Array(buf1.byteLength + buf2.byteLength);
        retArray.set(new Uint8Array(buf1), 0);
        retArray.set(new Uint8Array(buf2), buf1.byteLength);
        return retArray.buffer;
    }
}


var HVC_PRM = function(){
    var DetectionParam = {
        MinSize: 40,
        MaxSize: 480,
        Threshold: 500
    };

    var FaceParam = Object.create(DetectionParam);
    FaceParam.Pose  = 0x00;
    FaceParam.Angle = 0x00;

    this.CameraAngle = 0x00;
    this.body = Object.create(DetectionParam);
    this.hand = Object.create(DetectionParam);
    this.face = Object.create(FaceParam);
};


var HVC_RES = function(){
    this.executedFunc = null;
    this.body = [];
    this.hand = [];
    this.face = [];
    this.num = {
        body: 0,
        hand: 0,
        face: 0
    };
};

HVC_RES.DetectionResult = function(){
    this.posX = -1;
    this.posY = -1;
    this.size = -1;
    this.confidence = -1;
};

HVC_RES.FaceResult = function(){
    HVC_RES.DetectionResult.call(this);

    var DirResult = {
        yaw: -1,
        pitch: -1,
        roll: -1,
        confidence: -1
    };
    var AgeResult = {
        age: -1,
        confidence: -1
    };
    var GenResult = {
        gender: -1,
        confidence: -1
    };
    var GazeResult = {
        gazeLR: -1,
        gazeUD: -1
    };
    var BlinkResult = {
        ratioL: -1,
        ratioR: -1
    };
    var ExpResult = {
        expression: -1,
        score: -1,
        degree: -1
    };

    this.dir = DirResult;
    this.age = AgeResult;
    this.gen = GenResult;
    this.gaze = GazeResult;
    this.blink = BlinkResult;
    this.exp = ExpResult;
};
HVC_RES.FaceResult.prototype = Object.create(HVC_RES.DetectionResult.prototype);
HVC_RES.FaceResult.prototype.constructor = HVC_RES.FaceResult;