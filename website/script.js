// Aquadro POS — Direct Download & Release Metadata Engine
// Déclenche le téléchargement direct de l'installeur Windows (.exe) sans redirection vers GitHub

const GITHUB_REPO = 'sigoulojia/aquadro-releases';
const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
let directDownloadUrl = `https://github.com/${GITHUB_REPO}/releases/latest/download/AquadroPOS_1.0.0_x64-setup.exe`;

document.addEventListener('DOMContentLoaded', async () => {
  setupDownloadHandlers();

  try {
    const res = await fetch(API_URL);
    if (!res.ok) {
      console.warn('[Website] GitHub API returned status:', res.status);
      return;
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
    const headerBtn = document.getElementById('header-download-btn');
    const btnLabel = document.getElementById('btn-label');

    if (exeAsset) {
      directDownloadUrl = exeAsset.browser_download_url;
      if (downloadBtn) downloadBtn.href = directDownloadUrl;
      if (headerBtn) headerBtn.href = directDownloadUrl;
      if (btnLabel) {
        const sizeMb = (exeAsset.size / (1024 * 1024)).toFixed(1);
        btnLabel.textContent = `Télécharger l'Installeur Windows (${sizeMb} Mo)`;
      }
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
  }
});

function setupDownloadHandlers() {
  const primaryBtn = document.getElementById('primary-download-btn');
  const headerBtn = document.getElementById('header-download-btn');
  const zipBtn = document.getElementById('zip-download-btn');
  const copyBtn = document.getElementById('copy-cmd-btn');
  const cmdText = document.getElementById('powershell-cmd-text');

  const handleDownloadClick = (e) => {
    e.preventDefault();
    triggerDirectDownload(directDownloadUrl);
  };

  if (primaryBtn) primaryBtn.addEventListener('click', handleDownloadClick);
  if (headerBtn) headerBtn.addEventListener('click', handleDownloadClick);

  if (zipBtn) {
    zipBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const zipUrl = zipBtn.getAttribute('href') || `https://github.com/${GITHUB_REPO}/releases/latest/download/AquadroPOS_1.0.0_x64-setup.nsis.zip`;
      triggerDirectDownload(zipUrl);
    });
  }

  if (copyBtn && cmdText) {
    copyBtn.addEventListener('click', async () => {
      try {
        const textToCopy = cmdText.textContent.trim();
        await navigator.clipboard.writeText(textToCopy);
        const copyBtnText = document.getElementById('copy-btn-text');
        if (copyBtnText) copyBtnText.textContent = 'تم النسخ بنجاح ✓';
        copyBtn.style.background = '#10B981';
        setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = 'نسخ الأمر';
          copyBtn.style.background = '#2563EB';
        }, 2500);
      } catch (err) {
        console.warn('Clipboard write failed:', err);
      }
    });
  }
}

function triggerDirectDownload(url) {
  showToastDownload();
  
  // Create hidden iframe to trigger binary download without navigating away
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  setTimeout(() => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }, 30000);
}

function showToastDownload() {
  let toast = document.getElementById('download-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'download-toast';
    toast.className = 'download-toast';
    document.body.appendChild(toast);
  }

  toast.innerHTML = `
    <div class="download-toast-content">
      <div class="download-toast-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </div>
      <div>
        <p class="download-toast-title">Le téléchargement a démarré ! / بدأ التحميل المباشر</p>
        <p class="download-toast-subtitle">L'installeur Windows Aquadro POS (.exe) est en cours de téléchargement.</p>
      </div>
    </div>
  `;

  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 6000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}
