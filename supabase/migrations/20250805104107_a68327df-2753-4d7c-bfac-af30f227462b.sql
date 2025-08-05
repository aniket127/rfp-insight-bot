-- Fix security warning: Set search_path for the function
CREATE OR REPLACE FUNCTION public.search_documents_by_similarity(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  type public.document_type,
  client text,
  industry text,
  geography text,
  year text,
  summary text,
  content text,
  tags text[],
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  AND 1 - (documents.embeddings <=> query_embedding) > match_threshold
  ORDER BY documents.embeddings <=> query_embedding
  LIMIT match_count;
$$;