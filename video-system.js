/**
 * 🎬 SISTEMA DE CICLO: DASHBOARD ↔ VÍDEOS
 * Pré-carregamento durante Dashboard para sessão de vídeos perfeita
 * 
 * Estratégia:
 * - Dashboard (60s): Pré-carrega TODOS os vídeos da próxima sessão
 * - Vídeos (180s): Reproduz vídeos já carregados, zero travamentos
 * - Repetir indefinidamente
 */

const VIDEO_CONFIG = {
    // Timing (em milisegundos)
    DASHBOARD_DURATION: 10 * 60 * 1000,     // 10 minutos para pré-carregar vídeos
    VIDEO_CYCLE_DURATION: 3 * 60 * 1000,    // 3 minutos de vídeos
    SINGLE_VIDEO_DURATION: 25000,            // ~25 segundos por vídeo (duração média estimada)
    
    // Configurações
    ENABLED: true,
    AUTO_LOOP: true,
    LOG_CHANGES: true,
    PRELOAD_BUFFER: 2                        // Número de vídeos a pré-carregar
};

class VideoAutoPlaySystem {
    constructor() {
        this.videos = [];                    // Todos os vídeos do Drive
        this.currentCycleSongs = [];         // Vídeos da ciclo atual
        this.currentVideoIndex = 0;          // Índice na ciclo atual
        this.isPlaying = false;
        this.currentMode = 'dashboard';      // 'dashboard' ou 'videos'
        this.cycleStartTime = null;
        this.videoCycleEndTime = null;
        this.cycleTimer = null;
        this.videoCheckInterval = null;
        this.dashboardCheckInterval = null;  // Monitor durante dashboard
        this.primaryVideo = null;            // Elemento principal
        this.preloadVideo = null;            // Elemento pré-carregado
        this.usePrimary = true;              // Flag para saber qual tá tocando
        this.videoCache = new Map();         // Cache de vídeos pré-carregados
        this.nextCycleSongs = [];            // Vídeos selecionados para próxima sessão
        this.preloadProgress = 0;            // Progresso de pré-carregamento
        this.lastUsedVideos = [];            // Histórico dos últimos vídeos usados
    }

    /**
     * Inicializar o sistema
     */
    async init() {
        console.log(`🎬 [VIDEO-SYSTEM] Inicializando ciclo Dashboard ↔ Vídeos...`);
        
        try {
            // Carregar vídeos da API
            console.log(`🎬 [VIDEO-SYSTEM] Carregando vídeos do Google Drive...`);
            const videosCarregados = await this.loadVideos();
            
            if (videosCarregados && this.videos.length > 0) {
                console.log(`✅ [VIDEO-SYSTEM] ${this.videos.length} vídeos carregados!`);
                console.log(`⏱️  Ciclo: ${VIDEO_CONFIG.DASHBOARD_DURATION/1000}s Dashboard → ${VIDEO_CONFIG.VIDEO_CYCLE_DURATION/1000}s Vídeos → Repetir`);
                
                // Inicializar elementos de vídeo
                this.initVideoElements();
                
                // Iniciar ciclo no Dashboard
                this.currentMode = 'dashboard';
                this.cycleStartTime = Date.now();
                console.log(`📊 [VIDEO-SYSTEM] Iniciando com DASHBOARD`);
                console.log(`⏳ [VIDEO-SYSTEM] Iniciando pré-carregamento de vídeos para próxima sessão...`);
                
                // Iniciar pré-carregamento durante dashboard
                this.startDashboardPreload();
                
                // Agendar transição para vídeos
                this.scheduleNextTransition();
                
                console.log(`✅ [VIDEO-SYSTEM] Sistema pronto! 🚀`);
            } else {
                console.warn(`❌ [VIDEO-SYSTEM] Nenhum vídeo disponível`);
            }
        } catch (error) {
            console.error(`❌ [VIDEO-SYSTEM] Erro ao inicializar:`, error.message);
        }
    }

    /**
     * Inicializar elementos de vídeo
     */
    initVideoElements() {
        this.primaryVideo = document.getElementById('video-player');
        this.preloadVideo = document.getElementById('video-preload');
        
        if (!this.primaryVideo || !this.preloadVideo) {
            console.error(`❌ Elementos de vídeo não encontrados`);
            return;
        }
        
        console.log(`✅ Elementos de vídeo inicializados`);
    }

