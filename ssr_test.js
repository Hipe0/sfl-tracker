import { createServer } from 'vite';
import fs from 'fs';

async function run() {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });
  
  try {
    const App = await vite.ssrLoadModule('/src/App.jsx');
    console.log('App loaded successfully via Vite SSR');
    vite.close();
  } catch (e) {
    console.error('SSR Error:', e);
    vite.close();
  }
}
run();
