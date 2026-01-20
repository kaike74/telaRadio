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
