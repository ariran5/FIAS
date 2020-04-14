import mongo from "mongodb"
import { parseFolder } from './parseFIASDb.js'
import { parse, join } from 'path'

import { downloadLastArchive, checkUpdatesBase } from './fnsAPI.js'

export default class FIAS {
  // Database Name
  static #dbName = 'FIAS';

  constructor(options = {}) {
    const {
      url = 'mongodb://localhost:27017'
    } = options

    this.connection = mongo.connect(url)

  }

  async getDBParseOptions(){
    const client = await this.connection

    const db = client.db(FIAS.#dbName)

    const queryFabric = st => attr => ({[st]: attr[st]})

    return [
      [
        db.collection('stat'),
        { container: 'ActualStatuses', base: 'ActualStatus' },
        'ACTSTAT',
        'ACTSTATID',
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
      item[0].createIndexes([
        {
          key: { [item[3]]: 1 }
        }
      ])
      item[3] = queryFabric(item[3])
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
      isLoading
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

      console.log(`Необходима полная загрузка базы данных ${obj.id}`)
      
      try {
        coll.insertOne({
          ...obj,
          isLoading: true
        })
        
        await start()

        try {
          coll.updateOne(obj, { $set: obj, $unset: {'isLoading': ''} })
        } catch {
          console.error('Не удалось убрать статус загрузки у объекта релиза в коллекции с версиями')
          console.error('Пробую еще раз')
          coll.updateOne(obj, { $set: obj, $unset: {'isLoading': ''} })
            .catch(err => {
              console.error('Да, все-таки не удалось... убрать статус загрузки у объекта релиза в коллекции с версиями', obj)
              throw err
            })
        }

      } catch (error) {
        console.error(error, 'Ошибка в скачивании базы ФИАС')
        coll.deleteOne(obj)
        return
      }
      console.log('Начата разархивация, она долгая и синхронная, до 15 минут')
      return this.parse(obj)
    }

    await checkUpdatesBase(
      id, 
      async releaseObj => {

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
          console.error(releaseObj, 'Ошибка при скачивании')
          return
        }

        await coll.updateOne(releaseObj, { $set: releaseObj })

        return this.parse(releaseObj)
      }
    )

  }

  parse = async (releaseObj) => {
    // разархивирует и парсит поля в базу
    
  
    await parseFolder(join(dir, name), await this.getDBParseOptions())
      .then(() => console.log("Пропарсен " + id))
  }
}
