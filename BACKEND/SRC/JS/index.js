// Projeto/BACKEND/SRC/JS/index.js
// Arquivo principal do servidor (index.js) //
// Importação de módulos
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Mongo } from '../DB/db.js';
import { config } from 'dotenv';
import authRouter from '../AUTH/auth.js';
import userRouter from '../ROUTES/user.js';
import carRouter from '../ROUTES/car_route.js';
import { authenticateToken } from '../MIDDLEWARE/auth.js';
import feedbackRouter from '../ROUTES/feedback.js';
import { maintenanceGate } from '../MIDDLEWARE/maintenance.js';
import cookieParser from 'cookie-parser';

config(); // Carrega variáveis de ambiente do arquivo .env

// Configurações do servidor
const app = express();
app.use(cookieParser()); // Middleware para parsear cookies
app.use(express.json({ limit: '1mb' })); // Middleware para parsear JSON

// Rota raiz para verificar se a API está funcionando

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        statuscode: 200,
        info: 'API da Garage do Edu',
        body: 'API is running',
        Timestamp: new Date().toISOString()
    });
})

// Chamada de rotas
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowAll = allowedOrigins.includes('*');

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowAll || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
};

app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
);
app.use(cors(corsOptions)); // Middleware para habilitar CORS com as opções definidas

async function main() {
    const hostname = 'localhost';
    const port = process.env.PORT || 3000;

    if (!process.env.MONGO_CS || !process.env.MONGO_DB_NAME) {
        throw new Error('Missing MongoDB environment variables (MONGO_CS, MONGO_DB_NAME).');
    }

    const { db } = await Mongo.connect({
        MongoConnectionString: process.env.MONGO_CS,
        MongodbName: process.env.MONGO_DB_NAME
    });
    app.locals.db = db;

    app.use(maintenanceGate);


    // Rotas PÚBLICAS (sem autenticação)
    app.use('/auth', authRouter);
    app.use('/cars', carRouter);
    app.use('/feedback', feedbackRouter);

    // Rotas PROTEGIDAS (exigem token válido)
    app.use('/user', authenticateToken, userRouter);

    app.use((err, req, res, next) => {
        const statusCode = err?.statusCode || 500;
        if (statusCode >= 500) {
            console.error('Unexpected server error:', err);
        }

        res.status(statusCode).json({
            success: false,
            statusCode,
            message: statusCode >= 500 ? 'Internal server error.' : err.message || 'Request failed.'
        });
    });

    app.listen(port, () => {
        console.log(`Server running at http://${hostname}:${port}/`);
        console.log('Server Start Successfully!');
    });
}

// Chama a função main
main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});