import { app } from './app';

const port = 3000;

app.listen(port, () =>
  console.log(`[${new Date().toISOString()}] start server[${port}]`)
);