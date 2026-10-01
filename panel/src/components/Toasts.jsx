import { useEffect, useState } from 'react';
import { escucharToasts } from '../lib/toast.js';

export default function Toasts() {
  const [lista, setLista] = useState([]);
  useEffect(
    () =>
      escucharToasts((a) => {
        setLista((l) => [...l, a]);
        setTimeout(() => setLista((l) => l.filter((x) => x.id !== a.id)), 3600);
      }),
    [],
  );
  return (
    <div className="toasts" aria-live="polite">
      {lista.map((a) => (
        <div key={a.id} className={`toast toast--${a.tipo}`}>{a.texto}</div>
      ))}
    </div>
  );
}
