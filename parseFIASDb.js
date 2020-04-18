import Saxophone  from 'saxophone'
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

  const parser = new Saxophone();
  const firstReleaseForThisTable = !(await collection.find().toArray()).length
  const deleteMode = file.name.includes('_DEL_') // файл со списком удаленных
  
  return new Promise((res, rej) => {
    const read = createReadStream(join(basePath, file.name))

    parser.on('tagopen', ({name, attrs: attributes}) => {
      const attrs = Saxophone.parseAttrs(attributes)

      if (name === xmlTags.container) {
        return
      }
  
      if (name !== xmlTags.base) {
        console.log(name, 'Неизвестный тег')
      }
      
      if (firstReleaseForThisTable) {
        collection.insertOne(attrs, err => {
          console.assert(err === null, 'Не удалось вставить ' + name + ' ' + attrs, err)
        })
      } else if (deleteMode) {
        collection.deleteOne(updateQuery(attrs), err => {
          console.assert(err === null, 'Не удалось удалить ' + name + ' ' + attrs, err)
        })
      } else {
        collection.replaceOne(updateQuery(attrs), attrs, { upsert: true }, err => {
          console.assert(err === null, 'Не удалось вставить ' + name + ' ' + attrs, err)
        })
      }
      
    })
  
    read.pipe(parser)
  
    parser.on('finish', err => {
      if (err) {
        rej(err)
      } else {
        res()
      }
    })
    read.on('close', () => {
      res()
    })
  })
    .then(() => console.info(fileName + ' готов'))
}



export async function parseFolder(pathToFolder, parseOptions, options = {}){
  // смотрит какие файлы в папке, заносит их в бд потом все удаляет
  const files = await fsp.readdir(pathToFolder, { withFileTypes: true })

  const xmlFiles = files.filter(item => item.isFile() && extname(item.name).toLocaleLowerCase() === '.xml')
  console.info(`Начата работа с папкой, в ней файлов: ${xmlFiles.length}`)

  const parsedFiles = []
  
  for (const item of xmlFiles) {
    const option = parseOptions.find(([,,name]) => item.name
      .toLocaleLowerCase()
      .indexOf(`_${name.toLocaleLowerCase()}_`) + 1
    )

    if (!option) {
      console.error('Не обнаружена опция для парсинга файла ' + item.name)
      continue
    }
    const [collection, tags, filename, updateQuery] = option

    if (options.beforeEntry) {
      const result = await options.beforeEntry(item, filename)
      console
      if (result === 'skip') {
        continue
      }
    }
    
    await parseTable(
      collection,
      pathToFolder,
      tags,
      filename,
      updateQuery
    )

    parsedFiles.push(filename)

    if (options.entryEnd) {
      await options.entryEnd(item, filename, parsedFiles)
    }
  }

  console.log(`Работа с папкой ${pathToFolder} завершена`)

}