import { Mongo } from '../DB/db.js';

export const writeAuditLog = async ({
    action,
    actorId = null,
    actorRole = null,
    targetId = null,
    meta = {},
    req
}) => {
    try {
        const payload = {
            action,
            actorId,
            actorRole,
            targetId,
            meta,
            ip: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            path: req?.originalUrl || req?.url || null,
            method: req?.method || null,
            createdAt: new Date()
        };

        await Mongo.db.collection('audit_logs').insertOne(payload);
    } catch (error) {
        console.warn('Falha ao registrar audit log:', error?.message || error);
    }
};
