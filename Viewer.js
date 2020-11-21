/**
 * @author David Gossow - dgossow@willowgarage.com
 * @author Russell Toris - rctoris@wpi.edu
 * @author Jihoon Lee - jihoonlee.in@gmail.com
 */

var ROS3D = require('ros3d');
var THREE = require('three');

var ShaderPass = require('./passes/ShaderPass.js');
var RenderPass = require('./passes/RenderPass.js');
var CelShadingPass = require('./passes/CelShadingPass.js');
var HighlightingPass = require('./passes/HighlightingPass.js');
var OutlinePass = require('./passes/OutlinePass.js');
var SAOPass = require('./passes/SAOPass.js');
var SSAOPass = require('./passes/SSAOPass.js');

var CopyShader = require('./shader/CopyShader.js');
var FXAAShader = require('./shader/FXAAShader.js');

var EffectComposer = require('./EffectComposer.js');

/**
 * A Viewer can be used to render an interactive 3D scene to a HTML5 canvas.
 *
 * @constructor
 * @param options - object with following keys:
 *
 *  * div - the div to place the viewer in
 *  * width - the initial width, in pixels, of the canvas
 *  * height - the initial height, in pixels, of the canvas
 *  * background (optional) - the color to render the background, like '#efefef'
 *  * antialias (optional) - if antialiasing should be used
 *  * intensity (optional) - the lighting intensity setting to use
 */
var Viewer = function(options) {
  options = options || {};
  var that = this;
  this.client = options.client;
  this.useShader = options.useShader || true;
  
  this.stopped = true;
  this.animationRequestId = undefined;
  this.lastSelected = undefined;

  this.clock = new THREE.Clock();
  this.delta = 0;
  this.interval = 1 / 30;
  
  this.renderer = this.createRenderer(options);
  this.composer = new EffectComposer(this.renderer);
  // create scene node + camera + lights
  this.createScene(options);
  if( options.sun ) {
    var sunLight = this.createSunLight(options);
    this.scene.add(sunLight);
    if( options.sun.shadow && options.sun.shadow.debug ) {
        this.scene.add( new THREE.CameraHelper( sunLight.shadow.camera ) );
    }
  }
  if( options.spot ) {
    var spotLight = this.createSpotLight(options);
    this.scene.add(spotLight);
//   this.scene.add( spotLight.target );
    if( options.spot.debug ) {
      this.scene.add( new THREE.SpotLightHelper( spotLight ) );
    }
    if( options.spot.shadow && options.spot.shadow.debug ) {
        this.scene.add( new THREE.CameraHelper( spotLight.shadow.camera ) );
    }
  }
  // create scene for HUD elements
  this.createHUDScene(options);
  // create background elements (e.g., sky cube)
  this.createBGScene(options);

  // add the renderer to the page
  options.div.append(this.renderer.domElement);
  options.div.on('dblclick', function(ev){
      if(that.lastEvent === ev) return;
      that.client.unselectMarker();
      that.lastEvent = ev;
  }, false);
  
  // setup rendering pipeline
  this.setSimplePipeline(options.width, options.height);
//   this.setComicPipeline(width, height);

  // begin the render loop
  this.start();
};

Viewer.prototype.createRenderer = function(options){
  var background = options.background || '#111111';
  var renderer = new THREE.WebGLRenderer({ antialias: options.antialias });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(options.width, options.height);
  renderer.autoClear = false;
  renderer.setClearColor(parseInt(background.replace('#', '0x'), 16));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
};

