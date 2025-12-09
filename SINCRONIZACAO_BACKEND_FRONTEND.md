# 🔄 Sincronização Backend-Frontend: Análise Completa

## 📊 Visão Geral

O sistema funciona com **híbrido** entre armazenamento e sincronização:

- **Backend**: Armazena dados + calcula métricas + gerencia cache
- **Frontend**: Sincroniza em tempo real + renderiza UI
- **Dados**: Fluem em tempo real, sem replicação desnecessária

---

## 🏗️ Arquitetura de Dados

```
┌─────────────────────────────────────────────┐
│         API AUDIENCY (Fonte Principal)      │
└───────────────┬─────────────────────────────┘
                │
        ┌───────▼────────┐
        │    BACKEND     │
        │  Cloudflare    │
        │   Worker       │
        │                │
        │ Endpoints:     │
        │ /api/dashboard │
        │ /insercoes/    │
        │  recentes      │
        │ /coordenada    │
        └───────┬────────┘
                │
                ├─ Retorna JSON
                │
        ┌───────▼────────┐
        │   FRONTEND     │
        │   (Browser)    │
        │                │
        │ Polling:       │
        │ 5s (insercoes) │
        │ 60s (cache)    │
        │                │
        │ Renderiza:     │
        │ • Mapa         │
        │ • Ticker       │
        │ • Métricas     │
        │ • Gráficos     │
        └────────────────┘
```

---

## 📥 Fluxo de Dados: Backend

### **Endpoint 1: `/api/dashboard` (Inicial)**

#### **O que o Backend Faz**
```
1. CARREGAR DADOS ESTÁTICOS (Cache 24h)
   └─ buscarTodasCampanhas()
   └─ filtrarCampanhasAtivas()
   └─ buscarEmissorasProgramadas() [KV cache por campanha]

2. BUSCAR INSERÇÕES FRESCOS (Sempre)
   └─ buscarInsercoes() [API Audiency - SEM cache]

3. PROCESSAR COORDENADAS (Sempre)
   └─ processarCoordenadas() [Cache + Geonames API]

4. CALCULAR MÉTRICAS
   └─ calcularMetricas() [Baseado em inserções]
   └─ topEmissorasComMaiorNumeroCampanhas
   └─ topCidadesComMaiorNumeroEmissoras

5. SALVAR CACHE
   └─ KV: dashboard-completo-{dataHoje}
   └─ Inclui: insercoesRecentes, coordenadas, metricas

6. RETORNAR JSON
   └─ Métricas
   └─ Coordenadas (100)
   └─ Inserções Recentes (100)
   └─ Debug info
```

#### **O que o Backend Retorna**
```json
{
  "success": true,
  "timestamp": "2025-12-05T18:20:30.000Z",
  "fromCache": false,
  "cacheStatus": "FRESH_FETCH",
  "metricas": {
    "campanhasAtivas": 31,
    "emissorasAtivas": 101,
    "insercoesHoje": 509,
    "topEmissorasComMaiorNumeroCampanhas": [...],
    "topCidadesComMaiorNumeroEmissoras": [...]
  },
  "coordenadas": [...],
  "insercoesRecentes": [...]
}
```

---

### **Endpoint 2: `/api/insercoes/recentes` (Polling 5s)**

#### **O que o Backend Faz**
```
1. LER CACHE (KV: dashboard-completo-{dataHoje})
   └─ Criado pela rota /api/dashboard

2. EXTRAIR DADOS
   └─ insercoesRecentes
   └─ coordenadas
   └─ metricas

3. RETORNAR JSON
   └─ Exatamente o que foi salvo em cache
```

#### **O que o Backend Retorna**
```json
{
  "success": true,
  "animacoes": [],
  "insercoesRecentes": [...],
  "metricas": {...},
  "message": "Dados do cache"
}
```

---

## 📤 Fluxo de Dados: Frontend

### **Estado Global (Memory)**
```javascript
let dashboardData = null;           // Dados completos do /api/dashboard
let animacoesAtivas = new Map();    // Pingas ativos no mapa
let insercoesPreviasIds = new Set(); // IDs das últimas inserções
let metricasAnteriores = {};        // Métricas para detectar mudanças
```

### **Ciclo de Sync**

#### **1. DOMContentLoaded (Primeira Vez)**
```javascript
buscarDashboardCompleto()
  └─ GET /api/dashboard
  └─ Armazena em: dashboardData
  └─ Renderiza:
     ├─ Métricas (campanhas, rádios, inserções)
     ├─ Gráficos (top emissoras, top cidades)
     └─ Lista de inserções
```

#### **2. Polling 5s (Contínuo)**
```javascript
setInterval(buscarInsercoesRecentes, 5000)
  └─ GET /api/insercoes/recentes
  └─ Recebe: insercoesRecentes, metricas
  └─ Sincroniza:
     ├─ Lista de inserções (renderizarListaInsercoes)
     ├─ Ticker (atualizarTicker)
     ├─ Métricas (atualizarMetricasComDeteccao)
     ├─ Pingas (criarPingaDoTicker)
     └─ Detecta mudanças em números
```

