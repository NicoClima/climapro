// ClimaPro Service Worker v2
// IMPORTANTE: cada vez que se suban cambios a index.html/admin.html,
// subir este archivo también (con CACHE_NAME incrementado) para forzar
// que los celulares descarten la versión vieja guardada localmente.
const CACHE_NAME = 'climapro-v2';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/admin.html',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap'
];

// Rutas del "cascarón" de la app — SIEMPRE se intenta la red primero,
// para que las actualizaciones se reflejen de inmediato apenas hay señal.
// Si no hay red, se sirve la última versión guardada (modo offline).
const APP_SHELL = ['/', '/index.html', '/admin.html'];

function esAppShell(url){
  const path = new URL(url).pathname;
  return APP_SHELL.includes(path);
}

// Instalar: cachear archivos del sistema
self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(CACHE_URLS);
    }).then(function(){
      return self.skipWaiting(); // activar la nueva versión de inmediato
    })
  );
});

// Activar: limpiar cachés viejos de versiones anteriores
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){
      return self.clients.claim(); // tomar control de las pestañas abiertas ya mismo
    })
  );
});

// Fetch: estrategias según tipo de recurso
self.addEventListener('fetch', function(e){
  var url = e.request.url;

  // Supabase: Network First (intenta red, si falla usa caché)
  if(url.includes('supabase.co')){
    e.respondWith(
      fetch(e.request.clone()).then(function(resp){
        if(resp && resp.status === 200){
          var respClone = resp.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(e.request, respClone); });
        }
        return resp;
      }).catch(function(){
        return caches.match(e.request).then(function(cached){
          if(cached) return cached;
          return new Response(JSON.stringify([]), {headers: {'Content-Type': 'application/json'}});
        });
      })
    );
    return;
  }

  // App shell (index.html, admin.html, /): Network First
  // Así cada actualización se ve de inmediato apenas hay señal.
  if(e.request.mode === 'navigate' || esAppShell(url)){
    e.respondWith(
      fetch(e.request).then(function(resp){
        if(resp && resp.status === 200){
          var respClone = resp.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(e.request, respClone); });
        }
        return resp;
      }).catch(function(){
        // Sin red: servir la última versión guardada
        return caches.match(e.request).then(function(cached){
          return cached || caches.match('/index.html');
        });
      })
    );
    return;
  }

  // Otros assets (fuentes, etc.): Cache First
  e.respondWith(
    caches.match(e.request).then(function(cached){
      if(cached) return cached;
      return fetch(e.request).then(function(resp){
        if(resp && resp.status === 200){
          var respClone = resp.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(e.request, respClone); });
        }
        return resp;
      });
    })
  );
});

// Recibir mensaje para forzar sincronización
self.addEventListener('message', function(e){
  if(e.data === 'skipWaiting') self.skipWaiting();
});
