import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { Mongo } from '../DB/db.js';

const getTokenFromRequest = (req) => {
    const authHeader = req.headers['authorization'];
    const cookieName = process.env.AUTH_COOKIE_NAME || 'garage_session';
    const cookieToken = req.cookies ? req.cookies[cookieName] : null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice('Bearer '.length).trim();
    }

    return cookieToken;
};

const sanitizeUser = (user) => {
    if (!user) {
        return null;
    }

    const idSource = user._id ?? user.id ?? user.userId ?? null;
    const userId = typeof idSource?.toString === 'function' ? idSource.toString() : String(idSource || '');

    return {
        userId,
        email: user.email,
        username: user.username,
        role: user.role || 'client'
    };
};

export const authenticateToken = async (req, res, next) => {
    const token = getTokenFromRequest(req);

    if (!token) {
        return res.status(401).json({
            success: false,
            statusCode: 401,
            message: 'Access token required.'
        });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: 'Authentication configuration error.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded?.sub || decoded?.userId || decoded?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                statusCode: 401,
                message: 'Invalid token payload.'
            });
        }

        const user = await Mongo.db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(401).json({
                statusCode: 401,
                success: false,
                message: 'User not found.'
            });
        }

        // Evita expor dados sensiveis no request.
        req.user = sanitizeUser(user);
        next();
    } catch (err) {
        const isExpired = err?.name === 'TokenExpiredError';
        const message = isExpired ? 'Token expired.' : 'Invalid token.';

        return res.status(401).json({
            statusCode: 401,
            success: false,
            message
        });
    }
};

export const checkRole = (...allowedRoles) => {
    const roles = allowedRoles.flat().filter(Boolean).map((role) => String(role).toLowerCase());

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                statusCode: 401,
                message: 'Authentication required.'
            });
        }

        const userRole = String(req.user.role || '').toLowerCase();

        if (!userRole || !roles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: 'Access denied.'
            });
        }

        next();
    };
};

export const requireRole = checkRole;