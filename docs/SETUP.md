# 🚀 Guia de Setup - Dashboard de Monitoramento de Rádio

Este guia completo irá ajudá-lo a configurar e fazer deploy do dashboard institucional de monitoramento radiofônico.

## 📋 Pré-requisitos

### Contas Necessárias
1. **GitHub**: Para hospedar o código e CI/CD
2. **Cloudflare**: Para Worker e Pages
   - Plano Free funciona perfeitamente
   - Workers inclusos: 100.000 requests/dia
   - Pages inclusos: 500 builds/mês

### Ferramentas Locais
```bash
# Node.js 18 ou superior
node --version  # deve retornar v18.x.x ou maior

# npm (vem com Node.js)
npm --version

# Wrangler CLI (opcional para desenvolvimento local)
npm install -g wrangler
```

## 🔧 Configuração Passo a Passo

### 1️⃣ Clone o Repositório

```bash
git clone https://github.com/kaike74/telaRadio.git
cd telaRadio
```

### 2️⃣ Configurar Cloudflare Worker

#### 2.1 Criar KV Namespace (se não existe)

O projeto já está configurado para usar o namespace existente: `DASHBOARD_INSTITUCIONAL` (ID: `598948c19c524ab3af65831cd8f6278f`)

Se precisar criar um novo:

```bash
cd worker
wrangler kv:namespace create "DASHBOARD_KV"
# Copie o ID retornado e atualize em wrangler.toml
```

#### 2.2 Configurar Secrets

Configure as API keys como secrets (NUNCA commite no código):

```bash
cd worker

# API Key da Audiency.io
wrangler secret put API_KEY
# Quando solicitado, cole: 9620cf74-856d-40c2-a091-248e4f322caa

# Username do Geonames
wrangler secret put GEONAMES_USERNAME
# Quando solicitado, cole: kaike
```

#### 2.3 Instalar Dependências

```bash
npm install
```

#### 2.4 Testar Localmente

```bash
npm run dev
# Acesse http://localhost:8787/api/dashboard
```

#### 2.5 Deploy do Worker

```bash
npm run deploy
```

Após o deploy, você receberá uma URL como:
```
https://dashboard-radio-worker.seu-usuario.workers.dev
```

**IMPORTANTE**: Copie essa URL, você precisará dela no frontend!

### 3️⃣ Configurar Cloudflare Pages (Frontend)

#### 3.1 Conectar GitHub ao Cloudflare

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com)
2. Vá em **Pages** > **Create a project**
3. Conecte sua conta GitHub
4. Selecione o repositório `telaRadio`

#### 3.2 Configurações do Build

- **Project name**: `dashboard-radio`
- **Production branch**: `main`
- **Build command**: (deixe vazio)
- **Build output directory**: `.` (raiz do projeto)
- **Root directory**: `/` (raiz do projeto)

#### 3.3 Variáveis de Ambiente

Não são necessárias para o frontend estático.

#### 3.4 Deploy

Clique em **Save and Deploy**

Após o deploy, você receberá uma URL como:
```
https://dashboard-radio.pages.dev
```

### 4️⃣ Conectar Frontend ao Worker

#### 4.1 Atualizar URL da API

Edite `script.js` (na raiz) e atualize a URL do worker:

```javascript
const CONFIG = {
    // Substitua pela URL do seu worker
    API_BASE: 'https://dashboard-radio-worker.SEU-USUARIO.workers.dev',
    POLLING_INTERVAL: 5000,
    DASHBOARD_REFRESH_INTERVAL: 60000,
};
```

#### 4.2 Commit e Push

```bash
git add script.js
git commit -m "Update: Configurar URL do worker"
git push origin main
```

O GitHub Actions irá fazer o deploy automaticamente!

### 5️⃣ Configurar GitHub Actions (Deploy Automático)

#### 5.1 Obter Tokens da Cloudflare

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com)
2. Vá em **My Profile** > **API Tokens**
3. Clique em **Create Token**
4. Use o template **Edit Cloudflare Workers**
5. Copie o token gerado

#### 5.2 Obter Account ID

1. Acesse o dashboard da Cloudflare
2. Clique em qualquer domínio ou Workers
3. Copie o **Account ID** da URL ou da barra lateral

#### 5.3 Adicionar Secrets no GitHub

1. Acesse seu repositório no GitHub
2. Vá em **Settings** > **Secrets and variables** > **Actions**
3. Clique em **New repository secret**

Adicione os seguintes secrets:

| Nome | Valor |
|------|-------|
| `CLOUDFLARE_API_TOKEN` | Token da API criado acima |
| `CLOUDFLARE_ACCOUNT_ID` | Seu Account ID da Cloudflare |

#### 5.4 Testar Deploy Automático

```bash
git add .
git commit -m "Test: CI/CD setup"
git push origin main
```

Vá em **Actions** no GitHub e acompanhe o deploy!

## 🗺️ Adicionar Mapa do Brasil (SVG)

O arquivo `mapa-brasil.svg` (na raiz) está como placeholder.

### Opções para obter o SVG:

