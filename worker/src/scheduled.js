/**
 * ⏰ SCHEDULED WORKER - Busca inserções a cada 5 minutos
 * 
 * Propósito:
 * - Buscar inserções do Audiency UMA VEZ a cada 5 minutos
 * - Salvar no KV para o endpoint /api/dashboard usar
 * - Evitar sobrecarga da API Audiency
 * 
 * Resultado:
 * - Audiency: 1 requisição a cada 5 min (em vez de 100+ por min)
 * - Frontend: Resposta rápida sempre
 * - Zero timeout, zero retry loops
 */

export default {
    async scheduled(event, env, ctx) {
        // API Key vem via env.AUDIENCY_API_KEY (configurado via secret)
        const API_KEY = env.AUDIENCY_API_KEY;
        
        if (!API_KEY) {
            console.error(`❌ ERRO: API_KEY não configurada!`);
            console.error(`   Execute: wrangler secret put AUDIENCY_API_KEY`);
            return;
        }

        console.log(`\n${'='.repeat(120)}`);
        console.log(`⏰ SCHEDULED WORKER: Executando busca de inserções`);
        console.log(`   Timestamp: ${new Date().toISOString()}`);
        console.log(`${'='.repeat(120)}\n`);

        try {
            // 1️⃣ PEGAR DATA E HORA
            const now = new Date();
            const dataHoje = now.toISOString().split('T')[0];
            const horaAtual = String(now.getHours()).padStart(2, '0');
            const minutoAtual = String(now.getMinutes()).padStart(2, '0');

            console.log(`📅 Data: ${dataHoje}`);
            console.log(`🕐 Hora: ${horaAtual}:${minutoAtual}\n`);

            // 2️⃣ BUSCAR CAMPANHAS ATIVAS DO KV
            const dadosEstaticos = await env.DASHBOARD_KV.get(`dados-estaticos-${dataHoje}`);
            
            if (!dadosEstaticos) {
                console.warn(`⚠️ Dados estáticos não encontrados no KV`);
                return;
            }

            const { campanhasAtivas } = JSON.parse(dadosEstaticos);
            console.log(`🎯 ${campanhasAtivas.length} campanhas ativas encontradas\n`);

            // 3️⃣ BUSCAR INSERÇÕES DO AUDIENCY (com timeout agressivo)
            const todasInsercoes = [];
            const insercoesRecentes = [];
            let sucessos = 0;
            let erros = 0;

            // Processar em batches de 5 para não sobrecarregar Audiency
            const batchSize = 5;
            const batches = [];

            for (let i = 0; i < campanhasAtivas.length; i += batchSize) {
                batches.push(campanhasAtivas.slice(i, i + batchSize));
            }

            console.log(`📦 Processando ${batches.length} batches de ${batchSize} campanhas...\n`);

            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                const promises = [];

                // Fazer requisições em paralelo (5 por vez)
                for (const campanha of batch) {
                    const promise = (async () => {
                        try {
                            const url = `https://api.audiency.io/advertiser-rest/reports/common/advertiser-execution?page=1&limit=500&countryId=1&campaignId=${campanha.id}&stationDate=${dataHoje}&stationDate=${dataHoje}`;

                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout por requisição

                            const response = await fetch(url, {
                                headers: { 
                                    "accept": "application/json", 
                                    "apiKey": API_KEY 
                                },
                                signal: controller.signal
                            });

                            clearTimeout(timeoutId);

                            if (response.ok) {
                                const data = await response.json();
                                const items = data?.data?.lines || [];

                                items.forEach(insercao => {
                                    const cidade = insercao.state?.name || insercao.city?.name || '';
                                    
                                    // Filtro básico: só com cidade
                                    if (cidade.trim() !== '') {
                                        todasInsercoes.push(insercao);
                                        
                                        // Inserções recentes: mesma hora ou máximo 1h atrás
                                        const horaInsercao = insercao.hour;
                                        const horaInserNum = parseInt(horaInsercao);
                                        
                                        if (horaInserNum >= parseInt(horaAtual) - 1) {
                                            insercoesRecentes.push(insercao);
                                        }
                                    }
                                });

                                sucessos++;
                                console.log(`   ✅ ${campanha.name}: ${items.length} items`);
                            } else {
                                erros++;
                                console.log(`   ⚠️ ${campanha.name}: Status ${response.status}`);
                            }
                        } catch (error) {
                            erros++;
                            console.log(`   ❌ ${campanha.name}: ${error.message}`);
                        }
                    })();

                    promises.push(promise);
                }

                // Aguardar todas as requisições do batch
                await Promise.all(promises);

                // Delay entre batches (respeitar API Audiency)
                if (batchIndex < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                console.log(`   Batch ${batchIndex + 1}/${batches.length} concluído\n`);
            }

            console.log(`\n✨ Resumo:`);
            console.log(`   Campanhas: ${sucessos} OK, ${erros} erro`);
            console.log(`   Total inserções: ${todasInsercoes.length}`);
            console.log(`   Inserções recentes: ${insercoesRecentes.length}\n`);

            // 4️⃣ SALVAR INSERÇÕES NO KV
            const cacheData = {
                todasInsercoes,
                insercoesRecentes,
                timestamp: Date.now(),
                dataHoje,
                horaAtual,
                minutoAtual
            };

            await env.DASHBOARD_KV.put(
                `insercoes-cache-${dataHoje}`,
                JSON.stringify(cacheData),
                { expirationTtl: 600 } // 10 minutos (cobre o período até próxima execução + buffer)
            );

            console.log(`💾 ✅ Inserções salvas no KV com validade de 10 minutos\n`);
            console.log(`${'='.repeat(120)}\n`);

        } catch (error) {
            console.error(`\n❌ ERRO NO SCHEDULED WORKER:\n`, error);
            console.error(`${'='.repeat(120)}\n`);
        }
    }
};
