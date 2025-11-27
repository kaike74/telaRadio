/**
 * Dashboard de Monitoramento - Rádio
 * Script principal com lógica de animações e polling
 */

// Configuração
const CONFIG = {
    // URL do worker deployado
    API_BASE: 'https://dashboard-radio-worker.kaike-458.workers.dev',
    POLLING_INTERVAL: 5000, // 5 segundos
    DASHBOARD_REFRESH_INTERVAL: 60000, // 1 minuto (dados completos)
};

// Estado global
let dashboardData = null;
let animacoesAtivas = new Map();
let mapaViewBox = { width: 1000, height: 1000 };
let contadorInsercoes = 0; // Contador numérico simples

// =========================
// INICIALIZAÇÃO
// =========================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Dashboard iniciado');

    // Inicializar mapa
    inicializarMapa();

    // Buscar dados iniciais
    buscarDashboardCompleto();

    // Configurar polling para animações (a cada 5s)
    setInterval(buscarInsercoesRecentes, CONFIG.POLLING_INTERVAL);

    // Configurar refresh do dashboard completo (a cada 1min)
    setInterval(buscarDashboardCompleto, CONFIG.DASHBOARD_REFRESH_INTERVAL);
});

// =========================
// MAPA
// =========================

function inicializarMapa() {
    const mapaSvg = document.getElementById('mapa-brasil');

    // Carregar SVG externo via object
    mapaSvg.innerHTML = `
        <object id="svg-object" data="mapa-brasil.svg" type="image/svg+xml" style="width: 100%; height: 100%; pointer-events: none;">
        </object>
    `;

    console.log('🗺️ Mapa inicializado');
}

// =========================
// API - BUSCAR DADOS
// =========================

async function buscarDashboardCompleto() {
    try {
        console.log('📊 Buscando dashboard completo...');

        const response = await fetch(`${CONFIG.API_BASE}/api/dashboard`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
            dashboardData = data;
            renderizarDashboard(data);
            console.log('✅ Dashboard atualizado', data.debug);
        } else {
            console.error('❌ Erro nos dados:', data.error);
            mostrarErro('Erro ao carregar dados do dashboard');
        }

    } catch (error) {
        console.error('❌ Erro ao buscar dashboard:', error);
        mostrarErro(`Erro de conexão: ${error.message}`);
    }
}

