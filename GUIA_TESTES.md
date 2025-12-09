# 🧪 GUIA DE TESTES - Sistema de Mensagens em Tempo Passado

**Data**: 02/12/2025  
**Ambiente**: Produção  
**Deploy**: https://dashboard-radio-worker.kaike-458.workers.dev

---

## ✅ ANTES DE COMEÇAR

1. Abrir o dashboard: https://seu-dominio-aqui
2. Abrir Console do Navegador (F12)
3. Verificar que não há erros vermelhos
4. Ter dados de inserção prontos (ou usar dados históricos)

---

## 🧪 TESTE 1: Variações de Mensagens

### Objetivo
Verificar que as 24 mensagens diferentes aparecem aleatoriamente

### Passos
1. **Abrir Console** (F12 → Aba "Console")
2. **Observar o ticker** por 2-3 minutos
3. **Registrar as mensagens** que aparecem
4. **Recarregar a página** (Ctrl+R)
5. **Observar novamente** por 2-3 minutos

### Esperado
```
✅ Mensagens diferentes aparecerem sucessivamente
✅ Nenhuma mensagem igual em sequência imediata
✅ Variação de estrutura:
   - Algumas com emojis: "⚡ Rádio X transmitiu..."
   - Algumas simples: "Rádio Y exibiu..."
   - Algumas curtas: "Rádio Z - Campanha A"
✅ Tempo passado em TODAS ("exibiu", "transmitiu", "passou")
```

### Falha Se
```
❌ Mesma mensagem repetir consecutivamente
❌ Mensagem em tempo presente ("está exibindo", "no ar agora")
❌ Menos de 15 variações diferentes em 3 minutos
```

---

## 🎉 TESTE 2: Detecção de Campanha Nova

### Objetivo
Verificar que campanhas novas geram informativo dourado

### Passos
1. **Registrar campanhas atuais** no console:
   ```javascript
   console.log(Array.from(campanhasDetectadas))
   ```

2. **Aguardar uma campanha NOVA** (nunca vista antes)
   - Pode usar dados históricos ou esperar inserção real

3. **Observar o ticker** - deve aparecer informativo dourado

4. **Verificar no console** que campanha foi adicionada:
   ```javascript
   console.log(Array.from(campanhasDetectadas))
   // Deve incluir a nova campanha
   ```

### Esperado
```
📺 Ticker Normal:
"14:35 · Rádio Globo exibiu a campanha [NOVA] em Rio de Janeiro"

📺 Informativo Especial (LOGO ABAIXO, em DOURADO #FFD700):
"🎉 RÁDIO GLOBO INICIA HOJE A NOVA CAMPANHA: [NOVA]"

✅ Dourado aparece apenas UMA VEZ por campanha
✅ Quando recarregar, desaparece (memória limpa)
```

### Falha Se
```
❌ Informativo não aparece
❌ Informativo aparece múltiplas vezes
❌ Informativo não é dourado
❌ Campanha não é adicionada a campanhasDetectadas
```

### Debug
```javascript
// Verificar se é campanha nova
console.log(campanhasDetectadas);

// Forçar teste (se houver dados)
window.DEBUG.testarMilestone?.();
```

---

## 🎯 TESTE 3: Milestones (10, 50, 100+)

### Objetivo
Verificar que milestones são detectados corretamente

### Prerequisitos
Você precisa de dados com múltiplas inserções da mesma campanha.  
Se não tiver, pode:
- Usar dados históricos
- Inserir múltiplas inserções manualmente
- Esperar que o sistema acumule naturalmente

### Passos para Teste Manual

#### 3A: Milestone 10
1. **Criar 10 inserções** da mesma campanha em mesma emissora
   ```
   Exemplo: Rádio Globo + Campanha "Cerveja X" (10 vezes)
   ```

2. **Verificar no console** a contagem:
   ```javascript
   console.log(milestoneCampanhas);
   // Deve mostrar: "Radio Globo-Cerveja X" → 10
   ```

