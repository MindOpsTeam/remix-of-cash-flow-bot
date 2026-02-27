

# Criar Storage Bucket + Migration + Corrigir Build Errors

## 1. Corrigir erros de build em edge functions

Duas edge functions passam 3 argumentos para `validateString`, mas a funcao so aceita 2. Para suportar o terceiro argumento (maxLength), a funcao `validateString` em `_shared/validate.ts` sera atualizada:

```text
Antes:
  export function validateString(value: unknown, name: string): string | null {

Depois:
  export function validateString(value: unknown, name: string, maxLength?: number): string | null {
    if (typeof value !== "string" || value.trim().length === 0) {
      return `${name} must be a non-empty string`;
    }
    if (maxLength && value.length > maxLength) {
      return `${name} must be at most ${maxLength} characters`;
    }
    return null;
  }
```

Arquivos afetados:
- `supabase/functions/_shared/validate.ts` (linha 49-54)
- Nenhuma alteracao em `ai-classify` ou `cfo-digital` (eles ja passam o argumento correto)

## 2. Migration SQL

Uma unica migration que:
- Cria o storage bucket `documents` (privado, 10MB, tipos restritos)
- Cria RLS policies de INSERT e SELECT no bucket
- Adiciona coluna `attachment_url TEXT` em `personal_transactions`

```sql
-- Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 'documents', false, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']
);

-- RLS INSERT
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

-- RLS SELECT
CREATE POLICY "Users can read own documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

-- Coluna attachment
ALTER TABLE personal_transactions ADD COLUMN IF NOT EXISTS attachment_url TEXT;
```

## 3. Nenhuma alteracao frontend
Conforme solicitado, nenhum arquivo frontend sera modificado.

