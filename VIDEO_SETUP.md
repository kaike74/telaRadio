# 🎬 CONFIGURAÇÃO DE VÍDEOS - GOOGLE DRIVE

## Passos para Ativar o Sistema de Auto-Play

### 1️⃣ OBTER FOLDER_ID DO GOOGLE DRIVE

#### Opção A: Se já tem uma pasta criada
1. Abra Google Drive: https://drive.google.com
2. Clique com direito na pasta de vídeos
3. Selecione "Obter link"
4. A URL será: `https://drive.google.com/drive/folders/FOLDER_ID_AQUI`
5. Copie o **FOLDER_ID_AQUI**

#### Opção B: Criar nova pasta
1. Crie uma pasta em Google Drive
2. Siga os passos acima para obter o ID

### 2️⃣ OBTER API_KEY DO GOOGLE CLOUD

1. Acesse: https://console.cloud.google.com/
2. Clique em **"Criar Projeto"** (se não tiver um)
3. Vá para **APIs e Serviços** → **Biblioteca**
4. Procure por **"Google Drive API"**
5. Clique em **"Ativar"**
6. Vá para **Credenciais** (lado esquerdo)
7. Clique em **"+ Criar Credencial"** → **Chave de API**
8. Copie a chave gerada
9. (Opcional) Clique em **Editar** → **Restrições de API** → Selecione "Google Drive API"

### 3️⃣ CONFIGURAR NO WORKER

Edite o arquivo `worker/src/index.js` e procure por:

```javascript
const GOOGLE_DRIVE_CONFIG = {
    API_KEY: "AIzaSyBsuB_u5H4x7Z1D_FqzI0tF2M0z-KqK2_A", // ← COLE SUA API_KEY AQUI
    FOLDER_ID: "1E_wBncXYzKqH6v9mKpL4wQzN5R6sT7uVw" // ← COLE SEU FOLDER_ID AQUI
};
```

### 4️⃣ FAZER UPLOAD DOS VÍDEOS

1. Abra a pasta no Google Drive
2. Faça upload de vídeos em formato:
   - ✅ MP4
   - ✅ WebM
   - ✅ MOV
   - ✅ AVI

### 5️⃣ TESTAR O SISTEMA

#### Endpoint para testar vídeos:
```
GET /api/videos
```
Retorna lista de vídeos

#### Verificar acesso (mais seguro):
```
GET /api/videos/check
```
Valida se cada vídeo é acessível

#### Teste rápido:
```
GET /api/videos/test
```
Testa o primeiro vídeo

## 📊 CONFIGURAR TIMING

Edite `video-system.js`:

```javascript
const VIDEO_CONFIG = {
    DASHBOARD_DURATION: 10 * 60 * 1000, // Tempo do dashboard em ms
    VIDEO_DURATION: 3 * 60 * 1000,      // Tempo de cada vídeo em ms
    ENABLED: true,                       // Ativar/desativar
    PRELOAD: true,                       // Pré-carregar vídeos
    AUTO_LOOP: true                      // Loop infinito
};
```

### Exemplos:
- **5 min dashboard + 2 min vídeo:**
```javascript
DASHBOARD_DURATION: 5 * 60 * 1000,  // 5 minutos
VIDEO_DURATION: 2 * 60 * 1000,      // 2 minutos
```

- **15 min dashboard + 5 min vídeo:**
```javascript
DASHBOARD_DURATION: 15 * 60 * 1000, // 15 minutos
VIDEO_DURATION: 5 * 60 * 1000,      // 5 minutos
```

## 🔍 TROUBLESHOOTING

### Vídeos não aparecem
1. Verifique FOLDER_ID (deve estar acessível publicamente ou com permissão)
2. Teste `/api/videos/check` para validar acesso
3. Verifique se há vídeos na pasta

### Auto-play não funciona
1. Navegadores modernos bloqueiam auto-play com som
2. Vídeos iniciam com som desligado automaticamente
3. Usuário pode clicar no vídeo para aumentar volume

### CORS error
1. Verifique se API_KEY está correta
2. Verifique se Google Drive API está ativada
3. Tente recarregar a página

## 📁 ESTRUTURA ESPERADA

```
Google Drive
└── Pasta de Vídeos (FOLDER_ID)
    ├── video-1.mp4
    ├── video-2.mp4
    ├── video-3.mp4
    └── ...
```

## 🚀 PRÓXIMOS PASSOS

1. Configure FOLDER_ID e API_KEY
2. Faça deploy do worker (Wrangler)
3. Upload dos vídeos no Google Drive
4. Acesse o dashboard e veja o ciclo funcionar!

---
**Dúvidas?** Confira os logs do browser (F12 → Console) para debug detalhado.
