(function () {
  var CHAVE_KEY = 'comarques_chave_interna';
  var CORES = { accent: '#6C4FD1', warm: '#8B7FE8', danger: '#C74B86', linha: '#E7E3F5', accentSoft: '#B9A8ED', warmSoft: '#C9BFF0' };
  var PALETA_DONUT = ['#6C4FD1', '#8B7FE8', '#C74B86', '#B9A8ED', '#4A3A85'];

  var ABAS = [
    { id: 'visao', label: 'Visão geral' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'operacional', label: 'Operacional' },
    { id: 'comercial', label: 'Comercial' },
    { id: 'clientes', label: 'Clientes' },
    { id: 'vagas', label: 'Vagas' },
    { id: 'metas', label: 'Metas' },
    { id: 'solicitacoes', label: 'Solicitações' },
    { id: 'lancar', label: 'Lançar dados' }
  ];

  var estado = { dados: null, abaAtual: 'visao', deMonth: null, ateMonth: null, clienteId: 'todos', filtroStatusVaga: 'todos', filtroTipoVagaOp: 'todos', filtroStatusOp: 'todos', filtroCategoriaCom: 'todos', filtroStatusCom: 'todos' };
  var chartsAtivos = [];

  function pegarChaveSalva() { return localStorage.getItem(CHAVE_KEY) || ''; }

  function iniciar() {
    chamarAppsScript({ action: 'painel', chave: pegarChaveSalva() })
      .then(function (dados) {
        if (dados.erro) {
          if (dados.erro.indexOf('Chave') !== -1) return pedirChave(dados.erro);
          return erroTela(dados.erro);
        }
        estado.dados = dados;
        montarFiltros();
        montarSidebar();
        renderAba();
      })
      .catch(function (err) { erroTela(err.message); });
  }

  function pedirChave(msg) {
    document.getElementById('conteudo').innerHTML =
      '<div class="estado"><h2>Acesso protegido</h2><p>' + msg + '</p>' +
      '<div class="form-row" style="max-width:320px;margin:20px auto 0;">' +
      '<input type="text" id="input-chave" placeholder="Chave de acesso"><button id="btn-entrar">Entrar</button></div></div>';
    document.getElementById('btn-entrar').addEventListener('click', function () {
      localStorage.setItem(CHAVE_KEY, document.getElementById('input-chave').value.trim());
      iniciar();
    });
  }

  function erroTela(msg) {
    document.getElementById('conteudo').innerHTML = '<div class="estado"><h2>Não foi possível carregar</h2><p>' + msg + '</p></div>';
  }

  /* ---------------- Filtros globais ---------------- */

  function monthKeyISO(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d)) return null;
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
  }

  function montarFiltros() {
    var meses = {};
    estado.dados.entrada.forEach(function (r) { var mk = monthKeyISO(r.data); if (mk) meses[mk] = true; });
    estado.dados.orcamentos.forEach(function (o) { var mk = monthKeyISO(o.fechamento || o.inicio); if (mk) meses[mk] = true; });
    estado.dados.metas.forEach(function (m) { meses[m.ano + '-' + String(m.mesIndex + 1).padStart(2, '0')] = true; });
    var ordenados = Object.keys(meses).sort();
    estado.deMonth = ordenados[0] || '2026-01';
    estado.ateMonth = ordenados[ordenados.length - 1] || '2026-12';

    var inputDe = document.getElementById('filtro-de');
    var inputAte = document.getElementById('filtro-ate');
    inputDe.value = estado.deMonth;
    inputAte.value = estado.ateMonth;
    inputDe.addEventListener('change', function () { estado.deMonth = inputDe.value; renderAba(); });
    inputAte.addEventListener('change', function () { estado.ateMonth = inputAte.value; renderAba(); });

    var selCliente = document.getElementById('filtro-cliente');
    estado.dados.clientes.forEach(function (c) {
      var op = document.createElement('option');
      op.value = c.id; op.textContent = c.nome;
      selCliente.appendChild(op);
    });
    selCliente.addEventListener('change', function () { estado.clienteId = selCliente.value; renderAba(); });
  }

  function montarSidebar() {
    var nav = document.getElementById('nav-abas');
    nav.innerHTML = ABAS.map(function (a, i) {
      return '<button data-aba="' + a.id + '" class="' + (a.id === estado.abaAtual ? 'ativo' : '') + '">' +
        '<span class="n">' + String(i + 1).padStart(2, '0') + '</span><span>' + a.label + '</span></button>';
    }).join('');
    nav.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        estado.abaAtual = btn.getAttribute('data-aba');
        nav.querySelectorAll('button').forEach(function (b) { b.classList.remove('ativo'); });
        btn.classList.add('ativo');
        document.getElementById('titulo-aba').textContent = ABAS.find(function (a) { return a.id === estado.abaAtual; }).label;
        renderAba();
      });
    });
  }

  function dentroPeriodo(mk) { return mk && mk >= estado.deMonth && mk <= estado.ateMonth; }
  function mesmoCliente(idCliente) { return estado.clienteId === 'todos' || String(idCliente) === String(estado.clienteId); }

  function getFiltrado() {
    var d = estado.dados;
    return {
      entrada: d.entrada.filter(function (r) { return dentroPeriodo(monthKeyISO(r.data)) && mesmoCliente(r.idCliente); }),
      saida: d.saida.filter(function (r) { return dentroPeriodo(monthKeyISO(r.data)) && (estado.clienteId === 'todos' || r.idCliente === null || String(r.idCliente) === String(estado.clienteId)); }),
      orcamentos: d.orcamentos.filter(function (o) { return dentroPeriodo(monthKeyISO(o.fechamento || o.inicio)) && mesmoCliente(o.idCliente); }),
      servicos: d.servicos.filter(function (s) { return dentroPeriodo(monthKeyISO(s.abertura || s.fechamento)) && mesmoCliente(s.idCliente); }),
      metas: d.metas.filter(function (m) { return dentroPeriodo(m.ano + '-' + String(m.mesIndex + 1).padStart(2, '0')); }),
      clientes: estado.clienteId === 'todos' ? d.clientes : d.clientes.filter(function (c) { return String(c.id) === String(estado.clienteId); })
    };
  }

  /* ---------------- Utilidades de agregação ---------------- */

  function somar(lista, campo) { return lista.reduce(function (t, i) { return t + (Number(i[campo]) || 0); }, 0); }
  function agruparSoma(lista, campo, campoValor) {
    var mapa = {};
    lista.forEach(function (i) { var k = i[campo] || '—'; mapa[k] = (mapa[k] || 0) + (Number(i[campoValor]) || 0); });
    return mapa;
  }
  function agruparContagem(lista, campo) {
    var mapa = {};
    lista.forEach(function (i) { var k = i[campo] || '—'; mapa[k] = (mapa[k] || 0) + 1; });
    return mapa;
  }
  function serieMensal(lista, campoData, campoValor) {
    var mapa = {};
    lista.forEach(function (i) { var mk = monthKeyISO(i[campoData]); if (mk) mapa[mk] = (mapa[mk] || 0) + (Number(i[campoValor]) || 0); });
    return Object.keys(mapa).sort().map(function (mk) { return { mes: mk, rotulo: rotuloMes(mk), valor: mapa[mk] }; });
  }
  var MESES_ABR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function rotuloMes(mk) { var p = mk.split('-'); return MESES_ABR[parseInt(p[1], 10) - 1] + '/' + p[0].slice(2); }

  function destruirGraficos() { chartsAtivos.forEach(function (c) { c.destroy(); }); chartsAtivos = []; }
  function criarChart(el, config) { var c = new Chart(el, config); chartsAtivos.push(c); return c; }

  function secTitle(titulo, desc) {
    return '<div class="section-title"><h2>' + titulo + '</h2><span class="desc">' + (desc || '') + '</span></div>';
  }
  function kpi(label, valor, classe) {
    return '<div class="kpi ' + (classe || '') + '"><div class="label">' + label + '</div><div class="value">' + valor + '</div></div>';
  }
  function ranking(itens) {
    var maior = itens.length ? Math.max.apply(null, itens.map(function (i) { return i.valor; })) || 1 : 1;
    return '<div class="ranking">' + itens.map(function (it, i) {
      var pct = Math.round((it.valor / maior) * 100);
      return '<div><div class="nome-valor"><span>' + (i + 1) + '. ' + it.nome + '</span><span class="valor">' + formatarMoeda(it.valor) + '</span></div>' +
        '<div class="barra-bg"><div class="barra" style="width:' + pct + '%"></div></div></div>';
    }).join('') + '</div>';
  }
  function tabela(cabecalhos, linhas) {
    if (!linhas.length) return '<p style="color:var(--muted);">Nenhum registro no período/filtro selecionado.</p>';
    return '<table><thead><tr>' + cabecalhos.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead>' +
      '<tbody>' + linhas.map(function (l) { return '<tr>' + l.map(function (v) { return '<td>' + v + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function badge(status) {
    var s = String(status || '').toLowerCase(); var classe = 'ok';
    if (s.indexOf('suspens') !== -1 || s.indexOf('reprov') !== -1) classe = 'alerta';
    else if (s.indexOf('andamento') !== -1) classe = 'pendente';
    return '<span class="badge ' + classe + '">' + status + '</span>';
  }
  function donutCard(titulo, id, mapa, cores) {
    var chaves = Object.keys(mapa);
    var legenda = chaves.map(function (k, i) {
      return '<div class="item"><span class="dot" style="background:' + cores[i % cores.length] + '"></span>' + k + ' — ' + mapa[k] + '</div>';
    }).join('');
    return '<div class="card"><h3>' + titulo + '</h3><div class="donut-wrap"><canvas id="' + id + '"></canvas><div class="donut-legend">' + legenda + '</div></div></div>';
  }
  function desenharDonut(id, mapa, cores) {
    var el = document.getElementById(id); if (!el) return;
    criarChart(el, { type: 'doughnut', data: { labels: Object.keys(mapa), datasets: [{ data: Object.values(mapa), backgroundColor: cores, borderWidth: 0 }] }, options: { plugins: { legend: { display: false } }, cutout: '65%' } });
  }

  /* ---------------- Render por aba ---------------- */

  function renderAba() {
    destruirGraficos();
    var f = getFiltrado();
    var fn = { visao: renderVisao, financeiro: renderFinanceiro, operacional: renderOperacional, comercial: renderComercial, clientes: renderClientes, vagas: renderVagas, metas: renderMetas, solicitacoes: renderSolicitacoes, lancar: renderLancar }[estado.abaAtual];
    document.getElementById('conteudo').innerHTML = fn.html(f);
    if (fn.chart) fn.chart(f);
  }

  // ---- Visão geral ----
  function renderVisao(f) {
    var faturamento = somar(f.entrada, 'valor');
    var despesas = somar(f.saida, 'valor');
    var lucro = faturamento - despesas;
    var aprovados = f.orcamentos.filter(function (o) { return String(o.status).indexOf('Aprovado') !== -1; }).length;
    var totalOrc = f.orcamentos.length;
    var vagasAbertas = f.servicos.filter(function (s) { return s.status !== 'Contratado' && s.status !== 'Suspensa'; }).length;
    var contratados = f.servicos.filter(function (s) { return s.status === 'Contratado'; }).length;

    var statusVagas = agruparContagem(f.servicos, 'status');

    return secTitle('Resumo do período', f.entrada.length + ' lançamento(s) de faturamento') +
      '<div class="kpi-row">' +
      kpi('Faturamento', formatarMoeda(faturamento), 'positivo') +
      kpi('Despesas', formatarMoeda(despesas), 'negativo') +
      kpi('Lucro', formatarMoeda(lucro), lucro >= 0 ? 'positivo' : 'negativo') +
      kpi('Margem', faturamento ? Math.round((lucro / faturamento) * 100) + '%' : '—') +
      '</div>' +
      '<div class="grid-2" style="margin-top:24px;">' +
      '<div class="card"><h3>Evolução do faturamento</h3><canvas id="chart-visao-evolucao" height="160"></canvas></div>' +
      donutCard('Vagas por status', 'chart-visao-vagas', statusVagas, PALETA_DONUT) +
      '</div>' +
      '<div class="grid-2" style="margin-top:24px;">' +
      '<div class="card"><h3>Top clientes por faturamento</h3><canvas id="chart-visao-clientes" height="200"></canvas></div>' +
      '<div class="card"><h3>Resumo do período</h3><ul class="resumo-lista">' +
      '<li>' + contratados + ' contratação(ões) fechada(s), ' + vagasAbertas + ' vaga(s) ainda em aberto</li>' +
      '<li>' + aprovados + ' de ' + totalOrc + ' orçamento(s) aprovados (' + (totalOrc ? Math.round(aprovados / totalOrc * 100) : 0) + '%)</li>' +
      '<li>Ticket médio de faturamento: ' + formatarMoeda(f.entrada.length ? faturamento / f.entrada.length : 0) + '</li>' +
      '</ul></div></div>';
  }
  renderVisao.html = renderVisao;
  renderVisao.chart = function (f) {
    var serie = serieMensal(f.entrada, 'data', 'valor');
    criarChart(document.getElementById('chart-visao-evolucao'), { type: 'line', data: { labels: serie.map(function (m) { return m.rotulo; }), datasets: [{ data: serie.map(function (m) { return m.valor; }), borderColor: CORES.accent, backgroundColor: 'rgba(44,95,90,0.12)', fill: true, tension: 0.3 }] }, options: { plugins: { legend: { display: false } } } });
    desenharDonut('chart-visao-vagas', agruparContagem(f.servicos, 'status'), PALETA_DONUT);

    var topClientes = Object.entries(agruparSoma(f.entrada, 'clienteNome', 'valor')).map(function (e) { return { nome: e[0], valor: e[1] }; }).sort(function (a, b) { return b.valor - a.valor; }).slice(0, 8);
    criarChart(document.getElementById('chart-visao-clientes'), {
      type: 'bar',
      data: { labels: topClientes.map(function (c) { return c.nome; }), datasets: [{ data: topClientes.map(function (c) { return c.valor; }), backgroundColor: CORES.accent, borderRadius: 4 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { autoSkip: false, maxRotation: 40, minRotation: 40 } }, y: { grid: { color: CORES.linha } } } }
    });
  };

  // ---- Financeiro ----
  function renderFinanceiro(f) {
    var faturamento = somar(f.entrada, 'valor'), despesas = somar(f.saida, 'valor'), lucro = faturamento - despesas;
    var despesasAtribuidas = somar(f.saida.filter(function (r) { return r.idCliente; }), 'valor');
    var despesasGerais = despesas - despesasAtribuidas;
    var porCategoriaDespesa = Object.entries(agruparSoma(f.saida, 'categoria', 'valor')).map(function (e) { return { nome: e[0], valor: e[1] }; }).sort(function (a, b) { return b.valor - a.valor; });
    var porFormaPgto = Object.entries(agruparSoma(f.entrada, 'formaPgto', 'valor')).map(function (e) { return { nome: e[0], valor: e[1] }; }).sort(function (a, b) { return b.valor - a.valor; });
    return secTitle('Financeiro', 'Faturamento, despesas e margem no período') +
      '<div class="kpi-row">' + kpi('Faturamento', formatarMoeda(faturamento), 'positivo') + kpi('Despesas', formatarMoeda(despesas), 'negativo') + kpi('Lucro líquido', formatarMoeda(lucro), lucro >= 0 ? 'positivo' : 'negativo') + kpi('Margem líquida', faturamento ? Math.round(lucro / faturamento * 100) + '%' : '—') + '</div>' +
      '<div class="kpi-row" style="margin-top:16px;">' + kpi('Despesas atribuídas a clientes', formatarMoeda(despesasAtribuidas)) + kpi('Despesas gerais (overhead)', formatarMoeda(despesasGerais)) + '</div>' +
      '<div class="card" style="margin-top:24px;"><h3>Evolução: faturamento x despesas x lucro</h3><canvas id="chart-fin-evolucao" height="150"></canvas></div>' +
      '<div class="grid-2" style="margin-top:24px;">' +
      '<div class="card"><h3>Despesas por categoria</h3>' + ranking(porCategoriaDespesa) + '</div>' +
      '<div class="card"><h3>Receita por forma de pagamento</h3>' + ranking(porFormaPgto) + '</div>' +
      '</div>';
  }
  renderFinanceiro.html = renderFinanceiro;
  renderFinanceiro.chart = function (f) {
    var fat = serieMensal(f.entrada, 'data', 'valor');
    var desp = serieMensal(f.saida, 'data', 'valor');
    var meses = Array.from(new Set(fat.map(function (m) { return m.mes; }).concat(desp.map(function (m) { return m.mes; })))).sort();
    var fatMap = {}; fat.forEach(function (m) { fatMap[m.mes] = m.valor; });
    var despMap = {}; desp.forEach(function (m) { despMap[m.mes] = m.valor; });
    criarChart(document.getElementById('chart-fin-evolucao'), {
      type: 'line',
      data: { labels: meses.map(rotuloMes), datasets: [
        { label: 'Faturamento', data: meses.map(function (m) { return fatMap[m] || 0; }), borderColor: CORES.accent, tension: 0.3 },
        { label: 'Despesas', data: meses.map(function (m) { return despMap[m] || 0; }), borderColor: CORES.danger, tension: 0.3 },
        { label: 'Lucro', data: meses.map(function (m) { return (fatMap[m] || 0) - (despMap[m] || 0); }), borderColor: CORES.warm, tension: 0.3, borderDash: [4, 3] }
      ] },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  };

  // ---- Operacional ----
  function renderOperacional(f) {
    var tiposDisponiveis = Array.from(new Set(f.servicos.map(function (s) { return s.tipoVaga; }))).filter(Boolean);
    var statusDisponiveis = Array.from(new Set(f.servicos.map(function (s) { return s.status; }))).filter(Boolean);
    var servicosFiltrados = f.servicos
      .filter(function (s) { return estado.filtroTipoVagaOp === 'todos' || s.tipoVaga === estado.filtroTipoVagaOp; })
      .filter(function (s) { return estado.filtroStatusOp === 'todos' || s.status === estado.filtroStatusOp; });

    var candidatados = somar(servicosFiltrados, 'candidatados'), entrevistados = somar(servicosFiltrados, 'entrevistados');
    var contratados = servicosFiltrados.filter(function (s) { return s.status === 'Contratado'; });
    var vagasAbertas = servicosFiltrados.filter(function (s) { return s.status !== 'Contratado' && s.status !== 'Suspensa'; }).length;
    var temposDias = contratados.filter(function (s) { return s.abertura && s.fechamento; }).map(function (s) { return Math.round((new Date(s.fechamento) - new Date(s.abertura)) / 86400000); });
    var tempoMedio = temposDias.length ? Math.round(temposDias.reduce(function (a, b) { return a + b; }, 0) / temposDias.length) : null;
    return secTitle('Operacional', servicosFiltrados.length + ' de ' + f.servicos.length + ' vaga(s) no período') +
      '<div class="filtro-grupo" style="margin-bottom:16px;gap:16px;">' +
      '<span>Tipo de vaga</span><select id="filtro-tipo-vaga-op"><option value="todos"' + (estado.filtroTipoVagaOp === 'todos' ? ' selected' : '') + '>Todos</option>' +
      tiposDisponiveis.map(function (t) { return '<option value="' + t + '"' + (estado.filtroTipoVagaOp === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>' +
      '<span>Status</span><select id="filtro-status-op"><option value="todos"' + (estado.filtroStatusOp === 'todos' ? ' selected' : '') + '>Todos</option>' +
      statusDisponiveis.map(function (s) { return '<option value="' + s + '"' + (estado.filtroStatusOp === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
      '</div>' +
      '<div class="funil">' +
      '<div class="funil-etapa"><div class="label">Candidatados</div><div class="value">' + formatarNumero(candidatados) + '</div></div>' +
      '<div class="funil-etapa"><div class="label">Entrevistados</div><div class="value">' + formatarNumero(entrevistados) + '</div><div class="taxa">' + (candidatados ? Math.round(entrevistados / candidatados * 100) : 0) + '% dos candidatados</div></div>' +
      '<div class="funil-etapa"><div class="label">Contratados</div><div class="value">' + formatarNumero(contratados.length) + '</div><div class="taxa">' + (entrevistados ? Math.round(contratados.length / entrevistados * 100) : 0) + '% dos entrevistados</div></div>' +
      '</div>' +
      '<div class="kpi-row" style="margin-top:24px;">' + kpi('Vagas em aberto', vagasAbertas) + kpi('Tempo médio de contratação', tempoMedio !== null ? tempoMedio + ' dia(s)' : '—') + kpi('Vagas no filtro', servicosFiltrados.length) + '</div>' +
      '<div class="card" style="margin-top:24px;"><h3>Vagas do período</h3>' +
      tabela(['Cargo', 'Cliente', 'Tipo de vaga', 'Status'], servicosFiltrados.map(function (s) { return [s.cargo, s.clienteNome, s.tipoVaga, badge(s.status)]; })) +
      '</div>';
  }
  renderOperacional.html = renderOperacional;
  renderOperacional.chart = function () {
    document.getElementById('filtro-tipo-vaga-op').addEventListener('change', function (e) { estado.filtroTipoVagaOp = e.target.value; renderAba(); });
    document.getElementById('filtro-status-op').addEventListener('change', function (e) { estado.filtroStatusOp = e.target.value; renderAba(); });
  };

  // ---- Comercial ----
  function renderComercial(f) {
    var categoriasDisponiveis = Array.from(new Set(f.orcamentos.map(function (o) { return o.categoria; }))).filter(Boolean);
    var statusDisponiveis = Array.from(new Set(f.orcamentos.map(function (o) { return o.status; }))).filter(Boolean);
    var orcamentosFiltrados = f.orcamentos
      .filter(function (o) { return estado.filtroCategoriaCom === 'todos' || o.categoria === estado.filtroCategoriaCom; })
      .filter(function (o) { return estado.filtroStatusCom === 'todos' || o.status === estado.filtroStatusCom; });

    var total = orcamentosFiltrados.length;
    var aprovados = orcamentosFiltrados.filter(function (o) { return String(o.status).indexOf('Aprovado') !== -1; });
    var ticketMedio = aprovados.length ? somar(aprovados, 'valor') / aprovados.length : 0;
    var porStatus = agruparContagem(orcamentosFiltrados, 'status');
    var porCategoria = Object.entries(agruparSoma(orcamentosFiltrados, 'categoria', 'valor')).map(function (e) { return { nome: e[0], valor: e[1] }; }).sort(function (a, b) { return b.valor - a.valor; });
    return secTitle('Comercial', total + ' de ' + f.orcamentos.length + ' orçamento(s) no período') +
      '<div class="filtro-grupo" style="margin-bottom:16px;gap:16px;">' +
      '<span>Categoria</span><select id="filtro-categoria-com"><option value="todos"' + (estado.filtroCategoriaCom === 'todos' ? ' selected' : '') + '>Todas</option>' +
      categoriasDisponiveis.map(function (c) { return '<option value="' + c + '"' + (estado.filtroCategoriaCom === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select>' +
      '<span>Status</span><select id="filtro-status-com"><option value="todos"' + (estado.filtroStatusCom === 'todos' ? ' selected' : '') + '>Todos</option>' +
      statusDisponiveis.map(function (s) { return '<option value="' + s + '"' + (estado.filtroStatusCom === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
      '</div>' +
      '<div class="kpi-row">' + kpi('Orçamentos no filtro', total) + kpi('Aprovados', aprovados.length, 'positivo') + kpi('Taxa de conversão', total ? Math.round(aprovados.length / total * 100) + '%' : '—') + kpi('Ticket médio aprovado', formatarMoeda(ticketMedio)) + '</div>' +
      '<div class="grid-2" style="margin-top:24px;">' +
      donutCard('Orçamentos por status', 'chart-com-status', porStatus, PALETA_DONUT) +
      '<div class="card"><h3>Valor por categoria</h3>' + ranking(porCategoria) + '</div>' +
      '</div>' +
      '<div class="card" style="margin-top:24px;"><h3>Orçamentos do período</h3>' +
      tabela(['Cliente', 'Categoria', 'Valor', 'Status'], orcamentosFiltrados.map(function (o) { return [o.clienteNome, o.categoria, formatarMoeda(o.valor), badge(o.status)]; })) +
      '</div>';
  }
  renderComercial.html = renderComercial;
  renderComercial.chart = function (f) {
    var orcamentosFiltrados = f.orcamentos
      .filter(function (o) { return estado.filtroCategoriaCom === 'todos' || o.categoria === estado.filtroCategoriaCom; })
      .filter(function (o) { return estado.filtroStatusCom === 'todos' || o.status === estado.filtroStatusCom; });
    desenharDonut('chart-com-status', agruparContagem(orcamentosFiltrados, 'status'), PALETA_DONUT);
    document.getElementById('filtro-categoria-com').addEventListener('change', function (e) { estado.filtroCategoriaCom = e.target.value; renderAba(); });
    document.getElementById('filtro-status-com').addEventListener('change', function (e) { estado.filtroStatusCom = e.target.value; renderAba(); });
  };

  // ---- Clientes ----
  function renderClientes(f) {
    var receitaPorCliente = agruparSoma(f.entrada, 'clienteNome', 'valor');
    var top = Object.entries(receitaPorCliente).map(function (e) { return { nome: e[0], valor: e[1] }; }).sort(function (a, b) { return b.valor - a.valor; });
    var ativos = f.clientes.filter(function (c) { return !c.termino; }).length;

    var receitaPorId = {}; f.entrada.forEach(function (r) { receitaPorId[r.idCliente] = (receitaPorId[r.idCliente] || 0) + r.valor; });
    var custoPorId = {}; f.saida.forEach(function (r) { if (r.idCliente) custoPorId[r.idCliente] = (custoPorId[r.idCliente] || 0) + r.valor; });

    return secTitle('Clientes', f.clientes.length + ' cliente(s) no filtro atual') +
      '<div class="kpi-row">' + kpi('Total de clientes', f.clientes.length) + kpi('Ativos', ativos, 'positivo') + kpi('Encerrados', f.clientes.length - ativos, f.clientes.length - ativos ? 'negativo' : '') + '</div>' +
      '<div class="card" style="margin-top:24px;"><h3>Faturamento por cliente</h3><canvas id="chart-clientes-faturamento" height="220"></canvas></div>' +
      '<div class="card" style="margin-top:24px;"><h3>Cadastro e rentabilidade</h3>' +
      '<p style="color:var(--muted);font-size:12px;margin-top:-8px;margin-bottom:14px;">Custo direto = despesas ligadas a vagas desse cliente (via Id Vaga). Não inclui despesas gerais da consultoria.</p>' +
      tabela(['Empresa', 'Segmento', 'Faturamento', 'Custo direto', 'Margem', 'Situação'], f.clientes.map(function (c) {
        var receita = receitaPorId[c.id] || 0, custo = custoPorId[c.id] || 0;
        return [c.nome, c.segmento, formatarMoeda(receita), formatarMoeda(custo), formatarMoeda(receita - custo), c.termino ? badge('Encerrado') : badge('Ativo')];
      })) +
      '</div>';
  }
  renderClientes.html = renderClientes;
  renderClientes.chart = function (f) {
    var receitaPorCliente = agruparSoma(f.entrada, 'clienteNome', 'valor');
    var top = Object.entries(receitaPorCliente).map(function (e) { return { nome: e[0], valor: e[1] }; }).sort(function (a, b) { return b.valor - a.valor; });
    criarChart(document.getElementById('chart-clientes-faturamento'), {
      type: 'bar',
      data: { labels: top.map(function (c) { return c.nome; }), datasets: [{ data: top.map(function (c) { return c.valor; }), backgroundColor: CORES.accent, borderRadius: 4 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { autoSkip: false, maxRotation: 40, minRotation: 40 } }, y: { grid: { color: CORES.linha } } } }
    });
  };

  // ---- Vagas ----
  function renderVagas(f) {
    var statusDisponiveis = Array.from(new Set(f.servicos.map(function (s) { return s.status; }))).filter(Boolean);
    var vagasFiltradas = estado.filtroStatusVaga === 'todos' ? f.servicos : f.servicos.filter(function (s) { return s.status === estado.filtroStatusVaga; });
    var porStatus = agruparContagem(vagasFiltradas, 'status');
    var contratadosPorTipo = agruparContagem(vagasFiltradas.filter(function (s) { return s.status === 'Contratado'; }), 'tipoVaga');
    return secTitle('Vagas', vagasFiltradas.length + ' de ' + f.servicos.length + ' vaga(s) no período') +
      '<div class="filtro-grupo" style="margin-bottom:16px;"><span>Status</span><select id="filtro-status-vaga">' +
      '<option value="todos"' + (estado.filtroStatusVaga === 'todos' ? ' selected' : '') + '>Todos os status</option>' +
      statusDisponiveis.map(function (s) { return '<option value="' + s + '"' + (estado.filtroStatusVaga === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="grid-2">' +
      donutCard('Vagas por status', 'chart-vagas-status', porStatus, PALETA_DONUT) +
      donutCard('Contratações por tipo de vaga', 'chart-vagas-tipo', contratadosPorTipo, PALETA_DONUT) +
      '</div>' +
      '<div class="card" style="margin-top:24px;"><h3>Vagas' + (estado.filtroStatusVaga === 'todos' ? '' : ' — ' + estado.filtroStatusVaga) + '</h3>' +
      tabela(['Cargo', 'Cliente', 'Candidatados', 'Entrevistados', 'Status'], vagasFiltradas.map(function (s) { return [s.cargo, s.clienteNome, formatarNumero(s.candidatados), formatarNumero(s.entrevistados), badge(s.status)]; })) +
      '</div>';
  }
  renderVagas.html = renderVagas;
  renderVagas.chart = function (f) {
    var vagasFiltradas = estado.filtroStatusVaga === 'todos' ? f.servicos : f.servicos.filter(function (s) { return s.status === estado.filtroStatusVaga; });
    desenharDonut('chart-vagas-status', agruparContagem(vagasFiltradas, 'status'), PALETA_DONUT);
    desenharDonut('chart-vagas-tipo', agruparContagem(vagasFiltradas.filter(function (s) { return s.status === 'Contratado'; }), 'tipoVaga'), PALETA_DONUT);
    document.getElementById('filtro-status-vaga').addEventListener('change', function (e) {
      estado.filtroStatusVaga = e.target.value;
      renderAba();
    });
  };

  // ---- Metas ----
  function renderMetas(f) {
    var agora = new Date();
    var mesAtual = agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0');
    var realizadoMap = {}; f.entrada.forEach(function (r) { var mk = monthKeyISO(r.data); if (mk) realizadoMap[mk] = (realizadoMap[mk] || 0) + r.valor; });
    var metaMap = {}; f.metas.forEach(function (m) { var mk = m.ano + '-' + String(m.mesIndex + 1).padStart(2, '0'); metaMap[mk] = (metaMap[mk] || 0) + m.valor; });
    var meses = Array.from(new Set(Object.keys(realizadoMap).concat(Object.keys(metaMap)))).sort();
    var linhas = meses.map(function (mk) {
      var meta = metaMap[mk] || 0, real = realizadoMap[mk] || 0, pct = meta ? Math.round(real / meta * 100) : null;
      var statusHtml;
      if (pct === null) {
        statusHtml = '—';
      } else if (mk > mesAtual) {
        statusHtml = '<span class="badge neutro">Ainda não chegou</span>';
      } else if (pct >= 100) {
        statusHtml = badge('Cumprida (' + pct + '%)');
      } else if (mk === mesAtual) {
        statusHtml = '<span class="badge pendente">Em andamento (' + pct + '%)</span>';
      } else {
        statusHtml = '<span class="badge alerta">Não atingida (' + pct + '%)</span>';
      }
      return [rotuloMes(mk), formatarMoeda(meta), formatarMoeda(real), statusHtml];
    });
    return secTitle('Metas', 'Meta da consultoria (global) x realizado no filtro atual') +
      '<div class="card"><h3>Meta x realizado</h3><canvas id="chart-metas" height="150"></canvas></div>' +
      '<div class="card" style="margin-top:24px;"><h3>Detalhe por mês</h3>' + tabela(['Mês', 'Meta', 'Realizado', 'Cumprimento'], linhas) + '</div>';
  }
  renderMetas.html = renderMetas;
  renderMetas.chart = function (f) {
    var realizadoMap = {}; f.entrada.forEach(function (r) { var mk = monthKeyISO(r.data); if (mk) realizadoMap[mk] = (realizadoMap[mk] || 0) + r.valor; });
    var metaMap = {}; f.metas.forEach(function (m) { var mk = m.ano + '-' + String(m.mesIndex + 1).padStart(2, '0'); metaMap[mk] = (metaMap[mk] || 0) + m.valor; });
    var meses = Array.from(new Set(Object.keys(realizadoMap).concat(Object.keys(metaMap)))).sort();
    criarChart(document.getElementById('chart-metas'), { data: { labels: meses.map(rotuloMes), datasets: [
      { type: 'bar', label: 'Meta', data: meses.map(function (m) { return metaMap[m] || 0; }), backgroundColor: '#EFEAFB', order: 2 },
      { type: 'line', label: 'Realizado', data: meses.map(function (m) { return realizadoMap[m] || 0; }), borderColor: CORES.warm, tension: 0.3, order: 1, z: 10 }
    ] }, options: { plugins: { legend: { position: 'bottom' } } } });
  };

  // ---- Solicitações ----
  function renderSolicitacoes() {
    var lista = estado.dados.solicitacoes || [];
    return secTitle('Solicitações dos clientes', lista.length + ' registro(s) — não segue o filtro de período/cliente') +
      '<div class="card">' +
      tabela(['Data', 'Empresa', 'Categoria', 'Resumo', 'Status'], lista.map(function (s) {
        return [s.timestamp ? formatarDataHora(s.timestamp) : '—', s.empresa, s.categoria, s.resumo, badge(s.status)];
      })) +
      '<p style="color:var(--muted);font-size:12px;margin-top:14px;">Pra marcar como atendida, edite a coluna "Status" direto na aba Solicitações da planilha.</p>' +
      '</div>';
  }
  renderSolicitacoes.html = renderSolicitacoes;

  // ---- Lançar dados (admin) ----
  function tipoCampo(header) {
    var h = header.toLowerCase();
    if (/cliente|empresa/.test(h) && /id|cliente$/.test(h)) return 'cliente';
    if (/data|início|inicio|fechamento|admiss|demiss|nascimento|abertura|t[eé]rmino/.test(h)) return 'date';
    if (/valor|sal[aá]rio|qtda|parcela|remunera|candidatados|entrevistados|sla|filhos|^ano$/.test(h)) return 'number';
    return 'text';
  }

  function renderLancar() {
    return '<div class="section-title"><h2>Lançar dados</h2><span class="desc">Escreve direto nas abas oficiais da planilha</span></div>' +
      '<div class="card" style="max-width:560px;" id="lancar-form-area"><p style="color:var(--muted);">Carregando estrutura das abas…</p></div>';
  }
  renderLancar.html = renderLancar;
  renderLancar.chart = function () {
    if (estado.estrutura) { montarFormLancar(); return; }
    chamarAppsScript({ action: 'estrutura', chave: pegarChaveSalva() }).then(function (res) {
      if (res.erro) { document.getElementById('lancar-form-area').innerHTML = '<p class="mensagem erro">' + res.erro + '</p>'; return; }
      estado.estrutura = res.abas;
      montarFormLancar();
    }).catch(function (err) {
      document.getElementById('lancar-form-area').innerHTML = '<p class="mensagem erro">' + err.message + '</p>';
    });
  };

  function montarFormLancar() {
    var abas = Object.keys(estado.estrutura);
    var area = document.getElementById('lancar-form-area');
    area.innerHTML =
      '<select id="sel-aba-lancar">' + abas.map(function (a) { return '<option value="' + a + '">' + a + '</option>'; }).join('') + '</select>' +
      '<div id="campos-lancar" style="margin-top:14px;display:flex;flex-direction:column;gap:10px;"></div>' +
      '<button id="btn-lancar" style="width:100%;margin-top:14px;">Adicionar lançamento</button>' +
      '<p class="mensagem" id="msg-lancar"></p>';

    var sel = document.getElementById('sel-aba-lancar');
    function montarCampos() {
      var headers = estado.estrutura[sel.value];
      document.getElementById('campos-lancar').innerHTML = headers.map(function (h) {
        var tipo = tipoCampo(h);
        if (tipo === 'cliente') {
          return '<label style="font-size:12px;color:var(--muted);">' + h +
            '<select data-campo="' + h + '" style="margin-top:4px;">' +
            estado.dados.clientes.map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('') +
            '</select></label>';
        }
        var inputTipo = tipo === 'date' ? 'date' : (tipo === 'number' ? 'number' : 'text');
        return '<label style="font-size:12px;color:var(--muted);">' + h +
          '<input type="' + inputTipo + '" data-campo="' + h + '" style="margin-top:4px;"></label>';
      }).join('');
    }
    sel.addEventListener('change', montarCampos);
    montarCampos();

    document.getElementById('btn-lancar').addEventListener('click', function () {
      var nomeAba = sel.value;
      var campos = {};
      document.querySelectorAll('#campos-lancar [data-campo]').forEach(function (el) {
        var h = el.getAttribute('data-campo');
        var tipo = tipoCampo(h);
        campos[h] = tipo === 'number' ? parseFloat(el.value || '0') : el.value;
      });
      var msg = document.getElementById('msg-lancar');
      var btn = document.getElementById('btn-lancar');
      btn.disabled = true; btn.textContent = 'Salvando…';

      enviarAppsScript({ action: 'adminLancar', chave: pegarChaveSalva(), aba: nomeAba, campos: campos })
        .then(function (res) {
          btn.disabled = false; btn.textContent = 'Adicionar lançamento';
          if (res.erro) { msg.textContent = res.erro; msg.className = 'mensagem erro'; return; }
          msg.textContent = res.mensagem + ' Recarregue a aba pra ver refletido nos números.'; msg.className = 'mensagem sucesso';
          montarCampos();
        })
        .catch(function (err) {
          btn.disabled = false; btn.textContent = 'Adicionar lançamento';
          msg.textContent = err.message; msg.className = 'mensagem erro';
        });
    });
  }

  iniciar();
})();
