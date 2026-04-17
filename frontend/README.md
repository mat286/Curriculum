# Entrevista Virtual - Frontend

Frontend de la aplicación **Entrevista Virtual**, una plataforma que permite crear un avatar profesional con información laboral y académica, y practicar entrevistas con un asistente de IA que responde basándose en tu perfil.

## 🚀 Características

- **Autenticación con Google OAuth**: Login seguro mediante Google
- **Gestión de perfiles completos**: Creación y edición de datos personales, profesionales, educativos y familiares
- **Chat con IA**: Conversación en tiempo real con un asistente de IA que responde basándose en tu perfil
- **Interfaz moderna y responsive**: Diseño limpio y profesional
- **Manejo de errores robusto**: Validación y manejo de errores en todas las operaciones
- **Protección de rutas**: Rutas protegidas que requieren autenticación
- **Estado global**: Gestión de estado de autenticación con Context API

## 📋 Requisitos Previos

- Node.js (v16 o superior)
- npm o yarn
- Backend de Entrevista Virtual corriendo en `http://localhost:3000`
- Google OAuth Client ID configurado

## 🛠️ Instalación

1. **Clonar el repositorio** (o navegar al directorio del proyecto)

2. **Instalar dependencias**:
```bash
npm install
```

3. **Configurar variables de entorno**:
   - Crear un archivo `.env` en la raíz del proyecto
   - Agregar las siguientes variables:
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=TU_CLIENT_ID.apps.googleusercontent.com
```
   
   **⚠️ IMPORTANTE**: Reemplaza `TU_CLIENT_ID.apps.googleusercontent.com` con tu Client ID real de Google OAuth.
   
   Para obtener tu Client ID:
   1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
   2. Crea un proyecto o selecciona uno existente
   3. Habilita la API de Google+
   4. Crea credenciales OAuth 2.0
   5. Copia el Client ID
   
   **Ver la guía completa**: [CONFIGURACION_GOOGLE_OAUTH.md](./CONFIGURACION_GOOGLE_OAUTH.md)

4. **Iniciar el servidor de desarrollo**:
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173` (o el puerto que Vite asigne)

## 📁 Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── LoginPage.jsx    # Página de inicio de sesión
│   │   ├── Navbar.jsx       # Barra de navegación
│   │   ├── ProtectedRoute.jsx # Componente de protección de rutas
│   │   └── AvatarCard.jsx   # Tarjeta de avatar (no utilizado actualmente)
│   ├── context/             # Contextos de React
│   │   └── AuthContext.jsx  # Contexto de autenticación
│   ├── pages/               # Páginas de la aplicación
│   │   ├── Home.jsx         # Página de inicio
│   │   ├── ProfilePage.jsx  # Página de perfil
│   │   └── Chat.jsx         # Página de chat con IA
│   ├── services/            # Servicios de API
│   │   └── api.js           # Servicio centralizado de API
│   ├── utils/               # Utilidades
│   │   └── constants.js     # Constantes y configuración
│   ├── App.jsx              # Componente principal
│   ├── main.jsx             # Punto de entrada
│   └── index.css            # Estilos globales
├── public/                  # Archivos públicos
├── vite.config.js           # Configuración de Vite
├── package.json             # Dependencias y scripts
└── README.md                # Documentación
```

## 🔌 Integración con el Backend

El frontend se comunica con el backend a través de una API RESTful. La configuración se encuentra en `src/services/api.js` y utiliza Axios para realizar las peticiones HTTP.

### Endpoints Utilizados

#### Autenticación
- **POST `/api/user/google`**: Autenticación con Google OAuth
  - Body: `{ credential: "token_de_google" }`
  - Respuesta: `{ success: true, token: "jwt_token", user: {...} }`

#### Usuario
- **GET `/api/user/:id`**: Obtiene todos los datos del perfil del usuario
  - Headers: `Authorization: Bearer <token>`
  - Respuesta: `{ nombre, apellido, sobreMi, experiencias, estudios, cursos, proyectos, familia, respuestas }`

- **PUT `/api/user/:id/data`**: Actualiza los datos del perfil del usuario
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ nombre, apellido, sobreMi, experiencias, estudios, cursos, proyectos, familia, respuestas, userId }`
  - Respuesta: `{ success: true, message: "Datos actualizados correctamente" }`

