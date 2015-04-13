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