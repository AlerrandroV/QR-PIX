const { createServer } = require("http");
const { readFile } = require("fs").promises;
const path = require("path");

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
};

const server = createServer(async (req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 Not Found</h1>', 'utf-8');
    } else {
      console.error("Erro ao ler o arquivo:", error);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<h1>500 Internal Server Error</h1>', 'utf-8');
    }
  }
});

server.listen(2007, "localhost", () => {
  console.log(`Servidor rodando na porta 2007!`);
});

server.on("error", (error) => {
  console.error("Erro no servidor:", error);
});
