/**
 * Chama o Apps Script via JSONP (evita qualquer problema de CORS entre
 * o GitHub Pages e o script.google.com).
 */
function chamarAppsScript(params) {
  return new Promise(function (resolve, reject) {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('COLE_AQUI') !== -1) {
      reject(new Error('Configure a URL do Apps Script em js/config.js'));
      return;
    }
    var callbackName = 'cb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    var qs = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');

    var script = document.createElement('script');
    var timeout = setTimeout(function () {
      cleanup();
      reject(new Error('Tempo esgotado ao falar com o Apps Script.'));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = function (data) {
      cleanup();
      resolve(data);
    };
    script.onerror = function () {
      cleanup();
      reject(new Error('Não foi possível carregar dados do Apps Script.'));
    };
    script.src = APPS_SCRIPT_URL + '?' + qs + '&callback=' + callbackName;
    document.body.appendChild(script);
  });
}

function formatarMoeda(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarNumero(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR');
}

function formatarDataHora(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch (e) {
    return '—';
  }
}

/**
 * Envia dados para o Apps Script (rota de escrita, via doPost).
 * Usa Content-Type text/plain de propósito: isso evita o preflight
 * de CORS (que o Apps Script não responde bem), e o doPost() do
 * backend já sabe fazer JSON.parse do corpo mesmo assim.
 */
function enviarAppsScript(payload) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('COLE_AQUI') !== -1) {
    return Promise.reject(new Error('Configure a URL do Apps Script em js/config.js'));
  }
  return fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function (res) { return res.json(); });
}
