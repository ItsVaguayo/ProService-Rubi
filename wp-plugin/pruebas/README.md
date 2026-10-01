# Pruebas del plugin

```bash
wp-plugin/pruebas/probar.sh
```

- Copia `~/wp-proservice/web` (la imitación de proservicerubi.com de `wordpress-pruebas/`) a una carpeta temporal, sin las fotos.
- Enlaza el plugin del repo y lo activa en la copia.
- Lanza `prueba.php`: crea coches como los deja la API por REST y comprueba el buscador, los filtros, la caché, la ficha y los ajustes.
- Al terminar borra la copia. El WordPress de pruebas no se toca.

Requisitos: el WordPress de pruebas montado (`wordpress-pruebas/montar.sh`), PHP 8 y WP-CLI. No hace falta que el servidor web esté arrancado.

`prueba.php` se niega a correr fuera de esa copia porque borra los coches.
