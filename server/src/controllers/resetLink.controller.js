const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

const buildSchemeUrl = (token) => `giglanka://reset-password?token=${encodeURIComponent(token)}`;

const renderPage = ({ title, body, script = '' }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Gig Lanka — ${title}</title>
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: #FFFFFF;
    color: #101114;
    font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .wrap {
    min-height: 100vh;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 24px;
    text-align: center;
  }
  h1 {
    font-family: 'Schibsted Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 12px;
  }
  p {
    font-size: 15px;
    line-height: 1.5;
    margin: 0 0 28px;
    max-width: 320px;
  }
  .btn {
    display: inline-block;
    box-sizing: border-box;
    width: 100%;
    max-width: 280px;
    background: #FF4A1C;
    color: #FFFFFF;
    font-weight: 600;
    font-size: 16px;
    text-decoration: none;
    padding: 16px 32px;
    border-radius: 18px;
  }
  .hint {
    margin: 24px 0 0;
    font-size: 13px;
    color: #71727C;
    max-width: 280px;
  }
</style>
</head>
<body>
  <div class="wrap">
    <h1>Gig Lanka</h1>
    ${body}
  </div>
  ${script}
</body>
</html>
`;

export const getResetLinkPage = (req, res) => {
  const { token } = req.query;

  if (typeof token !== 'string' || token.length === 0) {
    const html = renderPage({
      title: 'Reset your password',
      body: `
    <p class="lede">This link is missing its reset token.</p>
    <p class="hint">Request a new password reset link from the Gig Lanka app.</p>`,
    });

    res.status(200).type('html').send(html);
    return;
  }

  const schemeUrl = buildSchemeUrl(token);
  const hrefAttr = escapeHtml(schemeUrl);
  const jsStringLiteral = JSON.stringify(schemeUrl);

  const html = renderPage({
    title: 'Reset your password',
    body: `
    <p class="lede">Opening Gig Lanka to reset your password&hellip;</p>
    <a class="btn" href="${hrefAttr}">Open Gig Lanka</a>
    <p class="hint">If nothing happens, install the Gig Lanka app first.</p>`,
    script: `<script>window.location.replace(${jsStringLiteral});</script>`,
  });

  res.status(200).type('html').send(html);
};
