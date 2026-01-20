/**
 * 🎬 SISTEMA DE AUTO-PLAY DE VÍDEOS (BACKGROUND MODE)
 * Reproduz vídeos em background sem nenhum layout visível
 * Apenas rodando continuamente, invisível para o usuário
 */

const VIDEO_CONFIG = {
    // Timing (em milisegundos)
    VIDEO_DURATION: 3 * 60 * 1000,      // 3 minutos por vídeo
    
    // Modo de operação
    MODE: 'background',                  // 'background' = invisível, rodando continuamente
    ENABLED: true,
    PRELOAD: true,
    AUTO_LOOP: true,
    
    // Audio (silencioso por padrão em background)
    MUTED: true,                         // true = sem som, false = com som
    VOLUME: 0,                           // 0-1, ignorado se MUTED=true
    
    // Logging
    LOG_CHANGES: true                    // Log quando muda de vídeo
};

class VideoAutoPlaySystem {
    constructor() {
        this.videos = [];
        this.currentVideoIndex = 0;
        this.isPlaying = false;
        this.videoElement = null;
        this.lastVideoUrl = null;
        this.startTime = Date.now();
    }

    /**
     * Inicializar o sistema de vídeos em background mode
     */
    async init() {
        console.log(`🎬 [VIDEO-SYSTEM] Inicializando em BACKGROUND MODE...`);
        
        try {
            // 1. Carregar vídeos da API
            console.log(`🎬 [VIDEO-SYSTEM] Etapa 1: Carregando vídeos...`);
            const videosCarregados = await this.loadVideos();
            
            if (videosCarregados && this.videos.length > 0) {
                console.log(`✅ [VIDEO-SYSTEM] ${this.videos.length} vídeos carregados`);
                
                // 2. Criar elemento <video> invisível
                console.log(`🎬 [VIDEO-SYSTEM] Etapa 2: Criando elemento de vídeo (invisível)...`);
                this.createHiddenVideoElement();
                
                // 3. Iniciar reprodução contínua
                console.log(`🎬 [VIDEO-SYSTEM] Etapa 3: Iniciando reprodução contínua...`);
                this.startContinuousPlayback();
                
                console.log(`✅ [VIDEO-SYSTEM] Inicialização completa!`);
                console.log(`   Sistema rodando em background. Auto-play: ATIVO ✨`);
            } else {
                console.warn(`❌ [VIDEO-SYSTEM] Nenhum vídeo disponível`);
            }
        } catch (error) {
            console.error(`❌ [VIDEO-SYSTEM] Erro ao inicializar:`, error.message);
        }
    }

    /**
     * Carregar vídeos da API
     */
    async loadVideos() {
        try {
            console.log(`🎬 [VIDEO-SYSTEM] Chamando API de vídeos...`);
            const apiUrl = 'https://dashboard-radio-worker.kaike-458.workers.dev/api/videos';
            
            const response = await fetch(apiUrl);
            console.log(`🎬 [VIDEO-SYSTEM] Status: ${response.status}`);
            
            const data = await response.json();
            
            if (data.sucesso && data.videos && data.videos.length > 0) {
                this.videos = data.videos;
                console.log(`✅ [VIDEO-SYSTEM] ${this.videos.length} vídeos carregados:`);
                this.videos.slice(0, 3).forEach((v, i) => {
                    console.log(`   ${i+1}. ${v.nome}`);
                });
                if (this.videos.length > 3) {
                    console.log(`   ... e mais ${this.videos.length - 3}`);
                }
                return true;
            } else {
                console.warn(`❌ [VIDEO-SYSTEM] Resposta sem vídeos`);
                return false;
            }
        } catch (error) {
            console.error(`❌ [VIDEO-SYSTEM] Erro ao carregar:`, error.message);
            return false;
        }
    }

