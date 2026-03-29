// BACKEND/scripts/seedAdmin.mjs
// EM DESENVOLVIMENTO - NÃO USAR EM PRODUÇÃO SEM REVISÃO
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './SRC/DATA/user.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carrega .env
dotenv.config({ path: join(__dirname, '..', '.env') });

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_CS, {
      dbName: process.env.MONGO_DB_NAME,
    });
    console.log('MongoDB conectado');
  } catch (err) {
    console.error('Erro ao conectar ao MongoDB:', err.message);
    process.exit(1);
  }
};

// Adcionar criação de admin (só  poderá ser criado por um admin existente, na pagina de admin)