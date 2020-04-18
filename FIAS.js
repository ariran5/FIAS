import mongo from "mongodb"
import { parseFolder } from './parseFIASDb.js'
import { join } from 'path'

import { downloadLastArchive, checkUpdatesBase, downloadUpdate2, getInfoAboutReleases } from './fnsAPI.js'
import { unlink } from 'fs'

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
    await this.connection
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
        'STEAD',
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

  checkUpdate2(){
    console.log('Проверка обновлений')
    let {
      id,
    } = (await this.lastVersionObj) || {}

    const client = await this.connection
    
    const verColl = client
      .db(FIAS.#dbName)
      .collection('versions')

    if (!id) {
      const release = await getInfoAboutReleases('last')
      await verColl.insertOne(release)
      ;({
        id
      }) = release

      var type = 'full'
    }

    const releases = await getInfoAboutReleases()
      .then(rel => rel.filter(({_id}) => id && +id <= +_id))


    for (item of releases) {
      const {
        id
      } = item

      const fullReleaseObj = await downloadUpdate2(
        item, 
        {
          type,
          async beforeAll(releaseObj){
            const rel = await this.lastVersionObj
            if (rel.isLoaded && rel.isExtracted && rel.isParsed) 
              return 'skip'
          },
          async beforeStart(releaseObj){
            const rel = await this.lastVersionObj
            if (rel.isLoaded)
              return 'skip'
  
            verColl.updateOne({id}, {
              $set: {
                isLoading: true
              }
            })
          },
          async startEnd(){
            verColl.updateOne({id}, {
              $set: {
                isLoading: false,
                isLoaded: true,
              }
            })
          },
          async beforeExtract(releaseObj){
            const rel = await this.lastVersionObj
            if (rel.isExtracted)
              return 'skip'
  
            verColl.updateOne({id}, {
              $set: {
                isExtracting: true,
              }
            })
          },
          async extractEnd(){
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

      await this.parse(fullReleaseObj, {
        beforeEntry(file, filename){
          const rel = await this.lastVersionObj
          if (rel.parsedEntries && rel.parsedEntries.includes(filename)) {
            unlink(file.name, err => {
              console.log('Не удалось удалить файл ' + file.name);
            })
            return 'skip'
          }
        },
        entryEnd(file, filename){
          unlink(file.name, err => {
            console.log('Не удалось удалить файл ' + file.name);
          })
          verColl.updateOne({id}, {
            $push: {
              parsedEntries: filename
            }
          })
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
