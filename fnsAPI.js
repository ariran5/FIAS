import { join, resolve } from "path"
import { createWriteStream, promises as fsp, rmdir } from "fs"
import fetch from "node-fetch"
import mime from 'mime-types'
import extract from 'extract-zip'

const dirFIASFiles = './rawFIASXMLFiles/'


// чекает есть ли папка, если нет - создает
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

export function downloadLastArchive(){
  
  return downloadUpdate()
    .then(({start}) => start())


}

// загружает определенный релиз в /${dirFIASFiles}/номер релиза/номер релиза.zip
// если передан объект релиза то будет качать апдейт
// в противном случае само скачает полный последний релиз
export async function downloadUpdate(objOfRelease = null) {
  const {
    id: actualVersion,
    full,
    diff,
  } = objOfRelease || await getInfoAboutReleases('last')

  const url = objOfRelease ? diff: full
  
  const start = async () => {

    await checkDirForFiles( actualVersion )
    console.group('Информация о скачивании')
    console.info('Создана папка для релиза ' + actualVersion)

    try {
      console.info(`Начато ${objOfRelease ? 'частичное': 'полное'} скачивание релиза ${actualVersion}`)
      console.groupEnd('Информация о скачивании')
      var res = await fetch(url)

      } catch (err) {
      console.error('Ошибка скачивания файла версии ' + actualVersion)
      
      rmdir(join(dirFIASFiles, actualVersion.toString()), { recursive: true }, err => {
        if (err)
          console.error('Не удалось удалить папку ' + actualVersion)
      })
      throw err
    }

    const contentType = res.headers.get('content-type')
    

    // номер.zip или номер.diff.zip
    const filename = `${actualVersion.toString()}${objOfRelease ? '.diff': ''}.${mime.extension(contentType) || 'zip'}`
    const localPath = join(dirFIASFiles, actualVersion.toString(), filename)

    const ws = createWriteStream(localPath)

    res.body.pipe(ws)

    return new Promise((res, rej) => {
      ws.on('finish', () => {
        res({
          id: actualVersion,
          filename,
          localPath,
        })
        console.info(`Загружен релиз ${actualVersion}`)
      })
      ws.on('error', rej)
    })
      .then(releaseObj => {
        console.info(`Начато разархивирование релиза ${actualVersion}`)
        return extract(localPath, { dir: resolve(dirFIASFiles, actualVersion.toString()) })
          .then(() => {
            fsp.unlink(localPath)
              .then(() => {
                console.log(`Архив релиза ${actualVersion} удален`)
              })
              .catch(() => {
                console.error(`Архив релиза ${actualVersion} удалить не удалось`)
              })
            console.info(`Релиз ${actualVersion} готов к обработке`)
            return releaseObj
          })
      })

  }

  return {
    id: actualVersion,
    start
  }
}

export async function checkUpdatesBase(lastReleaseId, beforeDownloadCb = () => {}, cb){
  // смотрит последний релиз, его номер, получает остальные релизы и по одному их загружает
  const releases = await getInfoAboutReleases()
    .then(data => data.filter(item => +item.id > +lastReleaseId).reverse())
  
  for (const item of releases) {
    if (beforeDownloadCb) {
      // перед загрузкой вызывается beforeDownloadCb, если он вернул false то загрузки этого релиза не будет
      var beforeDownloadCbRes = await beforeDownloadCb(item)
    }
    if (beforeDownloadCbRes === false) {
      // и код перейдет к следующему
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
      // в cb передается 1 ошибка 2 результат
      await cb(null, result)
    }
  }

}

// получить инфо о последнем или обо всех релизах
export function getInfoAboutReleases(type = 'all'){
  
  const methods = {
    all: 'https://fias.nalog.ru/WebServices/Public/GetAllDownloadFileInfo',
    last: 'https://fias.nalog.ru/WebServices/Public/GetLastDownloadFileInfo'
  }
  const fiasUrl = methods[type]

  if (!fiasUrl) {
    throw new Error('Не указан тип желаемой информации')
  }

  return fetch(fiasUrl)
    .then(res => {
      if (res.status !== 200) {
        throw new Error('Код ответа от ФИАС по СОАП ' + res.statusCode)
      }
      return res.json()
    })
    .then(json => type === 'all' ? json.map(m): m(json))

  function m(item){
    return {
      id: item.VersionId,
      title: item.TextVersion,
      full: item.FiasCompleteXmlUrl,
      diff: item.FiasDeltaXmlUrl,
    }
  }
}
