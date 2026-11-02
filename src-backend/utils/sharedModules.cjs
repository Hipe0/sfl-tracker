/**
 * Nạp các module ESM dùng chung với frontend (src/utils/*.js) từ backend CommonJS.
 */
const path = require('path');
const { pathToFileURL } = require('url');

let taxModule = null;
function getTaxModule() {
  if (!taxModule) {
    const url = pathToFileURL(path.join(__dirname, '../../src/utils/taxCalculator.js')).href;
    taxModule = import(url).catch(err => {
      taxModule = null;
      throw err;
    });
  }
  return taxModule;
}

let idMap = null;
function getIdMap() {
  if (!idMap) idMap = require('../../src/data/idMap.json');
  return idMap;
}

module.exports = { getTaxModule, getIdMap };
