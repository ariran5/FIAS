import express from 'express'
import FIAS from './FIAS.js'

const f = new FIAS({
  url: `mongodb://${process.env.MONGO_HOSTNAME}:27017`
})

f.checkUpdate()
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