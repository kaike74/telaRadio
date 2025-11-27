# 📻 Dashboard Institucional - Monitoramento de Rádio

Dashboard em tempo real para monitoramento de inserções publicitárias em rádios do Brasil, desenvolvido para exibição em TV institucional.

## 🎯 Objetivo

Monitorar inserções publicitárias em rádios do Brasil em "tempo real" (com delay de 2h da API original), mostrando animações no mapa quando inserções acontecem.

## 🏗️ Arquitetura

### Backend - Cloudflare Worker
- **KV Namespace**: `DASHBOARD_INSTITUCIONAL` (ID: 598948c19c524ab3af65831cd8f6278f)
- **API Base**: Audiency.io
- **Geocoding**: Geonames API

### Frontend - Cloudflare Pages
- **Framework**: Vanilla JavaScript (performance otimizada)
- **Atualização**: Polling a cada 5 segundos
- **Layout**: Otimizado para TVs e telas grandes

## ✨ Funcionalidades

### 🗺️ Mapa Interativo com Animações
- Animações de "pinga" em tempo real nas cidades onde inserções estão rodando
- Lógica: Se agora são 15:25:30 e uma inserção rodou às 13:25:30 (2h de delay), mostra animação por 30 segundos
- Tooltip com detalhes: rádio, cidade, cliente, horário

### 📊 Métricas em Tempo Real
- Campanhas ativas
- Rádios ativas
- Inserções do dia

### 📈 Gráficos Horizontais
- Top emissoras por número de campanhas
- Top cidades por número de emissoras

### 📋 Lista de Inserções Recentes
- Stream ao vivo das últimas inserções
- Informações: rádio, cidade/UF, cliente, horário

## 🚀 Quick Start

### Pré-requisitos
- Node.js 18+
- Cloudflare Account
- Wrangler CLI instalado
- GitHub Account

### Instalação

```bash
# Clone o repositório
git clone https://github.com/kaike74/telaRadio.git
cd telaRadio

# Instale dependências do worker
cd worker
npm install

# Configure secrets
wrangler secret put API_KEY
# Cole: 9620cf74-856d-40c2-a091-248e4f322caa

wrangler secret put GEONAMES_USERNAME
# Cole: kaike

# Deploy do worker
npm run deploy

# O frontend será deployado automaticamente via GitHub Actions
```

## 📁 Estrutura do Projeto

```
dashboard-radio/
├── README.md                    # Este arquivo
├── wrangler.toml               # Configuração Cloudflare Worker
├── .github/
│   └── workflows/
│       └── deploy.yml          # Deploy automático
├── worker/
│   ├── src/
│   │   └── index.js           # Worker principal
│   └── package.json
├── frontend/
│   ├── index.html             # Interface principal
│   ├── style.css              # Estilos otimizados para TV
│   ├── script.js              # Lógica de animações e polling
│   └── mapa-brasil.svg        # Mapa do Brasil
└── docs/
    └── SETUP.md               # Guia detalhado de setup
```

## 🔧 Configuração

Veja [docs/SETUP.md](docs/SETUP.md) para instruções detalhadas.

## 📡 Endpoints da API

### `GET /api/dashboard`
Retorna dados completos do dashboard:
- Métricas gerais
- Coordenadas das cidades
- Inserções recentes
- Debug info

### `GET /api/insercoes/recentes`
Retorna apenas inserções que devem estar animando no mapa neste momento:
- Filtra inserções dos últimos 30 segundos (considerando delay de 2h)
- Dados prontos para renderizar animações

## 🎨 Layout do Dashboard

```
┌─────────────────────────────────┬──────────────────┐
│                                 │  📊 Métricas     │
│    🗺️ Mapa do Brasil           │  31 | 101 | 509 │
│    (com animações)              │                  │
│                                 │  📊 Gráfico 1    │
│    60% largura                  │  Top Emissoras   │
│    60% altura                   │                  │
│                                 │  📊 Gráfico 2    │
├─────────────────────────────────┤  Top Cidades     │
│  📋 Lista de Inserções          │                  │
│  Rádio | Cidade | Cliente       │  40% largura     │
│  40% altura                     │                  │
└─────────────────────────────────┴──────────────────┘
```

## 🔄 Fluxo de Dados

1. **Worker** busca dados da API Audiency.io a cada 5 minutos
2. **Cache KV** armazena:
   - Dados completos do dia (24h)
   - Coordenadas permanentes (Geonames)
3. **Frontend** faz polling a cada 5 segundos para `/api/insercoes/recentes`
4. **Animações** aparecem no mapa por 30 segundos

## 🛠️ Desenvolvimento

```bash
# Worker - Desenvolvimento local
cd worker
npm run dev

# Worker - Deploy
npm run deploy

# Frontend - Serve local
cd frontend
npx serve .
```

## 📝 Variáveis de Ambiente

### Worker (Cloudflare Secrets)
- `API_KEY`: API key da Audiency.io
- `GEONAMES_USERNAME`: Username do Geonames

### KV Namespace
- `DASHBOARD_KV`: Binding para o namespace `DASHBOARD_INSTITUCIONAL`

## 🐛 Debug

O worker retorna informações de debug no campo `debug`:

```json
{
  "debug": {
    "totalCampanhas": 150,
    "campanhasAtivas": 31,
    "emissorasProgramadas": 101,
    "totalInsercoes": 1523,
    "insercoesRecentes": 509,
    "horaProcessamento": "15:25",
    "ultimaHoraEncontrada": "15:24"
  }
}
```

## 🚦 Status do Sistema

- ✅ Backend: Cloudflare Worker
- ✅ Frontend: Cloudflare Pages
- ✅ Cache: KV Storage
- ✅ Deploy: GitHub Actions

## 📄 Licença

Projeto institucional - Uso interno

## 👨‍💻 Autor

Desenvolvido para monitoramento institucional de campanhas radiofônicas.

---

**Nota**: Este dashboard foi otimizado para exibição em TVs institucionais com atualização em tempo real.