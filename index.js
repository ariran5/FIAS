import express from 'express'
import FIAS from './FIAS.js'

const {
  MONGO_HOSTNAME = 'localhost',
  MONGO_PORT = 27017
} = process.env

const f = new FIAS({
  url: `mongodb://${MONGO_HOSTNAME}:${MONGO_PORT}`
})

f.checkUpdate2()
  .catch(err => console.error(err))

const port = 1234

const app = express()

app.get('/', (req, res) => {
  res.send('Работает')
})

app.use((req, res) => {
  res.json(f.query())
})

app.listen(port, () => {
  console.log('Запущен на ' + port)
})