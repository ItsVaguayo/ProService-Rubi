// Arranca api y panel en paralelo. Sustituye a "a & b", que en Windows (cmd.exe)
// ejecuta en serie y deja el panel sin arrancar porque la api nunca termina.
import { spawn } from 'node:child_process';

const workspaces = ['api', 'panel'];
const hijos = workspaces.map((ws) =>
  spawn('npm', ['run', 'dev', '--workspace', ws], { stdio: 'inherit', shell: true })
);

const parar = () => hijos.forEach((h) => h.kill());
process.on('SIGINT', parar);
process.on('SIGTERM', parar);

hijos.forEach((h, i) =>
  h.on('exit', (code) => {
    if (code) console.error(`[${workspaces[i]}] terminó con código ${code}`);
  })
);
