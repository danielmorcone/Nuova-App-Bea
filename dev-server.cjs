// Server locale senza dipendenze per provare App Bea su PC e rete Wi-Fi.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const projectFolder = __dirname;
const portInfoFile = path.join(os.tmpdir(), 'app-bea-dev-server.json');
let activePort = 8000;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((request, response) => {
  // Solo strumenti di sviluppo: nessuna dipendenza e nessuna modifica agli HTML su disco.
  if (request.method === 'GET' && request.url === '/__app-bea-changes__') {
    const files = {};
    function scan(folder) {
      for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
        const fullPath = path.join(folder, item.name);
        if (item.isDirectory()) scan(fullPath);
        else {
          const stats = fs.statSync(fullPath);
          files[path.relative(projectFolder, fullPath).replace(/\\/g, '/')] = `${stats.mtimeMs}-${stats.size}`;
        }
      }
    }
    try {
      scan(path.join(projectFolder, 'assets'));
      scan(path.join(projectFolder, 'pages'));
      for (const file of ['index.html', 'manifest.json']) {
        const stats = fs.statSync(path.join(projectFolder, file));
        files[file] = `${stats.mtimeMs}-${stats.size}`;
      }
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(files));
    } catch {
      // Un salvataggio atomico dell'editor può rendere un file momentaneamente assente.
      response.writeHead(503, { 'Cache-Control': 'no-store' });
      response.end();
    }
    return;
  }
  if (request.method === 'POST' && request.url === '/__stop-app-bea__') {
    const remoteAddress = request.socket.remoteAddress;
    const isLocalRequest = remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1';

    if (!isLocalRequest) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Il comando di arresto è disponibile solo sul PC che esegue il server.');
      return;
    }

    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Arresto del server App Bea.');
    setImmediate(() => server.close(() => console.log('Server App Bea arrestato.')));
    return;
  }

  let requestedPath;

  try {
    requestedPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Indirizzo non valido.');
    return;
  }

  const relativePath = requestedPath.replace(/^\/+/, '');
  let filePath = path.resolve(projectFolder, relativePath || '.');
  const pathFromProject = path.relative(projectFolder, filePath);

  if (pathFromProject === '..' || pathFromProject.startsWith(`..${path.sep}`) || path.isAbsolute(pathFromProject)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Accesso non consentito.');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(`File non trovato. Apri http://localhost:${activePort}/`);
      return;
    }

    if (stats.isDirectory()) filePath = path.join(filePath, 'index.html');

    fs.stat(filePath, (fileError, fileStats) => {
      if (fileError || !fileStats.isFile()) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(`File non trovato. Apri http://localhost:${activePort}/`);
        return;
      }

      const contentType = contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      if (contentType.startsWith('text/html')) {
        fs.readFile(filePath, 'utf8', (readError, source) => {
          if (readError) { response.writeHead(500); response.end(); return; }
          const html = source.replace(/<\/body>/i, '<script src="/dev-client.js" defer></script></body>');
          response.writeHead(200, { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(html), 'Cache-Control': 'no-store' });
          response.end(html);
        });
        return;
      }
      const rangeHeader = request.headers.range;
      const rangeMatch = rangeHeader && /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);

      if (contentType === 'video/mp4' && rangeMatch) {
        const hasStart = rangeMatch[1] !== '';
        const hasEnd = rangeMatch[2] !== '';
        const start = hasStart ? Number(rangeMatch[1]) : Math.max(0, fileStats.size - Number(rangeMatch[2]));
        const end = hasEnd && hasStart
          ? Math.min(Number(rangeMatch[2]), fileStats.size - 1)
          : fileStats.size - 1;

        if ((!hasStart && !hasEnd) || start >= fileStats.size || end < start) {
          response.writeHead(416, { 'Content-Range': `bytes */${fileStats.size}` });
          response.end();
          return;
        }

        response.writeHead(206, {
          'Content-Type': contentType,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${fileStats.size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store'
        });
        fs.createReadStream(filePath, { start, end }).pipe(response);
        return;
      }

      response.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': fileStats.size,
        ...(contentType === 'video/mp4' ? { 'Accept-Ranges': 'bytes' } : {}),
        'Cache-Control': 'no-store'
      });
      fs.createReadStream(filePath).pipe(response);
    });
  });
});

server.on('close', () => {
  try {
    const info = JSON.parse(fs.readFileSync(portInfoFile, 'utf8'));
    if (info.pid === process.pid) fs.unlinkSync(portInfoFile);
  } catch {
    // Il file può essere già stato rimosso o non essere mai stato creato.
  }
});

function startServer(portToTry) {
  const reportStarted = () => {
    activePort = portToTry;
    fs.writeFileSync(portInfoFile, JSON.stringify({ port: activePort, pid: process.pid }));
    console.log(`App Bea disponibile sul PC: http://localhost:${activePort}/`);
    console.log('Per fermare il server, fai doppio clic su Ferma-App-Bea.bat.');

    for (const addresses of Object.values(os.networkInterfaces())) {
      for (const address of addresses || []) {
        if (address.family === 'IPv4' && !address.internal) {
          console.log(`Per provarla su un telefono nella stessa Wi-Fi: http://${address.address}:${activePort}/`);
        }
      }
    }
  };

  server.once('error', error => {
    server.removeListener('listening', reportStarted);
    if (error.code === 'EADDRINUSE' && portToTry < 8010) {
      console.log(`La porta ${portToTry} è occupata; provo la ${portToTry + 1}.`);
      startServer(portToTry + 1);
      return;
    }

    console.error(`Impossibile avviare il server: ${error.message}`);
    process.exitCode = 1;
  });

  server.once('listening', reportStarted);
  server.listen(portToTry, '0.0.0.0');
}

startServer(activePort);
