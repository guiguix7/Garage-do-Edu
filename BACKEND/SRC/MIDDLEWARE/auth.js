import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { Mongo } from '../DB/db.js';

export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader && authHeader.split(' ')[1];

    const cookieName = process.env.AUTH_COOKIE_NAME || 'garage_session';
    const cookieToken = req.cookies ? req.cookies[cookieName] : null;

    const token = bearerToken || cookieToken;

    if (!token) {
        return res.status(401).json({
            success: false,
            statusCode: 401,
            message: 'Access token required.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await Mongo.db.collection('users').findOne({ _id: new ObjectId(decoded.sub) });

        if (!user) {
            return res.status(401).json({
                statusCode: 401,
                success: false,
                message: 'User not found.'
            });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({
            statusCode: 403,
            success: false,
            message: 'Invalid or expired token.'
        });
    }
};

export const requireRole = (requiredRole) => {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                statusCode: 401,
                message: 'Authentication required.'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: 'Access denied.'
            });
        }

        next();
    };
};