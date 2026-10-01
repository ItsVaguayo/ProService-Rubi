// Explica por qué algo está desactivado: falta un endpoint o un dato del cliente.
export default function Pendiente({ titulo = 'Pendiente', children, compacto = false }) {
  return (
    <div className={`pendiente ${compacto ? 'pendiente--compacto' : ''}`} role="note">
      <span className="pendiente__marca" aria-hidden="true" />
      <div>
        <strong>{titulo}</strong>
        <span>{children}</span>
      </div>
    </div>
  );
}
