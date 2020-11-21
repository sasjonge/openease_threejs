'use strict';

var THREE = require('three');
var ShaderPass = require('./ShaderPass.js');
var OutlineShader = require('../shader/OutlineShader.js');

var OutlinePass = function ( scene, camera, width, height ) {
	
	ShaderPass.call(this, {
		'fragmentShader': OutlineShader.fragmentShader,
		'vertexShader':   OutlineShader.vertexShader,
		'uniforms':       Object.assign(
			THREE.UniformsLib['common'],
			THREE.UniformsLib['lights'],
			OutlineShader.uniforms
		)
	});
	
	this.width = ( width !== undefined ) ? width : 512;
	this.height = ( height !== undefined ) ? height : 256;
	
	// material
	this.mDepth = new THREE.MeshDepthMaterial();
	this.mDepth.depthPacking = THREE.RGBADepthPacking;
	this.mDepth.blending = THREE.NoBlending;
	this.mNormal = new THREE.MeshNormalMaterial();
	
	// textures
	this.tDepth  = new THREE.WebGLRenderTarget(this.width, this.height, {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter });
	this.tNormal = new THREE.WebGLRenderTarget(this.width, this.height);
	
	// outline shader uniforms
	this.uniforms['tDepth'].value  = this.tDepth.texture;
	this.uniforms['tNormal'].value = this.tNormal.texture;

	this.renderToScreen = false;
// 	this.needsSwap = true;

	this.camera2 = camera;
	this.scene2 = scene;
}

OutlinePass.prototype = Object.create( ShaderPass.prototype );

OutlinePass.prototype.render = function( renderer, writeBuffer, readBuffer, delta, maskActive ) {
	var oldAutoClear = renderer.autoClear;
	renderer.autoClear = true;
	
	this.scene2.overrideMaterial = this.mNormal;
	renderer.render(this.scene2, this.camera2, this.tNormal);
	
	this.scene2.overrideMaterial = this.mDepth;
	renderer.render(this.scene2, this.camera2, this.tDepth);
	this.scene2.overrideMaterial = null;
	
	renderer.autoClear = oldAutoClear;
	
// 	this.uniforms['tDiffuse'].value = readBuffer.texture;
	
	this.uniforms['tDepth'].needsUpdate = true;
	this.uniforms['tNormal'].needsUpdate = true;
	this.uniforms['tDiffuse'].needsUpdate = true;
	
// 	this.quad.material = this.material;
// 	renderer.render(this.scene, this.camera);
		
	ShaderPass.prototype.render.call(this, renderer, writeBuffer, readBuffer, delta, maskActive);
};

OutlinePass.prototype.setSize = function(width, height) {
	this.width = width;
	this.height = height;
	this.tDepth.setSize(this.width, this.height);
	this.tNormal.setSize(this.width, this.height);
};

module.exports = OutlinePass;
