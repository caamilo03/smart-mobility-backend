const express = require('express');
const { isAuthenticated } = require('./auth');

const router = express.Router();

// Obtener rutas frecuentes del usuario
router.get('/frequent', isAuthenticated, async (req, res) => {
  try {
    const { limit = 10, sortBy = 'lastUsed' } = req.query;
    
    const sortOptions = {
      'timesUsed': { timesUsed: 'desc' },
      'lastUsed': { lastUsed: 'desc' },
      'recent': { createdAt: 'desc' }
    };

    const routes = await req.prisma.frequentRoute.findMany({
      where: { 
        userId: req.user.id,
        isActive: true
      },
      orderBy: sortOptions[sortBy] || sortOptions.lastUsed,
      take: parseInt(limit)
    });

    res.json({
      success: true,
      routes,
      count: routes.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo rutas frecuentes',
      error: error.message
    });
  }
});

// Guardar nueva ruta frecuente
router.post('/frequent', isAuthenticated, async (req, res) => {
  try {
    const { origin, destination, routeName, routeInfo } = req.body;

    // Validación básica
    if (!origin || !destination || !origin.coordinates || !destination.coordinates) {
      return res.status(400).json({
        success: false,
        message: 'Origen y destino con coordenadas son requeridos'
      });
    }

    console.log('🗺️ Guardando ruta:', { 
      origin: origin.name, 
      destination: destination.name,
      user: req.user.name
    });

    // Verificar si ya existe una ruta similar (dentro de 500 metros aprox)
    const tolerance = 0.005; // aproximadamente 500 metros
    const existingRoute = await req.prisma.frequentRoute.findFirst({
      where: {
        userId: req.user.id,
        isActive: true,
        AND: [
          {
            originLatitude: {
              gte: origin.coordinates.latitude - tolerance,
              lte: origin.coordinates.latitude + tolerance
            }
          },
          {
            originLongitude: {
              gte: origin.coordinates.longitude - tolerance,
              lte: origin.coordinates.longitude + tolerance
            }
          },
          {
            destinationLatitude: {
              gte: destination.coordinates.latitude - tolerance,
              lte: destination.coordinates.latitude + tolerance
            }
          },
          {
            destinationLongitude: {
              gte: destination.coordinates.longitude - tolerance,
              lte: destination.coordinates.longitude + tolerance
            }
          }
        ]
      }
    });

    if (existingRoute) {
      console.log('📍 Ruta existente encontrada, actualizando uso...');
      // Actualizar ruta existente
      const updatedRoute = await req.prisma.frequentRoute.update({
        where: { id: existingRoute.id },
        data: {
          timesUsed: { increment: 1 },
          lastUsed: new Date(),
          routeInfo: routeInfo || existingRoute.routeInfo
        }
      });

      // Actualizar estadísticas del usuario
      await req.prisma.user.update({
        where: { id: req.user.id },
        data: {
          totalTrips: { increment: 1 },
          lastActive: new Date()
        }
      });
      
      return res.json({
        success: true,
        message: 'Ruta actualizada exitosamente',
        route: updatedRoute,
        isNew: false
      });
    }

    console.log('🆕 Creando nueva ruta frecuente...');
    // Crear nueva ruta frecuente
    const newRoute = await req.prisma.frequentRoute.create({
      data: {
        userId: req.user.id,
        routeName: routeName || `${origin.name} → ${destination.name}`,
        originName: origin.name,
        originAddress: origin.address,
        originLatitude: origin.coordinates.latitude,
        originLongitude: origin.coordinates.longitude,
        destinationName: destination.name,
        destinationAddress: destination.address,
        destinationLatitude: destination.coordinates.latitude,
        destinationLongitude: destination.coordinates.longitude,
        routeInfo: routeInfo
      }
    });

    // Actualizar estadísticas del usuario
    await req.prisma.user.update({
      where: { id: req.user.id },
      data: {
        totalTrips: { increment: 1 },
        lastActive: new Date()
      }
    });

    console.log('✅ Nueva ruta creada:', newRoute.routeName);

    res.status(201).json({
      success: true,
      message: 'Ruta frecuente guardada exitosamente',
      route: newRoute,
      isNew: true
    });
  } catch (error) {
    console.error('❌ Error guardando ruta:', error);
    res.status(400).json({
      success: false,
      message: 'Error guardando ruta frecuente',
      error: error.message
    });
  }
});

// Usar una ruta existente (incrementar contador)
router.post('/frequent/:routeId/use', isAuthenticated, async (req, res) => {
  try {
    const { routeId } = req.params;
    const { routeInfo } = req.body;

    const route = await req.prisma.frequentRoute.findFirst({
      where: {
        id: routeId,
        userId: req.user.id,
        isActive: true
      }
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Ruta no encontrada'
      });
    }

    const updatedRoute = await req.prisma.frequentRoute.update({
      where: { id: routeId },
      data: {
        timesUsed: { increment: 1 },
        lastUsed: new Date(),
        routeInfo: routeInfo || route.routeInfo
      }
    });

    // Actualizar estadísticas del usuario
    await req.prisma.user.update({
      where: { id: req.user.id },
      data: {
        totalTrips: { increment: 1 },
        lastActive: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Uso de ruta registrado exitosamente',
      route: updatedRoute
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error registrando uso de ruta',
      error: error.message
    });
  }
});

// Eliminar ruta frecuente
router.delete('/frequent/:routeId', isAuthenticated, async (req, res) => {
  try {
    const { routeId } = req.params;
    
    const route = await req.prisma.frequentRoute.updateMany({
      where: {
        id: routeId,
        userId: req.user.id
      },
      data: { isActive: false }
    });

    if (route.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ruta no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Ruta eliminada exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error eliminando ruta',
      error: error.message
    });
  }
});

// Obtener historial de viajes
router.get('/history', isAuthenticated, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [routes, total] = await Promise.all([
      req.prisma.frequentRoute.findMany({
        where: { userId: req.user.id },
        orderBy: { lastUsed: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      req.prisma.frequentRoute.count({ 
        where: { userId: req.user.id } 
      })
    ]);

    res.json({
      success: true,
      routes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo historial de viajes',
      error: error.message
    });
  }
});

module.exports = router;