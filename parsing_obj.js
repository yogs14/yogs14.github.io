"use strict";

/**
 * Vertex positions, texture coordinates, normals, and colors.
 */
let objPositions = [[0, 0, 0]];
let objTexcoords = [[0, 0]];
let objNormals = [[0, 0, 0]];
let objColors = [[0, 0, 0]];

/**
 * Stores vertex data in the same order as `f` indices.
 * @type {Array<Array<Array<number>>>}
 */
const objVertexData = [
  objPositions,
  objTexcoords,
  objNormals,
  objColors,
];

/** Material libraries referenced in the OBJ file */
const materialLibs = [];

/** List of geometries parsed from the OBJ file */
const geometries = [];

let geometry;
let groups = ['default'];
let material = 'default';
let object = 'default';

/** No-operation function */
const noop = () => {};

/**
 * Initializes and adds a new geometry if none exists.
 */
const setGeometry = () => {
  if (!geometry) {
    geometry = {
      object,
      groups,
      material,
      data: {
        position: [],
        texcoord: [],
        normal: [],
        color: [],
      },
    };
    geometries.push(geometry);
  }
};

/**
 * Parses an OBJ file text content.
 * @returns {Object} Parsed geometry and material library data.
 */
const ParseObjFile = (text) => {
  /**
   * Adds a vertex based on the `f` line of the OBJ file.
   * @param {string} vert - Vertex specification from OBJ `f` line.
   */
  const addVertex = (vert) => {
    const ptn = vert.split('/');

    ptn.forEach((objIndexStr, i) => {
      if (!objIndexStr) return;

      const objIndex = parseInt(objIndexStr);
      const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);

      if (i === 0) {
        geometry.data.position.push(...objVertexData[i][index]);
      } else if (i === 1) {
        geometry.data.texcoord.push(...objVertexData[i][index]);
      } else if (i === 2) {
        geometry.data.normal.push(...objVertexData[i][index]);
      } else if (i === 3) {
        geometry.data.color.push(...objVertexData[i][index]);
      }

      if (i === 0 && objColors.length > 1) {
        geometry.data.color.push(...objColors[index]);
      }
    });
  };

  const keywords = {
    /** 
     * Parses vertex positions and colors (if present).
     * @param {string[]} value - Array containing position values (and optional color values).
     */
    v(value) {
      if (value.length > 3) {
        objPositions.push(value.slice(0, 3).map(parseFloat));
        objColors.push(value.slice(3).map(parseFloat));
      } else {
        objPositions.push(value.map(parseFloat));
      }
    },

    /** 
     * Parses vertex normals.
     * @param {string[]} value - Array containing normal vector values.
     */
    vn(value) { 
      objNormals.push(value.map(parseFloat)); 
    },

    /** 
     * Parses texture coordinates.
     * @param {string[]} value - Array containing texture coordinate values.
     */
    vt(value) { 
      objTexcoords.push(value.map(parseFloat)); 
    },

    /** 
     * Parses face definitions and constructs triangles.
     * @param {string[]} value - Array containing face indices for vertices, texture coordinates, and normals.
     */
    f(value) {
      setGeometry();
      const numTriangles = value.length - 2;
      for (let tri = 0; tri < numTriangles; ++tri) {
        addVertex(value[0]);
        addVertex(value[tri + 1]);
        addVertex(value[tri + 2]);
      }
    },

    /** 
     * Handles smoothing group definitions (not implemented).
     */
    s: noop,

    /** 
     * Adds a material library file reference.
     * @param {string[]} value - Array containing material library names.
     * @param {string} RawValue - Full string of the material library line in the OBJ file.
     */
    mtllib(value, RawValue) {
      materialLibs.push(RawValue);
    },

    /** 
     * Specifies the material to use for the following geometry.
     * @param {string[]} value - Array containing the material name.
     */
    usemtl(value) {
      material = value[0];
      newGeometry();
    },

    /** 
     * Sets geometry group names.
     * @param {string[]} value - Array containing group names.
     */
    g(value) {
      groups = value;
      newGeometry();
    },

    /** 
     * Defines an object name.
     * @param {string[]} value - Array containing the object name.
     */
    o(value) {
      object = value[0];
      newGeometry();
    },
  };

  const keywordRegex = /(\w*)(?: )*(.*)/;
  text.split('\n').forEach(line => {
    line = line.trim();
    if (line === '' || line.startsWith('#')) return;

    const match = keywordRegex.exec(line);
    if (!match) return;

    const [, keyword, RawArguments] = match;
    const value = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];

    if (!handler) {
      console.warn('Unknown Object keywords:', keyword);
      return;
    }

    handler(value, RawArguments);
  });

  // Remove empty arrays from geometry data
  geometries.forEach((geometry) => {
    Object.keys(geometry.data).forEach((key) => {
      if (geometry.data[key].length === 0) {
        delete geometry.data[key];
      }
    });
  });

  return {
    geometries,
    materialLibs,
  };
};

/**
 * Starts a new geometry if the current one is not empty.
 */
const newGeometry = () => {
  if (geometry && geometry.data.position.length) {
    geometry = undefined;
  }
};