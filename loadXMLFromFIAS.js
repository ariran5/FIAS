import { normalize } from "path";
import { createWriteStream, statSync, mkdir, promises: fsp } from "fs";
const link = (fileName, version) => `https://fias.nalog.ru/Public/Downloads/${version || 'Actual'}/${fileName}.rar`

const files = ['fias_delta_xml', 'fias_xml']


const rawFilesFolderPath = normalize('./rawFIASXMLFiles/')

export async function loadAllBase() {
  try {
    var stat = statSync(rawFilesFolderPath)
  } catch {
    await fsp.mkdir(rawFilesFolderPath)
  }

  if (!stat.isDirectory()) {
    throw new Error(`По пути ${rawFilesFolderPath} лежит файл, удалите его или переместите, он мешает.`)
  }
  
  const ws = createWriteStream('./')
}