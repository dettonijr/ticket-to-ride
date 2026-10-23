import { createServer, serverConfigFromEnv } from './server';

const { port, host, staticDir } = serverConfigFromEnv(process.env);

const { httpServer } = createServer({ staticDir });
httpServer.listen(port, host, () => {
  console.log(`Railyard listening on http://${host}:${port}, serving ${staticDir}`);
});
