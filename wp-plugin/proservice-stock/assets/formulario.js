/* Formulario de contacto de un coche (plantillas/formulario.php). Sin JavaScript no se envía: la API no admite
   formularios clásicos.
   · Información y financiación: JSON a POST /api/contactos.
   · Tasación: lo mismo con el coche del cliente; con fotos, en multipart (hasta 5, de 10 MB).
   · Prueba: si el coche tiene referencia, elige día y hora de los huecos libres y va a POST /api/citas/pedir.
     Si no cargan los huecos o la persona prefiere que la llamen, se manda como contacto. */
(function () {
  var MAX_FOTOS = 5;
  var MB_FOTO = 10;
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // «2026-10-19» → «lunes 19 oct» (el día es de Rubí: se lee tal cual, sin pasar por la zona del navegador)
  function diaBonito(dia) {
    var p = dia.split('-').map(Number);
    var semana = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
    return DIAS[semana] + ' ' + p[2] + ' ' + MESES[p[1] - 1];
  }

  function iniciar(form) {
    var aviso = form.querySelector('[data-ps-aviso]');
    var boton = form.querySelector('button[type=submit]');
    var otraVia = form.getAttribute('data-whatsapp') ? ' o escríbenos por WhatsApp' : ' o llámanos';
    var coche = form.getAttribute('data-coche');
    var citas = coche ? form.getAttribute('data-citas') : '';
    var huecos = null; // { '2026-10-19': ['10:00', …] } cuando ya han cargado
    function campo(nombre) { return form.elements.namedItem(nombre); }

    function avisar(texto, error) {
      aviso.textContent = texto;
      aviso.hidden = false;
      aviso.style.color = error ? '#ff8a80' : '';
    }

    // Lo que solo va con un tipo: se enseña y pasa a ser obligatorio con ese tipo, y se esconde con los demás
    function segunTipo() {
      var tipo = campo('tipo').value;
      form.querySelectorAll('[data-ps-solo]').forEach(function (bloque) {
        var visible = bloque.getAttribute('data-ps-solo') === tipo && !(tipo === 'prueba' && !citas);
        bloque.hidden = !visible;
        bloque.querySelectorAll('[data-ps-obligatorio]').forEach(function (c) { c.required = visible; });
      });
      if (tipo === 'prueba' && citas && !huecos) cargarHuecos();
    }

    function cargarHuecos() {
      huecos = {};
      fetch(citas + '/huecos?dias=14', { credentials: 'omit' })
        .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
        .then(function (r) {
          var dia = campo('dia');
          dia.length = 1; // deja «Prefiero que me llaméis»
          (r.dias || []).forEach(function (d) {
            huecos[d.dia] = d.horas;
            dia.add(new Option(diaBonito(d.dia), d.dia));
          });
          if (!r.dias || !r.dias.length) form.querySelector('[data-ps-solo="prueba"]').hidden = true;
        })
        .catch(function () {
          // Sin huecos se puede pedir igual: se manda como contacto y le llaman
          form.querySelector('[data-ps-solo="prueba"]').hidden = true;
        });
    }

    function pintarHoras() {
      var hora = campo('hora');
      var lista = huecos && huecos[campo('dia').value];
      hora.length = 0;
      hora.disabled = !lista;
      hora.required = !!lista;
      (lista || []).forEach(function (h) { hora.add(new Option(h, h)); });
    }

    // «Pedir prueba», «Financiarlo» y «Tasar mi coche» de la ficha dejan elegido lo que se quiere
    var ambito = form.closest('.ps-web') || document;
    ambito.querySelectorAll('[data-ps-tipo]').forEach(function (enlace) {
      enlace.addEventListener('click', function () { campo('tipo').value = enlace.getAttribute('data-ps-tipo'); segunTipo(); });
    });
    campo('tipo').addEventListener('change', segunTipo);
    if (campo('dia')) campo('dia').addEventListener('change', pintarHoras);
    segunTipo();

    function enviar(url, cuerpo) {
      var json = !(cuerpo instanceof FormData);
      return fetch(url, {
        method: 'POST',
        headers: json ? { 'Content-Type': 'application/json' } : {},
        body: json ? JSON.stringify(cuerpo) : cuerpo,
        credentials: 'omit'
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (r) { return { status: res.status, ok: res.ok, error: r.error }; });
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (boton.disabled) return;
      var tipo = campo('tipo').value;
      var mensaje = campo('mensaje').value.trim();
      // Sin referencia (la web no tiene ese campo) se dice en el mensaje de qué coche se pregunta
      if (!coche) mensaje = ('Pregunta por el ' + form.getAttribute('data-sobre') + '\n' + mensaje).trim().slice(0, 2000);
      var datos = {
        nombre: campo('nombre').value.trim(),
        telefono: campo('telefono').value.trim(),
        tipo: tipo,
        mensaje: mensaje,
        privacidad: campo('privacidad').checked,
        web: campo('web').value
      };
      if (coche) datos.coche = coche;

      var destino = form.getAttribute('data-api');
      var cuerpo = datos;
      var hecho = 'Recibido. Te llamamos para hablar de este coche.';
      var dia = campo('dia') && !campo('dia').closest('[hidden]') ? campo('dia').value : '';

      if (tipo === 'prueba' && dia && campo('hora').value) {
        // Prueba con día y hora: va a la agenda (y la API apunta además el contacto)
        destino = citas + '/pedir';
        cuerpo = { coche: coche, inicio: dia + ' ' + campo('hora').value, nombre: datos.nombre, telefono: datos.telefono,
          mensaje: datos.mensaje, privacidad: datos.privacidad, web: datos.web };
        hecho = 'Te esperamos el ' + diaBonito(dia) + ' a las ' + campo('hora').value + '. Te llamamos para confirmarla.';
      } else if (tipo === 'tasacion') {
        ['tasacion_marca', 'tasacion_modelo', 'tasacion_anio', 'tasacion_km'].forEach(function (c) {
          if (campo(c).value.trim()) datos[c] = campo(c).value.trim();
        });
        var fotos = Array.prototype.slice.call(campo('fotos').files || []);
        if (fotos.length > MAX_FOTOS) { avisar('Como mucho ' + MAX_FOTOS + ' fotos.', true); return; }
        if (fotos.some(function (f) { return f.size > MB_FOTO * 1024 * 1024; })) { avisar('Cada foto puede ocupar ' + MB_FOTO + ' MB como mucho.', true); return; }
        if (fotos.length) {
          cuerpo = new FormData();
          Object.keys(datos).forEach(function (k) { cuerpo.append(k, String(datos[k])); });
          fotos.forEach(function (f) { cuerpo.append('fotos', f, f.name); });
        }
        hecho = 'Recibido. Miramos tu coche y te llamamos con la tasación.';
      }

      boton.disabled = true;
      boton.textContent = 'Enviando…';
      enviar(destino, cuerpo).then(function (r) {
        if (r.ok) {
          form.reset();
          huecos = null;
          segunTipo();
          avisar(hecho);
        } else if (r.status === 409 && destino !== form.getAttribute('data-api')) {
          avisar('Esa hora se acaba de coger. Elige otra.', true);
          huecos = null;
          cargarHuecos();
          pintarHoras();
        } else if (r.status === 429) {
          avisar('Has enviado varios mensajes seguidos. Prueba dentro de unos minutos' + otraVia + '.', true);
        } else if ((r.status === 400 || r.status === 413) && r.error) {
          avisar(r.error + '.', true);
        } else {
          avisar('No se ha podido enviar. Vuelve a intentarlo' + otraVia + '.', true);
        }
      }).catch(function () {
        avisar('No se ha podido enviar. Vuelve a intentarlo' + otraVia + '.', true);
      }).then(function () {
        boton.disabled = false;
        boton.textContent = 'Enviar';
      });
    });
  }

  function arrancar() { document.querySelectorAll('[data-ps-contacto]').forEach(iniciar); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
