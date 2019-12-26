import mongo from "mongodb";
import fs, { createReadStream } from 'fs'
import { parseAddrs, parseHouses, parseTable } from './parseFIASDb.js'
import request from "request";

const {
  Server,
  Db,
  MongoClient,
} = mongo

const url = 'mongodb://localhost:27017';

// Database Name
const dbName = 'FIAS';
const client = new MongoClient(url);

import { normalize } from "path";

const actualVersion = new Promise((res, rej) => {
  request('https://fias.nalog.ru/Public/Downloads/Actual/VerDate.txt', (err, ...args) => {
    if (err) {
      rej(err)
    } else {
      res(...args)
    }
  })
})

// {
//   const fias_url = '//fias.nalog.ru/WebServices/Public/DownloadService.asmx'
//   const methods = {
//     all: 'GetAllDownloadFileInfo',
//     last: 'GetLastDownloadFileInfo'
//   }
//   const body  = `
//   <?xml version="1.0" encoding="utf-8"?>
//   <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
//     <soap12:Body>
//       <${methods.all} xmlns="https:${fias_url}" />
//     </soap12:Body>
//   </soap12:Envelope>`

//   const headers = {
//     'Content-Type': 'application/soap+xml; charset=utf-8',
//     'Content-Length': body.length
//   }

//   fetch(fias_url, {
//     method: 'POST',
//     headers,
//     body
//   }).then(res => res.text()).then(console.log)
// }

client.connect()
  .then(async client => {
    console.log("Подключено к БД");
    
    try {
      const [, ddate] = await actualVersion

      var time = +new Date(...ddate.split('.').map((i, ind) => ind === 2 ? i - 1: i).reverse())
    } catch {

      console.error('Не удалось получить дату актуальной версии с сайта ФИАС')
      process.exit(1)
    }

    const lastVersion = await client
      .db(dbName)
      .collection('versions')
      .find()
      .sort({ time: -1 })
      .findOne({})
      .catch(err => {
        console.error('Не удалось получить последнюю версию имеющейся информации')
        process.exit(1)
      })
    
    if (!lastVersion) {
      loadAllBase()
    }
  
    const basePath = normalize('D:/Users/Ariran/Downloads/fias_xml')

    // console.log('Начало парсинга адресов')
    // parseAddrs(
    //   db.collection('addresses'),
    //   basePath
    // )
    //   .then(() => {
    //     console.log('Выполнен парсинг адресов');
    //   })
    //   .catch(err => {
    //     console.error('Не выполнен парсинг адресов', err)
    //   })
  
    // parseHouses(
    //   db.collection('houses'),
    //   basePath
    // )
    //   .then(() => {
    //     console.log('Выполнен парсинг домов');
    //   })
    //   .catch(err => {
    //     console.error('Не выполнен парсинг домов', err)
    //   })

    const addr = client
      .db(dbName)
      .collection('addresses')

    // console.time('qwe')
    
    // addr.find({FORMALNAME: 'Москва'})
    //   .toArray()
    //   .then(res => {
    //     console.timeEnd('qwe')
    //     console.log(res.length)
    //   })

    let count = 0

    for (let i = 0; i < 50; i++) {
      console.time('qwe' + i)

      addr.find({FORMALNAME: 'Москва'})
        .toArray()
        .then(res => {
          count++
          console.timeEnd('qwe' + i)
          console.log(count)
        })
    }
  
    // const statuses = parseTable(
    //   db.collection('statuses'), 
    //   basePath, 
    //   {
    //     container: 'ActualStatuses',
    //     base: 'ActualStatus'
    //   },
    //   'ACTSTAT'
    // )
    
    // parseTable(
    //   db.collection('statuses'), 
    //   basePath, 
    //   {
    //     container: 'ActualStatuses',
    //     base: 'ActualStatus'
    //   },
    //   'ACTSTAT'
    // )

  })
  .catch(err => {
    console.error(err, 'Ошибка подключения к бд');
  })