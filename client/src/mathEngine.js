import { create, all } from "mathjs";

const math = create(all);

/*
 * ============================================================
 * ATLAS LOCAL MATH ENGINE
 * ============================================================
 *
 * IMPORTANT:
 * This engine runs completely in the browser.
 *
 * Math questions handled here DO NOT call:
 *   /api/ask
 *   OpenRouter
 *   any LLM
 *
 * ============================================================
 */

function cleanInput(input) {
  return input
    .toLowerCase()
    .replace(/[?]/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .trim();
}

/*
 * Convert natural language into a MathJS expression.
 */
function normalizeExpression(input) {
  let expr = cleanInput(input);

  expr = expr
    .replace(/\bwhat is\b/g, "")
    .replace(/\bcalculate\b/g, "")
    .replace(/\bcalculate the\b/g, "")
    .replace(/\bfind\b/g, "")
    .replace(/\bthe value of\b/g, "")
    .replace(/\bvalue of\b/g, "")
    .replace(/\bequal to\b/g, "")
    .trim();

  /*
   * "18% of 840"
   * ->
   * "(18/100) * 840"
   */
  const percentOf = expr.match(
    /^(-?\d+(?:\.\d+)?)\s*%\s*(?:of|from)\s+(.+)$/
  );

  if (percentOf) {
    const percentage = percentOf[1];
    const value = percentOf[2];

    return {
      expression: `(${percentage}/100) * (${value})`,
      type: "percentage",
      original: `${percentage}% of ${value}`,
      percentage,
      value,
    };
  }

  /*
   * "25% ="
   */
  expr = expr.replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)");

  /*
   * Convert "x squared"
   */
  expr = expr.replace(/\bx\s+squared\b/g, "x^2");
  expr = expr.replace(/\bx\s+cubed\b/g, "x^3");

  /*
   * Convert "to the power of"
   */
  expr = expr.replace(
    /(.+?)\s+to\s+the\s+power\s+of\s+(.+)/g,
    "$1^$2"
  );

  /*
   * Remove common sentence endings.
   */
  expr = expr.replace(/\bplease\b/g, "");
  expr = expr.replace(/\bsolve\b/g, "");
  expr = expr.replace(/\bcalculate\b/g, "");

  return {
    expression: expr.trim(),
    type: "expression",
    original: input,
  };
}

/*
 * Detect whether a question is actually a math request.
 *
 * IMPORTANT:
 * This runs BEFORE the normal AI request.
 */
export function isMathQuestion(input) {
  if (!input || typeof input !== "string") return false;

  const q = input.toLowerCase();

  const mathPatterns = [
    /\bwhat is\b.*\d/,
    /\bcalculate\b/,
    /\bcompute\b/,
    /\bsolve\b/,
    /\bevaluate\b/,
    /\bfind\b.*\b(value|answer|result)\b/,
    /\bpercent\b/,
    /%/,
    /\bplus\b/,
    /\bminus\b/,
    /\btimes\b/,
    /\bdivided by\b/,
    /\bsquare root\b/,
    /\bsqrt\b/,
    /\bpower\b/,
    /\bsquared\b/,
    /\bcubed\b/,
    /\bdifferentiate\b/,
    /\bderivative\b/,
    /\bintegrate\b/,
    /\bintegral\b/,
    /\blimit\b/,
    /\bfactor\b/,
    /\bsimplify\b/,
    /\bmatrix\b/,
    /\bdeterminant\b/,
    /\bmean\b/,
    /\bmedian\b/,
    /\bmode\b/,
    /\bvariance\b/,
    /\bstandard deviation\b/,
    /\bstatistics\b/,
    /\bconvert\b.*\b(cm|m|km|kg|g|lb|ft|inch|mile|celsius|fahrenheit)\b/,
    /\d+\s*[\+\-\*\/\^]\s*\d+/,
    /\d+\s*%\s*(of)?\s*\d+/,
    /[a-z]\s*[\^=]\s*[\dxa-z]/i,
  ];

  return mathPatterns.some((pattern) => pattern.test(q));
}

/*
 * Format numbers beautifully.
 */
function formatNumber(value) {
  if (typeof value !== "number") return String(value);

  if (!Number.isFinite(value)) {
    return String(value);
  }

  if (Math.abs(value) < 1e-12) {
    return "0";
  }

  return Number(
    value.toFixed(12)
  ).toString();
}

/*
 * Percentage calculation
 */
function solvePercentage(data) {
  const percentage = Number(data.percentage);
  const value = math.evaluate(data.value);

  const decimal = percentage / 100;
  const result = decimal * value;

  return {
    type: "percentage",

    title: "PERCENTAGE CALCULATION",

    expression: `${percentage}% of ${value}`,

    result: formatNumber(result),

    steps: [
      `${percentage}% = ${percentage}/100`,
      `${percentage}/100 = ${formatNumber(decimal)}`,
      `${formatNumber(decimal)} × ${formatNumber(value)}`,
      `= ${formatNumber(result)}`,
    ],

    numericResult: result,
  };
}

