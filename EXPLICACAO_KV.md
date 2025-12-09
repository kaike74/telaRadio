# 📦 O que o KV (Cloudflare KV) está fazendo?

## 🎯 Resumo Rápido

O **KV é um banco de dados chave-valor** na nuvem que armazena dados **em cache** para evitar chamar a API do Audiency muitas vezes.

---

## 🔄 Fluxo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRIMEIRO ACESSO (a cada 1 minuto)            │
└─────────────────────────────────────────────────────────────────┘

1. Browser chama /api/dashboard
   ↓
2. Worker no Cloudflare recebe a requisição
   ├─ Busca todas as campanhas na API Audiency
   ├─ Busca emissoras programadas para cada campanha
   ├─ Busca inserções executadas hoje
   ├─ Busca coordenadas (lat/lng) das cidades
   └─ Calcula métricas
   ↓
3. Worker SALVA tudo no KV:
   ├─ `dashboard-completo-2025-11-28` → {
   │   insercoesRecentes: [...],
   │   coordenadas: [...],
   │   metricas: {...},
   │   timestamp: 1234567890
   │ }
   └─ `coordenadas-2025-11-28` → {
       "São Paulo": {lat: -23.55, lng: -46.63},
       "Rio de Janeiro": {lat: -22.91, lng: -43.17}
      }
   ↓
4. Worker retorna dados para o browser
   ↓
5. Browser renderiza dashboard


┌─────────────────────────────────────────────────────────────────┐
│           ACESSOS SUBSEQUENTES (a cada 5 segundos)              │
└─────────────────────────────────────────────────────────────────┘

1. Browser chama /api/insercoes/recentes
   ↓
2. Worker NO CLOUDFLARE:
   ├─ Procura no KV: `dashboard-completo-2025-11-28`
   ├─ Se encontrar:
   │   ├─ Lê dados do KV (RÁPIDO!)
   │   ├─ Calcula quais inserções estão animando AGORA (últimos 30s)
   │   └─ Retorna apenas as animações
   └─ Se NÃO encontrar:
       └─ Retorna array vazio e aguarda próximo refresh
   ↓
3. Browser recebe pingas para animar
```

---

## 📊 O KV Armazena 2 Coisas:

### **1. `dashboard-completo-{DATA}`**
```javascript
{
  "insercoesRecentes": [
    {
      "stationName": "Rádio XYZ FM",
      "city": "São Paulo",
      "uf": "SP",
      "hour": "14:35:00",
      "campaign": "Campanha 1"
    },
    ...
  ],
  "coordenadas": [
    {
      "cidade": "São Paulo",
      "lat": -23.5505,
      "lng": -46.6333
    },
    ...
  ],
  "metricas": {
    "campanhasAtivas": 6,
    "emissorasAtivas": 12,
    "insercoesHoje": 45
  },
  "timestamp": 1732823100000,
  "horaAtual": "14",
  "minutoAtual": "35"
}
```

**Tempo de vida:** 24 horas (86400 segundos)

### **2. `coordenadas-{DATA}`**
```javascript
{
  "São Paulo": {
    "lat": -23.5505,
    "lng": -46.6333,
    "cidade": "São Paulo"
  },
  "Rio de Janeiro": {
    "lat": -22.9068,
    "lng": -43.1729,
    "cidade": "Rio de Janeiro"
  },
  ...
}
```

**Tempo de vida:** 24 horas

---

## ⚡ Por que usar KV?

### ❌ SEM KV (chamar API toda vez):
```
Browser → Worker → API Audiency (2-3 segundos)
         ↓
         Lento demais!
```

### ✅ COM KV (pega do cache):
```
Browser → Worker → KV (milissegundos!)
         ↓
         Super rápido!
```

---

## 📈 Fluxo de Dados Real:

```
MINUTO 1:  [GET /api/dashboard]
           └─ Busca API, salva KV, retorna dados
           └─ Tempo: 3-5 segundos

SEGUNDO 6: [GET /api/insercoes/recentes]
           └─ Lê KV, calcula pingas, retorna
           └─ Tempo: 100-200 milissegundos ⚡

SEGUNDO 11:[GET /api/insercoes/recentes]
           └─ Lê KV, calcula pingas, retorna
           └─ Tempo: 100-200 milissegundos ⚡

SEGUNDO 16:[GET /api/insercoes/recentes]
           └─ Lê KV, calcula pingas, retorna
           └─ Tempo: 100-200 milissegundos ⚡

MINUTO 2:  [GET /api/dashboard]
           └─ Busca API NOVA, atualiza KV
           └─ Tempo: 3-5 segundos
```

---

## 🔧 Como Funciona no Código:

### **SALVAR no KV (linha 142):**
```javascript
if (env.DASHBOARD_KV) {
    await env.DASHBOARD_KV.put(
        `dashboard-completo-${dataHoje}`,
        JSON.stringify({
            insercoesRecentes,
            coordenadas,
            metricas,
            timestamp: Date.now(),
            horaAtual,
            minutoAtual
        }),
        { expirationTtl: 86400 }  // Expira em 24 horas
    );
}
```

### **LER do KV (linha 197):**
```javascript
const cacheDashboard = await env.DASHBOARD_KV.get(
    `dashboard-completo-${dataHoje}`
);

if (!cacheDashboard) {
    // Sem cache, aguarda próximo refresh
    return { success: true, animacoes: [] };
}

// Com cache, processa dados
const { insercoesRecentes, coordenadas, metricas } = 
    JSON.parse(cacheDashboard);
```

---

## ⚠️ O Que Acontece se KV não está Configurado?

```javascript
if (!env.DASHBOARD_KV) {
    return {
        success: false,
        error: "KV não configurado"
    };
}
```

❌ **Sem KV:**
- `/api/dashboard` funciona (busca API)
- `/api/insercoes/recentes` retorna erro
- Pingas não aparecem

✅ **Com KV:**
- `/api/dashboard` funciona (busca API + salva KV)
- `/api/insercoes/recentes` funciona (lê KV)
- Pingas aparecem rapidamente!

---

## 🚀 Como Configurar KV no Cloudflare:

1. **Ir para Cloudflare Dashboard**
2. **Workers → KV**
3. **Criar namespace: `telaRadio-kv`**
4. **Associar ao Worker em `wrangler.toml`:**
   ```toml
   [[env.production.kv_namespaces]]
   binding = "DASHBOARD_KV"
   id = "seu_kv_id_aqui"
   preview_id = "seu_preview_id_aqui"
   ```

---

## 📝 Resumo

| Aspecto | Detalhe |
|---------|---------|
| **Função** | Cache de dados do dashboard |
| **Tempo de vida** | 24 horas |
| **O que armazena** | Inserções, coordenadas, métricas |
| **Quando salva** | A cada 1 minuto (refresh completo) |
| **Quando lê** | A cada 5 segundos (polling) |
| **Benefício** | Reduz latência de 3-5s para 100-200ms |
| **Necessário para** | Pingas aparecerem no mapa |

---

Entendido? 🎯

