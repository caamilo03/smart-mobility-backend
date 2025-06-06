const express = require('express');
const { PrismaClient } = require('@prisma/client');
const passport = require('passport');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('express-async-errors');
require('dotenv').config();

// Inicializar Prisma
const prisma = new PrismaClient();

// Importar configuraciones
require('./src/config/passport');

// Importar rutas
const { router: authRoutes, isAuthenticated } = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const routesRoutes = require('./src/routes/routes');

const app = express();

// Middleware de seguridad
app.use(helmet({
  // Deshabilitar políticas restrictivas para desarrollo
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Configuración CORS para permitir cualquier origen, incluyendo emuladores
app.use(cors({
  // Permitir estos orígenes específicos
  origin: [
    'http://localhost:3000', 
    'http://localhost:8081',
    'http://10.0.2.2:8081',    // Emulador Android (Expo)
    'http://10.0.2.2:3000',    // Emulador Android accediendo al puerto 3000
    'http://10.0.2.2:19000',   // Expo DevServer en Android
    'http://10.0.2.2:19006',   // Expo Web en Android
    'exp://10.0.2.2:8081',     // Protocolo Expo
    'exp://10.0.2.2:19000',    // Protocolo Expo
    'exp://192.168.101.12:8081' // Tu IP local con Expo
  ],
  // Estas opciones son importantes para aplicaciones móviles
  credentials: true,
  exposedHeaders: ['Authorization'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Configurar sesiones (en lugar de JWT)
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true en producción con HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Middleware general
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Inicializar Passport
app.use(passport.initialize());
app.use(passport.session());

// Hacer Prisma disponible en todas las rutas
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/routes', routesRoutes);

// Ruta de bienvenida
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Smart Mobility Backend API',
    version: '1.0.0',
    status: 'OK',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      routes: '/api/routes'
    }
  });
});

// Ruta de salud
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'OK', 
      message: 'Smart Mobility Backend funcionando',
      database: 'PostgreSQL conectado',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Error de conexión a la base de datos',
      error: error.message
    });
  }
});

// Manejo de errores 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Ruta no encontrada' 
  });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Cerrar Prisma al cerrar la aplicación
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

const PORT = process.env.PORT || 3000;

async function setupDatabase() {
  try {
    await prisma.$executeRaw`SELECT 1`; // Test connection
    console.log('📊 Configurando base de datos...');
    
    // Usar Prisma push para crear/actualizar tablas
    const { execSync } = require('child_process');
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    
    console.log('✅ Tablas sincronizadas');
  } catch (error) {
    console.log('⚠️ Base de datos:', error.message);
  }
}

setupDatabase();

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📦 PostgreSQL con Prisma ORM`);
  console.log(`🔐 Google OAuth configurado`);
  console.log(`🌐 Prueba: http://localhost:${PORT}`);
});

module.exports = app;