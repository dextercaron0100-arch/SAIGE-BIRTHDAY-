import { randomUUID } from 'node:crypto';
import type { Guest, Reply } from '../shared/types';
import type { Repository } from '../server/service';

export class MemoryRepository implements Repository {
  guests: Guest[] = [];
  async create(name: string, token: string) {
    const g: Guest = {
      id: randomUUID(),
      name,
      token,
      status: 'pending',
      message: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.guests.push(g);
    return { ...g };
  }
  async find(token: string) {
    const g = this.guests.find((g) => g.token === token);
    return g ? { ...g } : null;
  }
  async reply(token: string, reply: Reply) {
    const g = this.guests.find((g) => g.token === token);
    if (!g) return null;
    Object.assign(g, reply);
    return { ...g };
  }
  async list() {
    return this.guests.map((g) => ({ ...g }));
  }
  async update(
    id: string,
    changes: Pick<Guest, 'name' | 'status' | 'message'>,
  ) {
    const g = this.guests.find((g) => g.id === id);
    if (!g) return null;
    Object.assign(g, changes);
    return { ...g };
  }
  async remove(id: string) {
    const index = this.guests.findIndex((g) => g.id === id);
    if (index < 0) return false;
    this.guests.splice(index, 1);
    return true;
  }
  async rotate(id: string, token: string) {
    const g = this.guests.find((g) => g.id === id);
    if (!g) return null;
    g.token = token;
    return { ...g };
  }
  async userId(jwt: string) {
    return jwt === 'organizer-session'
      ? 'organizer-id'
      : jwt === 'ordinary-session'
        ? 'ordinary-id'
        : null;
  }
}
