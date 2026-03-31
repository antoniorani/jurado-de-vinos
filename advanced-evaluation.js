const advancedEvaluationPage = document.querySelector('[data-page="advanced-evaluation"]');

if (advancedEvaluationPage) {
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
    algorithm: document.querySelector('[data-advanced-stat="algorithm"]'),
    threshold: document.querySelector('[data-advanced-stat="threshold"]'),
    split: document.querySelector('[data-advanced-stat="split"]'),
    features: document.querySelector('[data-advanced-stat="features"]'),
    whiteTp: document.querySelector('[data-matrix="white-tp"]'),
    whiteFp: document.querySelector('[data-matrix="white-fp"]'),
    whiteFn: document.querySelector('[data-matrix="white-fn"]'),
    whiteTn: document.querySelector('[data-matrix="white-tn"]'),
    redTp: document.querySelector('[data-matrix="red-tp"]'),
    redFp: document.querySelector('[data-matrix="red-fp"]'),
    redFn: document.querySelector('[data-matrix="red-fn"]'),
    redTn: document.querySelector('[data-matrix="red-tn"]'),
    whiteMetrics: document.querySelector('[data-metrics="white"]'),
    redMetrics: document.querySelector('[data-metrics="red"]'),
    whiteCount: document.querySelector('[data-group-count="blanco"]'),
    redCount: document.querySelector('[data-group-count="tinto"]'),
    comparisonNote: document.getElementById('advancedComparisonNote'),
    note: document.getElementById('advancedEvaluationNote'),
    backToStep3Link: document.getElementById('backToStep3Link'),
    backToTrainingLink: document.getElementById('backToTrainingLink'),
    content: document.getElementById('advancedEvaluationContent'),
    emptyState: document.getElementById('advancedEmptyState')
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
        // Si falla el almacenamiento local, seguimos con la URL.
      }
      return queryConfig;
    }

    try {
      const raw = window.localStorage.getItem(configKey);
      if (!raw) return null;
      return normalizeConfig(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  };

  const buildParams = (config) => {
    const params = new URLSearchParams({
      threshold: String(config.threshold),
      split: String(config.split),
      selectedFeatures: config.selectedFeatures.join(','),
      algorithm: config.algorithm,
      trained: '1'
    });
    return params.toString();
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

  const buildMetrics = (tp, fp, fn, tn, totalCount) => {
    const safePercent = (numerator, denominator) => (denominator ? (numerator / denominator) * 100 : 0);
    return [
      {
        label: 'Accuracy',
        value: safePercent(tp + tn, totalCount),
        description: 'Porcentaje total de aciertos del modelo dentro de este grupo.'
      },
      {
        label: 'Sensibilidad',
        value: safePercent(tp, tp + fn),
        description: 'Proporción de compras reales detectadas correctamente en este grupo.'
      },
      {
        label: 'Especificidad',
        value: safePercent(tn, tn + fp),
        description: 'Porcentaje de rechazos reales que el modelo identifica bien.'
      },
      {
        label: 'Valor predictivo positivo',
        value: safePercent(tp, tp + fp),
        description: 'Fiabilidad de la predicción “comprar” dentro de este tipo de vino.'
      },
      {
        label: 'Valor predictivo negativo',
        value: safePercent(tn, tn + fn),
        description: 'Fiabilidad de la predicción “rechazar” dentro de este tipo de vino.'
      },
      {
        label: 'Tasa de detección',
        value: safePercent(tp, totalCount),
        description: 'Porción total del grupo en la que el modelo acierta una compra real.'
      }
    ];
  };

  const evaluateGroup = (groupRows, featureStats, config, decisionCutoff) => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let tn = 0;

    groupRows.forEach((row) => {
      const actualBuy = Number(row.quality) >= config.threshold;
      const probability = predictProbability(row, featureStats, config.algorithm);
      const predictedBuy = probability >= decisionCutoff;

      if (predictedBuy && actualBuy) tp += 1;
      if (predictedBuy && !actualBuy) fp += 1;
      if (!predictedBuy && actualBuy) fn += 1;
      if (!predictedBuy && !actualBuy) tn += 1;
    });

    return {
      tp,
      fp,
      fn,
      tn,
      total: groupRows.length,
      metrics: buildMetrics(tp, fp, fn, tn, groupRows.length)
    };
  };

  const renderMetricsTable = (target, metrics) => {
    target.innerHTML = metrics.map((metric) => `
      <tr>
        <td>${metric.label}</td>
        <td><strong>${formatPercent(metric.value)}</strong></td>
        <td>${metric.description}</td>
      </tr>
    `).join('');
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
      elements.comparisonNote.textContent = 'No se han encontrado datos cargados para calcular la comparación.';
      elements.note.textContent = 'La comparación por tipo de vino no está disponible porque faltan los datos del conjunto.';
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

    const queryString = buildParams(config);
    elements.backToStep3Link.href = `./evaluacion.html?${queryString}`;
    elements.backToTrainingLink.href = `./entrenamiento.html?${queryString}`;

    const shuffled = shuffleDeterministic(rows, 73);
    const trainCount = Math.max(1, Math.min(shuffled.length - 1, Math.round(shuffled.length * (config.split / 100))));
    const trainRows = shuffled.slice(0, trainCount);
    const testRows = shuffled.slice(trainCount);
    const featureStats = computeFeatureStats(trainRows, config.selectedFeatures, config.threshold);
    const decisionCutoff = findDecisionCutoff(trainRows, featureStats, config);

    const whiteRows = testRows.filter((row) => row.type === 'blanco');
    const redRows = testRows.filter((row) => row.type === 'tinto');

    const white = evaluateGroup(whiteRows, featureStats, config, decisionCutoff);
    const red = evaluateGroup(redRows, featureStats, config, decisionCutoff);

    elements.algorithm.textContent = algorithms[config.algorithm];
    elements.threshold.textContent = `Calidad ≥ ${config.threshold}`;
    elements.split.textContent = `${config.split}% train · ${100 - config.split}% test`;
    elements.features.textContent = String(config.selectedFeatures.length);

    elements.whiteCount.textContent = formatInt(white.total);
    elements.redCount.textContent = formatInt(red.total);

    elements.whiteTp.textContent = formatInt(white.tp);
    elements.whiteFp.textContent = formatInt(white.fp);
    elements.whiteFn.textContent = formatInt(white.fn);
    elements.whiteTn.textContent = formatInt(white.tn);
    elements.redTp.textContent = formatInt(red.tp);
    elements.redFp.textContent = formatInt(red.fp);
    elements.redFn.textContent = formatInt(red.fn);
    elements.redTn.textContent = formatInt(red.tn);

    renderMetricsTable(elements.whiteMetrics, white.metrics);
    renderMetricsTable(elements.redMetrics, red.metrics);

    elements.comparisonNote.innerHTML = 'Compara ambas tablas fijándote en la accuracy, la sensibilidad, la especificidad y en qué casillas de las matrices de confusión aparecen más diferencias. Así podrás valorar si el modelo responde de forma parecida o no en blancos y tintos sin adelantar una conclusión cerrada.';
    elements.note.innerHTML = 'Usa esta página como apoyo para argumentar tus propias conclusiones. Observa qué grupo concentra más falsos positivos o falsos negativos y decide si esas diferencias te parecen pequeñas, moderadas o importantes para la decisión de compra.';
  };

  render();
}