1. **Wikimedia Commons**: [Mapa do Brasil SVG](https://commons.wikimedia.org/wiki/File:Brazil_location_map.svg)
2. **Mapshaper**: Converter GeoJSON para SVG
3. **Criar no Figma/Illustrator**

**Requisitos do SVG**:
- ViewBox: `0 0 1000 1000` (ou proporcional)
- Coordenadas aproximadas do Brasil:
  - Lat: -33 a 5
  - Lng: -73 a -34

Substitua o conteúdo de `mapa-brasil.svg` pelo SVG real e faça commit:

```bash
git add mapa-brasil.svg
git commit -m "Update: Adicionar mapa do Brasil"
git push origin main
```

## 🧪 Testando o Dashboard

### 1. Testar Worker

```bash
# Endpoint principal
curl https://dashboard-radio-worker.SEU-USUARIO.workers.dev/api/dashboard

# Inserções recentes
curl https://dashboard-radio-worker.SEU-USUARIO.workers.dev/api/insercoes/recentes
```

### 2. Testar Frontend

Acesse: `https://dashboard-radio.pages.dev`

Verifique:
- ✅ Métricas estão carregando
- ✅ Gráficos aparecem
- ✅ Lista de inserções está populada
- ✅ Animações aparecem no mapa (se houver inserções recentes)

### 3. Debug

Abra o Console do navegador (F12):
- Verifique logs de sucesso: `✅ Dashboard atualizado`
- Verifique animações: `✨ X animações ativas`

## 🔄 Fluxo de Atualização

```
Frontend (a cada 5s)  →  /api/insercoes/recentes  →  Animações no mapa
Frontend (a cada 1min) →  /api/dashboard          →  Métricas + Gráficos

Worker (a cada 5min)  →  Busca API Audiency.io    →  Atualiza cache KV
```

## 📊 Estrutura de Cache (KV)

O Worker usa o seguinte esquema de cache:

| Chave | TTL | Conteúdo |
|-------|-----|----------|
| `dashboard-completo-YYYY-MM-DD` | 24h | Dados completos do dia |
| `ultima-atualizacao-YYYY-MM-DD` | 24h | Timestamp da última busca |
| `insercoes-YYYY-MM-DD` | 24h | Inserções + coordenadas |
| `coordenadas-YYYY-MM-DD` | 24h | Cache de geocoding |

## ⚙️ Configurações Avançadas

### Custom Domain (Opcional)

Se você tem um domínio na Cloudflare:

1. **Worker**: Configure em `wrangler.toml`:
```toml
routes = [
  { pattern = "api.seudominio.com/*", zone_name = "seudominio.com" }
]
```

2. **Pages**: Configure no dashboard da Cloudflare:
   - Pages > dashboard-radio > Custom domains
   - Adicione: `dashboard.seudominio.com`

### Ajustar Intervalos de Atualização

Edite `script.js` (na raiz):

```javascript
const CONFIG = {
    POLLING_INTERVAL: 5000,          // Animações: 5s (mínimo recomendado)
    DASHBOARD_REFRESH_INTERVAL: 60000, // Dashboard: 1min (pode aumentar)
};
```

### Aumentar Limite de Campanhas

Por padrão, o worker processa **15 campanhas** para evitar timeout.

Para aumentar, edite `worker/src/index.js`:

```javascript
// Linha ~264
for (const campanha of campanhas.slice(0, 15)) {
// Altere para: campanhas.slice(0, 30)
```

**ATENÇÃO**: Mais campanhas = mais tempo de processamento = risco de timeout no Worker.

## 🐛 Troubleshooting

### Worker retorna erro 500

**Solução**:
1. Verifique se os secrets estão configurados:
   ```bash
   wrangler secret list
   ```
2. Verifique logs:
   ```bash
   wrangler tail
   ```

### Frontend não carrega dados

**Solução**:
1. Verifique se a URL do worker está correta em `script.js`
2. Verifique CORS no browser console
3. Teste o worker diretamente no navegador

### Animações não aparecem

**Possíveis causas**:
1. Nenhuma inserção nos últimos 30s (normal)
2. Coordenadas não encontradas (verifique logs do worker)
3. SVG do mapa ainda é placeholder

### Cache desatualizado

**Forçar atualização**:
```bash
curl "https://dashboard-radio-worker.SEU-USUARIO.workers.dev/api/dashboard?forcar=true"
```

## 📱 Otimização para TV

### Resolução Recomendada
- **Full HD**: 1920x1080 (testado)
- **4K**: 3840x2160 (funciona, mas pode ser muito pequeno)

### Modo Kiosk (Navegador)

Chrome/Edge:
```bash
google-chrome --kiosk --app=https://dashboard-radio.pages.dev
```

Firefox:
```bash
firefox --kiosk https://dashboard-radio.pages.dev
```

### Auto-refresh (se browser travar)

Adicione ao final de `script.js` (na raiz):

```javascript
// Refresh completo a cada 1 hora (evita memory leak)
setTimeout(() => {
    window.location.reload();
}, 3600000);
```

## 🎯 Próximos Passos

1. ✅ Deploy completo
2. 🗺️ Substituir SVG do mapa
3. 📊 Monitorar métricas no dashboard da Cloudflare
4. 🎨 Personalizar cores/logo (se necessário)
5. 📺 Configurar TV com modo kiosk

## 🆘 Suporte

- **GitHub Issues**: [https://github.com/kaike74/telaRadio/issues](https://github.com/kaike74/telaRadio/issues)
- **Cloudflare Docs**: [developers.cloudflare.com](https://developers.cloudflare.com)
- **Wrangler Docs**: [developers.cloudflare.com/workers/wrangler](https://developers.cloudflare.com/workers/wrangler)

---

**Criado com ❤️ para monitoramento institucional de campanhas radiofônicas**
