/**
 * PDF text extraction — thin HTTP wrapper; server actions import @/lib/pdf-extract directly.
 */
import { extractTextFromPdfBuffer } from '@/lib/pdf-extract'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
