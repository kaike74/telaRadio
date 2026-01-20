/**
 * 🎬 SISTEMA DE CICLO: DASHBOARD ↔ VÍDEOS
 * 
 * Ciclo:
 * - Dashboard (1 minuto - teste, depois 10min)
 * - Vídeos Aleatórios (3 minutos, ~7-9 vídeos de 20-25s)
 * - Repetir
 */

const VIDEO_CONFIG = {
    // Timing (em milisegundos)
    DASHBOARD_DURATION: 60 * 1000,         // 1 minuto para TESTE (depois será 10*60*1000)
    VIDEO_CYCLE_DURATION: 3 * 60 * 1000,   // 3 minutos de vídeos
    SINGLE_VIDEO_DURATION: 25000,           // ~25 segundos por vídeo (duração média estimada)
    
    // Configurações
    ENABLED: true,
    AUTO_LOOP: true,
    LOG_CHANGES: true
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
                
                // Iniciar ciclo no Dashboard
                this.currentMode = 'dashboard';
                this.cycleStartTime = Date.now();
                console.log(`📊 [VIDEO-SYSTEM] Iniciando com DASHBOARD`);
                
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
     * Carregar vídeos da API
     */
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
                this.scheduleNextTransition();
            }
        }, duracao);
    }

    /**
     * Iniciar ciclo de vídeos aleatórios (3 minutos)
     */
    startVideosCycle() {
        console.log(`🎬 [VIDEO-SYSTEM] Iniciando ciclo de VÍDEOS (3 minutos)...`);
        
        if (this.videos.length === 0) {
            console.warn(`⚠️  Nenhum vídeo disponível`);
            return;
        }

        // Selecionar vídeos aleatórios para preencher 3 minutos
        // ~7-9 vídeos de 20-25 segundos = 180 segundos
        const numVideosNecessarios = Math.ceil(VIDEO_CONFIG.VIDEO_CYCLE_DURATION / VIDEO_CONFIG.SINGLE_VIDEO_DURATION);
        console.log(`📊 Selecionando ${numVideosNecessarios} vídeos aleatórios...`);
        
        this.currentCycleSongs = this.getRandomVideos(numVideosNecessarios);
        console.log(`✅ ${this.currentCycleSongs.length} vídeos selecionados para esta ciclo`);
        
        this.currentVideoIndex = 0;
        this.currentMode = 'videos';
        this.videoCycleEndTime = Date.now() + VIDEO_CONFIG.VIDEO_CYCLE_DURATION;
        
        // Mostrar overlay
        const overlay = document.getElementById('video-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.classList.add('show');
        }
        
        // Reproduzir primeiro vídeo
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
        
        // Pausar vídeo
        const videoPlayer = document.getElementById('video-player');
        if (videoPlayer) {
            videoPlayer.pause();
            videoPlayer.currentTime = 0;
        }
        
        this.currentCycleSongs = [];
        this.currentVideoIndex = 0;
    }

    /**
     * Obter array de vídeos aleatórios
     */
    getRandomVideos(count) {
        const shuffled = [...this.videos].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    /**
     * Reproduzir um vídeo específico
     */
    playVideo(videoData) {
        const videoPlayer = document.getElementById('video-player');
        const videoSource = document.getElementById('video-source');
        
        if (!videoPlayer || !videoSource) {
            console.error(`❌ Elementos de vídeo não encontrados`);
            return;
        }

        const videoUrl = videoData.urlVideo;
        console.log(`▶️  [VIDEO-SYSTEM] ${this.currentVideoIndex + 1}/${this.currentCycleSongs.length}: ${videoData.nome}`);
        
        // Atualizar info na UI
        document.getElementById('video-atual').textContent = this.currentVideoIndex + 1;
        document.getElementById('video-total').textContent = this.currentCycleSongs.length;
        
        // Carregar vídeo
        videoSource.src = videoUrl;
        videoPlayer.load();
        
        // Reproduzir
        const playPromise = videoPlayer.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn(`⚠️  Erro ao reproduzir:`, error.message);
                // Pular para próximo
                setTimeout(() => this.playNextVideoInCycle(), 1000);
            });
        }
        
        // Event listener para quando vídeo terminar
        videoPlayer.onended = () => {
            console.log(`⏹️  Vídeo finalizado`);
            this.playNextVideoInCycle();
        };
    }

    /**
     * Passar para próximo vídeo na ciclo
     */
    playNextVideoInCycle() {
        this.currentVideoIndex++;
        
        // Verificar se ainda há tempo para mais vídeos
        const tempoRestante = this.videoCycleEndTime - Date.now();
        
        if (this.currentVideoIndex < this.currentCycleSongs.length && tempoRestante > 0) {
            console.log(`📊 Próximo vídeo em ${tempoRestante/1000}s`);
            this.playVideo(this.currentCycleSongs[this.currentVideoIndex]);
        } else {
            console.log(`✅ Ciclo de vídeos finalizado`);
            // Deixar o setTimeout principal fazer a transição
        }
    }

    /**
     * Verificar progresso do ciclo de vídeos
     */
    checkVideoCycleProgress() {
        if (this.currentMode !== 'videos') return;
        
        const tempoRestante = this.videoCycleEndTime - Date.now();
        const minutos = Math.floor(tempoRestante / 60000);
        const segundos = Math.floor((tempoRestante % 60000) / 1000);
        const formatado = `${minutos}:${segundos.toString().padStart(2, '0')}`;
        
        const timerElement = document.getElementById('video-timer');
        if (timerElement) {
            timerElement.textContent = formatado;
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
