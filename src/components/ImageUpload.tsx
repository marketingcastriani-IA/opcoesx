import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Loader2, X } from 'lucide-react';
import { Leg } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImageUploadProps {
  onLegsExtracted: (legs: Leg[]) => void;
}

export default function ImageUpload({ onLegsExtracted }: ImageUploadProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (imageDataUrl: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-options-image', {
        body: { imageDataUrl },
      });
      if (error) throw error;
      if (data?.legs && data.legs.length > 0) {
        onLegsExtracted(data.legs);
        toast.success(`${data.legs.length} perna(s) extraída(s) da imagem!`);
      } else {
        toast.error('Não foi possível extrair pernas da imagem. Tente novamente ou insira manualmente.');
      }
    } catch (err: any) {
      console.error('OCR error:', err);
      toast.error('Erro ao processar imagem: ' + (err.message || 'Tente novamente'));
    } finally {
      setLoading(false);
    }
  }, [onLegsExtracted]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, envie uma imagem.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result?.startsWith('data:image/')) {
        toast.error('Formato de imagem inválido.');
        return;
      }
      setPreview(result);
      processImage(result);
    };
    reader.readAsDataURL(file);
  }, [processImage]);

  const handleClipboardItems = useCallback((items: DataTransferItemList | undefined | null) => {
    if (!items) return false;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleFile(file);
          return true;
        }
      }
    }
    return false;
  }, [handleFile]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const found = handleClipboardItems(e.clipboardData?.items);
    if (found) e.preventDefault();
  }, [handleClipboardItems]);

  useEffect(() => {
    const onWindowPaste = (e: ClipboardEvent) => {
      const found = handleClipboardItems(e.clipboardData?.items);
      if (found) e.preventDefault();
    };

    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [handleClipboardItems]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <Card
      className="border-dashed border-2 transition-colors hover:border-primary/50 cursor-pointer"
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      onClick={() => !loading && fileInputRef.current?.click()}
      tabIndex={0}
    >
      <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {loading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando imagem com IA...</p>
          </>
        ) : preview ? (
          <>
            <div className="relative">
              <img src={preview} alt="Preview da imagem enviada" className="max-h-32 rounded-lg object-contain" loading="lazy" />
              <button
                type="button"
                className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm hover:bg-destructive/90"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Cole (Ctrl+V), arraste ou clique para substituir</p>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Arraste, clique ou cole (Ctrl+V)</p>
              <p className="text-xs text-muted-foreground">Screenshot da sua plataforma de opções</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

