const { createServer } = require('./server');

const port = Number.parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '127.0.0.1';

const server = createServer();

server.listen(port, host, () => {
  console.log(`DevOps Task Board listening at http://${host}:${port}`);
});
