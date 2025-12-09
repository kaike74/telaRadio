# 📊 Explicação das Métricas de "Top" - Emissoras e Cidades

## 🎯 Visão Geral

O sistema calcula dois "rankings" diferentes baseados em dados distintos:

| Métrica | Fonte de Dados | O que Conta | Resultado |
|---------|---|---|---|
| **Top Emissoras** | Campanhas programadas | Nº de campanhas diferentes | Quais rádios têm mais campanhas ativas |
| **Top Cidades** | Inserções reais executadas | Nº de rádios diferentes | Onde estão acontecendo mais transmissões |

---

## 1️⃣ TOP EMISSORAS POR CAMPANHAS

### **Estrutura de Dados**
```javascript
// Fonte: emissorasProgramadas (vem de buscarEmissorasProgramadas)
{
    name: "Massa FM (97.7) - SC",
    id: 12345,
    city: "Blumenau",
    uf: "SC",
    campanhas: [           // ← ISTO É O QUE CONTA!
        { id: 1, name: "Campanha A", client: "Cliente X" },
        { id: 2, name: "Campanha B", client: "Cliente Y" },
        { id: 3, name: "Campanha C", client: "Cliente Z" }
    ],
    totalCampanhas: 3      // ← Número de campanhas nesta rádio
}
```

### **Lógica de Cálculo**

```javascript
// Função: calcularMetricas() - linhas 969-1000
const emissorasTopMap = new Map();

// Para CADA emissora programada
emissorasProgramadas.forEach(emissora => {
    // Conta quantas campanhas DIFERENTES ela tem
    emissora.campanhas.forEach(camp => {
        emissoraData.campanhas.add(camp.name);  // ← Set evita duplicatas
    });
});

// Ordena por número de campanhas (descendente)
const topEmissoras = Array.from(emissorasTopMap.values())
    .map(e => ({
        emissora: e.name,
        campanhas: e.campanhas.size  // ← Número de campanhas
    }))
    .sort((a, b) => b.campanhas - a.campanhas)  // ← Ordena decrescente
    .slice(0, 10);  // ← Top 10
```

### **Exemplo de Resultado**

```
TOP EMISSORAS POR CAMPANHAS (Período Completo - 245 emissoras):

1. Massa FM (97.7) - SC          → 12 campanhas
2. NDFM FM (100.7) - SC          → 11 campanhas
3. Menina FM (97.5) - SC         → 10 campanhas
4. Jovem Pan AM (1220) - SP      → 9 campanhas
5. Rádio O Globo (1080) - RJ     → 8 campanhas
...
10. Capital FM (94.3) - MG       → 5 campanhas
```

### **O Que Significa?**

✅ **Massa FM tem 12 campanhas**
- 12 campanhas diferentes estão programadas para tocar em Massa FM
- Não importa quantas vezes cada campanha vai ao ar (pode ser 100 inserções)
- O que importa é a DIVERSIDADE de campanhas

❌ **NÃO é o número de inserções**
- Se Campanha A vai 50x em Massa FM, conta como 1 (uma campanha)
- Não é: "quantas vezes tocou", é "quantas campanhas diferentes"

---

## 2️⃣ TOP CIDADES POR EMISSORAS

### **Estrutura de Dados**
```javascript
// Fonte: insercoesRecentes (vem de buscarInsercoes)
{
    stationName: "Massa FM (97.7)",
    city: "Blumenau",        // ← ISTO É O QUE CONTA!
    uf: "SC",
    hour: "14:30",
    date: "2025-12-05",
    campaign: "Campanha A",
    campaignId: 123
}
```

### **Lógica de Cálculo**

```javascript
// Função: calcularMetricas() - linhas 1007-1030
const cidadesMap = new Map();

// Para CADA inserção real
insercoes.forEach(insercao => {
    const pracaKey = `${insercao.city}-${insercao.uf}`;
    
    // Agrupa por cidade e conta EMISSORAS DIFERENTES nela
    pracaData.emissoras.add(insercao.stationName);  // ← Set evita duplicatas
});

// Ordena por número de emissoras (descendente)
const topCidades = Array.from(cidadesMap.values())
    .map(praca => ({
        cidade: `${praca.cidade}/${praca.uf}`,
        emissoras: praca.emissoras.size  // ← Número de emissoras
    }))
    .sort((a, b) => b.emissoras - a.emissoras)
    .slice(0, 10);
```

### **Exemplo de Resultado**

```
TOP CIDADES POR EMISSORAS (485 cidades):

1. São Paulo / SP             → 187 emissoras
2. Rio de Janeiro / RJ        → 156 emissoras
3. Belo Horizonte / MG        → 98 emissoras
4. Salvador / BA              → 87 emissoras
5. Blumenau / SC              → 76 emissoras
...
10. Curitiba / PR             → 45 emissoras
```

### **O Que Significa?**

✅ **São Paulo tem 187 emissoras**
- 187 rádios DIFERENTES transmitiram inserções em São Paulo hoje
- Se Massa FM transmitiu 50 vezes em SP, conta como 1 emissora
- Se Jovem Pan também transmitiu em SP, conta como +1 emissora

❌ **NÃO é o número de inserções**
- Se 187 emissoras × 10 inserções cada = 1870 inserções em SP
- Mas a métrica mostra: 187 (número de emissoras diferentes)

---

## 🔄 Fluxo de Distribuição de Dados

