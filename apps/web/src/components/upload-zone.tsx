'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadAndParseResume } from '@/lib/actions/candidates'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function UploadZone({ jobId }: { jobId: string }) {
    const [uploading, setUploading] = useState(false)
    const [files, setFiles] = useState<File[]>([])

    const onDrop = useCallback((acceptedFiles: File[]) => {
        setFiles(prev => [...prev, ...acceptedFiles])
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        }
    })

    const handleUpload = async () => {
        setUploading(true)
        let successCount = 0
        let failCount = 0

        for (const file of files) {
            const formData = new FormData()
            formData.append('file', file)

            try {
                await uploadAndParseResume(jobId, formData)
                successCount++
            } catch (error) {
                console.error(error)
                failCount++
                const message = error instanceof Error ? error.message : 'Upload failed'
                toast.error(message, { duration: 6000 })
            }
        }

        setUploading(false)
        setFiles([])
        if (successCount > 0) toast.success(`Processed ${successCount} resumes`)
        if (failCount > 0) toast.error(`Failed to process ${failCount} resume${failCount === 1 ? '' : 's'}`)
    }

    return (
        <div className="w-full space-y-4">
            <div
                {...getRootProps()}
                className={cn(
                    "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors",
                    isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                )}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium">Drag & drop resumes here, or click to select</p>
                    <p className="text-xs text-muted-foreground">PDF or DOCX (Max 5MB)</p>
                </div>
            </div>

            {files.length > 0 && (
                <div className="space-y-2">
                    {files.map((file, i) => (
                        <div key={i} className="flex items-center justify-between p-2 border rounded bg-muted/20">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                        </div>
                    ))}
                    <Button onClick={handleUpload} disabled={uploading} className="w-full">
                        {uploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'Upload and Screen Candidates'
                        )}
                    </Button>
                </div>
            )}
        </div>
    )
}
