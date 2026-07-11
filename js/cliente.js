(function () {
  var CORES = { accent: '#6C4FD1', warm: '#8B7FE8', danger: '#C74B86' };
  var MESES_ABR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var ABAS = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'contratos', label: 'Contratos' },
    { id: 'vagas', label: 'Vagas' },
    { id: 'equipe', label: 'Equipe' }
  ];
  var estado = { dados: null, aba: 'resumo', deMonth: null, ateMonth: null, email: '', senha: '' };
  var chartsAtivos = [];

  document.getElementById('btn-solicitar').addEventListener('click', entrar);
  document.getElementById('input-senha').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') entrar();
  });

  function entrar() {
    var email = document.getElementById('input-email').value.trim();
    var senha = document.getElementById('input-senha').value.trim();
    var msg = document.getElementById('msg-login');
    if (!email || !senha) { msg.textContent = 'Informe e-mail e senha.'; msg.className = 'mensagem erro'; return; }

    var btn = document.getElementById('btn-solicitar');
    btn.disabled = true; btn.textContent = 'Entrando…';
    msg.textContent = ''; msg.className = 'mensagem';

    chamarAppsScript({ action: 'cliente', email: email, senha: senha })
      .then(function (res) {
        btn.disabled = false; btn.textContent = 'Entrar';
        if (res.erro) { msg.textContent = res.erro; msg.className = 'mensagem erro'; return; }
        estado.dados = res;
        estado.email = email;
        estado.senha = senha;
        montarApp();
      })
      .catch(function (err) {
        btn.disabled = false; btn.textContent = 'Entrar';
        msg.textContent = err.message; msg.className = 'mensagem erro';
      });
  }

  /* ---------------- Utilidades de data/agregação (mesmo padrão do painel interno) ---------------- */

  function monthKeyISO(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d)) return null;
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
  }
  function rotuloMes(mk) { var p = mk.split('-'); return MESES_ABR[parseInt(p[1], 10) - 1] + '/' + p[0].slice(2); }
  function dentroPeriodo(mk) { return mk && mk >= estado.deMonth && mk <= estado.ateMonth; }

  function getFiltrado() {
    var d = estado.dados;
    return {
      entrada: d.entrada.filter(function (r) { return dentroPeriodo(monthKeyISO(r.data)); }),
      orcamentos: d.orcamentos.filter(function (o) { return dentroPeriodo(monthKeyISO(o.fechamento || o.inicio)); }),
      servicos: d.servicos.filter(function (s) { return dentroPeriodo(monthKeyISO(s.abertura || s.fechamento)); }),
      colaboradores: d.colaboradores
    };
  }

  function serieMensal(lista) {
    var mapa = {};
    lista.forEach(function (i) { var mk = monthKeyISO(i.data); if (mk) mapa[mk] = (mapa[mk] || 0) + i.valor; });
    return Object.keys(mapa).sort().map(function (mk) { return { mes: mk, rotulo: rotuloMes(mk), valor: mapa[mk] }; });
  }

  /* ---------------- Montagem do app pós-login ---------------- */

  function montarApp() {
    document.body.innerHTML =
      '<div class="app-shell">' +
      '<aside class="sidebar">' +
      '<div class="brand"><img src="assets/logo-mark.png" alt="" class="brand-mark"><p class="eyebrow">Portal do cliente</p><strong>' + estado.dados.empresa + '</strong></div>' +
      '<nav id="nav-abas"></nav>' +
      '</aside>' +
      '<div class="main-area">' +
      '<header class="topbar"><h1 id="titulo-aba">Resumo</h1>' +
      '<div class="filtro-grupo"><span>Período</span><input type="month" id="filtro-de"><span>até</span><input type="month" id="filtro-ate"></div>' +
      '</header>' +
      '<main class="content-area" id="conteudo"></main>' +
      '</div></div>';

    var meses = {};
    estado.dados.entrada.forEach(function (r) { var mk = monthKeyISO(r.data); if (mk) meses[mk] = true; });
    estado.dados.orcamentos.forEach(function (o) { var mk = monthKeyISO(o.fechamento || o.inicio); if (mk) meses[mk] = true; });
    estado.dados.servicos.forEach(function (s) { var mk = monthKeyISO(s.abertura || s.fechamento); if (mk) meses[mk] = true; });
    var ordenados = Object.keys(meses).sort();
    estado.deMonth = ordenados[0] || '2026-01';
    estado.ateMonth = ordenados[ordenados.length - 1] || '2026-12';

    var inputDe = document.getElementById('filtro-de');
    var inputAte = document.getElementById('filtro-ate');
    inputDe.value = estado.deMonth;
    inputAte.value = estado.ateMonth;
    inputDe.addEventListener('change', function () { estado.deMonth = inputDe.value; renderAba(); });
    inputAte.addEventListener('change', function () { estado.ateMonth = inputAte.value; renderAba(); });

    var nav = document.getElementById('nav-abas');
    nav.innerHTML = ABAS.map(function (a, i) {
      return '<button data-aba="' + a.id + '" class="' + (a.id === estado.aba ? 'ativo' : '') + '">' +
        '<span class="n">' + String(i + 1).padStart(2, '0') + '</span><span>' + a.label + '</span></button>';
    }).join('');
    nav.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        estado.aba = btn.getAttribute('data-aba');
        nav.querySelectorAll('button').forEach(function (b) { b.classList.remove('ativo'); });
        btn.classList.add('ativo');
        document.getElementById('titulo-aba').textContent = ABAS.find(function (a) { return a.id === estado.aba; }).label;
        renderAba();
      });
    });
    renderAba();
  }

  function destruirGraficos() { chartsAtivos.forEach(function (c) { c.destroy(); }); chartsAtivos = []; }
  function criarChart(el, config) { var c = new Chart(el, config); chartsAtivos.push(c); return c; }

  function renderAba() {
    destruirGraficos();
    var f = getFiltrado();
    var fn = { resumo: renderResumo, contratos: renderContratos, vagas: renderVagas, equipe: renderEquipe }[estado.aba];
    fn(f);
  }

  function renderResumo(f) {
    var totalPago = f.entrada.reduce(function (t, r) { return t + r.valor; }, 0);
    var candidatados = f.servicos.reduce(function (t, s) { return t + s.candidatados; }, 0);
    var entrevistados = f.servicos.reduce(function (t, s) { return t + s.entrevistados; }, 0);
    var contratados = f.servicos.filter(function (s) { return s.status === 'Contratado'; }).length;
    var ativos = f.colaboradores.filter(function (c) { return !c.demissao; }).length;

    document.getElementById('conteudo').innerHTML =
      '<div class="kpi-row">' +
      '<div class="kpi positivo"><div class="label">Total investido com a CoMarques</div><div class="value">' + formatarMoeda(totalPago) + '</div></div>' +
      '<div class="kpi"><div class="label">Colaboradores ativos</div><div class="value">' + formatarNumero(ativos) + '</div></div>' +
      '<div class="kpi"><div class="label">Vagas com contratação</div><div class="value">' + formatarNumero(contratados) + '</div></div>' +
      '</div>' +
      '<div class="funil" style="margin-top:24px;">' +
      '<div class="funil-etapa"><div class="label">Candidatados</div><div class="value">' + formatarNumero(candidatados) + '</div></div>' +
      '<div class="funil-etapa"><div class="label">Entrevistados</div><div class="value">' + formatarNumero(entrevistados) + '</div></div>' +
      '<div class="funil-etapa"><div class="label">Contratados</div><div class="value">' + formatarNumero(contratados) + '</div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:24px;"><h3>Evolução do investimento</h3><canvas id="chart-cliente" height="140"></canvas></div>';

    var serie = serieMensal(f.entrada);
    criarChart(document.getElementById('chart-cliente'), {
      type: 'line',
      data: { labels: serie.map(function (m) { return m.rotulo; }), datasets: [{ data: serie.map(function (m) { return m.valor; }), borderColor: CORES.accent, backgroundColor: 'rgba(108,79,209,0.12)', fill: true, tension: 0.3, pointRadius: 3 }] },
      options: { plugins: { legend: { display: false } } }
    });
  }

  function renderContratos(f) {
    document.getElementById('conteudo').innerHTML = '<div class="card"><h3>Contratos / orçamentos no período</h3>' +
      tabela(['Categoria', 'Tipo', 'Valor', 'Status'], f.orcamentos.map(function (o) { return [o.categoria, o.tipo, formatarMoeda(o.valor), badge(o.status)]; })) +
      '</div>';
  }

  function renderVagas(f) {
    document.getElementById('conteudo').innerHTML = '<div class="card"><h3>Vagas no período</h3>' +
      tabela(['Cargo', 'Candidatados', 'Entrevistados', 'Status'], f.servicos.map(function (s) { return [s.cargo, formatarNumero(s.candidatados), formatarNumero(s.entrevistados), badge(s.status)]; })) +
      '</div>';
  }

  function renderEquipe(f) {
    document.getElementById('conteudo').innerHTML = '<div class="card"><h3>Seus colaboradores</h3>' +
      tabela(['Nome', 'Cargo', 'Salário atual', 'Situação'], f.colaboradores.map(function (c) {
        return [c.nome, c.cargo, formatarMoeda(c.salarioAtual), c.demissao ? badge('Desligado') : badge('Ativo')];
      })) + '</div>';
  }

  var CAMPOS_POR_CATEGORIA = {
    'Nova vaga': [
      { id: 'cargo', label: 'Cargo', tipo: 'text' },
      { id: 'tipoVaga', label: 'Tipo de vaga (Operacional/Gestão/etc.)', tipo: 'text' },
      { id: 'quantidade', label: 'Quantidade de vagas', tipo: 'number' },
      { id: 'remuneracao', label: 'Remuneração prevista', tipo: 'text' },
      { id: 'observacoes', label: 'Observações', tipo: 'textarea' }
    ],
    'Atualização de colaborador': [
      { id: 'tipoAtualizacao', label: 'Tipo (Admissão/Demissão/Alteração salarial)', tipo: 'text' },
      { id: 'nome', label: 'Nome do colaborador', tipo: 'text' },
      { id: 'cargo', label: 'Cargo', tipo: 'text' },
      { id: 'data', label: 'Data', tipo: 'date' },
      { id: 'salario', label: 'Salário (se aplicável)', tipo: 'text' },
      { id: 'observacoes', label: 'Observações', tipo: 'textarea' }
    ],
    'Outro': [
      { id: 'assunto', label: 'Assunto', tipo: 'text' },
      { id: 'descricao', label: 'Descrição', tipo: 'textarea' }
    ]
  };

  function renderEnviar() {
    var categorias = Object.keys(CAMPOS_POR_CATEGORIA);
    document.getElementById('conteudo').innerHTML =
      '<div class="card" style="max-width:520px;">' +
      '<h3>Enviar dados pro seu consultor</h3>' +
      '<p style="color:var(--muted);font-size:13px;margin-top:-8px;">Preenche aqui em vez de mandar por WhatsApp/e-mail — cai direto na fila de revisão.</p>' +
      '<div style="margin-top:16px;">' +
      '<select id="sel-categoria">' + categorias.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('') + '</select>' +
      '<div id="campos-dinamicos" style="margin-top:12px;display:flex;flex-direction:column;gap:10px;"></div>' +
      '<button id="btn-enviar-solicitacao" style="width:100%;margin-top:14px;">Enviar</button>' +
      '<p class="mensagem" id="msg-enviar"></p>' +
      '</div></div>';

    var sel = document.getElementById('sel-categoria');
    function montarCampos() {
      var campos = CAMPOS_POR_CATEGORIA[sel.value];
      document.getElementById('campos-dinamicos').innerHTML = campos.map(function (c) {
        if (c.tipo === 'textarea') return '<textarea id="campo-' + c.id + '" placeholder="' + c.label + '" rows="3" style="font-family:var(--font-body);font-size:14px;padding:10px;border:1px solid var(--line);border-radius:6px;width:100%;"></textarea>';
        return '<input type="' + c.tipo + '" id="campo-' + c.id + '" placeholder="' + c.label + '">';
      }).join('');
    }
    sel.addEventListener('change', montarCampos);
    montarCampos();

    document.getElementById('btn-enviar-solicitacao').addEventListener('click', function () {
      var categoria = sel.value;
      var campos = {};
      CAMPOS_POR_CATEGORIA[categoria].forEach(function (c) {
        campos[c.label] = document.getElementById('campo-' + c.id).value.trim();
      });
      var msg = document.getElementById('msg-enviar');
      var btn = document.getElementById('btn-enviar-solicitacao');
      btn.disabled = true; btn.textContent = 'Enviando…';

      enviarAppsScript({ action: 'enviarSolicitacao', email: estado.email, senha: estado.senha, categoria: categoria, campos: campos })
        .then(function (res) {
          btn.disabled = false; btn.textContent = 'Enviar';
          if (res.erro) { msg.textContent = res.erro; msg.className = 'mensagem erro'; return; }
          msg.textContent = res.mensagem; msg.className = 'mensagem sucesso';
          montarCampos();
        })
        .catch(function (err) {
          btn.disabled = false; btn.textContent = 'Enviar';
          msg.textContent = err.message; msg.className = 'mensagem erro';
        });
    });
  }

  function tabela(cabecalhos, linhas) {
    if (!linhas.length) return '<p style="color:var(--muted);">Nenhum registro no período selecionado.</p>';
    return '<table><thead><tr>' + cabecalhos.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead>' +
      '<tbody>' + linhas.map(function (l) { return '<tr>' + l.map(function (v) { return '<td>' + v + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }

  function badge(status) {
    var s = String(status || '').toLowerCase();
    var classe = 'ok';
    if (s.indexOf('suspens') !== -1 || s.indexOf('reprov') !== -1 || s.indexOf('desliga') !== -1) classe = 'alerta';
    else if (s.indexOf('andamento') !== -1 || s.indexOf('aberto') !== -1) classe = 'pendente';
    return '<span class="badge ' + classe + '">' + status + '</span>';
  }
})();
