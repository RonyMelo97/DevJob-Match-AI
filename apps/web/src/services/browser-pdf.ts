import { MAX_PDF_BYTES, MAX_RESUME_TEXT, type ResumeDraft } from '@devjob/contracts';
import { extractProfile } from '../../../api/src/modules/resumes/extract-profile';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl;
export async function extractBrowserPdf(file: File): Promise<ResumeDraft> {
    if (!file.name.toLowerCase().endsWith('.pdf') || file.size > MAX_PDF_BYTES)
        throw new Error('Escolha um PDF de até 5 MB.');
    const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, useWorkerFetch: false });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([(async () => {
                const pdf = await task.promise;
                if (pdf.numPages > 20)
                    throw new Error('Limite de 20 páginas.');
                let text = '';
                for (let n = 1; n <= pdf.numPages; n++) {
                    const page = await pdf.getPage(n);
                    const content = await page.getTextContent();
                    text += content.items.map(item => 'str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '').join('') + '\n';
                    page.cleanup();
                    if (text.length > MAX_RESUME_TEXT)
                        throw new Error('Texto excede o limite de 100 mil caracteres.');
                }
                if (!text.trim())
                    throw new Error('PDF sem texto selecionável. OCR não está disponível.');
                return extractProfile(text, pdf.numPages);
            })(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('PDF excedeu o tempo de processamento.')), 30000); })]);
    }
    finally {
        clearTimeout(timer);
        await task.destroy();
    }
}
