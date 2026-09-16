(function () {
  'use strict';

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const sigmoid = (value) => {
    if (value >= 0) {
      const z = Math.exp(-value);
      return 1 / (1 + z);
    }
    const z = Math.exp(value);
    return z / (1 + z);
  };

  const seededRandom = (seed = 73) => {
    let state = Math.trunc(seed) % 2147483647;
    if (state <= 0) state += 2147483646;
    return () => {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };
  };

  const shuffleDeterministic = (items, seed = 73) => {
    const clone = [...items];
    const random = seededRandom(seed);
    for (let index = clone.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
    }
    return clone;
  };

  const splitRows = (rows, trainPercent, seed = 73) => {
    const shuffled = shuffleDeterministic(rows, seed);
    const trainCount = Math.max(
      1,
      Math.min(shuffled.length - 1, Math.round(shuffled.length * (Number(trainPercent) / 100)))
    );
    return {
      trainRows: shuffled.slice(0, trainCount),
      testRows: shuffled.slice(trainCount)
    };
  };

  const toDataset = (rows, featureKeys, qualityThreshold) => ({
    x: rows.map((row) => featureKeys.map((key) => Number(row[key]))),
    y: rows.map((row) => (Number(row.quality) >= qualityThreshold ? 1 : 0))
  });

  const normalizeImportance = (featureKeys, values) => {
    const safe = featureKeys.map((key, index) => [key, Math.max(0, Number(values[index]) || 0)]);
    const total = safe.reduce((sum, item) => sum + item[1], 0);
    const fallback = safe.length ? 1 / safe.length : 0;
    return Object.fromEntries(safe.map(([key, value]) => [key, total > 0 ? value / total : fallback]));
  };

  const trainLogisticRegression = (dataset, featureKeys) => {
    const { x, y } = dataset;
    const n = x.length;
    const p = featureKeys.length;
    const means = Array(p).fill(0);
    const stds = Array(p).fill(1);

    for (let j = 0; j < p; j += 1) {
      let sum = 0;
      for (let i = 0; i < n; i += 1) sum += x[i][j];
      means[j] = sum / n;
      let variance = 0;
      for (let i = 0; i < n; i += 1) variance += (x[i][j] - means[j]) ** 2;
      stds[j] = Math.sqrt(variance / n) || 1;
    }

    const weights = Array(p).fill(0);
    const positiveCount = y.reduce((sum, value) => sum + value, 0);
    let bias = Math.log((positiveCount + 1) / (n - positiveCount + 1));
    const learningRate = 0.09;
    const l2 = 0.002;
    const iterations = 260;

    for (let iter = 0; iter < iterations; iter += 1) {
      const grad = Array(p).fill(0);
      let gradBias = 0;
      for (let i = 0; i < n; i += 1) {
        let score = bias;
        for (let j = 0; j < p; j += 1) {
          score += weights[j] * ((x[i][j] - means[j]) / stds[j]);
        }
        const error = sigmoid(score) - y[i];
        gradBias += error;
        for (let j = 0; j < p; j += 1) {
          grad[j] += error * ((x[i][j] - means[j]) / stds[j]);
        }
      }

      const decay = 1 / Math.sqrt(1 + iter * 0.015);
      const step = learningRate * decay;
      bias -= step * (gradBias / n);
      for (let j = 0; j < p; j += 1) {
        weights[j] -= step * ((grad[j] / n) + l2 * weights[j]);
      }
    }

    return {
      predictVector(vector) {
        let score = bias;
        for (let j = 0; j < p; j += 1) {
          score += weights[j] * ((Number(vector[j]) - means[j]) / stds[j]);
        }
        return sigmoid(score);
      },
      importance: normalizeImportance(featureKeys, weights.map((value) => Math.abs(value)))
    };
  };

  const gini = (positive, total) => {
    if (!total) return 0;
    const p = positive / total;
    return 1 - p * p - (1 - p) * (1 - p);
  };

  const pickFeatureSubset = (p, count, random) => {
    if (count >= p) return Array.from({ length: p }, (_, index) => index);
    const values = Array.from({ length: p }, (_, index) => index);
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values.slice(0, count);
  };

  const buildTree = (x, y, indices, options, random, importance) => {
    const total = indices.length;
    let positives = 0;
    for (const index of indices) positives += y[index];
    const probability = (positives + 1) / (total + 2);

    if (
      options.depth >= options.maxDepth ||
      total < options.minSamplesSplit ||
      positives === 0 ||
      positives === total
    ) {
      return { leaf: true, probability };
    }

    const parentGini = gini(positives, total);
    const featureIndices = pickFeatureSubset(options.featureCount, options.mtry, random);
    let best = null;

    for (const featureIndex of featureIndices) {
      let min = Infinity;
      let max = -Infinity;
      for (const rowIndex of indices) {
        const value = x[rowIndex][featureIndex];
        if (value < min) min = value;
        if (value > max) max = value;
      }
      if (!Number.isFinite(min) || max <= min) continue;

      for (let step = 1; step <= options.thresholdSteps; step += 1) {
        const threshold = min + ((max - min) * step) / (options.thresholdSteps + 1);
        let leftCount = 0;
        let leftPositive = 0;
        for (const rowIndex of indices) {
          if (x[rowIndex][featureIndex] <= threshold) {
            leftCount += 1;
            leftPositive += y[rowIndex];
          }
        }
        const rightCount = total - leftCount;
        if (leftCount < options.minLeaf || rightCount < options.minLeaf) continue;
        const rightPositive = positives - leftPositive;
        const childGini = (leftCount / total) * gini(leftPositive, leftCount)
          + (rightCount / total) * gini(rightPositive, rightCount);
        const gain = parentGini - childGini;
        if (!best || gain > best.gain) best = { featureIndex, threshold, gain };
      }
    }

    if (!best || best.gain <= options.minGain) return { leaf: true, probability };

    const left = [];
    const right = [];
    for (const rowIndex of indices) {
      (x[rowIndex][best.featureIndex] <= best.threshold ? left : right).push(rowIndex);
    }

    importance[best.featureIndex] += best.gain * total;
    const childOptions = { ...options, depth: options.depth + 1 };
    return {
      leaf: false,
      featureIndex: best.featureIndex,
      threshold: best.threshold,
      probability,
      left: buildTree(x, y, left, childOptions, random, importance),
      right: buildTree(x, y, right, childOptions, random, importance)
    };
  };

  const predictTree = (tree, vector) => {
    let node = tree;
    while (!node.leaf) {
      node = Number(vector[node.featureIndex]) <= node.threshold ? node.left : node.right;
    }
    return node.probability;
  };

  const trainDecisionTree = (dataset, featureKeys, seed) => {
    const { x, y } = dataset;
    const p = featureKeys.length;
    const importance = Array(p).fill(0);
    const indices = Array.from({ length: x.length }, (_, index) => index);
    const tree = buildTree(x, y, indices, {
      featureCount: p,
      mtry: p,
      maxDepth: 7,
      minSamplesSplit: 28,
      minLeaf: 10,
      thresholdSteps: 10,
      minGain: 1e-5,
      depth: 0
    }, seededRandom(seed), importance);

    return {
      predictVector(vector) { return predictTree(tree, vector); },
      importance: normalizeImportance(featureKeys, importance)
    };
  };

  const trainRandomForest = (dataset, featureKeys, seed) => {
    const { x, y } = dataset;
    const n = x.length;
    const p = featureKeys.length;
    const forestRandom = seededRandom(seed);
    const trees = [];
    const aggregateImportance = Array(p).fill(0);
    const treeCount = n > 4500 ? 19 : 23;
    const mtry = Math.max(1, Math.round(Math.sqrt(p)));

    for (let treeIndex = 0; treeIndex < treeCount; treeIndex += 1) {
      const bootstrapIndices = Array.from({ length: n }, () => Math.floor(forestRandom() * n));
      const importance = Array(p).fill(0);
      const tree = buildTree(x, y, bootstrapIndices, {
        featureCount: p,
        mtry,
        maxDepth: 7,
        minSamplesSplit: 24,
        minLeaf: 8,
        thresholdSteps: 7,
        minGain: 1e-5,
        depth: 0
      }, seededRandom(seed + treeIndex * 101 + 17), importance);
      trees.push(tree);
      for (let j = 0; j < p; j += 1) aggregateImportance[j] += importance[j];
    }

    return {
      predictVector(vector) {
        let sum = 0;
        for (const tree of trees) sum += predictTree(tree, vector);
        return sum / trees.length;
      },
      importance: normalizeImportance(featureKeys, aggregateImportance)
    };
  };

  const train = ({ rows, featureKeys, qualityThreshold, algorithm, seed = 73 }) => {
    if (!Array.isArray(rows) || rows.length < 2) throw new Error('Se necesitan al menos dos filas para entrenar.');
    if (!Array.isArray(featureKeys) || !featureKeys.length) throw new Error('Selecciona al menos una variable.');

    const dataset = toDataset(rows, featureKeys, Number(qualityThreshold));
    const positives = dataset.y.reduce((sum, value) => sum + value, 0);
    if (positives === 0 || positives === dataset.y.length) {
      const probability = positives === dataset.y.length ? 1 : 0;
      return {
        algorithm,
        featureImportance: normalizeImportance(featureKeys, featureKeys.map(() => 1)),
        predictProbability: () => probability
      };
    }

    let fitted;
    if (algorithm === 'decision-tree') fitted = trainDecisionTree(dataset, featureKeys, seed);
    else if (algorithm === 'random-forest') fitted = trainRandomForest(dataset, featureKeys, seed);
    else fitted = trainLogisticRegression(dataset, featureKeys);

    return {
      algorithm,
      featureImportance: fitted.importance,
      predictProbability(row) {
        const vector = featureKeys.map((key) => Number(row[key]));
        return clamp(fitted.predictVector(vector), 0, 1);
      }
    };
  };

  const confusionMatrix = (rows, model, qualityThreshold, decisionThreshold = 0.5) => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let tn = 0;
    for (const row of rows) {
      const actual = Number(row.quality) >= qualityThreshold;
      const predicted = model.predictProbability(row) >= decisionThreshold;
      if (predicted && actual) tp += 1;
      else if (predicted && !actual) fp += 1;
      else if (!predicted && actual) fn += 1;
      else tn += 1;
    }
    return { tp, fp, fn, tn, total: rows.length };
  };

  const findDecisionThreshold = (trainRows, model, qualityThreshold) => {
    let bestThreshold = 0.5;
    let bestAccuracy = -1;
    let bestBalanced = -1;
    for (let candidate = 0.3; candidate <= 0.70001; candidate += 0.02) {
      const matrix = confusionMatrix(trainRows, model, qualityThreshold, candidate);
      const accuracy = matrix.total ? (matrix.tp + matrix.tn) / matrix.total : 0;
      const sensitivity = matrix.tp + matrix.fn ? matrix.tp / (matrix.tp + matrix.fn) : 0;
      const specificity = matrix.tn + matrix.fp ? matrix.tn / (matrix.tn + matrix.fp) : 0;
      const balanced = (sensitivity + specificity) / 2;
      if (
        accuracy > bestAccuracy + 1e-12 ||
        (Math.abs(accuracy - bestAccuracy) <= 1e-12 && balanced > bestBalanced)
      ) {
        bestAccuracy = accuracy;
        bestBalanced = balanced;
        bestThreshold = Number(candidate.toFixed(2));
      }
    }
    return bestThreshold;
  };

  window.WineML = { train, splitRows, confusionMatrix, findDecisionThreshold };
})();