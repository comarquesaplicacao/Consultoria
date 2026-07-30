(function () {
  var CHAVE_KEY = 'comarques_chave_lancamentos';
  var estado = { headers: null, linhas: null, clientes: null, listas: null, edicaoLinha: null };

  function pegarChaveSalva() { return localStorage.getItem(CHAVE_KEY) || ''; }

  document.getElementById('btn-entrar').addEventListener('click', entrar);
  document.getElementById('input-chave').addEventListener('keydown', function (e) { if (e.key === 'Enter') entrar(); });

  // Se já tem chave salva, tenta entrar direto
  if (pegarChaveSalva()) carregar(pegarChaveSalva());

  function entrar() {
    var chave = document.getElementById('input-chave').value.trim();
    var msg = document.getElementById('msg-login');
    if (!chave) { msg.textContent = 'Informe a chave de acesso.'; msg.className = 'mensagem erro'; return; }
    var btn = document.getElementById('btn-entrar');
    btn.disabled = true; btn.textContent = 'Entrando…';
    carregar(chave, btn, msg);
  }

  function carregar(chave, btn, msg) {
    chamarAppsScript({ action: 'lancamentosdados', chave: chave })
      .then(function (res) {
        if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
        if (res.erro) {
          if (msg) { msg.textContent = res.erro; msg.className = 'mensagem erro'; }
          localStorage.removeItem(CHAVE_KEY);
          return;
        }
        localStorage.setItem(CHAVE_KEY, chave);
        estado.headers = res.headers; estado.linhas = res.linhas; estado.clientes = res.clientes; estado.listas = res.listas;
        montarApp();
      })
      .catch(function (err) {
        if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
        if (msg) { msg.textContent = err.message; msg.className = 'mensagem erro'; }
      });
  }

  function tipoCampo(h) {
    var l = h.toLowerCase();
    if (l === 'data') return 'date';
    if (l === 'valor') return 'number';
    return 'text';
  }
  function paraInputDate(v) {
    if (!v) return '';
    var d = new Date(v);
    if (isNaN(d)) return '';
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }
  function formatarValorCelula(v) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      var d = new Date(v);
      if (!isNaN(d)) return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    }
    return v;
  }

  var LISTA_POR_CAMPO = { 'Tipo': 'Tipo Lançamento', 'Natureza': 'Natureza Lançamento', 'Categoria': 'Categoria', 'Forma de Pagamento': 'Forma de Pagamento' };
  var COLUNA_ID = 'Id Lançamento';
  var COLUNA_CLIENTE = 'Id Cliente';

  function montarApp() {
    document.querySelector('.wrap').style.maxWidth = '980px';
    document.getElementById('conteudo').innerHTML =
      '<div class="card" style="max-width:640px;"><h3>Novo lançamento</h3>' +
      '<div id="campos-lanc" style="margin-top:14px;display:flex;flex-direction:column;gap:10px;"></div>' +
      '<div style="display:flex;gap:10px;margin-top:14px;">' +
      '<button id="btn-salvar" style="flex:1;">Adicionar lançamento</button>' +
      '<button id="btn-cancelar" type="button" style="display:none;background:var(--surface);color:var(--ink);border:1px solid var(--line);">Cancelar edição</button>' +
      '</div><p class="mensagem" id="msg-form"></p></div>' +
      '<div class="card" style="margin-top:24px;" id="area-tabela"></div>';

    montarCampos();
    renderTabela();

    document.getElementById('btn-cancelar').addEventListener('click', sairEdicao);
    document.getElementById('btn-salvar').addEventListener('click', salvar);
  }

  function montarCampos() {
    document.getElementById('campos-lanc').innerHTML = estado.headers.map(function (h) {
      if (h === COLUNA_ID) {
        return '<label style="font-size:12px;color:var(--muted);">' + h +
          '<input type="text" data-campo="' + h + '" disabled placeholder="(gerado automaticamente ao salvar)" style="margin-top:4px;background:#F5F5F5;"></label>';
      }
      if (h === COLUNA_CLIENTE) {
        return '<label style="font-size:12px;color:var(--muted);">' + h +
          '<select data-campo="' + h + '" style="margin-top:4px;"><option value=""></option>' +
          estado.clientes.map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('') +
          '</select></label>';
      }
      var nomeLista = LISTA_POR_CAMPO[h];
      if (nomeLista && estado.listas[nomeLista] && estado.listas[nomeLista].length) {
        return '<label style="font-size:12px;color:var(--muted);">' + h +
          '<select data-campo="' + h + '" style="margin-top:4px;"><option value=""></option>' +
          estado.listas[nomeLista].map(function (v) { return '<option value="' + v + '">' + v + '</option>'; }).join('') +
          '</select></label>';
      }
      var tipo = tipoCampo(h);
      var inputTipo = tipo === 'date' ? 'date' : (tipo === 'number' ? 'number' : 'text');
      return '<label style="font-size:12px;color:var(--muted);">' + h +
        '<input type="' + inputTipo + '" data-campo="' + h + '" style="margin-top:4px;"></label>';
    }).join('');
  }

  function preencherFormulario(linha) {
    document.querySelectorAll('#campos-lanc [data-campo]').forEach(function (el) {
      var h = el.getAttribute('data-campo');
      var v = linha.hasOwnProperty(h) ? linha[h] : '';
      if (el.tagName === 'SELECT') el.value = (v === null || v === undefined) ? '' : String(v);
      else if (el.type === 'date') el.value = paraInputDate(v);
      else el.value = (v === null || v === undefined) ? '' : v;
    });
  }

  function sairEdicao() {
    estado.edicaoLinha = null;
    document.getElementById('btn-salvar').textContent = 'Adicionar lançamento';
    document.getElementById('btn-cancelar').style.display = 'none';
    montarCampos();
  }

  function renderTabela() {
    var area = document.getElementById('area-tabela');
    area.innerHTML = '<h3>Lançamentos (' + estado.linhas.length + ')</h3>' +
      '<div style="overflow-x:auto;"><table><thead><tr>' +
      estado.headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '<th>Ações</th>' +
      '</tr></thead><tbody>' +
      estado.linhas.slice().reverse().map(function (l) {
        return '<tr>' + estado.headers.map(function (h) { return '<td>' + formatarValorCelula(l[h]) + '</td>'; }).join('') +
          '<td style="white-space:nowrap;">' +
          '<button type="button" class="btn-editar" data-linha="' + l._linha + '" style="padding:4px 10px;font-size:12px;margin-right:6px;">Editar</button>' +
          '<button type="button" class="btn-excluir" data-linha="' + l._linha + '" style="padding:4px 10px;font-size:12px;background:var(--danger);">Excluir</button>' +
          '</td></tr>';
      }).join('') + '</tbody></table></div>';

    area.querySelectorAll('.btn-editar').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var linhaNum = parseInt(btn.getAttribute('data-linha'), 10);
        var linha = estado.linhas.find(function (l) { return l._linha === linhaNum; });
        if (!linha) return;
        estado.edicaoLinha = linhaNum;
        montarCampos();
        preencherFormulario(linha);
        document.getElementById('btn-salvar').textContent = 'Salvar edição';
        document.getElementById('btn-cancelar').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    area.querySelectorAll('.btn-excluir').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Tem certeza que quer excluir esse lançamento? Não tem como desfazer.')) return;
        var linhaNum = parseInt(btn.getAttribute('data-linha'), 10);
        btn.disabled = true; btn.textContent = 'Excluindo…';
        enviarAppsScript({ action: 'lancamentosExcluir', chave: pegarChaveSalva(), linha: linhaNum })
          .then(function (res) {
            if (res.erro) { alert(res.erro); btn.disabled = false; btn.textContent = 'Excluir'; return; }
            if (estado.edicaoLinha === linhaNum) sairEdicao();
            recarregarDados();
          })
          .catch(function (err) { alert(err.message); btn.disabled = false; btn.textContent = 'Excluir'; });
      });
    });
  }

  function recarregarDados() {
    carregar(pegarChaveSalva());
  }

  function salvar() {
    var campos = {};
    document.querySelectorAll('#campos-lanc [data-campo]').forEach(function (el) {
      var h = el.getAttribute('data-campo');
      campos[h] = tipoCampo(h) === 'number' ? parseFloat(el.value || '0') : el.value;
    });
    var msg = document.getElementById('msg-form');
    var btn = document.getElementById('btn-salvar');
    var editando = estado.edicaoLinha !== null;
    btn.disabled = true; btn.textContent = 'Salvando…';

    var payload = editando
      ? { action: 'lancamentosEditar', chave: pegarChaveSalva(), linha: estado.edicaoLinha, campos: campos }
      : { action: 'lancamentosLancar', chave: pegarChaveSalva(), campos: campos };

    enviarAppsScript(payload)
      .then(function (res) {
        btn.disabled = false;
        if (res.erro) { btn.textContent = editando ? 'Salvar edição' : 'Adicionar lançamento'; msg.textContent = res.erro; msg.className = 'mensagem erro'; return; }
        msg.textContent = res.mensagem; msg.className = 'mensagem sucesso';
        if (editando) sairEdicao(); else { btn.textContent = 'Adicionar lançamento'; montarCampos(); }
        recarregarDados();
      })
      .catch(function (err) {
        btn.disabled = false; btn.textContent = editando ? 'Salvar edição' : 'Adicionar lançamento';
        msg.textContent = err.message; msg.className = 'mensagem erro';
      });
  }
})();
