
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

var unrar = require("node-unrar-js");

export default function (pathToArchive, pathToFiles) {
  if (!pathToArchive || !pathToFiles) {
    throw new Error('Обязательно нужно указать 2 аргумента, что разархивировать и куда, а указано: ' + arguments.length)
  }
  var extractor = unrar.createExtractorFromFile(pathToArchive, pathToFiles);

  return extractor.extractAll();
}