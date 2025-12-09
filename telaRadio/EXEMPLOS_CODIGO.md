# 💻 EXEMPLOS DE CÓDIGO - Como Fazer Mudanças

**Propósito**: Referência rápida para adicionar/modificar variações

---

## 📝 Adicionar Novas Mensagens

### Localização
Arquivo: `telaRadio/script.js`, Linha ~1285

### Código Atual
```javascript
const variacoesMensagensTicker = [
    "{hora} · {emissora} exibiu a campanha {campanha} {cidade}",
    "{hora} · {emissora} transmitiu {campanha} em {cidade}",
    // ... mais 22 variações ...
];
```

### Como Adicionar

#### Método 1: Adicionar UMA mensagem
```javascript
const variacoesMensagensTicker = [
    // ... mensagens existentes ...
    
    // ⭐ NOVA MENSAGEM ADICIONADA
    "{hora} · {emissora} levou {campanha} até {cidade} com sucesso"
];
```

#### Método 2: Adicionar MÚLTIPLAS mensagens
```javascript
const variacoesMensagensTicker = [
    // ... mensagens existentes (primeiras 24) ...
    
    // ⭐ NOVAS MENSAGENS ADICIONADAS (Lote)
    "{hora} · {emissora} apresentou com destaque: {campanha}",
    "{hora} · {campanha} foi levado por {emissora} a {cidade}",
    "{hora} · {emissora} colocou {campanha} em evidência",
    "{hora} · Público de {cidade} conheceu {campanha} via {emissora}",
];
```

### Validação
```javascript
// No console (F12), verifique:
console.log(variacoesMensagensTicker.length);
// Deve mostrar: 24 + número de novas mensagens
```

---

## 🎉 Adicionar Novo Tipo de Informativo

### Localização
Arquivo: `telaRadio/script.js`, Linha ~1340

### Código Atual
```javascript
const informativos = {
    novaCampanha: [...],
    milestone10: [...],
    milestone50: [...],
    milestone100: [...],
    muitasInsercoes: [...]
};
```

### Como Adicionar - Exemplo: Milestone 200

#### Passo 1: Adicionar no objeto `informativos`
```javascript
const informativos = {
    novaCampanha: [...],
    milestone10: [...],
    milestone50: [...],
    milestone100: [...],
    milestone200: [      // ⭐ NOVO TIPO
        "⭐ {emissora} ATINGE 200 INSERÇÕES DE {campanha}!",
        "💎 {campanha} EM {emissora}: 200 TRANSMISSÕES!",
        "👑 PREMIUM: {campanha} DOMINA {emissora} COM 200 INSERÇÕES",
        "🌟 LIDERANÇA CONFIRMADA: {campanha} EM {emissora} (200!)",
        "🏅 EXCELÊNCIA: {campanha} MARCA 200 EM {emissora}"
    ],
    muitasInsercoes: [...]
};
```

#### Passo 2: Adicionar na função `detectarMilestone()`
Localização: Linha ~1400

```javascript
function detectarMilestone(estacao, campanha, contador) {
    const chaveUnica = `${estacao}-${campanha}`;
    const contagemAnterior = milestoneCampanhas.get(chaveUnica) || 0;
    
    milestoneCampanhas.set(chaveUnica, contador);
    
    // ⭐ NOVO: Adicionar milestone 200
    const milestones = [
        { limite: 100, tipo: 'milestone100' },
        { limite: 50, tipo: 'milestone50' },
        { limite: 10, tipo: 'milestone10' },
        { limite: 200, tipo: 'milestone200' }  // ⭐ NOVA LINHA
    ];
    
    // ... resto do código ...
}
```

#### Passo 3: Validar
```javascript
// No console (F12)
console.log(Object.keys(informativos));
// Deve incluir: novaCampanha, milestone10, milestone50, milestone100, milestone200, muitasInsercoes
```

---

## 🎨 Mudar Cores

### Localização
Arquivo: `telaRadio/script.js`, Linha ~1540

### Cores Atuais
```javascript
items.push({
    id: itemId,
    icon: true,
    text: mensagemTicker,
    highlight: `${cidade}`,
    color: '#E03D99'  // Rosa (inserção normal)
});

// Campanha nova
color: '#FFD700'  // Dourado

// Milestone
color: '#FF6B9D'  // Rosa escuro
```

