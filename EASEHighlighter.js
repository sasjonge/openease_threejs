/**
 * A highlighter for 3D objects based on the ros3d mouseover
 * highlighter: 
 * https://github.com/RobotWebTools/ros3djs/blob/develop/src/visualization/interaction/Highlighter.js
 *
 * @author Sascha Jongebloed
 */

/**
 * A highlighter for 3D objects in the scene.
 *
 * @constructor
 * @param options - object with following keys:
 *
 */
EASEHighlighter = function(options) {
  options = options || {};
  this.hoverObjs = {};
  this.highlightColor = options.color || 0xFFFFFF;
};

/**
 * Render the highlights for all objects that are currently highlighted.
 *
 * This method should be executed after clearing the renderer and
 * rendering the regular scene.
 *
 * @param scene - the current scene, which should contain the highlighted objects (among others)
 * @param renderer - the renderer used to render the scene.
 * @param camera - the scene's camera
 */
EASEHighlighter.prototype.renderHighlights = function(scene, renderer, camera) {

  // Render highlights by making everything but the highlighted
  // objects invisible...
  this.makeEverythingInvisible(scene);
  this.makeHighlightedVisible(scene);

  // Providing a transparent overrideMaterial...
  var originalOverrideMaterial = scene.overrideMaterial;
  scene.overrideMaterial = new THREE.MeshBasicMaterial({
      fog : false,
      opacity : 0.5,
      transparent : true,
      depthTest : true,
      depthWrite : false,
      polygonOffset : true,
      polygonOffsetUnits : -1,
      side : THREE.DoubleSide,
      color : new THREE.Color(this.highlightColor)
  });

  // And then rendering over the regular scene
  renderer.render(scene, camera);

  // Finally, restore the original overrideMaterial (if any) and
  // object visibility.
  scene.overrideMaterial = originalOverrideMaterial;

  this.restoreVisibility(scene);
};


/**
 * Traverses the given object and makes every object that's a Mesh,
 * Line or Sprite invisible. Also saves the previous visibility state
 * so we can restore it later.
 *
 * @param scene - the object to traverse
 */
EASEHighlighter.prototype.makeEverythingInvisible = function (scene) {
  scene.traverse(function(currentObject) {
    if ( currentObject.type === "Mesh" || currentObject.type === "Line"
         || currentObject.type === "Sprite" ) {
      currentObject.previousVisibility = currentObject.visible;
      currentObject.visible = false;
    }
  });
};


/**
 * Make the objects in the scene that are currently highlighted (and
 * all of their children!) visible.
 *
 * @param scene - the object to traverse
 */
EASEHighlighter.prototype.makeHighlightedVisible = function (scene) {
  var makeVisible = function(currentObject) {
      if ( currentObject.type === "Mesh" || currentObject.type === "Line"
         || currentObject.type === "Sprite" ) {
        currentObject.visible = true;
      }
  };

  for (var uuid in this.hoverObjs) {
    var selectedObject = this.hoverObjs[uuid];
    // Make each selected object and all of its children visible
    selectedObject.visible = true;
    selectedObject.traverse(makeVisible);
  }
};

/**
 * Restore the old visibility state that was saved by
 * makeEverythinginvisible.
 *
 * @param scene - the object to traverse
 */
EASEHighlighter.prototype.restoreVisibility = function (scene) {
  scene.traverse(function(currentObject) {
    if (currentObject.hasOwnProperty('previousVisibility')) {
      currentObject.visible = currentObject.previousVisibility;
    }
  }.bind(this));
};


EASEHighlighter.prototype.highlight = function(node) {
    this.hoverObjs[node.uuid] = node;
};
EASEHighlighter.prototype.unhighlight = function(node) {
    delete this.hoverObjs[node.uuid];
};
EASEHighlighter.prototype.clearHighlights = function() {
    this.hoverObjs = {};
};


module.exports = EASEHighlighter;