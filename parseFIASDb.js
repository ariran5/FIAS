import Parser from 'node-xml-stream-parser'
import fs, { createReadStream, promises as fsp } from 'fs'
import { join, extname } from 'path'


export async function parseTable(collection, basePath = './', xmlTags, fileName, updateQuery) {
  if (!updateQuery) {
    throw new Error(`
    Обязательно должна быть функция, 
    которая создает объект поиска имеющегося объекта.
    Сейчас она ${updateQuery.toString()}`)
  }

  console.log('Начало парсинга ' + fileName);
  
  const files = await fsp.readdir(join(basePath), {withFileTypes: true})

  const file = files.find(item => item.isFile() && (item.name.indexOf(`_${fileName}_`) + 1))
  if (!file) {
    return
  }


  const parser = new Parser()
  
  return new Promise((res, rej) => {

    // parser.on('instruction', (name, attrs) => {
    //   // console.log(name, attrs)
    // });
  
    const read = createReadStream(join(basePath, file.name))
  
    parser.on('opentag', (name, attrs) => {
      
      if (name === xmlTags.container) {
        return
      }
  
      if (name === xmlTags.base) {
        collection.update(updateQuery(attrs), attrs, { upsert: true },err => {
          console.assert(err === null, 'Не удалось вставить ' + name + ' ' + attrs, err)
        })
      } else {
        console.log(name, 'Неизвестный тег')
      }
    })
  
    // parser.on('closetag', name => {
    //   // console.log(name, '===================================================')
    // })
  
    read.pipe(parser)
  
    parser.on('finish', err => {
      if (err) {
        rej(err)
      } else {
        res()
      }
    })
  })
}



export async function parseFolder(pathToFolder, parseOptions){
  // смотрит какие файлы в папке, заносит их в бд потом все удаляет
  const files = await fsp.readdir(pathToFolder, { withFileTypes: true })

  const xmlFiles = files.filter(item => item.isFile() && extname(item.name).toLocaleLowerCase() === '.xml')

  for (const item of xmlFiles) {
    const option = parseOptions.find(([,,name]) => item.name
      .toLocaleLowerCase()
      .indexOf(`_${name.toLocaleLowerCase()}_`) + 1
    )

    if (!option) {
      console.error('Не обнаружена опция для парсинга файла ' + item.name)
      continue
    }

    await parseTable(
      option[0],
      pathToFolder,
      option[1],
      option[2],
      option[3]
    )
  }

  console.log(`Работа с папкой ${pathToFolder} завершена, начато удаление`)
  fsp.rmdir(pathToFolder, { recursive: true })
    .then(() => {
      console.log(`Папка ${pathToFolder} удалена`)
    })
    .catch(err => {
      console.error(`Удалить папку ${pathToFolder} не удалось`, err)
    })

}