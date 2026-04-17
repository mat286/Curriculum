# Configuración de Google OAuth

## Pasos para Configurar Google OAuth

### 1. Crear un Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Inicia sesión con tu cuenta de Google
3. Crea un nuevo proyecto o selecciona uno existente
4. Haz clic en "Crear proyecto"
5. Ingresa un nombre para tu proyecto (ej: "Entrevista Virtual")
6. Haz clic en "Crear"

### 2. Configurar la Pantalla de Consentimiento de OAuth

1. En el menú lateral, ve a **APIs & Services** > **OAuth consent screen**
2. Selecciona **External** (si no estás usando Google Workspace)
3. Completa la información requerida:
   - **App name**: Entrevista Virtual
   - **User support email**: Tu email
   - **Developer contact information**: Tu email
4. Haz clic en **Save and Continue**
5. En **Scopes**, haz clic en **Add or Remove Scopes**
6. Selecciona los siguientes scopes:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
7. Haz clic en **Update** y luego en **Save and Continue**
8. En **Test users**, agrega tu email de prueba (opcional)
9. Haz clic en **Save and Continue**

### 3. Crear Credenciales OAuth 2.0

1. En el menú lateral, ve a **APIs & Services** > **Credentials**
2. Haz clic en **Create Credentials** > **OAuth client ID**
3. Selecciona **Web application** como tipo de aplicación
4. Ingresa un nombre para tu cliente OAuth (ej: "Entrevista Virtual Web Client")
5. En **Authorized JavaScript origins**, agrega:
   - `http://localhost:5173` (para desarrollo)
   - `http://localhost:3000` (si tu backend también usa OAuth)
   
   **⚠️ IMPORTANTE**: 
   - No incluyas la barra final (`/`)
   - Usa `http` para desarrollo local (no `https`)
   - El puerto debe coincidir con el puerto de tu servidor de desarrollo
   
6. En **Authorized redirect URIs**, agrega:
   - `http://localhost:5173` (para desarrollo)
   - `http://localhost:3000` (si tu backend también usa OAuth)
   
   **⚠️ IMPORTANTE**: 
   - No incluyas la barra final (`/`)
   - Usa `http` para desarrollo local (no `https`)
   
7. **Verifica que el tipo de aplicación sea "Web application"** (no "Desktop app" ni "Mobile app")
8. Haz clic en **Create**
9. **Copia el Client ID** que se muestra (tiene el formato: `xxxxx.apps.googleusercontent.com`)

### 4. Configurar el Frontend

1. Crea un archivo `.env` en la raíz del proyecto frontend (si no existe)
2. Agrega tu Client ID al archivo `.env`:
```env
VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
VITE_API_BASE_URL=http://localhost:3000
```
3. **Reemplaza `tu-client-id.apps.googleusercontent.com` con tu Client ID real**
4. Guarda el archivo `.env`
5. **Reinicia el servidor de desarrollo** (detén y vuelve a iniciar `npm run dev`)

### 5. Verificar la Configuración

1. Asegúrate de que el archivo `.env` esté en la raíz del proyecto
2. Verifica que el Client ID esté correctamente configurado
3. Reinicia el servidor de desarrollo
4. Ve a `http://localhost:5173/login`
5. Deberías ver el botón de "Iniciar sesión con Google"
6. Haz clic en el botón y verifica que funcione correctamente

## Solución de Problemas

### Error: "401: invalid_client" o "Error 401: invalid_client"
- **Causa**: Google OAuth está rechazando el Client ID
- **Solución**: 
  1. Verifica que el Client ID esté configurado correctamente en Google Cloud Console
  2. Verifica que los orígenes autorizados incluyan `http://localhost:5173`
  3. Verifica que el tipo de aplicación sea "Web application"
  4. Verifica que el Client ID esté habilitado en Google Cloud Console
  5. Verifica que el Client ID en el archivo `.env` sea correcto
  6. Reinicia el servidor de desarrollo después de cambiar el archivo `.env`
  7. Limpia la caché del navegador y recarga la página
  8. **Ver la guía completa de solución**: [SOLUCION_ERROR_401_INVALID_CLIENT.md](./SOLUCION_ERROR_401_INVALID_CLIENT.md)

### Error: "The given client ID is not found"

**Causa**: El Client ID no está configurado correctamente o el archivo `.env` no se está cargando.

**Solución**:
1. Verifica que el archivo `.env` esté en la raíz del proyecto
2. Verifica que el Client ID esté correcto (sin espacios ni comillas)
3. Reinicia el servidor de desarrollo
4. Verifica que la variable de entorno esté cargándose correctamente:
   - Abre la consola del navegador
   - Verifica que no aparezca "TU_CLIENT_ID.apps.googleusercontent.com"

### Error: "400. El servidor no puede procesar la solicitud"

**Causa**: El backend no está recibiendo el credential correctamente o el formato es incorrecto.

**Solución**:
1. Verifica que el backend esté corriendo en `http://localhost:3000`
2. Verifica que el endpoint `/api/user/google` esté configurado correctamente
3. Verifica que el backend esté esperando el formato correcto: `{ credential: "token" }`
4. Revisa los logs del backend para ver el error específico

### Error: "CORS error"

**Causa**: El backend no está configurado para permitir peticiones desde el frontend.

**Solución**:
1. Verifica que el backend tenga CORS configurado
2. Verifica que el proxy en `vite.config.js` esté configurado correctamente
3. Verifica que el backend permita peticiones desde `http://localhost:5173`

### Error: "Error de conexión"

**Causa**: El backend no está corriendo o la URL es incorrecta.

**Solución**:
1. Verifica que el backend esté corriendo en `http://localhost:3000`
2. Verifica que `VITE_API_BASE_URL` esté configurado correctamente en `.env`
3. Reinicia el servidor de desarrollo

## Notas Importantes

- **No compartas tu Client ID**: Mantén tu Client ID privado y no lo subas a repositorios públicos
- **Agrega el `.env` a `.gitignore`**: Asegúrate de que el archivo `.env` esté en `.gitignore`
- **Usa diferentes Client IDs para desarrollo y producción**: Crea credenciales separadas para cada entorno
- **Verifica los orígenes autorizados**: Asegúrate de que los orígenes JavaScript estén configurados correctamente

## Recursos Adicionales

- [Documentación de Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Documentación de @react-oauth/google](https://www.npmjs.com/package/@react-oauth/google)

