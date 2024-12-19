"use strict";

/** Uniform Data Type Helper */
const UNIFORM_TYPES = {
  u_projection: 35676,          // gl.FLOAT_MAT4
  u_view: 35676,                // gl.FLOAT_MAT4
  u_world: 35676,               // gl.FLOAT_MAT4
  u_view_world_position: 35665, // gl.FLOAT_VEC3
  diffuse: 35665,               // gl.FLOAT_VEC3
  ambient: 35665,               // gl.FLOAT_VEC3
  emissive: 35665,              // gl.FLOAT_VEC3
  specular: 35665,              // gl.FLOAT_VEC3
  shininess: 5126,              // gl.FLOAT
  opacity: 5126,                // gl.FLOAT
  u_light_direction: 35665,     // gl.FLOAT_VEC3
  u_ambient_light: 35665,       // gl.FLOAT_VEC3
  diffuseMap: 35678,            // gl.SAMPLER_2D
  specularMap: 35678            // gl.SAMPLER_2D
};

/**
 * Creates a WebGL program from given vertex and fragment shader sources.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {string} vertexShaderSource - GLSL source code for the vertex shader.
 * @param {string} fragmentShaderSource - GLSL source code for the fragment shader.
 * @returns {WebGLProgram|null} The created WebGL program, or null on error.
 */
const createProgram = (gl, vertexShaderSource, fragmentShaderSource) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

/**
 * Creates a WebGL shader.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {number} type - The type of shader, either gl.VERTEX_SHADER or gl.FRAGMENT_SHADER.
 * @param {string} source - GLSL source code for the shader.
 * @returns {WebGLShader|null} The created shader, or null on error.
 */
const createShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Checks if a value is a power of 2.
 * @param {number} value - The value to check.
 * @returns {boolean} True if the value is a power of 2, false otherwise.
 */
const isPowerOf2 = (value) => {
  return (value & (value - 1)) === 0;
};

/**
 * Creates a 1x1 pixel texture.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {number[]} pixel - Array containing RGBA values for the pixel.
 * @returns {WebGLTexture} The created texture.
 */
const create1PixelTexture = (gl, pixel) => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(pixel));
  return texture;
};

/**
 * Creates a texture from an image URL.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {string} url - The URL of the image to use as texture.
 * @returns {WebGLTexture} The created texture.
 */
const createTexture = (gl, url) => {
  const texture = create1PixelTexture(gl, [128, 192, 255, 255]);

  const image = new Image();
  if ((new URL(url, window.location.href)).origin !== window.location.origin) {
    image.crossOrigin = "";
  }
  image.src = url;

  image.addEventListener('load', function () {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  });

  return texture;
};

/**
 * Creates a WebGL buffer with given data.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {number[]} data - The data to store in the buffer.
 * @param {number} type - The type of buffer, either gl.ARRAY_BUFFER or gl.ELEMENT_ARRAY_BUFFER.
 * @returns {WebGLBuffer} The created buffer.
 */
const createBuffer = (gl, data, type) => {
  const buffer = gl.createBuffer();
  gl.bindBuffer(type, buffer);
  gl.bufferData(type, new Float32Array(data), gl.STATIC_DRAW);
  return buffer;
}

/**
 * Creates buffer information from attribute data arrays.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {object} data - Object containing attribute arrays.
 * @returns {object} Object containing buffer information.
 */
const createBufferInfoFromArrays = (gl, data) => {
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.position), gl.STATIC_DRAW);

  const texcoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.texcoord), gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normal), gl.STATIC_DRAW);

  const bufferInfo = {
    attribs: {
      a_position: { buffer: positionBuffer, numComponents: 3, type: gl.FLOAT, normalize: false },
      a_normal: { buffer: normalBuffer, numComponents: 3, type: gl.FLOAT, normalize: false },
      a_texcoord: { buffer: texcoordBuffer, numComponents: 2, type: gl.FLOAT, normalize: false },
      a_color: data.color,
    },
    numElements: data.position.length / 3,
  };

  return bufferInfo;
}

/**
 * Sets up attribute pointers for a WebGL program.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {WebGLProgram} program - The WebGL program.
 * @param {object} attribs - The buffer information.
 */
const setupAttributes = (gl, program, attribs) =>  {
  Object.keys(attribs.attribs).forEach(attribute => {
    const location = gl.getAttribLocation(program, attribute);
    const data = attribs.attribs[attribute];

    if (location === -1) {
      console.warn(`Attribute ${attribute} not found in the program.`);
      return;
    }

    if (data.value != undefined) {
      gl.disableVertexAttribArray(location);
      gl.vertexAttrib4fv(location, data.value);
    } else if (data.buffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, data.buffer);
      gl.vertexAttribPointer(location, data.numComponents, data.type || gl.FLOAT, data.normalize || false, 0, 0);
      gl.enableVertexAttribArray(location);
    }
  });
}

/**
 * Sets uniforms for a WebGL program.
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {WebGLProgram} program - The WebGL program.
 * @param {...object} uniformSets - Objects containing uniform data.
 */
const setUniforms = (gl, program, ...uniformSets) => {
  let textureUnit = 0;
  const uniforms = Object.assign({}, ...uniformSets);

  Object.keys(uniforms).forEach((uniformName) => {
    const location = gl.getUniformLocation(program, uniformName);
    if (location === null) {
      return;
    }

    let value = uniforms[uniformName];

    if (Array.isArray(value)) {
      switch (UNIFORM_TYPES[uniformName]) {
        case gl.FLOAT_MAT4:
          gl.uniformMatrix4fv(location, false, value);
          break;
        case gl.FLOAT_VEC3:
          gl.uniform3fv(location, value);
          break;
        case gl.FLOAT:
          gl.uniform1fv(location, value);
          break;
        default:
          console.error(`Unsupported array length for uniform ${uniformName}: ${value.length}`);
      }
    } else {
      switch (UNIFORM_TYPES[uniformName]) {
        case gl.FLOAT:
          gl.uniform1f(location, value);
          break;
        case gl.SAMPLER_2D:
          gl.uniform1i(location, textureUnit);
          gl.activeTexture(gl.TEXTURE0 + textureUnit);
          gl.bindTexture(gl.TEXTURE_2D, value);
          textureUnit += 1;
          break;
        case gl.FLOAT_MAT4:
          gl.uniformMatrix4fv(location, false, value);
          break;
        default:
          console.error(`Unsupported uniform type for ${uniformName}`);
      }
    }
  });
}

/**
 * Resizes a canvas to match its display size.
 * @param {HTMLCanvasElement} canvas - The canvas to resize.
 * @param {number} [multiplier=1] - Amount to multiply by, e.g., window.devicePixelRatio for native pixels.
 * @returns {boolean} True if the canvas was resized, false otherwise.
 */
const resizeCanvasToDisplaySize = (canvas, multiplier = 1) => {
  const width = canvas.clientWidth * multiplier | 0;
  const height = canvas.clientHeight * multiplier | 0;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
}