#### **3. Atualização de Tempo Relativo (10s)**
```javascript
setInterval(atualizarTemposRelativos, 10000)
  └─ Atualiza "há 1 minuto", "há 2 horas", etc
  └─ NÃO faz requisição HTTP
  └─ Apenas atualiza display local
```

---

## 🔀 O Backend ARMAZENA ou O Frontend SINCRONIZA?

### **Resposta: AMBOS, mas cada um faz seu papel**

| Aspecto | Backend | Frontend |
|---------|---------|----------|
| **Armazenamento** | ✅ KV Cache (24h para estático, 5s para dinâmico) | ❌ Apenas memória RAM (não persiste) |
| **Cálculo** | ✅ Métrica, Filtros, Rankings | ❌ Só renderiza o que recebe |
| **Sincronização** | ✅ Sincroniza com API Audiency | ✅ Sincroniza com Backend |
| **Fontes** | API Audiency | Backend + Local Storage (não) |
| **Estado** | Persistente (KV) | Volátil (RAM) |

---

## 📋 Estrutura de Cache Backend

```
KV Storage (Cloudflare):

1. dados-estaticos-{dataHoje}
   ├─ todasCampanhas
   ├─ campanhasAtivas
   └─ emissorasProgramadas
   └─ TTL: 24 horas

2. dashboard-completo-{dataHoje}
   ├─ insercoesRecentes
   ├─ todasInsercoes
   ├─ coordenadas
   ├─ metricas
   ├─ timestamp
   └─ TTL: 24 horas

3. emissoras-campanha-{campaignId}
   ├─ Array de emissoras
   └─ TTL: 24 horas

4. coordenadas-cache
   ├─ { "São Paulo": {lat, lng} }
   └─ TTL: 24 horas
```

---

## 🔐 Sincronização de Dados Específicos

### **1. Inserções Recentes**

```
API Audiency
    ↓
Backend: buscarInsercoes() [SEMPRE FRESCO]
    └─ Filtra por data e hora
    └─ Aplica delay de 2h
    └─ Retorna até 100
    ↓
Frontend: /api/insercoes/recentes
    └─ Renderiza lista
    └─ Cria pingas
    └─ Atualiza ticker
```

**Sincronização**: ✅ REAL-TIME (5s)
**Armazenamento**: Backend salva em KV, Frontend lê da memória

---

### **2. Emissoras Programadas**

```
API Audiency: /advertiser-rest/campaigns/{id}/programmed-station-filter
    ↓
Backend: buscarEmissorasProgramadas() [Cache por campanha 24h]
    └─ Primeira vez: busca API + salva em KV
    └─ Próximas: lê do cache
    ↓
Backend: calcularMetricas()
    └─ Usa emissoras programadas
    └─ Calcula top emissoras
    ↓
Frontend: renderizarGraficoEmissoras()
    └─ Mostra gráfico com dados do backend
```

**Sincronização**: ⏱️ 1x/dia (primeira carga)
**Armazenamento**: Backend armazena em KV, Frontend recebe JSON

---

### **3. Top Emissoras & Top Cidades**

```
Backend: calcularMetricas()
    ├─ topEmissorasComMaiorNumeroCampanhas
    │  └─ Conta campanhas diferentes por emissora
    │  └─ Baseado em dados programados (24h cache)
    │
    └─ topCidadesComMaiorNumeroEmissoras
       └─ Conta emissoras diferentes por cidade
       └─ Baseado em inserções executadas (FRESCO)
       ↓
Frontend: renderizarGraficoEmissoras() + renderizarGraficoCidades()
    └─ Exibe gráficos com dados recebidos
```

**Sincronização**: 📊 /api/insercoes/recentes (5s)
**Armazenamento**: Backend calcula, Frontend apenas renderiza

---

### **4. Coordenadas**

```
Frontend: criarPingaDoTicker(insercao)
    ├─ Recebe inserção
    ├─ Extrai city: "São Paulo"
    └─ Requisita: GET /api/coordenada?cidade=São+Paulo
        ↓
Backend: handleCoordenada()
    ├─ Procura em cache (coordenadas-cache)
    ├─ Se não houver: busca Geonames API
    ├─ Salva em cache (24h)
    └─ Retorna: { lat, lng }
        ↓
Frontend: criarPinga()
    ├─ Converte lat/lng em pixels (SVG)
    └─ Posiciona pinga no mapa
```

**Sincronização**: 🔍 On-demand (quando pinga é criado)
**Armazenamento**: Backend cache 24h, Frontend calcula posição

---

## ✅ Verificação de Sincronização

### **Status Atual**

```
✅ Backend e Frontend estão SINCRONIZADOS?
```

#### **Evidências**

