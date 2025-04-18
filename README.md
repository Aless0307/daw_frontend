# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Configuración de Audio para Accesibilidad

El proyecto utiliza archivos de audio pregrabados para mejorar la accesibilidad, especialmente en el componente de contraseña Braille. Para generar estos archivos:

1. Navega al directorio `daw_backend`:
   ```
   cd ../daw_backend
   ```

2. Ejecuta el script de generación de audio principal:
   ```
   npm run generate-audio
   ```

3. Ejecuta el script específico para generar los archivos de audio del Braille:
   ```
   npm run generate-braille-audio
   ```

Estos comandos generarán los archivos de audio necesarios en la carpeta `daw_frontend/public/audio/`.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript and enable type-aware lint rules. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
