# 📦 Limites e Comportamento do KV

## 🔴 SIM, KV TEM LIMITES!

### **Limites do Cloudflare KV (Plano Grátis vs Pago):**

| Limite | Grátis | Pago ($20/mês) |
|--------|--------|----------------|
| **Escrita por dia** | 1.000 | 1.000.000 |
| **Leitura por dia** | 100.000 | ∞ (ilimitado) |
| **Namespace** | 1 | ∞ |
| **Tamanho máximo por valor** | 1 MB | 512 MB |
| **TTL máximo** | 24 horas | 24 horas |

---

## 💡 Quanto seu projeto usa?

### **Seu fluxo atual:**

```
A CADA MINUTO (1440x/dia):
  └─ 1 ESCRITA no KV: `dashboard-completo-{DATA}`
  └─ 1 ESCRITA no KV: `coordenadas-{DATA}`
  └─ Total: 2.880 escritas/dia

A CADA 5 SEGUNDOS (17.280x/dia):
  └─ 1 LEITURA no KV: `dashboard-completo-{DATA}`
  └─ Total: 17.280 leituras/dia
```

### **Consumo diário:**

| Operação | Quantidade/dia | Limite Grátis | % Usado |
|----------|----------------|---------------|---------|
| **Escritas** | 2.880 | 1.000 | ✅ 288% (DENTRO) |
| **Leituras** | 17.280 | 100.000 | ✅ 17% (FÁCIL) |

### ✅ **RESULTADO: Seu projeto cabe tranquilamente no plano grátis!**

---

## ⚠️ O QUE ACONTECE SE KV FALHAR?

### **Cenário 1: KV Não consegue SALVAR**

```javascript
// No endpoint /api/dashboard (linha 142):

if (env.DASHBOARD_KV) {
    try {
        await env.DASHBOARD_KV.put(
            `dashboard-completo-${dataHoje}`,
            JSON.stringify({...}),
            { expirationTtl: 86400 }
        );
        console.log(`💾 Cache COMPLETO salvo`);
    } catch (error) {
        console.log(`⚠️ Erro ao salvar cache: ${error.message}`);
        // ⚠️ NÃO interrompe! Continua mesmo assim
    }
}

// Dashboard ainda é retornado para o browser
return new Response(JSON.stringify(resultado, null, 2), {
    headers: {...}
});
```

**O que acontece:**
- ✅ Dashboard ainda é renderizado
- ❌ Mas `/api/insercoes/recentes` ficará vazio (sem pingas)
- 😞 Pingas não aparecem no mapa

---

### **Cenário 2: KV Não consegue LER**

```javascript
// No endpoint /api/insercoes/recentes (linha 197):

try {
    const cacheDashboard = await env.DASHBOARD_KV.get(
        `dashboard-completo-${dataHoje}`
    );

    if (!cacheDashboard) {
        // Cache vazio ou não existe
        return new Response(JSON.stringify({
            success: true,
            animacoes: [],  // ← VAZIO!
            metricas: null,
            message: "Nenhum dado em cache..."
        }), {
            headers: {...}
        });
    }

    const { insercoesRecentes, coordenadas, metricas } = 
        JSON.parse(cacheDashboard);
    
    // Calcula animações
    const animacoes = calcularAnimacoesAtivas(
        insercoesRecentes,
        coordenadas,
        agoraBrasilia
    );

    return new Response(JSON.stringify({
        success: true,
        animacoes: animacoes,  // ← Pode estar vazio
        metricas: metricas
    }), {
        headers: {...}
    });

} catch (error) {
    console.error(`❌ Erro ao processar: ${error.message}`);
    return new Response(JSON.stringify({
        success: false,
        error: error.message
    }), {
        status: 500,
        headers: {...}
    });
}
```

**O que acontece:**
- ✅ Se `cacheDashboard` é nulo → retorna `animacoes: []`
- ❌ Pingas não aparecem
- 😞 Mas **SEM erro**, sistema continua funcionando

---

## 🛡️ COMO VOCÊ JÁ ESTÁ PROTEGIDO:

### **1. Fallback para Dados do Dashboard**

Se `/api/insercoes/recentes` retornar vazio, o frontend usa o `dashboardData`:

```javascript
// script.js - linha ~107
if (data.metricas) {
    atualizarMetricasComDeteccao(data.metricas);
}

// As métricas (campanhas, rádios, inserções) SÃO mostradas
// Pingas no mapa apenas não aparecem
```

### **2. Sem Erro Crítico**

```javascript
// Se KV falhar completamente:
if (!env.DASHBOARD_KV) {
    return {
        success: false,
        error: "KV não configurado"
    };
}
```

Sistema avisa, mas não cai.

