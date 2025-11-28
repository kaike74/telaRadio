/**
 * Dashboard Institucional - Monitoramento de Rádio
 * Cloudflare Worker com endpoints otimizados para TV
 */

const API_KEY = "9620cf74-856d-40c2-a091-248e4f322caa";
const GEONAMES_USERNAME = "kaike";
const DELAY_HORAS = 2; // Delay da API original (dados aparecem 2h depois)
const DURACAO_ANIMACAO_SEGUNDOS = 30; // Duração da animação no mapa
const TEMPO_SIMULADO_DELAY_HORAS = 2; // Dashboard simula estar 2h atrás do tempo real

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // CORS headers
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        // Handle CORS preflight
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // Routing
            if (url.pathname === "/api/dashboard") {
                return await handleDashboard(env, corsHeaders);
            } else if (url.pathname === "/api/insercoes/recentes") {
                return await handleInsercoesRecentes(env, corsHeaders);
            } else {
                return new Response(JSON.stringify({
                    error: "Endpoint não encontrado",
                    endpoints: ["/api/dashboard", "/api/insercoes/recentes"]
                }), {
                    status: 404,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }
        } catch (error) {
            console.error("❌ ERRO:", error);
            return new Response(JSON.stringify({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }
    }
};

// ===== ENDPOINT: Dashboard Completo =====
async function handleDashboard(env, corsHeaders) {
    console.log("📊 GET /api/dashboard");

    // IMPORTANTE: Usar tempo simulado (2h atrás) para simular "ao vivo"
    const tempoInfo = calcularTempoSimulado();
    const { data: dataHoje, hora: horaAtual, minuto: minutoAtual, horaNum, minutoNum } = tempoInfo;

    // Tempo real para logs
    const agora = new Date();
    const offsetBrasilia = -3 * 60;
    const agoraBrasilia = new Date(agora.getTime() + offsetBrasilia * 60 * 1000);
    const horaRealBrasilia = String(agoraBrasilia.getHours()).padStart(2, '0');
    const minutoRealBrasilia = String(agoraBrasilia.getMinutes()).padStart(2, '0');

    const CACHE_KEY_DASHBOARD = `dashboard-completo-${dataHoje}`;
    const CACHE_KEY_ULTIMA_ATUALIZACAO = `ultima-atualizacao-${dataHoje}`;

    console.log(`⏰ Horário Real: ${horaRealBrasilia}:${minutoRealBrasilia} | Simulado (dashboard): ${horaAtual}:${minutoAtual}`);

    // CACHE INTELIGENTE: Verificar se precisa atualizar
    // Sistema verifica a cada 2-5 min se há dados novos da API
    let precisaAtualizar = true;
    let cacheStatus = 'MISS';

    if (env.DASHBOARD_KV) {
        try {
            const ultimaAtualizacao = await env.DASHBOARD_KV.get(CACHE_KEY_ULTIMA_ATUALIZACAO);
            if (ultimaAtualizacao) {
                const dadosAtualizacao = JSON.parse(ultimaAtualizacao);
                const minutosDesdeAtualizacao = calcularMinutosDecorridos(
                    dadosAtualizacao.hora,
                    dadosAtualizacao.minuto,
                    horaAtual,
                    minutoAtual
                );

                // Cache válido por 2-5 minutos
                // Isso permite verificar constantemente se há dados novos sem sobrecarregar a API
                if (minutosDesdeAtualizacao < 2) {
                    precisaAtualizar = false;
                    cacheStatus = 'HIT';
                    console.log(`✅ Cache válido (${minutosDesdeAtualizacao} min desde última atualização)`);
                } else {
                    console.log(`🔄 Cache expirado (${minutosDesdeAtualizacao} min) - buscando dados novos`);
                }
            } else {
                console.log(`🆕 Primeiro acesso - criando cache`);
            }
        } catch (error) {
            console.log(`⚠️ Erro ao verificar cache: ${error.message}`);
        }
    }

    // Se tem cache válido, retornar do cache
    if (!precisaAtualizar && env.DASHBOARD_KV) {
        try {
            const cacheCompleto = await env.DASHBOARD_KV.get(CACHE_KEY_DASHBOARD);
            if (cacheCompleto) {
                const dados = JSON.parse(cacheCompleto);
                console.log(`💾 Retornando do cache - economizando chamadas à API`);

                // Recalcular métricas com tempo simulado atual (pode ter mudado)
                const tempoInfoAtual = calcularTempoSimulado();

                return new Response(JSON.stringify({
                    ...dados,
                    fromCache: true,
                    timestamp: new Date().toISOString(),
                    tempoSimulado: `${tempoInfoAtual.hora}:${tempoInfoAtual.minuto}`,
                    metricas: {
                        ...dados.metricas,
                        ultimaAtualizacao: `${tempoInfoAtual.hora}:${tempoInfoAtual.minuto}`
                    }
                }), {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                        "X-Cache-Status": "HIT",
                        "X-Tempo-Simulado": `${tempoInfoAtual.hora}:${tempoInfoAtual.minuto}`
                    }
                });
            }
        } catch (error) {
            console.log(`⚠️ Erro ao ler cache: ${error.message}`);
        }
    }

    // Buscar dados frescos
    console.log(`🔄 Buscando dados frescos da API...`);

    // 1. Buscar campanhas
    const todasCampanhas = await buscarTodasCampanhas();
    const campanhasAtivas = filtrarCampanhasAtivas(todasCampanhas, dataHoje);

    if (campanhasAtivas.length === 0) {
        return criarRespostaVazia(horaAtual, minutoAtual, corsHeaders);
    }

    console.log(`🎯 ${campanhasAtivas.length} campanhas ativas`);

    // 2. Buscar emissoras programadas
    const emissorasProgramadas = await buscarEmissorasProgramadas(campanhasAtivas);

    // 3. Buscar inserções (usando tempo simulado)
    const { insercoesRecentes, todasInsercoes } = await buscarInsercoes(
        campanhasAtivas,
        dataHoje,
        horaNum,
        minutoNum
    );

    console.log(`📻 ${insercoesRecentes.length} inserções recentes`);

    // 4. Processar coordenadas
    const coordenadas = await processarCoordenadas(
        insercoesRecentes,
        env.DASHBOARD_KV,
        dataHoje
    );

    // 5. Calcular métricas
    const metricas = calcularMetricas(
        insercoesRecentes,
        campanhasAtivas,
        emissorasProgramadas
    );

    // 6. Preparar resposta
    const resultado = {
        success: true,
        timestamp: new Date().toISOString(),
        fromCache: false,
        tempoSimulado: `${horaAtual}:${minutoAtual}`,
        tempoReal: `${horaRealBrasilia}:${minutoRealBrasilia}`,
        metricas: metricas,
        coordenadas: coordenadas,
        insercoesRecentes: insercoesRecentes.slice(0, 100),
        debug: {
            totalCampanhas: todasCampanhas.length,
            campanhasAtivas: campanhasAtivas.length,
            emissorasProgramadas: emissorasProgramadas.length,
            totalInsercoes: todasInsercoes.length,
            insercoesRecentes: insercoesRecentes.length,
            horaProcessamento: `${horaAtual}:${minutoAtual}`,
            tempoSimulado: `${horaAtual}:${minutoAtual}`,
            tempoReal: `${horaRealBrasilia}:${minutoRealBrasilia}`,
            delaySimulado: `${TEMPO_SIMULADO_DELAY_HORAS}h`
        }
    };

    // 7. Salvar cache
    if (env.DASHBOARD_KV) {
        try {
            await env.DASHBOARD_KV.put(
                CACHE_KEY_DASHBOARD,
                JSON.stringify(resultado),
                { expirationTtl: 86400 } // 24h
            );

            await env.DASHBOARD_KV.put(
                CACHE_KEY_ULTIMA_ATUALIZACAO,
                JSON.stringify({ hora: horaAtual, minuto: minutoAtual }),
                { expirationTtl: 86400 }
            );

            // Salvar também coordenadas e inserções para o endpoint /recentes
            await env.DASHBOARD_KV.put(
                `insercoes-${dataHoje}`,
                JSON.stringify({ insercoesRecentes, coordenadas }),
                { expirationTtl: 86400 }
            );

            console.log(`💾 Cache salvo`);
        } catch (error) {
            console.log(`⚠️ Erro ao salvar cache: ${error.message}`);
        }
    }

    return new Response(JSON.stringify(resultado, null, 2), {
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Cache-Status": "MISS",
            "X-Tempo-Simulado": `${horaAtual}:${minutoAtual}`,
            "X-Tempo-Real": `${horaRealBrasilia}:${minutoRealBrasilia}`,
            "X-Cache-Info": "Dados atualizados da API"
        }
    });
}

