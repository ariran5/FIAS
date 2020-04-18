import mongo from "mongodb"
import { parseFolder } from './parseFIASDb.js'
import { resolve, join } from 'path'

import { downloadLastArchive, checkUpdatesBase, downloadUpdate2, getInfoAboutReleases } from './fnsAPI.js'
import { unlink, rmdir, promises as fsp } from 'fs'

export default class FIAS {
  // Database Name
  static #dbName = 'FIAS';

  constructor(options = {}) {
    const {
      url = 'mongodb://localhost:27017'
    } = options

    this.connection = mongo.connect(url, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    })
      .catch(err => {
        console.error(err)
        process.exit(1)
      })

  }

  async query(){
    const client = await this.connection
    const db = client.db(FIAS.#dbName)

    return db.collection('houses').findOne()
  }

  async getDBParseOptions(){
    const client = await this.connection

    const db = client.db(FIAS.#dbName)

    const queryFabric = st => attr => ({[st]: attr[st]})

    return [
      [
        db.collection('stat'), // коллекия в бд
        { container: 'ActualStatuses', base: 'ActualStatus' }, // имена тегов
        'ACTSTAT', // имя файла
        'ACTSTATID', // айдишник этого тега
      ],
      [
        db.collection('addresses'),
        { container: 'AddressObjects', base: 'Object' },
        'ADDROBJ',
        'AOID',
      ],
      [
        db.collection('centStat'),
        { container: 'CenterStatuses', base: 'CenterStatus' },
        'CENTERST',
        'CENTERSTID',
      ],
      [
        db.collection('curStat'),
        { container: 'CurrentStatuses', base: 'CurrentStatus' },
        'CURENTST',
        'CURENTSTID',
      ],
      [
        db.collection('eStat'),
        { container: 'EstateStatuses', base: 'EstateStatus' },
        'ESTSTAT',
        'ESTSTATID',
      ],
      [
        db.collection('fTypes'),
        { container: 'FlatTypes', base: 'FlatType' },
        'FLATTYPE',
        'FLTYPEID',
      ],
      [
        db.collection('houses'),
        { container: 'Houses', base: 'House' },
        'HOUSE',
        'HOUSEID',
      ],
      [
        db.collection('hStat'),
        { container: 'HouseStateStatuses', base: 'HouseStateStatus' },
        'HSTSTAT',
        'HOUSESTID',
      ],
      [
        db.collection('iStat'),
        { container: 'IntervalStatuses', base: 'IntervalStatus' },
        'INTVSTAT',
        'INTVSTATID',
      ],
      [
        db.collection('nDocTypes'),
        { container: 'NormativeDocumentTypes', base: 'NormativeDocumentType' },
        'NDOCTYPE',
        'NDTYPEID',
      ],
      [
        db.collection('nDoc'),
        { container: 'NormativeDocumentes', base: 'NormativeDocument' },
        'NORMDOC',
        'NORMDOCID',
      ],
      [
        db.collection('oStat'),
        { container: 'OperationStatuses', base: 'OperationStatus' },
        'OPERSTAT',
        'OPERSTATID',
      ],
      [
        db.collection('rooms'),
        { container: 'Rooms', base: 'Room' },
        'ROOM',
        'ROOMID',
      ],
      [
        db.collection('rTypes'),
        { container: 'RoomTypes', base: 'RoomType' },
        'ROOMTYPE',
        'RMTYPEID',
      ],
      [
        db.collection('oTypes'),
        { container: 'AddressObjectTypes', base: 'AddressObjectType' },
        'SOCRBASE',
        'KOD_T_ST',
      ],
      [
        db.collection('steads'),
        { container: 'Steads', base: 'Stead' },
        'STEADS',
        'STEADID',
      ],
      [
        db.collection('sStat'),
        { container: 'StructureStatuses', base: 'StructureStatus' },
        'STRSTAT',
        'STRSTATID',
      ],
    ].map(item => {
      const [collection,,,id] = item
      collection.createIndexes([
        {
          key: { [id]: 1 }
        }
      ])
      item[3] = queryFabric(id)
      return item
    })
  }

  // получить из бд последнюю версию загруженного релиза
  get lastVersionObj() {
    return this.connection
      .then(client => {
        return client.db(FIAS.#dbName)
          .collection('versions')
          .findOne({}, { sort: { id: -1 }})
          .catch(err => {
            console.error('Не удалось получить последнюю версию имеющейся информации')
            process.exit(1)
          })
      })
  }

  // проверить обновления и скачать и распарсить
  async checkUpdate(){
    console.log('Проверка обновлений')
    const {
      id,
      isLoading,
      done,
    } = (await this.lastVersionObj) || {}

    const client = await this.connection
    
    const coll = client
      .db(FIAS.#dbName)
      .collection('versions')
    
    if (!id) {
      const releaseObj = await downloadLastArchive()
      const {
        start,
        ...obj
      } = releaseObj

      try {
        console.log(`Необходима полная загрузка базы данных ${obj.id}`)
        await coll.insertOne({
          ...obj,
          isLoading: true
        })
        
        var releaseObjWithPaths = await start()
        
        releaseObjWithPaths.done = true

        coll.updateOne(obj, { $set: releaseObjWithPaths, $unset: {'isLoading': ''} })
          .catch(err => {
            coll.updateOne(obj, { $set: releaseObjWithPaths, $unset: {'isLoading': ''} })
          })


      } catch (error) {
        console.error(error, 'Ошибка в скачивании базы ФИАС')
        coll.deleteOne(obj)
        return
      }
      console.log('Начата разархивация, она долгая и синхронная, до 15 минут')
      return this.parse(releaseObjWithPaths)
    }

    await checkUpdatesBase(
      id, 
      async releaseObj => {
        console.log(releaseObj)
        return coll.findOne({id: releaseObj.id})
          .then(obj => {
            if (!obj) {
              return coll.insertOne({
                ...releaseObj,
                isLoading: true
              })
            }
            return false
          })
        
      },
      async (err, releaseObj) => {

        if (err) {
          coll.deleteOne(releaseObj)
          console.error(releaseObj, 'Ошибка при скачивании', err)
          return
        }

        await coll.updateOne(releaseObj, { $set: releaseObj })

        return this.parse(releaseObj)
      }
    )

  }

  async checkUpdate2(){
    console.log('Проверка обновлений')
    var {
      id,
    } = (await this.lastVersionObj) || {}

    const client = await this.connection
    
    const verColl = client
      .db(FIAS.#dbName)
      .collection('versions')

    if (!id) {
      const release = await getInfoAboutReleases('last')
      await verColl.insertOne(release)
      var {
        id
      } = release

      var type = 'full'
    }

    const releases = await getInfoAboutReleases()
      .then(rel => rel.filter(({id: _id}) => {
        return id && (+id <= +_id)
      }))

    if (!releases.length) {
      console.log('Обновлений нет')
    }

    for (const item of releases) {
      const {
        id
      } = item

      const fullReleaseObj = await downloadUpdate2(
        item, 
        {
          type,
          beforeAll: async (releaseObj) => {
            const rel = await this.lastVersionObj
            if (rel.isLoaded && rel.isExtracted && rel.isParsed) 
              return 'skip'
          },
          beforeStart: async (releaseObj) => {
            const rel = await this.lastVersionObj
            if (rel.isLoaded)
              return 'skip'
  
            verColl.updateOne({id}, {
              $set: {
                isLoading: true
              }
            })
          },
          startEnd: async () => {
            verColl.updateOne({id}, {
              $set: {
                isLoading: false,
                isLoaded: true,
              }
            })
          },
          beforeExtract: async (releaseObj) => {
            const rel = await this.lastVersionObj
            if (rel.isExtracted)
              return 'skip'
  
            verColl.updateOne({id}, {
              $set: {
                isExtracting: true,
              }
            })
          },
          extractEnd: async () => {
            verColl.updateOne({id}, {
              $set: {
                isExtracting: false,
                isExtracted: true,
              }
            })
          }
        }
      )
        .catch(err => {
          verColl.deleteOne({id})
          throw err
        })

      const {
        dir
      } = fullReleaseObj

      await this.parse(fullReleaseObj, {
        beforeEntry: async (file, filename) => {
          const rel = await this.lastVersionObj
          
          if (rel.parsedEntries && rel.parsedEntries.includes(filename)) {
            unlink(resolve(dir, file.name), err => {
              if (err) {
                console.log('Не удалось удалить файл ' + file.name);
                return
              }
              console.log(`Файл ${filename} удален`);
            })
            return 'skip'
          }
        },
        entryEnd: async (file, filename) => {
          unlink(resolve(dir, file.name), err => {
            if (err) {
              console.log('Не удалось удалить файл ' + file.name);
              return
            }
            console.log(`Файл ${filename} удален`);
          })
          verColl.updateOne({id}, {
            $push: {
              parsedEntries: filename
            }
          })
        }
      })

      rmdir(join(dir, 'Schemas'), { recursive: true }, err => {
        if (err) {
          console.log('Схемы не удалены', err)
          return
        }
        console.assert(err == null, 'Схемы удалены')
      })

      fsp.rmdir(dir)
        .then(() => {
          console.log(`Папка ${dir} удалена`)
        })
        .catch(err => {
          if (err.code === 'ENOTEMPTY') {
            console.error(`Удалить папку ${dir} не удалось так как в ней еще есть файлы`)
          } else {
            console.log(err);
          }
        })
    }

  }

  parse = async (releaseObj, options) => {
    const {
      id,
      dir
    } = releaseObj

  
    await parseFolder(dir, await this.getDBParseOptions(), options)
      .then(() => console.log("Пропарсен " + id))
  }
}
