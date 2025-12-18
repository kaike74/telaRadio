# 🔍 DEBUG - Fluxo Completo de Criação de Pings

## Logs Adicionados para Rastrear Problema

### 1️⃣ **atualizarTicker()** → Novo item adicionado à lista
```
🔵 criarPingaDoTicker INICIADO: {estacao} em {cidade}
```

### 2️⃣ **criarPingaDoTicker()** → Validação e criação de ID
```
⏭️ Pinga já existe: {estacao}  (Se duplicado)
🔶 Adicionando à fila: {cidade}
❌ Erro em criarPingaDoTicker: {erro}
```

### 3️⃣ **filaRequisicaoCoordenadas.adicionar()** → Enfileiramento
```
📥 [FILA] Tentando adicionar: {cidade} (fila: X/Y)
✅ Cache HIT: {cidade}  (Se já temos coordenada)
⚠️ Fila de coordenadas CHEIA  (Se MAX_FILA_SIZE atingido)
➕ Adicionando à fila: {cidade}
```

### 4️⃣ **filaRequisicaoCoordenadas.processar()** → Processamento
```
⏳ [FILA] Aguardando slot: X/Y em progresso
🔄 [FILA] Processando: {cidade} (X/Y em progresso)
✅ Coordenada encontrada: {cidade} ({lat}, {lng})
❌ Coordenada não encontrada: {cidade}
❌ API retornou erro para {cidade}: HTTP_STATUS
⏱️ Timeout buscando {cidade}
🔴 Erro buscando coordenada: {erro}
✔️ Finalizando requisição, fila restante: X
```

### 5️⃣ **criarPingaComCoordenada()** → Criação do pinga
```
🎯 criarPingaComCoordenada: {cidade} em ({lat}, {lng})
❌ Containers do mapa não encontrados
```

### 6️⃣ **criarPinga()** → SVG finalizado
```
✅ PINGA CRIADO: {estacao} em {cidade}
   Total de pings ativos: X
```

---

## 📋 Como Ler o Fluxo no Console

**Sequência esperada para SUCESSO:**
```
🔵 criarPingaDoTicker INICIADO
🔶 Adicionando à fila
📥 [FILA] Tentando adicionar
➕ Adicionando à fila
🔄 [FILA] Processando
✅ Coordenada encontrada
🎯 criarPingaComCoordenada
✅ PINGA CRIADO
```

---

## 🔴 Problemas Possíveis

### ❌ Pinga não aparece e vejo:
- **Só vejo `🔵 criarPingaDoTicker`** → Funcão é chamada mas não entra na fila
  - Verifique se `insercao.city` está preenchido
  
- **Vejo `📥 [FILA]` mas não vejo `🔄 [FILA]`** → Fila enche mas não processa
  - `MAX_SIMULTANEOUS` pode estar baixo
  - API `/api/coordenada` pode estar slow
  
- **Vejo `🔄 [FILA]` mas não vejo `✅ Coordenada encontrada`** → API falhando
  - `❌ API retornou erro` → Verifique `/api/coordenada`
  - `⏱️ Timeout` → API lenta
  - `❌ Coordenada não encontrada` → Cidade não mapeada na API
  
- **Vejo `🎯 criarPingaComCoordenada` mas não vejo `✅ PINGA CRIADO`** → Container não encontrado
  - Verifique se #animacoes-layer existe no HTML

---

## 🧪 Debug Commands (copie e cole no Console)

### Ver status da fila:
```javascript
filaRequisicaoCoordenadas.exibirStatus()
```

### Ver pings ativos:
```javascript
console.log(`Pings ativos: ${animacoesAtivas.size}`);
animacoesAtivas.forEach((pinga, id) => {
  console.log(`  - ${id}`);
});
```

### Ver cache de coordenadas:
```javascript
console.log(`Cache size: ${filaRequisicaoCoordenadas.cacheLocal.size}`);
filaRequisicaoCoordenadas.cacheLocal.forEach((coord, cidade) => {
  console.log(`  ${cidade}: (${coord.lat}, ${coord.lng})`);
});
```

### Monitorar em tempo real:
```javascript
setInterval(() => {
  filaRequisicaoCoordenadas.exibirStatus();
}, 5000);
```

---

## 📊 Métricas Esperadas

**Após 1 minuto de operação normal:**
- Fila: 0-5 (processando continuamente)
- Em progresso: 0-3 (2-3 requisições simultâneas)
- Cache: 10-50 cidades
- Total processadas: > 50
- Taxa sucesso: > 80%
- Pings ativos: 5-15

