import { PDFParse } from 'pdf-parse';

process.once('message', (message: unknown) => {
  async function run(): Promise<void> {
    if (!Buffer.isBuffer(message)) throw new Error('Invalid PDF input');
    const parser = new PDFParse({ data: new Uint8Array(message), isEvalSupported: false });
    try {
      const info = await parser.getInfo();
      if (info.total < 1 || info.total > 20) {
        process.send?.({ error: 'Envie um currículo com até 20 páginas.' }); return;
      }
      const result = await parser.getText();
      const text = result.text.replace(/--\s*\d+ of \d+\s*--/g, '').trim();
      if (text.length < 20) {
        process.send?.({ error: 'PDF sem texto suficiente. PDFs digitalizados precisam de OCR; envie uma versão com texto selecionável.' }); return;
      }
      if (text.length > 100_000) { process.send?.({ error: 'O texto do currículo excede o limite de 100.000 caracteres.' }); return; }
      process.send?.({ text, pages: info.total });
    } finally { await parser.destroy(); }
  }
  void run().catch(() => process.send?.({ error: 'Não foi possível ler o PDF. Verifique se está íntegro e sem senha.' }));
});
