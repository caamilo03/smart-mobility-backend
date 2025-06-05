const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Configuración de la estrategia de Google OAuth
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('🔐 Usuario autenticado con Google:', profile.displayName);
    
    // Buscar si el usuario ya existe
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: profile.id },
          { email: profile.emails[0].value }
        ]
      }
    });

    if (user) {
      console.log('✅ Usuario existente encontrado');
      // Actualizar última actividad y googleId si es necesario
      user = await prisma.user.update({
        where: { id: user.id },
        data: { 
          googleId: profile.id,
          lastActive: new Date() 
        }
      });
      return done(null, user);
    }

    console.log('🆕 Creando nuevo usuario');
    // Crear nuevo usuario
    user = await prisma.user.create({
      data: {
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        profilePicture: profile.photos[0] ? profile.photos[0].value : null
      }
    });

    console.log('✅ Nuevo usuario creado:', user.name);
    done(null, user);
  } catch (error) {
    console.error('❌ Error en Google OAuth:', error);
    done(error, null);
  }
}));

// Serializar usuario para la sesión
passport.serializeUser((user, done) => {
  console.log('📝 Serializando usuario:', user.id);
  done(null, user.id);
});

// Deserializar usuario de la sesión
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: id }
    });
    console.log('📖 Deserializando usuario:', user ? user.name : 'No encontrado');
    done(null, user);
  } catch (error) {
    console.error('❌ Error deserializando usuario:', error);
    done(error, null);
  }
});

module.exports = passport;