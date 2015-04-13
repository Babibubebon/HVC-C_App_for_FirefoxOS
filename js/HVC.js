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
    const WRITE_TYPE_DEFAULT     = 0x02;
    const WRITE_TYPE_SIGNED      = 0x04;

    /* Characteristic Auth Type */
    const BTA_GATTC_TYPE_WRITE_NO_RSP = 0x01;
    const BTA_GATTC_TYPE_WRITE        = 0x02;
    
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
        
        // 検出結果取得 Callback
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
        
        //--------------
        var self = this;
        var SetCameraAngle = function(param){
            var sendData = HVC.Utils.byte2hex(param.CameraAngle & 0xff);
            self.sendCommand(HVC_COM_SET_CAMERA_ANGLE, 1, sendData);
        };
        var SetThreshold = function(param){
            var sendData = HVC.Utils.byte2hex([
                param.body.Threshold
                (param.body.Threshold >> 8),
                param.hand.Threshold,
                (param.hand.Threshold >> 8),
                param.face.Threshold,
                (param.face.Threshold >> 8),
                0,
                0]);
            self.sendCommand(HVC_COM_SET_THRESHOLD, 8, sendData);
        };
        var SetSizeRange = function(param){
            var sendData = HVC.Utils.byte2hex([
                param.body.MinSize,
                (param.body.MinSize >> 8),
                param.body.MaxSize,
                (param.body.MaxSize >> 8),
                param.hand.MinSize,
                (param.hand.MinSize >> 8),
                param.hand.MaxSize,
                (param.hand.MaxSize >> 8),
                param.face.MinSize,
                (param.face.MinSize >> 8),
                param.face.MaxSize,
                (param.face.MaxSize >> 8)
            ]);
            self.sendCommand(HVC_COM_SET_SIZE_RANGE, 12, sendData);
        };
        var SetFaceDetectionAngle = function(param){
            var sendData = HVC.Utils.byte2hex([param.face.Pose, param.face.Angle]);
            self.sendCommand(HVC_COM_SET_DETECTION_ANGLE, 2, sendData);
        };
        var GetVersion = function() {
            self.sendCommand(HVC_COM_GET_VERSION, 0, '');
        };
        //--------------
        
        this.setParam = function(prm){
            Log.d(TAG, "SetParam");
            
            SetCameraAngle(prm);
            setTimeout(function(){
                SetThreshold(prm);
            }, 500);
            setTimeout(function(){
                SetSizeRange(prm);
            }, 1000);
            setTimeout(function(){
                SetFaceDetectionAngle(prm);             
            }, 1500);
        };
        
        this.execute = function(inExec){
            Log.d(TAG, "Execute:0x" + HVC.Utils.byte2hex(inExec, 4));
            
            var sendData = HVC.Utils.byte2hex([inExec & 0xff, (inExec >> 8) & 0xff, 0]);
            this.sendCommand(HVC_COM_EXECUTE, 3, sendData);
            executedFunc = inExec;
        };
        
        this.sendCommand = function(inCommandNo, inDataSize, inData){
            Log.d(TAG, "Send:Command:0x" + HVC.Utils.byte2hex(inCommandNo));
            
            /* Create header */
            var sendData = HVC.Utils.byte2hex([-2 & 0xff, inCommandNo, inDataSize & 0xff, (inDataSize >> 8) & 0xff]);
            sendData += inData.slice(0, inDataSize * 2);
            
            this.send(sendData);
    };
        
        this.send = function(inData){
            if( !bleGatt || !id.conn_id || !id.srvc_id || !id.char_id ){
                return;
            }
            var len = inData.length;
            
            Log.d(TAG, "Send:char_id:" + id.char_id.uuid);
            Log.d(TAG, "Send:Data:" + len + "byte:" + inData);
            
            bleGatt.writeCharacteristic(id.conn_id, id.srvc_id, id.char_id, write_type, len, auth_req, inData);
        };
        
        //----------------------
        var buffer = [];
        this.receiveData = function(value){
            console.log("value:", value);
            
            var bytes = HVC.Utils.hex2byte(value);
            buffer = buffer.concat(bytes);
            console.log("buffer.length:" + buffer.length);
            
            do{
                var dataLength = readHeader(buffer);
                Log.d(TAG, "data length:" + dataLength);
                if(dataLength === false){
                    Log.d(TAG, 'Invalid response data');
                    buffer = [];
                    return;
                }
                var resLength = dataLength + RECEIVE_HEAD_NUM;
                if(buffer.length < resLength){
                    return;
                }
                var response = buffer.splice(0, resLength);
                var recvData  = response.slice(RECEIVE_HEAD_NUM, RECEIVE_HEAD_NUM + dataLength);
            }while(buffer.length > 0);
            
            if(dataLength === 0) return;
            
            var result = new HVC_RES();
            result.executedFunc = executedFunc;
            
            if(dataLength >= 4){
                result.num.body = recvData[0];
                result.num.hand = recvData[1];
                result.num.face = recvData[2];
                dataLength -= 4;
                recvData.splice(0, 4);
                Log.d(TAG, 'num(body, hand, face):' + result.num.body +','+ result.num.hand +','+ result.num.face);
            }
            
            /* Get Human Body Detection result */
            for (var i = 0; i < result.num.body; i++) {
                var body = new HVC_RES.DetectionResult();

                if (dataLength >= 8) {
                    body.posX = ((recvData[0] & 0xff) + (recvData[1] << 8));
                    body.posY = ((recvData[2] & 0xff) + (recvData[3] << 8));
                    body.size = ((recvData[4] & 0xff) + (recvData[5] << 8));
                    body.confidence = ((recvData[6] & 0xff) + (recvData[7] << 8));
                    dataLength -= 8;
                    recvData.splice(0, 8);
                }
                result.body.push(body);
            }

            /* Get Hand Detection result */
            for (var i = 0; i < result.num.hand; i++) {
                var hand = new HVC_RES.DetectionResult();

                if (dataLength >= 8) {
                    hand.posX = ((recvData[0] & 0xff) + (recvData[1] << 8));
                    hand.posY = ((recvData[2] & 0xff) + (recvData[3] << 8));
                    hand.size = ((recvData[4] & 0xff) + (recvData[5] << 8));
                    hand.confidence = ((recvData[6] & 0xff) + (recvData[7] << 8));
                    dataLength -= 8;
                    recvData.splice(0, 8);
                }
                result.hand.push(hand);
            }
            
            /* Face-related results */
            for (var i = 0; i < result.num.face; i++) {
                var face = new HVC_RES.FaceResult();
                
                /* Face Detection result */
                if (0 !== (result.executedFunc & HVC.HVC_ACTIV_FACE_DETECTION)) {
                    Log.d(TAG, "Face Detection result");
                    if (dataLength >= 8) {
                        face.posX = ((recvData[0] & 0xff) + (recvData[1] << 8));
                        face.posY = ((recvData[2] & 0xff) + (recvData[3] << 8));
                        face.size = ((recvData[4] & 0xff) + (recvData[5] << 8));
                        face.confidence = ((recvData[6] & 0xff) + (recvData[7] << 8));
                        dataLength -= 8;
                        recvData.splice(0, 8);
                    }
                }

                /* Face direction */
                if (0 !== (result.executedFunc & HVC.HVC_ACTIV_FACE_DIRECTION)) {
                    if (dataLength >= 8) {
                        face.dir.yaw   = HVC.Utils.convSigned( ((recvData[0] & 0xff) + (recvData[1] << 8)), 16);
                        face.dir.pitch = HVC.Utils.convSigned( ((recvData[2] & 0xff) + (recvData[3] << 8)), 16);
                        face.dir.roll  = HVC.Utils.convSigned( ((recvData[4] & 0xff) + (recvData[5] << 8)), 16);
                        face.dir.confidence = ((recvData[6] & 0xff) + (recvData[7] << 8));
                        dataLength -= 8;
                        recvData.splice(0, 8);
                    }
                }

                /* Age */
                if (0 !== (result.executedFunc & HVC.HVC_ACTIV_AGE_ESTIMATION)) {
                    if (dataLength >= 3) {
                        face.age.age = recvData[0];
                        face.age.confidence = ((recvData[1] & 0xff) + (recvData[2] << 8));
                        dataLength -= 3;
                        recvData.splice(0, 3);
                    }
                }

                /* Gender */
                if (0 !== (result.executedFunc & HVC.HVC_ACTIV_GENDER_ESTIMATION)) {
                    if (dataLength >= 3) {
                        face.gen.gender = recvData[0];
                        face.gen.confidence = ((recvData[1] & 0xff) + (recvData[2] << 8));
                        dataLength -= 3;
                        recvData.splice(0, 3);
                    }
                }

                /* Gaze */
                if (0 !== (result.executedFunc & HVC.HVC_ACTIV_GAZE_ESTIMATION)) {
                    if (dataLength >= 2) {
                        face.gaze.gazeLR = HVC.Utils.convSigned(recvData[0], 8);
                        face.gaze.gazeUD = HVC.Utils.convSigned(recvData[1], 8);
                        dataLength -= 2;
                        recvData.splice(0, 2);
                    }
                }

                /* Blink */
                if (0 !== (result.executedFunc & HVC.HVC_ACTIV_BLINK_ESTIMATION)) {
                    if (dataLength >= 4) {
                        face.blink.ratioL = ((recvData[0] & 0xff) + (recvData[1] << 8));
                        face.blink.ratioR = ((recvData[2] & 0xff) + (recvData[3] << 8));
                        dataLength -= 4;
                        recvData.splice(0, 4);
                    }
                }

                /* Expression */
                if (0 !== (result.executedFunc & HVC.HVC_ACTIV_EXPRESSION_ESTIMATION)) {
                    if (dataLength >= 3) {
                        face.exp.expression = recvData[0];
                        face.exp.score  = recvData[1];
                        face.exp.degree = HVC.Utils.convSigned(recvData[2], 8);
                        dataLength -= 3;
                        recvData.splice(0, 3);
                    }
                }
                result.face.push(face);
            }
            
            this.onResult(result);
        };
        
        var readHeader = function(data){
            if (data[RECEIVE_HEAD_SYNCBYTE] === 0xfe && data.length >= RECEIVE_HEAD_NUM) {
                var response_code = data[RECEIVE_HEAD_STATUS];
                switch(response_code){
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
                        if(0xfa <= response_code && response_code <= 0xfc){
                            Log.d(TAG, '通信エラー');
                        }else if(0xf0 <= response_code && response_code <= 0xf9){
                            Log.d(TAG, '通信エラー');
                        }
                        break;
                }
                var length = HVC.Utils.byte2hex(data.slice(2, 4).reverse());
                length = HVC.Utils.hex2byte(length, 4);
                return length;
            }else{
                false;
            }
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
    byte2hex: function (num, len) {
        len = (len === undefined) ? 2 : len;
        var zero = Array(len).join('0');
        var mask = Math.pow(0x10, len) - 1;

        var convert = function (num) {
            num = (num < 0) ? num & mask : num;
            return (zero + num.toString(16)).slice(-len);
        };

        if (typeof num === 'number') {
            return convert(num);
        }
        if (Array.isArray(num)) {
            var hex = '';
            for (var i = 0; i < num.length; i++) {
                hex += convert(num[i]);
            }
            return hex;
        }
        return false;
    },
    hex2byte: function (str, len) {
        len = (len === undefined) ? 2 : len;
        var byteArray = [];
        for (var i = 0; i < str.length; i += len) {
            var byte = str.substr(i, len);
            byteArray.push(parseInt(byte, 16));
        }
        if (byteArray.length === 1) {
            return byteArray[0];
        } else {
            return byteArray;
        }
    },
    convSigned: function (int, len) {
        if (int & (1 << len - 1)) {
            return -((~int & ((1 << len - 1) - 1)) + 1);
        } else {
            return int;
        }
    }
}