/**
 * PDF text extraction using pdf2json (no worker; avoids "expression too dynamic" in Next.js).
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const PDFParser = require('pdf2json')
        const parser = new (PDFParser.default ?? PDFParser)(null, 1)

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

export async function POST(request: Request) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        if (!file || file.type !== 'application/pdf') {
            return Response.json({ error: 'Missing or invalid PDF file' }, { status: 400 })
        }
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const text = await extractTextFromPdfBuffer(buffer)

        return Response.json({ text })
    } catch (e) {
        console.error('extract-pdf-text error:', e)
        return Response.json(
            { error: e instanceof Error ? e.message : 'Failed to extract PDF text' },
            { status: 500 }
        )
    }
}
