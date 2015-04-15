/* global HVC, BleCattClientControl, Log */

'use strict';

var hvcBle, hvcPrm;

$(function () {

    var TAG = "BluetoothGatt";
    var REGISTER_UUID = "";

    var bleControl = BleCattClientControl.getInstance();
    var bluetoothManager = bleControl.getBluetooth();
    var bleManager = bleControl.getBleGatt();
    var settingManager = bleControl.getSetting();
    
    hvcBle = new HVC();
    hvcBle.setBleGatt(bleManager);
    hvcBle.onResult = onResult;
    hvcPrm = new HVC_PRM();

    var searchTimer = undefined;
    var scaning = false;
    var defaultAdapter = null;
    var service_scaning = false;
    var rssi_timer = undefined;

    var client_if;
    var server_if;
    var bd_addr;

    var regist_uuid;
    var conn_id;

    var select_device;
    var select_srvc_id;
    var select_char_id;
    var select_descr_id;

    var start_incl_srvc_id = {
        uuid: "",
        inst_id: ""
    };
    var start_char_id = {
        uuid: "",
        inst_id: "",
        is_primary: ""
    };
    var start_descr_id = {
        uuid: "",
        inst_id: ""
    };

    var auth_req = 0;
    var write_type = 2;

    //----------

    window.addEventListener('unload', function() {
        Log.d(TAG, "onunload");
        if (client_if) {
            if (scaning) {
                bleManager.scanLEDevice(client_if, false);
            }
            bleManager.unRegisterClient(client_if);
            client_if = undefined;
            defaultAdapter = undefined;
            bleManager = undefined;
            settingManager = undefined;
            bleControl = undefined;
        }
    });
    bluetoothManager.onenabled = registerCallback;

    bluetoothManager.ondisabled = function () {
        Log.d(TAG, "bluetooth disabled");
        defaultAdapter = null;
    };

    var req = settingManager.createLock().get('bluetooth.enabled');
    req.onsuccess = function() {
        var enabled = req.result['bluetooth.enabled'];
        Log.d(TAG, "bluetooth enabled:" + enabled);
        if (enabled) {
            registerCallback();
        } else {
            alert("Bluetooth will be opened");
            settingManager.createLock().set({
                'bluetooth.enabled': true
            });
        }
    };

    function registerCallback() {
        Log.d(TAG, "registerCallback");
        defaultAdapter = null;
        var req = bluetoothManager.getDefaultAdapter();
        req.onsuccess = function bt_getAdapterSuccess() {
            defaultAdapter = req.result;
            if (defaultAdapter != null) {
                Log.d(TAG, "defaultAdapter:" + defaultAdapter.name);
                defaultAdapter.onregisterclient = onRegisterClient;
                defaultAdapter.onscanresult = onScanResult;
                defaultAdapter.onconnectble = onConnectble;
                defaultAdapter.ondisconnectble = onDisconnectble;
                defaultAdapter.onsearchcomplete = onSearchComplete;
                defaultAdapter.onsearchresult = onSearchResult;
                defaultAdapter.ongetcharacteristic = onGetCharacteristic;
                defaultAdapter.ongetdescriptor = onGetDescriptor;
                defaultAdapter.ongetIncludedservice = onGetIncludedService;
                defaultAdapter.onregisterfornotification = onRegisterforNotification;
                defaultAdapter.onnotify = onNotify;
                defaultAdapter.onreadcharacteristic = onReadCharacteristic;
                defaultAdapter.onwritecharacteristic = onWriteCharacteristic;
                defaultAdapter.onreaddescriptor = onReadDescriptor;
                defaultAdapter.onwritedescriptor = onWriteDescriptor;
                defaultAdapter.onexecuteWrite = onExecutWrite;
                defaultAdapter.onreadremoterssi = onReadRemoterssi;
                defaultAdapter.onblelisten = onBleListen;

                if (bleManager) {
                    Log.d(TAG, "registerClient");
                    bleManager.registerClient(REGISTER_UUID);
                }
            } else {
                Log.w(TAG, 'bluetooth adapter is null');
            }
        };
        req.onerror = function bt_getAdapterFailed() {
            Log.d(TAG, 'Can not get bluetooth adapter!');
        };
    }

    function scanDevices() {
        if (scaning) {
            return;
        }

        $("#device_list li").remove();
        scaning = true;
        bleManager.scanLEDevice(client_if, true);
        searchTimer = setTimeout(function () {
            bleManager.scanLEDevice(client_if, false);
            clearTimeout(searchTimer);
            searchTimer = undefined;
            scaning = false;
        }, 10000);
    }

    //----- defaultAdapter Callbacks -----

    function onRegisterClient(event) {
        Log.d(TAG, "onRegisterClient" + event);
        Log.d(TAG, "status:" + event.status);
        Log.d(TAG, "client_if:" + event.client_if);
        Log.d(TAG, "uuid:" + event.uuid);
        if (event.status == 0) {
            regist_uuid = event.uuid;
            client_if = event.client_if;
            scanDevices();
        }
    }
    
    function onExecutWrite(event) {
        Log.d(TAG, "onExecutWrite status:" + event.status);
    }

    function onReadRemoterssi(event) {
        $('#device_rssi').text(event.rssi);
    }

    function onBleListen(event) {
        Log.d(TAG, "onBleListen:" + event.status);
        Log.d(TAG, "onBleListen:" + event.server_if);
        server_if = event.server_if;
    }
    
    /*
     * Device
     */
    function onScanResult(event) {
        Log.d(TAG, "onScanResult:" + event);
        var device = {
            name : event.adv_data,
            address : event.bda,
            rssi : event.rssi,
            type : event.device_type
        };
        addDevice(device);
    }

    function onConnectble(event) {
        Log.d(TAG, "onConnectble status:" + event.status);
        Log.d(TAG, "conn_id:" + event.conn_id);
        if (event.status == 0) {
            $('#connect_state').html('SearchService...');
            $("#service_list li").remove();
            conn_id = event.conn_id;
            service_scaning = true;
            bleManager.searchService(conn_id, '');
            
            if (!rssi_timer) {
                rssi_timer = setInterval(function() {
                    bleManager.readRemoteRssi(client_if, bd_addr);
                }, 1000);
            }
        }
    }

    function onDisconnectble(event) {
        Log.d(TAG, "onDisconnectble:" + event.status);
        if (event.status == 0) {
            clearInterval(rssi_timer);
            rssi_timer = undefined;
            conn_id = undefined;
            $('#connect_state').html('disconnected');
        }
    }

    /*
     * Service
     */ 
    function onSearchResult(event) {
        Log.d(TAG, "onSearchResult:" + event);
        Log.d(TAG, "srvc_id_id_uuid:" + event.srvc_id_id_uuid);
        Log.d(TAG, "srvc_id_id_inst_id:" + event.srvc_id_id_inst_id);
        Log.d(TAG, "srvc_id_is_primary:" + event.srvc_id_is_primary);
        var srvc_id = {
            uuid: event.srvc_id_id_uuid,
            inst_id: event.srvc_id_id_inst_id,
            is_primary: event.srvc_id_is_primary
        };
        addService(srvc_id);
        
        // HVC Service
        if (srvc_id.uuid === HVC.RX_SERVICE_UUID2) {
            select_srvc_id = srvc_id;
            start_char_id = {
                uuid: "",
                inst_id: "",
                is_primary: ""
            };
            bleManager.getCharacteristic(conn_id, select_srvc_id, start_char_id);
        }
    }
    
    function onSearchComplete(event) {
        Log.d(TAG, "onSearchComplete status:" + event.status);
        service_scaning = false;
        
        /*
        if (select_srvc_id) {
            $("#characteristic_list li").remove();
            start_char_id = {
                uuid: "",
                inst_id: "",
                is_primary: ""
            };
            bleManager.getCharacteristic(conn_id, select_srvc_id, start_char_id);
        }
        */
    }
    
    function onGetIncludedService(event) {
        Log.d(TAG, "onGetIncludedService:" + event);
        Log.d(TAG, "incl_srvc_id_id_uuid:" + event.incl_srvc_id_id_uuid);
        Log.d(TAG, "incl_srvc_id_id_inst_id:" + event.incl_srvc_id_id_inst_id);
        Log.d(TAG, "incl_srvc_id_is_primary:" + event.incl_srvc_id_is_primary);
    }

    /*
     * Characteristic
     */ 
    function onGetCharacteristic(event) {
        Log.d(TAG, "onGetCharacteristic:" + event);
        Log.d(TAG, "state:" + event.status);
        Log.d(TAG, "char_id_uuid:" + event.char_id_uuid);
        Log.d(TAG, "char_id_inst_id:" + event.char_id_inst_id);
        Log.d(TAG, "char_prop:" + event.char_prop);

        var char_id = {
            uuid: event.char_id_uuid,
            inst_id: event.char_id_inst_id
        };
        
        var characteristic = {
            uuid: event.char_id_uuid,
            inst_id: event.char_id_inst_id,
            prop: event.char_prop
        };
        
        // HVCコマンド送信用
        if (char_id.uuid === HVC.RX_CHAR_UUID2) {
            hvcBle.setId(conn_id, select_srvc_id, char_id);
        }
        // HVC Notify
        if (char_id.uuid === HVC.TX_CHAR_UUID2) {
            select_char_id  = char_id;
            bleManager.registerForNotification(client_if, bd_addr, select_srvc_id, select_char_id );
            $('#descriptor_list li').remove();
            start_descr_id = {
                    uuid: "",
                    inst_id: ""
                };
            bleManager.getDescriptor(conn_id, select_srvc_id, select_char_id , start_descr_id);
        }
        
        addCharacteristic(characteristic, char_id);
    }

    function onReadCharacteristic(event) {
        Log.d(TAG, "onReadCharacteristic status:" + event.status);
        Log.d(TAG, "onReadCharacteristic value:" + event.value);
        Log.d(TAG, "value_type:" + event.value_type);
        var value = event.value;
        $('#char_read_data').html(value);
    }

    function onWriteCharacteristic(event) {
        Log.d(TAG, "onWriteCharacteristic status:" + event.status);
        bleManager.executeWrite(conn_id, 0);
    }

    /*
     * Descriptor
     */ 
    function onGetDescriptor(event) {
        Log.d(TAG, "descr_status:" + event.status);
        Log.d(TAG, "descr_id_uuid:" + event.descr_id_uuid);
        Log.d(TAG, "descr_id_inst_id:"  + event.descr_id_inst_id);

        if (event.status != 0) {
            return;
        }
        var descr_id = {
            uuid: event.descr_id_uuid,
            inst_id: event.descr_id_inst_id
        };
        
        // HVC Notify
        if(descr_id.uuid === HVC.CCCD){
            Log.d(TAG, "write notify enable:" + descr_id.uuid);
            var value = HVC.Utils.byte2hex(HVC.ENABLE_NOTIFICATION_VALUE);
            var len   = value.length;
            bleManager.writeDescriptor(conn_id, select_srvc_id, select_char_id, descr_id, write_type, len, auth_req, value);
        }
        
        addDescriptor(descr_id, descr_id);
    }

    function onReadDescriptor(event) {
        Log.d(TAG, "onReadDescriptor:" + event.value);
        var value = event.value;
        $('#des_read_data').html(value);
    }

    function onWriteDescriptor(event) {
        Log.d(TAG, "onWriteDescriptor status:" + event.status);
        bleManager.executeWrite(conn_id, 0);
    }

    /*
     * Notification
     */ 
    function onRegisterforNotification(event) {
        Log.d(TAG, "onRegisterforNotification registered:" + event.registered);
        Log.d(TAG, event.toString());
        $('#connect_state').html('Connected');
    }
    
    function onNotify(event) {
        Log.d(TAG, "onNotify value:" + event.value);
        Log.d(TAG, "onNotify bda:" + event.bda);
        Log.d(TAG, "onNotify srvc_id_id_uuid:" + event.srvc_id_id_uuid);
        Log.d(TAG, "onNotify srvc_id_id_inst_id:" + event.srvc_id_id_inst_id);
        Log.d(TAG, "onNotify srvc_id_is_primary:" + event.srvc_id_is_primary);
        Log.d(TAG, "onNotify char_id_uuid:" + event.char_id_uuid);
        Log.d(TAG, "onNotify char_id_inst_id:" + event.char_id_inst_id);
        Log.d(TAG, "onNotify len:" + event.len);
        Log.d(TAG, "onNotify is_notify:" + event.is_notify);
        
        hvcBle.receiveData(event.value);
    }

    //----------

    function addDevice(device) {
        var item = $("<li class='list-group-item'><a href='#'>" + device.name + "</a></li>");
        $("#device_list").append(item).find("li:last").hide();
        $("#device_list").find("li:last").slideDown(300)
            .click(function () {
                if (searchTimer) {
                    bleManager.scanLEDevice(client_if, false);
                    clearTimeout(searchTimer);
                    searchTimer = undefined;
                    scaning = false;
                }

                $('#connect_state').html('Connecting...');
                showDevice(true, device);
                bleManager.connectBle(client_if, device.address, true);
                bd_addr = device.address;
                select_device = device;
            });
    }

    function addService(service) {
        var uuid = service.uuid | 'uuid';
        var instance_id = service.inst_id | '0';
        var type = service.primary | '1';
        var item = $("<li class='list-group-item'><a href='#'>" + service.uuid + "</a></li>");
        $("#service_list").append(item).find("li:last").hide();
        $("#service_list").find("li:last").slideDown(300)
            .click(function () {
                showServiceList(false);
                $('#characteristic_list li').remove();
                showCharacteristicList(true);
                bleManager.getIncludeService(conn_id, select_srvc_id, start_incl_srvc_id);
                start_char_id = {
                    uuid: "",
                    inst_id: "",
                    is_primary: ""
                };
                bleManager.getCharacteristic(conn_id, select_srvc_id, start_char_id);
            });
    }

    function addCharacteristic(characteristic, char_id) {
        if (start_char_id && start_char_id.uuid == char_id.uuid) {
            return;
        }
        var uuid = characteristic.uuid | 'uuid';
        var instance_id = characteristic.inst_id | '0';
        var prop = characteristic.prop | 2;
        var item = $("<li class='list-group-item'><a href='#'>" + characteristic.uuid + "</a></li>");
        $("#characteristic_list").append(item).find("li:last").hide();
        $("#characteristic_list").find("li:last").slideDown(300);
        start_char_id = char_id;
        bleManager.getCharacteristic(conn_id, select_srvc_id, char_id);
    }

    function addDescriptor(descriptor, descr_id) {
        if (start_descr_id && start_descr_id.uuid == descr_id.uuid) {
            return;
        }
        var uuid = descriptor.uuid | 'uuid';
        var instance_id = descriptor.inst_id | '0';

        var item = $("<li class='list-group-item'><a href='#'>" + descriptor.uuid + "</a></li>");
        $("#descriptor_list").append(item).find("li:last").hide();
        $("#descriptor_list").find("li:last").slideDown(300)
            .click(function () {
                showCharacteristic(false);
                showDescriptorList(false);
                showDescriptor(true);

                select_descr_id = descr_id;
                bleManager.readDescriptor(conn_id, select_srvc_id, select_char_id, select_descr_id, auth_req);
            });
        start_descr_id = descr_id;
        bleManager.getDescriptor(conn_id, select_srvc_id, select_char_id, start_descr_id);
    }
    
    //----------
    
    $('.select_device').on('click', function () {
        Log.d(TAG, "conn_id:" + conn_id);
        if (conn_id) {
            bleManager.disconnectBle(client_if, bd_addr, conn_id);
        }
        showDeviceList(true);
    });
    
    $("#search").on("click", function () {
        if (!defaultAdapter) {
            alert("Bluetooth should be opened");
            return;
        }
        scanDevices();
    });

    $('#search_service').on('click', function() {
        Log.d(TAG, "click service search");
        if (!defaultAdapter) {
            alert("Bluetooth should be opened");
            return;
        }
        if (!conn_id) {
            alert("The device disconnected");
            return;
        }
        if (service_scaning) {
            return;
        }
        $('#service_list li').remove();
        $('#connect_state').html('SearchService...');
        service_scaning = true;
        bleManager.searchService(conn_id, '');
    });
    
    $('#config').on('click', function () {
        showConfig(true);
    });

    function showDeviceList(show) {
        if (show) {
            $('#list_content').show();
            $('#device_content').hide();
        }
    }

    function showDevice(show, device) {
        if (show) {
            if (device) {
                $('#device_name').html(device.name);
                $('#device_address').html(device.address);
                $('#device_rssi').html(device.rssi);
                $('#device_type').html(device.type);
            }
            
            $('#service_list li').remove();
            $('#characteristic_list li').remove();
            $('#descriptor_list li').remove();

            $('#list_content').hide();
            $('#device_content').show();
            $('#result').hide();
        }
    }
    
    function showConfig(show) {
        
    }

    //----------------------------
    // HVC-C
    //----------------------------
    $('#configure').on('click', function(){
        hvcPrm.face.MinSize = 60;
        hvcPrm.face.MaxSize = 240;
        hvcBle.setCameraAngle(hvcPrm);
        hvcBle.setFaceDetectionAngle(hvcPrm);
        hvcBle.setSizeRange(hvcPrm);
        hvcBle.setThreshold(hvcPrm);
    });

    $('#execute').on('click', execute);
    
    function execute(){
        var nUseFunc = HVC.HVC_ACTIV_BODY_DETECTION |
                       HVC.HVC_ACTIV_FACE_DETECTION |
                       HVC.HVC_ACTIV_HAND_DETECTION |
                       HVC.HVC_ACTIV_FACE_DIRECTION |
                       HVC.HVC_ACTIV_AGE_ESTIMATION |
                       HVC.HVC_ACTIV_GENDER_ESTIMATION |
                       HVC.HVC_ACTIV_GAZE_ESTIMATION |
                       HVC.HVC_ACTIV_BLINK_ESTIMATION |
                       HVC.HVC_ACTIV_EXPRESSION_ESTIMATION;
        hvcBle.execute(nUseFunc);
    };
    
    function onResult(result){
        Log.d(TAG, "onResult");
        console.log(result);
        
        // 検出数
        $('#numBody').text(result.num.body);
        $('#numHand').text(result.num.hand);
        $('#numFace').text(result.num.face);
        
        // 検出結果出力
        for(var key in result.num) {
            var id = 'result_' + key;
            if(result.num[key] > 0) {
                var data = result[key][0];
                writeData(data, id);
            } else {
                $('#' + id).find('dd').text('-');
            }
            createSelect(result.num[key], id);
            
            var elm = $('#' + id + ' select');
            elm.unbind('change');
            elm.on('change', function(e){
                var key = $(this).context.name;
                var id = 'result_' + key;
                writeData(result[key][$(this).val() - 1], id);
            });
        }
        $('#result').show();
        
        // 検出結果データを表示
        function writeData(obj, id) {
            for(var key in obj){
                if(typeof obj[key] === 'number'){
                    $('#' + id + ' .' + key).text(obj[key]);
                } else if (typeof obj[key] === 'object') {
                    writeData(obj[key], id + ' #' + key);
                }
            }
        }
        
        // 検出データ選択
        function createSelect(num, id) {
            $('#' + id + ' select option').remove();
            var elm = $('#' + id + ' select');
            for (var i = 1; i <= num; i++) {
                elm.append('<option value="' + i + '">' + i + '</option>');
            }
        }
    }
    
});
