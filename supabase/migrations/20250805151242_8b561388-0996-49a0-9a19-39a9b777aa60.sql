-- Clear all embeddings to start fresh
UPDATE documents SET embeddings = NULL WHERE embeddings IS NOT NULL;