import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { Mongo } from '../DB/db.js';

const CACHE_TTL_MS = 15000;
let cachedState = null;
let cachedAt = 0;

const getTokenFromRequest = (req) => {
    const authHeader = req.headers['authorization'];
    const cookieName = process.env.AUTH_COOKIE_NAME || 'garage_session';
    const cookieToken = req.cookies ? req.cookies[cookieName] : null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice('Bearer '.length).trim();
    }

    return cookieToken;
};

const isAdminToken = async (req) => {
    const token = getTokenFromRequest(req);
    if (!token || !process.env.JWT_SECRET) {
        return false;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded?.sub || decoded?.userId || decoded?.id;
        const role = decoded?.role;

        if (!userId || role !== 'admin' || !ObjectId.isValid(userId)) {
            return false;
        }

        const user = await Mongo.db.collection('users').findOne({ _id: new ObjectId(userId) });
        return user?.role === 'admin';
    } catch (error) {
        return false;
    }
};

const fetchMaintenanceState = async () => {
    if (cachedState && Date.now() - cachedAt < CACHE_TTL_MS) {
        return cachedState;
    }

    const record = await Mongo.db.collection('system_settings').findOne({ key: 'maintenance' });
    const enabled = Boolean(record?.enabled);
    cachedState = { enabled, updatedAt: record?.updatedAt || null };
    cachedAt = Date.now();
    return cachedState;
};

export const maintenanceGate = async (req, res, next) => {
    if (req.method === 'OPTIONS') {
        return next();
    }

    if (req.path === '/auth/login') {
        return next();
    }

    try {
        const state = await fetchMaintenanceState();
        if (!state.enabled) {
            return next();
        }

        // Admin autenticado pode acessar mesmo em manutencao.
        const isAdmin = await isAdminToken(req);
        if (isAdmin) {
            return next();
        }

        // Nao expor detalhes internos durante manutencao.
        return res.status(503).json({
            success: false,
            statusCode: 503,
            message: 'Maintenance mode enabled. Please try again later.'
        });
    } catch (error) {
        // Falha ao consultar DB: manter resposta generica.
        return res.status(503).json({
            success: false,
            statusCode: 503,
            message: 'Maintenance mode enabled. Please try again later.'
        });
    }
};
