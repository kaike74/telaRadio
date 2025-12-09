# 📊 MÉTRICAS - DISTRIBUIÇÃO CORRIGIDA

## ✅ TOP EMISSORAS POR CAMPANHAS

**Fonte de dados:** Inserções EXECUTADAS (dados reais do dia)
**Métrica:** Número de CAMPANHAS DIFERENTES que a emissora executou

```javascript
Rádio XYZ: 5 campanhas  (A, B, C, D, E executadas)
Rádio ABC: 3 campanhas  (A, B, C executadas)
```

**Campo no JSON:** `campanhas`
**Como é calculado:** Agrupamento por emissora + contagem de campanhas únicas

---

## ✅ TOP CIDADES POR EMISSORAS

**Fonte de dados:** Emissoras PROGRAMADAS (planejamento do dia inteiro)
**Métrica:** Número de EMISSORAS PROGRAMADAS em cada cidade

```javascript
São Paulo/SP: 15 emissoras programadas (mesmo que nenhuma tenha executado ainda)
Rio/RJ: 10 emissoras programadas
Joinville/SC: 5 emissoras programadas
```

**Campo no JSON:** `emissoras`
**Como é calculado:** Agrupamento das emissoras programadas por cidade

---

## 🔄 DIFERENÇA FUNDAMENTAL

| Métrica | Fonte | O que mostra |
|---|---|---|
| **Top Emissoras** | Inserções EXECUTADAS | O que REALMENTE aconteceu hoje |
| **Top Cidades** | Emissoras PROGRAMADAS | O que foi PLANEJADO para o dia |

---

## 📝 EXEMPLO PRÁTICO

### Cenário: 14:00 de 01/12/2025

**Inserções EXECUTADAS até agora:**
```
10:00 - Rádio A - São Paulo - Campanha 1
10:30 - Rádio B - Rio - Campanha 1
11:00 - Rádio A - São Paulo - Campanha 2
```

**Emissoras PROGRAMADAS para o dia inteiro:**
```
São Paulo: Rádio A, Rádio B, Rádio C, Rádio D (4 emissoras)
Rio: Rádio B, Rádio E, Rádio F (3 emissoras)
Brasília: Rádio C, Rádio D (2 emissoras)
```

### Resultado:

**Top Emissoras (baseado em executado):**
```
Rádio A: 2 campanhas (1, 2)
Rádio B: 1 campanha (1)
```

**Top Cidades (baseado em programado):**
```
São Paulo/SP: 4 emissoras
Rio/RJ: 3 emissoras
Brasília/DF: 2 emissoras
```

---

## 🎯 IMPLICAÇÕES

- ✅ **Top Emissoras** muda DURANTE o dia (conforme execuções ocorrem)
- ✅ **Top Cidades** NÃO muda (baseado no planejamento de 00:00)
- ✅ **Joinville aparece em Top Cidades** se estiver programada (mesmo sem execução)
- ✅ **Joinville desaparece de Top Emissoras** se não executar nada

---

## 📊 ESTRUTURA JSON RETORNADA

```json
{
  "metricas": {
    "topEmissoras": [
      { "emissora": "Rádio XYZ", "campanhas": 5 },
      { "emissora": "Rádio ABC", "campanhas": 3 }
    ],
    
    "topCidades": [
      { "cidade": "São Paulo/SP", "emissoras": 15 },
      { "cidade": "Rio/RJ", "emissoras": 10 }
    ]
  }
}
```

---

## 🔍 LOGS DO BACKEND

**Top Emissoras (executadas):**
```
📊 Top emissoras por campanhas executadas hoje (170 inserções):
   1. Rádio XYZ - 5 campanhas
   2. Rádio ABC - 3 campanhas
```

**Top Cidades (programadas):**
```
📍 Top cidades por emissoras PROGRAMADAS para hoje:
   1. São Paulo/SP - 15 emissoras programadas
   2. Rio/RJ - 10 emissoras programadas
   3. Brasília/DF - 8 emissoras programadas
```

---

## ✨ COMPORTAMENTO ESPERADO

- **Ao abrir o dashboard às 00:01:** Top Cidades mostra planejamento completo do dia
- **Conforme o dia avança:** Top Emissoras vai sendo atualizado com execuções
- **Ao final do dia:** Top Emissoras mostra tudo que realmente executou

---

**Versão:** e6a7885
**Data:** 01/12/2025
**Status:** ✅ Implementado e validado
