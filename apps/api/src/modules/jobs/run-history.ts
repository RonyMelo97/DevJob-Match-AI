import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { jobRunSchema, type JobRun, type Job } from '../../../../../packages/contracts/src/index.js';
export interface RunHistory {
    read(): Promise<JobRun[]>;
    upsert(run: JobRun): Promise<void>;
}
export class FileRunHistory implements RunHistory {
    private pending: Promise<void> = Promise.resolve();
    constructor(private readonly path: string) { }
    private async load(): Promise<JobRun[]> { try {
        return z.array(jobRunSchema).max(20).parse(JSON.parse(await readFile(this.path, 'utf8')) as unknown);
    }
    catch (error: unknown) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
            return [];
        throw error;
    } }
    async read(): Promise<JobRun[]> { await this.pending; return this.load(); }
    upsert(run: JobRun): Promise<void> { const operation = this.pending.then(async () => { const runs = [jobRunSchema.parse(run), ...(await this.load()).filter((item) => item.id !== run.id)].slice(0, 20); await mkdir(dirname(this.path), { recursive: true }); await writeFile(`${this.path}.tmp`, JSON.stringify(runs)); await rename(`${this.path}.tmp`, this.path); }); this.pending = operation.catch(() => undefined); return operation; }
}
export function snapshotChanges(previous: Job[], next: Job[]): {
    added: number;
    updated: number;
    removed: number;
    unchanged: number;
} { const before = new Map(previous.map((job) => [job.id, job])); const after = new Map(next.map((job) => [job.id, job])); let added = 0, updated = 0, unchanged = 0; for (const [id, job] of after) {
    const old = before.get(id);
    if (!old)
        added++;
    else if (JSON.stringify(old) !== JSON.stringify(job))
        updated++;
    else
        unchanged++;
} return { added, updated, unchanged, removed: [...before.keys()].filter((id) => !after.has(id)).length }; }
