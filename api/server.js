import express from 'express';
import { chromium } from 'playwright';
import path from 'path';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';

// Configuración inicial
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Configuración de vistas y motor de plantillas
app.set('views', path.join(__dirname, '../public'));
app.set('view engine', 'ejs');

// Ruta para servir el archivo HTML principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Función para abrir y cerrar URLs secuencialmente
async function openUrlsSequentially(urls) {
    const browser = await chromium.launch({ headless: false }); // Cambiar a `true` para modo headless
    const results = {
        success: [],
        failed: []
    };

    for (const url of urls) {
        try {
            const page = await browser.newPage();
            console.log(`Opening: ${url}`);

            // Intentar cargar la página
            const response = await page.goto(url, { waitUntil: 'domcontentloaded' });

            // Verificar si la respuesta es exitosa (2xx)
            if (response && response.status() >= 200 && response.status() < 300) {
                console.log(`Successfully opened: ${url}`);
                results.success.push(url);
            } else {
                console.error(`Failed to load: ${url} - Status: ${response.status()}`);
                results.failed.push({ url, error: `HTTP Status: ${response.status()}` });
            }

            // Cerrar la página después de un tiempo
            setTimeout(async () => {
                console.log(`Closing: ${url}`);
                await page.close();
            }, 4000); // 4 segundos

        } catch (error) {
            console.error(`Error opening URL: ${url} - ${error.message}`);
            results.failed.push({ url, error: error.message });
        }

        // Esperar antes de abrir la siguiente URL
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 segundos
    }

    await browser.close();
    return results;
}

// Ruta para procesar las URLs enviadas por POST
app.post('/process-urls', async (req, res) => {
    const urls = req.body.urls.split('\n').map(url => url.trim()).filter(url => url);
    const count = urls.length;

    if (count > 0) {
        const results = await openUrlsSequentially(urls);
        const { success, failed } = results;

        // Renderizar la vista success.ejs
        res.render('success', {
            successCount: success.length,
            failedSection: failed.length > 0 ? `
                <p class="failed">${failed.length} URL${failed.length > 1 ? 's' : ''} fallida${failed.length > 1 ? 's' : ''}:</p>
                <ul>${failed.map(item => `<li>${item.url}: ${item.error}</li>`).join('')}</ul>
            ` : ''
        });
    } else {
        // Renderizar la vista empty.ejs
        res.render('empty');
    }
});

// Iniciar el servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
