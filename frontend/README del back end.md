# Avatar IA - Sistema de Entrevistas Virtuales

Sistema backend para crear avatares de IA que simulan personas basándose en sus datos personales y profesionales. Permite realizar entrevistas virtuales donde la IA responde preguntas en primera persona usando únicamente la información proporcionada del usuario.

## 🚀 Características

- **Autenticación con Google OAuth**: Login seguro mediante Google
- **Gestión de perfiles completos**: Almacenamiento de datos personales, profesionales, educativos y familiares
- **IA conversacional**: Integración con Ollama para generar respuestas en primera persona
- **API RESTful**: Endpoints bien estructurados y documentados
- **Seguridad JWT**: Autenticación mediante tokens JWT
- **Base de datos MySQL**: Almacenamiento persistente de datos

## 📋 Requisitos Previos

- Node.js (v16 o superior)
- MySQL (v8.0 o superior)
- Ollama instalado y corriendo (para la generación de respuestas de IA)

## 🛠️ Instalación

1. **Clonar el repositorio** (o navegar al directorio del proyecto)

2. **Instalar dependencias**:
```bash
npm install
```

3. **Configurar variables de entorno**:
   - Copiar el archivo `.env.example` a `.env`
   - Editar `.env` con tus credenciales:
```bash
cp .env.example .env
```

4. **Configurar la base de datos**:
   - Crear la base de datos MySQL:
```sql
CREATE DATABASE entrevistas_virtuales;
```
   - Ejecutar los scripts SQL necesarios para crear las tablas (ver sección de Base de Datos)

5. **Iniciar Ollama** (si no está corriendo):
```bash
ollama serve
```

6. **Iniciar el servidor**:
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

## 📁 Estructura del Proyecto

```
avatar-ia/
├── config/
│   └── db.js              # Configuración de la base de datos
├── ia/
│   └── ollama.js          # Integración con Ollama
├── middlewares/
│   └── authMiddleware.js  # Middleware de autenticación JWT
├── routes/
│   ├── auth.js            # Rutas de autenticación (Google OAuth)
│   ├── user.js            # Rutas de usuario básicas
│   └── userData.js        # Rutas de gestión de datos del usuario
├── services/
│   └── buscarData.js      # Servicio para obtener datos completos del usuario
├── utils/
│   └── jwt.js             # Utilidades para JWT
└── server.js              # Archivo principal del servidor
```

## 🔌 API Endpoints

### Autenticación

#### `POST /api/user/google`
Autentica un usuario mediante Google OAuth.

**Body:**
```json
{
  "credential": "token_de_google"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "token": "jwt_token",
  "user": {
    "id": 1,
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "juan@example.com"
  }
}
```

### Usuario

#### `GET /api/user/:id/data`
Obtiene los datos básicos del usuario (requiere autenticación).

**Headers:**
```
Authorization: Bearer <token>
```

**Respuesta:**
```json
{
  "id": 1,
  "nombre": "Juan",
  "apellido": "Pérez",
  "email": "juan@example.com",
  "sobreMi": "Descripción personal..."
}
```

#### `GET /api/user/:id`
Obtiene todos los datos del perfil del usuario (requiere autenticación).

**Headers:**
```
Authorization: Bearer <token>
```

**Respuesta:**
```json
{
  "usuario": { ... },
  "sobre_mi": [ ... ],
  "experiencia_laboral": [ ... ],
  "proyectos": [ ... ],
  "educacion": [ ... ],
  "cursos": [ ... ],
  "familia": { ... },
  "idiomas": [ ... ],
  "habilidades": [ ... ],
  "respuestas_entrevista": [ ... ]
}
```