    /**
     * Criar elemento <video> invisível no DOM
     */
    createHiddenVideoElement() {
        let videoElement = document.getElementById('video-autoplay-bg');
        
        if (!videoElement) {
            videoElement = document.createElement('video');
            videoElement.id = 'video-autoplay-bg';
            
            // Configuração CSS para ficar invisível
            videoElement.style.display = 'none';
            videoElement.style.visibility = 'hidden';
            videoElement.style.position = 'fixed';
            videoElement.style.zIndex = '-9999';
            videoElement.style.width = '0px';
            videoElement.style.height = '0px';
            
            // Atributos de reprodução
            videoElement.setAttribute('playsinline', '');
            videoElement.setAttribute('webkit-playsinline', '');
            videoElement.muted = VIDEO_CONFIG.MUTED;
            videoElement.volume = 0;
            
            // Event listeners
            videoElement.addEventListener('ended', () => this.onVideoEnded());
            videoElement.addEventListener('error', (e) => {
                console.warn(`⚠️ [VIDEO-SYSTEM] Erro ao reproduzir vídeo:`, e.target.error?.message);
                this.playNextVideo();
            });
            videoElement.addEventListener('playing', () => {
                if (VIDEO_CONFIG.LOG_CHANGES) {
                    console.log(`▶️ [VIDEO-SYSTEM] Reprodução iniciada`);
                }
            });
            
            // Adicionar ao DOM
            document.body.appendChild(videoElement);
            console.log(`✅ [VIDEO-SYSTEM] <video> invisível adicionado ao DOM`);
        }
        
        this.videoElement = videoElement;
    }

    /**
     * Iniciar reprodução contínua
     */
    startContinuousPlayback() {
        if (this.videos.length === 0) {
            console.warn(`⚠️ [VIDEO-SYSTEM] Nenhum vídeo para reproduzir`);
            return;
        }
        
        console.log(`🎬 [VIDEO-SYSTEM] Iniciando reprodução contínua...`);
        this.playNextVideo();
    }

    /**
     * Reproduzir próximo vídeo
     */
    playNextVideo() {
        if (!this.videoElement || this.videos.length === 0) {
            console.warn(`⚠️ [VIDEO-SYSTEM] Elemento ou vídeos não disponíveis`);
            return;
        }

        const videoData = this.videos[this.currentVideoIndex];
        const videoUrl = videoData.urlVideo;
        
        if (VIDEO_CONFIG.LOG_CHANGES) {
            console.log(`🎬 [VIDEO-SYSTEM] ${this.currentVideoIndex + 1}/${this.videos.length}: ${videoData.nome}`);
        }
        
        // Criar ou atualizar source element
        let sourceElement = this.videoElement.querySelector('source');
        if (!sourceElement) {
            sourceElement = document.createElement('source');
            sourceElement.type = 'video/mp4';
            this.videoElement.appendChild(sourceElement);
        }
        
        sourceElement.src = videoUrl;
        this.videoElement.load();
        
        // Reproduzir
        const playPromise = this.videoElement.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn(`⚠️ [VIDEO-SYSTEM] Erro ao reproduzir:`, error.message);
                // Tentar próximo após 2 segundos
                setTimeout(() => this.playNextVideo(), 2000);
            });
        }
        
        // Avançar para próximo
        this.currentVideoIndex = (this.currentVideoIndex + 1) % this.videos.length;
        this.isPlaying = true;
    }

    /**
     * Callback quando vídeo termina
     */
    onVideoEnded() {
        if (VIDEO_CONFIG.LOG_CHANGES) {
            console.log(`⏹️ [VIDEO-SYSTEM] Vídeo finalizado`);
        }
        this.playNextVideo();
    }

    /**
     * Pausar sistema
     */
    pause() {
        if (this.videoElement) {
            this.videoElement.pause();
            this.isPlaying = false;
            console.log(`⏸️ [VIDEO-SYSTEM] Pausado`);
        }
    }

    /**
     * Retomar sistema
     */
    resume() {
        if (this.videoElement && this.isPlaying === false) {
            this.videoElement.play().catch(err => {
                console.warn(`⚠️ [VIDEO-SYSTEM] Erro ao retomar:`, err.message);
            });
            this.isPlaying = true;
            console.log(`▶️ [VIDEO-SYSTEM] Retomado`);
        }
    }

    /**
     * Parar sistema
     */
    stop() {
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.currentTime = 0;
            this.isPlaying = false;
            console.log(`⏹️ [VIDEO-SYSTEM] Parado`);
        }
    }

    /**
     * Mutar/desmutar
     */
    setMuted(muted) {
        if (this.videoElement) {
            this.videoElement.muted = muted;
        }
    }

    /**
     * Obter status
     */
    getStatus() {
        const duracaoAtual = this.videoElement?.duration || 0;
        const tempoAtual = this.videoElement?.currentTime || 0;
        
        return {
            modo: 'background',
            videosCarregados: this.videos.length,
            videoAtual: this.currentVideoIndex,
            isPlaying: this.isPlaying,
            muted: this.videoElement?.muted,
            tempoAtual: this.formatTime(tempoAtual),
            duracao: this.formatTime(duracaoAtual),
            uptime: `${Math.floor((Date.now() - this.startTime) / 1000)}s`
        };
    }

    /**
     * Formatar tempo
     */
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
}

