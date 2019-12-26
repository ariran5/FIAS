import Parser from 'node-xml-stream-parser'
import fs, { createReadStream, promises as fsp } from 'fs'
import { join } from 'path';

export default () => {

}

export async function parseAddrs(collection, basePath = './') {
  const files = await fsp.readdir(join(basePath), {withFileTypes: true})

  const file = files.find(item => item.isFile() && /AS_ADDROBJ/.test(item.name))
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
      if (name === 'AddressObjects') {
        return
      }
  
      if (name === 'Object') {
        collection.insertOne(attrs, err => {
          console.assert(err === null, 'Не удалось вставить ' + name + ' ' + attrs)
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


export async function parseHouses(collection, basePath = './') {
  const files = await fsp.readdir(join(basePath), {withFileTypes: true})

  const file = files.find(item => item.isFile() && /AS_HOUSE/.test(item.name))
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
      if (name === 'Houses') {
        return
      }
  
      if (name === 'House') {
        collection.insertOne(attrs, err => {
          console.assert(err === null, 'Не удалось вставить ' + name + ' ' + attrs)
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


export async function parseTable(collection, basePath = './', xmlTags, fileName) {
  console.log('Начало парсинга ' + fileName);
  
  const files = await fsp.readdir(join(basePath), {withFileTypes: true})

  const file = files.find(item => item.isFile() && new RegExp(`AS_${fileName}`).test(item.name))
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
        collection.insertOne(attrs, err => {
          console.assert(err === null, 'Не удалось вставить ' + name + ' ' + attrs)
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