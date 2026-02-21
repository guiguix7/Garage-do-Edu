// Arquivo principal do servidor (index.js) //
// Importação de módulos
import express from 'express';
import cors from 'cors';
import { Mongo } from '../DB/db.js';
import { config } from 'dotenv';
import authRouter from '../AUTH/auth.js';
import userRouter from '../ROUTES/user.js';
import carRouter from '../ROUTES/car_route.js';
import { authenticateToken } from '../MIDDLEWARE/auth.js';
import cookieParser from 'cookie-parser';

const app = express();
app.use(cookieParser());

config(); // Carrega variáveis de ambiente do arquivo .env

// Chamada de rotas
async function main() {
    const hostname = 'localhost';
    const port = 3000;

    const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((origin) => origin.trim()).filter(Boolean);
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

    if (!process.env.MONGO_CS || !process.env.MONGO_DB_NAME) {
        throw new Error('Missing MongoDB environment variables (MONGO_CS, MONGO_DB_NAME).');
    }

    const { db } = await Mongo.connect({
        MongoConnectionString: process.env.MONGO_CS,
        MongodbName: process.env.MONGO_DB_NAME
    });
    app.locals.db = db;

    app.use(express.json());
    app.use(cors(corsOptions));

    app.get('/', (req, res) => {
        res.send({
            success: true,
            statuscode: 200,
            info: 'API da Garage do Edu',
            body: 'API is running'
        });

    })

    // Rotas PÚBLICAS (sem autenticação)
    app.use('/auth', authRouter);

    // Rotas PROTEGIDAS (exigem token válido)
    app.use('/user', authenticateToken, userRouter);
    app.use('/cars', carRouter);

    app.listen(port, () => {
        console.log(`Server running at http://${hostname}:${port}/`);
    });
    console.log('Servidor iniciado com sucesso!');
}

// Chama a função main
main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});