var HVC_PRM = function(){
    var DetectionParam = {
        MinSize: 40,
        MaxSize: 480,
        Threshold: 500
    };
    
    var FaceParam = Object.create(DetectionParam);
    FaceParam.Pose  = 0x00;
    FaceParam.Angle = 0x00;
    
    this.CameraAngle = 0;
    this.body = Object.create(DetectionParam);
    this.hand = Object.create(DetectionParam);
    this.face = Object.create(FaceParam);
};