#### Chat
- **POST `/api/ask`**: Realiza una pregunta a la IA
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ question: "pregunta", userData: { userId: 1 } }`
  - Respuesta: `{ answer: "respuesta de la IA" }`

### Configuración del Proxy

El archivo `vite.config.js` está configurado para hacer proxy de las peticiones a `/api` al backend en `http://localhost:3000`:

```javascript
server: {
  proxy: {
    '/api': 'http://localhost:3000'
  }
}
```

## 🔐 Autenticación

El sistema utiliza JWT (JSON Web Tokens) para la autenticación. El token se almacena en `localStorage` y se incluye automáticamente en todas las peticiones a través de los interceptores de Axios.

### Flujo de Autenticación

1. El usuario inicia sesión con Google OAuth
2. El backend valida las credenciales y devuelve un token JWT
3. El token se almacena en `localStorage` junto con los datos del usuario
4. Todas las peticiones subsiguientes incluyen el token en el header `Authorization: Bearer <token>`
5. Si el token expira o es inválido, el usuario es redirigido a la página de login

### Protección de Rutas

Las rutas protegidas utilizan el componente `ProtectedRoute` que verifica si el usuario está autenticado antes de renderizar el componente. Si no está autenticado, se redirige a `/login`.

## 🎨 Estilos

El proyecto utiliza CSS puro con una estructura modular:
- `src/index.css`: Estilos globales
- `src/components/*.css`: Estilos de componentes
- `src/pages/*.css`: Estilos de páginas

Los estilos están organizados por componentes y páginas, facilitando el mantenimiento y la escalabilidad.

## 📦 Dependencias Principales

- **React** (^19.2.0): Biblioteca de interfaz de usuario
- **React Router DOM** (^7.9.5): Enrutamiento de la aplicación
- **Axios** (^1.13.2): Cliente HTTP para peticiones a la API
- **@react-oauth/google** (^0.12.2): Integración con Google OAuth
- **Vite** (^5.2.8): Herramienta de construcción y desarrollo

## 🚀 Scripts Disponibles

```bash
# Iniciar servidor de desarrollo
npm run dev

# Construir para producción
npm run build

# Vista previa de la construcción de producción
npm run preview

# Ejecutar linter
npm run lint
```

## ⚙️ Variables de Entorno

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `VITE_API_BASE_URL` | URL base del backend | `http://localhost:3000` |
| `VITE_GOOGLE_CLIENT_ID` | ID de cliente de Google OAuth | (requerido) |

## 🧩 Componentes Principales

### AuthContext
Contexto de React que gestiona el estado de autenticación global:
- `user`: Datos del usuario autenticado
- `token`: Token JWT
- `isAuthenticated`: Estado de autenticación
- `login(credential)`: Función para iniciar sesión
- `logout()`: Función para cerrar sesión
- `updateUser(userData)`: Función para actualizar los datos del usuario

### ProtectedRoute
Componente que protege rutas que requieren autenticación:
- Verifica si el usuario está autenticado
- Redirige a `/login` si no está autenticado
- Muestra un indicador de carga mientras verifica

### api.js
Servicio centralizado de API que incluye:
- Interceptores para agregar tokens automáticamente
- Manejo de errores centralizado
- Servicios para autenticación, usuario y chat

## 🐛 Solución de Problemas

### Error: "No se encontró el ID del usuario"
- **Causa**: El usuario no está autenticado o el token ha expirado
- **Solución**: Inicia sesión nuevamente

### Error: "Error de conexión"
- **Causa**: El backend no está corriendo o la URL es incorrecta
- **Solución**: Verifica que el backend esté corriendo en `http://localhost:3000` y que la variable `VITE_API_BASE_URL` sea correcta

### Error: "Error al iniciar sesión con Google" o "The given client ID is not found"
- **Causa**: El Google Client ID no está configurado correctamente o el archivo `.env` no se está cargando
- **Solución**: 
  1. Verifica que el archivo `.env` esté en la raíz del proyecto
  2. Verifica que `VITE_GOOGLE_CLIENT_ID` esté configurado correctamente (sin espacios ni comillas)
  3. Reinicia el servidor de desarrollo después de agregar/modificar el archivo `.env`
  4. Verifica que el Client ID sea válido (debe tener el formato: `xxxxx.apps.googleusercontent.com`)
  5. **Ver la guía completa**: [CONFIGURACION_GOOGLE_OAUTH.md](./CONFIGURACION_GOOGLE_OAUTH.md)

