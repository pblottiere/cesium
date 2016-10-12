/*global define*/
define([
        'Cesium/Core/Cartesian3',
        'Cesium/Core/defined',
        'Cesium/Core/formatError',
        'Cesium/Core/getFilenameFromUri',
        'Cesium/Core/Math',
        'Cesium/Core/objectToQuery',
        'Cesium/Core/queryToObject',
        'Cesium/DataSources/CzmlDataSource',
        'Cesium/Scene/Cesium3DTileset',
        'Cesium/DataSources/GeoJsonDataSource',
        'Cesium/DataSources/KmlDataSource',
        'Cesium/Scene/createTileMapServiceImageryProvider',
        'Cesium/Widgets/Viewer/Viewer',
        'Cesium/Widgets/Viewer/viewerCesiumInspectorMixin',
        'Cesium/Widgets/Viewer/viewerDragDropMixin',
        'domReady!'
    ], function(
        Cartesian3,
        defined,
        formatError,
        getFilenameFromUri,
        CesiumMath,
        objectToQuery,
        queryToObject,
        CzmlDataSource,
        Cesium3DTileset,
        GeoJsonDataSource,
        KmlDataSource,
        createTileMapServiceImageryProvider,
        Viewer,
        viewerCesiumInspectorMixin,
        viewerDragDropMixin) {
    'use strict';

    var endUserOptions = queryToObject(window.location.search.substring(1));

    var imageryProvider;
    if (endUserOptions.tmsImageryUrl) {
        imageryProvider = createTileMapServiceImageryProvider({
            url : endUserOptions.tmsImageryUrl
        });
    }

    var loadingIndicator = document.getElementById('loadingIndicator');
    var viewer;
    try {
        viewer = new Viewer('cesiumContainer', {
            imageryProvider : imageryProvider,
            baseLayerPicker : !defined(imageryProvider),
            scene3DOnly : endUserOptions.scene3DOnly
        });
    } catch (exception) {
        loadingIndicator.style.display = 'none';
        var message = formatError(exception);
        console.error(message);
        if (!document.querySelector('.cesium-widget-errorPanel')) {
            window.alert(message);
        }
        return;
    }

    viewer.extend(viewerDragDropMixin);
    if (endUserOptions.inspector) {
        viewer.extend(viewerCesiumInspectorMixin);
    }

    var showLoadError = function(name, error) {
        var title = 'An error occurred while loading the file: ' + name;
        var message = 'An error occurred while loading the file, which may indicate that it is invalid.  A detailed error report is below:';
        viewer.cesiumWidget.showErrorPanel(title, message, error);
    };

    viewer.dropError.addEventListener(function(viewerArg, name, error) {
        showLoadError(name, error);
    });

    var scene = viewer.scene;
    var context = scene.context;
    if (endUserOptions.debug) {
        context.validateShaderProgram = true;
        context.validateFramebuffer = true;
        context.logShaderCompilation = true;
        context.throwOnWebGLError = true;
    }

    var view = endUserOptions.view;
    if (defined(view)) {
        var splitQuery = view.split(/[ ,]+/);
        if (splitQuery.length > 1) {
            var longitude = !isNaN(+splitQuery[0]) ? +splitQuery[0] : 0.0;
            var latitude = !isNaN(+splitQuery[1]) ? +splitQuery[1] : 0.0;
            var height = ((splitQuery.length > 2) && (!isNaN(+splitQuery[2]))) ? +splitQuery[2] : 300.0;
            var heading = ((splitQuery.length > 3) && (!isNaN(+splitQuery[3]))) ? CesiumMath.toRadians(+splitQuery[3]) : undefined;
            var pitch = ((splitQuery.length > 4) && (!isNaN(+splitQuery[4]))) ? CesiumMath.toRadians(+splitQuery[4]) : undefined;
            var roll = ((splitQuery.length > 5) && (!isNaN(+splitQuery[5]))) ? CesiumMath.toRadians(+splitQuery[5]) : undefined;

            console.log(longitude, latitude, height);
            console.log(Cartesian3.fromDegrees(longitude, latitude, height));

            console.log("---------------");
            console.log(Cartesian3.fromDegrees(-84.2349244549245, 42.206801306872, 292.648));

            viewer.camera.setView({
                destination: Cartesian3.fromDegrees(longitude, latitude, height),
                orientation: {
                    heading: heading,
                    pitch: pitch,
                    roll: roll
                }
            });
        }
    }

    function saveCamera() {
        var position = camera.positionCartographic;
        var hpr = '';
        if (defined(camera.heading)) {
            hpr = ',' + CesiumMath.toDegrees(camera.heading) + ',' + CesiumMath.toDegrees(camera.pitch) + ',' + CesiumMath.toDegrees(camera.roll);
        }
        endUserOptions.view = CesiumMath.toDegrees(position.longitude) + ',' + CesiumMath.toDegrees(position.latitude) + ',' + position.height + hpr;
        history.replaceState(undefined, '', '?' + objectToQuery(endUserOptions));
    }

    var updateTimer;
    if (endUserOptions.saveCamera !== 'false') {
        var camera = viewer.camera;
        camera.moveStart.addEventListener(function() {
            if (!defined(updateTimer)) {
                updateTimer = window.setInterval(saveCamera, 1000);
            }
        });
        camera.moveEnd.addEventListener(function() {
            if (defined(updateTimer)) {
                window.clearInterval(updateTimer);
                updateTimer = undefined;
            }
            saveCamera();
        });
    }

    loadingIndicator.style.display = 'none';

    var tileset;

    function loadTileset(url) {

        tileset = scene.primitives.add(new Cesium3DTileset({
            url : url,
            debugShowStatistics : true
        }));

        return tileset.readyPromise.then(function(tileset) {
            var boundingSphere = tileset.boundingSphere;
            viewer.camera.viewBoundingSphere(boundingSphere, new Cesium.HeadingPitchRange(0, -2.0, 0));
            viewer.camera.lookAtTransform(Matrix4.IDENTITY);

            var properties = tileset.properties;
            if (defined(properties) && defined(properties.Height)) {
                tileset.style = new Cesium.Cesium3DTileStyle({
    //              "color" : "color('#BAA5EC')",
    //              "color" : "color('cyan', 0.5)",
    //              "color" : "rgb(100, 255, 190)",
    //              "color" : "hsla(0.9, 0.6, 0.7, 0.75)",
                    "color" : {
                        "conditions" : {
                            "${Height} >= 83" : "color('purple', 0.5)",
                            "${Height} >= 80" : "color('red')",
                            "${Height} >= 70" : "color('orange')",
                            "${Height} >= 12" : "color('yellow')",
                            "${Height} >= 7" : "color('lime')",
                            "${Height} >= 1" : "color('cyan')",
                            "true" : "color('blue')"
                        }
                    },
    //              "show": false
    //              "show" : "${Height} >= 0",
                    "meta" : {
                        "description" : "'Building id ${id} has height ${Height}.'"
                    }
                });
                addStyleUI();
            }

            tileset.loadProgress.addEventListener(function(numberOfPendingRequests, numberProcessing) {
                if ((numberOfPendingRequests === 0) && (numberProcessing === 0)) {
                    //console.log('Stopped loading');
                    return;
                }

                //console.log('Loading: requests: ' + numberOfPendingRequests + ', processing: ' + numberProcessing);
            });

            tileset.tileUnload.addEventListener(function(tile) {
            //console.log('Tile unloaded.')
            });
        });
    }

    loadTileset("tileset.json");
});