async function buscarInsercoesRecentes() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/api/insercoes/recentes`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.animacoes) {
            atualizarAnimacoes(data.animacoes);
        }

    } catch (error) {
        console.error('⚠️ Erro ao buscar inserções recentes:', error);
    }
}

// =========================
// RENDERIZAÇÃO - DASHBOARD
// =========================

function renderizarDashboard(data) {
    // Métricas
    document.getElementById('metrica-campanhas').textContent = data.metricas.campanhasAtivas || 0;
    document.getElementById('metrica-radios').textContent = data.metricas.emissorasAtivas || 0;

    // Inicializar contador com o valor do servidor (que já tem o delay aplicado)
    if (contadorInsercoes === 0 || data.metricas.insercoesHoje > contadorInsercoes) {
        contadorInsercoes = data.metricas.insercoesHoje;
    }
    document.getElementById('metrica-insercoes').textContent = contadorInsercoes;

    // Gráficos
    renderizarGraficoEmissoras(data.metricas.topEmissoras || []);
    renderizarGraficoCidades(data.metricas.topCidades || []);

    // Lista de inserções
    renderizarListaInsercoes(data.insercoesRecentes || []);

    // Última atualização
    document.getElementById('ultima-atualizacao').textContent =
        `Última atualização: ${data.metricas.ultimaAtualizacao || '--'}`;

    console.log('✅ Dashboard renderizado');
}

function renderizarGraficoEmissoras(topEmissoras) {
    const container = document.getElementById('grafico-emissoras');

    if (topEmissoras.length === 0) {
        container.innerHTML = '<div class="loading">Nenhum dado disponível</div>';
        return;
    }

    const maxValor = Math.max(...topEmissoras.map(e => e.campanhas));

    container.innerHTML = topEmissoras.slice(0, 8).map(emissora => {
        const larguraPercentual = (emissora.campanhas / maxValor) * 100;
        const nomeResumido = truncarTexto(emissora.emissora, 40);

        return `
            <div class="grafico-barra">
                <div class="grafico-label" title="${emissora.emissora}">${nomeResumido}</div>
                <div class="grafico-bar-container">
                    <div class="grafico-bar" style="width: ${larguraPercentual}%">
                        <span class="grafico-valor">${emissora.campanhas}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderizarGraficoCidades(topCidades) {
    const container = document.getElementById('grafico-cidades');

    if (topCidades.length === 0) {
        container.innerHTML = '<div class="loading">Nenhum dado disponível</div>';
        return;
    }

    const maxValor = Math.max(...topCidades.map(c => c.emissoras));

    container.innerHTML = topCidades.slice(0, 8).map(cidade => {
        const larguraPercentual = (cidade.emissoras / maxValor) * 100;

        return `
            <div class="grafico-barra">
                <div class="grafico-label">${cidade.cidade}</div>
                <div class="grafico-bar-container">
                    <div class="grafico-bar" style="width: ${larguraPercentual}%">
                        <span class="grafico-valor">${cidade.emissoras}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderizarListaInsercoes(insercoes) {
    const container = document.getElementById('lista-insercoes-lateral');

    if (insercoes.length === 0) {
        container.innerHTML = '<div class="loading">Nenhuma inserção encontrada</div>';
        return;
    }

    // Mostrar apenas 10 inserções (cabe melhor no layout lateral)
    container.innerHTML = insercoes.slice(0, 10).map((insercao, index) => `
        <div class="insercao-item ${index < 3 ? 'nova' : ''}">
            <div class="insercao-header">
                <div class="insercao-radio">${truncarTexto(insercao.stationName, 25)}</div>
                <div class="insercao-hora">${insercao.hour}</div>
            </div>
            <div class="insercao-detalhes">
                ${insercao.city}${insercao.uf ? '/' + insercao.uf : ''}
            </div>
        </div>
    `).join('');
}

// =========================
// ANIMAÇÕES NO MAPA
// =========================

function atualizarAnimacoes(novasAnimacoes) {
    const container = document.getElementById('animacoes-layer');
    const mapaContainer = document.getElementById('mapa-container');
    const bounds = mapaContainer.getBoundingClientRect();

    // Remover animações expiradas
    const agora = new Date();
    const idsAtivos = new Set(novasAnimacoes.map(a => a.id));

    animacoesAtivas.forEach((elemento, id) => {
        if (!idsAtivos.has(id)) {
            elemento.remove();
            animacoesAtivas.delete(id);
        }
    });

    // Adicionar novas animações
    novasAnimacoes.forEach(animacao => {
        if (!animacoesAtivas.has(animacao.id)) {
            criarPinga(animacao, container, bounds);
            // Incrementar contador apenas para novas animações que aparecem na tela
            contadorInsercoes++;
            document.getElementById('metrica-insercoes').textContent = contadorInsercoes;
        }
    });

    if (novasAnimacoes.length > 0) {
        console.log(`✨ ${novasAnimacoes.length} animações ativas`);
    }
}

function criarPinga(animacao, container, bounds) {
    const pinga = document.createElement('div');
    pinga.className = 'pinga';
    pinga.id = animacao.id;

    // Converter coordenadas geográficas para pixels do SVG
    const pos = coordenadasParaPixels(animacao.lat, animacao.lng);

    pinga.style.left = `${pos.x}px`;
    pinga.style.top = `${pos.y}px`;

    // Tooltip automático sempre visível
    pinga.innerHTML = `
        <div class="pinga-circle"></div>
        <div class="pinga-ripple"></div>
        <div class="tooltip-auto">
            <div class="tooltip-auto-content">
                <strong>${animacao.dados.emissora}</strong>
                <div>${animacao.dados.cidade}/${animacao.dados.uf}</div>
                <div>${animacao.dados.horario}</div>
            </div>
        </div>
    `;

    container.appendChild(pinga);
    animacoesAtivas.set(animacao.id, pinga);
}

function coordenadasParaPixels(lat, lng) {
    // ViewBox do SVG: 0 0 612.52 639.04
    // GeoViewBox do mapa-brasil.svg: -74.008595 5.275696 -34.789914 -33.743888

    const geoMinLng = -74.008595;
    const geoMaxLat = 5.275696;
    const geoMaxLng = -34.789914;
    const geoMinLat = -33.743888;

    const svgWidth = 612.52;
    const svgHeight = 639.04;

    // Normalizar coordenadas geográficas para o viewBox do SVG
    const x = ((lng - geoMinLng) / (geoMaxLng - geoMinLng)) * svgWidth;
    const y = ((geoMaxLat - lat) / (geoMaxLat - geoMinLat)) * svgHeight;

    return { x, y };
}

// =========================
// TOOLTIP
// =========================

function mostrarTooltip(event, dados) {
    const tooltip = document.getElementById('tooltip');
    const content = tooltip.querySelector('.tooltip-content');

    content.innerHTML = `
        <strong>${dados.emissora}</strong>
        <div>${dados.cidade}/${dados.uf}</div>
        <div>Cliente: ${dados.cliente}</div>
        <div>Horário: ${dados.horario}</div>
        <div style="font-size: 11px; margin-top: 5px; opacity: 0.7;">
            ${dados.campanha}
        </div>
    `;

    tooltip.classList.remove('hidden');

    // Posicionar próximo ao cursor
    posicionarTooltip(event, tooltip);

    // Atualizar posição ao mover o mouse
    const atualizarPosicao = (e) => {
        posicionarTooltip(e, tooltip);
    };

    document.addEventListener('mousemove', atualizarPosicao);

    // Remover listener ao esconder
    tooltip.dataset.listener = 'active';
    setTimeout(() => {
        document.removeEventListener('mousemove', atualizarPosicao);
    }, 100);
}

function posicionarTooltip(event, tooltip) {
    const offset = 15;
    let x = event.clientX + offset;
    let y = event.clientY + offset;

    // Verificar limites da tela
    const tooltipRect = tooltip.getBoundingClientRect();

    if (x + tooltipRect.width > window.innerWidth) {
        x = event.clientX - tooltipRect.width - offset;
    }

    if (y + tooltipRect.height > window.innerHeight) {
        y = event.clientY - tooltipRect.height - offset;
    }

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
}

function esconderTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.classList.add('hidden');
}

// =========================
// UTILIDADES
// =========================

function truncarTexto(texto, maxLength) {
    if (!texto) return '';
    if (texto.length <= maxLength) return texto;
    return texto.substring(0, maxLength - 3) + '...';
}

function mostrarErro(mensagem) {
    console.error('🚨', mensagem);

    // Mostrar no dashboard
    const elementos = [
        'lista-insercoes',
        'grafico-emissoras',
        'grafico-cidades'
    ];

    elementos.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = `<div class="loading" style="color: #ff6b6b;">${mensagem}</div>`;
        }
    });
}

// =========================
// MODO DESENVOLVIMENTO
// =========================

// Se estiver em localhost, usar dados mock para testar layout
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.warn('⚠️ MODO DESENVOLVIMENTO - Usando dados mock');

    CONFIG.API_BASE = 'https://dashboard-radio-worker.seu-usuario.workers.dev';
}

console.log('✅ Script carregado');
