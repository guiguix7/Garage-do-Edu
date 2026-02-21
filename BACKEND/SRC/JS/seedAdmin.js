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
    console.log('✅ MongoDB conectado');
  } catch (err) {
    console.error('❌ Erro ao conectar ao MongoDB:', err.message);
    process.exit(1);
  }
};

const createAdmin = async () => {
  await connectDB();

  const adminEmail = 'admin@garagedoedu.com'; // ← Mude se quiser
  const existing = await User.findOne({ email: adminEmail });
  if (existing) {
    console.log('ℹ️ Admin já existe. ID:', existing._id);
    return;
  }

  const hashedPass = await bcrypt.hash('Garage@2026!', 12); // 🔒 Troque essa senha antes de produção

  const admin = new User({
    username: 'admin',
    email: adminEmail,
    password: hashedPass,
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await admin.save();
  console.log('✅ Admin criado com sucesso!');
  console.log('→ Username:', admin.username);
  console.log('→ Email:', admin.email);
  console.log('→ Role:', admin.role);
  console.log('→ ID:', admin._id.toString());

  mongoose.connection.close();
};

createAdmin().catch(console.error);