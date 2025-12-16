# 🔍 Análise: Por que variam de 202 → 42 → 202 inserções?

## Padrão Observado
```
1º chamada: 202 inserções
2º chamada: 42 inserções  ← MUITO MENOR
3º chamada: 202 inserções
```

---

## ✅ Causas Identificadas

### 1️⃣ **Dois Endpoints com Comportamentos Diferentes**

**`/api/insercoes/recentes`** (chamada a cada 5s)
```javascript
// script.js linha 116
const response = await fetch(`${CONFIG.API_BASE}/api/insercoes/recentes`);
// Retorna: { success: true, insercoesRecentes: [...] }
```
- Retorna inserções DOS ÚLTIMOS períodos
- Pode incluir limite de tempo (ex: últimas 24h)
- Sujeito a filtros de timestamp do servidor

**`/api/dashboard`** (chamada a cada 90s)
```javascript
// script.js linha 137
const responseCompleta = await fetch(`${CONFIG.API_BASE}/api/dashboard`);
// Retorna: { success: true, insercoesRecentes: [...], metricas: {...}, todasInsercoes: [...] }
```
- Retorna dados COMPLETOS (metricas + gráficos)
- Pode ter cache no servidor
- Pode ter timeout diferente

---

### 2️⃣ **Possível Causa do Padrão 202 → 42**

**Hipótese #1: Filtro de Atraso Dinâmico**
```
- 202 inserções: Todas as inserções até agora
- 42 inserções: Apenas inserções dos últimos 1h (ou 2h)
- 202 inserções: Reset do filtro no ciclo de 90s
```

O servidor pode estar retornando diferentes "janelas" de tempo:
- Requisição 1 (t=0s): Janela 24h → 202 resultados
- Requisição 2 (t=5s): Janela 1h → 42 resultados (filtro mais rigoroso)
- Requisição 3 (t=10s): Janela 24h → 202 resultados

**Hipótese #2: Cache Intermitente no Backend**
```
- A API pode estar retornando cache antigo às vezes
- Ou aplicando filtro de deduplicação que varia
```

**Hipótese #3: Múltiplas Requisições Concorrentes**
```
- Se /api/insercoes/recentes e /api/dashboard são chamadas quase juntas
- O servidor pode estar retornando parcialmente (fila de processamento)
- Uma vai lá com 202, a outra com 42
```

---

## 🔧 Como Diagnosticar?

### Teste 1: Monitorar Endpoints Separadamente

```javascript
// Copiar no console do navegador (F12)

// Monitorar /api/insercoes/recentes
setInterval(async () => {
    const res = await fetch('http://SEU_API_BASE/api/insercoes/recentes');
    const data = await res.json();
    console.log(`[${new Date().toLocaleTimeString()}] /insercoes/recentes: ${data.insercoesRecentes?.length || 0}`);
}, 5000);

// Monitorar /api/dashboard
setInterval(async () => {
    const res = await fetch('http://SEU_API_BASE/api/dashboard');
    const data = await res.json();
    console.log(`[${new Date().toLocaleTimeString()}] /dashboard: ${data.insercoesRecentes?.length || 0}`);
}, 10000);
```

### Teste 2: Verificar Headers da Resposta

```javascript
async function debugarRespostasAPI() {
    console.log('=== TESTANDO /api/insercoes/recentes ===');
    const res1 = await fetch('http://SEU_API_BASE/api/insercoes/recentes');
    console.log('Status:', res1.status);
    console.log('Content-Type:', res1.headers.get('content-type'));
    console.log('Cache-Control:', res1.headers.get('cache-control'));
    const data1 = await res1.json();
    console.log('Inserções:', data1.insercoesRecentes?.length);
    
    console.log('\n=== TESTANDO /api/dashboard ===');
    const res2 = await fetch('http://SEU_API_BASE/api/dashboard');
    console.log('Status:', res2.status);
    console.log('Content-Type:', res2.headers.get('content-type'));
    console.log('Cache-Control:', res2.headers.get('cache-control'));
    const data2 = await res2.json();
    console.log('Inserções:', data2.insercoesRecentes?.length);
}

debugarRespostasAPI();
```

### Teste 3: Verificar Campos nos Dados

```javascript
async function analisarDiferencas() {
    const res = await fetch('http://SEU_API_BASE/api/insercoes/recentes');
    const data = await res.json();
    
    if (data.insercoesRecentes && data.insercoesRecentes.length > 0) {
        const primeira = data.insercoesRecentes[0];
        console.log('Campos na resposta:');
        console.log(Object.keys(primeira).join(', '));
        
        // Verificar horas das inserções
        const horas = data.insercoesRecentes.map(ins => ins.hour);
        console.log('Horas na resposta:', [...new Set(horas)].sort());
    }
}

analisarDiferencas();
```

---

## 📊 Varia de Forma Previsível?

**Para você saber:** O padrão é sempre:
- 202 → 42 → 202?
- Ou é aleatório?

Se for previsível, significa que é um **ciclo de filtro temporal no servidor**.

---

## ✅ Solução Recomendada

### Opção 1: Sincronizar com Backend
Coordenar com o backend para usar **sempre o mesmo filtro temporal** em ambos endpoints.

### Opção 2: Unificar Endpoints Frontend
Usar apenas `/api/dashboard` (que parece mais completo) para tudo:
- Inserções recentes (a cada 5s)
- Métricas (a cada 90s)

### Opção 3: Implementar Cache Local
Frontend armazena dados de forma inteligente:
```javascript
const cacheLocal = {
    ultimasInsercoes: [],
    ultimaAtualizacao: null
};

function deduplicarInsercoes(novas) {
    const ids = new Set(cacheLocal.ultimasInsercoes.map(i => i.id));
    return novas.filter(ins => !ids.has(ins.id));
}
```

### Opção 4: Adicionar Logging Detalhado
Implementar logs que mostram:
- Quantidade de inserções por endpoint
- Timestamps
- Filtros aplicados
- Diferenças entre ciclos

---

## 🎯 Próximas Ações

1. **Você testa qual padrão ocorre:**
   - Sempre 202 → 42 → 202?
   - Ou varia?
   - A cada quanto tempo muda?

2. **Backend responde:**
   - Qual é o filtro aplicado no `/api/insercoes/recentes`?
   - Por que `/api/dashboard` retorna quantidade diferente?

3. **Implementamos logging** para rastrear cada chamada

---

## 📝 Checklist de Debug

```
[ ] Usar teste 1 (monitorar endpoints por 10 minutos)
[ ] Usar teste 2 (verificar headers de cache)
[ ] Usar teste 3 (analisar campos e horas)
[ ] Verificar se é padrão previsível ou aleatório
[ ] Comunicar com backend sobre filtros aplicados
[ ] Decidir solução (opção 1-4 acima)
[ ] Implementar solução escolhida
```