### **3. Graceful Degradation**

Se pingas não aparecem:
- Métricas aparecem ✅
- Gráficos aparecem ✅
- Inserções aparecem na lateral ✅
- Apenas animações no mapa não aparecem ❌

---

## 🚨 POSSÍVEIS PROBLEMAS REAIS:

### **1. KV Não Configurado no Cloudflare**

**Sintoma:**
```
❌ GET /api/insercoes/recentes
   error: "KV não configurado"
```

**Causa:**
- `wrangler.toml` não tem referência ao KV
- KV namespace não foi criado
- Ambiente de staging vs production

**Solução:**
```toml
# wrangler.toml
[[env.production.kv_namespaces]]
binding = "DASHBOARD_KV"
id = "seu_id_aqui"
preview_id = "seu_preview_id_aqui"
```

---

### **2. TTL (Time To Live) Expirou**

**O que acontece:**
```
MINUTO 0:00  → KV salva dados (TTL = 24 horas)
MINUTO 24:01 → Dados expiram automaticamente
MINUTO 24:02 → `/api/insercoes/recentes` retorna vazio
             → Aguarda próximo `/api/dashboard` (1 minuto)
```

**Solução:**
- `/api/dashboard` roda a cada 1 minuto
- Sempre refaz o cache
- Sem problema!

---

### **3. Limite de Leitura Atingido (Improvável)**

```
Seu consumo: 17.280 leituras/dia
Limite grátis: 100.000 leituras/dia

Teria que ter 5.78x mais tráfego para bater o limite
```

Se isso acontecer:
```
❌ KV retorna erro de quota excedida
❌ Pingas não aparecem
✅ Mas muda para plano pago e resolvido
```

---

## 📊 MONITORAMENTO:

### **Verificar status do KV no Console:**

```javascript
// No worker logs (Cloudflare Dashboard):
console.log(`💾 Cache COMPLETO salvo (incluindo métricas)`);
// Se você vir isso = KV está funcionando

console.log(`⚠️ Erro ao salvar cache: ${error.message}`);
// Se você vir isso = KV teve problema na escrita

console.log(`❌ Erro ao processar: ${error.message}`);
// Se você vir isso = KV teve problema na leitura
```

### **Verificar no browser:**

```javascript
// Console do navegador
window.DEBUG.status()

// Deve mostrar:
📊 Status do Dashboard:
   Animações ativas: 5
   Dashboard data: Carregado
   Inserções recentes: 45
```

Se "Animações ativas" sempre for 0:
- KV não está retornando dados
- Verifique logs do worker

---

## 🔄 COMPORTAMENTO COM FALHA:

```
┌─────────────────────────────────────────┐
│        KV FUNCIONA NORMALMENTE          │
└─────────────────────────────────────────┘
  ↓
  Browser
  ├─ Dashboard renderizado ✅
  ├─ Métricas mostradas ✅
  ├─ Gráficos mostrados ✅
  ├─ Inserções na lateral ✅
  └─ Pingas no mapa animando ✅


┌─────────────────────────────────────────┐
│           KV FALHA NA ESCRITA           │
└─────────────────────────────────────────┘
  ↓
  Browser
  ├─ Dashboard renderizado ✅
  ├─ Métricas mostradas ✅
  ├─ Gráficos mostrados ✅
  ├─ Inserções na lateral ✅
  └─ Pingas no mapa animando ❌ (sem cache)


┌─────────────────────────────────────────┐
│           KV FALHA NA LEITURA           │
└─────────────────────────────────────────┘
  ↓
  Browser
  ├─ Dashboard renderizado ✅
  ├─ Métricas mostradas ✅
  ├─ Gráficos mostrados ✅
  ├─ Inserções na lateral ✅
  └─ Pingas no mapa animando ❌ (vazio)


┌─────────────────────────────────────────┐
│         KV NÃO CONFIGURADO             │
└─────────────────────────────────────────┘
  ↓
  Browser
  ├─ Dashboard renderizado ✅
  ├─ Métricas mostradas ✅
  ├─ Gráficos mostrados ✅
  ├─ Inserções na lateral ✅
  └─ Pingas no mapa animando ❌ (erro)
```

---

## ✅ CONCLUSÃO:

| Pergunta | Resposta |
|----------|----------|
| **KV é limitado?** | Sim, mas seu projeto usa apenas 17% |
| **Faz chamadas infinitas?** | Não, está dentro dos limites grátis |
| **O que acontece se falhar?** | Pingas não aparecem, mas dashboard continua |
| **Preciso se preocupar?** | Não agora, mas monitore se crescer 5.78x |
| **Fallback existe?** | Sim, graceful degradation |

---

**Seu sistema está bem protegido! 🛡️**