3. **Observar o ticker**:
   - Deve aparecer inserção normal
   - Logo abaixo: informativo em ROSA ESCURO (#FF6B9D)
   - Mensagem deve conter "10"

#### 3B: Milestone 50
1. **Criar 50 inserções** da mesma campanha
2. **Ticker deve exibir**:
   ```
   Inserção normal...
   50️⃣ METADE DO CAMINHO: [Campanha] EM [Rádio] CHEGA A 50!
   ```

#### 3C: Milestone 100
1. **Criar 100 inserções** da mesma campanha
2. **Ticker deve exibir**:
   ```
   Inserção normal...
   🎖️ [Rádio] ALCANÇOU 100 INSERÇÕES COM [Campanha]!
   ```

#### 3D: Acima de 100
1. **Campanha com 150+ inserções**
2. **Ticker deve exibir**:
   ```
   Inserção normal...
   🔥 [Campanha] DOMINA [Rádio] COM 156 INSERÇÕES!
   ```

### Esperado
```
✅ Cada milestone dispara UMA VEZ
✅ Informativo com cor ROSA ESCURO (#FF6B9D)
✅ Informativo contém número correto
✅ Apenas quando passa de um limite (10→50, 50→100, etc)
✅ milestoneCampanhas atualiza corretamente
```

### Falha Se
```
❌ Milestone não dispara
❌ Milestone dispara múltiplas vezes
❌ Informativo tem cor errada
❌ Número no informativo está incorreto
❌ milestoneCampanhas não atualiza
```

### Debug
```javascript
// Ver contagem de campanhas
console.log(milestoneCampanhas);

// Forçar detecção manual (teste)
detectarMilestone("Rádio Teste", "Campanha Teste", 50);
```

---

## 🎨 TESTE 4: Cores Visuais

### Objetivo
Verificar que cores correspondem ao tipo de evento

### Passos
1. **Abrir elementos no Inspector** (F12 → Elements)
2. **Procurar ticker items** por classe `ticker-item`
3. **Verificar propriedades de cor**

### Esperado
```
Inserção Normal:
├─ color: #E03D99 (Rosa claro)
└─ Exemplo: "Rádio Globo exibiu..."

Campanha Nova:
├─ color: #FFD700 (Dourado)
└─ Exemplo: "🎉 RÁDIO GLOBO INICIA HOJE..."

Milestone:
├─ color: #FF6B9D (Rosa escuro)
└─ Exemplo: "🎖️ RÁDIO GLOBO ALCANÇOU 100..."
```

### Verificação Visual
1. Olhar para o ticker
2. Identifique visualmente:
   - Rosa claro = Inserção normal ✅
   - Dourado = Campanha nova ✅
   - Rosa escuro = Milestone ✅

### Falha Se
```
❌ Cores não correspondem
❌ Todos items mesma cor
❌ Cores HTML incorretas
```

---

## 🔄 TESTE 5: Integração com Polling

### Objetivo
Verificar que sistema funciona com polling automático

### Passos
1. **Abrir dashboard** normalmente
2. **Deixar aberto por 10 minutos** (sem interrupção)
3. **Observar ticker** atualizando a cada 5 segundos
4. **Verificar console** para logs:
   ```
   ✅ Deve ver: "📺 atualizarTicker INICIADO"
   ✅ A cada 5 segundos (CONFIG.POLLING_INTERVAL)
   ```

### Esperado
```
✅ Ticker atualiza a cada ~5 segundos
✅ Novas inserções aparecem continuamente
✅ Sem erros no console
✅ Informativos aparecem em tempo real
✅ Milestones detectados automaticamente
```

### Falha Se
```
❌ Ticker não atualiza
❌ Demora > 10 segundos para atualizar
❌ Erros no console
❌ Informativos aparecem com delay
```

---

## 📱 TESTE 6: Responsividade (Diferentes Telas)

### Objetivo
Verificar que sistema funciona em TV, Desktop, Tablet, Mobile

### TV (1920x1080)
1. Abrir em TV ou window grande
2. ✅ Ticker scrolls suavemente
3. ✅ Texto legível
4. ✅ Cores visuais aparecem corretamente

### Desktop (1280x720)
1. Abrir em monitor normal
2. ✅ Layout preservado
3. ✅ Sem overflow de texto

### Tablet (768x1024)
1. Redimensionar janela
2. ✅ Ticker adaptável
3. ✅ Text wrapping funciona

### Mobile (375x667)
1. Abrir em celular
2. ✅ Funcionamento aceitável (ticker pode truncar)
3. ✅ Sem erros críticos

---

## 🛠️ TESTE 7: Verificação de Console

### Objetivo
Usar ferramentas de debug do sistema

### Passos
1. **Abrir Console** (F12)
2. **Executar comando de status**:
   ```javascript
   window.DEBUG.status();
   ```

### Esperado
```
📊 Status do Dashboard:
   Dispositivo: tv (ou desktop/tablet/mobile)
   Animações ativas: X
   Inserções rastreadas: Y
   IDs memorizados: [...]
   Dashboard data: Carregado
   Inserções recentes: N
   Métricas: {...}
```

### Verificar Rastreamento
```javascript
// Ver campanhas detectadas
console.log(campanhasDetectadas);
// Deve conter: "Rádio-Campanha" strings

// Ver milestones rastreados
console.log(milestoneCampanhas);
// Deve conter: "Rádio-Campanha" → número
```

### Verificar Dados Recebidos
```javascript
// Ver dashboard data
console.log(dashboardData);
// Deve ter:
// - insercoesRecentes: Array
// - todasInsercoes: Array
// - metricas: Object
// - coordenadas: Array
```

---

## 📊 TESTE 8: Performance

### Objetivo
Verificar que sistema não impacta performance

### Passos
1. **Abrir DevTools** (F12)
2. **Aba "Performance"**
3. **Clicar em Record**
4. **Deixar rodar por 30 segundos**
5. **Parar gravação**
6. **Analisar gráfico**

### Esperado
```
✅ CPU < 20% idle time
✅ Memory < 100MB
✅ Sem "jank" (stuttering)
✅ FPS > 30fps durante scroll
✅ Frames verdes (não vermelhos)
```

### Falha Se
```
❌ CPU > 50%
❌ Memory > 200MB
❌ FPS < 20fps
❌ Frames vermelhos
❌ Stuttering visível
```

---

## 🔍 TESTE 9: Verificação de Dados Recebidos

### Objetivo
Confirmar que backend envia todasInsercoes corretamente

### Passos
1. **Abrir DevTools** (F12)
2. **Aba "Network"**
3. **Procurar request: `/api/dashboard`**
4. **Clicar nela**
5. **Aba "Response"**
6. **Procurar por `todasInsercoes`**

### Esperado
```json
{
  "success": true,
  "timestamp": "...",
  "metricas": {...},
  "coordenadas": [...],
  "insercoesRecentes": [...],
  "todasInsercoes": [...],  // ✅ DEVE ESTAR AQUI
  "debug": {...}
}
```

### Verificação no Frontend
```javascript
// Verificar se frontend recebeu
console.log(dashboardData.todasInsercoes);
// Deve ser um Array com todas as inserções do dia
```

### Falha Se
```
❌ todasInsercoes não está na resposta
❌ todasInsercoes é null/undefined
❌ todasInsercoes não é um Array
```

---

## 📋 CHECKLIST FINAL

- [ ] Teste 1: 24 Variações funcionam ✅
- [ ] Teste 2: Campanha nova detectada ✅
- [ ] Teste 3: Milestones 10, 50, 100 funcionam ✅
- [ ] Teste 4: Cores corretas (Rosa, Dourado, Rosa escuro) ✅
- [ ] Teste 5: Polling funciona cada 5s ✅
- [ ] Teste 6: Responsivo em TV/Desktop/Mobile ✅
- [ ] Teste 7: Debug tools funcionam ✅
- [ ] Teste 8: Performance boa (< 20% CPU) ✅
- [ ] Teste 9: todasInsercoes no backend ✅

---

## 🚨 TROUBLESHOOTING

### Problema: Mensagens em tempo presente
**Solução**: Verificar se variações estão corretas em `variacoesMensagensTicker`

### Problema: Informativos não aparecem
**Solução**: 
1. Verificar console para erros
2. Confirmar que `todasInsercoes` está no response
3. Verificar contagem em `detectarMilestone()`

### Problema: Cores erradas
**Solução**: Procurar por `color:` em `atualizarTicker()` e ajustar valores hex

### Problema: Memory leak
**Solução**: 
1. `campanhasDetectadas` e `milestoneCampanhas` devem resetar ao recarregar
2. Se necessário, implementar limpeza manual

### Problema: Lentidão
**Solução**:
1. Reduzir tamanho de `insercoesRecentes` se > 100
2. Otimizar seleção aleatória
3. Verificar se há memory leak

---

## 📞 CONTATO PARA AJUDA

Se encontrar problemas:

1. **Verificar console** (F12) para erros
2. **Executar** `window.DEBUG.status()`
3. **Verificar** deploy ID: `2116f4d1-9f77-4ab7-8e0b-7a02d41896bf`
4. **Documentar** exatamente o que falhou
5. **Contatar** desenvolvedor com screenshots + console errors

---

**Data de Teste Recomendada**: 03/12/2025  
**Versão**: 1.0 Produção  
**Status**: ✅ PRONTO PARA TESTE
