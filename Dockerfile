# Usa una imagen base de Node.js
FROM node:16

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia el archivo package.json y package-lock.json al contenedor
COPY package.json package-lock.json ./

# Instala las dependencias de la aplicación
RUN npm install

# Copia el resto de los archivos del proyecto al contenedor
COPY . .

# Construye la aplicación React para producción
RUN npm run build

# Usa Nginx para servir la aplicación React
FROM nginx:alpine

# Copia los archivos construidos al directorio de Nginx
COPY --from=0 /app/build /usr/share/nginx/html

# Expone el puerto 80
EXPOSE 80

# Inicia Nginx
CMD ["nginx", "-g", "daemon off;"]
