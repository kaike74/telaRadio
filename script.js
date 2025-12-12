/**
 * Dashboard de Monitoramento - Rádio
 * Script principal com lógica de animações e polling
 */

// Detecção de tipo de dispositivo
const detectarDispositivo = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const userAgent = navigator.userAgent;

    // Google TV / Android TV
    if (userAgent.includes('GoogleTV') || userAgent.includes('AndroidTV') || 
        userAgent.includes('Sony') || userAgent.includes('BRAVIA') ||
        (width >= 1920 && height >= 1080 && !userAgent.includes('Mobile'))) {
        return 'tv';
    }

    // Tablet
    if (userAgent.includes('Tablet') || userAgent.includes('iPad') || 
        (width >= 768 && width < 1920 && !userAgent.includes('Mobile'))) {
        return 'tablet';
    }

    // Mobile
    if (userAgent.includes('Mobile') || width < 768) {
        return 'mobile';
    }

    // Desktop
    return 'desktop';
};

const DEVICE_TYPE = detectarDispositivo();

// Log do tipo de dispositivo detectado
console.log(`📱 Dispositivo detectado: ${DEVICE_TYPE} (${window.innerWidth}x${window.innerHeight})`);

// Logging: apenas console padrão para erros críticos

// Configuração
const CONFIG = {
    API_BASE: 'https://dashboard-radio-worker.kaike-458.workers.dev',
    DEVICE_TYPE: DEVICE_TYPE
};

// Estado global
let dashboardData = null;
let animacoesAtivas = new Map();
let mapaViewBox = { width: 1000, height: 1000 };

// ⭐ NOVO: Timestamp da última inserção processada
// Pings são criados APENAS para inserções com timestamp > ultimaInsercaoTimestamp
let ultimaInsercaoTimestamp = null; // Formato: "2025-12-10 18:33:22"

// ⭐ NOVO: Flag para rastrear se já temos dados renderizados
// Evita limpar a tela quando a API está lenta
let temDadosRenderizados = false;

// 🔧 DETECÇÃO DE MUDANÇAS - Rastrear valores anteriores das métricas
// ⚠️ GARANTIA DE MONOTONICICIDADE: Os valores NUNCA diminuem
let metricasAnteriores = {
    campanhasAtivas: null,
    emissorasAtivas: null,
    insercoesHoje: null
};

// 🔴 INTERVALO DE ATUALIZAÇÃO DE MÉTRICAS
let intervaloAtualizacaoMetricas = null;


// =========================
// INICIALIZAÇÃO
// =========================

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar mapa
    inicializarMapa();

    // Inicializar ticker de notícias
    renderizarTicker(['Monitorando inserções em tempo real...']);

    // Iniciar orquestração serializada
    iniciarCicloAtualizacao();
});

/**
 * 🔴 NOVO: Orquestração Serializada - Um único ciclo que evita race conditions
 * Funciona para PC e TV igualmente
 */
async function iniciarCicloAtualizacao() {
    // Buscar dashboard completo PRIMEIRA VEZ
    console.log('📊 Buscando dados iniciais...');
    await buscarDashboardCompleto();
    
    // Iniciar ciclo infinito
    cicloAtualizacaoRecorrente();
}

/**
 * 🔴 CICLO RECORRENTE: Atualiza a cada 5 segundos de forma serializada
 * - Busca dados do API
 * - Renderiza TUDO de uma vez
 * - Aguarda 5s
 * - Repete
 */
async function cicloAtualizacaoRecorrente() {
    try {
        // ⏱️ Intervalo: 5 segundos (inserções recentes)
        await aguardar(5000);
        
        // 📊 Buscar inserções recentes (buscar dados apenas, não renderizar)
        const response = await fetch(`${CONFIG.API_BASE}/api/insercoes/recentes`);
        if (response.ok) {
            const data = await response.json();
            
            // Renderizar TUDO DE UMA VEZ (batch rendering)
            if (data.success && data.insercoesRecentes) {
                renderizarListaInsercoes(data.insercoesRecentes);
                atualizarTicker({ insercoesRecentes: data.insercoesRecentes });
            }
        }
        
        // 📊 A CADA 90 SEGUNDOS: Atualizar métricas + gráficos
        if (!window._ultimaAtualizacaoCompleta) {
            window._ultimaAtualizacaoCompleta = Date.now();
        }
        
        const agora = Date.now();
        const tempoDecorrido = agora - window._ultimaAtualizacaoCompleta;
        
        if (tempoDecorrido >= 90000) {
            console.log('🔴 Atualização completa (métricas + gráficos)...');
            const responseCompleta = await fetch(`${CONFIG.API_BASE}/api/dashboard`);
            
            if (responseCompleta.ok) {
                const dataCompleta = await responseCompleta.json();
                if (dataCompleta.success && dataCompleta.metricas) {
                    // Renderizar métricas e gráficos
                    atualizarMetricasComDeteccao(dataCompleta.metricas);
                    renderizarGraficoEmissoras(dataCompleta.metricas.topEmissorasComMaiorNumeroCampanhas || []);
                    
                    if (dataCompleta.metricas.top3CidadesComEmissoras?.length > 0) {
                        renderizarGracoCidadesGrade(dataCompleta.metricas.top3CidadesComEmissoras);
                    } else {
                        renderizarGraficoCidades(dataCompleta.metricas.topCidadesComMaiorNumeroEmissoras || []);
                    }
                    
                    window._ultimaAtualizacaoCompleta = Date.now();
                }
            }
        }
        
        // 📈 Atualizar tempos relativos
        atualizarTemposRelativos();
        
    } catch (erro) {
        console.error('❌ Erro no ciclo de atualização:', erro);
    }
    
    // 🔄 Continuar o ciclo
    cicloAtualizacaoRecorrente();
}

/**
 * Helper: Aguardar X milissegundos
 */
function aguardar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =========================
// MAPA
// =========================

function inicializarMapa() {
    // O SVG é carregado automaticamente via <img src="mapa-brasil.svg">
    // A biblioteca já insere o SVG real no elemento mapa-brasil
    console.log('🗺️ Mapa do Brasil carregado (mapa-brasil.svg)');
}

// =========================
// API - BUSCAR DADOS
// =========================

async function buscarDashboardCompleto() {
    try {
        console.log('%c📊 Buscando dashboard completo...', 'color: #4ecdc4; font-weight: bold;');

        const response = await fetch(`${CONFIG.API_BASE}/api/dashboard`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
            dashboardData = data;
            console.log(`   ✅ Dashboard recebido com ${data.insercoesRecentes?.length || 0} inserções`);
            if (data.debug) {
                console.log(`   Debug:`, data.debug);
            }
            renderizarDashboard(data);
            return true;
        } else {
            console.error('❌ Erro nos dados:', data.error);
            mostrarErro('Erro ao carregar dados do dashboard');
            return false;
        }

    } catch (error) {
        console.error('❌ Erro ao buscar dashboard:', error);
        mostrarErro(`Erro de conexão: ${error.message}`);
        return false;
    }
}



// =========================
// RENDERIZAÇÃO - DASHBOARD
// =========================

