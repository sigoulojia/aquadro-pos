// Aquadro POS — Dynamic Release Metadata Fetcher
// Connecte dynamiquement la page aux releases officielles GitHub sans backend

const GITHUB_REPO = 'sigoulojia/aquadro-pos';
const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const ALL_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) {
      console.warn('[Website] GitHub API returned status:', res.status);
      return; // Keep default v1.0.0 static fallback
    }

    const data = await res.json();
    if (!data || !data.tag_name) return;

    const version = data.tag_name;
    const cleanVersion = version.startsWith('v') ? version.substring(1) : version;
    const pubDate = data.published_at 
      ? new Date(data.published_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      : '09 Octobre 2026';

    // Update UI elements
    const heroVersionEl = document.getElementById('hero-version-tag');
    if (heroVersionEl) heroVersionEl.textContent = `v${cleanVersion}`;

    const cardVersionEl = document.getElementById('card-version');
    if (cardVersionEl) cardVersionEl.textContent = cleanVersion;

    const cardDateEl = document.getElementById('card-date');
    if (cardDateEl) cardDateEl.textContent = pubDate;

    // Find Windows NSIS Setup .exe asset
    const exeAsset = data.assets?.find(a => a.name.endsWith('.exe') && !a.name.includes('.sig'));
    const downloadBtn = document.getElementById('primary-download-btn');
    const btnLabel = document.getElementById('btn-label');

    if (downloadBtn && exeAsset) {
      downloadBtn.href = exeAsset.browser_download_url;
      if (btnLabel) {
        const sizeMb = (exeAsset.size / (1024 * 1024)).toFixed(1);
        btnLabel.textContent = `Télécharger l'Installeur Windows (${sizeMb} Mo)`;
      }
    } else if (downloadBtn) {
      downloadBtn.href = data.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`;
    }

    // Render release body notes if present
    if (data.body) {
      const releasesContainer = document.getElementById('releases-list');
      if (releasesContainer) {
        const article = document.createElement('article');
        article.className = 'release-item';
        article.innerHTML = `
          <div class="release-item-header">
            <div class="release-title-row">
              <span class="badge-version">${version}</span>
              <span class="badge-stable">Dernier Release GitHub</span>
              <h3 class="release-name">${escapeHtml(data.name || `Aquadro POS ${version}`)}</h3>
            </div>
            <time class="release-date">${pubDate}</time>
          </div>
          <div class="release-content">
            <div style="white-space: pre-line; font-family: monospace; font-size: 0.85rem; color: #334155;">
              ${escapeHtml(data.body)}
            </div>
          </div>
        `;
        releasesContainer.prepend(article);
      }
    }
  } catch (err) {
    console.warn('[Website] Could not fetch live GitHub releases:', err);
    // Silent fallback to static v1.0.0 HTML content
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}