// Exportar globalmente
window.videoSystem = new VideoAutoPlaySystem();

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.videoSystem.init();
    });
} else {
    window.videoSystem.init();
}
            
            if (videosCarregados && this.videos.length > 0) {
                console.log(`✅ [VIDEO-SYSTEM] Etapa 1 OK: ${this.videos.length} vídeos disponíveis`);
                console.log(`🎬 [VIDEO-SYSTEM] Etapa 2: Iniciando ciclo...`);
                this.startCycle();
                
                console.log(`🎬 [VIDEO-SYSTEM] Etapa 3: Iniciando countdown...`);
                this.startCountdown();
                
                console.log(`✅ [VIDEO-SYSTEM] Inicialização completa!`);
            } else {
                console.warn(`❌ [VIDEO-SYSTEM] Nenhum vídeo disponível`);
            }
        } catch (error) {
            console.error(`❌ [VIDEO-SYSTEM] Erro ao inicializar:`, error.message);
            console.error(error.stack);
        }
    }

    /**
     * Carregar vídeos da API
     */
    async loadVideos() {
        try {
            console.log(`🎬 [VIDEO-SYSTEM] Chamando API de vídeos...`);
            // Usar URL absoluta do worker do Cloudflare
            const apiUrl = 'https://dashboard-radio-worker.kaike-458.workers.dev/api/videos';
            console.log(`🎬 [VIDEO-SYSTEM] URL da API: ${apiUrl}`);
            
            const response = await fetch(apiUrl);
            console.log(`🎬 [VIDEO-SYSTEM] Resposta recebida, status: ${response.status}`);
            console.log(`🎬 [VIDEO-SYSTEM] Content-Type: ${response.headers.get('content-type')}`);
            
            const data = await response.json();
            console.log(`🎬 [VIDEO-SYSTEM] JSON parseado:`, data);
            
            if (data.sucesso && data.videos && data.videos.length > 0) {
                this.videos = data.videos;
                console.log(`✅ [VIDEO-SYSTEM] ${this.videos.length} vídeos carregados:`);
                this.videos.forEach((v, i) => {
                    console.log(`   ${i+1}. ${v.nome} (${v.tamanho})`);
                });
                return true;
            } else {
                console.warn(`❌ [VIDEO-SYSTEM] Resposta sem vídeos:`, data);
                return false;
            }
        } catch (error) {
            console.error(`❌ [VIDEO-SYSTEM] Erro ao carregar vídeos:`, error.message);
            console.error(`❌ [VIDEO-SYSTEM] Stack:`, error.stack);
            return false;
        }
    }

    /**
     * Iniciar ciclo: Dashboard (1min) → Vídeo (3min) → Repetir
     */
    startCycle() {
        console.log(`🔄 Iniciando ciclo de exibição...`);
        this.currentMode = 'dashboard';
        this.timeRemaining = VIDEO_CONFIG.DASHBOARD_DURATION;
        this.scheduleNextTransition();
    }

    /**
     * Agendar próxima transição (dashboard ↔ vídeo)
     */
    scheduleNextTransition() {
        // Limpar timer anterior se existir
        if (this.cycleTimer) {
            clearTimeout(this.cycleTimer);
        }

        const duracao = this.currentMode === 'dashboard' 
            ? VIDEO_CONFIG.DASHBOARD_DURATION 
            : VIDEO_CONFIG.VIDEO_DURATION;

        console.log(`⏱️ Agendada transição em ${duracao / 1000}s`);

        this.cycleTimer = setTimeout(() => {
            if (this.currentMode === 'dashboard') {
                console.log(`🎬 Transição: Dashboard → Vídeo`);
                this.showVideo();
            } else {
                console.log(`📊 Transição: Vídeo → Dashboard`);
                this.hideVideo();
            }
            // Agendar próxima transição
            this.scheduleNextTransition();
        }, duracao);
    }

    /**
     * Exibir vídeo em fullscreen
     */
    showVideo() {
        console.log(`🎬 [VIDEO-SYSTEM] showVideo() chamado`);
        console.log(`🎬 [VIDEO-SYSTEM] Vídeos disponíveis: ${this.videos.length}`);
        console.log(`🎬 [VIDEO-SYSTEM] Índice atual: ${this.currentVideoIndex}`);
        
        const modal = document.getElementById('video-modal');
        const videoSource = document.getElementById('video-source');
        const videoTitulo = document.getElementById('video-titulo');
        const videoAtual = document.getElementById('video-atual');
        const videoTotal = document.getElementById('video-total');
        const videoplayer = document.getElementById('video-player');

        if (!modal) {
            console.error(`❌ [VIDEO-SYSTEM] Elemento #video-modal não encontrado!`);
            return;
        }
        if (!videoSource) {
            console.error(`❌ [VIDEO-SYSTEM] Elemento #video-source não encontrado!`);
            return;
        }
        if (!videoplayer) {
            console.error(`❌ [VIDEO-SYSTEM] Elemento #video-player não encontrado!`);
            return;
        }

        const video = this.videos[this.currentVideoIndex];
        console.log(`🎬 [VIDEO-SYSTEM] Vídeo selecionado:`, video);

        if (!video) {
            console.error(`❌ [VIDEO-SYSTEM] Vídeo não encontrado no índice ${this.currentVideoIndex}`);
            return;
        }

        // Atualizar informações
        videoTitulo.textContent = video.nome || 'Vídeo';
        videoAtual.textContent = this.currentVideoIndex + 1;
        videoTotal.textContent = this.videos.length;

        // Usar URL de visualização do Google Drive
        const videoUrl = video.urlVideo || video.urlEmbed || video.urlVisualizar;
        console.log(`🎬 [VIDEO-SYSTEM] URL do vídeo: ${videoUrl}`);
        
        videoSource.src = videoUrl;
        videoplayer.load();

        // Mostrar modal
        console.log(`🎬 [VIDEO-SYSTEM] Mostrando modal...`);
        modal.classList.remove('hidden');
        modal.classList.add('visible', 'show-video');

        // Play automático
        videoplayer.play().catch(err => {
            console.warn(`⚠️ [VIDEO-SYSTEM] Auto-play bloqueado:`, err.message);
        });

        this.isPlayingVideo = true;
        this.currentMode = 'video';
        this.timeRemaining = VIDEO_CONFIG.VIDEO_DURATION;

        // Passar pro próximo vídeo na próxima rodada
        this.currentVideoIndex = (this.currentVideoIndex + 1) % this.videos.length;
        
        console.log(`✅ [VIDEO-SYSTEM] Vídeo sendo exibido!`);
    }

    /**
     * Ocultar vídeo e voltar para dashboard
     */
    hideVideo() {
        console.log(`📊 Voltando para dashboard...`);
        
        const modal = document.getElementById('video-modal');
        const videoplayer = document.getElementById('video-player');

        if (!modal) return;

        // Pausar vídeo
        if (videoplayer) {
            videoplayer.pause();
            videoplayer.currentTime = 0;
        }

        // Ocultar modal
        modal.classList.add('hide-video');
        setTimeout(() => {
            modal.classList.remove('visible', 'show-video', 'hide-video');
            modal.classList.add('hidden');
        }, 500);

        this.isPlayingVideo = false;
        this.currentMode = 'dashboard';
        this.timeRemaining = VIDEO_CONFIG.DASHBOARD_DURATION;
    }

    /**
     * Iniciar conta regressiva do timer
     */
    startCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        this.countdownInterval = setInterval(() => {
            this.timeRemaining -= 1000;
            
            // Não deixar negativo
            if (this.timeRemaining < 0) {
                this.timeRemaining = 0;
            }
            
            this.updateTimerDisplay();
        }, 1000);
    }

    /**
     * Atualizar display do timer
     */
    updateTimerDisplay() {
        const modoTexto = document.getElementById('modo-texto');
        const modoTimer = document.getElementById('modo-timer');

        if (!modoTexto || !modoTimer) return;

        const minutos = Math.floor(this.timeRemaining / 60000);
        const segundos = Math.floor((this.timeRemaining % 60000) / 1000);
        const formatado = `${minutos}:${segundos.toString().padStart(2, '0')}`;

        modoTimer.textContent = formatado;

        if (this.currentMode === 'dashboard') {
            modoTexto.textContent = '📊 Dashboard';
            modoTexto.style.color = '#5A5FFF';
        } else {
            modoTexto.textContent = '🎬 Vídeo';
            modoTexto.style.color = '#E03D99';
        }
    }

    /**
     * Parar o sistema
     */
    stop() {
        console.log(`⏹️ Parando sistema de auto-play...`);
        if (this.cycleTimer) clearInterval(this.cycleTimer);
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.hideVideo();
    }

    /**
     * Forçar próximo vídeo
     */
    nextVideo() {
        if (this.isPlayingVideo) {
            this.showVideo();
        }
    }

    /**
     * Recarregar vídeos (útil se adicionarem novos)
     */
    async reloadVideos() {
        console.log(`🔄 Recarregando lista de vídeos...`);
        await this.loadVideos();
    }
}

