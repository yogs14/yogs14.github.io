"use strict";

/**
 * Parses a material (.mtl) file and extracts material properties.
 * @param {string} text - The text content of the material file.
 * @returns {Object} An object containing materials and their properties.
 */
const ParseMaterialFile = (text) => {
  const materials = {};
  let index;

  const keywords = {
    /**
     * Defines a new material name.
     * @param {string[]} value - Array containing the material name.
     */
    newmtl(value) {
      index = value[0];
      materials[index] = {};
    },

    /**
     * Sets shininess (Ns).
     * @param {string[]} value - Array containing the shininess value.
     */
    Ns(value) {
      materials[index].shininess = parseFloat(value[0]);
    },

    /**
     * Sets ambient or metallic color (Ka).
     * @param {string[]} value - Array containing RGB values.
     */
    Ka(value) {
      materials[index].ambient = value.map(parseFloat);
    },

    /**
     * Sets diffuse color (Kd).
     * @param {string[]} value - Array containing RGB values.
     */
    Kd(value) {
      materials[index].diffuse = value.map(parseFloat);
    },

    /**
     * Sets specular color (Ks).
     * @param {string[]} value - Array containing RGB values.
     */
    Ks(value) {
      materials[index].specular = value.map(parseFloat);
    },

    /**
     * Sets emissive color (Ke).
     * @param {string[]} value - Array containing RGB values.
     */
    Ke(value) {
      materials[index].emissive = value.map(parseFloat);
    },

    /**
     * Sets the file path for the diffuse texture map (map_Kd).
     * @param {string[]} value - Array containing the texture file path.
     */
    map_Kd(value) {
      materials[index].diffuseMap = value.join(" ");
    },

    /**
     * Sets the file path for the shininess texture map (map_Ns).
     * @param {string[]} value - Array containing the texture file path.
     */
    map_Ns(value) {
      materials[index].specularMap = value.join(" ");
    },

    /**
     * Sets the index of refraction (Ni).
     * @param {string[]} value - Array containing the index of refraction.
     */
    Ni(value) {
      materials[index].IOR = parseFloat(value[0]);
    },

    /**
     * Sets the opacity (d).
     * @param {string[]} value - Array containing the opacity value.
     */
    d(value) {
      materials[index].opacity = parseFloat(value[0]);
    },

    /**
     * Sets the illumination model (illum).
     * @param {string[]} value - Array containing the illumination model index.
     */
    illum(value) {
      materials[index].illum = parseInt(value[0]);
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
      console.warn('Unknown material keyword:', keyword);
      return;
    }

    handler(value);
  });

  return materials;
};