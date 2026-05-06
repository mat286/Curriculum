import crypto from 'crypto';
import { pool } from '../config/db.js';
import logger from '../utils/logger.js';

function toPositiveInt(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export class EmbeddingMetadataRepository {
    constructor() {
        this.tableAvailability = new Map();
        this.tableColumns = new Map();
    }

    async tableExists(tableName) {
        if (this.tableAvailability.has(tableName)) {
            return this.tableAvailability.get(tableName);
        }

        try {
            const [rows] = await pool.query(
                `SELECT 1 AS ok
                 FROM information_schema.tables
                 WHERE table_schema = DATABASE() AND table_name = ?
                 LIMIT 1`,
                [tableName],
            );
            const exists = rows.length > 0;
            this.tableAvailability.set(tableName, exists);
            return exists;
        } catch (error) {
            logger.warn({ err: error, tableName }, 'No se pudo verificar existencia de tabla de embeddings');
            return false;
        }
    }

    async getTableColumns(tableName) {
        if (this.tableColumns.has(tableName)) {
            return this.tableColumns.get(tableName);
        }

        try {
            const [rows] = await pool.query(
                `SELECT column_name
                 FROM information_schema.columns
                 WHERE table_schema = DATABASE() AND table_name = ?`,
                [tableName],
            );
            const columns = new Set(rows.map((r) => r.column_name));
            this.tableColumns.set(tableName, columns);
            return columns;
        } catch (error) {
            logger.warn({ err: error, tableName }, 'No se pudieron leer columnas de tabla de embeddings');
            return new Set();
        }
    }

    async upsertDocumentsMetadata(candidateId, docsMetadata = []) {
        if (!Array.isArray(docsMetadata) || docsMetadata.length === 0) {
            return { upserted: 0, skipped: true };
        }
        if (!await this.tableExists('embedding_documents')) {
            return { upserted: 0, skipped: true };
        }

        const columns = await this.getTableColumns('embedding_documents');
        const hasNewSchema = columns.has('doc_id') && columns.has('doc_type') && columns.has('char_count');
        const hasLegacySchema = columns.has('doc_key') && columns.has('section_type') && columns.has('token_estimate');

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            for (const doc of docsMetadata) {
                if (hasNewSchema) {
                    const sql = `INSERT INTO embedding_documents
                        (candidate_id, doc_id, doc_type, embedding_domain, content_hash, char_count, is_active, last_indexed_at)
                        VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
                        ON DUPLICATE KEY UPDATE
                            doc_type = VALUES(doc_type),
                            embedding_domain = VALUES(embedding_domain),
                            content_hash = VALUES(content_hash),
                            char_count = VALUES(char_count),
                            is_active = 1,
                            last_indexed_at = CURRENT_TIMESTAMP`;

                    await conn.query(sql, [
                        candidateId,
                        String(doc.docId || ''),
                        doc.docType || null,
                        doc.embeddingDomain || null,
                        String(doc.contentHash || ''),
                        toPositiveInt(doc.charCount, 0),
                    ]);
                    continue;
                }

                if (hasLegacySchema) {
                    const sql = `INSERT INTO embedding_documents
                        (candidate_id, doc_key, section_type, source_table, source_row_id, content_hash, content_preview,
                         token_estimate, embedding_model, embedding_provider, collection_name, chroma_doc_id, indexed_at, is_active)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
                        ON DUPLICATE KEY UPDATE
                            section_type = VALUES(section_type),
                            source_table = VALUES(source_table),
                            source_row_id = VALUES(source_row_id),
                            content_hash = VALUES(content_hash),
                            content_preview = VALUES(content_preview),
                            token_estimate = VALUES(token_estimate),
                            embedding_model = VALUES(embedding_model),
                            embedding_provider = VALUES(embedding_provider),
                            collection_name = VALUES(collection_name),
                            chroma_doc_id = VALUES(chroma_doc_id),
                            indexed_at = CURRENT_TIMESTAMP,
                            is_active = 1,
                            updated_at = CURRENT_TIMESTAMP`;

                    await conn.query(sql, [
                        candidateId,
                        String(doc.docId || ''),
                        doc.docType || 'unknown',
                        doc.sourceTable || 'profile_compiled',
                        doc.sourceRowId ?? null,
                        String(doc.contentHash || ''),
                        String(doc.contentPreview || '').slice(0, 512),
                        toPositiveInt(doc.tokenEstimate ?? doc.charCount, 0),
                        doc.embeddingModel || process.env.EMBEDDING_MODEL || 'nomic-embed-text',
                        doc.embeddingProvider || process.env.AI_PROVIDER || 'ollama',
                        doc.collectionName || `user_${candidateId}_cv`,
                        doc.chromaDocId || String(doc.docId || ''),
                    ]);
                }
            }

            await conn.commit();
            return { upserted: docsMetadata.length, skipped: false };
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async markCandidateDocsInactive(candidateId) {
        if (!await this.tableExists('embedding_documents')) {
            return { affectedRows: 0, skipped: true };
        }

        const [result] = await pool.query(
            `UPDATE embedding_documents
             SET is_active = 0, updated_at = CURRENT_TIMESTAMP
             WHERE candidate_id = ? AND is_active = 1`,
            [candidateId],
        );

        return { affectedRows: result.affectedRows || 0, skipped: false };
    }

    async enqueueReindexJob(candidateId, reason, payload = null) {
        if (!await this.tableExists('embedding_index_jobs')) {
            return { enqueued: false, skipped: true };
        }

        const [result] = await pool.query(
            `INSERT INTO embedding_index_jobs (candidate_id, reason, payload_json, status)
             VALUES (?, ?, ?, 'pending')`,
            [candidateId, reason || 'manual', payload ? JSON.stringify(payload) : null],
        );

        return { enqueued: true, jobId: result.insertId, skipped: false };
    }

    async recordQueryTelemetry({
        requestId = null,
        candidateId = null,
        method = 'semantic',
        query = '',
        topK = 3,
        hits = 0,
        durationMs = 0,
    }) {
        if (!await this.tableExists('embedding_query_telemetry')) {
            return { recorded: false, skipped: true };
        }

        const columns = await this.getTableColumns('embedding_query_telemetry');
        const hitColumn = columns.has('hits') ? 'hits' : 'hit_count';

        const queryHash = crypto.createHash('sha256').update(String(query || '')).digest('hex');
        const safeRequestId = requestId || `emb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const safeCandidateId = Number.isFinite(candidateId) ? candidateId : 0;

        await pool.query(
            `INSERT INTO embedding_query_telemetry
                (request_id, candidate_id, method, query_hash, top_k, ${hitColumn}, duration_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                safeRequestId,
                safeCandidateId,
                String(method || 'semantic').slice(0, 32),
                queryHash,
                toPositiveInt(topK, 3),
                toPositiveInt(hits, 0),
                toPositiveInt(durationMs, 0),
            ],
        );

        return { recorded: true, skipped: false };
    }

    // Compatibilidad con nombres previos
    async deactivateCandidateDocuments(candidateId) {
        const result = await this.markCandidateDocsInactive(candidateId);
        return result.affectedRows;
    }

    async enqueueIndexJob({ candidateId, reason, payload = null }) {
        const result = await this.enqueueReindexJob(candidateId, reason, payload);
        return result.jobId || null;
    }

    async trackQueryTelemetry({ requestId, candidateId, topK, method, durationMs, hitCount, query }) {
        return this.recordQueryTelemetry({
            requestId,
            candidateId,
            query,
            topK,
            method,
            durationMs,
            hits: hitCount,
        });
    }
}

export const embeddingMetadataRepository = new EmbeddingMetadataRepository();
