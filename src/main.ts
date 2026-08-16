import { Game } from './Game';

const app = document.getElementById('app');
if (!app) {
  throw new Error('Missing #app element');
}

const game = new Game(app);
game.start();

// Expose for debugging in browser console
(window as any).warlords = game;
