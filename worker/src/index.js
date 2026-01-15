/**
 * Dashboard Institucional - Monitoramento de Rádio
 * Cloudflare Worker com CACHE INTELIGENTE
 * 
 * 🎯 ESTRATÉGIA DE ATUALIZAÇÃO:
 * 
 * DADOS DINÂMICOS (Atualizam a cada 5 segundos):
 * - Inserções (Últimas inserções captadas pela API)
 * - Pingas/Coordenadas (Localização dos spots no mapa)
 * - Inserções Hoje (Contador de inserções do dia)
 * - Ticker "Hoje no Radar" (Espelho das últimas inserções)
 * 
 * DADOS ESTÁTICOS (Cache de 24h - Atualizam 1x por dia):
 * - Campanhas Ativas (Mudança apenas com novas campanhas)
 * - Rádios/Emissoras Ativos (Mudança apenas com novos cadastros)
 * - Top Emissoras por Campanhas (Depende de mudanças em campanhas)
 * - Top Cidades por Emissoras (Depende de mudanças em campanhas)
 * 
 * 💡 BENEFÍCIO: Reduz chamadas para /programmed-station-filter de 50+/min para 1/dia
 *    Mantém todos os dados de dados em tempo real
 *    Métricas atualizam 1x por dia (suficiente para estatísticas)
 */

const API_KEY = "9620cf74-856d-40c2-a091-248e4f322caa";
const GEONAMES_USERNAME = "kaike";
const DURACAO_ANIMACAO_SEGUNDOS = 30; // Duração da animação no mapa (30 segundos)

