/**
 * Dashboard Institucional - Monitoramento de Rádio
 * Cloudflare Worker ATUALIZADO com busca forçada de dados frescos
 */

const API_KEY = "9620cf74-856d-40c2-a091-248e4f322caa";
const GEONAMES_USERNAME = "kaike";
const DURACAO_ANIMACAO_SEGUNDOS = 30; // Duração da animação no mapa

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
    console.log("📊 GET /api/dashboard - BUSCA FORÇADA DE DADOS FRESCOS");

    // Usar horário REAL de Brasília (sem simulação)
    const agora = new Date();
    const offsetBrasilia = -3 * 60;
    const agoraBrasilia = new Date(agora.getTime() + offsetBrasilia * 60 * 1000);

    const dataHoje = agoraBrasilia.toISOString().split('T')[0];
    const horaAtual = String(agoraBrasilia.getHours()).padStart(2, '0');
    const minutoAtual = String(agoraBrasilia.getMinutes()).padStart(2, '0');
    const horaNum = agoraBrasilia.getHours();
    const minutoNum = agoraBrasilia.getMinutes();

    console.log(`⏰ HORÁRIO BRASÍLIA: ${dataHoje} ${horaAtual}:${minutoAtual}`);

    // SEMPRE buscar dados frescos (sem cache de 2 minutos)
    console.log(`🔄 Buscando dados ATUALIZADOS da API...`);

    // 1. Buscar campanhas
    const todasCampanhas = await buscarTodasCampanhas();
    const campanhasAtivas = filtrarCampanhasAtivas(todasCampanhas, dataHoje);

    if (campanhasAtivas.length === 0) {
        return criarRespostaVazia(horaAtual, minutoAtual, corsHeaders);
    }

    console.log(`🎯 ${campanhasAtivas.length} campanhas ativas`);

    // 2. Buscar emissoras programadas (TODAS as campanhas, não só 15)
    const emissorasProgramadas = await buscarEmissorasProgramadas(campanhasAtivas);

    // 3. Buscar inserções ATUALIZADAS (sem tempo simulado)
    const { insercoesRecentes, todasInsercoes } = await buscarInsercoes(
        campanhasAtivas,
        dataHoje,
        horaNum,
        minutoNum
    );

    console.log(`📻 ${insercoesRecentes.length} inserções recentes até ${horaAtual}:${minutoAtual}`);

    // Mostrar as 5 mais recentes para debug
    if (insercoesRecentes.length > 0) {
        console.log(`🕐 5 INSERÇÕES MAIS RECENTES:`);
        insercoesRecentes.slice(0, 5).forEach((ins, i) => {
            console.log(`   ${i+1}. ${ins.hour} - ${ins.stationName} - ${ins.city}`);
        });
    }

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
        emissorasProgramadas,
        horaAtual,
        minutoAtual
    );

    // 6. Preparar resposta
    const resultado = {
        success: true,
        timestamp: new Date().toISOString(),
        fromCache: false,
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
            ultimaHoraEncontrada: insercoesRecentes[0]?.hour || 'Nenhuma'
        }
    };

    // 7. Salvar cache ATUALIZADO
    if (env.DASHBOARD_KV) {
        try {
            // Salvar inserções e coordenadas para o endpoint /recentes
            await env.DASHBOARD_KV.put(
                `insercoes-${dataHoje}`,
                JSON.stringify({ insercoesRecentes, coordenadas, timestamp: Date.now() }),
                { expirationTtl: 86400 }
            );

            console.log(`💾 Cache ATUALIZADO salvo`);
        } catch (error) {
            console.log(`⚠️ Erro ao salvar cache: ${error.message}`);
        }
    }

    return new Response(JSON.stringify(resultado, null, 2), {
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Cache-Status": "MISS-FORCED",
            "Cache-Control": "no-cache"
        }
    });
}