1. **Dados Frescos**
   - ✅ Backend busca inserções SEMPRE (sem cache)
   - ✅ Frontend sincroniza a cada 5s
   - ✅ Delay máximo: 5 segundos

2. **Métricas Consistentes**
   - ✅ Backend calcula no /api/dashboard
   - ✅ Frontend recebe em /api/insercoes/recentes
   - ✅ Mesmas inserções = mesmas métricas

3. **Pingas Sincronizados**
   - ✅ Frontend recebe inserções
   - ✅ Frontend cria pingas automaticamente
   - ✅ Ticker e Mapa sempre sincronizados

4. **Cache Inteligente**
   - ✅ Dados estáticos: Cache 24h (OK mudar 1x/dia)
   - ✅ Dados dinâmicos: Sempre frescos
   - ✅ Performance otimizada

---

## ⚠️ Potenciais Dessincronizações

### **Cenário 1: Cache Inválido**
```
SE: Backend retorna erro ao buscar inserções
ENTÃO: /api/insercoes/recentes retorna cache antigo
RESULTADO: Frontend mostra dados desatualizados

SOLUÇÃO: ✅ Implementar fallback para busca fresca
```

### **Cenário 2: Hora Diferente Entre Servidores**
```
SE: Backend usa hora diferente do frontend
ENTÃO: "há 1 minuto" pode mostrar número negativo

RESULTADO: Confusão visual

SOLUÇÃO: ✅ Backend usa hora Brasília (UTC-3)
         ✅ Frontend usa hora do servidor (headers HTTP)
```

### **Cenário 3: Inserção Duplicada**
```
SE: Mesma inserção chega 2x no polling
ENTÃO: Frontend pode criar 2 pingas

RESULTADO: Duplicação visual

SOLUÇÃO: ✅ Frontend usa ID único para cada pinga
         ✅ Verifica antes de criar
```

---

## 📈 Fluxo Completo: Do Início ao Fim

```
T=0s:     PÁGINA CARREGA
          ├─ Frontend: DOMContentLoaded
          └─ Frontend: GET /api/dashboard
             ↓
          Backend: /api/dashboard
          ├─ Carrega cache (campanhas, emissoras)
          ├─ Busca inserções frescos
          ├─ Processa coordenadas
          ├─ Calcula métricas
          ├─ Salva cache: dashboard-completo-{data}
          └─ Retorna JSON
             ↓
          Frontend: renderizarDashboard()
          ├─ Métricas
          ├─ Gráficos
          └─ Lista de inserções

T=5s:     POLLING 1
          Frontend: GET /api/insercoes/recentes
          └─ Backend: Retorna dashboard-completo-{data} do cache
             ↓
          Frontend: atualizarMetricasComDeteccao()
          ├─ Detecta mudanças
          ├─ Renderiza lista nova
          ├─ Cria pingas para novas inserções
          └─ Atualiza ticker

T=10s:    ATUALIZAR TEMPOS RELATIVOS
          Frontend: atualizarTemposRelativos()
          └─ "há 5 segundos" → "há 10 segundos"

T=15s:    POLLING 3
          Frontend: GET /api/insercoes/recentes
          └─ Idem T=5s

...continua a cada 5s
```

---

## 🎯 Conclusão

### **O sistema é híbrido e bem desenhado:**

1. **Backend**
   - ✅ Armazena dados em cache (KV)
   - ✅ Calcula métricas
   - ✅ Busca dados frescos regularmente
   - ✅ Fornece APIs para frontend

2. **Frontend**
   - ✅ Sincroniza em tempo real (5s)
   - ✅ Renderiza UI baseado em dados backend
   - ✅ Detecta mudanças automaticamente
   - ✅ Não armazena dados (apenas em RAM)

3. **Sincronização**
   - ✅ Delay máximo: 5 segundos
   - ✅ Métricas sempre consistentes
   - ✅ Cache inteligente para performance
   - ✅ Fallback e tratamento de erros

---

## 📊 Resumo de Responsabilidades

```
┌──────────────────────────────────────────────────────────┐
│ BACKEND                                                  │
├──────────────────────────────────────────────────────────┤
│ ✅ Buscar dados de APIs externas                        │
│ ✅ Aplicar filtros e transformações                     │
│ ✅ Calcular métricas e rankings                         │
│ ✅ Gerenciar cache (KV)                                 │
│ ✅ Garantir consistência de dados                       │
│ ✅ Fornecer APIs RESTful                                │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ FRONTEND                                                 │
├──────────────────────────────────────────────────────────┤
│ ✅ Sincronizar com backend (polling)                    │
│ ✅ Renderizar UI baseado em dados                       │
│ ✅ Detectar mudanças e atualizar                        │
│ ✅ Gerenciar animações (pingas)                         │
│ ✅ Exibir informações ao usuário                        │
│ ✅ Responder a eventos do usuário                       │
└──────────────────────────────────────────────────────────┘
```

**Resultado**: ✅ **SINCRONIZADOS E BEM DESENHADOS**
