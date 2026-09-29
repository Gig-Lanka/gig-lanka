import request from 'supertest';
import app from '../../src/app.js';

const getResetLinkPage = (query) => request(app).get('/reset-password').query(query);

describe('GET /reset-password — reset-link bridge page', () => {
  it('returns 200 HTML with the escaped token in the scheme URL', async () => {
    const res = await getResetLinkPage({ token: '3f9a1c7e2b' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('giglanka://reset-password?token=3f9a1c7e2b');
    expect(res.text).toContain('Open Gig Lanka');
  });

  it('escapes a malicious token instead of letting it inject into the page', async () => {
    const maliciousToken = '"><script>alert(1)</script>';

    const res = await getResetLinkPage({ token: maliciousToken });

    expect(res.status).toBe(200);
    expect(res.text).not.toContain(maliciousToken);
    expect(res.text).not.toContain('<script>alert(1)</script>');
    expect(res.text).not.toContain('"><script>');
  });

  it('escapes a token holding a quote so it cannot close the href attribute or the redirect string', async () => {
    const quoteToken = `'"</script><script>window.location='https://evil.example'</script>`;

    const res = await getResetLinkPage({ token: quoteToken });

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('window.location=\'https://evil.example\'');
    expect(res.text).not.toContain('</script><script>');
  });

  it('renders the request-a-new-link message when no token is given', async () => {
    const res = await getResetLinkPage({});

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Request a new password reset link from the Gig Lanka app.');
    expect(res.text).not.toContain('giglanka://reset-password');
  });

  it('renders the request-a-new-link message for an empty token', async () => {
    const res = await getResetLinkPage({ token: '' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('Request a new password reset link from the Gig Lanka app.');
  });
});