    /**
     * Iniciar pré-carregamento durante Dashboard
     */
    startDashboardPreload() {
        if (this.dashboardCheckInterval) {
            clearInterval(this.dashboardCheckInterval);
        }

        // Selecionar vídeos para próxima sessão AGORA
        const numVideosNecessarios = Math.ceil(VIDEO_CONFIG.VIDEO_CYCLE_DURATION / VIDEO_CONFIG.SINGLE_VIDEO_DURATION);
        this.nextCycleSongs = this.getRandomVideos(numVideosNecessarios);
        console.log(`📋 Próxima sessão: ${this.nextCycleSongs.length} vídeos selecionados`);

        // Começar a pré-carregar
        this.preloadProgress = 0;
        this.startPreloadingVideos(this.nextCycleSongs);

        // Monitor de progresso (log a cada 10 segundos)
        this.dashboardCheckInterval = setInterval(() => {
            const porcentagem = Math.round((this.preloadProgress / this.nextCycleSongs.length) * 100);
            if (porcentagem > 0 && porcentagem < 100) {
                console.log(`⏳ Pré-carregamento: ${this.preloadProgress}/${this.nextCycleSongs.length} (${porcentagem}%)`);
            }
        }, 10000);
    }

    /**
     * Pré-carregar todos os vídeos da lista
     */
    async startPreloadingVideos(videoList) {
        console.log(`🎬 Iniciando pré-carregamento de ${videoList.length} vídeos...`);
        
        for (let i = 0; i < videoList.length; i++) {
            const videoData = videoList[i];
            
            // Verificar se já está em cache
            if (this.videoCache.has(videoData.id)) {
                console.log(`✅ ${i + 1}/${videoList.length} - Em cache: ${videoData.nome}`);
                this.preloadProgress++;
                continue;
            }
            
            // Pré-carregar
            await this.cacheVideo(videoData, i, videoList.length);
            this.preloadProgress++;
        }
        
        console.log(`✅ PRÉ-CARREGAMENTO COMPLETO! ${this.videoCache.size} vídeos prontos`);
    }