// ===== ENDPOINT: Inserções Recentes (para animações) =====
async function handleInsercoesRecentes(env, corsHeaders) {
    console.log("🔥 GET /api/insercoes/recentes");

    // Usar horário REAL de Brasília
    const agora = new Date();
    const offsetBrasilia = -3 * 60;
    const agoraBrasilia = new Date(agora.getTime() + offsetBrasilia * 60 * 1000);
    const dataHoje = agoraBrasilia.toISOString().split('T')[0];

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

        // Calcular quais inserções devem estar animando AGORA (usando tempo REAL)
        const animacoes = calcularAnimacoesAtivas(
            insercoesRecentes,
            coordenadas,
            agoraBrasilia
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
    console.log(`🎯 Buscando emissoras programadas para ${campanhasAtivas.length} campanhas...`);

    const emissorasMap = new Map();
    let campanhasProcessadas = 0;

    // Processar TODAS as campanhas ativas (não limitar a 15)
    for (const campanha of campanhasAtivas) {
        try {
            const url = `https://api.audiency.io/advertiser-rest/campaigns/${campanha.id}/programmed-station-filter`;

            const response = await fetch(url, {
                headers: { "accept": "application/json", "apiKey": API_KEY }
            });

            if (response.ok) {
                const data = await response.json();
                // CORREÇÃO: A API retorna { "data": [array] } diretamente
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
                        name: campanha.name,
                        client: campanha.client?.name || ''
                    });
                    emissoraData.totalCampanhas++;
                });

                campanhasProcessadas++;
            }

            await new Promise(resolve => setTimeout(resolve, 150));

        } catch (error) {
            console.log(`❌ Erro campanha ${campanha.id}: ${error.message}`);
        }
    }

    const emissorasProgramadas = Array.from(emissorasMap.values());
    console.log(`📻 ${campanhasProcessadas}/${campanhasAtivas.length} campanhas processadas`);
    console.log(`🔄 ${emissorasProgramadas.length} emissoras únicas programadas`);

    return emissorasProgramadas;
}

