-- Corrige regressão introduzida em 20260727034935 ("Fixed 9 security issues").
--
-- Aquela migration passou a exigir que o 1º segmento do caminho no bucket
-- `documents` fosse o auth.uid() do usuário. Mas o app SEMPRE grava com prefixo
-- de EMPRESA:
--   useFiscalFiles.ts    -> `${companyId}/fiscal/${ts}.${ext}`
--   useDocumentScanner.ts-> `${company.id}/${transactionId}.${ext}`
--
-- Efeito em produção: nenhum upload novo passa no WITH CHECK e nenhum arquivo
-- já existente pode ser lido (createSignedUrl exige SELECT). Os 6 objetos que
-- estão no bucket têm prefixo de empresa e ficaram inacessíveis.
--
-- A intenção de segurança (arquivo só para quem é dono) é mantida: o acesso
-- passa a ser por MEMBRESIA na empresa dona do arquivo, que é o mesmo critério
-- de todas as tabelas do produto (is_company_member).

-- Cast seguro: nome de pasta que não for uuid vira NULL em vez de estourar
-- erro dentro da policy.
CREATE OR REPLACE FUNCTION public.try_uuid(t text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN t::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.try_uuid(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_uuid(text) TO authenticated;

-- is_company_member(NULL) devolve false, então caminho fora do padrão fica bloqueado.
DROP POLICY IF EXISTS "Company members can read company documents" ON storage.objects;
CREATE POLICY "Company members can read company documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_company_member(public.try_uuid((storage.foldername(name))[1]))
);

DROP POLICY IF EXISTS "Company members can upload company documents" ON storage.objects;
CREATE POLICY "Company members can upload company documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.is_company_member(public.try_uuid((storage.foldername(name))[1]))
);

DROP POLICY IF EXISTS "Company members can update company documents" ON storage.objects;
CREATE POLICY "Company members can update company documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_company_member(public.try_uuid((storage.foldername(name))[1]))
)
WITH CHECK (
  bucket_id = 'documents'
  AND public.is_company_member(public.try_uuid((storage.foldername(name))[1]))
);

DROP POLICY IF EXISTS "Company members can delete company documents" ON storage.objects;
CREATE POLICY "Company members can delete company documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_company_member(public.try_uuid((storage.foldername(name))[1]))
);

-- As policies por prefixo de usuário (auth.uid()) criadas em 20260727034935
-- continuam existindo e são permissivas: somam com estas, não conflitam.