```
API AUDIENCY
    ↓
[1] buscarEmissorasProgramadas()
    └─ Fetch: /advertiser-rest/campaigns/{id}/programmed-station-filter
    └─ Retorna: Array de emissoras com suas campanhas
    └─ Salva em: emissorasProgramadas
    ↓
[2] buscarInsercoes()
    └─ Fetch: /advertiser-rest/reports/.../advertiser-execution
    └─ Retorna: Array de inserções executadas (com city, stationName)
    └─ Retorna: todasInsercoes, insercoesRecentes
    ↓
[3] calcularMetricas()
    ├─ Entrada 1: emissorasProgramadas ← USADA PARA TOP EMISSORAS
    │   └─ Calcula: Campanhas por emissora
    │   └─ Resultado: topEmissoras (max 10)
    │
    └─ Entrada 2: insercoes (todasInsercoes ou insercoesRecentes)
        └─ Calcula: Emissoras por cidade
        └─ Resultado: topCidades (max 10)
```

---

## 📋 Diferenças-Chave

### **TOP EMISSORAS**

| Aspecto | Valor |
|---------|-------|
| **Base de dados** | Campanhas programadas (do setup) |
| **Métrica** | Número de campanhas diferentes |
| **Intervalo** | Período COMPLETO (24h) |
| **Muda quando** | Novas campanhas são criadas |
| **Exemplo** | Massa FM: 12 campanhas diferentes |

**Interpretação:** "Quais rádios estão sendo usadas para mais campanhas diferentes?"

---

### **TOP CIDADES**

| Aspecto | Valor |
|---------|-------|
| **Base de dados** | Inserções executadas (ao vivo) |
| **Métrica** | Número de emissoras diferentes |
| **Intervalo** | Período com dados (últimas 2h filtradas) |
| **Muda quando** | Novas inserções são executadas |
| **Exemplo** | São Paulo: 187 emissoras diferentes |

**Interpretação:** "Quais cidades estão recebendo transmissões de mais rádios diferentes?"

---

## 🔗 Relação Entre As Duas

```
ANTES (Setup):
    Massa FM está programada para: [Campanha A, B, C, D]
    Jovem Pan está programada para: [Campanha A, B, C]
    
    → Top Emissoras mostra:
      1. Massa FM (4 campanhas)
      2. Jovem Pan (3 campanhas)

DURANTE (Execução):
    Massa FM transmitiu em: São Paulo, Blumenau, Curitiba
    Jovem Pan transmitiu em: São Paulo, Belo Horizonte
    
    → Top Cidades mostra:
      1. São Paulo (2 emissoras: Massa FM + Jovem Pan)
      2. Blumenau (1 emissora: Massa FM)
      3. Curitiba (1 emissora: Massa FM)
      4. Belo Horizonte (1 emissora: Jovem Pan)
```

---

## ⚠️ Pontos Importantes

### **1. TOP EMISSORAS é ESTÁTICO**
- Calculado UMA VEZ por dia (no primeiro load)
- Armazenado em cache de 24h
- Não muda com novas inserções
- Só muda quando campanhas são adicionadas/removidas

### **2. TOP CIDADES é DINÂMICO**
- Calculado a cada requisição de `/api/insercoes/recentes`
- Baseado em dados em tempo real
- Muda conforme novas inserções chegam
- Sempre atualizado

### **3. Filtro de 2 Horas**
Ambas as métricas usam o filtro de 2 horas:
```javascript
// Exemplo: Se agora são 18:00
// Mostra inserções até 16:00 (não 18:00)
// Isso cria ilusão de "ao vivo" mesmo com delay na API
```

---

## 🐛 Possíveis Problemas

### **TOP EMISSORAS vazio?**
```
Causa: emissorasProgramadas.length === 0
Verificar: 
  ✓ Campanhas ativas para o dia
  ✓ Se as campanhas têm emissoras programadas
  ✓ Resposta da API /programmed-station-filter
```

### **TOP CIDADES vazio?**
```
Causa: insercoes sem campo 'city' ou vazio
Verificar:
  ✓ Inserções têm city field preenchido
  ✓ Formato correto: "São Paulo" não "sao paulo"
  ✓ Separador: "São Paulo / SP"
```

### **TOP CIDADES mostra cidades sem movimento?**
```
Causa: Inserções filtradas (2h delay) mas cidades antigas ainda aparecem
Solução: Usar 'todasInsercoes' em vez de 'insercoesRecentes' se quiser histórico completo
```

---

## 📍 Localização no Código

| Função | Arquivo | Linhas | O Que Faz |
|--------|---------|--------|----------|
| `buscarEmissorasProgramadas()` | `index.js` | 500-599 | Busca emissoras e suas campanhas |
| `buscarInsercoes()` | `index.js` | 615-850 | Busca inserções executadas |
| `calcularMetricas()` | `index.js` | 946-1070 | Calcula Top Emissoras e Top Cidades |
| `calcularAnimacoesAtivas()` | `index.js` | 1073+ | Converte inserções em animações |

---

## 🎨 Como Aparecem na UI

**Frontend (`script.js`):**
```javascript
// Renderiza Top Emissoras
renderizarGraficoEmissoras(data.metricas.topEmissoras);

// Renderiza Top Cidades  
renderizarGraficoCidades(data.metricas.topCidades);
```

**HTML:**
```html
<div class="metricas-container">
    <canvas id="chart-top-emissoras"></canvas>  <!-- Bar chart -->
    <canvas id="chart-top-cidades"></canvas>    <!-- Bar chart -->
</div>
```
