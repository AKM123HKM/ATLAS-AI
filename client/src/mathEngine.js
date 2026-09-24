// ============================================================
// A.T.L.A.S 3K — LOCAL MATH ENGINE
// ============================================================
// Requires:
//   npm install mathjs
//
// App.jsx:
//   import { solveMath, isMathQuestion } from "./mathEngine";
//
// IMPORTANT:
//   This engine is completely local.
//   It does NOT make API/network requests.
// ============================================================

import { create, all } from "mathjs";

const math = create(all);

const EPS = 1e-10;

// ============================================================
// BASIC HELPERS
// ============================================================

function fmt(value, precision = 10) {
  if (value === null || value === undefined) {
    return "undefined";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return String(value);
    }

    if (Math.abs(value) < EPS) {
      return "0";
    }

    if (Math.abs(value - Math.round(value)) < EPS) {
      return String(Math.round(value));
    }

    return Number(value.toFixed(precision)).toString();
  }

  return String(value);
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeEvaluate(expression, scope = {}) {
  try {
    const value = math.evaluate(expression, scope);

    if (typeof value === "number") {
      return value;
    }

    if (
      value &&
      typeof value.valueOf === "function"
    ) {
      return value.valueOf();
    }

    return value;
  } catch {
    return null;
  }
}

// ============================================================
// CLEAN / VOICE NORMALIZATION
// ============================================================

