import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { savedProfileSchema, type SavedProfile } from '../../../../../packages/contracts/src/index.js';

export interface ProfileRepository {
  get(): Promise<SavedProfile | null>;
  save(profile: SavedProfile): Promise<void>;
  delete(): Promise<void>;
}
function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
export class FileProfileRepository implements ProfileRepository {
  private readonly path: string;
  private pending: Promise<void> = Promise.resolve();
  constructor(private readonly directory: string) { this.path = join(directory, 'profile.json'); }
  async get(): Promise<SavedProfile | null> {
    await this.pending;
    try { return savedProfileSchema.parse(JSON.parse(await readFile(this.path, 'utf8')) as unknown); }
    catch (error: unknown) { if (isMissing(error)) return null; throw error; }
  }
  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.pending.then(operation);
    this.pending = result.catch(() => undefined);
    return result;
  }
  save(profile: SavedProfile): Promise<void> {
    return this.enqueue(async () => {
      await mkdir(this.directory, { recursive: true });
      const temporary = join(this.directory, `${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, JSON.stringify(savedProfileSchema.parse(profile)), { mode: 0o600 });
        await rename(temporary, this.path);
      } finally { await rm(temporary, { force: true }); }
    });
  }
  delete(): Promise<void> { return this.enqueue(() => rm(this.path, { force: true })); }
}