function renderizarDashboard(data) {
    // Métricas - com detecção de mudanças
    atualizarMetricasComDeteccao(data.metricas);

    // Gráficos
    renderizarGraficoEmissoras(data.metricas.topEmissorasComMaiorNumeroCampanhas || []);
    
    // ✨ NOVO: Renderizar top 3 cidades em grade (ou fallback para gráfico antigo)
    if (data.metricas.top3CidadesComEmissoras && data.metricas.top3CidadesComEmissoras.length > 0) {
        renderizarGracoCidadesGrade(data.metricas.top3CidadesComEmissoras);
    } else {
        renderizarGraficoCidades(data.metricas.topCidadesComMaiorNumeroEmissoras || []);
    }

    // Lista de inserções
    renderizarListaInsercoes(data.insercoesRecentes || []);

    console.log('✅ Dashboard renderizado');
}

// =========================
// 🔴 ATUALIZAÇÃO A CADA 90 SEGUNDOS
// =========================


// =========================
// DETECÇÃO DE MUDANÇAS - MÉTRICAS
// =========================

/**
 * Atualiza as métricas e DETECTA quando cada uma muda
 * Loga quais métricas sofreram alteração e qual foi a diferença
 */
function atualizarMetricasComDeteccao(novasMetricas) {
    const agora = new Date();
    const horaFormatada = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}:${String(agora.getSeconds()).padStart(2, '0')}`;
    
    let houveAlteracao = false;
    const alteracoes = [];
    
    // Verificar campanhas
    if (novasMetricas.campanhasAtivas !== metricasAnteriores.campanhasAtivas) {
        const anterior = metricasAnteriores.campanhasAtivas;
        const novo = novasMetricas.campanhasAtivas;
        houveAlteracao = true;
        
        if (anterior !== null) {
            const diferenca = novo - anterior;
            const sinal = diferenca > 0 ? '+' : '';
            alteracoes.push(`📢 Campanhas: ${anterior} → ${novo} (${sinal}${diferenca})`);
        }
        
        const elemCampanhas = document.getElementById('metrica-campanhas');
        if (elemCampanhas) elemCampanhas.textContent = novo;
        metricasAnteriores.campanhasAtivas = novo;
    }
    
    // Verificar rádios ativas
    if (novasMetricas.emissorasAtivas !== metricasAnteriores.emissorasAtivas) {
        const anterior = metricasAnteriores.emissorasAtivas;
        const novo = novasMetricas.emissorasAtivas;
        houveAlteracao = true;
        
        if (anterior !== null) {
            const diferenca = novo - anterior;
            const sinal = diferenca > 0 ? '+' : '';
            alteracoes.push(`📻 Rádios: ${anterior} → ${novo} (${sinal}${diferenca})`);
        }
        
        const elemRadios = document.getElementById('metrica-radios');
        if (elemRadios) elemRadios.textContent = novo;
        metricasAnteriores.emissorasAtivas = novo;
    }
    
    // Verificar inserções HOJE
    if (novasMetricas.insercoesHoje !== metricasAnteriores.insercoesHoje) {
        const anterior = metricasAnteriores.insercoesHoje;
        const novo = novasMetricas.insercoesHoje;
        houveAlteracao = true;
        
        if (anterior !== null) {
            const diferenca = novo - anterior;
            const sinal = diferenca > 0 ? '+' : '';
            alteracoes.push(`📊 INSERÇÕES HOJE: ${anterior} → ${novo} (${sinal}${diferenca})`);
            
            // 🎯 LOG DETALHADO QUANDO INSERÇÕES MUDAM
            console.warn(`%c⚡ ${horaFormatada} - MUDANÇA EM INSERÇÕES HOJE`, 'color: #ff6b6b; font-weight: bold; font-size: 14px;');
            console.log(`   Anterior: ${anterior}`);
            console.log(`   Novo:     ${novo}`);
            console.log(`   Diferença: ${sinal}${diferenca} inserções`);
        }
        
        const elemInsercoes = document.getElementById('metrica-insercoes');
        if (elemInsercoes) elemInsercoes.textContent = novo;
        metricasAnteriores.insercoesHoje = novo;
    }
    
    // Logar mudanças detectadas
    if (houveAlteracao && alteracoes.length > 0) {
        console.log(`%c${horaFormatada} - ALTERAÇÕES DETECTADAS`, 'color: #4ecdc4; font-weight: bold;');
        alteracoes.forEach(alt => console.log(`   ${alt}`));
    }
}

// =========================
// RENDERIZAÇÃO - GRÁFICOS
// =========================

function renderizarGraficoEmissoras(topEmissoras) {
    const container = document.getElementById('grafico-emissoras');
    
    if (!container) {
        console.warn('⚠️ Elemento #grafico-emissoras não encontrado');
        return;
    }

    if (topEmissoras.length === 0) {
        container.innerHTML = '<div class="loading">Nenhum dado disponível</div>';
        return;
    }

    console.log(`📊 renderizarGraficoEmissoras() recebeu ${topEmissoras.length} emissoras:`);
    topEmissoras.slice(0, 5).forEach((e, i) => {
        console.log(`   [${i}] ${e.emissora} - campanhas: ${e.numerosCampanhasAtivas}`);
    });

    // Usar "numerosCampanhasAtivas" como valor principal
    const maxValor = Math.max(...topEmissoras.map(e => e.numerosCampanhasAtivas || 0));

    const graficoHTML = topEmissoras.slice(0, 8).map(emissora => {
        const valor = emissora.numerosCampanhasAtivas || 0;
        const larguraPercentual = (valor / maxValor) * 100;
        const nomeResumido = truncarTexto(emissora.emissora, 40);

        return `
            <div class="grafico-barra">
                <div class="grafico-label" title="${emissora.emissora}">${nomeResumido}</div>
                <div class="grafico-bar-container">
                    <div class="grafico-bar" style="width: ${larguraPercentual}%">
                        <span class="grafico-valor">${valor}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = graficoHTML;
}

/**
 * ✨ NOVO: Renderizar top 3 cidades em grade
 * Cada cidade exibe seu nome, quantidade de emissoras e lista de emissoras
 */
