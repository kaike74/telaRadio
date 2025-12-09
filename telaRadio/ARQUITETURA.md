# 🏗️ Arquitetura Completa do Dashboard Rádio

## 📊 Fluxo de Dados Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE PAGES (Frontend)                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ index.html                                               │  │
│  │ - Estrutura HTML da dashboard                           │  │
│  │ - 2 colunas: Mapa (60%) | Métricas (40%)               │  │
│  │ - Container para animações                              │  │
│  │ - Carrega: style.css + script.js                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ script.js (565 linhas)                                   │  │
│  │ RESPONSABILIDADES:                                       │  │
│  │ 1. Inicializa o mapa SVG (mapa-brasil.svg)              │  │
│  │ 2. Faz polling a cada 5s para inserções recentes        │  │
│  │ 3. Faz refresh total a cada 1min do dashboard           │  │
│  │ 4. Renderiza gráficos (emissoras, cidades)              │  │
│  │ 5. Anima "pingas" no mapa por 30s                       │  │
│  │ 6. Atualiza lista lateral de inserções                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ style.css (536 linhas)                                   │  │
│  │ - Tema escuro otimizado para TV                          │  │
│  │ - Layout responsivo (60/40 colunas)                      │  │
│  │ - Animações CSS para pingas                              │  │
│  │ - Estilos para gráficos e tooltips                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ mapa-brasil.svg                                          │  │
│  │ - Arquivo SVG com mapa do Brasil                         │  │
│  │ - Usado como base para as animações                      │  │
│  │ - Coordenadas são usadas para posicionar pingas          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         ↓ REQUISIÇÕES HTTP ↓
   (polling a cada 5 ou 60s)
         ↓                ↓
    /api/dashboard    /api/insercoes/recentes

┌─────────────────────────────────────────────────────────────────┐
│         CLOUDFLARE WORKER (Backend - Serverless)               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ worker/src/index.js (663 linhas)                         │  │
│  │                                                          │  │
│  │ ROUTER (3 endpoints):                                   │  │
│  │ 1. GET /api/dashboard                                   │  │
│  │    → Busca dados COMPLETOS do dashboard                │  │
│  │    → Calcula métricas, gráficos                         │  │
│  │    → Busca inserções de hoje                            │  │
│  │                                                          │  │
│  │ 2. GET /api/insercoes/recentes                          │  │
│  │    → Busca apenas inserções recentes (últimas horas)    │  │
│  │    → Rápido para polling frequente                      │  │
│  │                                                          │  │
│  │ 3. CORS Preflight (OPTIONS)                             │  │
│  │    → Autoriza requisições do frontend                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  FLUXO INTERNO DO WORKER:                                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. handleDashboard()                                    │   │
│  │    ├─ Busca TODAS as campanhas via API Audiency        │   │
│  │    │  └─ Filtra as ATIVAS para hoje                    │   │
│  │    │                                                    │   │
│  │    ├─ Busca emissoras programadas para cada campanha   │   │
│  │    │                                                    │   │
│  │    ├─ Busca TODAS as inserções de hoje                 │   │
│  │    │  └─ Filtra as que já rodaram (até agora)          │   │
│  │    │                                                    │   │
│  │    ├─ Processa coordenadas do Geonames                 │   │
│  │    │  └─ Converte lat/long para posição no SVG         │   │
│  │    │                                                    │   │
│  │    └─ Calcula métricas e retorna JSON                  │   │
│  │                                                         │   │
│  │ 2. handleInsercoesRecentes()                            │   │
│  │    └─ Busca cache do KV (mais rápido)                  │   │
│  │       Se não existir, chama handleDashboard()           │   │
│  │                                                         │   │
│  │ 3. Salva cache no KV (24h TTL)                          │   │
│  │    └─ Para evitar muitas chamadas à API                 │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         ↓ REQUISIÇÕES HTTP ↓
       (uma por dashboard)
         ↓                    ↓
   API Audiency.io    Geonames API
   (campanhas,        (lat/long
    inserções)        coordenadas)

┌──────────────────────────────────┐    ┌──────────────────────────────────┐
│     CLOUDFLARE KV STORAGE        │    │     APIS EXTERNAS                │
│                                  │    │                                  │
│ Cache de inserções (24h TTL):    │    │ 1. Audiency.io (API_KEY)         │
│ ├─ insercoes-2025-11-28         │    │    ├─ GET /campaigns             │
│ └─ coordenadas-2025-11-28       │    │    └─ GET /insertions           │
│                                  │    │                                  │
│ Binding: env.DASHBOARD_KV        │    │ 2. Geonames API (USERNAME)       │
│ (lê/escreve dados em tempo real) │    │    └─ GET /searchJSON            │
│                                  │    │       (busca lat/long de cidades)│
└──────────────────────────────────┘    └──────────────────────────────────┘

```

---

## 🔄 Comunicação Entre Componentes

### 1️⃣ **Frontend (script.js) → Worker**

```javascript
// POLLING A CADA 5 SEGUNDOS
setInterval(buscarInsercoesRecentes, 5000)
  ↓
fetch('https://dashboard-radio-worker.kaike-458.workers.dev/api/insercoes/recentes')
  ↓
RESPOSTA: { animacoes: [...] }
  ↓
atualizarAnimacoes() → cria pingas no mapa

// REFRESH COMPLETO A CADA 1 MINUTO
setInterval(buscarDashboardCompleto, 60000)
  ↓
