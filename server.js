// Файл запуска для хостингов с Phusion Passenger (и любых хостингов,
// где нужно указать один JS-файл вместо команды `next start`).
// Passenger сам передаёт порт через переменную окружения PORT.
const http = require('http')
const next = require('next')

const port = Number.parseInt(process.env.PORT || '3000', 10)
const app = next({ dev: false })
const handle = app.getRequestHandler()

app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => handle(req, res))
      .listen(port, () => {
        console.log(`Магазин запущен на порту ${port}`)
      })
  })
  .catch((err) => {
    console.error('Ошибка запуска:', err)
    process.exit(1)
  })
