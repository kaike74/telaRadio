/**
 * 🎬 SISTEMA DE AUTO-PLAY DE VÍDEOS
 * Gerencia ciclo: 10 min Dashboard + 3 min Vídeo
 */

const VIDEO_CONFIG = {
    DASHBOARD_DURATION: 1 * 60 * 1000,  // 1 minuto (para testes)
    VIDEO_DURATION: 3 * 60 * 1000,      // 3 minutos
    ENABLED: true,
    PRELOAD: true,
    AUTO_LOOP: true
};

class VideoAutoPlaySystem {
    constructor() {
        this.videos = [];
        this.currentVideoIndex = 0;
        this.isPlayingVideo = false;
        this.cycleTimer = null;
        this.countdownInterval = null;
        this.timeRemaining = VIDEO_CONFIG.DASHBOARD_DURATION;
        this.currentMode = 'dashboard'; // 'dashboard' ou 'video'
    }

    /**
     * Inicializar o sistema de vídeos
     */
    async init() {
        console.log(`🎬 Inicializando sistema de auto-play de vídeos...`);
        console.log(`🎬 [VIDEO-SYSTEM] Inicializando VideoAutoPlaySystem...`);
        
        try {
            // Carregar vídeos da API
            console.log(`🎬 [VIDEO-SYSTEM] Etapa 1: Carregando vídeos...`);
            const videosCarregados = await this.loadVideos();
            
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
            console.log(`🎬 [VIDEO-SYSTEM] Chamando /api/videos...`);
            const response = await fetch('/api/videos');
            console.log(`🎬 [VIDEO-SYSTEM] Resposta recebida, status: ${response.status}`);
            
            const data = await response.json();
            console.log(`🎬 [VIDEO-SYSTEM] JSON parseado:`, data);
            
            if (data.sucesso && data.videos && data.videos.length > 0) {
                this.videos = data.videos;
                console.log(`✅ [VIDEO-SYSTEM] ${this.videos.length} vídeos carregados:`);
                this.videos.forEach((v, i) => {
                    console.log(`   ${i+1}. ${v.nome}`);
                });
                return true;
            } else {
                console.warn(`❌ [VIDEO-SYSTEM] Resposta sem vídeos:`, data);
                return false;
            }
        } catch (error) {
            console.error(`❌ [VIDEO-SYSTEM] Erro ao carregar vídeos:`, error.message);
            console.error(error.stack);
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
