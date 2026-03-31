const evaluationPage = document.querySelector('[data-page="evaluation"]');

if (evaluationPage) {
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

  const algorithms = {
    'logistic-regression': 'Regresión logística',
    'decision-tree': 'Árbol de decisión',
    'random-forest': 'Random forest'
  };

  const configKey = 'juradoVinosTrainingConfig';
  const defaultConfig = {
    threshold: 5,
    split: 50,
    selectedFeatures: features.map((feature) => feature.key),
    algorithm: 'logistic-regression'
  };

  const elements = {
    algorithm: document.querySelector('[data-eval-stat="algorithm"]'),
    threshold: document.querySelector('[data-eval-stat="threshold"]'),
    split: document.querySelector('[data-eval-stat="split"]'),
    features: document.querySelector('[data-eval-stat="features"]'),
    summary: document.getElementById('evaluationSummary'),
    matrixTp: document.getElementById('matrixTp'),
    matrixFp: document.getElementById('matrixFp'),
    matrixFn: document.getElementById('matrixFn'),
    matrixTn: document.getElementById('matrixTn'),
    metricsBody: document.getElementById('metricsBody'),
    importanceList: document.getElementById('importanceList'),
    note: document.getElementById('evaluationNote'),
    furtherLink: document.getElementById('furtherEvaluationLink'),
    content: document.getElementById('evaluationContent'),
    emptyState: document.getElementById('evaluationEmptyState')
  };

  const mean = (values) => values.reduce((acc, value) => acc + value, 0) / values.length;
  const stdDev = (values) => {
    const avg = mean(values);
    return Math.sqrt(values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / values.length);
  };
  const pearson = (x, y) => {
    const avgX = mean(x);
    const avgY = mean(y);
    let numerator = 0;
    let sumX = 0;
    let sumY = 0;
    for (let index = 0; index < x.length; index += 1) {
      const dx = x[index] - avgX;
      const dy = y[index] - avgY;
      numerator += dx * dy;
      sumX += dx * dx;
      sumY += dy * dy;
    }
    const denominator = Math.sqrt(sumX * sumY);
    return denominator === 0 ? 0 : numerator / denominator;
  };
  const formatInt = (value) => Number(value).toLocaleString('es-ES');
  const formatPercent = (value) => `${value.toFixed(2)}%`;
  const sigmoid = (value) => 1 / (1 + Math.exp(-value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const logit = (value) => {
    const safe = clamp(value, 0.000001, 0.999999);
    return Math.log(safe / (1 - safe));
  };

  const seededRandom = (seed) => {
    let state = seed % 2147483647;
    if (state <= 0) state += 2147483646;
    return () => {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };
  };

  const shuffleDeterministic = (items, seed = 42) => {
    const clone = [...items];
    const random = seededRandom(seed);
    for (let index = clone.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
    }
    return clone;
  };

  const normalizeConfig = (source = {}) => ({
    threshold: Number(source.threshold) || defaultConfig.threshold,
    split: Number(source.split) || defaultConfig.split,
    selectedFeatures: Array.isArray(source.selectedFeatures) && source.selectedFeatures.length
      ? source.selectedFeatures.filter((key) => features.some((feature) => feature.key === key))
      : defaultConfig.selectedFeatures,
    algorithm: source.algorithm in algorithms ? source.algorithm : defaultConfig.algorithm
  });

  const loadConfigFromQuery = () => {
    const params = new URLSearchParams(window.location.search);
    const selectedFeatures = params.get('selectedFeatures');
    if (!params.toString() || !params.get('trained')) return null;

    return normalizeConfig({
      threshold: params.get('threshold'),
      split: params.get('split'),
      selectedFeatures: selectedFeatures ? selectedFeatures.split(',').filter(Boolean) : null,
      algorithm: params.get('algorithm')
    });
  };

  const loadConfig = () => {
    const queryConfig = loadConfigFromQuery();
    if (queryConfig) {
      try {
        window.localStorage.setItem(configKey, JSON.stringify(queryConfig));
      } catch (error) {
        // Si el almacenamiento local falla, seguimos usando la configuración de la URL.
      }
      return queryConfig;
    }

    try {
      const raw = window.localStorage.getItem(configKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return normalizeConfig(parsed);
    } catch (error) {
      return null;
    }
  };

  const computeFeatureStats = (trainRows, selectedFeatures, threshold) => {
    const labels = trainRows.map((row) => (Number(row.quality) >= threshold ? 1 : 0));
    const positiveRate = labels.length ? labels.reduce((acc, value) => acc + value, 0) / labels.length : 0.5;

    return {
      positiveRate,
      items: selectedFeatures.map((featureKey) => {
        const values = trainRows.map((row) => Number(row[featureKey]));
        const correlation = pearson(values, labels);
        const avg = mean(values);
        const std = stdDev(values) || 1;
        const positiveRows = trainRows.filter((row) => Number(row.quality) >= threshold);
        const negativeRows = trainRows.filter((row) => Number(row.quality) < threshold);
        const positiveMean = positiveRows.length ? mean(positiveRows.map((row) => Number(row[featureKey]))) : avg;
        const negativeMean = negativeRows.length ? mean(negativeRows.map((row) => Number(row[featureKey]))) : avg;

        return {
          key: featureKey,
          label: features.find((feature) => feature.key === featureKey)?.label || featureKey,
          mean: avg,
          std,
          correlation,
          positiveMean,
          negativeMean,
          separation: (positiveMean - negativeMean) / std,
          weight: Math.abs(correlation)
        };
      })
    };
  };

  const predictProbability = (row, featureStats, algorithm) => {
    const totalWeight = featureStats.items.reduce((acc, item) => acc + item.weight, 0) || featureStats.items.length || 1;
    const priorBias = logit(featureStats.positiveRate || 0.5);

    const baseScore = featureStats.items.reduce((acc, item) => {
      const normalized = (Number(row[item.key]) - item.mean) / item.std;
      const signed = normalized * (item.correlation >= 0 ? 1 : -1);
      const separationBoost = Math.max(0.35, Math.abs(item.separation));
      return acc + signed * (((item.weight || 1) / totalWeight) * separationBoost);
    }, priorBias * 0.75);

    if (algorithm === 'decision-tree') {
      const votes = featureStats.items
        .slice()
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .reduce((acc, item) => {
          const midpoint = (item.positiveMean + item.negativeMean) / 2;
          const positive = item.positiveMean >= item.negativeMean
            ? Number(row[item.key]) >= midpoint
            : Number(row[item.key]) <= midpoint;
          return acc + (positive ? 1 : -1);
        }, 0);

      return sigmoid(baseScore * 0.85 + votes * 0.55);
    }

    if (algorithm === 'random-forest') {
      const forestVote = featureStats.items.reduce((acc, item, index) => {
        const midpoint = (item.positiveMean + item.negativeMean) / 2;
        const margin = ((index % 3) - 1) * (0.08 * item.std);
        const positive = item.positiveMean >= item.negativeMean
          ? Number(row[item.key]) >= midpoint + margin
          : Number(row[item.key]) <= midpoint + margin;
        return acc + (positive ? 1 : 0);
      }, 0) / (featureStats.items.length || 1);

      return sigmoid(baseScore * 0.75 + (forestVote - featureStats.positiveRate) * 2.2 + priorBias * 0.35);
    }

    return sigmoid(baseScore * 1.05);
  };

  const findDecisionCutoff = (trainRows, featureStats, config) => {
    const candidates = Array.from({ length: 31 }, (_, index) => 0.2 + index * 0.02);
    let bestThreshold = 0.5;
    let bestScore = -1;
    let bestBalancedAccuracy = -1;

    candidates.forEach((candidate) => {
      let tp = 0;
      let fp = 0;
      let fn = 0;
      let tn = 0;

      trainRows.forEach((row) => {
        const actualBuy = Number(row.quality) >= config.threshold;
        const predictedBuy = predictProbability(row, featureStats, config.algorithm) >= candidate;

        if (predictedBuy && actualBuy) tp += 1;
        if (predictedBuy && !actualBuy) fp += 1;
        if (!predictedBuy && actualBuy) fn += 1;
        if (!predictedBuy && !actualBuy) tn += 1;
      });

      const sensitivity = tp + fn ? tp / (tp + fn) : 0;
      const specificity = tn + fp ? tn / (tn + fp) : 0;
      const accuracy = trainRows.length ? (tp + tn) / trainRows.length : 0;
      const balancedAccuracy = (sensitivity + specificity) / 2;
      const score = accuracy;

      if (
        score > bestScore ||
        (Math.abs(score - bestScore) < 0.000001 && balancedAccuracy > bestBalancedAccuracy)
      ) {
        bestScore = score;
        bestThreshold = candidate;
        bestBalancedAccuracy = balancedAccuracy;
      }
    });

    return bestThreshold;
  };

  const render = () => {
    if (!rows.length) {
      elements.note.textContent = 'No se han encontrado datos cargados para calcular la evaluación.';
      return;
    }

    const config = loadConfig();

    if (!config) {
      if (elements.content) elements.content.hidden = true;
      if (elements.emptyState) elements.emptyState.hidden = false;
      return;
    }

    if (elements.content) elements.content.hidden = false;
    if (elements.emptyState) elements.emptyState.hidden = true;

    const params = new URLSearchParams({
      threshold: String(config.threshold),
      split: String(config.split),
      selectedFeatures: config.selectedFeatures.join(','),
      algorithm: config.algorithm,
      trained: '1'
    });
    if (elements.furtherLink) {
      elements.furtherLink.href = `./evaluacion-avanzada.html?${params.toString()}`;
    }

    const shuffled = shuffleDeterministic(rows, 73);
    const trainCount = Math.max(1, Math.min(shuffled.length - 1, Math.round(shuffled.length * (config.split / 100))));
    const trainRows = shuffled.slice(0, trainCount);
    const testRows = shuffled.slice(trainCount);
    const featureStats = computeFeatureStats(trainRows, config.selectedFeatures, config.threshold);
    const decisionCutoff = findDecisionCutoff(trainRows, featureStats, config);
    const sortedImportance = featureStats.items
      .slice()
      .sort((a, b) => b.weight - a.weight);
    const totalImportance = sortedImportance.reduce((acc, item) => acc + item.weight, 0) || sortedImportance.length || 1;

    let tp = 0;
    let fp = 0;
    let fn = 0;
    let tn = 0;

    testRows.forEach((row) => {
      const actualBuy = Number(row.quality) >= config.threshold;
      const probability = predictProbability(row, featureStats, config.algorithm);
      const predictedBuy = probability >= decisionCutoff;

      if (predictedBuy && actualBuy) tp += 1;
      if (predictedBuy && !actualBuy) fp += 1;
      if (!predictedBuy && actualBuy) fn += 1;
      if (!predictedBuy && !actualBuy) tn += 1;
    });

    const safePercent = (numerator, denominator) => (denominator ? (numerator / denominator) * 100 : 0);
    const metrics = [
      {
        label: 'Accuracy',
        value: safePercent(tp + tn, testRows.length),
        description: 'Porcentaje total de vinos del test que el modelo clasifica correctamente.'
      },
      {
        label: 'Sensibilidad',
        value: safePercent(tp, tp + fn),
        description: 'Proporción de vinos de compra correctamente detectados en el conjunto de prueba.'
      },
      {
        label: 'Especificidad',
        value: safePercent(tn, tn + fp),
        description: 'Porcentaje de vinos rechazables correctamente identificados como negativos.'
      },
      {
        label: 'Valor predictivo positivo',
        value: safePercent(tp, tp + fp),
        description: 'Fiabilidad de la etiqueta “comprar” cuando el modelo predice una compra.'
      },
      {
        label: 'Valor predictivo negativo',
        value: safePercent(tn, tn + fn),
        description: 'Fiabilidad de la etiqueta “rechazar” cuando el modelo descarta una compra.'
      },
      {
        label: 'Tasa de detección',
        value: safePercent(tp, testRows.length),
        description: 'Proporción del total del test en la que el modelo acierta compras reales.'
      }
    ];

    elements.algorithm.textContent = algorithms[config.algorithm];
    elements.threshold.textContent = `Calidad ≥ ${config.threshold}`;
    elements.split.textContent = `${config.split}% train · ${100 - config.split}% test`;
    elements.features.textContent = String(config.selectedFeatures.length);

    elements.summary.innerHTML = `
      <div class="summary-item">
        <span class="summary-item__label">Algoritmo evaluado</span>
        <strong class="summary-item__value">${algorithms[config.algorithm]}</strong>
      </div>
      <div class="summary-item">
        <span class="summary-item__label">Partición aplicada</span>
        <strong class="summary-item__value">${formatInt(trainRows.length)} train · ${formatInt(testRows.length)} test</strong>
      </div>
      <div class="summary-item">
        <span class="summary-item__label">Criterio de compra</span>
        <strong class="summary-item__value">Comprar si calidad ≥ ${config.threshold}</strong>
      </div>
      <div class="summary-item">
        <span class="summary-item__label">Variables seleccionadas</span>
        <strong class="summary-item__value">${sortedImportance.map((item) => item.label).join(', ')}</strong>
      </div>
    `;

    elements.matrixTp.textContent = formatInt(tp);
    elements.matrixFp.textContent = formatInt(fp);
    elements.matrixFn.textContent = formatInt(fn);
    elements.matrixTn.textContent = formatInt(tn);

    elements.metricsBody.innerHTML = metrics.map((metric) => `
      <tr>
        <td>${metric.label}</td>
        <td><strong>${formatPercent(metric.value)}</strong></td>
        <td>${metric.description}</td>
      </tr>
    `).join('');

    elements.importanceList.innerHTML = sortedImportance.map((item) => {
      const percentage = ((item.weight || 1) / totalImportance) * 100;
      return `
        <div class="legend-item importance-item">
          <div class="importance-item__header">
            <span class="legend-item__label">${item.label}</span>
            <strong>${percentage.toFixed(1)}%</strong>
          </div>
          <div class="importance-item__bar-wrap" aria-hidden="true">
            <div class="legend-bar importance-item__bar" style="width:${percentage.toFixed(1)}%"></div>
          </div>
        </div>
      `;
    }).join('');

    const bestFeature = sortedImportance[0]?.label || 'la variable principal';
    elements.note.innerHTML = `Con esta configuración, el modelo se ha evaluado sobre <strong>${formatInt(testRows.length)}</strong> vinos del conjunto de prueba. La variable con mayor peso en esta simulación es <strong>${bestFeature}</strong>. El umbral de decisión se ajusta con la partición de entrenamiento para maximizar la accuracy y, en caso de empate, se prioriza la opción más equilibrada entre sensibilidad y especificidad antes de mostrar el resultado final.`;
  };

  render();
}