export function clean(input) {
  let text = String(input ?? "")
    .toLowerCase()
    .replace(/[?]/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3");

  // ----------------------------------------------------------
  // ROOTS
  // ----------------------------------------------------------

  // square root of 144
  text = text.replace(
    /\bsquare\s+root\s+of\s+(-?\d+(?:\.\d+)?)\b/g,
    "sqrt($1)"
  );

  // square root 144
  text = text.replace(
    /\bsquare\s+root\s+(-?\d+(?:\.\d+)?)\b/g,
    "sqrt($1)"
  );

  // sqrt of 144
  text = text.replace(
    /\bsqrt\s+of\s+(-?\d+(?:\.\d+)?)\b/g,
    "sqrt($1)"
  );

  // cube root of 27
  text = text.replace(
    /\bcube\s+root\s+of\s+(-?\d+(?:\.\d+)?)\b/g,
    "cbrt($1)"
  );

  // cube root 27
  text = text.replace(
    /\bcube\s+root\s+(-?\d+(?:\.\d+)?)\b/g,
    "cbrt($1)"
  );

  // ----------------------------------------------------------
  // POWERS
  // ----------------------------------------------------------

  // x squared / x square
  text = text
    .replace(/\bx\s+squared\b/g, "x^2")
    .replace(/\bx\s+square\b/g, "x^2")
    .replace(/\bx\s+cubed\b/g, "x^3")
    .replace(/\bx\s+cube\b/g, "x^3");

  // number squared / number square
  text = text
    .replace(
      /(-?\d+(?:\.\d+)?)\s+squared\b/g,
      "($1)^2"
    )
    .replace(
      /(-?\d+(?:\.\d+)?)\s+square\b/g,
      "($1)^2"
    );

  // number cubed / number cube
  text = text
    .replace(
      /(-?\d+(?:\.\d+)?)\s+cubed\b/g,
      "($1)^3"
    )
    .replace(
      /(-?\d+(?:\.\d+)?)\s+cube\b/g,
      "($1)^3"
    );

  // to the power of
  text = text.replace(
    /\bto\s+the\s+power\s+of\s+(-?\d+(?:\.\d+)?)\b/g,
    "^$1"
  );

  text = text.replace(
    /\bto\s+the\s+power\s+(-?\d+(?:\.\d+)?)\b/g,
    "^$1"
  );

  // ----------------------------------------------------------
  // OPERATORS
  // ----------------------------------------------------------

  text = text
    .replace(/\bmultiplied\s+by\b/g, "*")
    .replace(/\btimes\b/g, "*")
    .replace(/\bdivided\s+by\b/g, "/")
    .replace(/\bdivided\b/g, "/")
    .replace(/\bover\b/g, "/")
    .replace(/\bplus\b/g, "+")
    .replace(/\bminus\b/g, "-");

  // ----------------------------------------------------------
  // EQUALITY
  // ----------------------------------------------------------

  text = text
    .replace(/\bis\s+equals?\s+to\b/g, "=")
    .replace(/\bis\s+equal\s+to\b/g, "=")
    .replace(/\bequals?\s+to\b/g, "=")
    .replace(/\bequal\s+to\b/g, "=")
    .replace(/\bis\s+equal\b/g, "=")
    .replace(/\bequals\b/g, "=")
    .replace(/\bequal\b/g, "=");

  // ----------------------------------------------------------
  // QUESTION / COMMAND WORDS
  // ----------------------------------------------------------

  text = text
    .replace(/\bwhat\s+is\b/g, "")
    .replace(/\bwhat's\b/g, "")
    .replace(/\bcalculate\b/g, "")
    .replace(/\bcompute\b/g, "")
    .replace(/\bevaluate\b/g, "")
    .replace(/\bfind\s+the\s+value\s+of\b/g, "")
    .replace(/\bfind\b/g, "")
    .replace(/\bsolve\b/g, "")
    .replace(/\bplease\b/g, "");

  // ----------------------------------------------------------
  // IMPLICIT MULTIPLICATION
  // ----------------------------------------------------------

  // 2 x -> 2*x
  text = text.replace(
    /(\d+(?:\.\d+)?)\s+x\b/g,
    "$1*x"
  );

  // 2x -> 2*x
  text = text.replace(
    /(\d+(?:\.\d+)?)x\b/g,
    "$1*x"
  );

  // ----------------------------------------------------------
  // WHITESPACE
  // ----------------------------------------------------------

  text = text
    .replace(/\s+/g, " ")
    .trim();

  console.log("MATH CLEAN INPUT:", text);

  return text;
}

// ============================================================
// NATURAL LANGUAGE -> MATH EXPRESSION
// ============================================================

function naturalToMath(input) {
  let x = clean(input);

  // ----------------------------------------------------------
  // SPOKEN NUMBER WORDS
  // ----------------------------------------------------------

  const numbers = {
    zero: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
    eleven: "11",
    twelve: "12",
    thirteen: "13",
    fourteen: "14",
    fifteen: "15",
    sixteen: "16",
    seventeen: "17",
    eighteen: "18",
    nineteen: "19",
    twenty: "20"
  };

  for (const [word, value] of Object.entries(numbers)) {
    x = x.replace(
      new RegExp(`\\b${word}\\b`, "g"),
      value
    );
  }

  // ----------------------------------------------------------
  // ROOTS
  // ----------------------------------------------------------

  x = x.replace(
    /\bsquare\s+root\s+of\s+(-?\d+(?:\.\d+)?)\b/g,
    "sqrt($1)"
  );

  x = x.replace(
    /\bcube\s+root\s+of\s+(-?\d+(?:\.\d+)?)\b/g,
    "cbrt($1)"
  );

  // ----------------------------------------------------------
  // POWERS
  // ----------------------------------------------------------

  x = x
    .replace(/\bx\s+squared\b/g, "x^2")
    .replace(/\bx\s+square\b/g, "x^2")
    .replace(/\bx\s+cubed\b/g, "x^3")
    .replace(/\bx\s+cube\b/g, "x^3")
    .replace(/\bsquared\b/g, "^2")
    .replace(/\bsquare\b/g, "^2")
    .replace(/\bcubed\b/g, "^3")
    .replace(/\bcube\b/g, "^3");

  // ----------------------------------------------------------
  // OPERATORS
  // ----------------------------------------------------------

  x = x
    .replace(/\bmultiplied\s+by\b/g, "*")
    .replace(/\btimes\b/g, "*")
    .replace(/\bdivided\s+by\b/g, "/")
    .replace(/\bover\b/g, "/")
    .replace(/\bplus\b/g, "+")
    .replace(/\bminus\b/g, "-");

  // ----------------------------------------------------------
  // EQUALITY
  // ----------------------------------------------------------

  x = x
    .replace(/\bis\s+equals?\s+to\b/g, "=")
    .replace(/\bis\s+equal\s+to\b/g, "=")
    .replace(/\bequals?\s+to\b/g, "=")
    .replace(/\bequal\s+to\b/g, "=")
    .replace(/\bis\s+equal\b/g, "=")
    .replace(/\bequals\b/g, "=")
    .replace(/\bequal\b/g, "=");

  // ----------------------------------------------------------
  // IMPLICIT MULTIPLICATION
  // ----------------------------------------------------------

  x = x.replace(
    /(\d+(?:\.\d+)?)\s*x\b/g,
    "$1*x"
  );

  x = x.replace(
    /(\d+(?:\.\d+)?)x\b/g,
    "$1*x"
  );

  return x
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// PERCENTAGES
// ============================================================

function solvePercentage(input) {
  const original = input.trim();

  // 25 percent of 480
  let match = original.match(
    /(-?\d+(?:\.\d+)?)\s*%?\s*percent\s+of\s+(-?\d+(?:\.\d+)?)/i
  );

  if (match) {
    const percent = Number(match[1]);
    const value = Number(match[2]);
    const result = value * percent / 100;

    return {
      type: "percentage",
      title: "PERCENTAGE",
      expression: original,
      result: fmt(result),
      numericResult: result,
      steps: [
        `${fmt(percent)}% of ${fmt(value)}`,
        `(${fmt(percent)} / 100) × ${fmt(value)}`,
        `= ${fmt(result)}`
      ]
    };
  }

  // 15% of 800
  match = original.match(
    /(-?\d+(?:\.\d+)?)\s*%\s*(?:of)?\s*(-?\d+(?:\.\d+)?)/i
  );

  if (match) {
    const percent = Number(match[1]);
    const value = Number(match[2]);
    const result = value * percent / 100;

    return {
      type: "percentage",
      title: "PERCENTAGE",
      expression: original,
      result: fmt(result),
      numericResult: result,
      steps: [
        `${fmt(percent)}% of ${fmt(value)}`,
        `(${fmt(percent)} / 100) × ${fmt(value)}`,
        `= ${fmt(result)}`
      ]
    };
  }

  // What percentage is 25 of 200
  match = original.match(
    /what\s+percentage\s+is\s+(-?\d+(?:\.\d+)?)\s+(?:of|from)\s+(-?\d+(?:\.\d+)?)/i
  );

  if (match) {
    const part = Number(match[1]);
    const total = Number(match[2]);
    const result = total === 0
      ? NaN
      : (part / total) * 100;

    if (!Number.isFinite(result)) return null;

    return {
      type: "percentage",
      title: "PERCENTAGE",
      expression: original,
      result: `${fmt(result)}%`,
      numericResult: result,
      steps: [
        `${fmt(part)} / ${fmt(total)}`,
        `× 100`,
        `= ${fmt(result)}%`
      ]
    };
  }

  // increase 500 by 20 percent
  match = original.match(
    /increase\s+(-?\d+(?:\.\d+)?)\s+by\s+(-?\d+(?:\.\d+)?)\s*%/i
  );

  if (match) {
    const value = Number(match[1]);
    const percent = Number(match[2]);
    const result = value * (1 + percent / 100);

    return {
      type: "percentage",
      title: "PERCENTAGE INCREASE",
      expression: original,
      result: fmt(result),
      numericResult: result,
      steps: [
        `Original = ${fmt(value)}`,
        `Increase = ${fmt(percent)}%`,
        `Final = ${fmt(value)} × (1 + ${fmt(percent)} / 100)`,
        `= ${fmt(result)}`
      ]
    };
  }

  // decrease 800 by 15 percent
  match = original.match(
    /decrease\s+(-?\d+(?:\.\d+)?)\s+by\s+(-?\d+(?:\.\d+)?)\s*%/i
  );

  if (match) {
    const value = Number(match[1]);
    const percent = Number(match[2]);
    const result = value * (1 - percent / 100);

    return {
      type: "percentage",
      title: "PERCENTAGE DECREASE",
      expression: original,
      result: fmt(result),
      numericResult: result,
      steps: [
        `Original = ${fmt(value)}`,
        `Decrease = ${fmt(percent)}%`,
        `Final = ${fmt(value)} × (1 - ${fmt(percent)} / 100)`,
        `= ${fmt(result)}`
      ]
    };
  }

  return null;
}

// ============================================================
// EQUATION HELPERS
// ============================================================

function polynomialCoefficients(expr, variable = "x") {
  const expression = naturalToMath(expr);

  try {
    const valueAtZero = Number(
      math.evaluate(expression, {
        [variable]: 0
      })
    );

    if (!Number.isFinite(valueAtZero)) {
      return null;
    }

    const coefficients = [];

    // c0
    coefficients[0] = valueAtZero;

    // c1, c2, c3, c4
    let derivative = math.parse(expression);

    for (let degree = 1; degree <= 4; degree++) {
      derivative = math.derivative(
        derivative,
        variable
      );

      const value = Number(
        derivative.evaluate({
          [variable]: 0
        })
      );

      if (!Number.isFinite(value)) {
        return null;
      }

      let coefficient = value;

      // divide by factorial(degree)
      let factorial = 1;

      for (let i = 2; i <= degree; i++) {
        factorial *= i;
      }

      coefficient /= factorial;

      coefficients[degree] = coefficient;
    }

    // Remove tiny coefficients
    for (let i = 0; i < coefficients.length; i++) {
      if (Math.abs(coefficients[i]) < EPS) {
        coefficients[i] = 0;
      }
    }

    return coefficients;
  } catch {
    return null;
  }
}

function solveOneVariableEquation(input) {
  console.log(
    ">>> solveOneVariableEquation RECEIVED:",
    input
  );

  let text = clean(input)
    .replace(/\bsolve\b/g, "")
    .replace(/\bfor\s+x\b/g, "")
    .trim();

  console.log(
    ">>> EQUATION AFTER CLEAN:",
    text
  );

  if (!text.includes("=")) {
    return null;
  }

  const parts = text.split("=");

  if (parts.length !== 2) {
    return null;
  }

  const left = naturalToMath(parts[0]);
  const right = naturalToMath(parts[1]);

  const expression = `(${left}) - (${right})`;

  console.log(
    ">>> EQUATION DIFFERENCE:",
    expression
  );

  // ----------------------------------------------------------
  // LINEAR / QUADRATIC / CUBIC / QUARTIC
  // ----------------------------------------------------------

  const coefficients = polynomialCoefficients(
    expression,
    "x"
  );

  if (!coefficients) {
    return null;
  }

  let degree = coefficients.length - 1;

  while (
    degree > 0 &&
    Math.abs(coefficients[degree]) < EPS
  ) {
    degree--;
  }

  const trimmed = coefficients.slice(
    0,
    degree + 1
  );

  console.log(
    ">>> POLYNOMIAL COEFFICIENTS:",
    trimmed
  );

  // ----------------------------------------------------------
  // IDENTITY
  // ----------------------------------------------------------

  if (
    trimmed.every(
      c => Math.abs(c) < EPS
    )
  ) {
    return {
      type: "equation",
      title: "EQUATION",
      expression: text,
      result: "All real numbers",
      variable: "x",
      solutions: [],
      steps: [
        `${left} = ${right}`,
        "Both sides are identical.",
        "Every real value of x is a solution."
      ]
    };
  }

  // ----------------------------------------------------------
  // CONSTANT / NO SOLUTION
  // ----------------------------------------------------------

  if (degree === 0) {
    return {
      type: "equation",
      title: "EQUATION",
      expression: text,
      result: "No solution",
      variable: "x",
      solutions: [],
      steps: [
        `${left} = ${right}`,
        "The equation reduces to a non-zero constant.",
        "Therefore there is no solution."
      ]
    };
  }

  // ----------------------------------------------------------
  // LINEAR
  // ax + b = 0
  // ----------------------------------------------------------

  if (degree === 1) {
    const b = trimmed[0];
    const a = trimmed[1];

    if (Math.abs(a) < EPS) {
      return null;
    }

    const x = -b / a;

    return {
      type: "equation",
      title: "LINEAR EQUATION",
      expression: text,
      result: `x = ${fmt(x)}`,
      variable: "x",
      solutions: [x],
      steps: [
        `${fmt(a)}x + ${fmt(b)} = 0`,
        `x = -(${fmt(b)}) / ${fmt(a)}`,
        `x = ${fmt(x)}`
      ]
    };
  }

  // ----------------------------------------------------------
  // QUADRATIC
  // ax² + bx + c = 0
  // ----------------------------------------------------------

  if (degree === 2) {
    const c = trimmed[0];
    const b = trimmed[1];
    const a = trimmed[2];

    const discriminant =
      b * b - 4 * a * c;

    console.log(
      ">>> QUADRATIC:",
      { a, b, c, discriminant }
    );

    if (discriminant < -EPS) {
      const realPart = -b / (2 * a);
      const imaginaryPart =
        Math.sqrt(-discriminant) / (2 * a);

      return {
        type: "equation",
        title: "QUADRATIC EQUATION",
        expression: text,
        result:
          `x = ${fmt(realPart)} ± ${fmt(
            Math.abs(imaginaryPart)
          )}i`,
        variable: "x",
        solutions: [
          {
            real: realPart,
            imaginary: imaginaryPart
          },
          {
            real: realPart,
            imaginary: -imaginaryPart
          }
        ],
        steps: [
          `a = ${fmt(a)}, b = ${fmt(b)}, c = ${fmt(c)}`,
          `Discriminant = b² - 4ac = ${fmt(discriminant)}`,
          "The roots are complex."
        ]
      };
    }

    if (Math.abs(discriminant) < EPS) {
      const x = -b / (2 * a);

      return {
        type: "equation",
        title: "QUADRATIC EQUATION",
        expression: text,
        result: `x = ${fmt(x)}`,
        variable: "x",
        solutions: [x],
        steps: [
          `a = ${fmt(a)}, b = ${fmt(b)}, c = ${fmt(c)}`,
          "Discriminant = 0",
          `x = -b / 2a = ${fmt(x)}`
        ]
      };
    }

    const sqrtD = Math.sqrt(
      Math.max(0, discriminant)
    );

    const x1 =
      (-b + sqrtD) / (2 * a);

    const x2 =
      (-b - sqrtD) / (2 * a);

    return {
      type: "equation",
      title: "QUADRATIC EQUATION",
      expression: text,
      result:
        `x₁ = ${fmt(x1)}, x₂ = ${fmt(x2)}`,
      variable: "x",
      solutions: [x1, x2],
      steps: [
        `a = ${fmt(a)}, b = ${fmt(b)}, c = ${fmt(c)}`,
        `Discriminant = ${fmt(discriminant)}`,
        `x₁ = (-b + √D) / 2a = ${fmt(x1)}`,
        `x₂ = (-b - √D) / 2a = ${fmt(x2)}`
      ]
    };
  }

  // ----------------------------------------------------------
  // CUBIC / QUARTIC
  // ----------------------------------------------------------

  if (degree === 3 || degree === 4) {
    const roots = durandKerner(trimmed);

    if (roots) {
      const formatted = roots
        .map((r, i) => {
          if (
            typeof r === "number"
          ) {
            return `x${i + 1} = ${fmt(r)}`;
          }

          return `x${i + 1} = ${formatComplex(r)}`;
        })
        .join(", ");

      return {
        type: "equation",
        title:
          degree === 3
            ? "CUBIC EQUATION"
            : "QUARTIC EQUATION",
        expression: text,
        result: formatted,
        variable: "x",
        solutions: roots,
        steps: [
          `Polynomial degree = ${degree}`,
          "Numerical polynomial solver used.",
          formatted
        ]
      };
    }
  }

  return null;
}

// ============================================================
// DURAND-KERNER POLYNOMIAL SOLVER
// ============================================================

function evaluatePolynomial(
  coefficients,
  z
) {
  let result = complex(0, 0);

  for (
    let i = coefficients.length - 1;
    i >= 0;
    i--
  ) {
    result = addComplex(
      multiplyComplex(result, z),
      complex(coefficients[i], 0)
    );
  }

  return result;
}

function durandKerner(coefficients) {
  const n = coefficients.length - 1;

  if (n < 1 || n > 4) {
    return null;
  }

  const leading = coefficients[n];

  if (Math.abs(leading) < EPS) {
    return null;
  }

  // Normalize
  const c = coefficients.map(
    x => x / leading
  );

  const radius = 1 +
    Math.max(
      ...c
        .slice(0, -1)
        .map(Math.abs)
    );

  let roots = [];

  for (let i = 0; i < n; i++) {
    const angle =
      (2 * Math.PI * i) / n;

    roots.push(
      complex(
        radius * Math.cos(angle),
        radius * Math.sin(angle)
      )
    );
  }

  for (let iteration = 0; iteration < 200; iteration++) {
    let converged = true;

    for (let i = 0; i < n; i++) {
      let denominator = complex(1, 0);

      for (let j = 0; j < n; j++) {
        if (i === j) continue;

        denominator =
          multiplyComplex(
            denominator,
            subtractComplex(
              roots[i],
              roots[j]
            )
          );
      }

      const numerator =
        evaluatePolynomial(
          c,
          roots[i]
        );

      const delta =
        divideComplex(
          numerator,
          denominator
        );

      roots[i] =
        subtractComplex(
          roots[i],
          delta
        );

      if (
        magnitudeComplex(delta) >
        1e-9
      ) {
        converged = false;
      }
    }

    if (converged) {
      break;
    }
  }

  return roots.map(r => {
    if (Math.abs(r.im) < 1e-7) {
      return r.re;
    }

    return r;
  });
}

// ============================================================
// COMPLEX NUMBER HELPERS
// ============================================================

function complex(re, im) {
  return { re, im };
}

function addComplex(a, b) {
  return complex(
    a.re + b.re,
    a.im + b.im
  );
}

function subtractComplex(a, b) {
  return complex(
    a.re - b.re,
    a.im - b.im
  );
}

function multiplyComplex(a, b) {
  return complex(
    a.re * b.re - a.im * b.im,
    a.re * b.im + a.im * b.re
  );
}

function divideComplex(a, b) {
  const denominator =
    b.re * b.re +
    b.im * b.im;

  if (denominator === 0) {
    return complex(
      Infinity,
      Infinity
    );
  }

  return complex(
    (a.re * b.re +
      a.im * b.im) /
      denominator,
    (a.im * b.re -
      a.re * b.im) /
      denominator
  );
}

function magnitudeComplex(z) {
  return Math.sqrt(
    z.re * z.re +
    z.im * z.im
  );
}

function formatComplex(z) {
  if (
    Math.abs(z.im) < 1e-7
  ) {
    return fmt(z.re);
  }

  const sign =
    z.im >= 0 ? "+" : "-";

  return `${fmt(z.re)} ${sign} ${fmt(
    Math.abs(z.im)
  )}i`;
}

// ============================================================
// BASIC EXPRESSION SOLVER
// ============================================================

function solveExpression(input) {
  const expression =
    naturalToMath(input);

  if (!expression) {
    return null;
  }

  // Don't treat equations as ordinary expressions.
  if (expression.includes("=")) {
    return null;
  }

  try {
    const value =
      math.evaluate(expression);

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return {
        type: "calculation",
        title: "LOCAL MATH ENGINE",
        expression,
        result: fmt(value),
        numericResult: value,
        engine: "MathJS",
        steps: [
          `Expression: ${expression}`,
          `Result = ${fmt(value)}`
        ]
      };
    }

    // Matrix / vector / complex / other MathJS result
    if (value != null) {
      return {
        type: "calculation",
        title: "LOCAL MATH ENGINE",
        expression,
        result: formatMathValue(value),
        numericResult: null,
        engine: "MathJS",
        steps: [
          `Expression: ${expression}`,
          `Result = ${formatMathValue(value)}`
        ]
      };
    }
  } catch {
    return null;
  }

  return null;
}

function formatMathValue(value) {
  try {
    if (
      value &&
      typeof value.toString === "function"
    ) {
      return value.toString();
    }

    return String(value);
  } catch {
    return String(value);
  }
}

// ============================================================
// TRIGONOMETRY
// ============================================================

function solveTrig(input) {
  const text = input
    .toLowerCase()
    .trim();

  const match = text.match(
    /\b(sine|sin|cosine|cos|tangent|tan)\s+(?:of\s+)?(-?\d+(?:\.\d+)?)\s*(degrees?|deg|radians?|rad)?/i
  );

  if (!match) {
    return null;
  }

  const fn = match[1];
  const angle = Number(match[2]);
  const unit = match[3] || "degrees";

  const radians =
    /rad/i.test(unit)
      ? angle
      : angle * Math.PI / 180;

  let result;

  if (/^sin|sine$/i.test(fn)) {
    result = Math.sin(radians);
  } else if (/^cos|cosine$/i.test(fn)) {
    result = Math.cos(radians);
  } else {
    result = Math.tan(radians);
  }

  if (
    Math.abs(result) < EPS
  ) {
    result = 0;
  }

  return {
    type: "trigonometry",
    title: "TRIGONOMETRY",
    expression: text,
    result: fmt(result),
    numericResult: result,
    steps: [
      `Angle = ${fmt(angle)} ${unit}`,
      `Radians = ${fmt(radians)}`,
      `Result = ${fmt(result)}`
    ]
  };
}

// ============================================================
// DERIVATIVES
// ============================================================

function solveDerivative(input) {
  const text =
    input.toLowerCase();

  if (
    !(
      text.includes("derivative") ||
      text.includes("differentiate")
    )
  ) {
    return null;
  }

  let expression = text
    .replace(
      /.*?\bof\b/i,
      ""
    )
    .trim();

  if (!expression) {
    return null;
  }

  expression =
    naturalToMath(expression);

  try {
    const derivative =
      math.derivative(
        expression,
        "x"
      );

    const result =
      derivative.toString();

    return {
      type: "derivative",
      title: "DERIVATIVE",
      expression,
      result,
      steps: [
        `f(x) = ${expression}`,
        `f'(x) = ${result}`
      ]
    };
  } catch {
    return null;
  }
}

// ============================================================
// INTEGRALS
// ============================================================

function simpsonIntegral(
  fn,
  a,
  b,
  n = 1000
) {
  if (n % 2 !== 0) {
    n++;
  }

  const h =
    (b - a) / n;

  let sum =
    fn(a) + fn(b);

  for (let i = 1; i < n; i++) {
    const x =
      a + i * h;

    sum +=
      (i % 2 === 0 ? 2 : 4) *
      fn(x);
  }

  return (
    h / 3
  ) * sum;
}

function solveIntegral(input) {
  const text =
    input.toLowerCase();

  if (
    !(
      text.includes("integral") ||
      text.includes("integrate")
    )
  ) {
    return null;
  }

  // Definite:
  // integral of x squared from 0 to 2
  const definite =
    text.match(
      /(?:integral|integrate).*?\bfrom\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)/i
    );

  let expression = text
    .replace(
      /.*?\bof\b/i,
      ""
    )
    .trim();

  if (!expression) {
    return null;
  }

  expression =
    naturalToMath(expression);

  try {
    if (definite) {
      const a =
        Number(definite[1]);

      const b =
        Number(definite[2]);

      const fn =
        math.compile(expression);

      const result =
        simpsonIntegral(
          x =>
            Number(
              fn.evaluate({ x })
            ),
          a,
          b
        );

      return {
        type: "integral",
        title: "DEFINITE INTEGRAL",
        expression,
        result: fmt(result),
        numericResult: result,
        steps: [
          `f(x) = ${expression}`,
          `Lower bound = ${fmt(a)}`,
          `Upper bound = ${fmt(b)}`,
          `Numerical integral = ${fmt(result)}`
        ]
      };
    }

    // Try symbolic integration
    const result =
      math.integral
        ? math.integral(
            expression,
            "x"
          ).toString()
        : null;

    if (result) {
      return {
        type: "integral",
        title: "INTEGRAL",
        expression,
        result,
        steps: [
          `f(x) = ${expression}`,
          `∫f(x)dx = ${result}`
        ]
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================================
// STATISTICS
// ============================================================

function extractNumbers(input) {
  const matches =
    String(input).match(
      /-?\d+(?:\.\d+)?/g
    );

  return matches
    ? matches.map(Number)
    : [];
}

function solveStatistics(input) {
  const text =
    input.toLowerCase();

  if (
    !(
      text.includes("mean") ||
      text.includes("median") ||
      text.includes("mode") ||
      text.includes("standard deviation") ||
      text.includes("variance")
    )
  ) {
    return null;
  }

  const values =
    extractNumbers(input);

  if (values.length === 0) {
    return null;
  }

  if (text.includes("mean")) {
    const result =
      values.reduce(
        (a, b) => a + b,
        0
      ) / values.length;

    return {
      type: "statistics",
      title: "MEAN",
      expression: input,
      result: fmt(result),
      numericResult: result,
      steps: [
        `Data = ${values.join(", ")}`,
        `Sum = ${fmt(
          values.reduce(
            (a, b) => a + b,
            0
          )
        )}`,
        `Count = ${values.length}`,
        `Mean = ${fmt(result)}`
      ]
    };
  }

  if (text.includes("median")) {
    const sorted =
      [...values].sort(
        (a, b) => a - b
      );

    const mid =
      Math.floor(
        sorted.length / 2
      );

    const result =
      sorted.length % 2
        ? sorted[mid]
        : (sorted[mid - 1] +
            sorted[mid]) /
          2;

    return {
      type: "statistics",
      title: "MEDIAN",
      expression: input,
      result: fmt(result),
      numericResult: result,
      steps: [
        `Sorted data = ${sorted.join(", ")}`,
        `Median = ${fmt(result)}`
      ]
    };
  }

  if (text.includes("mode")) {
    const counts = {};

    for (const value of values) {
      counts[value] =
        (counts[value] || 0) + 1;
    }

    const max =
      Math.max(
        ...Object.values(counts)
      );

    const modes =
      Object.entries(counts)
        .filter(
          ([, count]) =>
            count === max
        )
        .map(
          ([value]) =>
            Number(value)
        );

    return {
      type: "statistics",
      title: "MODE",
      expression: input,
      result: modes.join(", "),
      solutions: modes,
      steps: [
        `Data = ${values.join(", ")}`,
        `Mode = ${modes.join(", ")}`
      ]
    };
  }

  const mean =
    values.reduce(
      (a, b) => a + b,
      0
    ) / values.length;

  const variance =
    values.reduce(
      (sum, x) =>
        sum +
        Math.pow(x - mean, 2),
      0
    ) / values.length;

  const standardDeviation =
    Math.sqrt(variance);

  if (
    text.includes(
      "standard deviation"
    )
  ) {
    return {
      type: "statistics",
      title: "STANDARD DEVIATION",
      expression: input,
      result: fmt(
        standardDeviation
      ),
      numericResult:
        standardDeviation,
      steps: [
        `Mean = ${fmt(mean)}`,
        `Variance = ${fmt(variance)}`,
        `Standard deviation = ${fmt(
          standardDeviation
        )}`
      ]
    };
  }

  if (text.includes("variance")) {
    return {
      type: "statistics",
      title: "VARIANCE",
      expression: input,
      result: fmt(variance),
      numericResult: variance,
      steps: [
        `Mean = ${fmt(mean)}`,
        `Variance = ${fmt(variance)}`
      ]
    };
  }

  return null;
}

// ============================================================
// FACTORIAL / COMBINATORICS
// ============================================================

function solveCombinatorics(input) {
  const text =
    input.toLowerCase();

  let match =
    text.match(
      /\bfactorial\s+of\s+(\d+)/i
    );

  if (match) {
    const n =
      Number(match[1]);

    if (n > 170) {
      return null;
    }

    const result =
      math.factorial(n);

    return {
      type: "combinatorics",
      title: "FACTORIAL",
      expression: input,
      result: fmt(result),
      numericResult: result,
      steps: [
        `${n}!`,
        `= ${fmt(result)}`
      ]
    };
  }

  match =
    text.match(
      /\b(\d+)\s*(?:choose|combination)\s*(\d+)/i
    );

  if (match) {
    const n =
      Number(match[1]);

    const r =
      Number(match[2]);

    const result =
      math.combinations(n, r);

    return {
      type: "combinatorics",
      title: "COMBINATION",
      expression: input,
      result: fmt(result),
      numericResult: result,
      steps: [
        `C(${n}, ${r})`,
        `= ${fmt(result)}`
      ]
    };
  }

  return null;
}

// ============================================================
// MATRICES
// ============================================================

function extractMatrix(input) {
  const match =
    input.match(
      /\[\s*\[[\s\S]*\]\s*\]/
    );

  if (!match) {
    return null;
  }

  try {
    return math.evaluate(
      match[0]
    );
  } catch {
    return null;
  }
}

function solveMatrix(input) {
  const text =
    input.toLowerCase();

  if (
    !(
      text.includes("matrix") ||
      text.includes("determinant") ||
      text.includes("transpose") ||
      text.includes("inverse")
    )
  ) {
    return null;
  }

  const matrix =
    extractMatrix(input);

  if (!matrix) {
    return null;
  }

  try {
    if (
      text.includes("determinant")
    ) {
      const result =
        math.det(matrix);

      return {
        type: "matrix",
        title: "MATRIX DETERMINANT",
        expression: input,
        result: fmt(result),
        numericResult: result,
        steps: [
          `Matrix = ${matrix.toString()}`,
          `det(A) = ${fmt(result)}`
        ]
      };
    }

    if (
      text.includes("transpose")
    ) {
      const result =
        math.transpose(matrix);

      return {
        type: "matrix",
        title: "MATRIX TRANSPOSE",
        expression: input,
        result: result.toString(),
        steps: [
          `Matrix = ${matrix.toString()}`,
          `Transpose = ${result.toString()}`
        ]
      };
    }

    if (
      text.includes("inverse")
    ) {
      const result =
        math.inv(matrix);

      return {
        type: "matrix",
        title: "MATRIX INVERSE",
        expression: input,
        result: result.toString(),
        steps: [
          `Matrix = ${matrix.toString()}`,
          `Inverse = ${result.toString()}`
        ]
      };
    }
  } catch {
    return null;
  }

  return null;
}

// ============================================================
// VECTORS
// ============================================================

function extractVectors(input) {
  const matches =
    input.match(
      /\[[^\]]+\]/g
    );

  if (!matches) {
    return [];
  }

  return matches
    .map(v => {
      try {
        return math.evaluate(v);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function solveVector(input) {
  const text =
    input.toLowerCase();

  if (
    !(
      text.includes("vector") ||
      text.includes("dot product") ||
      text.includes("cross product") ||
      text.includes("magnitude")
    )
  ) {
    return null;
  }

  const vectors =
    extractVectors(input);

  if (
    vectors.length === 0
  ) {
    return null;
  }

  try {
    if (
      text.includes("dot product") &&
      vectors.length >= 2
    ) {
      const result =
        math.dot(
          vectors[0],
          vectors[1]
        );

      return {
        type: "vector",
        title: "DOT PRODUCT",
        expression: input,
        result: fmt(result),
        numericResult: result,
        steps: [
          `A = ${vectors[0].toString()}`,
          `B = ${vectors[1].toString()}`,
          `A · B = ${fmt(result)}`
        ]
      };
    }

    if (
      text.includes("cross product") &&
      vectors.length >= 2
    ) {
      const result =
        math.cross(
          vectors[0],
          vectors[1]
        );

      return {
        type: "vector",
        title: "CROSS PRODUCT",
        expression: input,
        result: result.toString(),
        steps: [
          `A = ${vectors[0].toString()}`,
          `B = ${vectors[1].toString()}`,
          `A × B = ${result.toString()}`
        ]
      };
    }

    if (
      text.includes("magnitude")
    ) {
      const result =
        math.norm(
          vectors[0]
        );

      return {
        type: "vector",
        title: "VECTOR MAGNITUDE",
        expression: input,
        result: fmt(result),
        numericResult: result,
        steps: [
          `Vector = ${vectors[0].toString()}`,
          `Magnitude = ${fmt(result)}`
        ]
      };
    }
  } catch {
    return null;
  }

  return null;
}

// ============================================================
// GEOMETRY
// ============================================================

function solveGeometry(input) {
  const text =
    input.toLowerCase();

  // Circle area
  let match =
    text.match(
      /area\s+of\s+(?:a\s+)?circle\s+(?:with\s+)?radius\s+(-?\d+(?:\.\d+)?)/i
    );

  if (match) {
    const r =
      Number(match[1]);

    const result =
      Math.PI * r * r;

    return {
      type: "geometry",
      title: "CIRCLE AREA",
      expression: input,
      result: fmt(result),
      numericResult: result,
      steps: [
        `r = ${fmt(r)}`,
        `Area = πr²`,
        `Area = ${fmt(result)}`
      ]
    };
  }

  // Rectangle area
  match =
    text.match(
      /area\s+of\s+(?:a\s+)?rectangle.*?length\s+(-?\d+(?:\.\d+)?).*?width\s+(-?\d+(?:\.\d+)?)/i
    );

  if (match) {
    const length =
      Number(match[1]);

    const width =
      Number(match[2]);

    const result =
      length * width;

    return {
      type: "geometry",
      title: "RECTANGLE AREA",
      expression: input,
      result: fmt(result),
      numericResult: result,
      steps: [
        `Length = ${fmt(length)}`,
        `Width = ${fmt(width)}`,
        `Area = length × width`,
        `Area = ${fmt(result)}`
      ]
    };
  }

  return null;
}

// ============================================================
// LIMIT
// ============================================================

function solveLimit(input) {
  const text =
    input.toLowerCase();

  if (!text.includes("limit")) {
    return null;
  }

  const match =
    text.match(
      /limit.*?(?:x\s+(?:approaches|approach|goes\s+to|tends\s+to)\s+)(-?\d+(?:\.\d+)?)/i
    );

  if (!match) {
    return null;
  }

  const target =
    Number(match[1]);

  const expression =
    text
      .replace(
        /limit.*?(?:x\s+(?:approaches|approach|goes\s+to|tends\s+to)\s+)-?\d+(?:\.\d+)?/i,
        ""
      )
      .replace(/^of\s+/i, "")
      .trim();

  if (!expression) {
    return null;
  }

  const expr =
    naturalToMath(expression);

  try {
    const compiled =
      math.compile(expr);

    const h = 1e-6;

    const left =
      compiled.evaluate({
        x: target - h
      });

    const right =
      compiled.evaluate({
        x: target + h
      });

    const result =
      (Number(left) +
        Number(right)) / 2;

    return {
      type: "limit",
      title: "LIMIT",
      expression: expr,
      result: fmt(result),
      numericResult: result,
      steps: [
        `f(x) = ${expr}`,
        `x → ${fmt(target)}`,
        `Numerical limit ≈ ${fmt(result)}`
      ]
    };
  } catch {
    return null;
  }
}

// ============================================================
// LINEAR SYSTEMS
// ============================================================

function rref(A) {
  const M =
    A.map(row =>
      row.map(Number)
    );

  const rows = M.length;
  const cols =
    M[0]?.length || 0;

  let pivotRow = 0;

  for (
    let col = 0;
    col < cols &&
    pivotRow < rows;
    col++
  ) {
    let best =
      pivotRow;

    for (
      let r = pivotRow + 1;
      r < rows;
      r++
    ) {
      if (
        Math.abs(M[r][col]) >
        Math.abs(M[best][col])
      ) {
        best = r;
      }
    }

    if (
      Math.abs(M[best][col]) <
      EPS
    ) {
      continue;
    }

    [
      M[pivotRow],
      M[best]
    ] = [
      M[best],
      M[pivotRow]
    ];

    const pivot =
      M[pivotRow][col];

    for (
      let c = 0;
      c < cols;
      c++
    ) {
      M[pivotRow][c] /=
        pivot;
    }

    for (
      let r = 0;
      r < rows;
      r++
    ) {
      if (r === pivotRow) {
        continue;
      }

      const factor =
        M[r][col];

      if (
        Math.abs(factor) <
        EPS
      ) {
        continue;
      }

      for (
        let c = 0;
        c < cols;
        c++
      ) {
        M[r][c] -=
          factor *
          M[pivotRow][c];
      }
    }

    pivotRow++;
  }

  return M;
}

function solveSystem(input) {
  const text =
    clean(input);

  const equations =
    text
      .split(
        /\s+(?:and|also)\s+|;|\n/i
      )
      .filter(
        x => x.includes("=")
      );

  if (equations.length < 2) {
    return null;
  }

  const variables =
    [
      ...new Set(
        equations
          .join(" ")
          .match(
            /\b[a-zA-Z]\b/g
          ) || []
      )
    ].filter(
      v => v !== "e"
    );

  if (
    variables.length < 2 ||
    variables.length > 4
  ) {
    return null;
  }

  const A = [];
  const B = [];

  try {
    for (const equation of equations) {
      const [
        left,
        right
      ] =
        equation
          .split("=")
          .map(x => x.trim());

      const difference =
        `(${naturalToMath(left)})-(${naturalToMath(right)})`;

      const row = [];
      let constant =
        Number(
          math.evaluate(
            difference,
            Object.fromEntries(
              variables.map(
                v => [v, 0]
              )
            )
          )
        );

      for (const variable of variables) {
        const derivative =
          math.derivative(
            difference,
            variable
          );

        const coefficient =
          Number(
            derivative.evaluate(
              Object.fromEntries(
                variables.map(
                  v => [v, 0]
                )
              )
            )
          );

        row.push(coefficient);
      }

      A.push(row);
      B.push(-constant);
    }

    const augmented =
      A.map(
        (row, i) => [
          ...row,
          B[i]
        ]
      );

    const R =
      rref(augmented);

    const solution =
      Array(
        variables.length
      ).fill(0);

    for (
      let i = 0;
      i < variables.length;
      i++
    ) {
      solution[i] =
        R[i]?.[variables.length] ??
        0;
    }

    const result =
      variables
        .map(
          (v, i) =>
            `${v} = ${fmt(solution[i])}`
        )
        .join(", ");

    return {
      type: "linear-system",
      title: "LINEAR SYSTEM",
      expression: equations.join("; "),
      result,
      solutions: solution,
      variable: variables,
      steps: [
        ...equations.map(
          (e, i) =>
            `Equation ${i + 1}: ${e}`
        ),
        `Variables: ${variables.join(", ")}`,
        `RREF = ${JSON.stringify(R)}`,
        result
      ]
    };
  } catch {
    return null;
  }
}

// ============================================================
// MATH QUESTION DETECTION
// ============================================================

export function isMathQuestion(input) {
  const text =
    String(input ?? "")
      .toLowerCase()
      .trim();

  if (!text) {
    return false;
  }

  // Explicit mathematical symbols
  if (
    /[0-9]\s*[\+\-\*\/\^=]\s*[0-9a-z]/i.test(
      text
    )
  ) {
    return true;
  }

  // Numbers + operators
  if (
    /\d+\s*(plus|minus|times|multiplied|divided|over)\s*\d+/i.test(
      text
    )
  ) {
    return true;
  }

  // Roots
  if (
    /\b(square\s+root|cube\s+root|sqrt|cbrt)\b/i.test(
      text
    )
  ) {
    return true;
  }

  // Powers
  if (
    /\b(square|squared|cube|cubed|power)\b/i.test(
      text
    )
  ) {
    return true;
  }

  // Equations
  if (
    /\bsolve\b/i.test(text) &&
    (
      text.includes("=") ||
      /\bx\b/i.test(text)
    )
  ) {
    return true;
  }

  // Percentages
  if (
    /%|\bpercent\b/i.test(text)
  ) {
    return true;
  }

  // Trigonometry
  if (
    /\b(sin|sine|cos|cosine|tan|tangent)\b/i.test(
      text
    )
  ) {
    return true;
  }

  // Calculus
  if (
    /\b(derivative|differentiate|integral|integrate|limit)\b/i.test(
      text
    )
  ) {
    return true;
  }

  // Statistics
  if (
    /\b(mean|median|mode|variance|standard deviation)\b/i.test(
      text
    )
  ) {
    return true;
  }

  // Matrix/vector
  if (
    /\b(matrix|determinant|transpose|inverse|vector|dot product|cross product|magnitude)\b/i.test(
      text
    )
  ) {
    return true;
  }

  // Geometry
  if (
    /\b(area|perimeter|radius|diameter|circumference)\b/i.test(
      text
    ) &&
    /\d/.test(text)
  ) {
    return true;
  }

  return false;
}

// ============================================================
// MAIN SOLVER
// ============================================================

export function solveMath(input) {
  if (
    !input ||
    typeof input !== "string"
  ) {
    return null;
  }

  const original =
    input.trim();

  console.log(
    "======================================"
  );

  console.log(
    "ATLAS LOCAL MATH ENGINE"
  );

  console.log(
    "RAW INPUT:",
    original
  );

  console.log(
    "======================================"
  );

  try {
    // --------------------------------------------------------
    // 1. EQUATIONS
    // --------------------------------------------------------

    const cleaned =
      clean(original);

    if (
      cleaned.includes("=")
    ) {
      const equation =
        solveOneVariableEquation(
          original
        );

      if (equation) {
        return equation;
      }

      const system =
        solveSystem(original);

      if (system) {
        return system;
      }
    }

    // --------------------------------------------------------
    // 2. PERCENTAGE
    // --------------------------------------------------------

    const percentage =
      solvePercentage(original);

    if (percentage) {
      return percentage;
    }

    // --------------------------------------------------------
    // 3. TRIGONOMETRY
    // --------------------------------------------------------

    const trig =
      solveTrig(original);

    if (trig) {
      return trig;
    }

    // --------------------------------------------------------
    // 4. DERIVATIVE
    // --------------------------------------------------------

    const derivative =
      solveDerivative(original);

    if (derivative) {
      return derivative;
    }

    // --------------------------------------------------------
    // 5. INTEGRAL
    // --------------------------------------------------------

    const integral =
      solveIntegral(original);

    if (integral) {
      return integral;
    }

    // --------------------------------------------------------
    // 6. LIMIT
    // --------------------------------------------------------

    const limit =
      solveLimit(original);

    if (limit) {
      return limit;
    }

    // --------------------------------------------------------
    // 7. STATISTICS
    // --------------------------------------------------------

    const statistics =
      solveStatistics(original);

    if (statistics) {
      return statistics;
    }

    // --------------------------------------------------------
    // 8. COMBINATORICS
    // --------------------------------------------------------

    const combinatorics =
      solveCombinatorics(original);

    if (combinatorics) {
      return combinatorics;
    }

    // --------------------------------------------------------
    // 9. MATRICES
    // --------------------------------------------------------

    const matrix =
      solveMatrix(original);

    if (matrix) {
      return matrix;
    }

    // --------------------------------------------------------
    // 10. VECTORS
    // --------------------------------------------------------

    const vector =
      solveVector(original);

    if (vector) {
      return vector;
    }

    // --------------------------------------------------------
    // 11. GEOMETRY
    // --------------------------------------------------------

    const geometry =
      solveGeometry(original);

    if (geometry) {
      return geometry;
    }

    // --------------------------------------------------------
    // 12. NORMAL MATHJS
    // --------------------------------------------------------

    const expression =
      solveExpression(original);

    if (expression) {
      return expression;
    }

    // --------------------------------------------------------
    // FAILED LOCALLY
    // --------------------------------------------------------

    return {
      type: "error",
      title: "MATH ENGINE",
      expression: original,
      result: "Could not solve locally",
      steps: [
        `Input: ${original}`,
        `Normalized: ${cleaned}`,
        "The local math engine could not classify the expression.",
        "No AI/API request was made."
      ],
      numericResult: null,
      engine: "LOCAL MATH ENGINE"
    };
  } catch (error) {
    console.error(
      "LOCAL MATH ENGINE ERROR:",
      error
    );

    return {
      type: "error",
      title: "MATH ENGINE ERROR",
      expression: original,
      result: "Could not solve locally",
      steps: [
        `Input: ${original}`,
        error?.message ||
          "Unknown local math error.",
        "No AI/API request was made."
      ],
      numericResult: null,
      engine: "LOCAL MATH ENGINE"
    };
  }
}

// ============================================================
// SPEECH OUTPUT
// ============================================================

export function mathResultToSpeech(result) {
  if (!result) {
    return "I could not solve that locally.";
  }

  if (
    result.type === "equation"
  ) {
    if (
      result.solutions &&
      result.solutions.length > 0
    ) {
      if (
        typeof result.solutions[0] ===
        "number"
      ) {
        return `The solution is ${result.solutions
          .map(
            value =>
              `x equals ${fmt(value)}`
          )
          .join(" and ")}.`;
      }

      return `The solutions are ${result.result}.`;
    }

    return result.result
      ? String(result.result)
      : "There is no real solution.";
  }

  if (
    result.result !== undefined &&
    result.result !== null
  ) {
    return `The answer is ${result.result}.`;
  }

  return "The mathematical calculation is complete.";
}

// ============================================================
// OPTIONAL DEBUG TEST
// ============================================================

if (
  typeof window !== "undefined"
) {
  window.ATLAS_MATH_TEST = {
    clean,
    solveMath,
    isMathQuestion
  };
}