// ===== ENDPOINT: Inserções Recentes (para animações) =====
async function handleInsercoesRecentes(env, corsHeaders) {
    console.log("🔥 GET /api/insercoes/recentes");

    // IMPORTANTE: Usar tempo simulado (2h atrás)
    const tempoInfo = calcularTempoSimulado();
    const dataHoje = tempoInfo.data;

    // Ler inserções do cache
    if (!env.DASHBOARD_KV) {
        return new Response(JSON.stringify({
            success: false,
            error: "KV não configurado"
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    try {
        const cacheInsercoes = await env.DASHBOARD_KV.get(`insercoes-${dataHoje}`);

        if (!cacheInsercoes) {
            return new Response(JSON.stringify({
                success: true,
                animacoes: [],
                message: "Nenhuma inserção em cache. Aguardando próxima atualização."
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const { insercoesRecentes, coordenadas } = JSON.parse(cacheInsercoes);

        // Calcular quais inserções devem estar animando AGORA (usando tempo simulado)
        const animacoes = calcularAnimacoesAtivas(
            insercoesRecentes,
            coordenadas,
            tempoInfo.tempoSimulado
        );

        console.log(`✨ ${animacoes.length} animações ativas agora`);

        return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            animacoes: animacoes,
            debug: {
                totalInsercoesCache: insercoesRecentes.length,
                animacoesAtivas: animacoes.length
            }
        }), {
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "Cache-Control": "no-cache"
            }
        });

    } catch (error) {
        console.error(`❌ Erro ao processar inserções recentes: ${error.message}`);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}

// ===== FUNÇÕES AUXILIARES =====

/**
 * Calcula o tempo simulado (2h atrás do tempo real)
 * Isso permite que o dashboard mostre dados "ao vivo" mesmo com a API tendo delay de 2h
 */
function calcularTempoSimulado() {
    const agora = new Date();
    const offsetBrasilia = -3 * 60; // UTC-3
    const agoraBrasilia = new Date(agora.getTime() + offsetBrasilia * 60 * 1000);

    // Subtrair 2h para simular tempo atrasado
    const tempoSimulado = new Date(agoraBrasilia.getTime() - TEMPO_SIMULADO_DELAY_HORAS * 60 * 60 * 1000);

    return {
        tempoSimulado: tempoSimulado,
        data: tempoSimulado.toISOString().split('T')[0],
        hora: String(tempoSimulado.getHours()).padStart(2, '0'),
        minuto: String(tempoSimulado.getMinutes()).padStart(2, '0'),
        horaNum: tempoSimulado.getHours(),
        minutoNum: tempoSimulado.getMinutes()
    };
}

async function buscarTodasCampanhas() {
    const todasCampanhas = [];
    let pagina = 1;

    while (pagina <= 3) {
        const url = `https://api.audiency.io/advertiser-rest/campaigns?page=${pagina}&limit=500&orderBy=name-asc`;

        try {
            const response = await fetch(url, {
                headers: { "accept": "application/json", "apiKey": API_KEY }
            });

            if (!response.ok) break;

            const data = await response.json();
            const campanhas = data.data?.lines || [];

            todasCampanhas.push(...campanhas);

            if (campanhas.length < 500) break;
            pagina++;

            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            console.log(`❌ Erro página ${pagina}: ${error.message}`);
            break;
        }
    }

    return todasCampanhas;
}

function filtrarCampanhasAtivas(campanhas, dataHoje) {
    const hoje = new Date(dataHoje);
    hoje.setHours(0, 0, 0, 0);

    return campanhas.filter(campanha => {
        if (!campanha.startDate || !campanha.endDate) return false;

        const inicio = new Date(campanha.startDate);
        inicio.setHours(0, 0, 0, 0);

        const fim = new Date(campanha.endDate);
        fim.setHours(23, 59, 59, 999);

        return hoje >= inicio && hoje <= fim;
    });
}

async function buscarEmissorasProgramadas(campanhasAtivas) {
    const emissorasMap = new Map();

    // Limitar a 15 campanhas para evitar timeout
    for (const campanha of campanhasAtivas.slice(0, 15)) {
        try {
            const url = `https://api.audiency.io/advertiser-rest/campaigns/${campanha.id}/programmed-station-filter`;

            const response = await fetch(url, {
                headers: { "accept": "application/json", "apiKey": API_KEY }
            });

            if (response.ok) {
                const data = await response.json();
                const emissoras = Array.isArray(data.data) ? data.data : [];

                emissoras.forEach(emissora => {
                    const emissoraKey = `${emissora.name}-${emissora.id}`;

                    if (!emissorasMap.has(emissoraKey)) {
                        emissorasMap.set(emissoraKey, {
                            id: emissora.id,
                            name: emissora.name,
                            pi: emissora.pi || '',
                            campanhas: [],
                            totalCampanhas: 0
                        });
                    }

                    const emissoraData = emissorasMap.get(emissoraKey);
                    emissoraData.campanhas.push({
                        id: campanha.id,
                        name: campanha.name
                    });
                    emissoraData.totalCampanhas++;
                });
            }

            await new Promise(resolve => setTimeout(resolve, 150));

        } catch (error) {
            console.log(`❌ Erro campanha ${campanha.id}: ${error.message}`);
        }
    }

    return Array.from(emissorasMap.values());
}

async function buscarInsercoes(campanhas, dataHoje, horaAtual, minutoAtual) {
    const todasInsercoes = [];
    const insercoesRecentes = [];

    const horaAtualNum = parseInt(horaAtual);
    const minutoAtualNum = parseInt(minutoAtual);

    // Processar em batches
    for (const campanha of campanhas.slice(0, 15)) {
        try {
            const url = `https://api.audiency.io/advertiser-rest/reports/common/advertiser-execution?page=1&limit=500&countryId=1&campaignId=${campanha.id}&stationDate=${dataHoje}&stationDate=${dataHoje}`;

            const response = await fetch(url, {
                headers: { "accept": "application/json", "apiKey": API_KEY }
            });

            if (response.ok) {
                const data = await response.json();
                const items = data?.data?.lines || [];

                items.forEach(item => {
                    if (!item.hour) return;

                    const [horaItem, minutoItem] = item.hour.split(':').map(Number);
                    const cidade = item.city ? item.city.split(' / ')[0] : '';
                    const uf = item.city ? item.city.split(' / ')[1] : '';

                    const insercao = {
                        stationName: item.stationName || '',
                        client: item.client || campanha.client?.name || '',
                        hour: item.hour || '',
                        city: cidade,
                        uf: uf,
                        date: item.date || '',
                        campaign: campanha.name || '',
                        campaignId: campanha.id,
                        timestamp: `${item.date} ${item.hour}`,
                        horaNumerica: horaItem,
                        minutoNumerico: minutoItem
                    };

                    todasInsercoes.push(insercao);

                    // Inserções até o minuto atual
                    const isRecente = (
                        (horaItem === horaAtualNum && minutoItem <= minutoAtualNum) ||
                        (horaItem < horaAtualNum)
                    );

                    if (isRecente) {
                        insercoesRecentes.push(insercao);
                    }
                });
            }

            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            console.log(`❌ Erro campanha ${campanha.id}: ${error.message}`);
        }
    }

    // Ordenar por mais recente
    insercoesRecentes.sort((a, b) => {
        const timeA = new Date(`${a.date} ${a.hour}`);
        const timeB = new Date(`${b.date} ${b.hour}`);
        return timeB - timeA;
    });

    return { insercoesRecentes, todasInsercoes };
}

async function processarCoordenadas(insercoes, kvNamespace, dataHoje) {
    const cidadesUnicas = [...new Set(insercoes.map(i => i.city).filter(Boolean))];

    if (cidadesUnicas.length === 0) return [];

    const CACHE_KEY_COORDENADAS = `coordenadas-${dataHoje}`;
    let coordenadasCache = {};

    if (kvNamespace) {
        try {
            const cache = await kvNamespace.get(CACHE_KEY_COORDENADAS);
            if (cache) {
                coordenadasCache = JSON.parse(cache);
            }
        } catch (error) {
            console.log(`⚠️ Erro coordenadas cache: ${error.message}`);
        }
    }

    const coordenadasMap = new Map();
    const cidadesNovas = cidadesUnicas.filter(cidade => !coordenadasCache[cidade]);

    // Buscar apenas 2 cidades novas
    for (const cidade of cidadesNovas.slice(0, 2)) {
        try {
            const geonamesUrl = `http://api.geonames.org/searchJSON?q=${encodeURIComponent(cidade)}&country=BR&maxRows=1&username=${GEONAMES_USERNAME}`;
            const response = await fetch(geonamesUrl);

            if (response.ok) {
                const data = await response.json();
                if (data.geonames && data.geonames.length > 0) {
                    const result = data.geonames[0];
                    const coords = {
                        lat: parseFloat(result.lat),
                        lng: parseFloat(result.lng),
                        cidade: cidade
                    };

                    coordenadasMap.set(cidade, coords);
                    coordenadasCache[cidade] = coords;
                }
            }

            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.log(`❌ Erro coordenadas ${cidade}: ${error.message}`);
        }
    }

    // Adicionar do cache
    cidadesUnicas.forEach(cidade => {
        if (coordenadasCache[cidade] && !coordenadasMap.has(cidade)) {
            coordenadasMap.set(cidade, coordenadasCache[cidade]);
        }
    });

    // Salvar cache
    if (kvNamespace && cidadesNovas.length > 0) {
        try {
            await kvNamespace.put(
                CACHE_KEY_COORDENADAS,
                JSON.stringify(coordenadasCache),
                { expirationTtl: 86400 }
            );
        } catch (error) {
            console.log(`⚠️ Erro salvar coordenadas: ${error.message}`);
        }
    }

    return Array.from(coordenadasMap.values());
}

function calcularMetricas(insercoes, campanhasAtivas, emissorasProgramadas) {
    const cidadesAtivas = new Set(insercoes.map(i => i.city).filter(Boolean)).size;

    // Top emissoras por campanhas
    const topEmissoras = emissorasProgramadas
        .sort((a, b) => b.totalCampanhas - a.totalCampanhas)
        .slice(0, 10)
        .map(e => ({
            emissora: e.name,
            campanhas: e.totalCampanhas
        }));

    // Top cidades por emissoras
    const pracasMap = new Map();

    emissorasProgramadas.forEach(emissora => {
        const cidadeMatch = emissora.name.match(/-\s*([A-Z]{2})\s*\|\s*(.+)$/);

        if (cidadeMatch) {
            const uf = cidadeMatch[1];
            const cidade = cidadeMatch[2].trim();
            const pracaKey = `${cidade}-${uf}`;

            if (!pracasMap.has(pracaKey)) {
                pracasMap.set(pracaKey, {
                    cidade: cidade,
                    uf: uf,
                    emissoras: 0
                });
            }

            pracasMap.get(pracaKey).emissoras++;
        }
    });

    const topCidades = Array.from(pracasMap.values())
        .sort((a, b) => b.emissoras - a.emissoras)
        .slice(0, 10)
        .map(praca => ({
            cidade: `${praca.cidade}/${praca.uf}`,
            emissoras: praca.emissoras
        }));

    // USAR TEMPO SIMULADO para mostrar a "hora atual" no dashboard
    const tempoInfo = calcularTempoSimulado();

    return {
        campanhasAtivas: campanhasAtivas.length,
        emissorasAtivas: emissorasProgramadas.length,
        insercoesHoje: insercoes.length,
        cidadesAtivas: cidadesAtivas,
        topEmissoras: topEmissoras,
        topCidades: topCidades,
        ultimaAtualizacao: `${tempoInfo.hora}:${tempoInfo.minuto}`
    };
}

function calcularAnimacoesAtivas(insercoesRecentes, coordenadas, tempoSimulado) {
    const animacoes = [];
    const coordenadasMap = new Map(coordenadas.map(c => [c.cidade, c]));

    insercoesRecentes.forEach(insercao => {
        if (!insercao.city || !insercao.hour) return;

        const coords = coordenadasMap.get(insercao.city);
        if (!coords) return;

        // LÓGICA CORRIGIDA PARA TEMPO SIMULADO:
        // 1. Inserção aconteceu em horário X (ex: 13:30) - registrado na API
        // 2. No tempo simulado, se são "13:30 simulado", inserções de 13:30 devem animar agora
        // 3. Animação dura 30s após o horário da inserção

        const [horaInsercao, minutoInsercao, segundoInsercao = 0] = insercao.hour.split(':').map(Number);

        // Criar momento da inserção no mesmo dia do tempo simulado
        const momentoInsercao = new Date(tempoSimulado);
        momentoInsercao.setHours(horaInsercao, minutoInsercao, segundoInsercao, 0);

        // Fim da animação: 30s após a inserção
        const fimAnimacao = new Date(momentoInsercao.getTime() + DURACAO_ANIMACAO_SEGUNDOS * 1000);

        // Verificar se a inserção deve estar animando no tempo simulado atual
        // Anima se: tempo simulado >= hora da inserção E tempo simulado <= hora + 30s
        if (tempoSimulado >= momentoInsercao && tempoSimulado <= fimAnimacao) {
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

function calcularMinutosDecorridos(horaInicial, minutoInicial, horaFinal, minutoFinal) {
    const inicio = parseInt(horaInicial) * 60 + parseInt(minutoInicial);
    const fim = parseInt(horaFinal) * 60 + parseInt(minutoFinal);
    return fim - inicio;
}

function criarRespostaVazia(hora, minuto, corsHeaders) {
    return new Response(JSON.stringify({
        success: true,
        metricas: {
            campanhasAtivas: 0,
            emissorasAtivas: 0,
            insercoesHoje: 0,
            cidadesAtivas: 0,
            topEmissoras: [],
            topCidades: [],
            ultimaAtualizacao: `${hora}:${minuto}`
        },
        coordenadas: [],
        insercoesRecentes: [],
        debug: {
            mensagem: "Nenhuma campanha ativa hoje"
        }
    }), {
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
        }
    });
}
