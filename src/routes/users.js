const express = require('express');
const { isAuthenticated } = require('./auth');

const router = express.Router();

// Obtener perfil del usuario
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        frequentRoutes: {
          where: { isActive: true },
          orderBy: { lastUsed: 'desc' }
        },
        _count: {
          select: {
            frequentRoutes: {
              where: { isActive: true }
            }
          }
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
      message: 'Error obteniendo perfil',
      error: error.message
    });
  }
});

// Actualizar perfil del usuario
router.put('/profile', isAuthenticated, async (req, res) => {
  try {
    const { name, preferences } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (preferences) updateData.preferences = preferences;

    const user = await req.prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...updateData,
        lastActive: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error actualizando perfil',
      error: error.message
    });
  }
});

// Obtener estadísticas del usuario
router.get('/stats', isAuthenticated, async (req, res) => {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        totalTrips: true,
        lastActive: true,
        createdAt: true
      }
    });
    
    // Estadísticas de rutas
    const routeStats = await req.prisma.frequentRoute.aggregate({
      where: { userId: req.user.id, isActive: true },
      _count: { id: true },
      _sum: { timesUsed: true },
      _avg: { timesUsed: true }
    });

    // Rutas más utilizadas
    const topRoutes = await req.prisma.frequentRoute.findMany({
      where: { userId: req.user.id, isActive: true },
      orderBy: { timesUsed: 'desc' },
      take: 3,
      select: {
        routeName: true,
        timesUsed: true,
        originName: true,
        destinationName: true
      }
    });

    const stats = {
      user: user,
      routes: {
        totalRoutes: routeStats._count.id || 0,
        totalUsage: routeStats._sum.timesUsed || 0,
        avgUsagePerRoute: Math.round(routeStats._avg.timesUsed || 0),
        topRoutes
      }
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas',
      error: error.message
    });
  }
});

// Cambia esta exportación ES module:
// export const register = async (name, email, password) => {

// Por esta exportación CommonJS:
const register = async (name, email, password) => {
  console.log('Intentando registrar con:', { name, email });
  try {
    console.log('URL del API:', `${API_URL}/auth/register`);
    
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ name, email, password }),
    });
    
    console.log('Respuesta recibida, status:', response.status);
    const data = await response.json();
    console.log('Datos de respuesta:', data);
    
    // Resto del código...
  } catch (error) {
    console.error('Error en registro (detallado):', error);
    console.error('Tipo de error:', typeof error);
    console.error('Mensaje:', error.message);
    console.error('Stack:', error.stack);
    
    return { success: false, error: 'Error de conexión' };
  }
};

// Exporta también la función register
module.exports = router;
module.exports.register = register;