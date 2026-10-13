import { createPublicApi } from './public-api';
export const PUBLIC_MODE = import.meta.env.VITE_PUBLIC_MODE === 'true';
const publicApi = createPublicApi(async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}jobs.json`, { cache: 'no-cache' });
    if (!response.ok)
        throw new Error('Não foi possível carregar as vagas públicas.');
    return response.json() as Promise<unknown>;
}, async (file) => { const { extractBrowserPdf } = await import('./browser-pdf'); return extractBrowserPdf(file); });
export const apiFetch = (path: string, init?: RequestInit): Promise<Response> => PUBLIC_MODE ? publicApi(path, init) : fetch(path, init);