### Error: "401: invalid_client" o "Error 401: invalid_client"
- **Causa**: Google OAuth está rechazando el Client ID. Esto puede deberse a:
  - Client ID no configurado en Google Cloud Console
  - Orígenes autorizados no configurados correctamente
  - Client ID incorrecto o inválido
  - Tipo de aplicación incorrecto
- **Solución**: 
  1. **Verifica la configuración en Google Cloud Console**:
     - Ve a [Google Cloud Console](https://console.cloud.google.com/)
     - Selecciona tu proyecto
     - Ve a **APIs & Services** > **Credentials**
     - Verifica que tu Client ID esté configurado como "Web application"
     - Agrega `http://localhost:5173` a los orígenes autorizados
  2. **Verifica que el Client ID esté en el archivo `.env`**:
     ```env
     VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
     ```
  3. **Reinicia el servidor de desarrollo** después de cambiar el archivo `.env`
  4. **Limpia la caché del navegador** y recarga la página
  5. **Ver la guía completa de solución**: [SOLUCION_ERROR_401_INVALID_CLIENT.md](./SOLUCION_ERROR_401_INVALID_CLIENT.md)

### Error: "400. El servidor no puede procesar la solicitud"
- **Causa**: El backend no está recibiendo el credential correctamente, el formato es incorrecto, o el Google Client ID no está configurado
- **Solución**: 
  1. **Primero, verifica que el Google Client ID esté configurado correctamente** (ver error anterior)
  2. Verifica que el backend esté corriendo en `http://localhost:3000`
  3. Verifica que el endpoint `/api/user/google` esté configurado correctamente
  4. Verifica que el backend esté esperando el formato correcto: `{ credential: "token" }`
  5. Revisa los logs del backend para ver el error específico
  6. Verifica que el Google Client ID en el backend coincida con el del frontend
  7. **Ver la guía completa**: [CONFIGURACION_GOOGLE_OAUTH.md](./CONFIGURACION_GOOGLE_OAUTH.md)

### Error: "CORS error"
- **Causa**: El backend no está configurado para permitir peticiones desde el frontend
- **Solución**: Verifica la configuración de CORS en el backend

## 📝 Mejores Prácticas Implementadas

- ✅ **Separación de responsabilidades**: Servicios, componentes y páginas están separados
- ✅ **Manejo de errores centralizado**: Todos los errores se manejan de forma consistente
- ✅ **Protección de rutas**: Las rutas protegidas requieren autenticación
- ✅ **Estado global**: Uso de Context API para el estado de autenticación
- ✅ **Validación de datos**: Validación de entrada en formularios
- ✅ **Mensajes de error claros**: Mensajes de error descriptivos para el usuario
- ✅ **Loading states**: Indicadores de carga durante las operaciones
- ✅ **Código limpio**: Código bien estructurado y comentado

## 🔄 Flujo de la Aplicación

1. **Usuario no autenticado**:
   - Ve la página de inicio
   - Puede hacer clic en "Iniciar sesión" para ir a `/login`
   - Inicia sesión con Google OAuth

2. **Usuario autenticado**:
   - Ve la página de inicio con opciones para "Crear Perfil" y "Hablar con tu IA"
   - Puede acceder a `/perfil` para crear/editar su perfil
   - Puede acceder a `/chat` para conversar con la IA
   - Puede cerrar sesión desde la barra de navegación

3. **Gestión de perfil**:
   - El usuario puede agregar/editar datos personales, experiencias, estudios, cursos, proyectos, información familiar y preguntas/respuestas
   - Los cambios se guardan en el backend mediante una petición PUT

4. **Chat con IA**:
   - El usuario puede hacer preguntas a la IA
   - La IA responde basándose en el perfil del usuario
   - Las respuestas se muestran en tiempo real

## 📚 Recursos Adicionales

- [Documentación de React](https://react.dev/)
- [Documentación de React Router](https://reactrouter.com/)
- [Documentación de Axios](https://axios-http.com/)
- [Documentación de Vite](https://vitejs.dev/)
- [Documentación de Google OAuth](https://developers.google.com/identity/protocols/oauth2)

## 📄 Licencia

Este proyecto es privado y está destinado para uso interno.

## 👥 Autor

Desarrollado para Entrevista Virtual

---

**Nota**: Asegúrate de que el backend esté corriendo antes de iniciar el frontend. La aplicación requiere una conexión activa con el backend para funcionar correctamente.
