import * as THREE from 'three';
import { Renderer } from './Renderer';
import { Simulation } from '../core/Simulation';
import { EntityId } from '../core/types';
import type { Game } from '../Game';

// Temporary stub. Full InputManager with edge scroll, attack-move (A), tower (Y), market (M/U/I) will be restored immediately.
export class InputManager {
  constructor(private renderer: Renderer, private sim: Simulation, private game: Game) {}
  update(_dt: number) {}
  setEnabled(_v: boolean) {}
}
