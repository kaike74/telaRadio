/**
 * 🎬 SISTEMA DE AUTO-PLAY DE VÍDEOS
 * Gerencia ciclo: 10 min Dashboard + 3 min Vídeo
 */

const VIDEO_CONFIG = {
    DASHBOARD_DURATION: 10 * 60 * 1000, // 10 minutos
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
        
        try {
            // Carregar vídeos da API
            await this.loadVideos();
            
            if (this.videos.length > 0) {
                console.log(`✅ ${this.videos.length} vídeos carregados`);
                this.startCycle();
                this.startCountdown();
            } else {
                console.warn(`⚠️ Nenhum vídeo disponível`);
            }
        } catch (error) {
            console.error(`❌ Erro ao inicializar sistema de vídeos: ${error.message}`);
        }
    }

    /**
     * Carregar vídeos da API
     */
    async loadVideos() {
        try {
            const response = await fetch('/api/videos');
            const data = await response.json();
            
            if (data.sucesso && data.videos && data.videos.length > 0) {
                this.videos = data.videos;
                console.log(`📥 ${this.videos.length} vídeos carregados da API`);
                return true;
            } else {
                console.warn(`⚠️ API não retornou vídeos:`, data.erro || 'Nenhum vídeo');
                return false;
            }
        } catch (error) {
            console.error(`❌ Erro ao carregar vídeos:`, error.message);
            return false;
        }
    }

    /**
     * Iniciar ciclo: Dashboard (10min) → Vídeo (3min) → Repetir
     */
    startCycle() {
        console.log(`🔄 Iniciando ciclo de exibição...`);
        this.cycleTimer = setInterval(() => {
            if (this.currentMode === 'dashboard') {
                // Passar para modo vídeo
                this.showVideo();
            } else {
                // Passar para modo dashboard
                this.hideVideo();
            }
        }, this.currentMode === 'dashboard' ? VIDEO_CONFIG.DASHBOARD_DURATION : VIDEO_CONFIG.VIDEO_DURATION);
    }

    /**
     * Exibir vídeo em fullscreen
     */
    showVideo() {
        console.log(`🎬 Exibindo vídeo ${this.currentVideoIndex + 1}/${this.videos.length}`);
        
        const modal = document.getElementById('video-modal');
        const videoSource = document.getElementById('video-source');
        const videoTitulo = document.getElementById('video-titulo');
        const videoAtual = document.getElementById('video-atual');
        const videoTotal = document.getElementById('video-total');
        const videoplayer = document.getElementById('video-player');

        if (!modal || !videoSource) {
            console.error(`❌ Elementos de vídeo não encontrados no DOM`);
            return;
        }

        const video = this.videos[this.currentVideoIndex];

        // Atualizar informações
        videoTitulo.textContent = video.nome || 'Vídeo';
        videoAtual.textContent = this.currentVideoIndex + 1;
        videoTotal.textContent = this.videos.length;

        // Usar URL de visualização do Google Drive
        videoSource.src = video.urlEmbed || video.urlVisualizar;
        videoplayer.load();

        // Mostrar modal
        modal.classList.remove('hidden');
        modal.classList.add('visible', 'show-video');

        // Play automático
        videoplayer.play().catch(err => {
            console.warn(`⚠️ Auto-play bloqueado:`, err.message);
        });

        this.isPlayingVideo = true;
        this.currentMode = 'video';

        // Passar pro próximo vídeo na próxima rodada
        this.currentVideoIndex = (this.currentVideoIndex + 1) % this.videos.length;

        // Resetar countdown
        this.timeRemaining = VIDEO_CONFIG.VIDEO_DURATION;
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

        // Resetar countdown
        this.timeRemaining = VIDEO_CONFIG.DASHBOARD_DURATION;
    }

    /**
     * Iniciar conta regressiva do timer
     */
    startCountdown() {
        this.countdownInterval = setInterval(() => {
            this.timeRemaining -= 1000;
            this.updateTimerDisplay();

            if (this.timeRemaining <= 0) {
                this.timeRemaining = this.currentMode === 'dashboard' 
                    ? VIDEO_CONFIG.DASHBOARD_DURATION 
                    : VIDEO_CONFIG.VIDEO_DURATION;
            }
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
    if (!VIDEO_CONFIG.ENABLED) {
        console.log(`ℹ️ Sistema de auto-play desativado`);
        return;
    }

    videoSystem = new VideoAutoPlaySystem();
    await videoSystem.init();
};

// Iniciar quando página carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVideoSystem);
} else {
    initVideoSystem();
}

// Exportar para uso global
window.videoSystem = videoSystem;
window.VideoAutoPlaySystem = VideoAutoPlaySystem;
