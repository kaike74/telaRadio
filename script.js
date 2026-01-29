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

// ⭐ Logger otimizado (agrupador de logs)
const LoggerOtimizado = {
    // Agrupar logs por categoria (grupo + contador)
    _grupos: new Map(),
    _ultimoGrupoTempo: Date.now(),
    INTERVALO_AGRUPAMENTO: 5000, // Agrupar logs com menos de 5s de diferença
    
    // Registrar um log simples
    log(mensagem, categoria = 'geral', emojis = '📋') {
        if (!CONFIG.VERBOSE_LOGS) {
            if (!this._grupos.has(categoria)) {
                this._grupos.set(categoria, { count: 0, exemplo: mensagem });
            }
            const grupo = this._grupos.get(categoria);
            grupo.count++;
            return;
        }
        console.log(`${emojis} ${mensagem}`);
    },
    
    // Logar com grupo nativo (muito mais limpo)
    grupo(titulo, dados, emojis = '📊') {
        if (CONFIG.VERBOSE_LOGS) {
            console.group(`${emojis} ${titulo}`);
            if (typeof dados === 'object') {
                Object.entries(dados).forEach(([chave, valor]) => {
                    console.log(`  ${chave}: ${valor}`);
                });
            } else {
                console.log(dados);
            }
            console.groupEnd();
        } else {
            // Em modo otimizado, apenas contar
            if (!this._grupos.has(titulo)) {
                this._grupos.set(titulo, { count: 0, exemplo: dados });
            }
            this._grupos.get(titulo).count++;
        }
    },
    
    // Exibir resumo agrupado
    exibirResumo() {
        if (this._grupos.size === 0) return;
        
        const agora = Date.now();
        if (agora - this._ultimoGrupoTempo < this.INTERVALO_AGRUPAMENTO) return;
        
        console.group(`%c📦 RESUMO DE LOGS AGRUPADOS`, 'color: #4ecdc4; font-weight: bold; font-size: 12px;');
        this._grupos.forEach((dados, categoria) => {
            if (dados.count > 1) {
                console.log(`  ${categoria}: ${dados.count}x (exemplo: ${JSON.stringify(dados.exemplo).substring(0, 50)}...)`);
            }
        });
        console.groupEnd();
        
        this._grupos.clear();
        this._ultimoGrupoTempo = agora;
    },
    
    // Log de erro (sempre mostrado)
    erro(mensagem, erro = null) {
        console.error(`%c❌ ${mensagem}`, 'color: #ff6b6b; font-weight: bold;');
        if (erro) console.error(erro);
    },
    
    // Log de aviso (sempre mostrado)
    aviso(mensagem) {
        console.warn(`%c⚠️ ${mensagem}`, 'color: #ffd93d; font-weight: bold;');
    }
};

// Configuração
const CONFIG = {
    API_BASE: 'https://dashboard-radio-worker.kaike-458.workers.dev',
    DEVICE_TYPE: DEVICE_TYPE,
    VERBOSE_LOGS: false // Modo otimizado: agrupa logs
};

// 🎯 SISTEMA DE PINGS UNIFICADO
// ================================
// Um único modo permanente com ambos os tipos funcionando simultaneamente:
// 🔴 ROSA (Ephemeral): Desaparecem após 30 segundos
// 🔵 AZUL (Permanente): Ficam na tela infinitamente







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

// 🔧 VALIDAÇÃO DE TAMANHO DE DADOS - Evitar atualizar com dados incompletos
// Se a chamada retorna MENOS dados que o estado atual, ignora a atualização
let ultimoTamanoInsercoes = 0;
let logValidacaoDados = [];

// 🔴 INTERVALO DE ATUALIZAÇÃO DE MÉTRICAS
let intervaloAtualizacaoMetricas = null;

// ⭐ RASTREAMENTO DE INSERÇÕES ANTERIORES
// Armazena IDs de inserções já vistas para evitar duplicatas de pings
let insercoesPreviasIds = new Set();


// =========================
// INICIALIZAÇÃO
// =========================

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar mapa
    inicializarMapa();

    // Inicializar ticker de notícias
    renderizarTicker(['Monitorando inserções em tempo real...']);

    // ⭐ NOVO: Iniciar limpeza periódica de memória (a cada 30 minutos)
    iniciarLimpezaPeriodica();

    // 🎬 NOVO: Sistema de vídeos em background (auto-inicializa)
    console.log('🎬 Sistema de auto-play carregado. Vídeos rodando em background...');

    console.log(`🎯 Sistema de pings ativo: Modo único permanente (Rosa 30s + Azuis infinitos)`);

    // 🔵 NOVO: Carregar pings azuis (todas as inserções do dia) na inicialização
    carregarPingsAzuis();

    // Iniciar orquestração serializada
    iniciarCicloAtualizacao();
});

/**
 * � NOVO: Carregar PINGS AZUIS (todas as inserções do dia)
 * Esses pings ficam na tela indefinidamente até a página ser recarregada
 * Chamado na inicialização da página
 */
