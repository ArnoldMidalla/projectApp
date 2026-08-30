class RegressionNode {
  value: number | null = null;
  feature: number | null = null;
  threshold: number | null = null;
  left: RegressionNode | null = null;
  right: RegressionNode | null = null;
}

class SimpleRandomForest {
  nTrees: number;
  maxDepth: number;
  trees: RegressionNode[];

  constructor(nTrees = 30, maxDepth = 5) {
    this.nTrees = nTrees;
    this.maxDepth = maxDepth;
    this.trees = [];
  }

  train(X: number[][], y: number[]) {
    this.trees = [];
    for (let i = 0; i < this.nTrees; i++) {
      const sampleX: number[][] = [];
      const sampleY: number[] = [];
      for (let j = 0; j < X.length; j++) {
        const idx = Math.floor(Math.random() * X.length);
        sampleX.push(X[idx]);
        sampleY.push(y[idx]);
      }
      this.trees.push(this.buildTree(sampleX, sampleY, 0));
    }
  }

  buildTree(X: number[][], y: number[], depth: number): RegressionNode {
    const node = new RegressionNode();
    const mean = y.reduce((a, b) => a + b, 0) / y.length;
    node.value = mean;

    if (depth >= this.maxDepth || y.length <= 2) return node;

    let bestFeature: number | null = null;
    let bestThreshold: number | null = null;
    let bestMse = Infinity;

    const nFeatures = X[0].length;
    const mTry = Math.max(1, Math.floor(Math.sqrt(nFeatures)));
    const features: number[] = [];
    while (features.length < mTry) {
      const f = Math.floor(Math.random() * nFeatures);
      if (!features.includes(f)) features.push(f);
    }

    for (const f of features) {
      const values = X.map(row => row[f]);
      const uniqueValues = [...new Set(values)].sort((a,b)=>a-b);
      for (let i = 0; i < uniqueValues.length - 1; i++) {
        const threshold = (uniqueValues[i] + uniqueValues[i+1]) / 2;
        let leftSum = 0, rightSum = 0, leftCount = 0, rightCount = 0;
        let leftSqSum = 0, rightSqSum = 0;
        
        for (let j = 0; j < X.length; j++) {
          const val = y[j];
          if (X[j][f] <= threshold) { 
            leftSum += val; leftSqSum += val * val; leftCount++; 
          } else { 
            rightSum += val; rightSqSum += val * val; rightCount++; 
          }
        }
        
        if (leftCount === 0 || rightCount === 0) continue;
        
        // Fast MSE using Variance = E[X^2] - (E[X])^2
        const leftVariance = (leftSqSum / leftCount) - Math.pow(leftSum / leftCount, 2);
        const rightVariance = (rightSqSum / rightCount) - Math.pow(rightSum / rightCount, 2);
        
        // Weighted MSE
        const mse = (leftVariance * leftCount) + (rightVariance * rightCount);
        
        if (mse < bestMse) {
          bestMse = mse;
          bestFeature = f;
          bestThreshold = threshold;
        }
      }
    }

    if (bestFeature !== null && bestThreshold !== null) {
      node.feature = bestFeature;
      node.threshold = bestThreshold;
      const leftX: number[][] = [], leftY: number[] = [], rightX: number[][] = [], rightY: number[] = [];
      for (let j = 0; j < X.length; j++) {
        if (X[j][bestFeature] <= bestThreshold) { leftX.push(X[j]); leftY.push(y[j]); }
        else { rightX.push(X[j]); rightY.push(y[j]); }
      }
      node.left = this.buildTree(leftX, leftY, depth + 1);
      node.right = this.buildTree(rightX, rightY, depth + 1);
    }
    return node;
  }

  predictOne(x: number[], node: RegressionNode): number {
    if (node.left === null && node.right === null) return node.value || 0;
    if (node.feature !== null && node.threshold !== null) {
      if (x[node.feature] <= node.threshold) return this.predictOne(x, node.left!);
      return this.predictOne(x, node.right!);
    }
    return node.value || 0;
  }

  predict(X: number[][]): number[] {
    return X.map(x => {
      let sum = 0;
      for (const tree of this.trees) sum += this.predictOne(x, tree);
      return sum / this.trees.length;
    });
  }
}