fetch('https://dashboard-radio-worker.kaike-458.workers.dev/api/dashboard')
  ↓
RESPOSTA: { metricas, gráficos, inserções }
  ↓
renderizarDashboard() → atualiza tudo
```

### 2️⃣ **Worker → APIs Externas**

```
Worker recebe: GET /api/dashboard
  ↓
buscarTodasCampanhas()
  ↓
fetch('https://api.audiency.io/campaigns')
  ↓ (com API_KEY)
Retorna: [ { id, name, status, ... } ]
  ↓
filtrarCampanhasAtivas()
  ↓
buscarEmissorasProgramadas(campanhasAtivas)
  ↓
fetch('https://api.audiency.io/insertions?campaign_id=...')
  ↓
Retorna: [ { stationName, city, hour, ... } ]
  ↓
processarCoordenadas()
  ↓
fetch('https://www.geonames.org/searchJSON?name=Rio%20de%20Janeiro')
  ↓
Retorna: { lat: -22.9068, lng: -43.1729 }
  ↓
calcularPosicaoSVG(lat, lng) → posição no mapa
```

### 3️⃣ **Worker → KV Storage**

```
Depois de calcular tudo, salva em cache:
  ↓
env.DASHBOARD_KV.put(
  'insercoes-2025-11-28',
  JSON.stringify({ insercoesRecentes, coordenadas }),
  { expirationTtl: 86400 } // 24 horas
)
  ↓
Próximas requisições ao /api/insercoes/recentes
vão ler do KV (muito mais rápido!)
```

---

## 📦 O que cada arquivo faz

| Arquivo | Tipo | Propósito | Comunica com |
|---------|------|---------|---------------|
| **index.html** | HTML | Estrutura da página | style.css, script.js |
| **script.js** | JavaScript | Lógica de animations, polling, renderização | Worker API |
| **style.css** | CSS | Estilos, tema escuro, animations | index.html |
| **mapa-brasil.svg** | SVG | Mapa base para animações | script.js (renderiza pingas) |
| **wrangler.toml** | Configuração | Config do Worker, KV binding | (configuração) |
| **worker/src/index.js** | JavaScript | API, lógica de dados, cache | Audiency API, Geonames, KV |
| **worker/package.json** | npm | Dependências do Worker | wrangler (deploy) |
| **.github/workflows/deploy.yml** | GitHub Actions | Deploy automático | GitHub, Cloudflare |
| **README.md** | Markdown | Documentação | (leitura) |

---

## 🔀 Fluxo de Uma Inserção (Do início ao fim)

```
1. [API Audiency] Inserção criada: "Música X na Rádio Y em SP às 13:25"

2. [Worker - /api/dashboard]
   └─ Busca dados da API Audiency
   └─ Vê que 2 horas se passaram (agora é 15:25)
   └─ Insere na lista de "insercoesRecentes"
   └─ Calcula coordenadas: "SP" → lat -23.55, lng -46.63
   └─ Salva em KV (cache)

3. [Frontend - polling a cada 5s]
   └─ Chama /api/insercoes/recentes
   └─ Recebe a nova inserção
   └─ Cria "pinga" no mapa na coordenada
   └─ Anima pinga por 30 segundos
   └─ Adiciona à lista lateral de inserções

4. [30s depois]
   └─ Pinga desaparece (animação termina)
   └─ Inserção permanece na lista lateral
   └─ Mas já não aparece nas coordenadas do mapa

5. [1 minuto depois - refresh completo]
   └─ Chama /api/dashboard
   └─ Atualiza TODAS as métricas
   └─ Atualiza gráficos
   └─ Limpa inserções antigas
```

---

## 🚀 Deploy Automático (GitHub Actions)

```
[Você faz: git push origin main]
  ↓
[GitHub Actions dispara: .github/workflows/deploy.yml]
  ├─ Deploy Worker (worker/src/index.js)
  │  └─ npm install + wrangler deploy
  │     └─ Atualiza: https://dashboard-radio-worker.kaike-458.workers.dev
  │
  └─ Deploy Frontend (raiz do projeto)
     └─ cloudflare/pages-action
        └─ Atualiza: https://dashboard-radio.pages.dev (ou domínio)
```

---

## 🎯 Resumo de Responsabilidades

### **Frontend (Você está aqui agora)**
- ✅ Mostra interface bonita
- ✅ Faz polling do Worker
- ✅ Anima pingas no mapa
- ✅ Renderiza gráficos
- ❌ NÃO busca APIs externas (o Worker faz isso)

### **Worker (Backend)**
- ✅ Busca dados do Audiency
- ✅ Busca coordenadas do Geonames
- ✅ Calcula métricas
- ✅ Cacheia tudo no KV
- ❌ NÃO renderiza HTML (o frontend faz isso)

### **GitHub Actions**
- ✅ Faz deploy automático quando você faz push
- ✅ Deploy Worker e Frontend ao mesmo tempo
- ❌ NÃO executa código da aplicação (só deploy)

---

## 💡 Conclusão

**Eles trabalham JUNTOS em uma arquitetura cliente-servidor:**

```
USER → Vê a dashboard → Script.js → Polling → Worker → APIs Externas
                           ↓                      ↓
                      Renderiza             Cache (KV)
                        Dados                     ↓
                                            Frontend recebe dados
```

Qualquer mudança no código é deployada automaticamente via GitHub Actions! 🎉