#### `PUT /api/user/:id/data`
Actualiza todos los datos del perfil del usuario (requiere autenticación).

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "sobreMi": "Descripción...",
  "experiencias": [
    {
      "empresa": "Empresa XYZ",
      "puesto": "Desarrollador",
      "descripcion": "Trabajé en...",
      "fecha_inicio": "2020-01-01",
      "fecha_fin": "2022-12-31",
      "actualmente": false
    }
  ],
  "estudios": [ ... ],
  "cursos": [ ... ],
  "proyectos": [ ... ],
  "familia": {
    "vive_con_padres": true,
    "cantidad_hermanos": 2,
    "estado_civil": "soltero",
    "hijos": 0
  },
  "respuestas": [ ... ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "userId": 1,
  "updated": true,
  "message": "Datos actualizados correctamente"
}
```

### IA Conversacional

#### `POST /api/ask`
Realiza una pregunta a la IA sobre el usuario (requiere autenticación).

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "question": "¿Cuál es tu experiencia laboral?",
  "userId": 1
}
```

**Respuesta:**
```json
{
  "answer": "Tengo experiencia trabajando como desarrollador...",
  "userId": 1
}
```

### Utilidades

#### `GET /health`
Verifica el estado del servidor.

**Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🔐 Seguridad

- **JWT Tokens**: Todos los endpoints protegidos requieren un token JWT válido en el header `Authorization: Bearer <token>`
- **Validación de usuario**: Los usuarios solo pueden acceder y modificar sus propios datos
- **Variables de entorno**: Las credenciales sensibles se almacenan en variables de entorno

## 🗄️ Base de Datos

El sistema utiliza las siguientes tablas principales:

- `usuarios`: Información básica del usuario
- `sobre_mi`: Descripción personal
- `experiencia_laboral`: Historial laboral
- `educacion`: Formación académica
- `cursos`: Cursos realizados
- `proyectos`: Proyectos desarrollados
- `familia`: Información familiar
- `idiomas`: Idiomas que domina
- `habilidades`: Habilidades técnicas y blandas
- `respuestas_entrevista`: Respuestas predefinidas para entrevistas

## ⚙️ Variables de Entorno

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Entorno de ejecución | `development` |
| `DB_HOST` | Host de MySQL | `localhost` |
| `DB_USER` | Usuario de MySQL | `admin` |
| `DB_PASSWORD` | Contraseña de MySQL | `admin` |
| `DB_NAME` | Nombre de la base de datos | `entrevistas_virtuales` |
| `JWT_SECRET` | Secreto para firmar JWT | (requerido) |
| `GOOGLE_CLIENT_ID` | ID de cliente de Google OAuth | (requerido) |
| `OLLAMA_URL` | URL del servidor Ollama | `http://localhost:11434` |
| `OLLAMA_MODEL` | Modelo de IA a usar | `llama3` |

## 🧪 Desarrollo

### Scripts disponibles

```bash
npm run dev    # Inicia el servidor
```

### Mejores prácticas implementadas

- ✅ Validación de entrada en todos los endpoints
- ✅ Manejo de errores consistente
- ✅ Transacciones de base de datos para operaciones complejas
- ✅ Documentación JSDoc en funciones importantes
- ✅ Separación de responsabilidades (rutas, servicios, middlewares)
- ✅ Variables de entorno para configuración
- ✅ Pool de conexiones optimizado para MySQL

## 🐛 Solución de Problemas

### Error: "JWT_SECRET no está configurado"
- Asegúrate de tener un archivo `.env` con la variable `JWT_SECRET` definida

### Error: "Error de Ollama: Connection refused"
- Verifica que Ollama esté corriendo: `ollama serve`
- Verifica que la URL en `OLLAMA_URL` sea correcta

### Error: "Access denied for user"
- Verifica las credenciales de MySQL en el archivo `.env`
- Asegúrate de que el usuario tenga permisos sobre la base de datos

## 📝 Notas

- El sistema está diseñado para que cada usuario solo pueda acceder a sus propios datos
- Las respuestas de la IA se generan en tiempo real usando streaming
- Los datos se actualizan mediante transacciones para garantizar consistencia

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 👨‍💻 Autor

Desarrollado para entrevistas virtuales con avatares de IA.

---

**Versión:** 1.0.0

