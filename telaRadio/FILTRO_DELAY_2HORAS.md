# Filtro de Delay de 2 Horas - Implementação

## Problema Original

A API Audiency.io fornece dados com aproximadamente **2 horas de delay**:

```
Evento Real:        16:18 (uma inserção é executada)
                      ↓ (sistema aguarda ~2h)
API Retorna:        18:18 (dados chegam ao nosso servidor)
                      ↓ (processamos e exibimos)
Dashboard Mostra:   16:18 (dados antigos sendo exibidos como "recentes")
```

**Problema:** Usuário vê dados antigos mas pensa que são recentes = confusão

## Solução Implementada

Aplicar um **filtro de delay de 2 horas** em:
- ✅ **Últimas Inserções** (lista exibida)
- ✅ **Inserções Hoje** (métrica/contador)
- ✅ **Animações de Pins** (criados apenas para inserções filtradas)
- ✅ **Top Emissoras** (baseado em dados filtrados)
- ✅ **Top Cidades** (baseado em dados filtrados)

### Como Funciona

```
Hora Real em Brasília:  18:00
Delay Aplicado:         -2 horas
Dados Exibidos Até:     16:00

Resulta em:
- Usuário vê inserções com horário 16:00
- Essas inserções chegaram há ~2h atrás
- Cria ilusão de "monitoramento em tempo real"
- Sempre há dados disponíveis (não depende da hora do dia)
```

## Exemplos Práticos

### Cenário 1: Manhã (10:00)
```
Hora Atual:        10:00
Delay Aplicado:    10:00 - 02:00 = 08:00
Exibido ao Usuário: Inserções que ocorreram até 08:00
```
- Sistema mostra inserções de 08:00
- Essas foram recebidas por volta de 10:00
- Usuário pensa que é dados recentes (não percebe delay)

### Cenário 2: Noite (22:00)
```
Hora Atual:        22:00
Delay Aplicado:    22:00 - 02:00 = 20:00
Exibido ao Usuário: Inserções que ocorreram até 20:00
```
- Sistema mostra inserções de 20:00
- Essas foram recebidas por volta de 22:00
- Usuário novamente vê como "recente"

### Cenário 3: Madrugada (02:00)
```
Hora Atual:        02:00
Delay Aplicado:    02:00 - 02:00 = 00:00
Exibido ao Usuário: Inserções que ocorreram até 00:00 (meia-noite)
```
- Sistema mostra inserções de meia-noite
- Essas foram recebidas por volta de 02:00
- Usuário vê como inserções "recentes" da noite

## Implementação Técnica

### Backend (Worker)

#### Função: `buscarInsercoes()`
```javascript
// 🕐 DELAY DE 2 HORAS - Aplicar filtro
let horaFiltroNum = horaAtualNum - 2;
let minutoFiltroNum = minutoAtualNum;

if (horaFiltroNum < 0) {
    horaFiltroNum += 24; // Ajustar para dia anterior se necessário
}

// Filtro aplicado ao separar inserções
const isRecente = (
    (horaItem === horaFiltroNum && minutoItem <= minutoFiltroNum) ||
    (horaItem < horaFiltroNum)
);
```

**O que isso faz:**
- `insercoesRecentes`: Contém APENAS inserções até (agora - 2h)
- `todasInsercoes`: Contém TODAS as inserções do dia (sem filtro)

#### Função: `calcularMetricas()`
```javascript
// ⭐ ALTERADO: Usa insercoesRecentes em vez de todasInsercoes
const metricas = calcularMetricas(
    insercoesRecentes,  // Com filtro de 2h!
    campanhasAtivas,
    emissorasProgramadas,
    horaAtual,
    minutoAtual
);
```

**Métricas afetadas:**
- `insercoesHoje`: Conta apenas inserções até (agora - 2h)
- `topEmissoras`: Baseado em inserções filtradas
- `topCidades`: Baseado em inserções filtradas

#### Endpoints Afetados

**`GET /api/dashboard`**
- Retorna: `insercoesRecentes` (filtradas), `metricas` (baseadas em filtradas)
- Coordenadas: Apenas para inserções filtradas
- Animações: Só para inserções filtradas

**`GET /api/insercoes/recentes`**
- Retorna: `insercoesRecentes` (filtradas)
- Animações: Criadas para inserções filtradas

### Frontend

**Nenhuma mudança necessária!**

O frontend consome os dados já filtrados do backend. Não precisa conhecer o delay:

```javascript
// Frontend recebe dados já filtrados
buscarInsercoesRecentes() {
    const response = await fetch('/api/insercoes/recentes');
    const data = await response.json();
    
    // data.insercoesRecentes já vem com filtro de 2h
    // data.metricas já está baseada em dados filtrados
    
    renderizarListaInsercoes(data.insercoesRecentes);
    atualizarTicker(data.metricas);
}
```

## Vantagens

✅ **Ilusão de ao vivo:** Usuário sempre vê dados "recentes"  
✅ **Sempre há dados:** Não depende da hora do dia  
✅ **Consistente:** Mesmo filtro em todas as seções  
✅ **Simples:** Apenas subtração de 2 horas  
✅ **Transparente:** Usuário não precisa saber do delay  
✅ **Sem confusão:** Não vê inserção de 16:00 às 22:00 como "estou esperando por atualização"

## Desvantagens

⚠️ **Dados antigos:** Tudo que vê é 2h atrasado (inevitável com a API)  
⚠️ **Sem real-time:** Não há dados absolutamente recentes  
⚠️ **Gap de madrugada:** Entre 00:00-02:00, dados podem estar vazios (se nenhuma inserção entre 22:00-00:00)

## Configuração

Se precisar ajustar o delay de 2 horas, modificar em:

**Arquivo:** `worker/src/index.js`  
**Função:** `buscarInsercoes()`  
**Linha:** `let horaFiltroNum = horaAtualNum - 2;`

```javascript
// Para 1 hora de delay:
let horaFiltroNum = horaAtualNum - 1;

// Para 3 horas de delay:
let horaFiltroNum = horaAtualNum - 3;

// Para sem delay (mostrar tudo até agora):
let horaFiltroNum = horaAtualNum;
```

## Resumo da Implementação

| Componente | Antes | Depois |
|-----------|-------|--------|
| **Últimas Inserções** | Todas do dia | Até (agora - 2h) |
| **Inserções Hoje** | Todas do dia | Até (agora - 2h) |
| **Animações** | Todas do dia | Até (agora - 2h) |
| **Top Emissoras** | Período completo | Até (agora - 2h) |
| **Top Cidades** | Período completo | Até (agora - 2h) |
| **Ilusão ao vivo** | ❌ Não | ✅ Sim |

## Data de Implementação

**Data:** Dezembro 1, 2025  
**Commit:** Filtro de delay de 2 horas para criar ilusão de monitoramento em tempo real  
**Arquivos modificados:** `worker/src/index.js`