// Instância global
let videoSystem = null;

/**
 * Inicializar sistema quando documento estiver pronto
 */
const initVideoSystem = async () => {
    console.log(`🎬 [VIDEO-SYSTEM] Iniciando sistema de auto-play...`);
    
    if (!VIDEO_CONFIG.ENABLED) {
        console.log(`ℹ️ Sistema de auto-play desativado`);
        return;
    }

    try {
        videoSystem = new VideoAutoPlaySystem();
        console.log(`✅ [VIDEO-SYSTEM] Instância criada`);
        
        await videoSystem.init();
        console.log(`✅ [VIDEO-SYSTEM] Sistema iniciado com sucesso`);
        
        // Exportar para uso global
        window.videoSystem = videoSystem;
        console.log(`✅ [VIDEO-SYSTEM] Exportado para window.videoSystem`);
    } catch (error) {
        console.error(`❌ [VIDEO-SYSTEM] Erro ao inicializar:`, error.message);
        console.error(error.stack);
    }
};

// Iniciar quando página carregar
console.log(`🎬 [VIDEO-SYSTEM] Script carregado, readyState = ${document.readyState}`);

if (document.readyState === 'loading') {
    console.log(`🎬 [VIDEO-SYSTEM] Esperando DOMContentLoaded...`);
    document.addEventListener('DOMContentLoaded', () => {
        console.log(`🎬 [VIDEO-SYSTEM] DOMContentLoaded disparado!`);
        initVideoSystem();
    });
} else {
    console.log(`🎬 [VIDEO-SYSTEM] DOM já carregado, inicializando agora...`);
    initVideoSystem();
}

// Exportar classe também
window.VideoAutoPlaySystem = VideoAutoPlaySystem;
