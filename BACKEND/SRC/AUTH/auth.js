import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import { Mongo } from '../DB/db.js';
import { authenticateToken } from '../MIDDLEWARE/auth.js';

config(); // ensure JWT_SECRET is loaded before runtime checks

const router = express.Router();
const collectionName = 'users';
const cookieName = process.env.AUTH_COOKIE_NAME || 'garage_session';

const sanitizeUser = (user) => {
    if (!user) {
        return null;
    }

    const idSource = user._id ?? user.id ?? null;
    let id = null;

    if (typeof idSource === 'string') {
        id = idSource;
    } else if (idSource && typeof idSource === 'object' && typeof idSource.toString === 'function') {
        id = idSource.toString();
    }

    return {
        id,
        username: user.username,
        email: user.email,
        role: user.role ?? 'client'
    };
};

const getCookieOptions = () => {
    const maxAge = Number(process.env.AUTH_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000);
    const secureFlag = String(process.env.AUTH_COOKIE_SECURE || '').toLowerCase() === 'true';
    const sameSiteRaw = String(process.env.AUTH_COOKIE_SAMESITE || 'lax').toLowerCase();
    const sameSite = ['lax', 'strict', 'none'].includes(sameSiteRaw) ? sameSiteRaw : 'lax';

    const options = {
        httpOnly: true,
        secure: secureFlag,
        sameSite,
        maxAge
    };

    if (process.env.AUTH_COOKIE_DOMAIN) {
        options.domain = process.env.AUTH_COOKIE_DOMAIN;
    }

    if (process.env.AUTH_COOKIE_PATH) {
        options.path = process.env.AUTH_COOKIE_PATH;
    }

    return options;
};

const sendAuthResponse = (res, statusCode, payload) => {
    if (payload?.token) {
        res.cookie(cookieName, payload.token, getCookieOptions());
    }
    return res.status(statusCode).json(payload);
};

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in environment variables!');
}

// Helper: validar email (básico)
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ROTA DE REGISTRO
router.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;

    // Validação
    if (!username || !email || !password) {
        return res.status(400).json({ success: false, statuscode: 400, message: 'Username, email and password are required.' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, statuscode: 400, message: 'Invalid email format.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ success: false, statuscode: 400, message: 'Password must be at least 8 characters.' });
    }

    try {
        // Verificar se já existe
        const existing = await Mongo.db.collection(collectionName).findOne({
            $or: [{ email }, { username }]
        });
        if (existing) {
            return res.status(409).json({ success: false, statuscode: 409, message: 'Username or email already in use.' });
        }

        // Criar hash da senha
        const hashedPassword = await bcrypt.hash(password, 12);

        // Inserir usuário
        const result = await Mongo.db.collection(collectionName).insertOne({
            username,
            email,
            password: hashedPassword,
            role: 'client',
            createdAt: new Date(),
        });

        // Gerar token (sem dados sensíveis!)
        const token = jwt.sign(
            { sub: result.insertedId.toString(), email, username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        sendAuthResponse(res, 201, {
            success: true,
            message: 'User created successfully.',
            statuscode: 201,
            token,
            user: sanitizeUser({
                _id: result.insertedId,
                username,
                email,
                role: 'client'
            })
        });

    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({
            success: false,
            statuscode: 500,
            message: 'Internal server error.'
        });
    }
});

// ROTA DE LOGIN
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            statuscode: 400,
            message: 'Email and password are required.'
        });
    }

    try {
        const user = await Mongo.db.collection(collectionName).findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                statuscode: 401,
                message: 'Invalid email or password.'
            });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                statuscode: 401,
                message: 'Invalid email or password.'
            });
        }

        const token = jwt.sign(
            { sub: user._id.toString(), email: user.email, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        sendAuthResponse(res, 200, {
            success: true,
            message: 'Authentication succeeded.',
            token,
            statuscode: 200,
            user: sanitizeUser(user)
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

router.get('/session', authenticateToken, (req, res) => {
    const safeUser = sanitizeUser(req.user);
    return res.status(200).json({
        success: true,
        statuscode: 200,
        user: safeUser
    });
});

router.post('/logout', (req, res) => {
    const cookieOptions = getCookieOptions();
    res.clearCookie(cookieName, { ...cookieOptions, maxAge: 0 });
    return res.status(200).json({
        success: true,
        statuscode: 200,
        message: 'Logout successful.'
    });
});

export default router;