export default function Acerca() {
  const nombre = "Alessandro";
  const año = new Date().getFullYear();

  function saludar() {
    return `Hola, ${nombre}!`;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Acerca de mí</h1>
      <p>{saludar()} Bienvenido a mi sitio web.</p>
      <p>© {año}</p>
    </div>
  );
}