### Como Mudar - Exemplo: Usar Azul para Campanha Nova

```javascript
if (ehCampanhaNova) {
    const informativoNova = selecionarInformativoEspecial('novaCampanha')
        .replace('{emissora}', estacao)
        .replace('{campanha}', campanha);
    
    items.push({
        id: `info-nova-${itemId}`,
        icon: true,
        text: informativoNova,
        highlight: '🎉 NOVA CAMPANHA',
        color: '#0099FF'  // ⭐ MUDADO PARA AZUL
    });
}
```

### Cores Sugeridas
```
Azul: #0099FF, #0066FF, #1E90FF
Verde: #00FF00, #00AA00, #22DD22
Vermelho: #FF0000, #FF3333, #FF6666
Roxo: #9933FF, #AA00FF, #DD00FF
Laranja: #FF9900, #FFAA00, #FFBB33
Ciano: #00FFFF, #00DDDD, #00BBBB
```

---

## 🔢 Adicionar Novo Milestone com Lógica Customizada

### Exemplo: Milestone a cada 500 inserções

#### Passo 1: Adicionar tipo no `informativos`
```javascript
const informativos = {
    // ... tipos existentes ...
    milestone500: [
        "🎖️ LENDÁRIO: {emissora} ALCANÇA 500 INSERÇÕES DE {campanha}!",
        "👑 SUPREMACIA: {campanha} ATINGE 500 EM {emissora}",
        "⭐ INTOCÁVEL: {campanha} DOMINA {emissora} COM 500 INSERÇÕES",
        "🏆 CAMPEÃO: 500 VEZES {campanha} EM {emissora}",
        "🌟 ETERNIZADO: {campanha} MARCA 500 EM {emissora}"
    ]
};
```

#### Passo 2: Adicionar lógica em `detectarMilestone()`
```javascript
function detectarMilestone(estacao, campanha, contador) {
    const chaveUnica = `${estacao}-${campanha}`;
    const contagemAnterior = milestoneCampanhas.get(chaveUnica) || 0;
    
    milestoneCampanhas.set(chaveUnica, contador);
    
    // Milestones padrão
    const milestones = [
        { limite: 100, tipo: 'milestone100' },
        { limite: 50, tipo: 'milestone50' },
        { limite: 10, tipo: 'milestone10' },
        { limite: 500, tipo: 'milestone500' }  // ⭐ NOVO
    ];
    
    for (const { limite, tipo } of milestones) {
        if (contagemAnterior < limite && contador >= limite) {
            const informativo = selecionarInformativoEspecial(tipo)
                .replace('{emissora}', estacao)
                .replace('{campanha}', campanha)
                .replace('{insercoesCount}', contador);
            
            return {
                tipo: tipo,
                mensagem: informativo,
                chaveUnica: chaveUnica
            };
        }
    }
    
    // Acima de 500
    if (contagemAnterior > 500 && contador > contagemAnterior) {
        const informativo = selecionarInformativoEspecial('muitasInsercoes')
            .replace('{emissora}', estacao)
            .replace('{campanha}', campanha)
            .replace('{insercoesCount}', contador);
        
        return {
            tipo: 'muitasInsercoes',
            mensagem: informativo,
            chaveUnica: chaveUnica
        };
    }
    
    return null;
}
```

---

## 🔍 Verificar Variações no Console

### Ver Todas as Mensagens
```javascript
variacoesMensagensTicker.forEach((msg, idx) => {
    console.log(`${idx + 1}. ${msg}`);
});
```

### Ver Informativos de Um Tipo
```javascript
console.log("Campanhas Novas:");
informativos.novaCampanha.forEach((msg, idx) => {
    console.log(`${idx + 1}. ${msg}`);
});
```

### Contar Total de Variações
```javascript
const total = variacoesMensagensTicker.length +
    Object.values(informativos).reduce((sum, arr) => sum + arr.length, 0);
console.log(`Total de variações: ${total}`);
```

---

## 🧪 Testar Mudanças Localmente

