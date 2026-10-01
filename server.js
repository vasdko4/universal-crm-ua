// Файл запуска для хостингов с Phusion Passenger (и любых хостингов,
// где нужно указать один JS-файл вместо команды `next start`).
// Passenger сам передаёт порт через переменную окружения PORT.
const http = require('http')
const next = require('next')

// BUGFIX: an invalid PORT (e.g. "abc" -> NaN) used to crash the process with
// an obscure ERR_SOCKET_BAD_PORT. Fail fast with a clear message instead.
const rawPort = (process.env.PORT || '3000').trim()
const port = Number.parseInt(rawPort, 10)
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  console.error(`Некорректный PORT: "${process.env.PORT}". Ожидается число 1-65535.`)
  process.exit(1)
}

// BUGFIX: an unhandled rejection anywhere in request handling used to kill
// the process silently. Log it loudly; the process keeps serving (the
// offending request already failed, the rest of the app is unaffected).
process.on('unhandledRejection', (err) => {
  console.error('Необработанное отклонение промиса:', err)
})

const app = next({ dev: false })
const handle = app.getRequestHandler()

app
  .prepare()
  .then(() => {
    // TLS is terminated by Caddy/nginx/Passenger in front. The Node process
    // only listens on loopback / the compose network.
    // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket
    const server = http
      .createServer((req, res) => handle(req, res))
      .listen(port, () => {
        console.log(`Магазин запущен на порту ${port}`)
      })

    // BUGFIX: graceful shutdown. Without this, SIGTERM/SIGINT (redeploys,
    // Passenger restarts) aborted in-flight requests and left pg pool
    // connections dangling.
    let shuttingDown = false
    const shutdown = (signal) => {
      if (shuttingDown) return
      shuttingDown = true
      console.log(`Получен ${signal}, завершаем работу...`)
      server.close(() => {
        console.log('HTTP-сервер остановлен')
        process.exit(0)
      })
      // Don't hang forever on stuck keep-alive connections.
      setTimeout(() => {
        console.error('Принудительное завершение: соединения не закрылись за 10с')
        process.exit(1)
      }, 10_000).unref()
    }
    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  })
  .catch((err) => {
    console.error('Ошибка запуска:', err)
    process.exit(1)
  })