async function carregarPingsAzuis() {
    try {
        console.log('🔵 Carregando PINGS AZUIS (todas as inserções do dia)...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/insercoes/todas`, {
                signal: controller.signal,
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.todasInsercoes) {
                console.log(`✅ ${data.todasInsercoes.length} inserções do dia recebidas`);
                console.log(`📍 ${data.debug?.comCidade || 0} com localização (cidade preenchida)`);
                
                // Criar pings azuis para cada inserção
                data.todasInsercoes.forEach((insercao, idx) => {
                    // Pular inserções sem cidade
                    if (!insercao.city || insercao.city.trim() === '') {
                        return;
                    }
                    
                    const animacao = {
                        lat: 0,
                        lng: 0,
                        id: `pinga-azul-${idx}`,
                        tipo: 'azul',
                        origem: 'pinga-azul-permanente',
                        dados: {
                            emissora: insercao.stationName || 'N/A',
                            cidade: insercao.city || 'N/A',
                            horario: insercao.hour || 'N/A',
                            cliente: insercao.client || 'N/A',
                            campanha: insercao.campaign || 'N/A'
                        }
                    };
                    
                    // Buscar coordenadas e criar ping
                    buscarCoordenadaECriarPingaAzul(animacao);
                });
            } else {
                console.warn('⚠️ Resposta inválida de /api/insercoes/todas:', data);
            }
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (error) {
        console.warn('⚠️ Erro ao carregar pings azuis:', error.message);
    }
}

/**
 * Buscar coordenada de uma inserção e criar ping azul
 */
async function buscarCoordenadaECriarPingaAzul(animacao) {
    try {
        // Buscar coordenada da cidade
        const response = await fetch(`${CONFIG.API_BASE}/api/coordenada?cidade=${encodeURIComponent(animacao.dados.cidade)}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            console.warn(`⚠️ Coordenada não encontrada para: ${animacao.dados.cidade}`);
            return;
        }
        
        const coordData = await response.json();
        
        // Verificar se a resposta tem sucesso e coordenadas
        if (coordData.sucesso && coordData.coordenada) {
            animacao.lat = parseFloat(coordData.coordenada.lat);
            animacao.lng = parseFloat(coordData.coordenada.lng);
            
            // Obter container do mapa
            const container = document.getElementById('animacoes-layer');
            const mapaContainer = document.getElementById('mapa-container');
            
            if (container && mapaContainer) {
                const bounds = mapaContainer.getBoundingClientRect();
                // Criar o ping azul
                criarPinga(animacao, container, bounds);
                console.log(`✅ Pinga azul criada: ${animacao.dados.emissora} (${animacao.dados.cidade})`);
            }
        } else {
            console.warn(`⚠️ Resposta inválida da API coordenada para: ${animacao.dados.cidade}`, coordData);
        }
    } catch (error) {
        console.warn(`⚠️ Erro ao buscar coordenada para ${animacao.dados.cidade}:`, error.message);
    }
}

/**
 * �🔴 NOVO: Orquestração Serializada - Um único ciclo que evita race conditions
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
 *  CICLO RECORRENTE: Atualiza a cada 5 segundos de forma serializada
 * - Busca dados do API
 * - Renderiza TUDO de uma vez
 * - Aguarda 5s
 * - Repete
 */
async function cicloAtualizacaoRecorrente() {
    try {
        // ⏱️ Intervalo: 12 segundos (inserções recentes) - Reduz carga em 60%
        await aguardar(12000);
        
        // 📊 Buscar inserções recentes (buscar dados apenas, não renderizar)
        const response = await fetch(`${CONFIG.API_BASE}/api/insercoes/recentes`);
        if (response.ok) {
            const data = await response.json();
            
            // ✅ Dados OK - sempre atualizar (validação de duplicatas é feita no atualizarTicker)
            if (data.success && data.insercoesRecentes) {
                const tamanhoNovo = data.insercoesRecentes.length;
                ultimoTamanoInsercoes = tamanhoNovo;
                
                console.log(`📥 Inserções recentes recebidas: ${tamanhoNovo} itens`);
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
                    console.log(`📊 Dashboard recebido:`);
                    console.log(`   Campanhas: ${dataCompleta.metricas.campanhasAtivas}`);
                    console.log(`   Rádios: ${dataCompleta.metricas.emissorasAtivas}`);
                    console.log(`   Inserções hoje: ${dataCompleta.metricas.insercoesHoje}`);
                    console.log(`   Top cidades: ${dataCompleta.metricas.topCidadesComMaiorNumeroEmissoras?.length || 0}`);
                    console.log(`   Top emissoras: ${dataCompleta.metricas.topEmissorasComMaiorNumeroCampanhas?.length || 0}`);
                    
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

/**
 * ⭐ NOVO: Criar ping de teste fixo em Brasília (DF)
 * Para testes do sistema de pings
 */
function criarPingTesteBasilia() {
    try {
        // Agendar criação do ping para depois que o mapa estiver pronto
        setTimeout(() => {
            const container = document.getElementById('animacoes-layer');
            const mapaContainer = document.getElementById('mapa-container');
            
            if (!container || !mapaContainer) {
                console.warn('⚠️ Containers do mapa não encontrados, pulando ping de teste');
                return;
            }
            
            // Coordenadas de Brasília (DF)
            const animacaoTeste = {
                id: 'ping-teste-brasilia',
                lat: -15.7897,
                lng: -47.8822,
                dados: {
                    emissora: 'Rádio Testizinho (FM)',
                    cidade: 'Brasília',
                    uf: 'DF',
                    cliente: 'TESTE',
                    horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                    campanha: 'Ping de Teste'
                }
            };
            
            const bounds = mapaContainer.getBoundingClientRect();
            
            // Criar o ping
            criarPinga(animacaoTeste, container, bounds);
            
            console.log('✅ Ping de teste em Brasília criado');
            console.log('   ID: ping-teste-brasilia');
            console.log('   Nome: Rádio Testizinho');
            console.log('   Localização: Brasília (DF)');
            
        }, 500); // Aguardar 500ms para o mapa estar pronto
        
    } catch (error) {
        console.error('❌ Erro ao criar ping de teste:', error);
    }
}

// =========================
// API - BUSCAR DADOS
// =========================

// ⭐ NOVO: Cache local para dados do dashboard
let dashboardCache = null;
let dashboardCacheTimestamp = null;

async function buscarDashboardCompleto() {
    const MAX_TENTATIVAS = 3;
    const TIMEOUT_MS = 30000; // 30 segundos (aumentado de 15)
    
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
        try {
            console.log(`%c📊 Buscando dashboard completo (tentativa ${tentativa}/${MAX_TENTATIVAS})...`, 'color: #4ecdc4; font-weight: bold;');

            // Criar um controller com timeout
            const controller = new AbortController();
            let timeoutId;
            
            try {
                timeoutId = setTimeout(() => {
                    console.warn(`⏱️ Timeout de ${TIMEOUT_MS}ms acionado`);
                    controller.abort();
                }, TIMEOUT_MS);

                const response = await fetch(`${CONFIG.API_BASE}/api/dashboard`, {
                    signal: controller.signal,
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                if (data.success) {
                    dashboardData = data;
                    // Salvar no cache
                    dashboardCache = data;
                    dashboardCacheTimestamp = Date.now();
                    
                    console.log(`   ✅ Dashboard recebido com ${data.insercoesRecentes?.length || 0} inserções`);
                    if (data.debug) {
                        console.log(`   Debug:`, data.debug);
                    }
                    renderizarDashboard(data);
                    return true;
                } else {
                    console.error('❌ Erro nos dados:', data.error);
                    throw new Error(data.error || 'Erro desconhecido');
                }
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
            }

        } catch (error) {
            console.warn(`⚠️ Tentativa ${tentativa} falhou:`, error.message);
            
            // Se foi a última tentativa, usar cache
            if (tentativa === MAX_TENTATIVAS) {
                if (dashboardCache) {
                    console.log(`%c💾 Usando cache local do dashboard (${Math.round((Date.now() - dashboardCacheTimestamp) / 1000)}s atrás)`, 'color: #ff9800; font-weight: bold;');
                    dashboardData = dashboardCache;
                    renderizarDashboard(dashboardCache);
                    return true;
                } else {
                    console.error('❌ Erro ao buscar dashboard e sem cache disponível');
                    mostrarErro('Erro de conexão - tentando reconectar...');
                    return false;
                }
            }
            
            // Aguardar antes de tentar novamente
            await aguardar(2000 * tentativa); // 2s, 4s, etc.
        }
    }
    
    return false;
}

// ⭐ NOVO: Limpeza Periódica de Memória
// Previne vazamento de memória após 8+ horas de funcionamento
function iniciarLimpezaPeriodica() {
    // Limpar a cada 30 minutos (1800000ms)
    setInterval(() => {
        console.log('%c🧹 LIMPEZA DE MEMÓRIA INICIADA', 'color: #ff9800; font-weight: bold; font-size: 12px;');
        
        const estadoAntes = {
            cacheLocal: filaRequisicaoCoordenadas.cacheLocal.size,
            insercoesPrevias: insercoesPreviasIds.size,
            tickerTimeouts: tickerItemsTimeout.size,
            campanhasDetectadas: campanhasDetectadas.size,
            campanhasDataDeteccao: campanhasDataDeteccao.size,
            milestoneCampanhas: milestoneCampanhas.size,
            animacoesAtivas: animacoesAtivas.size
        };
        
        // 1️⃣ Limpar cache de coordenadas (manter apenas últimas 200)
        if (filaRequisicaoCoordenadas.cacheLocal.size > 200) {
            const idsCache = Array.from(filaRequisicaoCoordenadas.cacheLocal.keys());
            const paraRemover = idsCache.slice(0, idsCache.length - 200);
            paraRemover.forEach(cidade => {
                filaRequisicaoCoordenadas.cacheLocal.delete(cidade);
            });
            console.log(`   📍 Cache de coordenadas: ${estadoAntes.cacheLocal} → ${filaRequisicaoCoordenadas.cacheLocal.size}`);
        }
        
        // 2️⃣ Limpar inserções prévias (manter apenas as últimas 100)
        if (insercoesPreviasIds.size > 100) {
            insercoesPreviasIds = new Set(Array.from(insercoesPreviasIds).slice(-100));
            console.log(`   📝 Inserções anteriores: ${estadoAntes.insercoesPrevias} → ${insercoesPreviasIds.size}`);
        }
        
        // 3️⃣ Campanhas detectadas (manter apenas últimas 50)
        if (campanhasDetectadas && campanhasDetectadas.size > 50) {
            const campanhasList = Array.from(campanhasDetectadas);
            campanhasDetectadas = new Set(campanhasList.slice(-50));
            console.log(`   🎯 Campanhas detectadas: ${estadoAntes.campanhasDetectadas} → ${campanhasDetectadas.size}`);
        }
        
        // 4️⃣ Datas de campanhas (manter apenas últimas 50)
        if (campanhasDataDeteccao && campanhasDataDeteccao.size > 50) {
            const dataList = Array.from(campanhasDataDeteccao.keys());
            const paraRemoverData = dataList.slice(0, dataList.length - 50);
            paraRemoverData.forEach(campanha => {
                campanhasDataDeteccao.delete(campanha);
            });
            console.log(`   📅 Data de detecção: ${estadoAntes.campanhasDataDeteccao} → ${campanhasDataDeteccao.size}`);
        }
        
        // 5️⃣ Milestone (manter apenas últimas 50)
        if (milestoneCampanhas && milestoneCampanhas.size > 50) {
            const milestoneList = Array.from(milestoneCampanhas.keys());
            const paraRemoverMilestone = milestoneList.slice(0, milestoneList.length - 50);
            paraRemoverMilestone.forEach(campanha => {
                milestoneCampanhas.delete(campanha);
            });
            console.log(`   🏆 Milestones: ${estadoAntes.milestoneCampanhas} → ${milestoneCampanhas.size}`);
        }
        
        // 6️⃣ Remover timeouts de ticker que já teriam expirado
        if (tickerItemsTimeout) {
            let removidosTimeouts = 0;
            for (const [itemId, timeoutId] of tickerItemsTimeout.entries()) {
                // Se o item não existe mais no DOM, remover do mapa
                if (!document.querySelector(`[data-ticker-id="${itemId}"]`)) {
                    clearTimeout(timeoutId);
                    tickerItemsTimeout.delete(itemId);
                    removidosTimeouts++;
                }
            }
            if (removidosTimeouts > 0) {
                console.log(`   ⏱️ Timeouts do ticker: ${estadoAntes.tickerTimeouts} → ${tickerItemsTimeout.size} (removidos ${removidosTimeouts})`);
            }
        }
        
        // 7️⃣ Verificar pings orfãos (no mapa mas não em animacoesAtivas)
        const pingas = document.querySelectorAll('.pinga');
        let orfaos = 0;
        pingas.forEach(pinga => {
            if (!animacoesAtivas.has(pinga.id)) {
                console.warn(`   ⚠️ Pinga orfão encontrado: ${pinga.id}`);
                orfaos++;
            }
        });
        if (orfaos > 0) {
            console.log(`   🗑️ Pingas orfãos encontrados: ${orfaos}`);
        }
        
        console.log(`%c✅ LIMPEZA CONCLUÍDA - Memória otimizada`, 'color: #4caf50; font-weight: bold; font-size: 12px;');
        console.log('   Estado da memória:', {
            cacheLocal: filaRequisicaoCoordenadas.cacheLocal.size,
            insercoesPrevias: insercoesPreviasIds.size,
            tickerTimeouts: tickerItemsTimeout.size,
            campanhasDetectadas: campanhasDetectadas ? campanhasDetectadas.size : 0,
            campanhasDataDeteccao: campanhasDataDeteccao ? campanhasDataDeteccao.size : 0,
            milestoneCampanhas: milestoneCampanhas ? milestoneCampanhas.size : 0,
            animacoesAtivas: animacoesAtivas.size,
            totalMemEmUso: (performance.memory?.usedJSHeapSize / 1048576).toFixed(2) + ' MB'
        });
    }, 30 * 60 * 1000); // 30 minutos
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
    
    // ⭐ GARANTIA DE MONOTONICICIDADE: Usar MÁXIMO entre anterior e novo
    // Métricas NUNCA diminuem, apenas aumentam ou mantêm
    
    // Verificar campanhas
    if (novasMetricas.campanhasAtivas !== metricasAnteriores.campanhasAtivas) {
        const anterior = metricasAnteriores.campanhasAtivas;
        const novo = novasMetricas.campanhasAtivas;
        
        // ⭐ NOVO: Se nova métrica é menor, usar anterior (monotonicicidade)
        const valorFinal = (anterior !== null && novo < anterior) ? anterior : novo;
        
        houveAlteracao = true;
        
        if (anterior !== null) {
            const diferenca = valorFinal - anterior;
            const sinal = diferenca > 0 ? '+' : '';
            
            // Avisar se houve descarte por monotonicicidade
            if (novo < anterior) {
                alteracoes.push(`📢 Campanhas: ${anterior} → ${novo} ⚠️ DESCARTADO (${novo} < ${anterior}), mantendo ${anterior}`);
                console.warn(`⚠️ Campanhas ativas diminuiu de ${anterior} para ${novo} - DESCARTANDO para manter monotonicicidade`);
            } else {
                alteracoes.push(`📢 Campanhas: ${anterior} → ${valorFinal} (${sinal}${diferenca})`);
            }
        }
        
        const elemCampanhas = document.getElementById('metrica-campanhas');
        if (elemCampanhas) elemCampanhas.textContent = valorFinal;
        metricasAnteriores.campanhasAtivas = valorFinal;
    }
    
    // Verificar rádios ativas
    if (novasMetricas.emissorasAtivas !== metricasAnteriores.emissorasAtivas) {
        const anterior = metricasAnteriores.emissorasAtivas;
        const novo = novasMetricas.emissorasAtivas;
        
        // ⭐ NOVO: Se nova métrica é menor, usar anterior
        const valorFinal = (anterior !== null && novo < anterior) ? anterior : novo;
        
        houveAlteracao = true;
        
        if (anterior !== null) {
            const diferenca = valorFinal - anterior;
            const sinal = diferenca > 0 ? '+' : '';
            
            if (novo < anterior) {
                alteracoes.push(`📻 Rádios: ${anterior} → ${novo} ⚠️ DESCARTADO, mantendo ${anterior}`);
                console.warn(`⚠️ Rádios ativas diminuiu de ${anterior} para ${novo} - DESCARTANDO para manter monotonicicidade`);
            } else {
                alteracoes.push(`📻 Rádios: ${anterior} → ${valorFinal} (${sinal}${diferenca})`);
            }
        }
        
        const elemRadios = document.getElementById('metrica-radios');
        if (elemRadios) elemRadios.textContent = valorFinal;
        metricasAnteriores.emissorasAtivas = valorFinal;
    }
    
    // Verificar inserções HOJE
    if (novasMetricas.insercoesHoje !== metricasAnteriores.insercoesHoje) {
        const anterior = metricasAnteriores.insercoesHoje;
        const novo = novasMetricas.insercoesHoje;
        
        // ⭐ NOVO: Se nova métrica é menor, usar anterior
        const valorFinal = (anterior !== null && novo < anterior) ? anterior : novo;
        
        houveAlteracao = true;
        
        if (anterior !== null) {
            const diferenca = valorFinal - anterior;
            const sinal = diferenca > 0 ? '+' : '';
            
            if (novo < anterior) {
                alteracoes.push(`📊 INSERÇÕES HOJE: ${anterior} → ${novo} ⚠️ DESCARTADO, mantendo ${anterior}`);
                console.warn(`%c⚡ ${horaFormatada} - Inserções hoje DIMINUIU de ${anterior} para ${novo} - DESCARTANDO`, 'color: #ff6b6b; font-weight: bold;');
            } else {
                alteracoes.push(`📊 INSERÇÕES HOJE: ${anterior} → ${valorFinal} (${sinal}${diferenca})`);
                
                // 🎯 LOG DETALHADO QUANDO INSERÇÕES AUMENTAM
                console.warn(`%c⚡ ${horaFormatada} - MUDANÇA EM INSERÇÕES HOJE`, 'color: #ffb84d; font-weight: bold; font-size: 14px;');
                console.log(`   Anterior: ${anterior}`);
                console.log(`   Novo:     ${valorFinal}`);
                console.log(`   Diferença: ${sinal}${diferenca} inserções`);
            }
        }
        
        const elemInsercoes = document.getElementById('metrica-insercoes');
        if (elemInsercoes) elemInsercoes.textContent = valorFinal;
        metricasAnteriores.insercoesHoje = valorFinal;
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
    
    // Validar e filtrar inserções com dados completos
    const insercoesFiltradas = insercoes.filter((ins, idx) => {
        const valido = ins.stationName && ins.hour && ins.city;
        if (!valido) {
            console.warn(`⚠️ Inserção ${idx} incompleta:`, ins);
        }
        return valido;
    });

    console.log(`   ✅ Após filtro de validação: ${insercoesFiltradas.length} inserções válidas`);

    if (insercoesFiltradas.length === 0) {
        console.error('❌ Nenhuma inserção com dados completos!');
        container.innerHTML = '<div class="loading">Nenhuma inserção válida</div>';
        return;
    }

    // Mostrar apenas 10 inserções (cabe melhor no layout lateral)
    const top10 = insercoesFiltradas.slice(0, 10);
    console.log(`   📍 Top 10 selecionadas (de ${insercoesFiltradas.length})`);
    const listaHTML = top10.map((insercao, index) => {
        // ⭐ MODIFICADO: Mostrar tempo relativo "Xm atrás" desde o início
        const tempoRelativo = calcularTempoRelativo(insercao.hour);
        
        return `
        <div class="insercao-item ${index < 3 ? 'nova' : ''}" data-hora="${insercao.hour}">
            <div class="insercao-header">
                <div class="insercao-radio">${truncarTexto(insercao.stationName, 25)}</div>
                <div class="insercao-hora">${tempoRelativo}</div>
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
            console.warn(`⚠️ Inserção sem city rejeitada (ID: ${tickerId})`);
            LoggerOtimizado.log(`Inserção sem city rejeitada (ID: ${tickerId})`, 'pinga-rejeitado');
            return;
        }

        console.log(`🔵 criarPingaDoTicker INICIADO: ${insercao.stationName} em ${insercao.city}`);

        // ID único do pinga baseado na inserção
        const pingaId = `pinga-ticker-${insercao.city}-${insercao.hour}-${insercao.stationName}`;
        
        // Verificar se esse pinga já existe
        if (animacoesAtivas.has(pingaId)) {
            console.log(`⏭️ Pinga já existe: ${insercao.stationName}`);
            LoggerOtimizado.log(`Pinga já existe: ${insercao.stationName}`, 'pinga-duplicado');
            return;
        }

        console.log(`🔶 Adicionando à fila: ${insercao.city}`);
        buscarCoordenadaECriarPinga(insercao, pingaId, tickerId);

    } catch (error) {
        console.error(`❌ Erro em criarPingaDoTicker:`, error);
        LoggerOtimizado.erro(`Erro em criarPingaDoTicker: ${error.message}`, error);
    }
}

// ⭐ SISTEMA DE FILA PARA REQUISIÇÕES DE COORDENADAS
// Evita explosion de requisições quando viewport fica muito aberto
const filaRequisicaoCoordenadas = {
    fila: [],
    emProgress: 0,
    MAX_SIMULTANEOUS: 2,
    MAX_FILA_SIZE: 100, // ⭐ NOVO: Limite máximo de itens na fila
    cacheLocal: new Map(),
    totalProcessadas: 0,
    totalFalhadas: 0,
    
    async adicionar(insercao, pingaId, tickerId) {
        console.log(`📥 [FILA] Tentando adicionar: ${insercao.city} (fila: ${this.fila.length}/${this.MAX_FILA_SIZE})`);
        
        // Se a fila está muito grande, descartar requisição para evitar memory leak
        if (this.fila.length >= this.MAX_FILA_SIZE) {
            console.warn(`⚠️ Fila de coordenadas CHEIA (${this.fila.length}/${this.MAX_FILA_SIZE}). Descartando: ${insercao.city}`);
            return;
        }
        
        // Se já está em cache, usar direto
        if (this.cacheLocal.has(insercao.city)) {
            console.log(`✅ Cache HIT: ${insercao.city}`);
            const cached = this.cacheLocal.get(insercao.city);
            if (cached) {
                await criarPingaComCoordenada(insercao, pingaId, cached);
            }
            return;
        }
        
        console.log(`➕ Adicionando à fila: ${insercao.city}`);
        // Adicionar à fila
        this.fila.push({ insercao, pingaId, tickerId, tentativas: 0 });
        this.processar();
    },
    
    async processar() {
        // Se já tem muitas requisições em progresso, aguardar
        if (this.emProgress >= this.MAX_SIMULTANEOUS || this.fila.length === 0) {
            if (this.fila.length > 0) {
                console.log(`⏳ [FILA] Aguardando slot: ${this.emProgress}/${this.MAX_SIMULTANEOUS} em progresso, fila: ${this.fila.length}`);
            }
            return;
        }
        
        // Pegar próximo da fila
        const { insercao, pingaId, tickerId, tentativas } = this.fila.shift();
        this.emProgress++;
        
        console.log(`🔄 [FILA] Processando: ${insercao.city} (${this.emProgress}/${this.MAX_SIMULTANEOUS} em progresso)`);
        
        try {
            // Fetch com timeout de 10 segundos
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(
                `${CONFIG.API_BASE}/api/coordenada?cidade=${encodeURIComponent(insercao.city)}`,
                { signal: controller.signal }
            );
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                console.warn(`❌ API retornou erro para ${insercao.city}: ${response.status}`);
                LoggerOtimizado.aviso(`Não foi possível buscar coordenada para ${insercao.city}`);
                this.totalFalhadas++;
                this.emProgress--;
                this.processar();
                return;
            }

            const data = await response.json();
            
            if (!data.sucesso || !data.coordenada) {
                console.log(`❌ Coordenada não encontrada: ${insercao.city}`);
                LoggerOtimizado.log(`Coordenada não encontrada: ${insercao.city}`, 'coordenadas-miss');
                this.totalFalhadas++;
                this.emProgress--;
                this.processar();
                return;
            }

            const coordenada = data.coordenada;
            
            console.log(`✅ Coordenada encontrada: ${insercao.city} (${coordenada.lat}, ${coordenada.lng})`);
            
            // Cachear para próximas vezes
            this.cacheLocal.set(insercao.city, coordenada);
            this.totalProcessadas++;
            
            LoggerOtimizado.log(`Coordenada encontrada: ${insercao.city}`, 'coordenadas-hit');
            
            // Criar o pinga com a coordenada
            await criarPingaComCoordenada(insercao, pingaId, coordenada);
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn(`⏱️ Timeout buscando ${insercao.city}`);
                LoggerOtimizado.aviso(`Timeout buscando ${insercao.city}`);
            } else {
                console.error(`🔴 Erro buscando coordenada:`, error);
                LoggerOtimizado.erro(`Erro buscando coordenada: ${error.message}`);
            }
            this.totalFalhadas++;
        } finally {
            this.emProgress--;
            console.log(`✔️ Finalizando requisição, fila restante: ${this.fila.length}`);
            // Continuar processando fila
            setTimeout(() => this.processar(), 100);
        }
    },
    
    getStatus() {
        return {
            filaSize: this.fila.length,
            emProgress: this.emProgress,
            cacheSize: this.cacheLocal.size,
            totalProcessadas: this.totalProcessadas,
            totalFalhadas: this.totalFalhadas
        };
    },
    
    // 🔍 DEBUG: Mostrar status detalhado
    exibirStatus() {
        console.group('%c📊 STATUS DA FILA DE COORDENADAS', 'color: #4ecdc4; font-weight: bold; font-size: 14px;');
        console.log(`Itens na fila: ${this.fila.length}`);
        console.log(`Em progresso: ${this.emProgress}/${this.MAX_SIMULTANEOUS}`);
        console.log(`Cache size: ${this.cacheLocal.size}`);
        console.log(`Total processadas: ${this.totalProcessadas}`);
        console.log(`Total falhadas: ${this.totalFalhadas}`);
        console.log(`Taxa de sucesso: ${((this.totalProcessadas / (this.totalProcessadas + this.totalFalhadas)) * 100 || 0).toFixed(1)}%`);
        console.log(`Pings ativos: ${animacoesAtivas.size}`);
        console.groupEnd();
    }
};