/*
 * Basic MathJS expression.
 */
function solveExpression(data) {
  const expression = data.expression;

  const result = math.evaluate(expression);

  return {
    type: "calculation",

    title: "CALCULATION",

    expression,

    result: formatNumber(result),

    steps: [
      `Expression: ${expression}`,
      `Evaluating with MathJS...`,
      `Result = ${formatNumber(result)}`,
    ],

    numericResult: typeof result === "number" ? result : null,
  };
}

/*
 * Linear equation:
 *
 * 2x + 5 = 15
 *
 * x = 5
 */
function solveLinearEquation(input) {
  const normalized = input
    .replace(/²/g, "^2")
    .replace(/=/g, " = ");

  const match = normalized.match(
    /^(.+?)\s*=\s*(.+)$/
  );

  if (!match) return null;

  const left = match[1];
  const right = match[2];

  /*
   * Find coefficient and constant numerically.
   */
  const variableMatch = left.match(
    /^(-?\d*\.?\d*)\s*x\s*([+-]\s*\d+(?:\.\d+)?)?$/
  );

  if (!variableMatch) return null;

  let coefficient = variableMatch[1];

  if (coefficient === "" || coefficient === "+") {
    coefficient = 1;
  } else if (coefficient === "-") {
    coefficient = -1;
  } else {
    coefficient = Number(coefficient);
  }

  const constant = variableMatch[2]
    ? Number(variableMatch[2].replace(/\s/g, ""))
    : 0;

  const rhs = Number(
    math.evaluate(right)
  );

  const x = (rhs - constant) / coefficient;

  return {
    type: "equation",

    title: "LINEAR EQUATION",

    expression: `${left} = ${right}`,

    result: `x = ${formatNumber(x)}`,

    steps: [
      `Equation: ${left} = ${right}`,
      `Move constant to the other side`,
      `${coefficient}x = ${formatNumber(rhs - constant)}`,
      `Divide by ${coefficient}`,
      `x = ${formatNumber(x)}`,
    ],

    numericResult: x,
  };
}

/*
 * Quadratic equation using MathJS + quadratic formula.
 *
 * ax² + bx + c = 0
 */
function solveQuadratic(input) {
  const clean = input
    .toLowerCase()
    .replace(/solve/g, "")
    .replace(/equation/g, "")
    .replace(/²/g, "^2")
    .replace(/\s+/g, "");

  const equation = clean.includes("=")
    ? clean.split("=")[0]
    : clean;

  const match = equation.match(
    /^([+-]?\d*\.?\d*)?x\^2([+-]?\d*\.?\d*)?x([+-]?\d+(?:\.\d+)?)$/
  );

  if (!match) return null;

  let a = match[1];

  if (!a || a === "+") a = 1;
  else if (a === "-") a = -1;
  else a = Number(a);

  let b = match[2];

  if (!b || b === "+") b = 1;
  else if (b === "-") b = -1;
  else b = Number(b);

  const c = Number(match[3]);

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return {
      type: "quadratic",
      title: "QUADRATIC EQUATION",
      expression: input,
      result: "No real solutions",
      steps: [
        `a = ${a}`,
        `b = ${b}`,
        `c = ${c}`,
        `Discriminant = ${formatNumber(discriminant)}`,
        "Since the discriminant is negative, there are no real roots.",
      ],
    };
  }

  const sqrtD = Math.sqrt(discriminant);

  const x1 = (-b + sqrtD) / (2 * a);
  const x2 = (-b - sqrtD) / (2 * a);

  return {
    type: "quadratic",

    title: "QUADRATIC EQUATION",

    expression: input,

    result:
      x1 === x2
        ? `x = ${formatNumber(x1)}`
        : `x₁ = ${formatNumber(x1)}, x₂ = ${formatNumber(x2)}`,

    steps: [
      `a = ${a}, b = ${b}, c = ${c}`,
      `Discriminant = b² − 4ac`,
      `Discriminant = ${formatNumber(discriminant)}`,
      `√Discriminant = ${formatNumber(sqrtD)}`,
      `x = (−b ± √D) / 2a`,
      `x₁ = ${formatNumber(x1)}`,
      `x₂ = ${formatNumber(x2)}`,
    ],

    numericResult: x1,
    solutions: [x1, x2],
  };
}

/*
 * Derivative
 */
