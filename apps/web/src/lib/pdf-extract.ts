/**
 * Shared PDF text extraction (Node). Used by the API route and server actions
 * so we never self-fetch /api/extract-pdf-text from Vercel (avoids wrong URL, timeouts, cold starts).
 */
export function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const PDFParser = require('pdf2json')
        const Parser = PDFParser.default ?? PDFParser
        const parser = new Parser(null, 1)

        parser.on('pdfParser_dataReady', () => {
            try {
                const text = parser.getRawTextContent()
                resolve(text ?? '')
            } catch (e) {
                reject(e)
            }
        })
        parser.on('pdfParser_dataError', (err: { parserError?: unknown }) => {
            reject(err?.parserError ?? new Error('PDF parse error'))
        })

        parser.parseBuffer(buffer, 0)
    })
}
