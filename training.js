const trainingPage = document.querySelector('[data-page="training-config"]');

if (trainingPage) {
  const rows = Array.isArray(window.WINE_DATA) ? window.WINE_DATA : [];

  const features = [
    { key: 'fixedAcidity', label: 'Acidez fija' },
    { key: 'volatileAcidity', label: 'Acidez volátil' },
    { key: 'citricAcid', label: 'Ácido cítrico' },
    { key: 'residualSugar', label: 'Azúcar residual' },
    { key: 'chlorides', label: 'Cloruros' },
    { key: 'freeSulfurDioxide', label: 'SO₂ libre' },
    { key: 'totalSulfurDioxide', label: 'SO₂ total' },
    { key: 'density', label: 'Densidad' },
    { key: 'pH', label: 'pH' },
    { key: 'sulphates', label: 'Sulfitos' },
    { key: 'alcohol', label: 'Alcohol' }
  ];

  const algorithms = [
    {
      key: 'logistic-regression',
      label: 'Regresión logística',
      description: 'Buena opción base para clasificación binaria con datos tabulares.'
    },
    {
      key: 'decision-tree',
      label: 'Árbol de decisión',
      description: 'Fácil de interpretar, pero sensible a cambios en los datos de entrenamiento.'
    },
    {
      key: 'random-forest',
      label: 'Random forest',
      description: 'Combina muchos árboles para ganar estabilidad y suele mejorar el rendimiento.'
    }
  ];

  const qualityCutoff = document.getElementById('qualityCutoff');
  const trainSplit = document.getElementById('trainSplit');
  const qualityCutoffValue = document.getElementById('qualityCutoffValue');
  const trainSplitValue = document.getElementById('trainSplitValue');
  const featureList = document.getElementById('featureList');
  const algorithmList = document.getElementById('algorithmList');
  const configSummary = document.getElementById('configSummary');
  const trainModelButton = document.getElementById('trainModelButton');
  const resetConfigButton = document.getElementById('resetConfigButton');
  const defaultTrainButtonLabel = trainModelButton?.textContent?.trim() || 'Entrenar el modelo';

  const trainingStatEls = {
    threshold: document.querySelector('[data-training-stat="threshold"]'),
    split: document.querySelector('[data-training-stat="split"]'),
    featureCount: document.querySelector('[data-training-stat="feature-count"]'),
    algorithm: document.querySelector('[data-training-stat="algorithm"]')
  };

  const metricEls = {
    buyCount: document.querySelector('[data-training-metric="buy-count"]'),
    rejectCount: document.querySelector('[data-training-metric="reject-count"]'),
    trainCount: document.querySelector('[data-training-metric="train-count"]'),
    testCount: document.querySelector('[data-training-metric="test-count"]')
  };

  const defaultFeatures = features.map((feature) => feature.key);

  const state = {
    threshold: 5,
    split: 50,
    selectedFeatures: new Set(defaultFeatures),
    algorithm: 'logistic-regression'
  };

  const formatNumber = (value) => value.toLocaleString('es-ES');

  const resetTrainButtonState = () => {
    trainModelButton.disabled = false;
    trainModelButton.textContent = defaultTrainButtonLabel;
  };

  const getAlgorithm = () => algorithms.find((item) => item.key === state.algorithm) || algorithms[0];
  const getSelectedFeatureLabels = () => features
    .filter((feature) => state.selectedFeatures.has(feature.key))
    .map((feature) => feature.label);

  const renderFeatureList = () => {
    featureList.innerHTML = features.map((feature) => `
      <label class="feature-chip ${state.selectedFeatures.has(feature.key) ? 'feature-chip--active' : ''}">
        <input type="checkbox" value="${feature.key}" ${state.selectedFeatures.has(feature.key) ? 'checked' : ''} />
        <span>${feature.label}</span>
      </label>
    `).join('');

    featureList.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (input.checked) {
          state.selectedFeatures.add(input.value);
        } else {
          if (state.selectedFeatures.size === 1) {
            input.checked = true;
            return;
          }
          state.selectedFeatures.delete(input.value);
        }
        renderAll();
      });
    });
  };

  const renderAlgorithmList = () => {
    algorithmList.innerHTML = algorithms.map((algorithm) => `
      <label class="algorithm-card ${state.algorithm === algorithm.key ? 'algorithm-card--active' : ''}">
        <input type="radio" name="algorithm" value="${algorithm.key}" ${state.algorithm === algorithm.key ? 'checked' : ''} />
        <div>
          <strong>${algorithm.label}</strong>
          <p>${algorithm.description}</p>
        </div>
      </label>
    `).join('');

    algorithmList.querySelectorAll('input[name="algorithm"]').forEach((input) => {
      input.addEventListener('change', () => {
        state.algorithm = input.value;
        renderAll();
      });
    });
  };

  const renderSummary = () => {
    const buyCount = rows.filter((row) => Number(row.quality) >= state.threshold).length;
    const rejectCount = rows.length - buyCount;
    const trainCount = Math.round(rows.length * (state.split / 100));
    const testCount = rows.length - trainCount;
    const selectedLabels = getSelectedFeatureLabels();
    const algorithm = getAlgorithm();

    qualityCutoffValue.textContent = String(state.threshold);
    trainSplitValue.textContent = `${state.split}%`;

    trainingStatEls.threshold.textContent = String(state.threshold);
    trainingStatEls.split.textContent = `${state.split}%`;
    trainingStatEls.featureCount.textContent = String(state.selectedFeatures.size);
    trainingStatEls.algorithm.textContent = algorithm.label;

    metricEls.buyCount.textContent = formatNumber(buyCount);
    metricEls.rejectCount.textContent = formatNumber(rejectCount);
    metricEls.trainCount.textContent = formatNumber(trainCount);
    metricEls.testCount.textContent = formatNumber(testCount);

    configSummary.innerHTML = `
      <div class="summary-item">
        <span class="summary-item__label">Criterio de compra</span>
        <strong class="summary-item__value">Calidad ≥ ${state.threshold}</strong>
      </div>
      <div class="summary-item">
        <span class="summary-item__label">Partición</span>
        <strong class="summary-item__value">${state.split}% train · ${100 - state.split}% test</strong>
      </div>
      <div class="summary-item">
        <span class="summary-item__label">Variables elegidas</span>
        <strong class="summary-item__value">${selectedLabels.join(', ')}</strong>
      </div>
      <div class="summary-item">
        <span class="summary-item__label">Algoritmo seleccionado</span>
        <strong class="summary-item__value">${algorithm.label}</strong>
      </div>
    `;
  };

  const buildPayload = () => ({
    threshold: state.threshold,
    split: state.split,
    selectedFeatures: [...state.selectedFeatures],
    algorithm: state.algorithm
  });

  const persistConfiguration = () => {
    const payload = buildPayload();

    try {
      window.localStorage.setItem('juradoVinosTrainingConfig', JSON.stringify(payload));
      return payload;
    } catch (error) {
      return payload;
    }
  };

  const goToEvaluation = (payload) => {
    const params = new URLSearchParams({
      threshold: String(payload.threshold),
      split: String(payload.split),
      selectedFeatures: payload.selectedFeatures.join(','),
      algorithm: payload.algorithm,
      trained: '1'
    });

    window.location.href = `./evaluacion.html?${params.toString()}`;
  };

  const trainModel = () => {
    resetTrainButtonState();
    trainModelButton.disabled = true;
    trainModelButton.textContent = 'Entrenando...';

    const payload = persistConfiguration();

    window.setTimeout(() => {
      goToEvaluation(payload);
    }, 120);
  };

  const resetConfiguration = () => {
    state.threshold = 5;
    state.split = 50;
    state.selectedFeatures = new Set(defaultFeatures);
    state.algorithm = 'logistic-regression';
    qualityCutoff.value = '5';
    trainSplit.value = '50';
    renderAll();
  };

  const renderAll = () => {
    renderFeatureList();
    renderAlgorithmList();
    renderSummary();
  };

  qualityCutoff.addEventListener('input', () => {
    state.threshold = Number(qualityCutoff.value);
    renderSummary();
  });

  trainSplit.addEventListener('input', () => {
    state.split = Number(trainSplit.value);
    renderSummary();
  });

  trainModelButton.addEventListener('click', trainModel);
  resetConfigButton.addEventListener('click', resetConfiguration);
  window.addEventListener('pageshow', resetTrainButtonState);

  resetTrainButtonState();
  renderAll();
}
