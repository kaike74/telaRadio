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
    TEMPO_SIMULADO_DELAY_HORAS: 2, // Dashboard simula estar 2h atrás (falso ao vivo)
};

// Estado global
let dashboardData = null;
let dashboardDataOriginal = null; // Dados originais do worker (sem filtro)
let animacoesAtivas = new Map();
let mapaViewBox = { width: 1000, height: 1000 };
let insercoesExibidasSet = new Set(); // Set de IDs de inserções que já apareceram

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

    // Por enquanto, criar um placeholder até o SVG ser fornecido
    // O usuário disse que vai buscar o SVG depois
    mapaSvg.innerHTML = `
        <rect width="1000" height="1000" fill="#1a3a4a" opacity="0.3"/>
        <text x="500" y="500" text-anchor="middle" fill="#00d4ff" font-size="24" opacity="0.5">
            Mapa do Brasil
        </text>
        <text x="500" y="540" text-anchor="middle" fill="#fff" font-size="16" opacity="0.4">
            (Aguardando SVG)
        </text>
    `;

    console.log('🗺️ Mapa inicializado');
}

// =========================
// TEMPO SIMULADO (FALSO AO VIVO)
// =========================

/**
 * Calcula o tempo simulado (2h atrás do tempo real)
 * Usado para mostrar dados "ao vivo" simulando delay da API
 */
function calcularTempoSimulado() {
    const agora = new Date();
    const tempoSimulado = new Date(agora.getTime() - CONFIG.TEMPO_SIMULADO_DELAY_HORAS * 60 * 60 * 1000);

    return {
        data: tempoSimulado.toISOString().split('T')[0],
        hora: tempoSimulado.getHours(),
        minuto: tempoSimulado.getMinutes(),
        horaStr: String(tempoSimulado.getHours()).padStart(2, '0'),
        minutoStr: String(tempoSimulado.getMinutes()).padStart(2, '0'),
        timestamp: tempoSimulado
    };
}

/**
 * Filtra inserções para mostrar apenas até o tempo simulado
 */
function filtrarInsercoesTempoSimulado(insercoes, tempoSimulado) {
    return insercoes.filter(insercao => {
        if (!insercao.hour) return false;

        const [horaInsercao, minutoInsercao] = insercao.hour.split(':').map(Number);

        // Incluir se hora < hora simulada OU (hora === hora simulada E minuto <= minuto simulado)
        return (horaInsercao < tempoSimulado.hora) ||
               (horaInsercao === tempoSimulado.hora && minutoInsercao <= tempoSimulado.minuto);
    });
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
            // Salvar dados originais do worker
            dashboardDataOriginal = data;

            // Aplicar filtro de tempo simulado (FALSO AO VIVO)
            const tempoSimulado = calcularTempoSimulado();
            console.log(`⏰ Tempo Real: ${new Date().toLocaleTimeString('pt-BR')} | Simulado (dashboard): ${tempoSimulado.horaStr}:${tempoSimulado.minutoStr}`);

            // Filtrar inserções para tempo simulado
            const insercoesRecentes = filtrarInsercoesTempoSimulado(
                data.insercoesRecentes || [],
                tempoSimulado
            );

            console.log(`🔽 Filtro aplicado: ${data.insercoesRecentes?.length || 0} inserções → ${insercoesRecentes.length} até ${tempoSimulado.horaStr}:${tempoSimulado.minutoStr}`);

            // Criar dados filtrados para o dashboard
            const dadosFiltrados = {
                ...data,
                insercoesRecentes: insercoesRecentes,
                metricas: {
                    ...data.metricas,
                    insercoesHoje: insercoesRecentes.length,
                    ultimaAtualizacao: `${tempoSimulado.horaStr}:${tempoSimulado.minutoStr}`
                },
                tempoSimulado: `${tempoSimulado.horaStr}:${tempoSimulado.minutoStr}`,
                debug: {
                    ...data.debug,
                    insercoesOriginais: data.insercoesRecentes?.length || 0,
                    insercoesFiltradas: insercoesRecentes.length,
                    tempoSimulado: `${tempoSimulado.horaStr}:${tempoSimulado.minutoStr}`
                }
            };

            dashboardData = dadosFiltrados;
            renderizarDashboard(dadosFiltrados);
            console.log('✅ Dashboard atualizado (com filtro de tempo simulado)', dadosFiltrados.debug);
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
        // IMPORTANTE: Usar dados do worker (que já tem todas as inserções recentes)
        // e filtrar no frontend com tempo simulado

        if (!dashboardDataOriginal || !dashboardDataOriginal.insercoesRecentes || !dashboardDataOriginal.coordenadas) {
            // Se não há dados ainda, não fazer nada
            return;
        }

        // Calcular tempo simulado
        const tempoSimulado = calcularTempoSimulado();

        // Filtrar inserções para tempo simulado
        const insercoesRecentes = filtrarInsercoesTempoSimulado(
            dashboardDataOriginal.insercoesRecentes,
            tempoSimulado
        );

        // Calcular quais inserções devem animar AGORA (no tempo simulado)
        const animacoes = calcularAnimacoesAtivasLocal(
            insercoesRecentes,
            dashboardDataOriginal.coordenadas,
            tempoSimulado.timestamp
        );

        if (animacoes.length > 0) {
            atualizarAnimacoes(animacoes);
        }

    } catch (error) {
        console.error('⚠️ Erro ao buscar inserções recentes:', error);
    }
}

