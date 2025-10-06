## Instalación

Ejecuta `npm install` para instalar las dependencias.

## Ejecución de la aplicación

Ejecuta `npm run start` para iniciar la aplicación en modo de producción.

Ejecuta `npm run dev` para iniciar la aplicación en modo de desarrollo con nodemon.

## Configuración

La aplicación utiliza un archivo `.env` para almacenar variables de entorno. Puedes crear un archivo `.env` en el directorio raiz del proyecto con el siguiente formato:

## Variables de entorno

La aplicaci n utiliza las siguientes variables de entorno:

- `PORT`: El puerto para escuchar.
- `MONGO_URI`: La cadena de conexión de MongoDB.
- `JWT_SECRET`: La clave secreta para autenticación con JWT.
- `JWT_EXPIRE`: El tiempo de expiración para tokens JWT.
