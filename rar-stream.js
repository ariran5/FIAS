
import { resolve, join, normalize } from "path";

import { createRequire } from 'module';
import { stat, statSync } from "fs";

const require = createRequire(import.meta.url);

var filename = 'fias_delta_xml.rar' || 'FIAS.rar'

var DecompressZip = require('decompress-zip');
var unzipper = new DecompressZip(filename)
 




unzipper.on('error', function (err) {
  console.log('Caught an error', err);
});

unzipper.on('list', function (files) {
  console.log('The archive contains:');
  console.log(files);
});

unzipper.list();


// unzipper.on('error', function (err) {
//     console.log('Caught an error', err);
// });
 
// unzipper.on('extract', function (log) {
//     console.log('Finished extracting');
// });
 
// unzipper.on('progress', function (fileIndex, fileCount) {
//     console.log('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount);
// });

// unzipper.extract({
//     // path: normalize('./rarFiles'),
//     // filter: function (file) {
//     //     return file.type !== "SymbolicLink";
//     // }
// });