function solveDerivative(input) {
  const match = input.match(
    /(?:differentiate|derivative\s+of)\s+(.+?)(?:\s+with\s+respect\s+to\s+([a-z]))?$/i
  );

  if (!match) return null;

  const expression = match[1].trim();
  const variable = match[2] || "x";

  try {
    const result = math.derivative(
      expression,
      variable
    );

    return {
      type: "derivative",

      title: "DERIVATIVE",

      expression: `d/d${variable} (${expression})`,

      result: result.toString(),

      steps: [
        `Function: ${expression}`,
        `Variable: ${variable}`,
        `Applying symbolic differentiation...`,
        `Derivative = ${result.toString()}`,
      ],
    };
  } catch {
    return null;
  }
}

/*
 * Simplification
 */
function solveSimplification(input) {
  const match = input.match(
    /simplify\s+(.+)/i
  );

  if (!match) return null;

  const expression = match[1];

  try {
    const result = math.simplify(expression);

    return {
      type: "simplification",

      title: "SYMBOLIC SIMPLIFICATION",

      expression,

      result: result.toString(),

      steps: [
        `Original: ${expression}`,
        "Applying symbolic simplification...",
        `Simplified: ${result.toString()}`,
      ],
    };
  } catch {
    return null;
  }
}

/*
 * Statistics
 */
function solveStatistics(input) {
  const match = input.match(
    /(?:statistics|mean|median|mode|standard deviation|variance)\s*:?\s*\[?([0-9,\s.-]+)\]?/i
  );

  if (!match) return null;

  const values = match[1]
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x));

  if (!values.length) return null;

  const mean = math.mean(values);
  const median = math.median(values);
  const mode = math.mode(values);
  const variance = math.variance(values);
  const std = math.std(values);

  return {
    type: "statistics",

    title: "STATISTICAL ANALYSIS",

    expression: values.join(", "),

    result: `Mean = ${formatNumber(mean)}`,

    steps: [
      `Dataset: ${values.join(", ")}`,
      `Mean = ${formatNumber(mean)}`,
      `Median = ${formatNumber(median)}`,
      `Mode = ${Array.isArray(mode)
        ? mode.map(formatNumber).join(", ")
        : formatNumber(mode)}`,
      `Variance = ${formatNumber(variance)}`,
      `Standard deviation = ${formatNumber(std)}`,
    ],

    statistics: {
      mean,
      median,
      mode,
      variance,
      standardDeviation: std,
    },
  };
}

/*
 * Main MathJS entry point.
 */
export function solveMath(input) {
  if (!input || typeof input !== "string") {
    return null;
  }

  const original = input.trim();

  /*
   * 1. Percentage
   */
  const normalized = normalizeExpression(original);

  if (normalized.type === "percentage") {
    return solvePercentage(normalized);
  }

  /*
   * 2. Derivative
   */
  if (
    /\bdifferentiate\b|\bderivative\b/i.test(original)
  ) {
    const derivative = solveDerivative(original);

    if (derivative) return derivative;
  }

  /*
   * 3. Simplification
   */
  if (/\bsimplify\b/i.test(original)) {
    const simplified = solveSimplification(original);

    if (simplified) return simplified;
  }

  /*
   * 4. Statistics
   */
  if (
    /\bstatistics\b|\bmean\b|\bmedian\b|\bmode\b|\bstandard deviation\b|\bvariance\b/i.test(
      original
    )
  ) {
    const stats = solveStatistics(original);

    if (stats) return stats;
  }

  /*
   * 5. Quadratic
   */
  if (
    /\bx\s*(?:²|\^2)/i.test(original) &&
    /=/.test(original)
  ) {
    const quadratic = solveQuadratic(original);

    if (quadratic) return quadratic;
  }

  /*
   * 6. Basic equation
   */
  if (
    /=/.test(original) &&
    /\bx\b/i.test(original)
  ) {
    const linear = solveLinearEquation(
      original
        .replace(/^.*?\bsolve\b/i, "")
        .trim()
    );

    if (linear) return linear;
  }

  /*
   * 7. Normal MathJS expression
   */
  try {
    return solveExpression(normalized);
  } catch (error) {
    console.error(
      "ATLAS MathJS error:",
      error
    );

    return null;
  }
}

/*
 * Voice-friendly answer.
 */
export function mathResultToSpeech(result) {
  if (!result) {
    return "I couldn't solve that locally.";
  }

  if (result.type === "percentage") {
    return `${result.original} equals ${result.result}`;
  }

  if (result.type === "equation") {
    return `The solution is ${result.result}`;
  }

  if (result.type === "quadratic") {
    return `The solutions are ${result.result}`;
  }

  if (result.type === "derivative") {
    return `The derivative is ${result.result}`;
  }

  if (result.type === "statistics") {
    return `The mean is ${formatNumber(
      result.statistics.mean
    )}, and the standard deviation is ${formatNumber(
      result.statistics.standardDeviation
    )}.`;
  }

  return `The answer is ${result.result}`;
}

export { math };