/**
 * Calcula quais inserções devem estar animando no momento (versão local)
 * Mesma lógica do worker, mas executada no frontend com tempo simulado
 */
function calcularAnimacoesAtivasLocal(insercoesRecentes, coordenadas, tempoAtual) {
    const animacoes = [];
    const coordenadasMap = new Map(coordenadas.map(c => [c.cidade, c]));
    const DURACAO_ANIMACAO_SEGUNDOS = 30;

    insercoesRecentes.forEach(insercao => {
        if (!insercao.city || !insercao.hour) return;

        const coords = coordenadasMap.get(insercao.city);
        if (!coords) return;

        const [horaInsercao, minutoInsercao, segundoInsercao = 0] = insercao.hour.split(':').map(Number);

        // Criar momento da inserção no mesmo dia do tempo simulado
        const momentoInsercao = new Date(tempoAtual);
        momentoInsercao.setHours(horaInsercao, minutoInsercao, segundoInsercao, 0);

        // Fim da animação: 30s após a inserção
        const fimAnimacao = new Date(momentoInsercao.getTime() + DURACAO_ANIMACAO_SEGUNDOS * 1000);

        // Verificar se a inserção deve estar animando no tempo simulado
        if (tempoAtual >= momentoInsercao && tempoAtual <= fimAnimacao) {
            animacoes.push({
                id: `${insercao.city}-${insercao.hour}-${insercao.stationName}`,
                lat: coords.lat,
                lng: coords.lng,
                startTime: momentoInsercao.toISOString(),
                endTime: fimAnimacao.toISOString(),
                dados: {
                    emissora: insercao.stationName,
                    cidade: insercao.city,
                    uf: insercao.uf,
                    cliente: insercao.client,
                    horario: insercao.hour,
                    campanha: insercao.campaign
                }
            });
        }
    });

    return animacoes;
}

// =========================
// RENDERIZAÇÃO - DASHBOARD
// =========================

function renderizarDashboard(data) {
    // Métricas
    document.getElementById('metrica-campanhas').textContent = data.metricas.campanhasAtivas || 0;
    document.getElementById('metrica-radios').textContent = data.metricas.emissorasAtivas || 0;
    document.getElementById('metrica-insercoes').textContent = data.metricas.insercoesHoje || 0;

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
        }
    });

    // IMPORTANTE: NÃO atualizar o contador aqui
    // O contador já foi atualizado corretamente pelo filtro de tempo simulado
    // em buscarDashboardCompleto()

    if (novasAnimacoes.length > 0) {
        console.log(`✨ ${novasAnimacoes.length} animações ativas no momento (tempo simulado)`);
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
    // ViewBox do SVG: 0 0 612.51611 639.04297
    // GeoViewBox do mapa-brasil.svg: -74.008595 5.275696 -34.789914 -33.743888
    // Formato: minLng maxLat maxLng minLat

    const geoMinLng = -74.008595;  // Extremo oeste (esquerda)
    const geoMaxLat = 5.275696;     // Extremo norte (topo)
    const geoMaxLng = -34.789914;   // Extremo leste (direita)
    const geoMinLat = -33.743888;   // Extremo sul (base)

    const svgWidth = 612.51611;
    const svgHeight = 639.04297;

    // Obter o elemento SVG renderizado para calcular escala real
    const mapaSvgElement = document.getElementById('mapa-brasil');
    const mapaContainer = document.getElementById('mapa-container');

    // Normalizar coordenadas geográficas para pixels do SVG (coordenadas originais)
    // X: longitude de oeste (-74) a leste (-34)
    const xNorm = ((lng - geoMinLng) / (geoMaxLng - geoMinLng)) * svgWidth;

    // Y: latitude de norte (5) a sul (-33), invertida pois SVG cresce para baixo
    const yNorm = ((geoMaxLat - lat) / (geoMaxLat - geoMinLat)) * svgHeight;

    // Calcular escala e offset do SVG renderizado
    let x = xNorm;
    let y = yNorm;

    if (mapaSvgElement && mapaContainer) {
        const svgRect = mapaSvgElement.getBoundingClientRect();
        const containerRect = mapaContainer.getBoundingClientRect();

        // Calcular a escala do SVG (quanto ele foi redimensionado)
        const scaleX = svgRect.width / svgWidth;
        const scaleY = svgRect.height / svgHeight;

        // Aplicar a escala às coordenadas
        x = xNorm * scaleX;
        y = yNorm * scaleY;

        // Calcular o offset (onde o SVG começa dentro do container)
        // Como o container usa justify-content: center e align-items: center,
        // o SVG pode estar deslocado do canto superior esquerdo
        const offsetX = svgRect.left - containerRect.left;
        const offsetY = svgRect.top - containerRect.top;

        // Adicionar o offset às coordenadas
        x += offsetX;
        y += offsetY;

        // Debug para verificar conversões
        if (window.DEBUG_COORDS) {
            console.log(`📍 Coordenadas:`, {
                lat, lng,
                xNorm: xNorm.toFixed(2),
                yNorm: yNorm.toFixed(2),
                scaleX: scaleX.toFixed(3),
                scaleY: scaleY.toFixed(3),
                offsetX: offsetX.toFixed(2),
                offsetY: offsetY.toFixed(2),
                xFinal: x.toFixed(2),
                yFinal: y.toFixed(2)
            });
        }
    } else {
        // Fallback: usar coordenadas normalizadas sem escala
        if (window.DEBUG_COORDS) {
            console.log(`⚠️ SVG ou container não encontrado, usando coordenadas normalizadas`);
        }
    }

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

    // Descomentar para testar com dados fake:
    /*
    setTimeout(() => {
        renderizarDashboard({
            success: true,
            metricas: {
                campanhasAtivas: 31,
                emissorasAtivas: 101,
                insercoesHoje: 509,
                topEmissoras: [
                    { emissora: "Rádio Nativa FM (95.3) - SC | Joinville", campanhas: 12 },
                    { emissora: "Rádio Gazeta (98.7) - SP | São Paulo", campanhas: 10 },
                    { emissora: "Rádio Atlântida (102.5) - RS | Porto Alegre", campanhas: 8 }
                ],
                topCidades: [
                    { cidade: "São Paulo/SP", emissoras: 25 },
                    { cidade: "Rio de Janeiro/RJ", emissoras: 18 },
                    { cidade: "Belo Horizonte/MG", emissoras: 15 }
                ],
                ultimaAtualizacao: "15:25"
            },
            insercoesRecentes: [
                {
                    stationName: "Rádio Nativa FM",
                    city: "Joinville",
                    uf: "SC",
                    client: "Cliente Exemplo",
                    hour: "15:23:45"
                }
            ]
        });
    }, 500);
    */
}

