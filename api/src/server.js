import { abrirDb } from './db.js';
import { crearApp } from './app.js';

const port = process.env.PORT || 3001;
crearApp(abrirDb()).listen(port, () => console.log(`API en http://localhost:${port}`));
