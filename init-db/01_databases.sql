-- ─────────────────────────────────────────────────────────────────────────────
-- SourceDesk homelab database initialisation
--
-- Runs ONCE when the postgres container starts with a fresh volume.
-- Executed as the POSTGRES_USER (sourcedesk), which Docker grants superuser
-- privileges by default.
--
-- Creates:
--   sourcedesk_hindsight  — Hindsight AI memory service database
--   agents                — General-purpose pgvector DB for other agent harnesses
--
-- The main 'sourcedesk' database is already created by the POSTGRES_DB env var.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extra databases ───────────────────────────────────────────────────────────
-- CREATE DATABASE cannot run inside a transaction block; psql autocommit handles this.

CREATE DATABASE sourcedesk_hindsight;
CREATE DATABASE agents;

-- ── Extensions: main sourcedesk database ─────────────────────────────────────
\connect sourcedesk

CREATE EXTENSION IF NOT EXISTS vector;       -- pgvector: vector similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- trigram indexes for fast text search
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- gen_random_uuid() helper

-- ── Extensions: hindsight database ───────────────────────────────────────────
\connect sourcedesk_hindsight

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Extensions + starter schema: agents database ─────────────────────────────
-- This is the general-purpose vector store for your other agent harnesses.
-- Connection string (from mediastack containers):
--   postgres://sourcedesk:<POSTGRES_PASSWORD>@sourcedesk-db:5432/agents
-- Connection string (from the host at 192.168.1.205):
--   postgres://sourcedesk:<POSTGRES_PASSWORD>@192.168.1.205:5432/agents
\connect agents

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Generic memory table — dimensions match OpenAI text-embedding-3-small / ada-002.
-- Adjust 'vector(1536)' to match your embedding model:
--   nomic-embed-text   → vector(768)
--   mxbai-embed-large  → vector(1024)
--   text-embedding-3-large → vector(3072)
CREATE TABLE IF NOT EXISTS agent_memories (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id    TEXT        NOT NULL,               -- identifies which agent owns this memory
    session_id  TEXT,                               -- optional: group memories by conversation
    content     TEXT        NOT NULL,               -- raw text that was embedded
    embedding   vector(1536),                       -- the embedding vector
    metadata    JSONB       NOT NULL DEFAULT '{}',  -- arbitrary agent-specific metadata
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IVFFlat index for approximate nearest-neighbour search (cosine distance).
-- Tune 'lists' after you have data: a good starting value is sqrt(row_count).
-- Rebuild with REINDEX when your data grows significantly.
CREATE INDEX IF NOT EXISTS agent_memories_embedding_idx
    ON agent_memories USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Standard B-tree indexes for filtering / pagination
CREATE INDEX IF NOT EXISTS agent_memories_agent_id_idx   ON agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS agent_memories_session_id_idx ON agent_memories(session_id);
CREATE INDEX IF NOT EXISTS agent_memories_created_at_idx ON agent_memories(created_at DESC);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER agent_memories_updated_at
    BEFORE UPDATE ON agent_memories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
