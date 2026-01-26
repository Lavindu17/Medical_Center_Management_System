
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UploadModalProps {
    requestId: number;
    patientName: string;
    testName: string;
    onSuccess?: () => void;
}

export function UploadModal({ requestId, patientName, testName, onSuccess }: UploadModalProps) {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError('');
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file to upload.');
            return;
        }

        setUploading(true);
        setError('');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('requestId', requestId.toString());

        try {
            const res = await fetch('/api/lab-assistant/upload', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                throw new Error('Upload failed');
            }

            setOpen(false);
            setFile(null);
            if (onSuccess) onSuccess();
            router.refresh();
        } catch (err) {
            console.error(err);
            setError('Failed to upload file. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Result
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Upload Lab Result</DialogTitle>
                    <DialogDescription>
                        Upload result for <strong>{patientName}</strong>'s {testName}.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="file">Report File (PDF/Image)</Label>
                        <Input id="file" type="file" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
                    </div>
                    {file && (
                        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                            <FileText className="h-4 w-4" />
                            <span className="truncate max-w-[200px]">{file.name}</span>
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                            <AlertCircle className="h-4 w-4" />
                            {error}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>
                        Cancel
                    </Button>
                    <Button onClick={handleUpload} disabled={!file || uploading}>
                        {uploading ? 'Uploading...' : 'Confirm Upload'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