Viewer.prototype.createScene = function(options){
  var ambient = options.ambient || '#555555';
  var cameraPosition = options.camera.position || {x : 3, y : 3, z : 3};
  var cameraZoomSpeed = options.camera.zoomSpeed || 0.5;
  var near = options.camera.near || 0.05;
  var far = options.camera.far || 100;
  
  // create the scene
  this.scene = new THREE.Scene();
  this.scene.add(new THREE.AmbientLight(parseInt(ambient.replace('#', '0x'), 16)));
  // sub graph with selectable objects
  this.selectableObjects = new THREE.Object3D();
  this.scene.add(this.selectableObjects);
  // create the camera
  this.camera = new THREE.PerspectiveCamera(81.4, options.width / options.height, near, far);
  this.camera.position.x = cameraPosition.x;
  this.camera.position.y = cameraPosition.y;
  this.camera.position.z = cameraPosition.z;
  this.cameraControls = new ROS3D.OrbitControls({
    scene : this.scene,
    camera : this.camera
  });
  this.cameraControls.userZoomSpeed = cameraZoomSpeed;
  this.mouseHandler = new ROS3D.MouseHandler({
    renderer : this.renderer,
    camera : this.camera,
    rootObject : this.scene,
    fallbackTarget : this.cameraControls
  });
  // highlights the receiver of mouse events
  this.highlighter = new ROS3D.Highlighter({mouseHandler : this.mouseHandler});
};

Viewer.prototype.createHUDScene = function(options){
  // create the HUD scene for GUI elements 
  this.sceneOrtho = new THREE.Scene();
  // create the global camera with orthogonal projection
  this.cameraOrtho = new THREE.OrthographicCamera(
    -options.width/2,   options.width/2,
     options.height/2, -options.height/2,
    1, 10
  );
  this.cameraOrtho.position.z = 10;
};

Viewer.prototype.createBGScene = function(){
  this.backgroundScene = new THREE.Scene();
  this.backgroundCamera = new THREE.Camera();
  this.backgroundScene.add(this.backgroundCamera); // TODO is this required?
};

Viewer.prototype.createSunLight = function(options){
  var intensity = options.sun.intensity || 0.66;
  var color = options.sun.color || '#eeeeee';
  var pos = options.sun.pos || [-1, 0.5, 3.0];
  
  var sun = new THREE.DirectionalLight(
      parseInt(color.replace('#', '0x'), 16),
      intensity);
  sun.position.set(pos[0],pos[1],pos[2]);
  if(options.sun.shadow) {
      sun.castShadow = true;
      // TODO: make this configurable
      sun.shadow.mapSize.width = 1024;
      sun.shadow.mapSize.height = 1024;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 4;
      sun.shadow.camera.left = -3;
      sun.shadow.camera.right = 3;
      sun.shadow.camera.top = 3;
      sun.shadow.camera.bottom = -3;
  }
  return sun;
};

Viewer.prototype.createSpotLight = function(options){
  var color = options.spot.color || '#ffffbb';
  var intensity = options.spot.intensity || 0.9;
  var pos = options.spot.pos || [0, 0, 6];
  var target = options.spot.target || [-1, 1, 0];
  
  var spot = new THREE.SpotLight(
      parseInt(color.replace('#', '0x'), 16),
      intensity);
  spot.position.set(pos[0],pos[1],pos[2]);
  spot.target.position.set(target[0],target[1],target[2]);
  spot.angle = options.spot.angle || 160;
  if(options.spot.shadow) {
      spot.castShadow = true;
      spot.shadow.camera.near = 1;
      spot.shadow.camera.far = 10;
      spot.shadow.mapSize.width = 1024;
      spot.shadow.mapSize.height = 1024;
  }
  return spot;
};

Viewer.prototype.setSimplePipeline = function(width, height){
  this.composer.passes = [];
//   this.composer.addPass(new RenderPass(this.backgroundScene, this.backgroundCamera));
  this.composer.addPass(new RenderPass(this.scene, this.camera));
  this.composer.addPass(new HighlightingPass(this.scene, this.camera, this.highlighter));
  this.addFXAAPass(width, height, true);
//   this.composer.addPass(new RenderPass(this.sceneOrtho, this.cameraOrtho));
};

