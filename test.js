import * as fiasAPI from './fnsAPI.js'
import { parseFolder } from './parseFIASDb.js'

import { parse, join } from 'path'

// fiasAPI.getInfoAboutReleases()
//   .then(arr => console.log(arr))
//   .catch(console.log)


// fiasAPI.checkDirForFiles('123')


// fiasAPI.downloadLastArchive()
//   .then(() => {
//     console.log("Успешно")
//   })
//   .catch(err => {
//     console.log('Какое-то дерьмо')
//     console.error(err)
//   })

// fiasAPI.checkUpdatesBase(600, async ({
//   id,
//   filename,
//   localPath
// }) => {
//   const {
//     dir,
//     name
//   } = parse(localPath)
//   unrar(localPath, join(dir, name))
// })

import FIAS from './index.js'
const f = new FIAS()

f.checkUpdate()
  .catch(err => console.error(err))


// fiasAPI.getInfoAboutReleases('last')
//   .then(release => {

//     fiasAPI.downloadUpdate()
//       .then(q => q.start())
//       .then(console.log)
//   })

// f.getDBParseOptions()
//   .then(arr => {
//     parseFolder('./rawFIASXMLFiles/605/', arr)
//   })