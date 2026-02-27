-- Storage bucket for document scanner
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 'documents', false, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']
);

-- RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

-- RLS: authenticated users can read
CREATE POLICY "Users can read own documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

-- Add attachment column to personal_transactions
ALTER TABLE personal_transactions ADD COLUMN IF NOT EXISTS attachment_url TEXT;