Viewer.prototype.setComicPipeline = function(width, height){
  var outlinePass = new OutlinePass(this.scene, this.camera, width, height);
  this.composer.passes = [];
  this.composer.addPass(new RenderPass(this.scene, this.camera, outlinePass.mNormal));
  this.composer.addPass(new RenderPass(this.scene, this.camera, outlinePass.mDepth));
  this.composer.addPass(new CelShadingPass(this.scene, this.camera));
//   this.composer.addPass(new HighlightingPass(this.scene, this.camera, this.highlighter));
  this.composer.addPass(outlinePass);
  this.addFXAAPass(width, height, true);
};

Viewer.prototype.addBlitPass = function(){
  var blit = new ShaderPass(CopyShader)
  blit.renderToScreen = true;
  this.composer.addPass(blit);
};

Viewer.prototype.addFXAAPass = function(width, height, renderToScreen){
  this.fxaaPass = new ShaderPass(FXAAShader);
  this.fxaaPass.uniforms['resolution'].value.set(1.0/width, 1.0/height);
  this.fxaaPass.renderToScreen = renderToScreen;
  this.composer.addPass( this.fxaaPass );
};

Viewer.prototype.addSSAOPass = function(width, height, renderToScreen){
  this.ssaoPass = new SSAOPass(this.scene, this.camera, width, height);
  this.ssaoPass.renderToScreen = renderToScreen;
  this.composer.addPass( this.ssaoPass );
};

Viewer.prototype.addSAOPass = function(renderToScreen){
  var saoPass = new SAOPass(this.scene, this.camera, true, false, {x: 256, y: 256});
  this.saoPass = saoPass;
  saoPass.renderToScreen = renderToScreen;
  this.composer.addPass(saoPass);
  if(this.showDatgui) {
    var saoFolder = gui.addFolder('SAO');
    saoFolder.add( saoPass.params, 'output', {
      'Beauty': SAOPass.OUTPUT.Beauty,
      'Beauty+SAO': SAOPass.OUTPUT.Default,
      'SAO': SAOPass.OUTPUT.SAO,
      'Depth': SAOPass.OUTPUT.Depth,
      'Normal': SAOPass.OUTPUT.Normal
    } ).onChange( function ( value ) { saoPass.params.output = parseInt( value ); } );
    saoFolder.add( saoPass.params, 'saoBias', - 1, 1 );
    saoFolder.add( saoPass.params, 'saoIntensity', 0, 1 );
    saoFolder.add( saoPass.params, 'saoScale', 0, 10 );
    saoFolder.add( saoPass.params, 'saoKernelRadius', 1, 100 );
    saoFolder.add( saoPass.params, 'saoMinResolution', 0, 1 );
    saoFolder.add( saoPass.params, 'saoBlur' );
    saoFolder.add( saoPass.params, 'saoBlurRadius', 0, 200 );
    saoFolder.add( saoPass.params, 'saoBlurStdDev', 0.5, 150 );
    saoFolder.add( saoPass.params, 'saoBlurDepthCutoff', 0.0, 0.1 );
  }
};

/**
 *  Start the render loop
 */
Viewer.prototype.start = function(){
  this.stopped = false;
  this.draw();
};

/**
 * Renders the associated scene to the viewer.
 */
Viewer.prototype.draw = function(){
  if(this.stopped){
    return; // Do nothing if stopped
  }
  this.delta += this.clock.getDelta();

  if(this.delta > this.interval) {
    // update the controls
    this.cameraControls.update();
    this.render();
    this.delta = this.delta % this.interval;
  }

  // draw the frame
  this.animationRequestId = requestAnimationFrame(this.draw.bind(this));
};

/**
 * Renders the associated scene to the viewer.
 */
Viewer.prototype.render = function(){
    this.renderer.clear();
    if(this.useShader) {
      this.composer.render();
    }
    else {
      this.renderer.render(this.backgroundScene, this.backgroundCamera);
      this.renderer.render(this.scene, this.camera);
      this.highlighter.renderHighlights(this.scene, this.renderer, this.camera);
      this.renderer.render(this.sceneOrtho, this.cameraOrtho);
    }
};

/**
 *  Stop the render loop
 */