export interface HourlyData {
  timestamp: string;
  value: number;
}

export interface DailyData {
  date: string;
  value: number;
}

export const formatHistoryToArray = (rawHistory: any): HourlyData[] => {
  if (!rawHistory) return [];
  const formatted = Object.keys(rawHistory).map(key => {
    const item = rawHistory[key];
    return {
      timestamp: item.period || key,
      value: item.energy_delta_kwh || 0
    };
  });
  formatted.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return formatted;
};

export const formatDailyToArray = (rawDaily: any): DailyData[] => {
  if (!rawDaily) return [];
  const formatted = Object.keys(rawDaily).map(key => {
    const item = rawDaily[key];
    return {
      date: item.date || key,
      value: item.energy_delta_kwh || 0
    };
  });
  formatted.sort((a, b) => a.date.localeCompare(b.date));
  return formatted;
};

const getPreviousDayDateString = (timestamp: string): string => {
  // timestamp format: "2026-08-27 14:00"
  const dateStr = timestamp.split(" ")[0]; // "2026-08-27"
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0]; // "2026-08-26"
};

export const createHybridDataset = (sortedHourly: HourlyData[], sortedDaily: DailyData[]) => {
  const X: number[][] = [];
  const y: number[] = [];
  
  // We need at least 1 hour of history to get 'Previous Hour'
  for (let i = 1; i < sortedHourly.length; i++) {
    const current = sortedHourly[i];
    const prevHourLoad = sortedHourly[i - 1].value;
    
    // Extract Hour and DayOfWeek
    // timestamp: "2026-08-27 14:00"
    const [dateStr, timeStr] = current.timestamp.split(" ");
    if (!dateStr || !timeStr) continue;
    
    const hour = parseInt(timeStr.split(":")[0], 10);
    const dayOfWeek = new Date(dateStr).getDay(); // 0-6
    
    // Find previous day's total load
    const prevDayStr = getPreviousDayDateString(current.timestamp);
    const prevDayMatch = sortedDaily.find(d => d.date === prevDayStr);
    const prevDayTotal = prevDayMatch ? prevDayMatch.value : 0;
    
    // Feature array: [HourOfDay, DayOfWeek, PrevHourLoad, PrevDayTotal]
    const features = [hour, dayOfWeek, prevHourLoad, prevDayTotal];
    
    X.push(features);
    y.push(current.value);
  }
  
  return { X, y };
};

export const trainAndPredict = async (sortedHourly: HourlyData[], sortedDaily: DailyData[]) => {
  return new Promise<{ predictedValue: number; trainingSize: number }>((resolve, reject) => {
    setTimeout(() => {
      try {
        const { X, y } = createHybridDataset(sortedHourly, sortedDaily);
        if (X.length === 0) return reject(new Error("Not enough data to train."));

        const regression = new SimpleRandomForest(5, 3);
        regression.train(X, y);

        // Predict the upcoming hour
        // If we are at T, the upcoming hour is T+1
        const lastHour = sortedHourly[sortedHourly.length - 1];
        
        // Let's guess the next hour's timestamp
        const [lastDate, lastTime] = lastHour.timestamp.split(" ");
        let nextHour = parseInt(lastTime.split(":")[0], 10) + 1;
        let nextDateStr = lastDate;
        
        if (nextHour >= 24) {
          nextHour = 0;
          const d = new Date(lastDate);
          d.setDate(d.getDate() + 1);
          nextDateStr = d.toISOString().split("T")[0];
        }
        
        const nextDayOfWeek = new Date(nextDateStr).getDay();
        const prevHourLoad = lastHour.value;
        const prevDayStr = getPreviousDayDateString(`${nextDateStr} 00:00`);
        const prevDayMatch = sortedDaily.find(d => d.date === prevDayStr);
        const prevDayTotal = prevDayMatch ? prevDayMatch.value : 0;
        
        const predictionFeatures = [[
          nextHour,
          nextDayOfWeek,
          prevHourLoad,
          prevDayTotal
        ]];

        const prediction = regression.predict(predictionFeatures);
        
        resolve({
          predictedValue: prediction[0],
          trainingSize: X.length
        });
      } catch (e) {
        reject(e);
      }
    }, 0);
  });
};
