"use strict";

/**
 * Main function to initialize WebGL, load OBJ/MTL files, and render the scene.
 */
async function main() {
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext("webgl");
  if (!gl) return;

  const vs = `
  attribute vec4 a_position;
  attribute vec3 a_normal;
  attribute vec2 a_texcoord;
  attribute vec4 a_color;

  uniform mat4 u_projection;
  uniform mat4 u_view;
  uniform mat4 u_world;
  uniform vec3 u_viewWorldPosition;

  varying vec3 v_normal;
  varying vec3 v_surfaceToView;
  varying vec2 v_texcoord;
  varying vec4 v_color;

  void main() {
    vec4 worldPosition = u_world * a_position;
    gl_Position = u_projection * u_view * worldPosition;
    v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;
    v_normal = mat3(u_world) * a_normal;
    v_texcoord = a_texcoord;
    v_color = a_color;
  }
  `;

  const fs = `
  precision highp float;

  varying vec3 v_normal;
  varying vec3 v_surfaceToView;
  varying vec2 v_texcoord;
  varying vec4 v_color;

  uniform vec3 diffuse;
  uniform sampler2D diffuseMap;
  uniform vec3 ambient;
  uniform vec3 emissive;
  uniform vec3 specular;
  uniform sampler2D specularMap;
  uniform float shininess;
  uniform float opacity;
  uniform vec3 u_lightDirection;
  uniform vec3 u_ambientLight;

  void main () {
    vec3 normal = normalize(v_normal);

    vec3 surfaceToViewDirection = normalize(v_surfaceToView);
    vec3 halfVector = normalize(u_lightDirection + surfaceToViewDirection);

    float fakeLight = dot(u_lightDirection, normal) * 0.5 + 0.5;

    // Phong specular reflection calculation
    float specularLight = clamp(dot(normal, halfVector), 0.0, 1.0);
    vec4 specularMapColor = texture2D(specularMap, v_texcoord);
    vec3 effectiveSpecular = specular * specularMapColor.rgb;

    // store the specular highlight (Phong reflection)
    float specularHighlight = pow(specularLight, shininess);

    // Diffuse lighting
    vec4 diffuseMapColor = texture2D(diffuseMap, v_texcoord);
    vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;
    float effectiveOpacity = opacity * diffuseMapColor.a * v_color.a;

    // Final color calculation
    vec3 finalSpecular = effectiveSpecular * specularHighlight;

    gl_FragColor = vec4(
        emissive +
        ambient * u_ambientLight +
        effectiveDiffuse * fakeLight +
        finalSpecular,
        effectiveOpacity
    );
  }
  `;

  // Create a program and Initialize & Compile the shaders
  const Program = createProgram(gl, vs, fs);

  // Load and Parse the object file and materials into javascript objects
  const objHref = 'duck_final.obj';
  const obj = await loadOBJ(gl, objHref);                  
  const materials = await loadMaterials(gl, obj, objHref);

  // Get geometries extend and setup the camera and parts of geometry
  const extents = getGeometriesExtents(obj.geometries);
  const cameraInfo = setupCamera(extents);
  const parts = setupGeometry(gl, obj, materials);

  // Draw the scene
  function render(time) {
    drawScene(gl, Program, parts, cameraInfo, extents, time);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

/**
 * Loads an OBJ file from a URL.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {string} objHref - The URL to the OBJ file.
 * @returns {Promise<Object>} The parsed OBJ data.
 */
const loadOBJ = async (gl, objHref) => {
  const response = await fetch(objHref);
  const text = await response.text();
  return ParseObjFile(text);
};

/**
 * Loads materials and textures from an OBJ file's material library (MTL).
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {Object} obj - Parsed OBJ data.
 * @param {string} objHref - The URL to the OBJ file.
 * @param {string} [mtlHref] - The optional URL to the MTL file.
 * @returns {Promise<Object>} The parsed material data with textures.
 */
const loadMaterials = async (gl, obj, objHref, mtlHref = null) => {
  const baseHref = new URL(objHref, window.location.href);
  const materialHrefs = mtlHref ? [mtlHref] : obj.materialLibs.map(filename => new URL(filename, baseHref).href);

  const matTexts = await Promise.all(materialHrefs.map(async href => {
    const response = await fetch(href);
    return await response.text();
  }));

  const materials = ParseMaterialFile(matTexts.join('\n'));
  const textures = { defaultWhite: create1PixelTexture(gl, [255, 255, 255, 255]) };

  for (const material of Object.values(materials)) {
    Object.entries(material)
      .filter(([key]) => key.endsWith('Map'))
      .forEach(([key, filename]) => {
        let texture = textures[filename];

        if (!texture) {
          const textureHref = new URL(filename, baseHref).href;
          texture = createTexture(gl, textureHref);
          textures[filename] = texture;
        }

        material[key] = texture;
      });
  }
  
  Object.values(materials).forEach(m => {
    m.shininess = 25;
    m.specular = [3, 2, 1];
  });

  return materials;
};

/**
 * Gets the extents (bounding box) of the geometries in an OBJ file.
 * @param {Array} geometries - Array of geometry data from the OBJ file.
 * @returns {Object} Min and max coordinates of the geometries.
 */
const getGeometriesExtents = (geometries) => {
  return geometries.reduce(({ min, max }, { data }) => {
    const minMax = getExtents(data.position);
    return {
      min: min.map((min, ndx) => Math.min(minMax.min[ndx], min)),
      max: max.map((max, ndx) => Math.max(minMax.max[ndx], max)),
    };
  }, {
    min: Array(3).fill(Number.POSITIVE_INFINITY),
    max: Array(3).fill(Number.NEGATIVE_INFINITY),
  });
};

/**
 * Gets the minimum and maximum extents of a position array.
 * @param {Array<number>} positions - The position array.
 * @returns {Object} Min and max coordinates.
 */
const getExtents = (positions) => {
  const min = positions.slice(0, 3);
  const max = positions.slice(0, 3);

  for (let i = 3; i < positions.length; i += 3) {
    for (let j = 0; j < 3; ++j) {
      const v = positions[i + j];
      min[j] = Math.min(v, min[j]);
      max[j] = Math.max(v, max[j]);
    }
  }
  return { min, max };
};

/**
 * Sets up camera position and parameters based on object extents.
 * @param {Object} extents - Min and max coordinates of the object.
 * @returns {Object} Camera position, target, and other settings.
 */
const setupCamera = (extents) => {
  const range = m4.subtractVectors(extents.max, extents.min);
  const objOffset = m4.scaleVector(m4.addVectors(extents.min, m4.scaleVector(range, 0.5)), -1);
 
  const cameraTarget = [0, 0, 0];
  const radius = m4.length(range) * 1.2;
  const cameraPosition = m4.addVectors(cameraTarget, [0, 0, radius]);

  return { cameraPosition, cameraTarget, zNear: radius / 100, zFar: radius * 3, objOffset };
};

/**
 * Sets up the geometry buffers for rendering.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {Object} obj - Parsed OBJ data.
 * @param {Object} materials - Material data.
 * @returns {Array} Array of parts with buffer information and material properties.
 */
const setupGeometry = (gl, obj, materials) => {
  const defaultMaterial = {
    diffuse: [1, 1, 1],
    diffuseMap: create1PixelTexture(gl, [255, 255, 255, 255]),
    ambient: [0, 0, 0],
    specular: [1, 1, 1],
    specularMap: create1PixelTexture(gl, [255, 255, 255, 255]),
    shininess: 400,
    opacity: 1,
  };

  return obj.geometries.map(({ material, data }) => {
    if (data.color) {
      if (data.position.length === data.color.length) {
        data.color = { numComponents: 3, data: data.color };
      }
    } else {
      data.color = { value: [1, 1, 1, 1] };
    }

    const bufferInfo = createBufferInfoFromArrays(gl, data);

    return {
      material: { ...defaultMaterial, ...materials[material] },
      bufferInfo,
    };
  });
};

/**
 * Draws the 3D scene.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {WebGLProgram} Program - The WebGL program.
 * @param {Array} parts - Array of parts with buffer and material information.
 * @param {Object} cameraInfo - Camera parameters.
 * @param {Object} extents - Object extents for positioning.
 * @param {number} time - Time value for animation.
 */
const drawScene = (gl, Program, parts, cameraInfo, extents, time) => {
  time *= 0.001;

  resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.enable(gl.DEPTH_TEST);

  const fieldOfViewRadians = degToRad(60);
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const projection = m4.perspective(fieldOfViewRadians, aspect, cameraInfo.zNear, cameraInfo.zFar);

  const up = [0, 1, 0];
  const camera = m4.lookAt(cameraInfo.cameraPosition, cameraInfo.cameraTarget, up);
  const view = m4.inverse(camera);

  gl.useProgram(Program);

  const location_lightDirection = gl.getUniformLocation(Program, "u_lightDirection");
  gl.uniform3fv(location_lightDirection, m4.normalize([-1, 3, 5]));

  const location_viewWorldPosition = gl.getUniformLocation(Program, "u_viewWorldPosition");
  gl.uniform3fv(location_viewWorldPosition, cameraInfo.cameraPosition);

  const location_view = gl.getUniformLocation(Program, "u_view");
  gl.uniformMatrix4fv(location_view, false, view);

  const location_projection = gl.getUniformLocation(Program, "u_projection");
  gl.uniformMatrix4fv(location_projection, false, projection);

  let u_world = m4.yRotation(time);
  u_world = m4.translate(u_world, ...cameraInfo.objOffset);

  for (const { bufferInfo, material } of parts) {
    setupAttributes(gl, Program, bufferInfo);
    setUniforms(gl, Program, { u_world }, material);
    gl.drawArrays(gl.TRIANGLES, 0, bufferInfo.numElements);
  }
};

/**
 * Converts degrees to radians.
 * @param {number} deg - The angle in degrees.
 * @returns {number} The angle in radians.
 */
const degToRad = (deg) => {
  return deg * Math.PI / 180;
};