function renderizarGracoCidadesGrade(top3Cidades) {
    const container = document.getElementById('grafico-cidades');
    
    if (!container) {
        console.warn('⚠️ Elemento #grafico-cidades não encontrado');
        return;
    }

    if (!top3Cidades || top3Cidades.length === 0) {
        container.innerHTML = '<div class="loading">Nenhum dado disponível</div>';
        return;
    }

    console.log(`✨ renderizarGracoCidadesGrade() recebeu ${top3Cidades.length} cidades:`);
    top3Cidades.forEach((c, i) => {
        console.log(`   [${i}] ${c.chaveCompleta} - ${c.numerosEmissorasAtivas} emissoras`);
        console.log(`      Emissoras: ${c.emissoras.slice(0, 5).join(', ')}${c.emissoras.length > 5 ? '...' : ''}`);
    });

    const gradesHTML = top3Cidades.map((cidade, idx) => {
        const emissorasHTML = cidade.emissoras.slice(0, 10).map(emissora => {
            const nomeResumido = truncarTexto(emissora, 28);
            return `<div class="emissora-item" title="${emissora}">${nomeResumido}</div>`;
        }).join('');

        const temMais = cidade.emissoras.length > 10;

        return `
            <div class="cidade-card">
                <h4>${cidade.chaveCompleta}</h4>
                <div class="cidade-card-contador">${cidade.numerosEmissorasAtivas} emissoras</div>
                <div class="emissoras-list">
                    ${emissorasHTML}
                    ${temMais ? `<div class="emissora-item" style="color: #7B2CBF; font-style: italic;">+${cidade.emissoras.length - 10} mais...</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // Definir a classe correta para a grade
    container.className = 'grafico-cidades-grade';
    container.innerHTML = gradesHTML;
}

function renderizarGraficoCidades(topCidades) {
    const container = document.getElementById('grafico-cidades');
    
    if (!container) {
        console.warn('⚠️ Elemento #grafico-cidades não encontrado');
        return;
    }

    if (topCidades.length === 0) {
        container.innerHTML = '<div class="loading">Nenhum dado disponível</div>';
        return;
    }

    console.log(`📊 renderizarGraficoCidades() recebeu ${topCidades.length} cidades:`);
    topCidades.slice(0, 5).forEach((c, i) => {
        console.log(`   [${i}] ${c.cidade} - emissoras: ${c.numerosEmissorasAtivas}`);
    });

    // Usar "numerosEmissorasAtivas" como valor principal
    const maxValor = Math.max(...topCidades.map(c => c.numerosEmissorasAtivas || 0));

    const graficoHTML = topCidades.slice(0, 8).map(cidade => {
        const valor = cidade.numerosEmissorasAtivas || 0;
        const larguraPercentual = (valor / maxValor) * 100;

        return `
            <div class="grafico-barra">
                <div class="grafico-label">${cidade.cidade}</div>
                <div class="grafico-bar-container">
                    <div class="grafico-bar" style="width: ${larguraPercentual}%">
                        <span class="grafico-valor">${valor}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = graficoHTML;
}

function renderizarListaInsercoes(insercoes) {
    const container = document.getElementById('lista-insercoes-lateral');
    
    if (!container) {
        console.warn('⚠️ Elemento #lista-insercoes-lateral não encontrado');
        return;
    }

    console.log(`🎯 renderizarListaInsercoes chamado com ${insercoes ? insercoes.length : 'N/A'} inserções`);

    if (!Array.isArray(insercoes)) {
        console.error('❌ ERRO: insercoes não é um array!', typeof insercoes, insercoes);
        container.innerHTML = '<div class="loading">Erro ao carregar inserções</div>';
        return;
    }

    if (insercoes.length === 0) {
        console.warn('⚠️ Nenhuma inserção encontrada');
        container.innerHTML = '<div class="loading">Nenhuma inserção encontrada</div>';
        return;
    }
    
    // 🔥 FILTRO DE 1 HORA: Manter apenas inserções dos últimos 60 minutos
    const agora = new Date();
    const offsetBrasilia = -3 * 60;
    const agoraBrasilia = new Date(agora.getTime() + offsetBrasilia * 60 * 1000);
    const horaAtual = agoraBrasilia.getHours();
    const minutoAtual = agoraBrasilia.getMinutes();
    const dataAtual = agoraBrasilia.toISOString().split('T')[0];
    
    // Converter horário HH:MM para minutos desde meia-noite
    const minutoAtualTotal = horaAtual * 60 + minutoAtual;
    const minutoLimite = minutoAtualTotal - 60; // 60 minutos atrás
    
    const insercoesFiltradas = insercoes.filter((ins, idx) => {
        // Validar dados completos
        const valido = ins.stationName && ins.hour && ins.city;
        if (!valido) {
            console.warn(`⚠️ Inserção ${idx} incompleta:`, ins);
            return false;
        }
        
        // 🔥 FILTRO TEMPORAL: Converter hora da inserção para minutos
        const [horaStr, minStr] = ins.hour.split(':');
        const minutoInsercao = parseInt(horaStr) * 60 + parseInt(minStr);
        
        // Se dentro de 1 hora, manter
        if (minutoInsercao >= minutoLimite && minutoInsercao <= minutoAtualTotal) {
            return true;
        }
        
        // Se ultrapassou meia-noite (minuto negativo), considerar do dia anterior
        if (minutoLimite < 0 && minutoInsercao >= (1440 + minutoLimite)) {
            return true;
        }
        
        return false;
    });

    console.log(`   ✅ Após filtro de validação + 1 hora: ${insercoesFiltradas.length}/${insercoes.length} inserções válidas`);

    if (insercoesFiltradas.length === 0) {
        console.error('❌ Nenhuma inserção com dados completos!');
        container.innerHTML = '<div class="loading">Nenhuma inserção válida</div>';
        return;
    }

    // Mostrar apenas 10 inserções (cabe melhor no layout lateral)
    const top10 = insercoesFiltradas.slice(0, 10);
    console.log(`   📍 Top 10 selecionadas (de ${insercoesFiltradas.length})`);
    const listaHTML = top10.map((insercao, index) => {
        // ⭐ HORÁRIO REMOVIDO: Não mostrar hora na tabela lateral
        // A conversão de horário agora é apenas no ticker
        
        return `
        <div class="insercao-item ${index < 3 ? 'nova' : ''}" data-hora="${insercao.hour}">
            <div class="insercao-header">
                <div class="insercao-radio">${truncarTexto(insercao.stationName, 25)}</div>
            </div>
            <div class="insercao-detalhes">
                ${insercao.city}${insercao.uf ? '/' + insercao.uf : ''}
            </div>
        </div>
    `;
    }).join('');
    
    // ⭐ REMOVIDO: Símbolo "+" removido
    container.innerHTML = listaHTML;
    console.log(`   ✨ Lista renderizada com ${top10.length} inserções`);
}

/**
 * Atualiza os tempos relativos de todas as inserções
 * Chamado periodicamente para manter os tempos atualizados
 */
function atualizarTemposRelativos() {
    const items = document.querySelectorAll('.insercao-item[data-hora]');
    
    items.forEach(item => {
        const hora = item.getAttribute('data-hora');
        const tempoRelativo = calcularTempoRelativo(hora);
        
        // Encontrar e atualizar o elemento de hora
        const elementoHora = item.querySelector('.insercao-hora');
        if (elementoHora) {
            elementoHora.textContent = tempoRelativo;
        }
    });
}

// =========================
// ANIMAÇÕES NO MAPA
// =========================

function atualizarAnimacoes(novasAnimacoes) {
    const container = document.getElementById('animacoes-layer');
    const mapaContainer = document.getElementById('mapa-container');
    
    if (!container) {
        console.error('❌ ERRO: Elemento #animacoes-layer não encontrado!');
        return;
    }
    
    if (!mapaContainer) {
        console.error('❌ ERRO: Elemento #mapa-container não encontrado!');
        return;
    }
    
    const bounds = mapaContainer.getBoundingClientRect();

    console.log(`📊 atualizarAnimacoes() chamada`);
    console.log(`   Animações novas recebidas: ${novasAnimacoes.length}`);
    console.log(`   Pingas ativos agora: ${animacoesAtivas.size}`);

    // ⭐ NOVA LÓGICA: Adicionar apenas as novas animações
    // O backend já filtra para enviar apenas inserções novas
    let adicionadas = 0;
    novasAnimacoes.forEach(animacao => {
        if (!animacoesAtivas.has(animacao.id)) {
            console.log(`   ➕ Criando nova pinga: ${animacao.id}`);
            console.log(`      Coordenadas: lat=${animacao.lat}, lng=${animacao.lng}`);
            console.log(`      Dados: ${animacao.dados.emissora} - ${animacao.dados.cidade}/${animacao.dados.uf}`);
            criarPinga(animacao, container, bounds);
            adicionadas++;
        }
    });

    if (adicionadas > 0) {
        console.log(`   ✨ ${adicionadas} novas pingas criadas`);
    } else if (novasAnimacoes.length === 0) {
        console.log(`   ℹ️ Sem novas inserções neste polling`);
    }

    console.log(`   📍 Total de pingas no mapa: ${animacoesAtivas.size}`);
}

/**
 * ⭐ NOVO: Criar pinga automaticamente quando uma inserção aparece no ticker
 * Vincula o frontend (ticker) ao mapa (pingas) em tempo real
 * @param {Object} insercao - Dados da inserção (city, stationName, hour, etc)
 * @param {string} tickerId - ID do item do ticker
 */
function criarPingaDoTicker(insercao, tickerId) {
    try {
        // Validar dados mínimos
        if (!insercao || !insercao.city) {
            LoggerOtimizado.log(`Inserção sem city rejeitada (ID: ${tickerId})`, 'pinga-rejeitado');
            return;
        }

        // ID único do pinga baseado na inserção
        const pingaId = `pinga-ticker-${insercao.city}-${insercao.hour}-${insercao.stationName}`;
        
        // Verificar se esse pinga já existe
        if (animacoesAtivas.has(pingaId)) {
            LoggerOtimizado.log(`Pinga já existe: ${insercao.stationName}`, 'pinga-duplicado');
            return;
        }

        buscarCoordenadaECriarPinga(insercao, pingaId, tickerId);

    } catch (error) {
        LoggerOtimizado.erro(`Erro em criarPingaDoTicker: ${error.message}`, error);
    }
}

/**
 * Buscar coordenada de uma cidade e criar o pinga correspondente
 * @param {Object} insercao - Dados da inserção
 * @param {string} pingaId - ID único do pinga
 * @param {string} tickerId - ID do item do ticker
 */
async function buscarCoordenadaECriarPinga(insercao, pingaId, tickerId) {
    try {
        // Buscar coordenada do backend
        const response = await fetch(`${CONFIG.API_BASE}/api/coordenada?cidade=${encodeURIComponent(insercao.city)}`);
        
        if (!response.ok) {
            LoggerOtimizado.aviso(`Não foi possível buscar coordenada para ${insercao.city}`);
            return;
        }

        const data = await response.json();
        
        if (!data.sucesso || !data.coordenada) {
            LoggerOtimizado.log(`Coordenada não encontrada: ${insercao.city}`, 'coordenadas-miss');
            return;
        }

        const coordenada = data.coordenada;
        LoggerOtimizado.log(`Coordenada encontrada: ${insercao.city}`, 'coordenadas-hit');

        // Criar animação com os dados da insercão e coordenada
        const animacao = {
            id: pingaId,
            lat: parseFloat(coordenada.lat),
            lng: parseFloat(coordenada.lng),
            dados: {
                emissora: insercao.stationName || 'N/A',
                cidade: insercao.city || 'N/A',
                uf: insercao.uf || 'N/A',
                cliente: insercao.client || 'N/A',
                horario: insercao.hour || 'N/A',
                campanha: insercao.campaign || 'N/A'
            },
            origem: 'ticker'
        };

        // Obter container do mapa
        const container = document.getElementById('animacoes-layer');
        const mapaContainer = document.getElementById('mapa-container');
        
        if (!container || !mapaContainer) {
            LoggerOtimizado.erro('Containers do mapa não encontrados');
            return;
        }

        const bounds = mapaContainer.getBoundingClientRect();
        
        // Criar o pinga
        criarPinga(animacao, container, bounds);

    } catch (error) {
        LoggerOtimizado.erro(`Erro em buscarCoordenadaECriarPinga`, error);
    }
}

function criarPinga(animacao, container, bounds) {
    try {
        const pinga = document.createElement('div');
        pinga.className = 'pinga';
        pinga.id = animacao.id;

        // Converter coordenadas geográficas para pixels do SVG
        const pos = coordenadasParaPixels(animacao.lat, animacao.lng);
        
        if (CONFIG.VERBOSE_LOGS) {
            console.group(`%c🔴 CRIANDO PING - DETALHADO`, 'color: #ff0000; font-weight: bold;');
            console.log(`   ID: ${animacao.id}`);
            console.log(`   Emissora: ${animacao.dados.emissora}`);
            console.log(`   Cidade: ${animacao.dados.cidade}/${animacao.dados.uf}`);
            console.log(`   Horário: ${animacao.dados.horario}`);
            console.log(`   Coordenadas: lat=${animacao.lat.toFixed(4)}, lng=${animacao.lng.toFixed(4)}`);
            console.log(`   Pixels: x=${pos.x.toFixed(2)}, y=${pos.y.toFixed(2)}`);
            console.log(`   Visibilidade: x em [0, ${bounds.width}]? ${pos.x >= 0 && pos.x <= bounds.width ? '✅' : '❌'}`);
            console.log(`   Visibilidade: y em [0, ${bounds.height}]? ${pos.y >= 0 && pos.y <= bounds.height ? '✅' : '❌'}`);
            console.groupEnd();
        } else {
            LoggerOtimizado.log(`Pinga: ${animacao.dados.emissora} (${animacao.dados.cidade})`, 'pinga-criado');
        }

        pinga.style.left = `${pos.x}px`;
        pinga.style.top = `${pos.y}px`;
        pinga.style.zIndex = '100';
        pinga.style.position = 'absolute';

        // Badge permanente muito transparente - sem horário, apenas emissora e cidade
        const emissora = animacao.dados.emissora.split('(')[0].trim();
        pinga.innerHTML = `
        <div class="pinga-circle"></div>
        <div class="pinga-ripple"></div>
        <div class="label-permanente">
            <div class="label-content">
                <div class="label-emissora">${emissora}</div>
                <div class="label-cidade">${animacao.dados.cidade}</div>
            </div>
        </div>
    `;

        container.appendChild(pinga);
        animacoesAtivas.set(animacao.id, pinga);
        
        // ⭐ NOVO: Remover pinga automaticamente após 30 segundos com fadeout
        const DURACAO_PINGA_MS = 30000; // 30 segundos
        const DURACAO_FADEOUT_MS = 800; // 0.8 segundos
        
        setTimeout(() => {
            const pingElement = document.getElementById(animacao.id);
            if (pingElement) {
                if (CONFIG.VERBOSE_LOGS) {
                    console.log(`   ⏰ Iniciando fadeout do pinga: ${animacao.id}`);
                }

                pingElement.classList.add('fade-out');
                
                setTimeout(() => {
                    if (pingElement.parentNode) {
                        pingElement.remove();
                        animacoesAtivas.delete(animacao.id);
                        console.log(`   🗑️ Pinga removido do DOM: ${animacao.id}`);
                        console.log(`   📍 Total no mapa agora: ${animacoesAtivas.size}`);
                    }
                }, DURACAO_FADEOUT_MS);
            }
        }, DURACAO_PINGA_MS);
        
        // Verificar se foi realmente adicionado
        const verificacao = document.getElementById(animacao.id);
        if (verificacao) {
            const style = window.getComputedStyle(verificacao);
            console.log(`   ✅ Pinga ADICIONADA ao DOM - ID: ${animacao.id}`);
            console.log(`      Visibilidade CSS: position=${style.position}, left=${style.left}, top=${style.top}`);
            console.log(`      Dimensões: width=${style.width}, height=${style.height}`);
            console.log(`      display=${style.display}, visibility=${style.visibility}`);
            console.log(`      ⏱️ Desaparecerá em ${DURACAO_PINGA_MS / 1000}s com fadeout de ${DURACAO_FADEOUT_MS}ms`);
            console.log(`      📍 Container offset: top-left=(${container.offsetLeft}, ${container.offsetTop})`);
        } else {
            console.error(`   ❌ ERRO: Pinga NÃO foi adicionada ao DOM!`);
            console.error(`      Tentou adicionar com ID: ${animacao.id}`);
            console.error(`      Container: ${container.id} (classe: ${container.className})`);
        }
        
        // ⭐ REMOVIDO: Conexão de pings próximos com linhas
        // As linhas ficavam para trás, removidas conforme solicitado

    } catch (error) {
        console.error(`❌ ERRO ao criar pinga: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
    }
}

// Função para detectar pings próximos e conectá-los com uma linha horizontal
function detectarEConectarPingsProximos(pingId, posAtual) {
    const DISTANCIA_MINIMA = 50; // pixels - considerar como "próximo"
    const container = document.getElementById('animacoes-layer');
    
    if (!container) return;
    
    // Procurar outros pings próximos
    const pingAtual = document.getElementById(pingId);
    if (!pingAtual) return;
    
    const outrosPings = Array.from(container.querySelectorAll('.pinga')).filter(el => el.id !== pingId);
    
    // Remover linhas conectoras antigas para este ping
    Array.from(container.querySelectorAll('.linha-conectora')).forEach(linha => {
        if (linha.dataset.pingId === pingId) {
            linha.remove();
        }
    });
    
    let temPingProximo = false;
    
    // Verificar distância para cada outro ping
    outrosPings.forEach(outroPinga => {
        const x1 = posAtual.x;
        const y1 = posAtual.y;
        const x2 = parseFloat(outroPinga.style.left) || 0;
        const y2 = parseFloat(outroPinga.style.top) || 0;
        
        // Calcular distância
        const distancia = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        
        if (distancia > 0 && distancia < DISTANCIA_MINIMA) {
            temPingProximo = true;
            
            // Desenhar linha horizontal entre os pings
            const xMin = Math.min(x1, x2);
            const xMax = Math.max(x1, x2);
            const yMedia = (y1 + y2) / 2;
            
            const linha = document.createElement('div');
            linha.className = 'linha-conectora';
            linha.dataset.pingId = pingId;
            linha.style.left = `${xMin}px`;
            linha.style.top = `${yMedia}px`;
            linha.style.width = `${xMax - xMin}px`;
            
            container.appendChild(linha);
        }
    });
    
    // Se houver ping próximo, deslocar label para cima para evitar sobreposição
    const label = pingAtual.querySelector('.label-permanente');
    if (label) {
        if (temPingProximo) {
            // Mover label para cima quando há pings próximos
            label.style.top = '-22px';
            label.style.transform = 'translateX(-50%)';
        } else {
            // Posição normal
            label.style.top = '10px';
            label.style.transform = 'translateX(-50%)';
        }
    }
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
// UTILIDADES
// =========================

function truncarTexto(texto, maxLength) {
    if (!texto) return '';
    if (texto.length <= maxLength) return texto;
    return texto.substring(0, maxLength - 3) + '...';
}

/**
 * Calcula tempo relativo (ex: "3 horas atrás", "5 minutos atrás")
 * @param {string} hora - Hora da inserção (formato HH:MM:SS ou HH:MM)
 * @returns {string} Tempo relativo formatado
 */
function calcularTempoRelativo(hora) {
    if (!hora) return '--';
    
    // Parse da hora (HH:MM:SS ou HH:MM)
    const [horas, minutos, segundos = 0] = hora.split(':').map(Number);
    
    // Criar momento da inserção no mesmo dia
    const agora = new Date();
    const momentoInsercao = new Date();
    momentoInsercao.setHours(horas, minutos, segundos, 0);
    
    // Calcular diferença em milissegundos
    const diferencaMs = agora - momentoInsercao;
    
    if (diferencaMs < 0) {
        // Inserção no futuro (improvável, mas trata)
        return 'agora';
    }
    
    // Converter para diferentes unidades
    const segundosAtras = Math.floor(diferencaMs / 1000);
    const minutosAtras = Math.floor(segundosAtras / 60);
    const horasAtras = Math.floor(minutosAtras / 60);
    const diasAtras = Math.floor(horasAtras / 24);
    
    // Retornar valor mais apropriado
    if (segundosAtras < 60) {
        return `${segundosAtras}s atrás`;
    } else if (minutosAtras < 60) {
        return `${minutosAtras}m atrás`;
    } else if (horasAtras < 24) {
        return `${horasAtras}h atrás`;
    } else if (diasAtras < 7) {
        return `${diasAtras}d atrás`;
    } else {
        // Para datas muito antigas, mostrar a hora original
        return hora;
    }
}

/**
 * ⭐ NOVO: Converter horário exibido para "agora" (falsa impressão de ao vivo)
 * O horário real permanece no código (data-hora), mas visualmente mostra "agora"
 * @param {string} horaOriginal - Hora original no formato HH:MM ou HH:MM:SS
 * @returns {string} Horário exibido (HH:MM ou "agora" se foi há pouco)
 */
function converterHorarioVisual(horaOriginal) {
    if (!horaOriginal) return '--';
    
    // ⭐ CORRIGIDO: Retornar o horário da INSERÇÃO, não o horário atual
    // Formato de entrada: "HH:MM" ou "HH:MM:SS"
    // Formato de saída: "HH:MM"
    
    const partes = horaOriginal.split(':');
    const horas = String(partes[0]).padStart(2, '0');
    const minutos = String(partes[1]).padStart(2, '0');
    
    return `${horas}:${minutos}`;
}

function mostrarErro(mensagem) {
    console.error('🚨', mensagem);

    // Mostrar no dashboard
    const elementos = [
        'lista-insercoes-lateral',  // 🔧 CORRIGIDO: era 'lista-insercoes'
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
                topEmissorasComMaiorNumeroCampanhas: [
                    { emissora: "Rádio Nativa FM (95.3) - SC | Joinville", numerosCampanhasAtivas: 12 },
                    { emissora: "Rádio Gazeta (98.7) - SP | São Paulo", numerosCampanhasAtivas: 10 },
                    { emissora: "Rádio Atlântida (102.5) - RS | Porto Alegre", numerosCampanhasAtivas: 8 }
                ],
                topCidadesComMaiorNumeroEmissoras: [
                    { cidade: "São Paulo/SP", numerosEmissorasAtivas: 25 },
                    { cidade: "Rio de Janeiro/RJ", numerosEmissorasAtivas: 18 },
                    { cidade: "Belo Horizonte/MG", numerosEmissorasAtivas: 15 }
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
            <div class="tooltip-hover">
                <div class="tooltip-hover-content">
                    <strong>${nome || 'Teste'}</strong>
                    <div>Lat: ${lat.toFixed(2)}</div>
                    <div>Lng: ${lng.toFixed(2)}</div>
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

/* ==========================================
   NEWS TICKER / RODAPÉ DE NOTÍCIAS
   ========================================== */

/**
 * Renderiza items no ticker de notícias
 * @param {Array} items - Array de items para o ticker
 */
function renderizarTicker(items) {
    const tickerItemsContainer = document.getElementById('ticker-items');
    
    if (!tickerItemsContainer) {
        console.warn('Contenedor de ticker não encontrado');
        return;
    }

    // Limpar items anteriores
    tickerItemsContainer.innerHTML = '';

    if (!items || items.length === 0) {
        // Mostrar mensagem padrão se não houver items
        const defaultItem = document.createElement('div');
        defaultItem.className = 'ticker-item';
        defaultItem.innerHTML = `
            <span class="ticker-item-icon"></span>
            <span class="ticker-item-text">Monitorando em tempo real...</span>
        `;
        tickerItemsContainer.appendChild(defaultItem);
        return;
    }

    // Criar items do ticker
    items.forEach((item, index) => {
        const tickerItem = document.createElement('div');
        tickerItem.className = 'ticker-item';
        
        // ⭐ NOVO: Adicionar classe especial para campanhas novas
        if (typeof item === 'object' && item.id && item.id.includes('info-nova-')) {
            tickerItem.classList.add('nova-campanha');
        }
        
        let conteudo = '';
        
        if (typeof item === 'string') {
            conteudo = `
                <span class="ticker-item-icon"></span>
                <span class="ticker-item-text">${escapeHtml(item)}</span>
            `;
        } else if (typeof item === 'object') {
            const icon = item.icon ? `<span class="ticker-item-icon" style="background-color: ${item.color || '#E03D99'};"></span>` : '';
            const text = item.text || '';
            const highlightColor = item.textColor || '#E03D99';
            const highlight = item.highlight ? `<span class="ticker-item-highlight" style="color: ${highlightColor} !important;">${escapeHtml(item.highlight)}</span>` : '';
            const textColor = item.textColor ? `color: ${item.textColor} !important;` : '';
            
            conteudo = `
                ${icon}
                <span class="ticker-item-text" style="${textColor}">${escapeHtml(text)} ${highlight}</span>
            `;
        }
        
        tickerItem.innerHTML = conteudo;
        tickerItemsContainer.appendChild(tickerItem);
        
        // Duplicar para efeito de loop contínuo
        if (index === items.length - 1) {
            const clonedItems = Array.from(tickerItemsContainer.children).map(child => child.cloneNode(true));
            clonedItems.forEach(cloned => tickerItemsContainer.appendChild(cloned));
        }
    });
}

/**
 * Rastrear items do ticker dinamicamente com auto-remove
 * @type {Map<string, number>} id do item -> timeout ID
 */
const tickerItemsTimeout = new Map();

/**
 * ⭐ NOVO: Variações de textos para o ticker (TEMPO PASSADO)
 * Cada inserção recebe uma mensagem diferente para não ficar monótono
 * Textos em tempo passado para parecer relato do dia
 */
const variacoesMensagensTicker = [
    // Padrão: {hora} {emissora} mensagem {cliente}
    "{hora} {emissora} transmitiu Spot de {cliente}",
    "{hora} {emissora} veiculou Spot de {cliente}",
    "{hora} {emissora} exibiu {cliente}",
    "{hora} {emissora} rodou Spot de {cliente}",
    "{hora} {emissora} passou Spot de {cliente}"
];

/**
 * ⭐ INFORMATIVOS ESPECIAIS - Campanhas novas e milestones
 * Mensagens especiais para eventos importantes
 */
const informativos = {
    // Quando uma NOVA campanha é detectada (apenas campanhas que começam HOJE)
    novaCampanha: [
        "{hora} {cliente} iniciou sua nova campanha {campanha}",
        "{hora} {cliente} começou a veicular {campanha}",
        "{hora} {cliente} lançou a campanha {campanha}",
        "{hora} Estreia de {campanha} com {cliente}",
        "{hora} Primeira inserção de {campanha} com {cliente}"
    ],
    
    // Milestones de inserções
    milestone100: [
        "🎖️ {emissora} ALCANÇOU 100 INSERÇÕES COM {campanha}!",
        "💯 {campanha} EM {emissora}: 100 INSERÇÕES COMPLETADAS!",
        "🏆 MARCO: {emissora} ATINGIU 100 TRANSMISSÕES DE {campanha}",
        "⭐ 100º PASSO: {campanha} CONSOLIDADO EM {emissora}",
        "📊 SUCESSO: {emissora} COMPLETA 100 INSERÇÕES DE {campanha}"
    ],
    
    milestone50: [
        "50️⃣ {emissora} MARCA 50 INSERÇÕES DE {campanha}",
        "⚡ METADE DO CAMINHO: {campanha} EM {emissora} CHEGA A 50!",
        "📈 {emissora} ATINGE 50 TRANSMISSÕES DE {campanha}",
        "💪 {campanha} JÁ ESTÁ EM 50 INSERÇÕES EM {emissora}",
        "🎯 PROGRESSO: 50 INSERÇÕES DE {campanha} EM {emissora}"
    ],
    
    milestone10: [
        "🎬 {emissora} INICIA COM 10 INSERÇÕES DE {campanha}",
        "💫 {campanha} JÁ EM 10 TRANSMISSÕES EM {emissora}",
        "📢 {emissora} CONFIRMA 10 INSERÇÕES DE {campanha}",
        "⭐ {campanha} DECOLANDO: JÁ 10 VEZES EM {emissora}",
        "🚀 {campanha} MARCA PRESENÇA EM {emissora} COM 10 INSERÇÕES"
    ],
    
    // Campanhas com muitas inserções
    muitasInsercoes: [
        "🔥 {campanha} DOMINA {emissora} COM {insercoesCount} INSERÇÕES!",
        "💥 SUCESSO TOTAL: {campanha} JÁ EM {insercoesCount} VEZES EM {emissora}",
        "🎯 {emissora} APOIA FORTE: {insercoesCount} INSERÇÕES DE {campanha}",
        "📊 CAMPANHA FORTE: {campanha} COMANDA {emissora} COM {insercoesCount} VEZES",
        "⚡ PRESENÇA MARCANTE: {campanha} EM {insercoesCount} INSERÇÕES EM {emissora}"
    ]
};

/**
 * ⭐ RASTREAMENTO DE CAMPANHAS NOVAS
 * Detecta quando uma campanha nunca vista antes é exibida
 */
let campanhasDetectadas = new Set(); // Rastreia campanhas já vistas

/**
 * ⭐ NOVO: Rastreamento de data de campanha nova
 * Armazena a data em que a campanha foi detectada como nova
 * @type {Map<string, string>} chaveUnica -> data (YYYY-MM-DD)
 */
let campanhasDataDeteccao = new Map();

/**
 * ⭐ NOVO: Rastreamento de milestones de campanhas
 * Armazena o número de inserções por campanha
 * @type {Map<string, number>}
 */
let milestoneCampanhas = new Map();

/**
 * ⭐ NOVO: Detectar e processar milestones de campanha
 * Retorna informativo especial se uma campanha atingiu um milestone
 * @param {string} estacao - Nome da estação
 * @param {string} campanha - Nome da campanha
 * @param {number} contador - Número total de inserções (do backend)
 * @returns {Object|null} Objeto com tipo e mensagem se houver milestone, null caso contrário
 */
function detectarMilestone(estacao, campanha, contador) {
    const chaveUnica = `${estacao}-${campanha}`;
    const contagemAnterior = milestoneCampanhas.get(chaveUnica) || 0;
    
    // Atualizar contagem
    milestoneCampanhas.set(chaveUnica, contador);
    
    // Detectar milestones (apenas quando passa de um limite)
    const milestones = [
        { limite: 100, tipo: 'milestone100' },
        { limite: 50, tipo: 'milestone50' },
        { limite: 10, tipo: 'milestone10' }
    ];
    
    for (const { limite, tipo } of milestones) {
        if (contagemAnterior < limite && contador >= limite) {
            console.log(`   🎖️ MILESTONE DETECTADO: ${chaveUnica} atingiu ${limite} inserções!`);
            const informativo = selecionarInformativoEspecial(tipo)
                .replace('{emissora}', estacao)
                .replace('{campanha}', campanha)
                .replace('{insercoesCount}', contador);
            
            return {
                tipo: tipo,
                mensagem: informativo,
                chaveUnica: chaveUnica
            };
        }
    }
    
    // Detectar quando passou de 100 (múltiplos)
    if (contagemAnterior > 100 && contador > contagemAnterior) {
        const informativo = selecionarInformativoEspecial('muitasInsercoes')
            .replace('{emissora}', estacao)
            .replace('{campanha}', campanha)
            .replace('{insercoesCount}', contador);
        
        return {
            tipo: 'muitasInsercoes',
            mensagem: informativo,
            chaveUnica: chaveUnica
        };
    }
    
    return null;
}

/**
 * ⭐ NOVO: Validar se campanha começou hoje
 * Compara a data de início da campanha com a data de hoje
 * @param {Object} insercao - Objeto da inserção (deve conter campaign_start_date)
 * @returns {boolean} true se campanha começou hoje, false caso contrário
 */
function campanhaComecouHoje(insercao) {
    if (!insercao || !insercao.campaign_start_date) return false;
    
    const dataHoje = new Date();
    dataHoje.setHours(0, 0, 0, 0);
    
    const dataCampanha = new Date(insercao.campaign_start_date);
    dataCampanha.setHours(0, 0, 0, 0);
    
    return dataHoje.getTime() === dataCampanha.getTime();
}

/**
 * ⭐ NOVO: Limpar nome da campanha removendo prefixos numéricos
 * Exemplo: "185.1 ASAAS" → "ASAAS"
 *          "371 MRA VERISURE" → "VERISURE"
 *          "CAMPANHA NORMAL" → "CAMPANHA NORMAL"
 * @param {string} nomeCampanha - Nome original da campanha
 * @returns {string} Nome limpo
 */
function limparNomeCampanha(nomeCampanha) {
    if (!nomeCampanha) return nomeCampanha;
    
    // Remover prefixos: números, pontos, parênteses, espaços
    // Padrões:
    // - "(MRA) Miulium" → "Miulium"
    // - "(mra) Miulium" → "Miulium"
    // - "(VERISURE) Segurança" → "Segurança"
    // - "185.1 ASAAS" → "ASAAS"
    // - "371 VERISURE" → "VERISURE"
    return nomeCampanha
        .replace(/^\([A-Za-z]+\)\s+/g, '') // Remove "(MRA) ", "(mra) ", "(VERISURE) ", etc
        .replace(/^[\d\.]+\s+/g, '')        // Remove "185.1 ", "371 ", etc
        .trim();
}

/**
 * Selecionar uma variação aleatória de mensagem
 * @returns {string} Template de mensagem com placeholders {hora}, {emissora}, {campanha}
 */
function selecionarVariacaoMensagem() {
    const indice = Math.floor(Math.random() * variacoesMensagensTicker.length);
    return variacoesMensagensTicker[indice];
}

/**
 * ⭐ NOVO: Selecionar informativo especial para campanha nova ou milestone
 * @param {string} tipo - 'novaCampanha', 'milestone100', 'milestone50', 'milestone10', 'muitasInsercoes'
 * @returns {string} Informativo aleatório do tipo selecionado
 */
function selecionarInformativoEspecial(tipo) {
    const opcoes = informativos[tipo] || [];
    if (opcoes.length === 0) return null;
    const indice = Math.floor(Math.random() * opcoes.length);
    return opcoes[indice];
}

/**
 * Atualizar ticker com base em dados de inserções recentes
 * Mostra TODAS as últimas inserções com auto-desaparecimento em 30s
 * @param {Object} dados - Dados de inserções recentes
 */
function atualizarTicker(dados) {
    if (!dados) {
        console.warn('⚠️ atualizarTicker: dados nulos/undefined');
        return;
    }

    const items = [];
    
    // Verificar se há inserções
    const temInsercoes = dados.insercoesRecentes && Array.isArray(dados.insercoesRecentes) && dados.insercoesRecentes.length > 0;
    
    if (temInsercoes) {
        // 🔥 LÓGICA: Mostrar TODAS as últimas inserções executadas
        dados.insercoesRecentes.slice(0, 15).forEach((insercao, idx) => {
            try {
                const itemId = `ticker-${insercao.city || 'unknown'}-${insercao.hour || 'unknown'}-${idx}`;
                
                // Formatar hora de forma mais legível
                const hora = insercao.hour || 'N/A';
                
                // ⭐ Converter horário visual para "agora" (falsa impressão de ao vivo)
                const horaVisual = converterHorarioVisual(hora);
                
                const estacao = insercao.stationName ? insercao.stationName.split('(')[0].trim() : 'N/A';
                const cidade = insercao.city || 'N/A';
                const cliente = insercao.client || insercao.campaign || 'N/A'; // Usar cliente da inserção
                // ⭐ Limpar nome da campanha removendo prefixos numéricos
                const campanha = limparNomeCampanha(insercao.campaign) || 'N/A';
                
                // ⭐ NOVO: Detectar campanha nova
                const chaveUnica = `${estacao}-${campanha}`;
                const ehCampanhaNova = !campanhasDetectadas.has(chaveUnica);
                if (ehCampanhaNova) {
                    campanhasDetectadas.add(chaveUnica);
                    // ⭐ NOVO: Armazenar data da detecção (data anterior para considerar como "iniciou ontem")
                    const dataHoje = new Date();
                    const dataAnterior = new Date(dataHoje.getTime() - 24 * 60 * 60 * 1000); // Subtrair 1 dia
                    const dataFormatada = dataAnterior.toISOString().split('T')[0]; // YYYY-MM-DD
                    campanhasDataDeteccao.set(chaveUnica, dataFormatada);
                    console.log(`   🎉 CAMPANHA NOVA DETECTADA: ${campanha} em ${estacao} (data: ${dataFormatada})`);
                }
                
                // ⭐ NOVO: Contar inserções desta campanha nos dados completos
                // O backend fornece "todasInsercoes" no dashboard completo
                let contadorCampanha = 0;
                if (dashboardData && dashboardData.todasInsercoes && Array.isArray(dashboardData.todasInsercoes)) {
                    contadorCampanha = dashboardData.todasInsercoes.filter(ins => 
                        ins.stationName === insercao.stationName && 
                        ins.campaign === insercao.campaign
                    ).length;
                }
                
                // ⭐ NOVO: Detectar milestone desta campanha
                const milestone = contadorCampanha > 0 ? detectarMilestone(estacao, campanha, contadorCampanha) : null;
                
                // ⭐ NOVO: Mensagem formatada com variação de textos
                // Seleciona uma variação aleatória e substitui placeholders
                const templateMensagem = selecionarVariacaoMensagem();
                const mensagemTicker = templateMensagem
                    .replace('{hora}', horaVisual)
                    .replace('{emissora}', estacao)
                    .replace('{cliente}', cliente)
                    .replace('{campanha}', campanha)
                    .replace('{cidade}', cidade);
                
                items.push({
                    id: itemId,
                    icon: true,
                    text: mensagemTicker,
                    textColor: '#E03D99', // ⭐ Texto em rosa (emissora e cliente ficarão rosa)
                    highlight: `${cidade}`,
                    color: '#E03D99'
                });
                
                // ⭐ NOVO: Adicionar informativo especial de campanha nova
                // ⭐ VALIDAÇÃO: Apenas mostrar se a campanha começou HOJE
                const campanhaComecouHojeFlag = insercao.campaign_start_date && campanhaComecouHoje(insercao);
                if (ehCampanhaNova && campanhaComecouHojeFlag) {
                    // ⭐ NOVO: Informativo com cliente e campanha em rosa
                    const informativoNova = selecionarInformativoEspecial('novaCampanha')
                        .replace('{hora}', horaVisual)
                        .replace('{cliente}', cliente)
                        .replace('{campanha}', campanha);
                    
                    items.push({
                        id: `info-nova-${itemId}`,
                        icon: true,
                        text: informativoNova,
                        highlight: 'NOVA CAMPANHA',
                        color: '#FF6B9D', // ⭐ Rosa do ícone
                        textColor: '#FF6B9D' // ⭐ Todo o texto em rosa
                    });
                    console.log(`   ✨ Informativo NOVA CAMPANHA adicionado: ${informativoNova}`);
                }
                
                // ⭐ NOVO: Adicionar informativo especial de milestone
                if (milestone) {
                    // ⭐ NOVO: Informativo em MAIÚSCULAS
                    const mensagemMaiuscula = milestone.mensagem.toUpperCase();
                    
                    items.push({
                        id: `info-milestone-${itemId}-${milestone.tipo}`,
                        icon: true,
                        text: mensagemMaiuscula,
                        highlight: `🎖️ ${milestone.tipo.toUpperCase()}`,
                        color: '#FF6B9D' // Rosa escuro para milestones
                    });
                    console.log(`   🏆 Informativo MILESTONE adicionado: ${mensagemMaiuscula}`);
                }
                
                // ⏰ Configurar auto-remove em 120 segundos
                configurarAutoRemoveTicker(itemId);
            } catch (e) {
                console.error(`   ❌ Erro ao processar insercao[${idx}]: ${e.message}`);
            }
        });
    } else {
        console.warn('⚠️ insercoesRecentes vazio ou não é array');
        if (!dados.insercoesRecentes) console.log('   - dados.insercoesRecentes é undefined/null');
        if (dados.insercoesRecentes && !Array.isArray(dados.insercoesRecentes)) console.log('   - dados.insercoesRecentes não é um array');
        if (dados.insercoesRecentes && Array.isArray(dados.insercoesRecentes) && dados.insercoesRecentes.length === 0) console.log('   - Array vazio');
    }

    // Se não houver items, usar padrão
    if (items.length === 0) {
        console.log('📝 Usando mensagem padrão (nenhuma inserção para exibir)');
        items.push('Monitorando inserções em tempo real...');
    }

    renderizarTickerDinamico(items);
}

/**
 * Configurar auto-remove de um item do ticker em 30 segundos
 * @param {string} itemId - ID do item do ticker
 */
function configurarAutoRemoveTicker(itemId) {
    // Se já existe timeout para este item, remover
    if (tickerItemsTimeout.has(itemId)) {
        clearTimeout(tickerItemsTimeout.get(itemId));
    }
    
    // Configurar novo timeout de 30 segundos
    const timeoutId = setTimeout(() => {
        const tickerItem = document.querySelector(`[data-ticker-id="${itemId}"]`);
        if (tickerItem) {
            tickerItem.style.animation = 'fadeOut 0.5s ease-out forwards';
            setTimeout(() => {
                if (tickerItem.parentNode) {
                    tickerItem.remove();
                    console.log(`🗑️ Item do ticker removido: ${itemId}`);
                }
            }, 500);
        }
        tickerItemsTimeout.delete(itemId);
    }, 120000); // 120 segundos (aumentado de 60s)
    
    tickerItemsTimeout.set(itemId, timeoutId);
}

/**
 * Renderizar ticker de forma dinâmica (adicionar novos items sem limpar os antigos)
 * @param {Array} novoItems - Novos items a adicionar
 */
function renderizarTickerDinamico(novoItems) {
    const tickerItemsContainer = document.getElementById('ticker-items');
    
    if (!tickerItemsContainer) {
        console.error('❌ Contenedor #ticker-items não encontrado no DOM');
        return;
    }

    console.log(`🎬 renderizarTickerDinamico chamado com ${novoItems.length} items`);
    if (novoItems.length === 0) {
        console.warn(`⚠️ Nenhum item para renderizar no ticker`);
    } else {
        console.log(`📊 Items para ticker:`, novoItems.slice(0, 3).map(i => typeof i === 'string' ? i : i.text || i.id).join(' | '));
    }

    // Adicionar novos items apenas se não existem
    novoItems.forEach((item, index) => {
        const itemId = item.id || `ticker-${Date.now()}-${index}`;
        
        // Verificar se item já existe
        const existente = document.querySelector(`[data-ticker-id="${itemId}"]`);
        if (existente) {
            return; // Skip duplicatas
        }
        
        const tickerItem = document.createElement('div');
        tickerItem.className = 'ticker-item';
        tickerItem.setAttribute('data-ticker-id', itemId);
        
        if (typeof item === 'string') {
            tickerItem.innerHTML = `
                <span class="ticker-item-icon"></span>
                <span class="ticker-item-text">${escapeHtml(item)}</span>
            `;
        } else if (typeof item === 'object') {
            const icon = item.icon ? `<span class="ticker-item-icon" style="background-color: ${item.color || '#E03D99'};"></span>` : '';
            const text = item.text || '';
            const highlight = item.highlight ? `<span class="ticker-item-highlight">${escapeHtml(item.highlight)}</span>` : '';
            
            tickerItem.innerHTML = `
                ${icon}
                <span class="ticker-item-text">${escapeHtml(text)} ${highlight}</span>
            `;
        }
        
        tickerItemsContainer.insertBefore(tickerItem, tickerItemsContainer.firstChild);
        console.log(`✅ Item do ticker adicionado: ${itemId}, total agora: ${tickerItemsContainer.children.length}`);
    });
    
    console.log(`📦 Ticker container tem ${tickerItemsContainer.children.length} items visíveis`);
}

/**
 * Função auxiliar para escapar HTML
 * @param {string} text - Texto a ser escapado
 * @returns {string} Texto escapado
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Integrar ticker com polling existente
 * Modificar função buscarInsercoesRecentes para incluir atualização do ticker
 */
function integrarTickerComPolling() {
    const funcaoOriginal = window.buscarInsercoesRecentes;
    
    if (typeof funcaoOriginal === 'function') {
        window.buscarInsercoesRecentes = async function() {
            const resultado = await funcaoOriginal();
            
            // Atualizar ticker com dados de inserções
            if (resultado && resultado.dados) {
                atualizarTicker(resultado.dados);
            }
            
            return resultado;
        };
    }
}

console.log('✅ Script carregado');
console.log('💡 Para debug de coordenadas, use: enableDebugCoords()');
console.log('💡 Para testar São Paulo: testCoord(-23.5505, -46.6333, "São Paulo")');
console.log('💡 Para testar várias cidades: testCidadesBrasil()');
