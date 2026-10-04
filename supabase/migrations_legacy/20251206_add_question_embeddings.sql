-- Enable pgvector extension for semantic similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to questions table
-- text-embedding-3-small produces 1536-dimensional vectors
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS stem_embedding vector(1536);

-- Create index for fast cosine similarity search
-- ivfflat index is optimized for approximate nearest neighbor search
-- Using 100 lists (adjust based on table size - rule of thumb: sqrt(rows))
CREATE INDEX IF NOT EXISTS questions_embedding_idx 
ON questions USING ivfflat (stem_embedding vector_cosine_ops)
WITH (lists = 100)
WHERE stem_embedding IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN questions.stem_embedding IS 'OpenAI text-embedding-3-small embedding vector for semantic duplicate detection';


