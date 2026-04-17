# Solución: Error 401 "invalid_client"

## 🔴 Problema

Estás recibiendo el error:
```
Error 401: invalid_client
Detalles de la solicitud: flowName=GeneralOAuthFlow
```

Este error indica que Google OAuth está rechazando tu Client ID antes de que llegue al backend.

## 🔍 Causas Comunes

1. **Client ID no configurado en Google Cloud Console**
2. **Orígenes autorizados no configurados correctamente**
3. **Client ID incorrecto o inválido**
4. **Tipo de aplicación incorrecto**
5. **Client ID deshabilitado en Google Cloud Console**
6. **Client ID no coincide entre frontend y backend**

## ✅ Solución Paso a Paso

### Paso 1: Verificar que el Client ID esté en el archivo .env

1. Crea un archivo `.env` en la raíz del proyecto frontend (si no existe)
2. Agrega tu Client ID:
```env
VITE_GOOGLE_CLIENT_ID=416865703135-esmidgum9of86k20nt1rp1hrntmeaoq1.apps.googleusercontent.com
VITE_API_BASE_URL=http://localhost:3000
```
3. **IMPORTANTE**: Reemplaza el Client ID con el tuyo real
4. Guarda el archivo
5. **Reinicia el servidor de desarrollo** (esto es crucial)

### Paso 2: Verificar la Configuración en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto
3. Ve a **APIs & Services** > **Credentials**
4. Encuentra tu OAuth 2.0 Client ID
5. Haz clic en el Client ID para editarlo

### Paso 3: Configurar Orígenes Autorizados

En la sección **Authorized JavaScript origins**, asegúrate de tener:

```
http://localhost:5173
http://localhost:3000
```

**NOTA**: 
- No incluyas la barra final (`/`)
- Usa `http` para desarrollo local (no `https`)
- El puerto debe coincidir con el puerto de tu servidor de desarrollo

### Paso 4: Configurar URIs de Redirección

En la sección **Authorized redirect URIs**, agrega:

```
http://localhost:5173
http://localhost:3000
```

### Paso 5: Verificar el Tipo de Aplicación

Asegúrate de que el tipo de aplicación sea **"Web application"** (no "Desktop app" ni "Mobile app").

### Paso 6: Verificar que el Client ID Esté Habilitado

En la lista de credenciales, verifica que tu Client ID esté **habilitado** (no deshabilitado).

### Paso 7: Verificar que el Backend Tenga el Mismo Client ID

1. Verifica que tu backend también tenga el mismo Client ID configurado
2. El Client ID debe estar en el archivo `.env` del backend
3. Asegúrate de que sea exactamente el mismo Client ID

### Paso 8: Limpiar Caché del Navegador

1. Abre las herramientas de desarrollo (F12)
2. Ve a la pestaña **Application** (o **Almacenamiento**)
3. Limpia las cookies y el almacenamiento local
4. Recarga la página

### Paso 9: Verificar la Consola del Navegador

1. Abre la consola del navegador (F12)
2. Busca errores relacionados con Google OAuth
3. Verifica que el Client ID se esté cargando correctamente

## 🔧 Verificación Rápida

Ejecuta este código en la consola del navegador para verificar que el Client ID se esté cargando:

```javascript
console.log('Client ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID);
```

Si muestra `undefined` o un valor incorrecto, el archivo `.env` no se está cargando correctamente.

## 🐛 Solución de Problemas Adicionales

### El Client ID no se carga desde .env

**Causa**: Vite necesita reiniciarse después de cambiar el archivo `.env`

**Solución**:
1. Detén el servidor de desarrollo (Ctrl+C)
2. Elimina la carpeta `node_modules/.vite` (opcional, pero recomendado)
3. Inicia el servidor nuevamente: `npm run dev`

### El error persiste después de configurar todo

**Causa**: Puede haber un problema con el Client ID en Google Cloud Console

**Solución**:
1. Crea un nuevo Client ID en Google Cloud Console
2. Configura los orígenes autorizados correctamente
3. Actualiza el Client ID en el archivo `.env`
4. Reinicia el servidor de desarrollo

### El error aparece solo en producción

**Causa**: Los orígenes autorizados no incluyen tu dominio de producción

**Solución**:
1. Agrega tu dominio de producción a los orígenes autorizados
2. Usa `https://` para producción (no `http://`)
3. Asegúrate de que el Client ID sea el correcto para producción

## 📝 Checklist

- [ ] El archivo `.env` existe en la raíz del proyecto
- [ ] El Client ID está configurado en `.env`
- [ ] El servidor de desarrollo se reinició después de agregar `.env`
- [ ] El Client ID está configurado en Google Cloud Console
- [ ] Los orígenes autorizados incluyen `http://localhost:5173`
- [ ] El tipo de aplicación es "Web application"
- [ ] El Client ID está habilitado en Google Cloud Console
- [ ] El backend tiene el mismo Client ID configurado
- [ ] Se limpió la caché del navegador

## 📚 Recursos Adicionales

- [Documentación de Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Documentación de @react-oauth/google](https://www.npmjs.com/package/@react-oauth/google)
- [Guía de Configuración de Google OAuth](./CONFIGURACION_GOOGLE_OAUTH.md)

## 💡 Notas Importantes

1. **No compartas tu Client ID**: Mantén tu Client ID privado y no lo subas a repositorios públicos
2. **Agrega .env a .gitignore**: Asegúrate de que el archivo `.env` esté en `.gitignore`
3. **Usa diferentes Client IDs para desarrollo y producción**: Crea credenciales separadas para cada entorno
4. **Reinicia el servidor después de cambiar .env**: Vite necesita reiniciarse para cargar las nuevas variables de entorno

## 🆘 Si Nada Funciona

1. Verifica los logs del backend para ver si hay errores adicionales
2. Revisa la consola del navegador para ver errores de JavaScript
3. Verifica que el backend esté corriendo y accesible
4. Intenta crear un nuevo Client ID en Google Cloud Console
5. Verifica que no haya problemas de CORS

