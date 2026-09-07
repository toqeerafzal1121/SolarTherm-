/**
 * SOLARTHERM SIH26051 - Theme Toggle
 * Manages dark/light mode via localStorage and body class
 */
(function () {
  const THEME_KEY = 'solartherm-theme';

  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    localStorage.setItem(THEME_KEY, theme);

    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.textContent = theme === 'light' ? '☀️' : '🌙';
      btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
    }

    // Notify global state if available
    if (window.state) {
      window.state.darkMode = (theme === 'dark');
    }
  }

  // Apply saved theme immediately on load
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(saved);

  // Wire the toggle button after DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        const current = document.body.classList.contains('light-mode') ? 'light' : 'dark';
        applyTheme(current === 'light' ? 'dark' : 'light');
      });
    }
  });
})();
