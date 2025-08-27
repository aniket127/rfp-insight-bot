-- Fix the search function to respect user ownership after RLS security fix
-- The function was bypassing RLS with SECURITY DEFINER but not filtering by user_id

DROP FUNCTION IF EXISTS public.search_documents_by_similarity(vector, double precision, integer);

-- Create updated function that filters by authenticated user
CREATE OR REPLACE FUNCTION public.search_documents_by_similarity(
  query_embedding vector, 
  match_threshold double precision DEFAULT 0.78, 
  match_count integer DEFAULT 5
)
RETURNS TABLE(
  id uuid, 
  title text, 
  type document_type, 
  client text, 
  industry text, 
  geography text, 
  year text, 
  summary text, 
  content text, 
  tags text[], 
  similarity double precision
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    documents.id,
    documents.title,
    documents.type,
    documents.client,
    documents.industry,
    documents.geography,
    documents.year,
    documents.summary,
    documents.content,
    documents.tags,
    1 - (documents.embeddings <=> query_embedding) AS similarity
  FROM public.documents
  WHERE documents.embeddings IS NOT NULL
  AND documents.user_id = auth.uid()  -- Only return documents owned by authenticated user
  AND 1 - (documents.embeddings <=> query_embedding) > match_threshold
  ORDER BY documents.embeddings <=> query_embedding
  LIMIT match_count;
$function$;