// =========================
// FUNÇÕES DE DEBUG
// =========================

/**
 * Habilitar debug de coordenadas
 * Use no console: enableDebugCoords()
 */
window.enableDebugCoords = function() {
    window.DEBUG_COORDS = true;
    console.log('🔧 Debug de coordenadas ATIVADO');
    console.log('🔧 Teste São Paulo: testCoord(-23.5505, -46.6333)');
};

/**
 * Testar conversão de coordenadas
 * Exemplo: testCoord(-23.5505, -46.6333) // São Paulo
 */
window.testCoord = function(lat, lng, nome = '') {
    console.log(`\n📍 Testando coordenadas${nome ? ' de ' + nome : ''}: lat=${lat}, lng=${lng}`);

    const pos = coordenadasParaPixels(lat, lng);
    console.log(`✅ Resultado: x=${pos.x.toFixed(2)}px, y=${pos.y.toFixed(2)}px`);

    // Criar pinga de teste
    const container = document.getElementById('animacoes-layer');
    if (container) {
        const pingaTeste = document.createElement('div');
        pingaTeste.className = 'pinga';
        pingaTeste.style.left = `${pos.x}px`;
        pingaTeste.style.top = `${pos.y}px`;
        pingaTeste.innerHTML = `
            <div class="pinga-circle"></div>
            <div class="pinga-ripple"></div>
            <div class="tooltip-auto">
                <div class="tooltip-auto-content">
                    <strong>${nome || 'Teste'}</strong>
                    <div>Lat: ${lat}</div>
                    <div>Lng: ${lng}</div>
                </div>
            </div>
        `;
        container.appendChild(pingaTeste);
        console.log('✅ Pinga de teste criada no mapa');

        // Remover após 10 segundos
        setTimeout(() => pingaTeste.remove(), 10000);
    }

    return pos;
};

/**
 * Testar várias cidades brasileiras importantes
 */
window.testCidadesBrasil = function() {
    console.log('\n🇧🇷 Testando coordenadas de cidades brasileiras...\n');

    const cidades = [
        { nome: 'São Paulo', lat: -23.5505, lng: -46.6333 },
        { nome: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
        { nome: 'Brasília', lat: -15.7939, lng: -47.8828 },
        { nome: 'Salvador', lat: -12.9714, lng: -38.5014 },
        { nome: 'Fortaleza', lat: -3.7172, lng: -38.5433 },
        { nome: 'Manaus', lat: -3.1190, lng: -60.0217 },
        { nome: 'Porto Alegre', lat: -30.0346, lng: -51.2177 },
        { nome: 'Recife', lat: -8.0476, lng: -34.8770 }
    ];

    cidades.forEach(cidade => {
        testCoord(cidade.lat, cidade.lng, cidade.nome);
    });
};

console.log('✅ Script carregado');
console.log('💡 Para debug de coordenadas, use: enableDebugCoords()');
console.log('💡 Para testar São Paulo: testCoord(-23.5505, -46.6333, "São Paulo")');
console.log('💡 Para testar várias cidades: testCidadesBrasil()');
