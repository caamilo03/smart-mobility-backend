const express = require('express');
const passport = require('passport');

const router = express.Router();

// Middleware para verificar si el usuario está autenticado
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({
    success: false,
    message: 'No autenticado'
  });
};

// Iniciar autenticación con Google
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

// Callback de Google OAuth
router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/api/auth/error' 
  }),
  (req, res) => {
    // Autenticación exitosa
    console.log('✅ Login exitoso para:', req.user.name);
    
    // Redirigir a la app con éxito
    // En desarrollo, puedes cambiar esto por una página de éxito
    res.redirect(`${process.env.FRONTEND_URL}/auth/success`);
  }
);

// Obtener usuario actual
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

// Verificar si está autenticado
router.get('/check', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      success: true,
      authenticated: true,
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email
      }
    });
  } else {
    res.json({
      success: true,
      authenticated: false,
      user: null
    });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error cerrando sesión'
      });
    }
    
    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });
  });
});

// Ruta de error
router.get('/error', (req, res) => {
  res.status(401).json({
    success: false,
    message: 'Error en la autenticación con Google'
  });
});

// Endpoint de prueba (solo desarrollo)
router.post('/test-login', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ 
      success: false,
      message: 'Solo disponible en desarrollo' 
    });
  }

  try {
    // Crear o encontrar usuario de prueba
    let user = await req.prisma.user.findUnique({
      where: { email: 'test@smartmobility.com' }
    });

    if (!user) {
      user = await req.prisma.user.create({
        data: {
          name: 'Usuario de Prueba',
          email: 'test@smartmobility.com'
        }
      });
    }

    // Simular login
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error en login de prueba'
        });
      }

      res.json({
        success: true,
        message: 'Login de prueba exitoso',
        user
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en login de prueba',
      error: error.message
    });
  }
});

module.exports = router;