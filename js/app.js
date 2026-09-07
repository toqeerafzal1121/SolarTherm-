/**
 * SOLARTHERM SIH26051 - Main Application Orchestrator
 * Integrates all subsystem UI controllers, tabs, theme toggling,
 * and assumptions drawer.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize 3D Engine
  const shelter3D = new Shelter3D('shelterViewport3D');
  window.shelter3DInstance = shelter3D;

  // 2. Initialize UI Controllers
  const designerUI = new DesignerUI();
  const climateUI = new ClimateUI();
  const simulationUI = new SimulationUI();
  const optimizerUI = new OptimizerUI();
  const sandboxUI = new SandboxUI();
  const validationUI = new ValidationUI();
  const reportUI = new ReportUI();
  // Pitch deck removed — AI Agent replaces it
  const solarthermAI = new SolarthermAI();
  window.solarthermAI = solarthermAI; // expose globally for insight card clicks

  // 3. Tab Switching
  const navTabs = document.querySelectorAll('.nav-workflow-tab');
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.app-page-view').forEach(view => {
        view.classList.remove('active');
      });

      const targetView = document.getElementById(`view-${targetTab}`);
      if (targetView) {
        targetView.classList.add('active');
      }

      window.state.activeTab = targetTab;
      window.state.notify('activeTab');

      // Trigger 3D canvas resize when switching back to designer
      if (targetTab === 'designer' && shelter3D) {
        setTimeout(() => shelter3D.onResize(), 50);
      }

      // Refresh and fit Leaflet map when switching to climate
      if (targetTab === 'climate' && climateUI) {
        setTimeout(() => {
          if (typeof climateUI.refreshMap === 'function') {
            climateUI.refreshMap();
          }
        }, 80);
      }

      // Render validation comparison chart & metrics when switching to validation
      if (targetTab === 'validation' && validationUI) {
        setTimeout(() => {
          validationUI.renderValidationComparison();
        }, 60);
      }

      // Render dossier when switching to report
      if (targetTab === 'report' && reportUI) {
        setTimeout(() => {
          reportUI.renderDossier();
        }, 60);
      }

      // Render insights when switching to AI agent
      if (targetTab === 'ai-agent' && solarthermAI) {
        setTimeout(() => {
          solarthermAI.renderInsightCards();
        }, 60);
      }
    });
  });

  // 4. Dark / Light Mode Toggle
  const themeToggle = document.getElementById('themeToggleCheckbox');
  if (themeToggle) {
    themeToggle.addEventListener('change', (e) => {
      window.state.darkMode = e.target.checked;
      document.body.classList.toggle('light-mode', !e.target.checked);
      if (shelter3D && shelter3D.scene) {
        shelter3D.scene.background = e.target.checked ? null : new THREE.Color(0xf1f5f9);
      }
    });
  }

  // 5. Assumptions Drawer Toggle
  const drawer = document.getElementById('assumptionsDrawer');
  const openDrawerBtn = document.getElementById('btnOpenAssumptions');
  const closeDrawerBtn = document.getElementById('btnCloseAssumptions');

  if (openDrawerBtn && drawer) {
    openDrawerBtn.addEventListener('click', () => {
      drawer.classList.add('open');
    });
  }

  if (closeDrawerBtn && drawer) {
    closeDrawerBtn.addEventListener('click', () => {
      drawer.classList.remove('open');
    });
  }

  // 6. Header Run Sim Button Sync
  const headerRunBtn = document.getElementById('btnRunSimHeader');
  if (headerRunBtn) {
    headerRunBtn.addEventListener('click', () => {
      // Switch to simulation tab and run
      const simTab = document.querySelector('[data-tab="simulation"]');
      if (simTab) simTab.click();
      simulationUI.runSimulation();
    });
  }

  // 7. Header Export Report Button Sync
  const headerReportBtn = document.getElementById('btnExportReportHeader');
  if (headerReportBtn) {
    headerReportBtn.addEventListener('click', () => {
      const repTab = document.querySelector('[data-tab="report"]');
      if (repTab) repTab.click();
    });
  }

  // 8. Header AI Agent Button — jump to Tab 8
  const aiHeaderBtn = document.getElementById('btnOpenAIAgent');
  if (aiHeaderBtn) {
    aiHeaderBtn.addEventListener('click', () => {
      const aiTab = document.querySelector('[data-tab="ai-agent"]');
      if (aiTab) aiTab.click();
    });
  }

  console.log('[SOLARTHERM SIH26051] Platform Loaded Successfully.');
});
