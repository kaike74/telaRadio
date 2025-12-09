// Script para testar listagem de vídeos do Google Drive
const API_KEY = "AIzaSyBj_5Lu8nphs8tFj0w34BWetypSeYXe_V0";
const FOLDER_ID = "1kxhIUv3aekp9lnrCnUom1f6HBnC1kGM5";

async function listarVideos() {
    try {
        console.log("🎥 Tentando listar vídeos do Google Drive...\n");
        
        const query = encodeURIComponent(`'${FOLDER_ID}' in parents and (mimeType='video/mp4' or mimeType='video/webm' or mimeType='video/quicktime') and trashed=false`);
        
        const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,createdTime,webViewLink)&orderBy=createdTime+desc&pageSize=50&key=${API_KEY}`;
        
        console.log("📍 URL:", url.substring(0, 100) + "...\n");
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!response.ok) {
            console.error("❌ ERRO HTTP", response.status);
            console.error("Resposta:", JSON.stringify(data, null, 2));
            return;
        }
        
        if (data.error) {
            console.error("❌ ERRO da API:", data.error.message);
            console.error("Detalhes:", JSON.stringify(data.error, null, 2));
            return;
        }
        
        console.log("✅ Sucesso!\n");
        
        if (!data.files || data.files.length === 0) {
            console.log("⚠️ Nenhum vídeo encontrado na pasta.");
            return;
        }
        
        console.log(`📊 ${data.files.length} vídeo(s) encontrado(s):\n`);
        
        data.files.forEach((file, idx) => {
            console.log(`[${idx + 1}] ${file.name}`);
            console.log(`    ID: ${file.id}`);
            console.log(`    Tipo: ${file.mimeType}`);
            console.log(`    Criado: ${file.createdTime}`);
            console.log(`    Link: ${file.webViewLink}`);
            console.log("");
        });
        
    } catch (error) {
        console.error("❌ ERRO:", error.message);
    }
}

listarVideos();