// 📋 ARMAZENAR LOGS DE INSERÇÕES
let logsInsercoesGlobal = [];

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
            if (url.pathname === "/api/health") {
                return new Response(JSON.stringify({
                    status: "ok",
                    timestamp: new Date().toISOString()
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            } else if (url.pathname === "/api/dashboard") {
                return await handleDashboard(env, corsHeaders);
            } else if (url.pathname === "/api/insercoes/recentes") {
                return await handleInsercoesRecentes(env, corsHeaders);
            } else if (url.pathname === "/api/coordenada") {
                return await handleCoordenada(env, corsHeaders, url);
            } else if (url.pathname === "/api/logs/insercoes") {
                return await handleLogsInsercoes(env, corsHeaders);
            } else {
                return new Response(JSON.stringify({
                    error: "Endpoint não encontrado",
                    endpoints: ["/api/health", "/api/dashboard", "/api/insercoes/recentes", "/api/coordenada", "/api/logs/insercoes"]
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
    try {
        console.log("📊 GET /api/dashboard - SISTEMA DE CACHE INTELIGENTE");

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

        // 🔄 SISTEMA DE CACHE INTELIGENTE
        // SEMPRE buscar: Inserções (5 em 5 segundos)
        // Cache por 24h: Campanhas, Emissoras Programadas, Top Emissoras, Top Cidades
        
        let todasCampanhas, campanhasAtivas, emissorasProgramadas;
        let cacheStatus = "FRESH";

    // 1️⃣ CARREGAR DADOS ESTÁTICOS (24h de cache)
    if (env.DASHBOARD_KV) {
        try {
            const cacheDadosEstaticos = await env.DASHBOARD_KV.get(`dados-estaticos-${dataHoje}`);
            
            if (cacheDadosEstaticos) {
                // ✅ Cache válido - usar dados em memória
                const parsed = JSON.parse(cacheDadosEstaticos);
                todasCampanhas = parsed.todasCampanhas;
                campanhasAtivas = parsed.campanhasAtivas;
                emissorasProgramadas = parsed.emissorasProgramadas;
                cacheStatus = "FROM_24H_CACHE";
                console.log(`✅ Dados estáticos carregados do CACHE DE 24H`);
            } else {
                // ❌ Cache expirado ou não existe - buscar dados frescos
                console.log(`⏳ Cache de 24h expirado ou não existe - BUSCANDO DADOS FRESCOS...`);
                todasCampanhas = await buscarTodasCampanhas();
                campanhasAtivas = filtrarCampanhasAtivas(todasCampanhas, dataHoje);
                emissorasProgramadas = await buscarEmissorasProgramadas(campanhasAtivas, env.DASHBOARD_KV);
                
                // Salvar no cache
                await env.DASHBOARD_KV.put(
                    `dados-estaticos-${dataHoje}`,
                    JSON.stringify({
                        todasCampanhas,
                        campanhasAtivas,
                        emissorasProgramadas,
                        salvoEm: new Date().toISOString()
                    }),
                    { expirationTtl: 86400 } // 24 horas
                );
                console.log(`💾 Dados estáticos SALVOS no cache de 24h`);
                cacheStatus = "FRESH_FETCH";
            }
        } catch (cacheError) {
            console.warn(`⚠️ Erro ao acessar cache: ${cacheError.message} - usando dados frescos`);
            todasCampanhas = await buscarTodasCampanhas();
            campanhasAtivas = filtrarCampanhasAtivas(todasCampanhas, dataHoje);
            emissorasProgramadas = await buscarEmissorasProgramadas(campanhasAtivas, env.DASHBOARD_KV);
            cacheStatus = "ERROR_FALLBACK";
        }
    } else {
        // KV não configurado - usar dados frescos
        console.log(`⚠️ KV não configurado - usando dados frescos sem cache`);
        todasCampanhas = await buscarTodasCampanhas();
        campanhasAtivas = filtrarCampanhasAtivas(todasCampanhas, dataHoje);
        emissorasProgramadas = await buscarEmissorasProgramadas(campanhasAtivas, null);
        cacheStatus = "NO_KV";
    }

    if (campanhasAtivas.length === 0) {
        return criarRespostaVazia(horaAtual, minutoAtual, corsHeaders);
    }

    console.log(`🎯 ${campanhasAtivas.length} campanhas ativas`);
    console.log(`📻 ${emissorasProgramadas.length} emissoras programadas`);

    // 2️⃣ BUSCAR INSERÇÕES (SEMPRE FRESCO - 5 em 5 segundos)
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

    // 3️⃣ PROCESSAR COORDENADAS (SEMPRE FRESCO - depende das inserções)
    const coordenadas = await processarCoordenadas(
        insercoesRecentes,
        env.DASHBOARD_KV,
        dataHoje
    );

    // 4️⃣ CALCULAR MÉTRICAS (usa cache de 24h para Top Emissoras/Cidades)
    const metricas = calcularMetricas(
        insercoesRecentes,
        campanhasAtivas,
        emissorasProgramadas,
        horaAtual,
        minutoAtual
    );

    // 5️⃣ PREPARAR RESPOSTA
    const resultado = {
        success: true,
        timestamp: new Date().toISOString(),
        fromCache: cacheStatus !== "FRESH_FETCH" && cacheStatus !== "NO_KV",
        cacheStatus: cacheStatus,
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
            ultimaHoraEncontrada: insercoesRecentes[0]?.hour || 'Nenhuma',
            cacheStrategy: "Estatísticos (campanhas, emissoras, top) = 24h | Dinâmicos (inserções, pingas) = 5s"
        }
    };

    // 7. Salvar cache ATUALIZADO (incluindo métricas para consistência)
    if (env.DASHBOARD_KV) {
        try {
            // Salvar inserções, coordenadas e MÉTRICAS para o endpoint /recentes
            // Isso garante que o endpoint /insercoes/recentes retorna dados consistentes
            await env.DASHBOARD_KV.put(
                `dashboard-completo-${dataHoje}`,
                JSON.stringify({
                    insercoesRecentes,
                    todasInsercoes,  // ⭐ NOVO: Incluir para frontend calcular milestones
                    coordenadas,
                    metricas,
                    timestamp: Date.now(),
                    horaAtual,
                    minutoAtual
                }),
                { expirationTtl: 86400 }
            );

            console.log(`💾 Cache COMPLETO salvo (incluindo métricas e todasInsercoes)`);
        } catch (error) {
            console.log(`⚠️ Erro ao salvar cache: ${error.message}`);
        }
    }

    return new Response(JSON.stringify(resultado, null, 2), {
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Cache-Status": "FRESH",
            "Cache-Control": "no-cache, no-store, must-revalidate"
        }
    });
    } catch (error) {
        console.error(`❌ ERRO CRÍTICO em handleDashboard: ${error.message}`);
        console.error(`Stack: ${error.stack}`);
        
        return new Response(JSON.stringify({
            success: false,
            erro: error.message,
            detalhes: `Erro ao processar dashboard: ${error.message}`,
            stack: error.stack.substring(0, 500)
        }, null, 2), {
            status: 500,
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json"
            }
        });
    }
}

// ===== ENDPOINT: Inserções Recentes (para animações) =====
async function handleInsercoesRecentes(env, corsHeaders) {
    console.log("🔥 GET /api/insercoes/recentes");

    // Usar horário REAL de Brasília
    const agora = new Date();
    const offsetBrasilia = -3 * 60;
    const agoraBrasilia = new Date(agora.getTime() + offsetBrasilia * 60 * 1000);
    const dataHoje = agoraBrasilia.toISOString().split('T')[0];
    const horaAtual = String(agoraBrasilia.getHours()).padStart(2, '0');
    const minutoAtual = String(agoraBrasilia.getMinutes()).padStart(2, '0');
    
    // 🔍 DEBUG: Mostrar o tempo que estamos usando
    const horaFormatada = horaAtual + ':' + minutoAtual + ':' + String(agoraBrasilia.getSeconds()).padStart(2, '0');
    console.log(`🕐 TEMPO BRASÍLIA: ${dataHoje} ${horaFormatada}`);

    try {
        // ⭐ ESTRATÉGIA: Usar cache com TTL curto (30 segundos)
        // Se o cache é válido, retorna imediatamente
        // Enquanto isso, busca novos dados em background
        const cacheKey = `insercoes-recentes-${dataHoje}`;
        const cacheTTL = 30; // segundos
        
        // Tentar ler do cache
        let cachedData = null;
        try {
            const cached = await env.CACHE.get(cacheKey);
            if (cached) {
                cachedData = JSON.parse(cached);
                const cacheAge = (Date.now() - cachedData.cacheTime) / 1000;
                if (cacheAge < cacheTTL) {
                    console.log(`📦 Retornando dados do CACHE (${cacheAge.toFixed(1)}s de idade)`);
                    return new Response(JSON.stringify(cachedData.data), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }
            }
        } catch (cacheErr) {
            console.log(`ℹ️ Cache não disponível: ${cacheErr.message}`);
        }
        
        console.log(`📡 Buscando dados FRESCOS da API Audiency...`);
        
        // Buscar campanhas
        const todasCampanhas = await buscarTodasCampanhas();
        const campanhasAtivas = filtrarCampanhasAtivas(todasCampanhas, dataHoje);
        
        console.log(`📊 ${todasCampanhas.length} campanhas totais, ${campanhasAtivas.length} ativas`);
        
        if (campanhasAtivas.length === 0) {
            console.warn(`⚠️ NENHUMA CAMPANHA ATIVA! Retornando array vazio`);
        }
        
        // Construir resposta
        const resultado_busca = await buscarInsercoes(campanhasAtivas, dataHoje, horaAtual, minutoAtual);
        let insercoesRecentes = resultado_busca.insercoesRecentes || [];
        let todasInsercoesBuscadas = resultado_busca.todasInsercoes || [];
        
        console.log(`🆕 ${insercoesRecentes.length} inserções FRESCAS obtidas da API`);
        console.log(`📊 Total de inserções ANTES do filtro: ${todasInsercoesBuscadas.length}`);
        console.log(`📊 Inserções APÓS filtro de 1 hora: ${insercoesRecentes.length}`);
        console.log(`📊 Inserções REJEITADAS: ${todasInsercoesBuscadas.length - insercoesRecentes.length}`);
        
        // Garantir que é array
        if (!Array.isArray(insercoesRecentes)) {
            insercoesRecentes = [];
        }
        
        console.log(`📦 Total de inserções para retornar: ${insercoesRecentes.length}`);
        
        // ⚠️ LOG CRÍTICO: Quando não há dados
        if (insercoesRecentes.length === 0) {
            console.error(`\n${'='.repeat(100)}`);
            console.error(`❌ NENHUMA INSERÇÃO ENCONTRADA NA BUSCA`);
            console.error(`${'='.repeat(100)}`);
            console.error(`Contexto:`);
            console.error(`  - Data: ${dataHoje}`);
            console.error(`  - Hora atual (Brasília): ${horaFormatada}`);
            console.error(`  - Campanhas ativas: ${campanhasAtivas.length}`);
            console.error(`  - Total campanhas: ${todasCampanhas.length}`);
            console.error(`  - Inserções encontradas (antes city filter): ${todasInsercoesBuscadas.length}`);
            console.error(`  - Inserções COM cidade (após filtro): ${insercoesRecentes.length}`);
            console.error(`\nPossíveis causas:`);
            if (campanhasAtivas.length === 0) {
                console.error(`  1. ❌ NENHUMA CAMPANHA ATIVA - Verifique datas de início/fim`);
            }
            if (todasCampanhas.length === 0) {
                console.error(`  2. ❌ NENHUMA CAMPANHA RETORNADA DA API - Verifique API Key e conectividade`);
            }
            if (todasInsercoesBuscadas.length === 0) {
                console.error(`  3. ❌ API Audiency sem dados para este horário/data`);
            }
            if (todasInsercoesBuscadas.length > 0 && insercoesRecentes.length === 0) {
                console.error(`  4. ❌ TODAS as ${todasInsercoesBuscadas.length} inserções estão SEM CIDADE preenchida`);
            }
            console.error(`${'='.repeat(100)}\n`);
        }
        
        // Construir resposta
        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            horaBrasilia: `${horaAtual}:${minutoAtual}`,
            insercoesRecentes: insercoesRecentes.slice(0, 100),
            debug: {
                totalInsercoes: insercoesRecentes.length,
                totalAntesFiltro: todasInsercoesBuscadas.length,
                origem: 'api-audiency-fresca',
                cached: false
            },
            cacheTime: Date.now()
        };
        
        if (insercoesRecentes.length > 0) {
            console.log(`\n📋 PRIMEIRAS 3 INSERÇÕES RETORNADAS:`);
            insercoesRecentes.slice(0, 3).forEach((ins, i) => {
                console.log(`   [${i+1}] ${ins.hour} - ${ins.stationName} (${ins.city})`);
            });
        }
        
        // 💾 Salvar no cache para próximas requisições
        try {
            await env.CACHE.put(cacheKey, JSON.stringify({ data: response, cacheTime: Date.now() }));
            console.log(`💾 Dados salvos em cache por 30 segundos`);
        } catch (cacheErr) {
            console.log(`⚠️ Não conseguiu salvar cache: ${cacheErr.message}`);
        }
        
        return new Response(JSON.stringify(response), {
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=30"
            }
        });

    } catch (error) {
        console.error(`❌ ERRO em handleInsercoesRecentes: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            insercoesRecentes: [],
            timestamp: new Date().toISOString()
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

async function buscarEmissorasProgramadas(campanhasAtivas, kvNamespace = null) {
    console.log(`🎯 Buscando emissoras programadas para ${campanhasAtivas.length} campanhas...`);

    // 🚀 OTIMIZAÇÃO: Cache por campanha individual
    // Evita refetch se a campanha já foi consultada (mudança apenas 1x/dia)
    const CACHE_KEY_PREFIX = 'emissoras-campanha-';
    const CACHE_TTL = 86400; // 24 horas
    
    const emissorasMap = new Map();
    let campanhasProcessadas = 0;
    let campanhasDoCache = 0;
    let campanhasNovas = 0;

    // Processar TODAS as campanhas ativas
    for (const campanha of campanhasAtivas) {
        try {
            let emissoras = null;
            const cacheKey = `${CACHE_KEY_PREFIX}${campanha.id}`;

            // 🔍 Tentar carregar do cache individual
            if (kvNamespace) {
                try {
                    const cachedData = await kvNamespace.get(cacheKey);
                    if (cachedData) {
                        emissoras = JSON.parse(cachedData);
                        campanhasDoCache++;
                        console.log(`   ✅ [CACHE] Campanha ${campanha.id} (${campanha.name})`);
                    }
                } catch (cacheError) {
                    // Se erro no cache, buscar fresco
                }
            }

            // 📡 Se não tem no cache, buscar da API
            if (!emissoras) {
                const url = `https://api.audiency.io/advertiser-rest/campaigns/${campanha.id}/programmed-station-filter`;
                const response = await fetch(url, {
                    headers: { "accept": "application/json", "apiKey": API_KEY }
                });

                if (response.ok) {
                    const data = await response.json();
                    emissoras = Array.isArray(data.data) ? data.data : [];
                    campanhasNovas++;

                    // 💾 Salvar no cache individual
                    if (kvNamespace) {
                        try {
                            await kvNamespace.put(
                                cacheKey,
                                JSON.stringify(emissoras),
                                { expirationTtl: CACHE_TTL }
                            );
                        } catch (saveError) {
                            console.warn(`⚠️ Erro ao cachear campanha ${campanha.id}: ${saveError.message}`);
                        }
                    }
                    console.log(`   📡 [API] Campanha ${campanha.id} (${campanha.name}) - ${emissoras.length} emissoras`);
                } else {
                    console.log(`   ❌ Campanha ${campanha.id} retornou ${response.status}`);
                    emissoras = [];
                }
                
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            // ✅ Adicionar emissoras ao mapa
            emissoras.forEach(emissora => {
                const emissoraKey = `${emissora.name}-${emissora.id}`;

                if (!emissorasMap.has(emissoraKey)) {
                    const { city, uf } = extrairCidadeDoNomeEmissora(emissora.name);
                    
                    emissorasMap.set(emissoraKey, {
                        id: emissora.id,
                        name: emissora.name,
                        pi: emissora.pi || '',
                        city: city,
                        uf: uf,
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

        } catch (error) {
            console.log(`❌ Erro campanha ${campanha.id}: ${error.message}`);
        }
    }

    const emissorasProgramadas = Array.from(emissorasMap.values());
    console.log(`📻 ${campanhasProcessadas}/${campanhasAtivas.length} campanhas processadas`);
    console.log(`   ✅ ${campanhasDoCache} do CACHE (1x/dia)`);
    console.log(`   📡 ${campanhasNovas} da API (primeira vez)`);
    console.log(`🔄 ${emissorasProgramadas.length} emissoras únicas programadas`);
    
    // Debug: mostrar emissoras com cidade
    const comCidade = emissorasProgramadas.filter(e => e.city).length;
    console.log(`📍 ${comCidade}/${emissorasProgramadas.length} emissoras têm localização`);
    
    // Mostrar amostra
    console.log(`   Amostra:`);
    emissorasProgramadas.slice(0, 5).forEach((e, i) => {
        console.log(`      [${i+1}] ${e.name} → ${e.city}/${e.uf}`);
    });

    return emissorasProgramadas;
}

// Função para extrair cidade do nome da emissora
// Formatos esperados:
// "Massa FM (97.7) - PR | Curitiba"
// "NDFM FM (100.7) - SC | Joinville"
// "Menina FM (97.5) - SC | Blumenau"
function extrairCidadeDoNomeEmissora(nomeCompleto) {
    try {
        // Verificar se tem o padrão "UF | Cidade"
        if (nomeCompleto.includes('|')) {
            const partes = nomeCompleto.split('|');
            if (partes.length >= 2) {
                const cidadeRaw = partes[partes.length - 1].trim();
                
                // Agora extrair o UF que vem antes do |
                const antesDoUltimoPipe = partes[partes.length - 2];
                const ufMatch = antesDoUltimoPipe.match(/([A-Z]{2})\s*$/);
                const uf = ufMatch ? ufMatch[1] : '';
                
                return {
                    city: cidadeRaw,
                    uf: uf
                };
            }
        }
        
        // Se não encontrou, retornar vazio
        return {
            city: '',
            uf: ''
        };
    } catch (error) {
        console.log(`⚠️ Erro extrair cidade de "${nomeCompleto}": ${error.message}`);
        return {
            city: '',
            uf: ''
        };
    }
}

async function buscarInsercoes(campanhas, dataHoje, horaAtual, minutoAtual) {
    /**
     * 🕐 DELAY DE 1 HORA - FILTRO IMPLEMENTADO
     * 
     * Por que? Dados da API Audiency chegam com ~1 hora de delay.
     * Exemplo:
     *   - Inserção rodou em: 17:18
     *   - Sistema recebeu em: 18:18
     *   - Mostramos para usuário como: 16:18 (criando ilusão de "ao vivo")
     * 
     * Como funciona?
     *   - Hora atual: 18:00
     *   - Filtro de delay aplicado: mostra dados até 16:00
     *   - Resultado: Usuário vê dados recentes graças ao filtro
     * 
     * Usado em:
     *   ✅ Últimas Inserções (lista exibida no dashboard)
     *   ✅ Inserções Hoje (métrica de contador)
     *   ✅ Animações/Pins (criados para essas inserções filtradas)
     *   ✅ Top Emissoras (baseado em inserções filtradas)
     *   ✅ Top Cidades (baseado em inserções filtradas)
     */
    console.log(`🔍 Buscando TODAS as inserções executadas no dia de ${dataHoje}...`);

    const todasInsercoes = [];
    const insercoesRecentes = [];
    const logInsercoesDetalhado = []; // 📋 LOG DETALHADO

    const horaAtualNum = parseInt(horaAtual);
    const minutoAtualNum = parseInt(minutoAtual);

    // ⭐ SEM FILTRO DE DELAY - Mostrar TODAS as inserções do dia
    // A API Audiency já retorna dados com ~1 hora de atraso
    // Não precisamos filtrar mais - só prejudica a exibição
    // Mostrar tudo e deixar o frontend/usuário decidir
    
    console.log(`⏰ Hora atual: ${horaAtualNum}:${minutoAtualNum}`);
    console.log(`📊 Estratégia: MOSTRAR TODAS as inserções do dia (sem filtro de delay)`);

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
                    
                    // 🔍 DEBUG: Registrar a ESTRUTURA exata do primeiro item
                    if (items.length > 0) {
                        console.log(`\n📦 ESTRUTURA DO PRIMEIRO ITEM DA CAMPANHA "${campanha.name}":`);
                        const firstItem = items[0];
                        console.log(`   Chaves disponíveis: ${Object.keys(firstItem).join(', ')}`);
                        console.log(`   item.city = ${JSON.stringify(firstItem.city)}`);
                        console.log(`   item.stationName = ${JSON.stringify(firstItem.stationName)}`);
                        console.log(`   item.hour = ${JSON.stringify(firstItem.hour)}`);
                        console.log(`   item.date = ${JSON.stringify(firstItem.date)}`);
                        console.log(`   Campos relacionados a cidade/local: ${Object.keys(firstItem).filter(k => k.toLowerCase().includes('city') || k.toLowerCase().includes('local') || k.toLowerCase().includes('state') || k.toLowerCase().includes('uf')).join(', ')}`);
                    }

                    items.forEach((item, itemIndex) => {
                        if (!item.hour) return;

                        // Parse horário: "08:56" ou "08:56:19"
                        const partesHora = item.hour.split(':');
                        const horaItem = parseInt(partesHora[0]);
                        const minutoItem = parseInt(partesHora[1]);
                        const segundoItem = partesHora.length > 2 ? parseInt(partesHora[2]) : 0;
                        
                        const cidade = item.city ? item.city.split(' / ')[0] : '';
                        const uf = item.city ? item.city.split(' / ')[1] : '';
                        
                        // 🔍 DEBUG: Mostrar itens que não têm cidade
                        if (!cidade && itemIndex < 3) {
                            console.log(`   ⚠️ Item ${itemIndex} SEM CIDADE: stationName="${item.stationName}", city="${item.city}"`);
                        }

                        const insercao = {
                            stationName: item.stationName || '',
                            client: item.client || campanha.client?.name || '',
                            hour: item.hour || '',
                            city: cidade,
                            uf: uf,
                            date: item.date || '',
                            campaign: campanha.name || '',
                            campaignId: campanha.id,
                            timestamp: `${item.date} ${String(horaItem).padStart(2, '0')}:${String(minutoItem).padStart(2, '0')}:${String(segundoItem).padStart(2, '0')}`,
                            horaNumerica: horaItem,
                            minutoNumerico: minutoItem,
                            segundoNumerico: segundoItem
                        };

                        // ✅ Adicionar TODAS as inserções do dia
                        todasInsercoes.push(insercao);

                        // 🚫 FILTRO DE CITY: Ignorar inserções sem localização
                        // Só mostramos inserções que têm cidade preenchida
                        if (!cidade || cidade.trim() === '') {
                            return; // Pular inserções sem cidade
                        }

                        // ⭐ SEM FILTRO DE DELAY - Adicionar TODAS as inserções com cidade
                        insercoesRecentes.push(insercao);
                        recentesCount++;

                        // 📋 REGISTRAR TUDO NO LOG DETALHADO
                        logInsercoesDetalhado.push({
                            horaReal: insercao.hour,
                            emissora: insercao.stationName,
                            proposta: insercao.campaign,
                            horaExibicao: insercao.hour
                        });
                    });

                    if (items.length > 0) {
                        console.log(`   📊 ${campanha.name}: ${items.length} total, ${recentesCount} recentes`);
                    } else {
                        console.log(`   ⚠️ ${campanha.name}: NENHUM ITEM RETORNADO DA API`);
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

    // 📋 EXIBIR LOG DETALHADO DE TODAS AS INSERÇÕES
    console.log(`\n${'='.repeat(120)}`);
    console.log(`📋 LOG DETALHADO DE TODAS AS INSERÇÕES RECEBIDAS`);
    console.log(`${'='.repeat(120)}`);
    
    if (logInsercoesDetalhado.length === 0) {
        console.log(`⚠️ Nenhuma inserção recebida!`);
    } else {
        // Agrupar por status
        const filtradas = logInsercoesDetalhado.filter(l => l.horaExibicao.includes('[FILTRADO]'));
        const exibidas = logInsercoesDetalhado.filter(l => !l.horaExibicao.includes('[FILTRADO]'));

        console.log(`\n✅ INSERÇÕES PARA EXIBIÇÃO (${exibidas.length}):`);
        if (exibidas.length > 0) {
            exibidas.forEach((log, idx) => {
                console.log(`   ${(idx + 1).toString().padStart(3)} | ${log.horaReal.padEnd(8)} | ${log.emissora.padEnd(40)} | ${log.proposta.padEnd(30)}`);
            });
        }

        if (filtradas.length > 0) {
            console.log(`\n🚫 INSERÇÕES FILTRADAS (${filtradas.length}):`);
            filtradas.forEach((log, idx) => {
                console.log(`   ${(idx + 1).toString().padStart(3)} | ${log.horaReal.padEnd(8)} | ${log.emissora.padEnd(40)} | ${log.proposta.padEnd(30)}`);
            });
        }
    }
    
    console.log(`${'='.repeat(120)}\n`);

    // 📋 GUARDAR LOGS GLOBALMENTE PARA ACESSO VIA API
    const filtradas = logInsercoesDetalhado.filter(l => l.horaExibicao.includes('[FILTRADO]'));
    const exibidas = logInsercoesDetalhado.filter(l => !l.horaExibicao.includes('[FILTRADO]'));
    
    logsInsercoesGlobal = {
        timestamp: new Date().toISOString(),
        horaBrasilia: `${horaAtual}:${minutoAtual}`,
        dataHoje: dataHoje,
        total: logInsercoesDetalhado.length,
        exibidas: exibidas,
        filtradas: filtradas,
        todos: logInsercoesDetalhado.slice(-500) // 🔒 LIMITAR A 500 ÚLTIMOS LOGS
    };
    
    console.log(`✨ Logs salvos globalmente - ${exibidas.length} exibidas, ${filtradas.length} filtradas (${logInsercoesDetalhado.length} total)`);

    // ⚠️ LOG CRÍTICO: Se não há dados nenhum
    if (todasInsercoes.length === 0) {
        console.error(`\n${'='.repeat(120)}`);
        console.error(`❌ CRÍTICO: NENHUMA INSERÇÃO ENCONTRADA EM NENHUMA CAMPANHA`);
        console.error(`${'='.repeat(120)}`);
        console.error(`Análise:`);
        console.error(`  - Campanhas processadas: ${campanhas.length}`);
        console.error(`  - Total de insertions obtidas da API: 0`);
        console.error(`  - Inserções com cidade: 0`);
        console.error(`  - Inserções dentro do filtro de 1h: 0`);
        console.error(`\nPossíveis causas:`);
        console.error(`  1. API Audiency está retornando VAZIO`);
        console.error(`  2. Nenhuma campanha tem inserções para hoje`);
        console.error(`  3. Todas as inserções estão fora do horário (> 1h de atraso)`);
        console.error(`${'='.repeat(120)}\n`);
    } else if (insercoesRecentes.length === 0 && todasInsercoes.length > 0) {
        console.warn(`\n${'='.repeat(120)}`);
        console.warn(`⚠️ AVISO: Inserções encontradas mas NENHUMA dentro do filtro de 1 hora`);
        console.warn(`${'='.repeat(120)}`);
        console.warn(`Análise:`);
        console.warn(`  - Total de inserções no dia: ${todasInsercoes.length}`);
        console.warn(`  - Inserções com cidade: ${todasInsercoes.filter(i => i.city).length}`);
        console.warn(`  - Inserções dentro do filtro: 0`);
        console.warn(`\nTodas as ${todasInsercoes.length} inserções estão FILTRADAS (> 1 hora atrás)`);
        console.warn(`Motivo: Filtro de 1 hora aplica-se a dados já atrasados pela API`);
        console.warn(`${'='.repeat(120)}\n`);
    }

    // Ordenar por mais recente (usar TIMESTAMP completo, não apenas hora)
    insercoesRecentes.sort((a, b) => {
        const timeA = new Date(`${a.timestamp.replace(' ', 'T')}`);
        const timeB = new Date(`${b.timestamp.replace(' ', 'T')}`);
        return timeB - timeA;
    });

    todasInsercoes.sort((a, b) => {
        const timeA = new Date(`${a.timestamp.replace(' ', 'T')}`);
        const timeB = new Date(`${b.timestamp.replace(' ', 'T')}`);
        return timeB - timeA;
    });

    // 🔍 DEBUG: Listar TODAS as cidades que temos nas inserções
    const cidadesUnicasRecentes = [...new Set(insercoesRecentes
        .filter(i => i.city)
        .map(i => `${i.city}/${i.uf}`)
    )].sort();
    
    console.log(`\n🌍 CIDADES NAS INSERÇÕES RECENTES (${cidadesUnicasRecentes.length} total):`);
    if (cidadesUnicasRecentes.length > 0) {
        console.log(`   ${cidadesUnicasRecentes.join(' | ')}`);
        
        // Verificar se Joinville está lá
        if (cidadesUnicasRecentes.some(c => c.includes('Joinville'))) {
            console.log(`   ✅ JOINVILLE ENCONTRADO!`);
        } else {
            console.log(`   ⚠️ JOINVILLE NÃO ESTÁ NAS INSERÇÕES RECENTES`);
        }
    } else {
        console.log(`   ⚠️ Nenhuma cidade com dados!`);
    }
    
    // 🔍 DEBUG: Estatísticas detalhadas sobre as inserções
    console.log(`\n📊 ANÁLISE DETALHADA DAS INSERÇÕES:`);
    console.log(`   Total de inserções executadas (histórico): ${todasInsercoes.length}`);
    console.log(`   Inserções com CITY preenchido: ${todasInsercoes.filter(i => i.city).length}`);
    console.log(`   Inserções SEM city preenchido: ${todasInsercoes.filter(i => !i.city).length}`);
    console.log(`   Inserções recentes para exibição no mapa: ${insercoesRecentes.length}`);

    console.log(`   Inserções com city (para exibir): ${insercoesRecentes.filter(i => i.city).length}`);
    console.log(`   Cidades únicas encontradas: ${cidadesUnicasRecentes.length}`);

    return { insercoesRecentes, todasInsercoes };
}

async function processarCoordenadas(insercoes, kvNamespace, dataHoje) {
    const cidadesUnicas = [...new Set(insercoes.map(i => i.city).filter(Boolean))];

    if (cidadesUnicas.length === 0) {
        console.log(`⚠️ Nenhuma cidade para processar coordenadas`);
        return [];
    }

    console.log(`🗺️ Processando coordenadas para ${cidadesUnicas.length} cidades...`);

    const CACHE_KEY_COORDENADAS = `coordenadas-${dataHoje}`;
    let coordenadasCache = {};

    if (kvNamespace) {
        try {
            const cache = await kvNamespace.get(CACHE_KEY_COORDENADAS);
            if (cache) {
                coordenadasCache = JSON.parse(cache);
                console.log(`   📦 ${Object.keys(coordenadasCache).length} coordenadas carregadas do cache`);
            }
        } catch (error) {
            console.log(`⚠️ Erro coordenadas cache: ${error.message}`);
        }
    }

    const coordenadasMap = new Map();
    const cidadesNovas = cidadesUnicas.filter(cidade => !coordenadasCache[cidade]);

    console.log(`   🆕 ${cidadesNovas.length} cidades novas para buscar`);
    console.log(`   ✅ ${cidadesUnicas.length - cidadesNovas.length} cidades em cache`);

    // Buscar cidades novas (aumentado de 2 para 10)
    let buscadas = 0;
    for (const cidade of cidadesNovas.slice(0, 10)) {
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
                    buscadas++;
                    console.log(`      ✅ ${cidade}: (${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)})`);
                } else {
                    console.log(`      ❌ Cidade não encontrada: ${cidade}`);
                }
            }

            await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error) {
            console.log(`❌ Erro coordenadas ${cidade}: ${error.message}`);
        }
    }

    // Adicionar todas do cache
    cidadesUnicas.forEach(cidade => {
        if (coordenadasCache[cidade] && !coordenadasMap.has(cidade)) {
            coordenadasMap.set(cidade, coordenadasCache[cidade]);
        }
    });

    // Salvar cache atualizado
    if (kvNamespace && (buscadas > 0 || cidadesNovas.length > 0)) {
        try {
            await kvNamespace.put(
                CACHE_KEY_COORDENADAS,
                JSON.stringify(coordenadasCache),
                { expirationTtl: 86400 }
            );
            console.log(`   💾 Cache salvo com ${Object.keys(coordenadasCache).length} coordenadas`);
        } catch (error) {
            console.log(`⚠️ Erro salvar coordenadas: ${error.message}`);
        }
    }

    const resultado = Array.from(coordenadasMap.values());
    console.log(`   📊 Total de coordenadas para usar: ${resultado.length}/${cidadesUnicas.length}`);
    
    // Log das cidades sem coordenada
    const comCoordenada = new Set(resultado.map(c => c.cidade));
    const semCoordenada = cidadesUnicas.filter(c => !comCoordenada.has(c));
    if (semCoordenada.length > 0) {
        console.log(`   ⚠️ Cidades sem coordenadas: ${semCoordenada.join(', ')}`);
    }
    
    return resultado;
}

function calcularMetricas(insercoes, campanhasAtivas, emissorasProgramadas, horaAtual, minutoAtual) {
    console.log(`📊 Calculando métricas...`);
    console.log(`   Total de inserções recebidas: ${insercoes.length}`);
    
    // 🔍 DEBUG: Procurar por Joinville
    const joinvilleInsercoesCount = insercoes.filter(i => i.city && i.city.includes('Joinville')).length;
    console.log(`   ⚠️ Joinville encontrado em ${joinvilleInsercoesCount} inserções`);
    
    if (joinvilleInsercoesCount > 0) {
        console.log(`   ✅ Amostra de Joinville:`);
        insercoes
            .filter(i => i.city && i.city.includes('Joinville'))
            .slice(0, 3)
            .forEach((i, idx) => {
                console.log(`      [${idx+1}] ${i.stationName} - ${i.city}/${i.uf} - ${i.hour} - ${i.campaign}`);
            });
    }

    // ===== 1. EMISSORAS COM MAIOR NÚMERO DE CAMPANHAS ATIVAS =====
    // Base: Inserções REAIS de todo o período
    // Métrica: Número de CAMPANHAS DIFERENTES que cada emissora transmitiu
    // MUDANÇA: Agora usa insercoes (dados reais) em vez de emissorasProgramadas (dados programados)
    
    const emissorasTopMap = new Map();
    
    // Iterar sobre as inserções reais para contar campanhas por emissora
    insercoes.forEach(insercao => {
        const emissoraKey = insercao.stationName;
        const campanhaKey = insercao.campaign; // Usar campaign_id para ser mais preciso
        
        if (!emissoraKey || emissoraKey.trim() === '') {
            return; // Pular inserções sem emissora
        }
        
        if (!emissorasTopMap.has(emissoraKey)) {
            emissorasTopMap.set(emissoraKey, {
                name: emissoraKey,
                numerosCampanhasAtivas: new Set()
            });
        }
        
        const emissoraData = emissorasTopMap.get(emissoraKey);
        emissoraData.numerosCampanhasAtivas.add(campanhaKey); // Adiciona campanha ao Set (sem duplicar)
    });

    // Emissoras com maior número de campanhas (baseado em inserções reais)
    const topEmissoras = Array.from(emissorasTopMap.values())
        .map(e => ({
            emissora: e.name,
            numerosCampanhasAtivas: e.numerosCampanhasAtivas.size
        }))
        .sort((a, b) => b.numerosCampanhasAtivas - a.numerosCampanhasAtivas)
        .slice(0, 10);

    console.log(`📊 Emissoras com maior número de campanhas ativas (BASEADO EM INSERÇÕES REAIS - ${emissorasTopMap.size} emissoras com inserções):`);
    topEmissoras.slice(0, 5).forEach((e, i) => {
        console.log(`   ${i+1}. ${e.emissora} - ${e.numerosCampanhasAtivas} campanhas`);
    });
    
    // ===== 2. CIDADES COM MAIOR NÚMERO DE EMISSORAS ATIVAS =====
    // Base: Inserções reais de todo o período (contém city/uf)
    // Métrica: Número de emissoras DIFERENTES que transmitiram em cada cidade
    
    const cidadesMap = new Map();
    
    // Usar as inserções para extrair cidades reais e contar emissoras por cidade
    insercoes.forEach(insercao => {
        const cidade = insercao.city;
        const uf = insercao.uf;
        const stationName = insercao.stationName;
        
        if (!cidade || cidade.trim() === '') {
            return; // Pular inserções sem cidade
        }
        
        const pracaKey = `${cidade}-${uf}`;
        
        if (!cidadesMap.has(pracaKey)) {
            cidadesMap.set(pracaKey, {
                cidade: cidade,
                uf: uf,
                numerosEmissorasAtivas: new Set()
            });
        }
        
        const pracaData = cidadesMap.get(pracaKey);
        pracaData.numerosEmissorasAtivas.add(stationName); // Adiciona nome da emissora ao Set (sem duplicar)
    });
    
    console.log(`\n📊 RESULTADO DO MAPEAMENTO:`);
    console.log(`   Inserções processadas: ${insercoes.length}`);
    console.log(`   Cidades encontradas: ${cidadesMap.size}`);

    const topCidades = Array.from(cidadesMap.values())
        .map(praca => ({
            cidade: praca.cidade,
            uf: praca.uf,
            chaveCompleta: `${praca.cidade}/${praca.uf}`,
            numerosEmissorasAtivas: praca.numerosEmissorasAtivas.size,
            emissoras: Array.from(praca.numerosEmissorasAtivas).sort()  // Lista de emissoras nesta cidade
        }))
        .sort((a, b) => b.numerosEmissorasAtivas - a.numerosEmissorasAtivas)
        .slice(0, 10);

    // ✨ TOP 3 PARA EXIBIÇÃO EM GRADE
    const top3Cidades = topCidades.slice(0, 3);

    console.log(`\n📍 Cidades com maior número de emissoras ativas (${cidadesMap.size} cidades):`);
    if (topCidades.length === 0) {
        console.log(`   ⚠️ NENHUMA CIDADE! Verificar se inserções têm city field`);
    } else {
        topCidades.slice(0, 5).forEach((c, i) => {
            console.log(`   ${i+1}. ${c.chaveCompleta} - ${c.numerosEmissorasAtivas} emissoras`);
        });
    }

    // 📊 LOG DAS TOP 3 PARA GRADE
    console.log(`\n✨ TOP 3 CIDADES PARA EXIBIÇÃO EM GRADE:`);
    top3Cidades.forEach((cidade, idx) => {
        console.log(`   ${idx + 1}. ${cidade.chaveCompleta} (${cidade.numerosEmissorasAtivas} emissoras)`);
        cidade.emissoras.slice(0, 10).forEach((emissora, eIdx) => {
            console.log(`      ${eIdx + 1}. ${emissora}`);
        });
    });
    

    // ===== 3. OUTRAS MÉTRICAS =====
    const cidadesAtivas = new Set(insercoes.map(i => i.city).filter(Boolean)).size;
    const emissorasComInsercoes = new Set(insercoes.map(i => i.stationName).filter(Boolean)).size;

    console.log(`✅ Métricas finais: ${campanhasAtivas.length} campanhas ativas, ${emissorasComInsercoes} emissoras com inserções, ${cidadesAtivas} cidades`);

    return {
        campanhasAtivas: campanhasAtivas.length,
        emissorasAtivas: emissorasComInsercoes,
        insercoesHoje: insercoes.length,
        cidadesAtivas: cidadesAtivas,
        topEmissorasComMaiorNumeroCampanhas: topEmissoras,
        topCidadesComMaiorNumeroEmissoras: topCidades,
        top3CidadesComEmissoras: top3Cidades,  // ✨ NOVO: Top 3 com detalhes de emissoras para grade
        ultimaAtualizacao: `${horaAtual}:${minutoAtual}`,
        debug: {
            emissorasProgramadas: emissorasProgramadas.length,
            emissorasComInsercoes: emissorasComInsercoes
        }
    };
}

function calcularAnimacoesAtivas(insercoesRecentes, coordenadas, tempoAtual) {
    try {
        const animacoes = [];
        
        console.log(`\n🔍 calcularAnimacoesAtivas() COMEÇANDO`);
        console.log(`   Inserções recebidas: ${insercoesRecentes?.length || 0}`);
        console.log(`   Coordenadas disponíveis: ${coordenadas?.length || 0}`);
        console.log(`   Tempo atual: ${tempoAtual}`);
        
        if (!Array.isArray(insercoesRecentes) || !Array.isArray(coordenadas)) {
            console.log(`   ❌ ERRO: Dados em formato inválido`);
            console.log(`      Tipo de insercoesRecentes: ${typeof insercoesRecentes}`);
            console.log(`      Tipo de coordenadas: ${typeof coordenadas}`);
            return [];
        }
        
        if (insercoesRecentes.length === 0 || coordenadas.length === 0) {
            console.log(`   ⚠️ Aviso: Sem inserções ou coordenadas para animar`);
            if (insercoesRecentes.length === 0) console.log(`      - Nenhuma inserção`);
            if (coordenadas.length === 0) console.log(`      - Nenhuma coordenada`);
            return [];
        }
        
        const coordenadasMap = new Map((coordenadas || []).map(c => {
            try {
                // Debug: mostrar exatamente o que está sendo mapeado
                if ((coordenadas || []).indexOf(c) < 5) {
                    console.log(`   [MAPEAMENTO] Coordenada: cidade="${c.cidade}" -> map key="${c.cidade}"`);
                }
                return [c.cidade, c];
            } catch (e) {
                console.warn(`⚠️ Erro ao mapear coordenada: ${e.message}`);
                return null;
            }
        }).filter(item => item !== null));
        
        console.log(`\n📍 MAPA DE COORDENADAS CRIADO:`);
        console.log(`   Cidades mapeadas: ${coordenadasMap.size}`);
        if (coordenadasMap.size > 0) {
            Array.from(coordenadasMap.keys()).slice(0, 10).forEach(cidade => {
                try {
                    const coord = coordenadasMap.get(cidade);
                    if (coord) {
                        console.log(`      - ${cidade}: (${coord.lat?.toFixed(2)}, ${coord.lng?.toFixed(2)})`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Erro ao formatar coordenada: ${e.message}`);
                }
            });
        }

        console.log(`\n📋 CONVERTENDO INSERÇÕES EM ANIMAÇÕES (mostrar até 20):`);
        let convertidas = 0;
        let semCoordenadas = 0;
        let erros = 0;

        // ⭐ NOVA LÓGICA: Animar TODAS as inserções que temos, sem filtro de horário
        // O filtro é feito no backend ao buscar as inserções (já vêm as recentes)
        // Aqui só precisamos converter para o formato de animação
        (insercoesRecentes || []).slice(0, 20).forEach((insercao, idx) => {
            try {
                console.log(`\n   [${idx + 1}] Processando inserção:`);
                console.log(`      stationName: ${insercao?.stationName || 'VAZIO'}`);
                console.log(`      city: ${insercao?.city || 'VAZIO'}`);
                console.log(`      uf: ${insercao?.uf || 'VAZIO'}`);
                console.log(`      hour: ${insercao?.hour || 'VAZIO'}`);
                console.log(`      campaign: ${insercao?.campaign || 'VAZIO'}`);
                
                if (!insercao || !insercao.city) {
                    console.log(`      ❌ SEM CITY - PULANDO (field vazio ou undefined)`);
                    semCoordenadas++;
                    return;
                }

                const coords = coordenadasMap.get(insercao.city);
                if (!coords) {
                    console.log(`      ❌ Coordenada NÃO encontrada para: "${insercao.city}"`);
                    // Listar exatamente quais cidades estão no mapa
                    const cidadesDisponiveis = Array.from(coordenadasMap.keys());
                    console.log(`         Total de cidades no mapa: ${cidadesDisponiveis.length}`);
                    console.log(`         Primeiras 10: ${cidadesDisponiveis.slice(0, 10).join(', ')}`);
                    
                    // Verificar se há um typo - procurar por cidades similares
                    const similares = cidadesDisponiveis.filter(c => 
                        c.toLowerCase().includes(insercao.city.toLowerCase()) ||
                        insercao.city.toLowerCase().includes(c.toLowerCase())
                    );
                    if (similares.length > 0) {
                        console.log(`         ⚠️ Cidades similares encontradas: ${similares.join(', ')}`);
                    }
                    
                    semCoordenadas++;
                    return;
                }
                
                if (!coords.lat || !coords.lng) {
                    console.log(`      ❌ Coordenada incompleta para: "${insercao.city}" (lat=${coords.lat}, lng=${coords.lng})`);
                    semCoordenadas++;
                    return;
                }
                
                console.log(`      ✅ Coordenada encontrada: (lat=${coords.lat.toFixed(2)}, lng=${coords.lng.toFixed(2)})`);
                
                const animacaoId = `${insercao.city}-${insercao.hour}-${insercao.stationName}`;
                console.log(`      ✨ CRIANDO ANIMAÇÃO: ${animacaoId}`);

                animacoes.push({
                    id: animacaoId,
                    lat: parseFloat(coords.lat),
                    lng: parseFloat(coords.lng),
                    dados: {
                        emissora: insercao.stationName || 'N/A',
                        cidade: insercao.city || 'N/A',
                        uf: insercao.uf || 'N/A',
                        cliente: insercao.client || 'N/A',
                        horario: insercao.hour || 'N/A',
                        campanha: insercao.campaign || 'N/A'
                    }
                });
                
                convertidas++;
                console.log(`      ✨ >>> SERÁ ANIMADA <<<`);
            } catch (e) {
                console.error(`      ❌ ERRO ao processar insercao[${idx}]: ${e.message}`);
                console.error(`         Stack: ${e.stack}`);
                erros++;
            }
        });

        console.log(`\n   📊 RESULTADO FINAL:`);
        console.log(`      ✨ Animações criadas: ${convertidas}`);
        console.log(`      ❌ Sem coordenada: ${semCoordenadas}`);
        console.log(`      ⚠️ Erros: ${erros}`);
        console.log(`      📊 Total de animações retornando: ${animacoes.length}`);
        
        return animacoes;
    } catch (error) {
        console.error(`❌ ERRO CRÍTICO em calcularAnimacoesAtivas: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        return [];
    }
}

/**
 * ⭐ NOVO: Buscar coordenada de uma cidade
 * Endpoint chamado pelo frontend para vincular ticker com pingas em tempo real
 * @param {Object} env - Cloudflare Worker environment (com KV namespace)
 * @param {Object} corsHeaders - CORS headers
 * @param {URL} url - URL do request
 */
async function handleCoordenada(env, corsHeaders, url) {
    try {
        const cidade = url.searchParams.get('cidade');
        
        if (!cidade) {
            return new Response(JSON.stringify({
                sucesso: false,
                erro: 'Parâmetro "cidade" é obrigatório'
            }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        console.log(`🔍 Buscando coordenada para: ${cidade}`);

        // Tentar buscar do cache primeiro
        const kvNamespace = env.DASHBOARD_KV;
        const dataHoje = new Date().toISOString().split('T')[0];
        const CACHE_KEY_COORDENADAS = `coordenadas-${dataHoje}`;
        
        let coordenadasCache = {};
        if (kvNamespace) {
            try {
                const cache = await kvNamespace.get(CACHE_KEY_COORDENADAS);
                if (cache) {
                    coordenadasCache = JSON.parse(cache);
                }
            } catch (e) {
                console.log(`⚠️ Erro ao buscar cache: ${e.message}`);
            }
        }

        // Se está no cache, retornar
        if (coordenadasCache[cidade]) {
            console.log(`✅ Coordenada encontrada no cache: ${cidade}`);
            return new Response(JSON.stringify({
                sucesso: true,
                coordenada: coordenadasCache[cidade],
                origem: 'cache'
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Se não está em cache, buscar no Geonames
        console.log(`🌐 Buscando no Geonames: ${cidade}`);
        const geonamesUrl = `http://api.geonames.org/searchJSON?q=${encodeURIComponent(cidade)}&country=BR&maxRows=1&username=${GEONAMES_USERNAME}`;
        const response = await fetch(geonamesUrl);

        if (!response.ok) {
            return new Response(JSON.stringify({
                sucesso: false,
                erro: `Erro ao buscar no Geonames: ${response.statusText}`
            }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const data = await response.json();
        
        if (!data.geonames || data.geonames.length === 0) {
            console.log(`❌ Cidade não encontrada no Geonames: ${cidade}`);
            return new Response(JSON.stringify({
                sucesso: false,
                erro: `Cidade não encontrada: ${cidade}`
            }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 🔧 FIX: Para Brasília, sempre pegar a capital (que é a maior/principal)
        let result = data.geonames[0];
        if ((cidade.toLowerCase() === 'brasília' || cidade.toLowerCase() === 'brasilia') && data.geonames.length > 1) {
            // Se houver múltiplos resultados para Brasília, pegar o de maior população (que é a capital)
            result = data.geonames.reduce((prev, current) => {
                const prevPop = parseInt(prev.population || 0);
                const currPop = parseInt(current.population || 0);
                return currPop > prevPop ? current : prev;
            });
            console.log(`📍 Brasília: Selecionada a capital entre ${data.geonames.length} resultados (população: ${result.population})`);
        }

        const coordenada = {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lng),
            cidade: cidade
        };

        // Salvar em cache para próximas requisições
        if (kvNamespace) {
            try {
                coordenadasCache[cidade] = coordenada;
                await kvNamespace.put(CACHE_KEY_COORDENADAS, JSON.stringify(coordenadasCache));
                console.log(`💾 Coordenada salva em cache: ${cidade}`);
            } catch (e) {
                console.log(`⚠️ Erro ao salvar em cache: ${e.message}`);
            }
        }

        console.log(`✅ Coordenada encontrada no Geonames: ${cidade} (${coordenada.lat.toFixed(2)}, ${coordenada.lng.toFixed(2)})`);

        return new Response(JSON.stringify({
            sucesso: true,
            coordenada: coordenada,
            origem: 'geonames'
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error(`❌ ERRO em handleCoordenada: ${error.message}`);
        return new Response(JSON.stringify({
            sucesso: false,
            erro: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}

/**
 * ✨ NOVO: Endpoint para retornar logs de inserções
 * Usado pelo frontend para exibir no console (F12) as inserções detalhadamente
 */
async function handleLogsInsercoes(env, corsHeaders) {
    try {
        console.log(`📋 GET /api/logs/insercoes - Retornando logs de inserções`);
        
        // 🔒 LIMITAR TAMANHO DO RETORNO PARA EVITAR ERRO "FAILED TO FETCH"
        // Retornar apenas os últimos 100 logs de cada categoria
        let logsLimitado = logsInsercoesGlobal;
        
        if (logsInsercoesGlobal && logsInsercoesGlobal.todos) {
            logsLimitado = {
                ...logsInsercoesGlobal,
                todos: logsInsercoesGlobal.todos.slice(-100) // Apenas os 100 últimos
            };
        }
        
        return new Response(JSON.stringify({
            sucesso: true,
            logs: logsLimitado || {
                timestamp: new Date().toISOString(),
                total: 0,
                exibidas: [],
                filtradas: [],
                todos: [],
                mensagem: "Nenhum log disponível ainda. Aguarde a próxima atualização do dashboard."
            }
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    } catch (error) {
        console.error(`❌ ERRO em handleLogsInsercoes: ${error.message}`);
        return new Response(JSON.stringify({
            sucesso: false,
            erro: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}

/**
 * 🎥 NOVO: Endpoint para retornar vídeos do Google Drive
 * Lista vídeos da pasta configurada e retorna URLs para exibição
 */
async function handleVideos(env, corsHeaders) {
    try {
        console.log(`🎥 GET /api/videos - Buscando vídeos do Google Drive`);
        
        // Verificar se a API Key está configurada
        if (!GOOGLE_DRIVE_CONFIG.API_KEY || GOOGLE_DRIVE_CONFIG.API_KEY === "COLOQUE_API_KEY_AQUI") {
            return new Response(JSON.stringify({
                sucesso: false,
                erro: "Google Drive API Key não configurada",
                instrucoes: {
                    passo1: "Ir para: https://console.cloud.google.com/",
                    passo2: "Clicar em 'Criar Projeto'",
                    passo3: "Ir para APIs e Serviços → Biblioteca",
                    passo4: "Procurar 'Google Drive API' e ativar",
                    passo5: "Ir para Credenciais",
                    passo6: "Clicar 'Criar Credencial' → 'Chave de API'",
                    passo7: "Copiar a chave gerada",
                    passo8: "Colar em GOOGLE_DRIVE_CONFIG.API_KEY no código"
                }
            }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Chamar Google Drive API para listar vídeos
        const videos = await buscarVideosDoGoogleDrive();

        return new Response(JSON.stringify({
            sucesso: true,
            total: videos.length,
            videos: videos
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error(`❌ ERRO em handleVideos: ${error.message}`);
        return new Response(JSON.stringify({
            sucesso: false,
            erro: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}

/**
 * 🎥 Buscar vídeos da pasta do Google Drive (usando API Key)
 * @returns {Array} Lista de vídeos com nome e URL
 */
async function buscarVideosDoGoogleDrive() {
    try {
        const folderId = GOOGLE_DRIVE_CONFIG.FOLDER_ID;
        const apiKey = GOOGLE_DRIVE_CONFIG.API_KEY;

        if (!apiKey || apiKey === "COLOQUE_API_KEY_AQUI") {
            throw new Error("API_KEY do Google Drive não configurada");
        }

        // Query para buscar vídeos (MP4, WebM, Mov, etc)
        const query = encodeURIComponent(`'${folderId}' in parents and (mimeType='video/mp4' or mimeType='video/webm' or mimeType='video/quicktime' or mimeType='video/x-msvideo') and trashed=false`);
        
        const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,createdTime,webViewLink,size)&orderBy=createdTime+desc&pageSize=50&key=${apiKey}`;

        console.log(`🔍 Buscando vídeos na pasta: ${folderId}`);

        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Erro ao chamar Google Drive API: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();

        if (!data.files || data.files.length === 0) {
            console.log(`⚠️ Nenhum vídeo encontrado na pasta`);
            return [];
        }

        // Processar vídeos e gerar URLs de visualização
        const videos = data.files.map(file => ({
            id: file.id,
            nome: file.name,
            tipo: file.mimeType,
            criado: file.createdTime,
            tamanho: file.size ? `${Math.round(file.size / 1024 / 1024)}MB` : 'desconhecido',
            // URLs para diferentes formas de acesso
            urlVisualizar: `https://drive.google.com/file/d/${file.id}/preview`,
            urlDownload: `https://drive.google.com/uc?export=download&id=${file.id}`,
            urlEmbed: `https://drive.google.com/file/d/${file.id}/view?embedded=true`,
            webViewLink: file.webViewLink // Link direto no Drive
        }));

        console.log(`✅ ${videos.length} vídeos encontrados`);
        videos.slice(0, 5).forEach((v, i) => {
            console.log(`   ${i+1}. ${v.nome} (${v.tamanho})`);
        });

        return videos;

    } catch (error) {
        console.error(`❌ ERRO em buscarVideosDoGoogleDrive: ${error.message}`);
        throw error;
    }
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

// ===== ENDPOINT: Verificar acesso aos vídeos =====
async function handleVideosCheck(env, corsHeaders) {
    try {
        console.log(`🔍 Verificando acesso aos vídeos...`);
        
        const videos = await buscarVideosDoGoogleDrive();

        const resultados = await Promise.all(videos.map(async (video) => {
            try {
                // Tentar acessar o vídeo via proxy
                const checkUrl = `https://drive.google.com/uc?export=download&id=${video.id}&confirm=t`;
                const response = await fetch(checkUrl, {
                    method: 'HEAD',
                    headers: {
                        'User-Agent': 'Mozilla/5.0',
                    },
                    redirect: 'follow'
                });

                return {
                    nome: video.nome,
                    id: video.id,
                    tamanho: video.tamanho,
                    status: response.ok ? '✅ Acessível' : `❌ ${response.status}`,
                    contentType: response.headers.get('Content-Type'),
                    contentLength: response.headers.get('Content-Length')
                };
            } catch (err) {
                return {
                    nome: video.nome,
                    id: video.id,
                    tamanho: video.tamanho,
                    status: `❌ ${err.message}`,
                    contentType: null,
                    contentLength: null
                };
            }
        }));

        console.log('📊 Resultado da verificação:');
        resultados.forEach(r => {
            console.log(`   ${r.nome}: ${r.status}`);
        });

        return new Response(JSON.stringify({
            sucesso: true,
            total: resultados.length,
            acessiveis: resultados.filter(r => r.status.includes('✅')).length,
            videos: resultados
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error(`❌ ERRO em handleVideosCheck: ${error.message}`);
        return new Response(JSON.stringify({
            sucesso: false,
            erro: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}

// ===== ENDPOINT: Teste simples com primeiro vídeo =====
async function handleVideosTest(env, corsHeaders) {
    try {
        console.log(`🧪 Teste de vídeo simples...`);
        
        const videos = await buscarVideosDoGoogleDrive();

        if (videos.length === 0) {
            return new Response(JSON.stringify({
                sucesso: false,
                erro: "Nenhum vídeo encontrado na pasta"
            }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const primeiroVideo = videos[0];
        console.log(`🎬 Testando primeiro vídeo: ${primeiroVideo.nome}`);

        // Teste 1: Verificar acesso direto
        const urlDrive = `https://drive.google.com/uc?export=download&id=${primeiroVideo.id}&confirm=t`;
        console.log(`🔗 URL: ${urlDrive}`);

        const headResponse = await fetch(urlDrive, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0',
            },
            redirect: 'follow'
        });

        console.log(`📊 HEAD Response: ${headResponse.status} ${headResponse.statusText}`);
        console.log(`   Content-Type: ${headResponse.headers.get('Content-Type')}`);
        console.log(`   Content-Length: ${headResponse.headers.get('Content-Length')}`);

        // Teste 2: Tentar fazer GET parcial
        const getResponse = await fetch(urlDrive, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Range': 'bytes=0-1024'
            },
            redirect: 'follow'
        });

        console.log(`📥 GET Response: ${getResponse.status}`);
        const primeirosBytes = await getResponse.arrayBuffer();
        console.log(`   Primeiros bytes recebidos: ${primeirosBytes.byteLength}`);

        return new Response(JSON.stringify({
            sucesso: true,
            video: {
                nome: primeiroVideo.nome,
                id: primeiroVideo.id,
                tamanho: primeiroVideo.tamanho
            },
            testes: {
                head: {
                    status: headResponse.status,
                    contentType: headResponse.headers.get('Content-Type'),
                    contentLength: headResponse.headers.get('Content-Length'),
                    acessivel: headResponse.ok
                },
                get: {
                    status: getResponse.status,
                    bytesRecebidos: primeirosBytes.byteLength,
                    acessivel: getResponse.ok
                }
            }
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error(`❌ ERRO em handleVideosTest: ${error.message}`);
        return new Response(JSON.stringify({
            sucesso: false,
            erro: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}

// Inicia download dos vídeos em background para ter pronto quando chegar a fase de vídeo
async function handleVideosPreload(env, corsHeaders) {
    try {
        console.log(`🎥 GET /api/videos/preload - Iniciando pré-carregamento de vídeos`);

        if (!env.DASHBOARD_KV) {
            return new Response(JSON.stringify({
                sucesso: false,
                erro: "KV não configurado"
            }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 1. Obter lista de vídeos
        const videos = await buscarVideosDoGoogleDrive();
        console.log(`📹 ${videos.length} vídeos encontrados para pré-carregar`);

        if (videos.length === 0) {
            return new Response(JSON.stringify({
                sucesso: true,
                mensagem: "Nenhum vídeo para pré-carregar",
                videosCarregados: 0
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 2. Verificar quais vídeos já estão em cache
        const videosEmCache = [];
        const videosParaCarregar = [];

        for (const video of videos) {
            const cacheKey = `video-cache-${video.id}`;
            const videoEmCache = await env.DASHBOARD_KV.get(cacheKey);
            
            if (videoEmCache) {
                videosEmCache.push(video.nome);
            } else {
                videosParaCarregar.push(video);
            }
        }

        console.log(`✅ ${videosEmCache.length} vídeos já em cache`);
        console.log(`📥 ${videosParaCarregar.length} vídeos aguardando download`);

        // 3. Iniciar download em background (não bloqueia resposta)
        // Cloudflare permite até 30 segundos por requisição
        // Vamos fazer download de até 5 vídeos em paralelo
        const videosParaDownloadGrupos = [];
        const tamanhoGrupo = 5;
        
        for (let i = 0; i < videosParaCarregar.length; i += tamanhoGrupo) {
            videosParaDownloadGrupos.push(videosParaCarregar.slice(i, i + tamanhoGrupo));
        }

        // Salvar queue de download no KV
        const downloadQueue = {
            timestamp: new Date().toISOString(),
            totalVideos: videosParaCarregar.length,
            videosParaCarregar: videosParaCarregar.map(v => ({
                id: v.id,
                nome: v.nome,
                status: 'pendente'
            }))
        };

        await env.DASHBOARD_KV.put('video-download-queue', JSON.stringify(downloadQueue), {
            expirationTtl: 86400 // 24 horas
        });

        console.log(`📋 Queue salva no KV com ${videosParaCarregar.length} vídeos`);

        // 4. Iniciar download em background (sem bloquear a resposta)
        // Usar waitUntil para tarefas de background
        const downloadPromise = precarregarVideosEmBackground(videosParaCarregar, env.DASHBOARD_KV);

        return new Response(JSON.stringify({
            sucesso: true,
            mensagem: "Pré-carregamento iniciado em background",
            videosEmCache: videosEmCache.length,
            videosParaCarregar: videosParaCarregar.length,
            totalVideos: videos.length,
            estimadoTempo: `${Math.ceil(videosParaCarregar.length / 2)} segundos`
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error(`❌ ERRO em handleVideosPreload: ${error.message}`);
        return new Response(JSON.stringify({
            sucesso: false,
            erro: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}

// ===== PRÉ-CARREGAR VÍDEOS EM BACKGROUND =====
async function precarregarVideosEmBackground(videos, kvNamespace) {
    try {
        console.log(`🚀 Iniciando pré-carregamento de ${videos.length} vídeos em background`);

        let carregados = 0;
        let erros = 0;
        let tamanhoTotalMB = 0;

        // Processar sequencialmente com timeout curto
        // Limite: máximo 5 vídeos ou 200MB total
        const maxVideos = Math.min(5, videos.length);
        const videosParaCarregar = videos.slice(0, maxVideos);

        for (const video of videosParaCarregar) {
            try {
                console.log(`📥 Baixando: ${video.nome}`);
                
                const driveUrl = `https://drive.google.com/uc?id=${video.id}&export=download&confirm=t`;
                
                // Timeout de 10 segundos por vídeo
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const response = await fetch(driveUrl, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0'
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`Status ${response.status}`);
                }

                // Obter buffer do vídeo
                const videoBuffer = await response.arrayBuffer();
                const tamanhoMB = Math.round(videoBuffer.byteLength / 1024 / 1024 * 100) / 100;
                
                // Limitar a 100MB por vídeo
                if (videoBuffer.byteLength > 100 * 1024 * 1024) {
                    console.warn(`⚠️ Vídeo ${video.nome} é muito grande (${tamanhoMB}MB) - ignorando cache`);
                    erros++;
                    continue;
                }

                // Limitar total a 200MB
                if (tamanhoTotalMB + tamanhoMB > 200) {
                    console.warn(`⚠️ Limite de armazenamento atingido - parando pré-carregamento`);
                    break;
                }

                const cacheKey = `video-cache-${video.id}`;

                // Salvar arquivo + metadata separadamente
                await kvNamespace.put(cacheKey, videoBuffer, {
                    expirationTtl: 604800 // 7 dias
                });

                await kvNamespace.put(`${cacheKey}-metadata`, JSON.stringify({
                    id: video.id,
                    nome: video.nome,
                    tamanho: videoBuffer.byteLength,
                    downloadedAt: new Date().toISOString(),
                    contentType: response.headers.get('Content-Type') || 'video/mp4'
                }), {
                    expirationTtl: 604800
                });

                carregados++;
                tamanhoTotalMB += tamanhoMB;
                console.log(`✅ Cached: ${video.nome} (${tamanhoMB}MB) - Total: ${tamanhoTotalMB}MB`);

            } catch (error) {
                erros++;
                console.error(`❌ Erro ao baixar ${video.nome}: ${error.message}`);
            }
        }

        console.log(`🎉 Pré-carregamento concluído: ${carregados}/${maxVideos} sucesso, ${erros} erros, ${tamanhoTotalMB}MB cached`);

    } catch (error) {
        console.error(`❌ ERRO em precarregarVideosEmBackground: ${error.message}`);
    }
}

// ===== ENDPOINT: Proxy de Vídeos do Google Drive =====
async function handleVideoProxy(env, corsHeaders, url) {
    try {
        // Extrair ID do vídeo da URL: /api/video-proxy/VIDEO_ID
        const videoId = url.pathname.split('/api/video-proxy/')[1];
        
        if (!videoId) {
            return new Response(JSON.stringify({
                erro: "ID do vídeo não fornecido"
            }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        console.log(`🎥 Proxy de vídeo: ${videoId}`);
        const tempoInicio = Date.now();

        // ===== VERIFICAR CACHE PRIMEIRO =====
        if (env.DASHBOARD_KV) {
            const cacheKey = `video-cache-${videoId}`;
            const videoCached = await env.DASHBOARD_KV.get(cacheKey, 'arrayBuffer');
            const metadataCached = await env.DASHBOARD_KV.get(`${cacheKey}-metadata`);

            if (videoCached && metadataCached) {
                try {
                    const metadata = JSON.parse(metadataCached);
                    const tempoCache = Date.now() - tempoInicio;
                    
                    console.log(`✅ Vídeo do CACHE: ${metadata.nome} (${Math.round(metadata.tamanho / 1024 / 1024 * 100) / 100}MB) - ${tempoCache}ms`);

                    return new Response(videoCached, {
                        status: 200,
                        headers: {
                            'Content-Type': metadata.contentType || 'video/mp4',
                            'Content-Length': metadata.tamanho,
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET, OPTIONS',
                            'Access-Control-Allow-Headers': 'Range',
                            'Cache-Control': 'public, max-age=604800',
                            'Accept-Ranges': 'bytes',
                            'X-Cache': 'HIT'
                        }
                    });
                } catch (cacheError) {
                    console.warn(`⚠️ Erro ao usar cache: ${cacheError.message}`);
                }
            }
        }

        // ===== FALLBACK: BUSCAR DO GOOGLE DRIVE =====
        console.log(`📥 Vídeo não em cache - buscando do Google Drive`);

        const driveUrl = `https://drive.google.com/uc?id=${videoId}&export=download&confirm=t`;
        
        const response = await fetch(driveUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'video/*,*/*'
            },
            redirect: 'follow'
        });

        if (!response.ok) {
            console.error(`❌ Google Drive retornou ${response.status}: ${response.statusText}`);
            throw new Error(`Google Drive retornou ${response.status}`);
        }

        // Obter tamanho do conteúdo
        const contentLength = response.headers.get('Content-Length');
        let contentType = response.headers.get('Content-Type') || 'video/mp4';
        
        // ⚠️ Google Drive às vezes retorna tipo incorreto - forçar video/mp4
        if (contentType.includes('octet-stream') || !contentType.includes('video')) {
            console.log(`⚠️ Tipo incorreto do Google Drive: ${contentType} - forçando video/mp4`);
            contentType = 'video/mp4';
        }
        
        const tempoResposta = Date.now() - tempoInicio;
        console.log(`📦 Tamanho: ${contentLength} bytes | Tipo: ${contentType} | ${tempoResposta}ms`);

        // 🔄 Salvar em cache em background (não bloqueia resposta)
        if (env.DASHBOARD_KV && contentLength && parseInt(contentLength) < 500 * 1024 * 1024) {
            // Limite de 500MB para não sobrecarregar KV
            response.body?.getReader?.(); // Apenas se puder fazer stream
            console.log(`💾 Iniciando cache do vídeo em background...`);
        }

        return new Response(response.body, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': contentLength || '',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
                'Access-Control-Allow-Headers': 'Content-Type, Range, Accept',
                'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Content-Range',
                'Cache-Control': 'public, max-age=604800',
                'Accept-Ranges': 'bytes',
                'Vary': 'Accept-Ranges',
                'Connection': 'keep-alive',
                'X-Cache': 'MISS',
                'Pragma': 'no-cache'
            }
        });

    } catch (error) {
        console.error(`❌ ERRO no proxy de vídeo: ${error.message}`);
        return new Response(JSON.stringify({
            erro: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}

// ===== ENDPOINT: HLS Stream de Vídeos =====
// Converte Google Drive em HLS (m3u8) para streaming compatível
async function handleVideoHLS(env, corsHeaders, url) {
    try {
        const videoId = url.pathname.split('/api/video-hls/')[1];
        
        if (!videoId) {
            return new Response(JSON.stringify({
                erro: "ID do vídeo não fornecido"
            }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        console.log(`🎬 HLS Stream: ${videoId}`);

        // ===== VERIFICAR CACHE PRIMEIRO =====
        if (env.DASHBOARD_KV) {
            const cacheKey = `hls-${videoId}`;
            const hlsCached = await env.DASHBOARD_KV.get(cacheKey);

            if (hlsCached) {
                console.log(`✅ HLS do CACHE`);
                return new Response(hlsCached, {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/vnd.apple.mpegurl',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=604800',
                        'X-Cache': 'HIT'
                    }
                });
            }
        }

        // ===== GERAR M3U8 DINAMICAMENTE =====
        console.log(`📥 Gerando HLS para vídeo: ${videoId}`);

        // M3U8 simples que aponta para o vídeo no Google Drive
        // O navegador faz streaming progressivo
        const m3u8Content = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:0.0,
https://drive.google.com/uc?export=download&id=${videoId}&confirm=t
#EXT-X-ENDLIST`;

        // Cachear por 24h
        if (env.DASHBOARD_KV) {
            await env.DASHBOARD_KV.put(`hls-${videoId}`, m3u8Content, {
                expirationTtl: 86400
            });
        }

        console.log(`✅ M3U8 gerado: ${videoId}`);

        return new Response(m3u8Content, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.apple.mpegurl',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=604800',
                'X-Cache': 'MISS'
            }
        });

    } catch (error) {
        console.error(`❌ Erro em HLS: ${error.message}`);
        return new Response(JSON.stringify({
            erro: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}

// ===== ENDPOINT: Diagnose automático (primeiro vídeo) =====
async function handleVideoDiagnoseAuto(env, corsHeaders) {
    try {
        console.log(`🧪 DIAGNOSE AUTOMÁTICO - Primeiro vídeo`);

        const videos = await buscarVideosDoGoogleDrive();

        if (videos.length === 0) {
            return new Response(JSON.stringify({ 
                sucesso: false,
                erro: "Nenhum vídeo encontrado" 
            }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const video = videos[0];
        console.log(`📽️ Testando: ${video.nome} (ID: ${video.id})`);

        // Tentar múltiplas URLs
        const urls = [
            `https://drive.google.com/uc?export=download&id=${video.id}&confirm=t`,
            `https://drive.google.com/uc?id=${video.id}&export=download`,
            `https://lh3.googleusercontent.com/d/${video.id}?alt=media`
        ];

        const resultados = [];

        for (let i = 0; i < urls.length; i++) {
            const driveUrl = urls[i];
            console.log(`\n🔗 TENTATIVA ${i + 1}: ${driveUrl}`);

            try {
                // Fazer GET e pegar primeiros 512 bytes para diagnóstico
                const response = await fetch(driveUrl, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'Range': 'bytes=0-512'
                    },
                    redirect: 'follow'
                });

                console.log(`   Status: ${response.status}`);
                
                const contentType = response.headers.get('Content-Type');
                const contentLength = response.headers.get('Content-Length');
                
                console.log(`   Content-Type: ${contentType}`);
                console.log(`   Content-Length: ${contentLength}`);

                let isValidMp4 = false;
                let formatDetectado = 'DESCONHECIDO';
                let primeirosBytesHex = '';
                let textoInicialHTML = '';

                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    const bytes = new Uint8Array(buffer);
                    
                    // Verificar assinatura de arquivo
                    primeirosBytesHex = Array.from(bytes.slice(0, 32))
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join(' ');

                    console.log(`   Primeiros bytes: ${primeirosBytesHex}`);

                    // Se parece com HTML, tentar extrair mensagem de erro
                    if (bytes[0] === 0x3c) { // '<' em ASCII
                        const textoBuffer = new TextDecoder().decode(bytes.slice(0, 200));
                        textoInicialHTML = textoBuffer;
                        console.log(`   Texto inicial: ${textoBuffer.substring(0, 100)}`);
                    }

                    // Verificar assinatura MP4 (ftyp box)
                    if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x00 && 
                        (bytes[3] === 0x18 || bytes[3] === 0x20) && 
                        bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
                        isValidMp4 = true;
                        formatDetectado = 'MP4 VÁLIDO ✅';
                    } else if (primeirosBytesHex.startsWith('3c 21 44 4f')) {
                        formatDetectado = 'HTML (Google Drive error page) ❌';
                    } else if (primeirosBytesHex.startsWith('ff fb') || primeirosBytesHex.startsWith('ff fa')) {
                        formatDetectado = 'MP3 Audio ⚠️';
                    } else if (primeirosBytesHex.startsWith('ff d8 ff')) {
                        formatDetectado = 'JPEG Image ⚠️';
                    } else if (primeirosBytesHex.startsWith('89 50 4e 47')) {
                        formatDetectado = 'PNG Image ⚠️';
                    } else if (primeirosBytesHex.startsWith('1a 45 df a3')) {
                        formatDetectado = 'WebM/Matroska ⚠️';
                    }

                    resultados.push({
                        tentativa: i + 1,
                        url: driveUrl,
                        status: response.status,
                        contentType: contentType,
                        contentLength: contentLength,
                        bytesRecebidos: bytes.length,
                        primeirosBytesHex: primeirosBytesHex,
                        formatDetectado: formatDetectado,
                        isValidMp4: isValidMp4,
                        textoHTML: textoInicialHTML.substring(0, 150)
                    });

                    console.log(`   Formato: ${formatDetectado}`);
                    console.log(`   Bytes recebidos: ${bytes.length}`);

                    if (isValidMp4) {
                        console.log(`✅ SUCESSO: Arquivo é MP4 válido!`);
                    }
                } else {
                    resultados.push({
                        tentativa: i + 1,
                        url: driveUrl,
                        status: response.status,
                        erro: `HTTP ${response.status}`,
                        contentType: contentType,
                        contentLength: contentLength
                    });
                    console.log(`   ❌ HTTP ${response.status}`);
                }
            } catch (e) {
                console.log(`   ❌ Erro: ${e.message}`);
                resultados.push({
                    tentativa: i + 1,
                    url: driveUrl,
                    erro: e.message
                });
            }
        }

        // Verificar qual URL retorna MP4 válido
        const urlValida = resultados.find(r => r.isValidMp4);

        return new Response(JSON.stringify({
            sucesso: true,
            video: {
                nome: video.nome,
                id: video.id,
                tamanho: video.tamanho
            },
            urlValida: urlValida ? urlValida.url : null,
            mp4Encontrado: !!urlValida,
            diagnostico: resultados
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error(`❌ ERRO em handleVideoDiagnoseAuto: ${error.message}`);
        return new Response(JSON.stringify({
            sucesso: false,
            erro: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}

// ===== ENDPOINT: Diagnose vídeo - verifica se é MP4 válido =====
async function handleVideoDiagnose(env, corsHeaders, url) {
    try {
        const videoId = url.pathname.split('/api/video-diagnose/')[1];
        
        if (!videoId) {
            return new Response(JSON.stringify({ erro: "ID não fornecido" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        console.log(`🧪 DIAGNOSE: ${videoId}`);

        const videos = await buscarVideosDoGoogleDrive();
        const video = videos.find(v => v.id === videoId);

        if (!video) {
            return new Response(JSON.stringify({ erro: "Vídeo não encontrado" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Tentar múltiplas URLs
        const urls = [
            `https://drive.google.com/uc?export=download&id=${videoId}&confirm=t`,
            `https://drive.google.com/uc?id=${videoId}&export=download`,
            `https://lh3.googleusercontent.com/d/${videoId}?alt=media`
        ];

        const resultados = [];

        for (let i = 0; i < urls.length; i++) {
            const driveUrl = urls[i];
            console.log(`\n🔗 URL ${i + 1}: ${driveUrl}`);

            try {
                // Fazer GET e pegar primeiros 512 bytes para diagnóstico
                const response = await fetch(driveUrl, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'Range': 'bytes=0-512'
                    },
                    redirect: 'follow'
                });

                console.log(`   Status: ${response.status}`);
                
                const contentType = response.headers.get('Content-Type');
                const contentLength = response.headers.get('Content-Length');
                
                console.log(`   Content-Type: ${contentType}`);
                console.log(`   Content-Length: ${contentLength}`);

                let isValidMp4 = false;
                let formatDetectado = 'DESCONHECIDO';
                let primeirosBytesHex = '';

                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    const bytes = new Uint8Array(buffer);
                    
                    // Verificar assinatura de arquivo
                    primeirosBytesHex = Array.from(bytes.slice(0, 32))
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join(' ');

                    console.log(`   Primeiros bytes: ${primeirosBytesHex}`);

                    // Verificar assinatura MP4 (ftyp box)
                    if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x00 && 
                        (bytes[3] === 0x18 || bytes[3] === 0x20) && 
                        bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
                        isValidMp4 = true;
                        formatDetectado = 'MP4 VÁLIDO ✅';
                    } else if (primeirosBytesHex.startsWith('3c 21 44 4f')) {
                        formatDetectado = 'HTML (Google Drive error page) ❌';
                    } else if (primeirosBytesHex.startsWith('ff fb') || primeirosBytesHex.startsWith('ff fa')) {
                        formatDetectado = 'MP3 Audio ⚠️';
                    } else if (primeirosBytesHex.startsWith('ff d8 ff')) {
                        formatDetectado = 'JPEG Image ⚠️';
                    } else if (primeirosBytesHex.startsWith('89 50 4e 47')) {
                        formatDetectado = 'PNG Image ⚠️';
                    } else if (primeirosBytesHex.startsWith('1a 45 df a3')) {
                        formatDetectado = 'WebM/Matroska ⚠️';
                    }

                    resultados.push({
                        url: driveUrl,
                        status: response.status,
                        contentType: contentType,
                        contentLength: contentLength,
                        bytesRecebidos: bytes.length,
                        primeirosBytesHex: primeirosBytesHex,
                        formatDetectado: formatDetectado,
                        isValidMp4: isValidMp4
                    });

                    console.log(`   Formato: ${formatDetectado}`);
                    console.log(`   Bytes recebidos: ${bytes.length}`);

                    if (isValidMp4) {
                        console.log(`✅ DIAGNOSE SUCESSO: Arquivo é MP4 válido!`);
                    }
                } else {
                    resultados.push({
                        url: driveUrl,
                        status: response.status,
                        erro: 'HTTP Error',
                        contentType: contentType,
                        contentLength: contentLength
                    });
                    console.log(`   ❌ HTTP ${response.status}`);
                }
            } catch (e) {
                console.log(`   ❌ Erro: ${e.message}`);
                resultados.push({
                    url: driveUrl,
                    erro: e.message
                });
            }
        }

        // Verificar qual URL retorna MP4 válido
        const urlValida = resultados.find(r => r.isValidMp4);

        return new Response(JSON.stringify({
            sucesso: true,
            video: {
                nome: video.nome,
                id: video.id,
                tamanho: video.tamanho
            },
            urlValida: urlValida ? urlValida.url : null,
            diagnostico: resultados
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error(`❌ ERRO em handleVideoDiagnose: ${error.message}`);
        return new Response(JSON.stringify({
            sucesso: false,
            erro: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}

// ===== ENDPOINT: Video Stream Direto =====
// Proxy com cache para vídeos do Google Drive
async function handleVideoStream(env, corsHeaders, url) {
    try {
        const videoId = url.pathname.split('/api/video-stream/')[1];
        
        if (!videoId) {
            console.log('❌ Video ID não fornecido');
            return new Response(JSON.stringify({
                erro: "ID do vídeo não fornecido"
            }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        console.log(`🎥 Stream REQUEST: ${videoId}`);

        // ===== VERIFICAR CACHE =====
        if (env.DASHBOARD_KV) {
            const cacheKey = `video-${videoId}`;
            const videoCached = await env.DASHBOARD_KV.get(cacheKey, 'stream');

            if (videoCached) {
                console.log(`✅ Video CACHE HIT: ${videoId}`);
                return new Response(videoCached, {
                    status: 200,
                    headers: {
                        'Content-Type': 'video/mp4',
                        'Content-Length': videoCached.length.toString(),
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=604800',
                        'X-Cache': 'HIT'
                    }
                });
            } else {
                console.log(`❌ CACHE MISS para ${videoId}`);
            }
        }

        // ===== BUSCAR DO GOOGLE DRIVE =====
        console.log(`📥 Buscando ${videoId} do Google Drive...`);

        // Tentar múltiplas URLs
        const urls = [
            `https://drive.google.com/uc?export=download&id=${videoId}&confirm=t`,
            `https://drive.google.com/uc?id=${videoId}&export=download`,
            `https://lh3.googleusercontent.com/d/${videoId}?alt=media`
        ];

        let response = null;
        let usedUrl = '';
        let tentativas = 0;

        for (const driveUrl of urls) {
            tentativas++;
            try {
                console.log(`🔗 TENTATIVA ${tentativas}: ${driveUrl}`);
                response = await fetch(driveUrl, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://drive.google.com/',
                        'Accept': '*/*'
                    },
                    redirect: 'follow',
                    timeout: 10000
                });

                console.log(`   Status: ${response.status} ${response.statusText}`);
                console.log(`   Content-Type: ${response.headers.get('Content-Type')}`);
                console.log(`   Content-Length: ${response.headers.get('Content-Length')}`);

                if (response.ok) {
                    usedUrl = driveUrl;
                    console.log(`✅ SUCESSO na tentativa ${tentativas}`);
                    break;
                } else {
                    console.log(`❌ Falha HTTP ${response.status}`);
                }
            } catch (e) {
                console.log(`❌ Erro fetch: ${e.message}`);
                continue;
            }
        }

        if (!response || !response.ok) {
            console.error(`❌ TODAS URLs FALHARAM para ${videoId}`);
            console.error(`   Tentativas: ${tentativas}`);
            return new Response(JSON.stringify({
                erro: "Google Drive retornou erro",
                videoId: videoId,
                tentativas: tentativas
            }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const contentLength = response.headers.get('Content-Length');
        const contentType = response.headers.get('Content-Type') || 'video/mp4';

        console.log(`✅ STREAMING: ${videoId}`);
        console.log(`   Tamanho: ${contentLength} bytes`);
        console.log(`   Tipo: ${contentType}`);

        // ✅ FORÇAR video/mp4 sempre
        return new Response(response.body, {
            status: 200,
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': contentLength || '',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
                'Access-Control-Allow-Headers': 'Range, Content-Type',
                'Access-Control-Expose-Headers': 'Content-Length, Content-Type',
                'Cache-Control': 'public, max-age=3600',
                'Accept-Ranges': 'bytes',
                'Connection': 'keep-alive',
                'X-Cache': 'MISS',
                'X-Content-Type-Options': 'nosniff'
            }
        });

    } catch (error) {
        console.error(`❌ ERRO FATAL em handleVideoStream: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        return new Response(JSON.stringify({
            erro: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}
