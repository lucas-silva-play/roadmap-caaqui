export default async function handler(req, res) {
  try {
    const url = req.query.url;

    if (!url || typeof url !== 'string') {
      return res.status(400).send('Missing ?url=');
    }

    // Segurança mínima: aceite só links do Google Sheets
    const allowed = /^https:\/\/docs\.google\.com\/spreadsheets\//.test(url);
    if (!allowed) {
      return res.status(400).send('Invalid url');
    }

    const r = await fetch(url, {
      headers: {
        // Ajuda a evitar alguns bloqueios por anti-bot
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/csv,text/plain,*/*'
      }
    });

    const text = await r.text();

    // Se o Google devolveu HTML (login/permissão), a planilha não está acessível como CSV
    if (text.trim().startsWith('<!DOCTYPE') || text.includes('<html')) {
      return res.status(400).send('Got HTML instead of CSV. Check publish/public permissions.');
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    // Mesmo sendo same-origin, não custa deixar explícito
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Cache na CDN da Vercel (opcional)
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).send('Proxy error');
  }
}