### Teste 1: Verificar Sintaxe
```javascript
// No console (F12)
try {
    selecionarVariacaoMensagem();
    console.log("✅ Mensagem OK");
} catch(e) {
    console.error("❌ Erro:", e);
}
```

### Teste 2: Verificar Informativo
```javascript
// No console (F12)
try {
    const info = selecionarInformativoEspecial('novaCampanha');
    console.log("✅ Informativo:", info);
} catch(e) {
    console.error("❌ Erro:", e);
}
```

### Teste 3: Forçar Milestone
```javascript
// No console (F12)
try {
    const resultado = detectarMilestone("Rádio Teste", "Campanha Teste", 50);
    console.log("✅ Milestone detectado:", resultado);
} catch(e) {
    console.error("❌ Erro:", e);
}
```

---

## 📦 Deploy Após Mudanças

### Se mudou Frontend (`script.js`)
```bash
# Recarregar página no navegador (Ctrl+F5)
# Nenhum deploy necessário
```

### Se mudou Backend (`worker/src/index.js`)
```bash
cd telaRadio/worker
npm run deploy
```

### Verificar Deploy
```bash
# Verificar se deploy foi bem-sucedido
npm run deploy 2>&1 | grep -i "success\|error"
```

---

## 🎯 Padrão de Mensagem

### Componentes
```
{hora} · [EMOJI] {emissora} [VERBO PASSADO] {campanha} [LOCAL]
```

### Exemplos Válidos
```
✅ "{hora} · {emissora} exibiu a campanha {campanha} {cidade}"
✅ "{hora} · ⚡ {emissora} transmitiu com força: {campanha}"
✅ "{hora} · 🎙️ {emissora} deu voz a {campanha}"
✅ "{hora} · {emissora} - {campanha}"
```

### Exemplos Inválidos
```
❌ "{hora} · {emissora} está exibindo {campanha}" (presente, não passado)
❌ "{hora} · {emissora} vai exibir {campanha}" (futuro, não passado)
❌ "{hora} · Nesse momento {emissora} {campanha}" (sem verbo claro)
```

---

## 🔄 Fazer Backup Antes de Mudar

```bash
# Antes de fazer mudanças importantes:
cp telaRadio/script.js telaRadio/script.js.backup
cp telaRadio/worker/src/index.js telaRadio/worker/src/index.js.backup
```

---

## 📋 Checklist para Adicionar Feature

- [ ] Editar arquivo apropriado
- [ ] Verificar sintaxe (sem erros de compilação)
- [ ] Testar no console (F12)
- [ ] Se backend: fazer deploy (`npm run deploy`)
- [ ] Se frontend: recarregar página (Ctrl+F5)
- [ ] Validar que funciona
- [ ] Fazer backup se bem-sucedido

---

## ⚠️ Erros Comuns e Soluções

### Erro: "Cannot read property 'length' of undefined"
```javascript
// ❌ ERRADO
const variacoesMensagensTicker = [
    "{hora} · Mensagem 1"
    "{hora} · Mensagem 2"  // Falta vírgula!
];

// ✅ CORRETO
const variacoesMensagensTicker = [
    "{hora} · Mensagem 1",
    "{hora} · Mensagem 2"
];
```

### Erro: "Unexpected token }"
```javascript
// ❌ ERRADO
const informativos = {
    novaCampanha: ["Mensagem 1", "Mensagem 2"]  // Falta vírgula antes de milestone10!
    milestone10: ["Mensagem"]
};

// ✅ CORRETO
const informativos = {
    novaCampanha: ["Mensagem 1", "Mensagem 2"],
    milestone10: ["Mensagem"]
};
```

### Erro: "selecionarVariacaoMensagem is not defined"
```javascript
// Causa: Função não foi carregada ou nome errado
// Solução: Verificar se função está declarada acima do uso
// Verificar se nome está exatamente igual
```

---

**Referência Rápida Completa**

Use este arquivo como guia ao fazer mudanças!

Para dúvidas mais específicas, consulte:
- `IMPLEMENTACAO_MESSAGNS_PASSADO.md` - Detalhes técnicos completos
- `GUIA_TESTES.md` - Como testar mudanças

---

Data: 02/12/2025  
Versão: 1.0  
Status: ✅ Produção
