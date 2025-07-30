-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embeddings column to documents table for vector search
ALTER TABLE public.documents 
ADD COLUMN embeddings vector(1536);

-- Create index for vector similarity search (using cosine distance)
CREATE INDEX ON public.documents USING ivfflat (embeddings vector_cosine_ops) WITH (lists = 100);

-- Create function to search documents by vector similarity
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