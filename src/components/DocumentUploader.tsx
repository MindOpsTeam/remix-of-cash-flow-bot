import { useCallback, useRef, useState } from "react";
import { Upload, Camera, Loader2, FileText, Files } from "lucide-react";

interface DocumentUploaderProps {
  onFileSelected: (file: File) => void;
  onBatchSelected?: (files: File[]) => void;
  scanning: boolean;
}

const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic,application/pdf";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export function DocumentUploader({ onFileSelected, onBatchSelected, scanning }: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (file.size > MAX_SIZE) {
      return;
    }
    onFileSelected(file);
  }, [onFileSelected]);

  const handleFiles = useCallback((files: File[]) => {
    const valid = files.filter(f => f.size <= MAX_SIZE);
    if (valid.length === 1) {
      onFileSelected(valid[0]);
    } else if (valid.length > 1 && onBatchSelected) {
      onBatchSelected(valid);
    }
  }, [onFileSelected, onBatchSelected]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 1 && onBatchSelected) {
      handleFiles(files);
    } else if (files[0]) {
      handleFile(files[0]);
    }
  }, [handleFile, handleFiles, onBatchSelected]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }, [handleFile]);

  const onBatchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFiles(files);
    if (batchInputRef.current) batchInputRef.current.value = "";
  }, [handleFiles]);

  if (scanning) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-16 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-sm font-medium text-foreground">Analisando documento...</p>
        <p className="text-xs text-muted-foreground mt-1">Extraindo dados com IA</p>
      </div>
    );
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 text-center cursor-pointer transition-all duration-150 ${
        dragOver
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        capture="environment"
        onChange={onChange}
        className="hidden"
      />
      <input
        ref={batchInputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        onChange={onBatchChange}
        className="hidden"
      />
      <div className="flex items-center gap-3 mb-4">
        <div className="h-12 w-12 rounded-full flex items-center justify-center bg-primary/10 text-primary">
          <FileText className="h-6 w-6" />
        </div>
      </div>
      <p className="text-sm font-medium text-foreground">
        Arraste um documento ou clique para selecionar
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Boletos, notas fiscais, cupons, recibos, comprovantes PIX
      </p>
      <div className="flex items-center gap-3 mt-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
          <Upload className="h-3.5 w-3.5" /> Upload
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
          <Camera className="h-3.5 w-3.5" /> Câmera
        </span>
        {onBatchSelected && (
          <span
            onClick={(e) => { e.stopPropagation(); batchInputRef.current?.click(); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full hover:bg-muted/80 cursor-pointer"
          >
            <Files className="h-3.5 w-3.5" /> Lote
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mt-3">JPG, PNG, WebP, PDF — até 10 MB</p>
    </div>
  );
}
