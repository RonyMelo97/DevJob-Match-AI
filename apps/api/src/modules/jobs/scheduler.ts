import type { AutomationStatus } from '../../../../../packages/contracts/src/index.js';
import type { JobsService } from './service.js';
import type { RunHistory } from './run-history.js';
export interface SchedulerTimers {
    set(callback: () => void, delay: number): unknown;
    clear(handle: unknown): void;
}
const timers: SchedulerTimers = { set: (callback, delay) => { const timer = setTimeout(callback, delay); timer.unref(); return timer; }, clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) };
export class JobsScheduler {
    private enabled = false;
    private requested = false;
    private handle: unknown;
    private current: Promise<void> | null = null;
    private nextCheckAt: string | null = null;
    private lastError: string | null = null;
    constructor(private readonly jobs: JobsService, private readonly history: RunHistory, private readonly clock: () => Date = () => new Date(), private readonly timer: SchedulerTimers = timers) { }
    async start(): Promise<void> { this.requested = true; if (this.enabled)
        return; const runs = await this.history.read(); if (!this.requested || this.enabled)
        return; for (const run of runs)
        if (run.status === 'running' && !this.jobs.isCollecting())
            await this.history.upsert({ ...run, status: 'interrupted', finishedAt: this.clock().toISOString(), message: 'Execução anterior interrompida. A janela persistida de consulta continua válida.' }); if (!this.requested || this.enabled)
        return; this.enabled = true; await this.tick(); }
    private schedule(delay: number): void { if (!this.enabled)
        return; this.nextCheckAt = new Date(this.clock().getTime() + delay).toISOString(); this.handle = this.timer.set(() => { this.handle = undefined; void this.tick(); }, delay); }
    async tick(): Promise<void> { if (!this.enabled)
        return; if (this.current)
        return this.current; if (this.handle !== undefined) {
        this.timer.clear(this.handle);
        this.handle = undefined;
    } this.nextCheckAt = null; this.current = this.cycle().finally(() => { this.current = null; }); return this.current; }
    private async cycle(): Promise<void> { let delay = 60000; try {
        let data = await this.jobs.get();
        if (!this.enabled)
            return;
        if (!data.nextRefreshAt || Date.parse(data.nextRefreshAt) <= this.clock().getTime())
            data = await this.jobs.get(true, 'scheduled');
        this.lastError = null;
        delay = data.nextRefreshAt ? Math.max(1000, Date.parse(data.nextRefreshAt) - this.clock().getTime()) : 60000;
    }
    catch {
        this.lastError = 'Falha na coleta ou no registro. O agendador verificará novamente em um minuto, respeitando o cache.';
    }
    finally {
        this.schedule(delay);
    } }
    async stop(): Promise<void> { this.requested = false; this.enabled = false; if (this.handle !== undefined)
        this.timer.clear(this.handle); this.handle = undefined; this.nextCheckAt = null; if (this.current)
        await this.current; }
    async status(): Promise<AutomationStatus> { return { enabled: this.enabled, running: this.current !== null || this.jobs.isCollecting(), nextCheckAt: this.nextCheckAt, lastError: this.lastError, runs: await this.history.read() }; }
}