/**
 * Buscar coordenada de uma cidade e criar o pinga correspondente
 * @param {Object} insercao - Dados da inserção
 * @param {string} pingaId - ID único do pinga
 * @param {string} tickerId - ID do item do ticker
 */
async function buscarCoordenadaECriarPinga(insercao, pingaId, tickerId) {
    // Adicionar à fila em vez de fazer requisição direta
    filaRequisicaoCoordenadas.adicionar(insercao, pingaId, tickerId);
}

async function criarPingaComCoordenada(insercao, pingaId, coordenada) {
    try {
        const coordStr = `${coordenada.lat.toFixed(4)}, ${coordenada.lng.toFixed(4)}`;
        console.log(`🎯 criarPingaComCoordenada: ${insercao.city} em (${coordStr})`);
        
        // 🔍 DEBUG: Rastrear Brasília
        if (insercao.city === 'Brasília' || insercao.city === 'BRASILIA' || insercao.city === 'Brasilia') {
            console.warn(`⚠️ BRASÍLIA DETECTADA: ${insercao.city} | Coords: (${coordenada.lat}, ${coordenada.lng}) | ID: ${pingaId}`);
            
            // Adicionar ao debug global
            if (!window.debugBrasilia) {
                window.debugBrasilia = [];
            }
            window.debugBrasilia.push({
                id: pingaId,
                city: insercao.city,
                lat: coordenada.lat,
                lng: coordenada.lng,
                timestamp: new Date().toLocaleTimeString('pt-BR')
            });
            
            console.table(window.debugBrasilia);
        }
        
        // Criar animação com os dados da insercão e coordenada
        // ⭐ NOVO: Formatar horário para exibir apenas HH:MM sem segundos
        const horarioFormatado = insercao.hour ? insercao.hour.substring(0, 5) : 'N/A';
        
        const animacao = {
            id: pingaId,
            lat: parseFloat(coordenada.lat),
            lng: parseFloat(coordenada.lng),
            dados: {
                emissora: insercao.stationName || 'N/A',
                cidade: insercao.city || 'N/A',
                uf: insercao.uf || 'N/A',
                cliente: insercao.client || 'N/A',
                horario: horarioFormatado,
                campanha: insercao.campaign || 'N/A'
            },
            origem: 'ticker'
        };

        // Obter container do mapa
        const container = document.getElementById('animacoes-layer');
        const mapaContainer = document.getElementById('mapa-container');
        
        if (!container || !mapaContainer) {
            console.error(`❌ Containers do mapa não encontrados`);
            LoggerOtimizado.erro('Containers do mapa não encontrados');
            return;
        }

        const bounds = mapaContainer.getBoundingClientRect();
        
        // Criar o pinga
        criarPinga(animacao, container, bounds);

    } catch (error) {
        LoggerOtimizado.erro(`Erro em criarPingaComCoordenada`, error);
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
            console.groupEnd();
        } else {
            LoggerOtimizado.log(`Pinga: ${animacao.dados.cidade}`, 'pinga-criado');
        }

        pinga.style.left = `${pos.x}px`;
        pinga.style.top = `${pos.y}px`;
        pinga.style.zIndex = '100';
        pinga.style.position = 'absolute';

        // 🎯 MODO ÚNICO: Ambos os pings funcionando simultaneamente
        // Todos os pings têm rótulo (horário, emissora, cidade)
        
        const emissora = animacao.dados.emissora.split('(')[0].trim();
        pinga.innerHTML = `
        <div class="pinga-circle"></div>
        <div class="pinga-ripple"></div>
        <div class="label-permanente">
            <div class="label-content">
                <div class="label-horario">${animacao.dados.horario}</div>
                <div class="label-emissora">${emissora}</div>
                <div class="label-cidade">${animacao.dados.cidade}</div>
            </div>
        </div>
    `;
        
        container.appendChild(pinga);
        animacoesAtivas.set(animacao.id, pinga);
        
        // 🔵 Detectar se é pinga azul permanente
        const ehPingaAzul = animacao.origem === 'pinga-azul-permanente' || animacao.tipo === 'azul';
        
        // ⭐ PINGS AZUIS: INFINITOS SEM FADEOUT
        // 🔴 PINGS ROSA: DESAPARECEM APÓS 30 SEGUNDOS
        if (ehPingaAzul) {
            console.log(`🔵 Pinga AZUL criado - PERMANENTE (infinito, sem fadeout): ${animacao.id}`);
        } else {
            console.log(`🔴 Pinga ROSA criado - DESAPARECE após 30 segundos: ${animacao.id}`);
            
            // Apenas ROSA: Aplicar fadeout suave após 30 segundos
            const DURACAO_FADEOUT_MS = 800;
            const TEMPO_ROSA_MS = 30000; // 30 segundos
            
            setTimeout(() => {
                const pingElement = document.getElementById(animacao.id);
                if (pingElement) {
                    pingElement.classList.add('fade-out');
                    setTimeout(() => {
                        if (pingElement.parentNode) {
                            pingElement.remove();
                            animacoesAtivas.delete(animacao.id);
                        }
                    }, DURACAO_FADEOUT_MS);
                }
            }, TEMPO_ROSA_MS); // 30 segundos para rosa desaparecer
        }
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

        // ⭐ AJUSTE DE POSIÇÃO: Deslocar pings para compensar projeção e zoom 90%
        // Ajuste: 2% para cima
        const ajusteY = containerRect.height * -0.02; // -2% (para cima)
        const ajusteX = containerRect.width * 0.0;    // Sem ajuste horizontal
        
        y += ajusteY;
        x += ajusteX;

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

    CONFIG.API_BASE = 'https://dashboard-radio-worker.458e6d616cddf6660731e71235fe4c45.workers.dev';

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
/**
 * ⭐ HISTÓRICO: Armazenar últimos items do ticker para manter continuidade
 * @type {Array} Array de items do ticker mantido em memória
 */
let tickerHistorico = [];
const MAX_TICKER_ITEMS = 20; // Máximo de items a manter no ticker

function renderizarTicker(items) {
    const tickerItemsContainer = document.getElementById('ticker-items');
    
    if (!tickerItemsContainer) {
        console.warn('Contenedor de ticker não encontrado');
        return;
    }

    // ⭐ NOVO: Se não há items, verificar se já temos histórico
    if (!items || items.length === 0) {
        // Se o histórico está vazio, mostrar mensagem padrão
        if (tickerHistorico.length === 0) {
            tickerItemsContainer.innerHTML = '';
            const defaultItem = document.createElement('div');
            defaultItem.className = 'ticker-item';
            defaultItem.innerHTML = `
                <span class="ticker-item-icon"></span>
                <span class="ticker-item-text">Monitorando em tempo real...</span>
            `;
            tickerItemsContainer.appendChild(defaultItem);
        }
        return;
    }

    // ⭐ NOVO: Adicionar novos items ao histórico
    items.forEach(item => {
        if (item && item.id) {
            // Verificar se o item já existe no histórico (evitar duplicatas)
            const jáExiste = tickerHistorico.some(h => h.id === item.id);
            if (!jáExiste) {
                tickerHistorico.push(item);
            }
        }
    });

    // ⭐ NOVO: Manter apenas os últimos N items
    if (tickerHistorico.length > MAX_TICKER_ITEMS) {
        tickerHistorico = tickerHistorico.slice(-MAX_TICKER_ITEMS);
    }

    // ⭐ NOVO: Renderizar todos os items do histórico
    tickerItemsContainer.innerHTML = '';
    
    tickerHistorico.forEach((item, index) => {
        const tickerItem = document.createElement('div');
        tickerItem.className = 'ticker-item';
        tickerItem.id = `ticker-item-${item.id}`;
        
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
            // ⭐ MODIFICADO: Texto branco, cidade rosa e negrito
            const highlight = item.highlight ? `<span class="ticker-item-highlight" style="color: #E03D99 !important; font-weight: bold;">${escapeHtml(item.highlight)}</span>` : '';
            const textColor = 'color: #ffffff !important;'; // ⭐ Texto sempre branco
            
            conteudo = `
                ${icon}
                <span class="ticker-item-text" style="${textColor}">${escapeHtml(text)} ${highlight}</span>
            `;
        }
        
        tickerItem.innerHTML = conteudo;
        tickerItemsContainer.appendChild(tickerItem);
    });

    // ⭐ NOVO: Duplicar para efeito de loop contínuo (apenas uma vez no início)
    if (tickerItemsContainer.children.length > 0) {
        // Verificar se já foi duplicado
        const totalItems = tickerItemsContainer.children.length;
        const metadeEsperada = tickerHistorico.length;
        
        // Se não está duplicado ainda, duplicar
        if (totalItems === metadeEsperada) {
            const clonedItems = Array.from(tickerItemsContainer.children).map(child => child.cloneNode(true));
            clonedItems.forEach(cloned => {
                // Gerar novo ID para clones
                cloned.id = cloned.id + '-clone';
                tickerItemsContainer.appendChild(cloned);
            });
        }
    }

    console.log(`🎬 Ticker atualizado: ${tickerHistorico.length} items no histórico`);
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
 * Mostra TODAS as últimas inserções executadas
 * ⭐ NOVO: Criar pinga APENAS para inserções novas (não vistas antes)
 * @param {Object} dados - Dados de inserções recentes
 */
function atualizarTicker(dados) {
    if (!dados) {
        console.warn('⚠️ atualizarTicker: dados nulos/undefined');
        return;
    }

    const items = [];
    
    // 🔥 NOVA LÓGICA: Mostrar TODAS as últimas inserções executadas
    // Cada inserção aparece com timestamp e desaparece em 120 segundos
    // ⭐ NOVO: Criar pinga APENAS para inserções novas (não vistas antes)
    if (dados.insercoesRecentes && Array.isArray(dados.insercoesRecentes) && dados.insercoesRecentes.length > 0) {
        // ⭐ RASTREAMENTO: Identificar quais são novas
        const novasInsercoes = [];
        const insercoesPaginaAtualIds = new Set();
        
        dados.insercoesRecentes.slice(0, 15).forEach((insercao, idx) => {
            try {
                const itemId = `ticker-${insercao.city || 'unknown'}-${insercao.hour || 'unknown'}-${idx}`;
                
                // ⭐ ID ÚNICO ESTÁVEL: Baseado em estação + cidade (não muda se hora mudar)
                // Removemos 'hour' porque muda a cada minuto
                const insercaoId = `${insercao.stationName}-${insercao.city}-${insercao.campaign}`;
                insercoesPaginaAtualIds.add(insercaoId);
                
                // Verificar se é uma inserção NOVA (não vista antes)
                const isNova = !insercoesPreviasIds.has(insercaoId);
                
                if (isNova) {
                    novasInsercoes.push({ insercao, itemId, insercaoId });
                }
                
                // Formatar hora de forma mais legível
                const hora = insercao.hour || 'N/A';
                
                // ⭐ Converter horário visual para "agora" (falsa impressão de ao vivo)
                const horaVisual = converterHorarioVisual(hora);
                
                const estacao = insercao.stationName ? insercao.stationName.split('(')[0].trim() : 'N/A';
                const cidade = insercao.city || 'N/A';
                const cliente = insercao.client || insercao.campaign || 'N/A'; // ⭐ NOVO: Usar cliente da inserção
                // ⭐ NOVO: Limpar nome da campanha removendo prefixos numéricos
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
                    textColor: '#ffffff', // ⭐ MODIFICADO: Texto branco
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
                        textColor: '#ffffff' // ⭐ MODIFICADO: Texto branco
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
                        color: '#FF6B9D', // Rosa escuro para milestones
                        textColor: '#ffffff' // ⭐ Texto branco
                    });
                    console.log(`   🏆 Informativo MILESTONE adicionado: ${mensagemMaiuscula}`);
                }
                
                // ⭐ MODIFICADO: Criar pinga APENAS se for inserção nova
                if (isNova) {
                    criarPingaDoTicker(insercao, itemId);
                }
                
                // ⏰ Configurar auto-remove em 120 segundos
                configurarAutoRemoveTicker(itemId);
            } catch (e) {
                console.error(`   ❌ Erro ao processar insercao[${idx}]: ${e.message}`);
            }
        });
        
        // ⭐ RASTREAMENTO: Atualizar Set de IDs já processadas
        insercoesPaginaAtualIds.forEach(id => insercoesPreviasIds.add(id));
        
        // ⭐ LIMPEZA: Se temos muitas inserções antigas, limpar as mais antigas
        if (insercoesPreviasIds.size > 100) {
            const arrayIds = Array.from(insercoesPreviasIds);
            const idsParaRemover = arrayIds.slice(0, insercoesPreviasIds.size - 100);
            idsParaRemover.forEach(id => insercoesPreviasIds.delete(id));
        }
        
        console.log(`📊 Ticker: ${dados.insercoesRecentes.length} inserções recentes, ${novasInsercoes.length} novas pra pingar`);
        
        // ⭐ NOVO: Chamar renderizarTicker com os items coletados
        if (items.length > 0) {
            renderizarTicker(items);
        }
        
    } else {
        console.warn('⚠️ insercoesRecentes vazio ou não é array');
        if (!dados.insercoesRecentes) console.log('   - dados.insercoesRecentes é undefined/null');
        if (dados.insercoesRecentes && !Array.isArray(dados.insercoesRecentes)) console.log('   - dados.insercoesRecentes não é um array');
        if (dados.insercoesRecentes && Array.isArray(dados.insercoesRecentes) && dados.insercoesRecentes.length === 0) console.log('   - Array vazio');
    }
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
    
    // Configurar novo timeout de 120 segundos
    const timeoutId = setTimeout(() => {
        // ⭐ NOVO: Remover do histórico
        tickerHistorico = tickerHistorico.filter(item => item.id !== itemId);
        
        // Remover do DOM
        const tickerItem = document.getElementById(`ticker-item-${itemId}`);
        if (tickerItem) {
            tickerItem.style.animation = 'fadeOut 0.5s ease-out forwards';
            setTimeout(() => {
                if (tickerItem.parentNode) {
                    tickerItem.remove();
                    console.log(`🗑️ Item do ticker removido: ${itemId}`);
                }
            }, 500);
        }
        
        // Remover clones também
        const tickerItemClone = document.getElementById(`ticker-item-${itemId}-clone`);
        if (tickerItemClone) {
            tickerItemClone.remove();
        }
        
        tickerItemsTimeout.delete(itemId);
    }, 120000); // 120 segundos
    
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