    /**
     * Fazer cache de um vídeo (download real para garantir que está pronto)
     */
    cacheVideo(videoData, index, total) {
        return new Promise((resolve) => {
            try {
                const videoUrl = videoData.urlVideo;
                console.log(`📥 ${index + 1}/${total} Fazendo download: ${videoData.nome}...`);
                
                // Fazer download real do vídeo
                fetch(videoUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Status ${response.status}`);
                        }
                        
                        // Ler como blob
                        return response.blob();
                    })
                    .then(blob => {
                        // Criar blob URL para reprodução instantânea
                        const blobUrl = URL.createObjectURL(blob);
                        
                        // Armazenar com URL local
                        this.videoCache.set(videoData.id, {
                            ...videoData,
                            urlVideo: blobUrl, // Substituir URL remota por blob URL
                            originalUrl: videoUrl,
                            cached: true,
                            size: blob.size,
                            timestamp: Date.now()
                        });
                        
                        console.log(`✅ ${index + 1}/${total} Pronto: ${videoData.nome} (${this.formatBytes(blob.size)})`);
                        resolve();
                    })
                    .catch(error => {
                        console.warn(`⚠️  ${index + 1}/${total} Erro: ${videoData.nome} - ${error.message}`);
                        // Registrar mesmo com erro, pode tentar usar URL original depois
                        this.videoCache.set(videoData.id, {
                            ...videoData,
                            cached: false,
                            error: error.message
                        });
                        resolve();
                    });
                
            } catch (error) {
                console.error(`❌ Erro ao cachear vídeo:`, error.message);
                resolve();
            }
        });
    }

    /**
     * Formatar bytes para formato legível
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
    async loadVideos() {
        try {
            const apiUrl = 'https://dashboard-radio-worker.kaike-458.workers.dev/api/videos';
            console.log(`📡 [VIDEO-SYSTEM] Fetching: ${apiUrl}`);
            
            const response = await fetch(apiUrl);
            console.log(`📡 [VIDEO-SYSTEM] Status: ${response.status}`);
            
            const data = await response.json();
            
            if (data.sucesso && data.videos && data.videos.length > 0) {
                this.videos = data.videos;
                console.log(`✅ [VIDEO-SYSTEM] ${this.videos.length} vídeos carregados da API`);
                return true;
            } else {
                console.warn(`❌ [VIDEO-SYSTEM] Resposta sem vídeos`);
                return false;
            }
        } catch (error) {
            console.error(`❌ [VIDEO-SYSTEM] Erro ao carregar vídeos:`, error.message);
            return false;
        }
    }

    /**
     * Agendar próxima transição (Dashboard → Vídeos ou Vídeos → Dashboard)
     */
    scheduleNextTransition() {
        if (this.cycleTimer) {
            clearTimeout(this.cycleTimer);
        }

        const duracao = this.currentMode === 'dashboard' 
            ? VIDEO_CONFIG.DASHBOARD_DURATION 
            : VIDEO_CONFIG.VIDEO_CYCLE_DURATION;

        console.log(`⏱️  [VIDEO-SYSTEM] Próxima transição em ${duracao/1000}s (modo: ${this.currentMode})`);

        this.cycleTimer = setTimeout(() => {
            if (this.currentMode === 'dashboard') {
                console.log(`🎬 [VIDEO-SYSTEM] Transição: Dashboard → VÍDEOS`);
                this.startVideosCycle();
            } else {
                console.log(`📊 [VIDEO-SYSTEM] Transição: Vídeos → DASHBOARD`);
                this.stopVideosCycle();
                this.currentMode = 'dashboard';
                
                // 🎲 NOVO: Selecionar NOVOS vídeos aleatórios para próximo ciclo
                console.log(`🎲 [VIDEO-SYSTEM] Selecionando novos vídeos aleatórios para próximo ciclo...`);
                const numVideosNecessarios = Math.ceil(VIDEO_CONFIG.VIDEO_CYCLE_DURATION / VIDEO_CONFIG.SINGLE_VIDEO_DURATION);
                this.nextCycleSongs = this.getRandomVideos(numVideosNecessarios);
                console.log(`📋 Próximo ciclo: ${this.nextCycleSongs.length} vídeos novos selecionados`);
                
                // 🎲 NOVO: Começar a pré-carregar os novos vídeos
                this.preloadProgress = 0;
                this.startPreloadingVideos(this.nextCycleSongs);
                
                this.scheduleNextTransition();
            }
        }, duracao);
    }

    /**
     * Iniciar ciclo de vídeos aleatórios (3 minutos)
     */
    async startVideosCycle() {
        console.log(`🎬 [VIDEO-SYSTEM] Iniciando ciclo de VÍDEOS (3 minutos)...`);
        console.log(`✅ Usando ${this.nextCycleSongs.length} vídeos pré-carregados`);
        
        // Para a monitoração do dashboard
        if (this.dashboardCheckInterval) {
            clearInterval(this.dashboardCheckInterval);
        }
        
        // Usar os vídeos que foram pré-carregados e embaralhá-los com Fisher-Yates
        this.currentCycleSongs = [...this.nextCycleSongs];
        
        // Fisher-Yates shuffle (melhor que sort random)
        for (let i = this.currentCycleSongs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.currentCycleSongs[i], this.currentCycleSongs[j]] = [this.currentCycleSongs[j], this.currentCycleSongs[i]];
        }
        
        if (this.currentCycleSongs.length === 0) {
            console.warn(`⚠️  Nenhum vídeo disponível`);
            return;
        }
        
        console.log(`🎲 [VIDEO-SYSTEM] Vídeos embaralhados para reprodução aleatória`);
        const nomeVideos = this.currentCycleSongs.map((v, i) => `${i+1}. ${v.nome}`).join(', ');
        console.log(`📋 Ordem de reprodução: ${nomeVideos}`);
        
        this.currentVideoIndex = 0;
        this.currentMode = 'videos';
        this.videoCycleEndTime = Date.now() + VIDEO_CONFIG.VIDEO_CYCLE_DURATION;
        this.usePrimary = true;
        
        // Mostrar overlay
        const overlay = document.getElementById('video-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.classList.add('show');
        }
        
        // Começar a tocar o primeiro vídeo (já está pré-carregado)
        console.log(`▶️  [VIDEO-SYSTEM] Iniciando reprodução dos vídeos pré-carregados...`);
        this.playVideo(this.currentCycleSongs[this.currentVideoIndex]);
        
        // Monitorar progresso do ciclo
        if (this.videoCheckInterval) {
            clearInterval(this.videoCheckInterval);
        }
        this.videoCheckInterval = setInterval(() => {
            this.checkVideoCycleProgress();
        }, 1000);
    }

    /**
     * Parar ciclo de vídeos e retornar ao Dashboard
     */
    stopVideosCycle() {
        console.log(`📊 [VIDEO-SYSTEM] Encerrando ciclo de vídeos`);
        
        if (this.videoCheckInterval) {
            clearInterval(this.videoCheckInterval);
        }
        
        // Ocultar overlay
        const overlay = document.getElementById('video-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('show');
        }
        
        // Pausar ambos vídeos
        if (this.primaryVideo) {
            this.primaryVideo.pause();
            this.primaryVideo.currentTime = 0;
        }
        if (this.preloadVideo) {
            this.preloadVideo.pause();
            this.preloadVideo.currentTime = 0;
        }
        
        this.currentCycleSongs = [];
        this.currentVideoIndex = 0;
    }

    /**
     * Obter array de vídeos aleatórios (evitando repetição)
     * Fisher-Yates shuffle com histórico de vídeos usados
     */
    getRandomVideos(count) {
        console.log(`🎲 [VIDEO-SYSTEM] getRandomVideos() chamado: count=${count}, total de vídeos=${this.videos.length}`);
        
        // Filtrar vídeos que NÃO foram usados recentemente (últimos 20 vídeos)
        const videosDisponiveis = this.videos.filter(v => !this.lastUsedVideos.includes(v.id));
        console.log(`🎲 [VIDEO-SYSTEM] Vídeos disponíveis (não usados recentemente): ${videosDisponiveis.length}`);
        
        // Se não há vídeos novos, limpar histórico e usar todos
        if (videosDisponiveis.length < count) {
            console.log(`⚠️ [VIDEO-SYSTEM] Reciclando histórico - já usou ${this.lastUsedVideos.length} vídeos`);
            this.lastUsedVideos = [];
        }
        
        // Fisher-Yates shuffle (melhor que sort random)
        const pool = videosDisponiveis.length > 0 ? [...videosDisponiveis] : [...this.videos];
        console.log(`🎲 [VIDEO-SYSTEM] Pool antes do shuffle: ${pool.length} vídeos`);
        
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        
        console.log(`🎲 [VIDEO-SYSTEM] Pool após shuffle: ${pool.length} vídeos`);
        
        const selecionados = pool.slice(0, count);
        
        // Guardar IDs dos vídeos usados no histórico
        const idsParaExibir = selecionados.map(v => `${v.id}:${v.nome}`).join(', ');
        console.log(`🎲 [VIDEO-SYSTEM] Vídeos selecionados: ${idsParaExibir}`);
        
        selecionados.forEach(v => {
            this.lastUsedVideos.push(v.id);
            // Limitar histórico a 20 últimos vídeos
            if (this.lastUsedVideos.length > 20) {
                this.lastUsedVideos.shift();
            }
        });
        
        console.log(`🎲 [VIDEO-SYSTEM] ${count} vídeos selecionados (${this.lastUsedVideos.length} no histórico)`);
        return selecionados;
    }

    /**
     * Reproduzir um vídeo específico (já pré-carregado)
     */
    playVideo(videoData) {
        // Determinar qual elemento usar (alterna entre primary e preload)
        const currentElement = this.usePrimary ? this.primaryVideo : this.preloadVideo;
        const videoSource = this.usePrimary ? document.getElementById('video-source') : document.getElementById('video-preload-source');
        
        if (!currentElement || !videoSource) {
            console.error(`❌ Elementos de vídeo não encontrados`);
            return;
        }

        // Usar URL em cache se disponível (blob URL)
        let videoUrl = videoData.urlVideo;
        const cached = this.videoCache.get(videoData.id);
        if (cached && cached.urlVideo) {
            videoUrl = cached.urlVideo;
            console.log(`💾 Usando vídeo em cache (blob URL)`);
        }

        console.log(`▶️  [VIDEO-SYSTEM] ${this.currentVideoIndex + 1}/${this.currentCycleSongs.length}: ${videoData.nome}`);
        
        // Se estamos trocando, fazer fade out do antigo
        const otherElement = this.usePrimary ? this.preloadVideo : this.primaryVideo;
        if (otherElement && otherElement.style.display !== 'none') {
            otherElement.classList.add('fade-out');
            setTimeout(() => {
                otherElement.style.display = 'none';
                otherElement.classList.remove('fade-out');
            }, 300);
        }
        
        // Carregar vídeo (blob URL é instantâneo)
        videoSource.src = videoUrl;
        currentElement.load();
        
        // Mostrar o elemento
        currentElement.style.display = 'block';
        currentElement.classList.remove('fade-out');
        currentElement.classList.add('fade-in');
        
        // Reproduzir com retry em caso de erro
        const attemptPlay = () => {
            const playPromise = currentElement.play();
            if (playPromise !== undefined) {
                playPromise
                    .catch(error => {
                        console.warn(`⚠️  Erro ao reproduzir (tentativa 1):`, error.message);
                        // Tentar novamente após 500ms
                        setTimeout(() => {
                            const retryPromise = currentElement.play();
                            if (retryPromise !== undefined) {
                                retryPromise.catch(err => {
                                    console.warn(`⚠️  Erro ao reproduzir (tentativa 2):`, err.message);
                                    // Pular para próximo vídeo
                                    setTimeout(() => this.playNextVideoInCycle(), 1000);
                                });
                            }
                        }, 500);
                    });
            }
        };
        
        attemptPlay();
        
        // Event listener para quando vídeo terminar
        currentElement.onended = () => {
            console.log(`⏹️  Vídeo finalizado`);
            this.playNextVideoInCycle();
        };
        
        // Pré-carregar próximo vídeo no buffer
        const nextIndex = this.currentVideoIndex + 1;
        if (nextIndex < this.currentCycleSongs.length) {
            setTimeout(() => {
                const nextVideo = this.currentCycleSongs[nextIndex];
                const nextCached = this.videoCache.get(nextVideo.id);
                const nextUrl = (nextCached && nextCached.urlVideo) ? nextCached.urlVideo : nextVideo.urlVideo;
                
                const preloadElem = this.usePrimary ? this.preloadVideo : this.primaryVideo;
                const preloadSource = this.usePrimary ? 
                    document.getElementById('video-preload-source') : 
                    document.getElementById('video-source');
                
                if (preloadSource) {
                    preloadSource.src = nextUrl;
                    preloadElem.load();
                    console.log(`⏳ Buffer pré-carregado: ${nextIndex + 1}/${this.currentCycleSongs.length}`);
                }
            }, 500);
        }
    }

    /**
     * Passar para próximo vídeo na ciclo
     */
    playNextVideoInCycle() {
        this.currentVideoIndex++;
        this.usePrimary = !this.usePrimary; // Alterna qual elemento usar
        
        // Verificar se ainda há tempo para mais vídeos
        const tempoRestante = this.videoCycleEndTime - Date.now();
        
        // Se o tempo acabou ou não há mais vídeos, aguardar a transição automática
        if (this.currentVideoIndex >= this.currentCycleSongs.length || tempoRestante <= 0) {
            console.log(`✅ Fim da ciclo de vídeos (${this.currentVideoIndex}/${this.currentCycleSongs.length} vídeos, ${tempoRestante/1000}s restantes)`);
            // Aguardar o cycleTimer fazer a transição automaticamente
            if (this.primaryVideo) this.primaryVideo.pause();
            if (this.preloadVideo) this.preloadVideo.pause();
            return;
        }
        
        console.log(`📊 Próximo vídeo em ${tempoRestante/1000}s`);
        this.playVideo(this.currentCycleSongs[this.currentVideoIndex]);
    }

    /**
     * Verificar progresso do ciclo de vídeos
     */
    checkVideoCycleProgress() {
        if (this.currentMode !== 'videos') return;
        
        const tempoRestante = this.videoCycleEndTime - Date.now();
        
        // Se o tempo acabou, forçar transição para dashboard
        if (tempoRestante <= 0) {
            console.log(`⏰ [VIDEO-SYSTEM] ⏹️ TEMPO DE CICLO EXPIRADO - Forçando transição para Dashboard`);
            if (this.videoCheckInterval) {
                clearInterval(this.videoCheckInterval);
            }
            
            // Parar vídeos
            if (this.primaryVideo) this.primaryVideo.pause();
            if (this.preloadVideo) this.preloadVideo.pause();
            
            // Ocultar overlay
            const overlay = document.getElementById('video-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.classList.remove('show');
            }
            
            // Voltar para Dashboard
            this.currentMode = 'dashboard';
            this.currentCycleSongs = [];
            this.currentVideoIndex = 0;
            
            // Agendar próxima transição
            this.scheduleNextTransition();
            return;
        }
    }

    /**
     * Obter status
     */
    getStatus() {
        return {
            modo: this.currentMode,
            videosCarregados: this.videos.length,
            videosNaCiclo: this.currentCycleSongs.length,
            videoAtual: this.currentVideoIndex + 1,
            isPlaying: this.isPlaying,
            tempoDecorrido: Math.floor((Date.now() - this.cycleStartTime) / 1000) + 's'
        };
    }
}

// Exportar globalmente
window.videoSystem = new VideoAutoPlaySystem();

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log(`🎬 [VIDEO-SYSTEM] DOMContentLoaded - Inicializando...`);
        window.videoSystem.init();
    });
} else {
    console.log(`🎬 [VIDEO-SYSTEM] DOM já carregado - Inicializando...`);
    window.videoSystem.init();
}
