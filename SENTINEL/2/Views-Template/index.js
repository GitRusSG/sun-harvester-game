import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// set up routes
app.use("/static", express.static(path.join(__dirname, "static")))
app.use(routes)

// start the server
app.listen(PORT, () => {
  console.log(`App is listening on ${PORT}`)
})
