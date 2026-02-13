const fs = require('fs');
const content = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Scan & Go</title>
    <meta name="description" content="Scan. Pay. Walk Out. - Quick checkout shopping experience" />
    <meta name="author" content="Scan & Go" />
    <meta name="theme-color" content="#00d4aa" />
    <meta name="color-scheme" content="light dark" />
    
    <!-- PWA Manifest & Icons -->
    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" type="image/png" href="/icon-192x192.png" />
    <link rel="apple-touch-icon" href="/icon-192x192.png" />

    <!-- Open Graph tags -->
    <meta property="og:title" content="Scan & Go" />
    <meta property="og:description" content="Scan. Pay. Walk Out. - Quick checkout shopping experience" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://scan-go-checkout-main.vercel.app" />

    <meta name="twitter:card" content="summary" />
    <meta name="twitter:site" content="@ScanAndGo" />

    <!-- iOS specific -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Scan & Go" />
  </head>

  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"><\/script>
  </body>
</html>
`;
fs.writeFileSync('index.html', content, 'utf8');
console.log('Created clean index.html');
