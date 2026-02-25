import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Mongo } from '../DB/db.js';
import { authenticateToken } from '../MIDDLEWARE/auth.js';
import { validateBody } from '../MIDDLEWARE/validate.js';
import { writeAuditLog } from '../HELPERS/audit.js';

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

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        statuscode: 429,
        message: 'Too many login attempts. Please try again later.'
    }
});

const loginSchema = z.object({
    email: z.string().trim().min(3).email(),
    password: z.string().min(8)
});

const registerSchema = z.object({
    username: z.string().trim().min(2).max(40),
    email: z.string().trim().min(3).email(),
    password: z.string().min(8)
});

const createToken = (user) =>
    jwt.sign(
        {
            sub: user._id.toString(),
            email: user.email,
            role: user.role || 'client'
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

const normalizeEmail = (email) => email.trim().toLowerCase();
const normalizeUsername = (username) => username.trim();

// ROTA DE REGISTRO
const handleRegister = async (req, res) => {
    const { username, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedUsername = normalizeUsername(username);

    try {
        // Verificar se já existe
        const existing = await Mongo.db.collection(collectionName).findOne({
            $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
        });
        if (existing) {
            return res.status(409).json({ success: false, statuscode: 409, message: 'Username or email already in use.' });
        }

        // Criar hash da senha
        const hashedPassword = await bcrypt.hash(password, 12);

        // Inserir usuário
        const result = await Mongo.db.collection(collectionName).insertOne({
            username: normalizedUsername,
            email: normalizedEmail,
            password: hashedPassword,
            role: 'client',
            createdAt: new Date(),
        });

        // Gerar token (sem dados sensíveis!)
        const token = createToken({
            _id: result.insertedId,
            email: normalizedEmail,
            role: 'client'
        });

        sendAuthResponse(res, 201, {
            success: true,
            message: 'User created successfully.',
            statuscode: 201,
            token,
            user: sanitizeUser({
                _id: result.insertedId,
                username: normalizedUsername,
                email: normalizedEmail,
                role: 'client'
            })
        });

        void writeAuditLog({
            action: 'user_register',
            actorId: result.insertedId.toString(),
            actorRole: 'client',
            targetId: result.insertedId.toString(),
            req
        });

    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({
            success: false,
            statuscode: 500,
            message: 'Internal server error.'
        });
    }
};

router.post('/register', validateBody(registerSchema), handleRegister);
router.post('/signup', validateBody(registerSchema), handleRegister);

// ROTA DE LOGIN
router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    try {
        const user = await Mongo.db.collection(collectionName).findOne({ email: normalizedEmail });
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

        const token = createToken(user);

        sendAuthResponse(res, 200, {
            success: true,
            message: 'Authentication succeeded.',
            token,
            statuscode: 200,
            user: sanitizeUser(user)
        });

        void writeAuditLog({
            action: 'user_login',
            actorId: user._id.toString(),
            actorRole: user.role || 'client',
            targetId: user._id.toString(),
            req
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

const handleSession = (req, res) => {
    const safeUser = sanitizeUser(req.user);
    return res.status(200).json({
        success: true,
        statuscode: 200,
        user: safeUser
    });
};

router.get('/me', authenticateToken, handleSession);
router.get('/session', authenticateToken, handleSession);

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