async function buscarInsercoes(campanhas, dataHoje, horaAtual, minutoAtual) {
    console.log(`🔍 Buscando inserções ATUALIZADAS até ${horaAtual}:${minutoAtual}...`);

    const todasInsercoes = [];
    const insercoesRecentes = [];

    const horaAtualNum = parseInt(horaAtual);
    const minutoAtualNum = parseInt(minutoAtual);

    console.log(`🕐 Filtrando inserções até ${horaAtualNum}:${minutoAtualNum}`);

    // Processar em batches (3 por vez para evitar timeout)
    const batches = [];
    const batchSize = 3;

    for (let i = 0; i < campanhas.length; i += batchSize) {
        batches.push(campanhas.slice(i, i + batchSize));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        for (const campanha of batch) {
            try {
                const url = `https://api.audiency.io/advertiser-rest/reports/common/advertiser-execution?page=1&limit=500&countryId=1&campaignId=${campanha.id}&stationDate=${dataHoje}&stationDate=${dataHoje}`;

                const response = await fetch(url, {
                    headers: { "accept": "application/json", "apiKey": API_KEY }
                });

                if (response.ok) {
                    const data = await response.json();
                    const items = data?.data?.lines || [];

                    let recentesCount = 0;

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

                        // FILTRO ATUALIZADO: Inserções até o minuto atual
                        const isRecente = (
                            (horaItem === horaAtualNum && minutoItem <= minutoAtualNum) ||
                            (horaItem < horaAtualNum)
                        );

                        if (isRecente) {
                            insercoesRecentes.push(insercao);
                            recentesCount++;
                        }
                    });

                    if (items.length > 0) {
                        console.log(`   📊 ${campanha.name}: ${items.length} total, ${recentesCount} recentes`);
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.log(`❌ Erro campanha ${campanha.id}: ${error.message}`);
            }
        }

        if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    // Ordenar por mais recente
    insercoesRecentes.sort((a, b) => {
        const timeA = new Date(`${dataHoje} ${a.hour}`);
        const timeB = new Date(`${dataHoje} ${b.hour}`);
        return timeB - timeA;
    });

    todasInsercoes.sort((a, b) => {
        const timeA = new Date(`${dataHoje} ${a.hour}`);
        const timeB = new Date(`${dataHoje} ${b.hour}`);
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

function calcularMetricas(insercoes, campanhasAtivas, emissorasProgramadas, horaAtual, minutoAtual) {
    console.log(`📊 Calculando métricas...`);

    const cidadesAtivas = new Set(insercoes.map(i => i.city).filter(Boolean)).size;

    // Top emissoras por campanhas
    const topEmissoras = emissorasProgramadas
        .sort((a, b) => b.totalCampanhas - a.totalCampanhas)
        .slice(0, 10)
        .map(e => ({
            emissora: e.name,
            campanhas: e.totalCampanhas
        }));

    // Top cidades por emissoras (praças)
    const pracasMap = new Map();

    emissorasProgramadas.forEach(emissora => {
        // Extrair cidade da string do nome da emissora
        // Formato: "Nome da Rádio (Frequência) - UF | Cidade"
        const cidadeMatch = emissora.name.match(/-\s*([A-Z]{2})\s*\|\s*(.+)$/);

        if (cidadeMatch) {
            const uf = cidadeMatch[1];
            const cidade = cidadeMatch[2].trim();
            const pracaKey = `${cidade}-${uf}`;

            if (!pracasMap.has(pracaKey)) {
                pracasMap.set(pracaKey, {
                    cidade: cidade,
                    uf: uf,
                    emissoras: 0,
                    totalCampanhas: 0
                });
            }

            const pracaData = pracasMap.get(pracaKey);
            pracaData.emissoras++;
            pracaData.totalCampanhas += emissora.totalCampanhas;
        }
    });

    const topCidades = Array.from(pracasMap.values())
        .sort((a, b) => b.emissoras - a.emissoras)
        .slice(0, 10)
        .map(praca => ({
            cidade: `${praca.cidade}/${praca.uf}`,
            emissoras: praca.emissoras
        }));

    console.log(`✅ Métricas: ${campanhasAtivas.length} campanhas, ${emissorasProgramadas.length} emissoras, ${cidadesAtivas} cidades`);
    console.log(`📍 Top praças: ${topCidades.length} praças encontradas`);

    return {
        campanhasAtivas: campanhasAtivas.length,
        emissorasAtivas: emissorasProgramadas.length,
        insercoesHoje: insercoes.length,
        cidadesAtivas: cidadesAtivas,
        topEmissoras: topEmissoras,
        topCidades: topCidades,
        ultimaAtualizacao: `${horaAtual}:${minutoAtual}`
    };
}

function calcularAnimacoesAtivas(insercoesRecentes, coordenadas, tempoAtual) {
    const animacoes = [];
    const coordenadasMap = new Map(coordenadas.map(c => [c.cidade, c]));

    insercoesRecentes.forEach(insercao => {
        if (!insercao.city || !insercao.hour) return;

        const coords = coordenadasMap.get(insercao.city);
        if (!coords) return;

        // LÓGICA: Animação dura 30s após o horário da inserção
        // Se agora são 10:35:15 e inserção foi às 10:35:00, deve animar (passou 15s)
        // Se agora são 10:35:45 e inserção foi às 10:35:00, deve animar (passou 45s, mas ainda dentro dos 30s após 10:35:59)

        const [horaInsercao, minutoInsercao, segundoInsercao = 0] = insercao.hour.split(':').map(Number);

        // Criar momento da inserção no mesmo dia do tempo atual
        const momentoInsercao = new Date(tempoAtual);
        momentoInsercao.setHours(horaInsercao, minutoInsercao, segundoInsercao, 0);

        // Fim da animação: 30s após a inserção
        const fimAnimacao = new Date(momentoInsercao.getTime() + DURACAO_ANIMACAO_SEGUNDOS * 1000);

        // Verificar se a inserção deve estar animando no tempo atual
        // Anima se: tempo atual >= hora da inserção E tempo atual <= hora + 30s
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
