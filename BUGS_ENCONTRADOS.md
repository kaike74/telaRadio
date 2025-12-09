# 🐛 Relatório de Bugs - Dashboard Rádio

## Resumo
Encontrados **6 bugs críticos** que causam discrepâncias entre backend e frontend.

---

## 🔴 BUG #1: Gráfico de Emissoras - Dados Incorretos
**Arquivo:** `worker/src/index.js` - função `calcularMetricas()`  
**Tipo:** Lógica de cálculo errada  
**Severidade:** CRÍTICA

### Problema:
```javascript
// ERRADO - No worker, está usando TODAS as emissoras programadas
const topEmissoras = emissorasProgramadas
    .sort((a, b) => b.totalCampanhas - a.totalCampanhas)
    .slice(0, 10)
    .map(e => ({
        emissora: e.name,
        campanhas: e.totalCampanhas  // ❌ Usa totalCampanhas (programado)
    }));
```

### O que acontece:
- Backend retorna as **emissoras programadas** (campanhas já agendadas)
- Frontend renderiza corretamente o valor que recebe
- **MAS** o frontend deveria mostrar apenas emissoras que **realmente tiveram inserções hoje**

### Solução:
Filtrar emissoras para mostrar apenas as que tiveram inserções executadas no dia.

---

## 🔴 BUG #2: Cálculo de Top Cidades Incorreto
**Arquivo:** `worker/src/index.js` - função `calcularMetricas()`  
**Tipo:** Lógica de extração de dados  
**Severidade:** CRÍTICA

### Problema:
```javascript
// Extrair cidade da string do nome da emissora
// Formato: "Nome da Rádio (Frequência) - UF | Cidade"
const cidadeMatch = emissora.name.match(/-\s*([A-Z]{2})\s*\|\s*(.+)$/);
```

### O que acontece:
- Assume que todas as emissoras seguem o padrão exato: `- UF | Cidade`
- Se a emissora não tem esse padrão, o regex não captura
- Resultado: Cidades não encontradas ou incorretas

### O que deveria ser:
- Contar cidades com base nas **inserções realmente executadas**
- Não nas emissoras programadas

---

## 🔴 BUG #3: Métrica "Inserções Hoje" Desincronizada
**Arquivo:** `script.js` - função `atualizarAnimacoes()` e `script.js` - função `renderizarDashboard()`  
**Tipo:** Acúmulo de dados incorreto  
**Severidade:** ALTA

### Problema:
```javascript
// Frontend acumula contadores localmente
insercoesExibidasSet.add(animacao.id);
document.getElementById('metrica-insercoes').textContent = insercoesExibidasSet.size;

// Mas o backend envia dados diferentes
return {
    insercoesHoje: insercoes.length  // ✅ Correto no backend
}
```

### O que acontece:
1. Backend calcula inserções como: `insercoes.length` (total que passou até agora)
2. Frontend acumula localmente em `insercoesExibidasSet`
3. Quando página recarrega, perde a contagem local
4. Se backend traz 150 inserções mas frontend mostrava 200, fica inconsistente

### Solução:
Frontend deve sempre usar valor enviado pelo backend, não acumular localmente.

---

## 🔴 BUG #4: Métricas Não Refletem Inserções Reais
**Arquivo:** `worker/src/index.js` - função `calcularMetricas()`  
**Tipo:** Lógica de cálculo  
**Severidade:** CRÍTICA

### Problema:
```javascript
// Backend calcula métricas com base em EMISSORAS PROGRAMADAS
const topEmissoras = emissorasProgramadas
    .sort((a, b) => b.totalCampanhas - a.totalCampanhas)
    .slice(0, 10)

// Mas as INSERÇÕES REAIS podem ser diferentes!
```

### O que acontece:
- Uma emissora pode estar "programada" mas não ter tido inserção hoje
- Outra emissora pode ter mais inserções que o programado
- Gráfico mostra o "planejado", não o "executado"

### Exemplo:
```
Backend (programado):
- Rádio A: 10 campanhas
- Rádio B: 8 campanhas

Inserções reais hoje:
- Rádio A: 5 execuções
- Rádio B: 12 execuções ⚠️ Discrepância!
```

---

## 🔴 BUG #5: Renderização Correta de Dados Incorretos
**Arquivo:** `script.js` - funções `renderizarGraficoEmissoras()` e `renderizarGraficoCidades()`  
**Tipo:** Sintoma do Bug #4  
**Severidade:** ALTA

### Problema:
O frontend renderiza CORRETAMENTE os dados que recebe do backend.  
O problema é que os dados do backend estão **errados por design**.

```javascript
// Frontend renderiza corretamente
container.innerHTML = topEmissoras.slice(0, 8).map(emissora => {
    const larguraPercentual = (emissora.campanhas / maxValor) * 100;
    return `<div>...</div>`;
}).join('');

// ✅ Frontend está certo
// ❌ Mas topEmissoras vem errado do backend
```

### Causa Raiz:
Backend calcula `topEmissoras` baseado em **emissoras programadas**, não em **inserções executadas**.

---

## 🟡 BUG #6: Falta de Validação de Dados
**Arquivo:** `worker/src/index.js`  
**Tipo:** Falta de tratamento de erro  
**Severidade:** MÉDIA

### Problema:
```javascript
// Sem validação se a emissora tem o padrão esperado
if (cidadeMatch) {
    // ...
}
// Mas e se cidadeMatch for null para 50% das emissoras?
// Silenciosamente ignora dados!
```

### O que acontece:
- Emissoras que não seguem o padrão são ignoradas
- Contador de cidades fica incorreto
- Sem aviso no console

---

## 📊 Fluxo de Dados Correto vs Atual

### ATUAL (COM BUGS):
```
API Audiency
  ↓
Campanhas + Emissoras Programadas (24 emissoras)
  ↓
Backend calcula top 10 emissoras por campanhas PROGRAMADAS
  ↓
Frontend renderiza (está correto, mas dados estão errados)
  ↓
Dashboard mostra emissoras programadas, não executadas ❌
```

### DEVERIA SER:
```
API Audiency
  ↓
Campanhas Ativas + Inserções Executadas (dados reais)
  ↓
Backend agrupa inserções por emissora (não por programação)
  ↓
Backend calcula top 10 emissoras que REALMENTE rodaram
  ↓
Frontend renderiza (dados já corretos no backend)
  ↓
Dashboard mostra emissoras executadas ✅
```

---

## 🔧 Qual Bug Afeta o Problema Relatado?

**Problema:** "Emissoras com mais campanhas ativas mostra X no backend, Y no frontend"

**Causa:** Bug #4 + Bug #1
- Backend calcula baseado em **emissoras programadas** (valor X)
- Frontend renderiza **corretamente** o que backend envia (valor X)
- **Mas o colega esperava ver inserções reais (valor Y)**

---

## ✅ Plano de Correção

1. **Corrigir Bug #4** - Mudar lógica backend para usar inserções reais
2. **Corrigir Bug #1** - Recalcular top emissoras por inserções, não programação
3. **Corrigir Bug #3** - Frontend sempre usar valor do backend
4. **Corrigir Bug #2** - Extrair cidades das inserções, não das emissoras
5. **Corrigir Bug #5** - Será automático após Bug #4
6. **Corrigir Bug #6** - Adicionar validações e logs de erro

---

## 📝 Próximos Passos

[ ] Revisar estrutura de resposta do backend
[ ] Implementar agregação de inserções reais
[ ] Testar com dados reais da API Audiency
[ ] Comparar valores backend vs frontend
[ ] Validar cálculos de métricas
