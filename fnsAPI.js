import { join, parse } from "path";
import { createWriteStream, promises as fsp, rmdir } from "fs";
import request from "request";
import XMLParser from 'fast-xml-parser'

const link = (fileName, version) => `https://fias.nalog.ru/Public/Downloads/${version || 'Actual'}/${fileName}`

const dirFIASFiles = './rawFIASXMLFiles/'

export function checkDirForFiles(name = ''){
  const url = join(dirFIASFiles, name.toString())

  return fsp.stat(url)
    .then(stat => {
      if (!stat.isDirectory()) {
        throw new Error(`По пути ${rawFilesFolderPath} лежит файл, удалите его или переместите, он мешает.`)
      }
    })
    .catch(err => {
      if (err.code === 'ENOENT') {
        return fsp.mkdir(url, { recursive: true })
      }

      throw err
    })


}

export async function downloadLastArchive() {
  const {
    id: actualVersion,
    full: urlToFullArchive
  } = await getInfoAboutReleases('last')
  
  const {
    base: filename
  } = parse(urlToFullArchive)
  
  const localPath = join(dirFIASFiles, actualVersion.toString(), filename)
  
  const start = async () => {

    await checkDirForFiles( actualVersion )

    const ws = createWriteStream(localPath)
  
    return new Promise((res, rej) => {
  
      request
        .get(urlToFullArchive)
        .on('error', err => {
          console.error('Ошибка скачивания файла версии ' + actualVersion)
          
          rmdir(join(dirFIASFiles, actualVersion), { recursive: true }, err => {
            if (err)
              console.error('Не удалось удалить папку ' + actualVersion)
          })
          
          throw err
        })
        .pipe(ws)
  
      ws.on('finish', () => {
        res({
          id: actualVersion,
          filename,
          localPath,
        })
        console.log(`Загрузка базы данных версии ${actualVersion} успешно завершена`)
      })
      ws.on('error', rej)
    })
  }

  return {
    id: actualVersion,
    filename,
    localPath,
    start
  }
}


export async function downloadUpdate(objOfRelease) {
  const {
    id: actualVersion,
    diff: urlToFullArchive
  } = objOfRelease
  
  const {
    base: filename
  } = parse(urlToFullArchive)
  
  const localPath = join(dirFIASFiles, actualVersion.toString(), filename)
  
  await checkDirForFiles( actualVersion )

  const ws = createWriteStream(localPath)

  return new Promise((res, rej) => {

    request
      .get(urlToFullArchive)
      .on('error', err => {
        console.error('Ошибка скачивания файла версии ' + actualVersion)
        
        rmdir(join(dirFIASFiles, actualVersion), { recursive: true }, err => {
          if (err)
            console.error('Не удалось удалить папку ' + actualVersion)
        })
        
        throw err
      })
      .pipe(ws)

    ws.on('finish', () => {
      res({
        id: actualVersion,
        filename,
        localPath,
      })
      console.log(`Загрузка обновления ${actualVersion} успешно завершена`)
    })
    ws.on('error', rej)
  })
}


export async function checkUpdatesBase(lastReleaseId, beforeDownloadCb, cb){
  const releases = await getInfoAboutReleases()
    .then(data => data.filter(item => +item.id > +lastReleaseId).reverse())

  for (const item of releases) {
    if (beforeDownloadCb) {
      var beforeDownloadCbRes = await beforeDownloadCb(item)
    }
    if (beforeDownloadCbRes === false) {
      continue
    }
    const result = await downloadUpdate(item)
      .catch(err => {
        if (cb) {
          cb(err)
        } else {
          throw err
        }
      })
    
    if (cb) {
      await cb(null, result)
    }
  }

}

export function getInfoAboutReleases(type = 'all'){
  const fias_url = 'https://fias.nalog.ru/WebServices/Public/DownloadService.asmx'
  const methods = {
    all: 'GetAllDownloadFileInfo',
    last: 'GetLastDownloadFileInfo'
  }
  const body  = `
  <?xml version="1.0" encoding="utf-8"?>
  <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
    <soap12:Body>
      <${methods[type]} xmlns="${fias_url}" />
    </soap12:Body>
  </soap12:Envelope>`.trim()

  const headers = {
    'Content-Type': 'application/soap+xml; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  }

  return new Promise((resolve, rej) => {

    request
      .post({url: fias_url, body, headers}, (err, res, body) => {
        if (err) {
          rej(err)
        } else if (res.statusCode !== 200) {
          rej('Код ответа от ФИАС по СОАП ' + res.statusCode, res)
        } else {
          resolve(body)
        }
      })
  })
    .then(text => {
      const json = XMLParser.parse(text)
        ['soap:Envelope']
          ['soap:Body']
            [methods[type] + 'Response']
              [methods[type] + 'Result']

      return type === 'all' ? json['DownloadFileInfo'].reverse().map(m): m(json)
      //         
    })

  function m(item){
    return {
      id: item.VersionId,
      title: item.TextVersion,
      full: item.FiasCompleteXmlUrl,
      diff: item.FiasDeltaXmlUrl,
    }
  }
}