Viewer.prototype.stop = function(){
  if(!this.stopped){
    // Stop animation render loop
    cancelAnimationFrame(this.animationRequestId);
  }
  this.stopped = true;
};

/**
 * Add the given THREE Object3D to the global scene in the viewer.
 *
 * @param object - the THREE Object3D to add
 * @param selectable (optional) - if the object should be added to the selectable list
 */
Viewer.prototype.addObject = function(object, selectable) {
  if (selectable) {
    this.selectableObjects.add(object);
  } else {
    this.scene.add(object);
  }
};

/**
 * Resize 3D viewer
 *
 * @param width - new width value
 * @param height - new height value
 */
Viewer.prototype.resize = function(width, height) {
  this.camera.width = width;
  this.camera.height = height;
  this.camera.aspect = width / height;
  this.camera.updateProjectionMatrix();
  
  // update orthographic projection
  this.cameraOrtho.width = width;
  this.cameraOrtho.height = height;
  this.cameraOrtho.left = - width / 2;
  this.cameraOrtho.right = width / 2;
  this.cameraOrtho.top = height / 2;
  this.cameraOrtho.bottom = - height / 2;
  this.cameraOrtho.updateProjectionMatrix();
  
  this.renderer.setSize(width, height);
  this.composer.setSize(width, height);
  // TODO make FXAAPass, remove this special case
  if(this.fxaaPass) this.fxaaPass.uniforms['resolution'].value.set(1.0/width, 1.0/height);
};

Viewer.prototype.addMarker = function(marker,node) {
  if(marker.isBackgroundMarker) {
    this.backgroundScene.add(node);
  }
  else if(marker.isSceneOrtho) {
    this.sceneOrtho.add(node);
  }
  else if(marker.isSelectable) {
    this.selectableObjects.add(node);
    this.addEventListener(marker);
  }
  else {
    this.scene.add(node);
  }
  node.visible = true;
  this.composer.addMarker(marker,node);
  
  // HACK Collada loader might not be finished loading.
  //      Overwrite `add` function to get notified :/
  marker.children[0].add_old = marker.children[0].add;
  marker.children[0].add = function(child) {
    child.traverse(function(x) {
      x.castShadow = true;
      x.receiveShadow = true;
    });
    this.add_old(child);
  };
};

Viewer.prototype.removeMarker = function(marker, node) {
  if(marker.isBackgroundMarker) {
    this.backgroundScene.remove(node);
  }
  else if(marker.isSelectable) {
    this.selectableObjects.remove(node);
  }
  else if(marker.isSceneOrtho) {
    this.sceneOrtho.remove(node);
  }
  else {
    this.scene.remove(node);
  }
  this.composer.removeMarker(marker,node);
  this.client.removeMarker(marker);
};

Viewer.prototype.addEventListener = function(marker) {
  var that = this;
  var addEventListenerRecursive = function(child) {
    child.addEventListener('dblclick', function(ev){
      if(that.lastEvent === ev)
        return;
      that.client.selectMarker(marker);
      that.lastEvent = ev;
      // avoid that the div dblclick is called
      ev.domEvent.preventDefault();
      ev.domEvent.stopPropagation();
    }, false);
    child.addEventListener('contextmenu', function(ev){
      if(that.lastEvent === ev)
        return;
      that.client.showMarkerMenu(marker);
      that.lastEvent = ev;
    });
    child.addEventListener('mousewheel', function(ev){
        ev.currentTarget = that.cameraControls;
        ev.currentTarget.dispatchEvent(ev);
    });
    child.addEventListener('DOMMouseScroll', function(ev){
        ev.currentTarget = that.cameraControls;
        ev.currentTarget.dispatchEvent(ev);
    });
  };
  marker.traverse(addEventListenerRecursive);
};

Viewer.prototype.highlight = function(node) {
    this.highlighter.hoverObjs[node.uuid] = node;
};
Viewer.prototype.unhighlight = function(node) {
    delete this.highlighter.hoverObjs[node.uuid];
};

module.exports = Viewer;
