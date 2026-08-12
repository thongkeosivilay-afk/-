// ===== Migrated from inline <script> block in privacy.html (CSP compliance) =====

  document.addEventListener('DOMContentLoaded', () => {
    if (window.StorefrontData) {
      window.StorefrontData.fetchData()
        .then((data) => window.StorefrontData.applyStoreBranding(data.store))
        .catch((err) => console.error('privacy.html: applyStoreBranding failed', err));
    }
  });
