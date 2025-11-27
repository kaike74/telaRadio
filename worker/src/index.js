/**
 * Dashboard Institucional - Monitoramento de Rádio
 * Cloudflare Worker com endpoints otimizados para TV
 */

const API_KEY = "9620cf74-856d-40c2-a091-248e4f322caa";
const GEONAMES_USERNAME = "kaike";
const DELAY_HORAS = 2; // Delay da API original
const DURACAO_ANIMACAO_SEGUNDOS = 30; // Duração da animação no mapa
const CACHE_TTL = 120; // 2 minutos

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
            } else if (url.pathname === "/api/dashboard/incremental") {
                return await handleDashboardIncremental(env, corsHeaders);
            } else if (url.pathname === "/api/insercoes/recentes") {
                return await handleInsercoesRecentes(env, corsHeaders);
            } else {
                return new Response(JSON.stringify({
                    error: "Endpoint não encontrado",
                    endpoints: ["/api/dashboard", "/api/dashboard/incremental", "/api/insercoes/recentes"]
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

    const agora = new Date();
    const offsetBrasilia = -3 * 60;
    const agoraBrasilia = new Date(agora.getTime() + offsetBrasilia * 60 * 1000);

    const dataHoje = agoraBrasilia.toISOString().split('T')[0];
    const horaAtual = String(agoraBrasilia.getHours()).padStart(2, '0');
    const minutoAtual = String(agoraBrasilia.getMinutes()).padStart(2, '0');

    const CACHE_KEY_DASHBOARD = `dashboard-completo-${dataHoje}`;
    const CACHE_KEY_ULTIMA_ATUALIZACAO = `ultima-atualizacao-${dataHoje}`;

    console.log(`⏰ Horário Brasília: ${dataHoje} ${horaAtual}:${minutoAtual}`);

    // Verificar se precisa atualizar (cache de 2 minutos)
    let precisaAtualizar = true;

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

                if (minutosDesdeAtualizacao < 2) {
                    precisaAtualizar = false;
                    console.log(`✅ Cache válido (${minutosDesdeAtualizacao} min)`);
                }
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
                console.log(`💾 Retornando do cache`);

                return new Response(JSON.stringify({
                    ...dados,
                    fromCache: true,
                    timestamp: new Date().toISOString()
                }), {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                        "X-Cache-Status": "HIT"
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

    // 3. Buscar inserções
    const { insercoesRecentes, todasInsercoes } = await buscarInsercoes(
        campanhasAtivas,
        dataHoje,
        horaAtual,
        minutoAtual
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
        todasInsercoes, // Passar todas para filtrar por delay dentro da função
        campanhasAtivas,
        emissorasProgramadas,
        agoraBrasilia // Passar hora atual para cálculo do delay
    );

    // Filtrar inserções recentes para a lista (respeitando delay)
    const insercoesLista = filtrarInsercoesDelay(todasInsercoes, agoraBrasilia);

    // 6. Preparar resposta
    const resultado = {
        success: true,
        timestamp: new Date().toISOString(),
        fromCache: false,
        metricas: metricas,
        coordenadas: coordenadas,
        insercoesRecentes: insercoesLista.slice(0, 20), // Top 20 para a lista lateral
        debug: {
            totalCampanhas: todasCampanhas.length,
            campanhasAtivas: campanhasAtivas.length,
            emissorasProgramadas: emissorasProgramadas.length,
            totalInsercoes: todasInsercoes.length,
            insercoesLista: insercoesLista.length,
            horaProcessamento: `${horaAtual}:${minutoAtual}`
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
            "X-Cache-Status": "MISS"
        }
    });
}

// ===== ENDPOINT: Dashboard Incremental =====
async function handleDashboardIncremental(env, corsHeaders) {
    console.log("🔄 GET /api/dashboard/incremental");
    const agora = new Date();
    const offsetBrasilia = -3 * 60;
    const agoraBrasilia = new Date(agora.getTime() + offsetBrasilia * 60 * 1000);
    const dataHoje = agoraBrasilia.toISOString().split('T')[0];
    const CACHE_KEY_DASHBOARD = `dashboard-completo-${dataHoje}`;

    if (!env.DASHBOARD_KV) {
        return new Response(JSON.stringify({ error: "KV não configurado" }), { headers: corsHeaders });
    }

    try {
        // Tentar pegar do cache primeiro
        const cacheCompleto = await env.DASHBOARD_KV.get(CACHE_KEY_DASHBOARD);
        if (cacheCompleto) {
            const dados = JSON.parse(cacheCompleto);
            // Aqui poderíamos buscar apenas delta, mas por enquanto retornamos o cache
            // A lógica de atualização real aconteceria em background ou via trigger
            return new Response(JSON.stringify({
                ...dados,
                fromCache: true,
                tipo: "incremental"
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Se não tiver cache, faz full load
        return handleDashboard(env, corsHeaders);
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
}

// ===== ENDPOINT: Inserções Recentes (para animações) =====
async function handleInsercoesRecentes(env, corsHeaders) {
    console.log("🔥 GET /api/insercoes/recentes");

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

        // Calcular quais inserções devem estar animando AGORA
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

function filtrarInsercoesDelay(insercoes, agoraBrasilia) {
    // Retorna inserções que aconteceram até (agora - delay)
    // Mas que não sejam muito antigas (ex: janela de 1 hora antes do delay)
    const momentoDelay = new Date(agoraBrasilia.getTime() - DELAY_HORAS * 60 * 60 * 1000);
    const janelaInicio = new Date(momentoDelay.getTime() - 60 * 60 * 1000); // 1 hora de janela

    return insercoes.filter(i => {
        const dataInsercao = new Date(`${i.date} ${i.hour}`);
        return dataInsercao <= momentoDelay && dataInsercao >= janelaInicio;
    }).sort((a, b) => {
        // Ordenar decrescente (mais recentes primeiro)
        return new Date(`${b.date} ${b.hour}`) - new Date(`${a.date} ${a.hour}`);
    });
}

function calcularMetricas(insercoes, campanhasAtivas, emissorasProgramadas, agoraBrasilia) {
    // Filtrar inserções considerando o delay para a métrica "Hoje"
    // "Hoje" no dashboard significa "Até o momento do delay"
    const momentoDelay = new Date(agoraBrasilia.getTime() - DELAY_HORAS * 60 * 60 * 1000);
    const insercoesValidas = insercoes.filter(i => {
        const dataInsercao = new Date(`${i.date} ${i.hour}`);
        return dataInsercao <= momentoDelay;
    });

    const cidadesAtivas = new Set(insercoesValidas.map(i => i.city).filter(Boolean)).size;

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

    // Hora de atualização exibida deve ser a hora do delay (o "agora" do dashboard)
    const horaExibicao = momentoDelay;

    return {
        campanhasAtivas: campanhasAtivas.length,
        emissorasAtivas: emissorasProgramadas.length,
        insercoesHoje: insercoesValidas.length,
        cidadesAtivas: cidadesAtivas,
        topEmissoras: topEmissoras,
        topCidades: topCidades,
        ultimaAtualizacao: horaExibicao.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        })
    };
}

function calcularAnimacoesAtivas(insercoesRecentes, coordenadas, agoraBrasilia) {
    const animacoes = [];
    const coordenadasMap = new Map(coordenadas.map(c => [c.cidade, c]));

    insercoesRecentes.forEach(insercao => {
        if (!insercao.city || !insercao.hour) return;

        const coords = coordenadasMap.get(insercao.city);
        if (!coords) return;

        // Calcular quando a inserção rodou (com delay de 2h)
        const [horaInsercao, minutoInsercao, segundoInsercao = 0] = insercao.hour.split(':').map(Number);

        const momentoInsercao = new Date(agoraBrasilia);
        momentoInsercao.setHours(horaInsercao, minutoInsercao, segundoInsercao, 0);

        // Adicionar delay de 2h
        const momentoComDelay = new Date(momentoInsercao.getTime() + DELAY_HORAS * 60 * 60 * 1000);

        // Calcular fim da animação (30s depois)
        const fimAnimacao = new Date(momentoComDelay.getTime() + DURACAO_ANIMACAO_SEGUNDOS * 1000);

        // Verificar se está no período de animação
        if (agoraBrasilia >= momentoComDelay && agoraBrasilia <= fimAnimacao) {
            animacoes.push({
                id: `${insercao.city}-${insercao.hour}-${insercao.stationName}`,
                lat: coords.lat,
                lng: coords.lng,
                startTime: momentoComDelay.toISOString(),
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
