const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const router = express.Router();

// Configuración JWT
const JWT_SECRET = process.env.JWT_SECRET || 'smart-mobility-secret-key';
const JWT_EXPIRY = '7d'; // Token válido por 7 días

// Middleware para verificar JWT
const isAuthenticated = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Adjuntar información de usuario al request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Error de autenticación JWT:', error);
    res.status(401).json({
      success: false,
      message: 'Token inválido o expirado'
    });
  }
};

// Función para generar token JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

// Registro de nuevos usuarios
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validación básica
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, email y contraseña son requeridos'
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await req.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Este correo ya está registrado'
      });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const newUser = await req.prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        provider: 'local'
      }
    });

    // Generar token
    const token = generateToken(newUser);

    // Respuesta exitosa
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando usuario',
      error: error.message
    });
  }
});

// Login con email y contraseña
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validación básica
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario
    const user = await req.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    // Verificar si existe
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Si el usuario no tiene contraseña (porque se registró con OAuth)
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'Este usuario no tiene contraseña configurada'
      });
    }

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Actualizar último acceso
    await req.prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() }
    });

    // Generar token
    const token = generateToken(user);

    // Respuesta exitosa
    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error en login',
      error: error.message
    });
  }
});

// Verificar token (útil para validar sesión en cliente)
router.get('/verify', isAuthenticated, async (req, res) => {
  try {
    // Buscar usuario actual (por si fue eliminado mientras el token era válido)
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Actualizar último acceso
    await req.prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() }
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error en verificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error verificando token',
      error: error.message
    });
  }
});

// Obtener perfil de usuario actual
router.get('/me', isAuthenticated, async (req, res) => {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        frequentRoutes: {
          where: { isActive: true },
          orderBy: { lastUsed: 'desc' },
          take: 5
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo información del usuario',
      error: error.message
    });
  }
});

// Endpoint para crear usuario de prueba (solo desarrollo)
router.post('/test-account', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ 
      success: false,
      message: 'Solo disponible en desarrollo' 
    });
  }

  try {
    // Datos de prueba
    const testEmail = 'test@smartmobility.com';
    const testPassword = 'password123';
    
    // Buscar o crear usuario de prueba
    let user = await req.prisma.user.findUnique({
      where: { email: testEmail }
    });

    if (!user) {
      // Generar hash de contraseña
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      
      // Crear nuevo usuario
      user = await req.prisma.user.create({
        data: {
          name: 'Usuario de Prueba',
          email: testEmail,
          password: hashedPassword,
          provider: 'local'
        }
      });
    }

    // Generar token
    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Cuenta de prueba creada/actualizada',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      credentials: {
        email: testEmail,
        password: testPassword
      }
    });
  } catch (error) {
    console.error('Error creando cuenta de prueba:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando cuenta de prueba',
      error: error.message
    });
  }
});

// Exportar router y middleware de autenticación
module.exports = { router, isAuthenticated };