export type EntityId = string;

let nextId = 1;

export function createEntityId(): EntityId {
  return `e_${nextId++}`;
}
