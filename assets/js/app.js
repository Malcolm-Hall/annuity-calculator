// @ts-check
'use strict'

console.log('Script is OK! ༼ つ ◕_◕ ༽つ');

// Types
/** @typedef {import('./lib/chartjs/chart.js').Chart} Chart */
/** @typedef {Record<string, ?HTMLElement | undefined>} ElementList */
/** @typedef {Record<string, number>[]} ResultList */
/**
 * @callback CalcFunc
 * @param {?number} principal
 * @param {?number} annuityTerm
 * @param {?number} interestRate
 * @param {number} compound
 * @param {?number} monthlyIncome
 * @param {?number} annualIncrease
 * @returns {{ calculationResults: ResultList, outputResults: Record<string, string>}}
 */

const CRITICAL_ERROR_MESSAGE = "Please refresh the page and try again.";
const CALCULATION_FAILED_ERROR_MESSAGE = "Please check the input values are reasonable";

/** @param {Event} event */
function toggleRelatedInputs(event) {
    const element = /** @type {HTMLSelectElement} */ (event.target);
    const id = element.id;
    const index = element.selectedIndex;

    document.querySelectorAll('.' + id)?.forEach(element => {
        element.classList.add("related-item-hidden");
    });

    document.querySelectorAll(`.related-to-${id}-${index}`)?.forEach(element => {
        element.classList.remove("related-item-hidden");
    });
}

/** @param {Event} event */
function forceNumeric(event) {
    const element = /** @type {?HTMLInputElement} */ (event.target);
    if (!element) return;
    element.value = element.value
        .replace(/[^0-9.]/g, '')
        .replace(/(\..*?)\..*/g, '$1');
}

/**
 * @param {number} num
 * @param {number} decimals
 * @returns {number}
 */
function roundTo(num, decimals = 0) {
    const exp = Math.pow(10, decimals);
    return Math.round((num + Number.EPSILON) * exp) / exp;
}

/**
 * @param {number} num
 * @param {string} space
 * @returns {string}
 */
function currencyFormat(num, space = '&nbsp') {
    return `R${space}` + num.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

/** 
 * @param {number} interestRate
 * @param {number} compound
 * @returns {number}
 */
function getInterestPayRate(interestRate, compound) {
    const cc = compound / 12;
    const interest = interestRate / 100 / compound;
    return Math.pow(1 + interest, cc) - 1;
}

/**
 * @param {ResultList} monthlyResults 
 * @returns {ResultList}
 */
function getAnnualResults(monthlyResults) {
    let annualResults = [];

    let totalInterest = 0;
    let totalWithdrawn = 0;

    let annualInterest = 0;
    let annualWithdrawals = 0;
    let annualStartBalance = undefined;

    monthlyResults.forEach((item, index) => {
        totalInterest += item.interestPayment;
        totalWithdrawn += item.withdrawal;
        annualInterest += item.interestPayment;
        annualWithdrawals += item.withdrawal;
        if (annualStartBalance === undefined) {
            annualStartBalance = item.startBalance;
        }

        if ((index + 1) % 12 === 0 || (index + 1) === monthlyResults.length) {
            annualResults.push({
                startBalance: annualStartBalance,
                endBalance: item.endBalance,
                interestPayment: annualInterest,
                withdrawal: annualWithdrawals,
                totalInterest,
                totalWithdrawn
            });
            annualInterest = 0;
            annualWithdrawals = 0;
            annualStartBalance = undefined;
        }
    });

    return annualResults;
}

/**
 * @param {number} principal
 * @param {?number} annuityTerm
 * @param {number} interestRate
 * @param {number} compound
 * @param {number} initialMonthlyIncome
 * @param {number} annualIncrease
 */
function calculateResult(
    principal,
    annuityTerm,
    interestRate,
    compound,
    initialMonthlyIncome,
    annualIncrease,
) {
    const ratePayB = getInterestPayRate(interestRate, compound);
    const firstInterestPayment = principal * ratePayB;
    if (firstInterestPayment > initialMonthlyIncome) {
        input.error([], `This annuity earns more in interest than it pays out in withdrawals. It will continue on indefinitely. Please increase the monthly withdrawal to a number above ${currencyFormat(firstInterestPayment)}.`, true);
        throw new Error("Invalid state");
    }

    const results = [];
    let balance = principal;
    let monthlyIncome = initialMonthlyIncome;

    let i = 1;
    while (balance >= 0.01) {
        const startBalance = balance;

        const withdrawal = Math.min(balance, monthlyIncome)
        balance -= withdrawal;

        const interestPayment = balance * ratePayB;
        balance += interestPayment;

        results.push({
            startBalance,
            endBalance: balance,
            interestPayment,
            withdrawal
        });

        if (i % 12 === 0) {
            monthlyIncome *= 1 + annualIncrease / 100;
        }

        i++;
    }

    const actualTerm = results.length / 12;
    console.warn(`Expect term of ${annuityTerm}, actual was ${actualTerm} (${results.length} months)`);

    return { results, actualTerm };
}

const DELTA = 0.0000000001;
const RETRY_COUNT = 10;
const DELTA_COUNT = 18;

/**
 * @param {(v: number) => number} resultGetter 
 * @param {number} initialIncrement 
 * @param {number} [initialValue]
 * @returns {number}
 */
function findParameter(
    resultGetter,
    initialIncrement,
    initialValue = 0.1,
) {
    let delta = DELTA;
    for (let d = 0; d < DELTA_COUNT; d++) {
        let dm = 1 - delta;
        let dp = 1;
        for (let r = 0; r <= RETRY_COUNT; r++) {
            let value = initialValue;
            let increment = initialIncrement * Math.pow(2, r);
            for (let i = 0; i < 1000; i++) {
                const ratio = resultGetter(value);
                if (ratio < dm) {
                    value -= increment;
                    increment = increment / 2;
                } else if (ratio >= dm && ratio <= dp) {
                    if (value < 0) {
                        input.error([], CALCULATION_FAILED_ERROR_MESSAGE, true);
                        return 0;
                    }
                    return value;
                } else {
                    value += increment;
                }
            }
        }
        delta += delta;
    }

    input.error([], CALCULATION_FAILED_ERROR_MESSAGE, true);
    return 0;
}

/**
 * @param {(v: number) => number} resultGetter 
 * @param {number} initialIncrement 
 * @param {number} initialValue 
 * @returns {number}
 */
function findMoneyParameter(
    resultGetter,
    initialIncrement,
    initialValue = 0.1,
    doSmallCheck = true,
) {
    if (doSmallCheck) {
        for (const v of [0.00, 0.01, 0.02]) {
            if (resultGetter(v) <= 1) return v;
        }
    }

    const foundV = roundTo(findParameter(resultGetter, initialIncrement, initialValue), 2);

    const fv = resultGetter(foundV);
    if (fv <= 1) return foundV;
    return foundV + 0.01;
}

/** @type {CalcFunc} */
function calculateMonthlyIncome(
    principal,
    annuityTerm,
    interestRate,
    compound,
    monthlyIncome,
    annualIncrease,
) {
    if (
        principal === null ||
        annuityTerm === null ||
        interestRate === null ||
        annualIncrease === null
    ) {
        input.error([], CRITICAL_ERROR_MESSAGE, true);
        throw new Error("Invalid state");
    }

    const ratePayB = getInterestPayRate(interestRate, compound);
    const firstInterestPayment = principal * ratePayB;

    const income = findMoneyParameter((i) => {
        const { actualTerm } = calculateResult(
            principal,
            annuityTerm,
            interestRate,
            compound,
            i,
            annualIncrease,
        );
        return actualTerm / annuityTerm;
    }, 100, firstInterestPayment, false);

    const { results } = calculateResult(
        principal,
        annuityTerm,
        interestRate,
        compound,
        income,
        annualIncrease,
    );

    const totalWithdrawn = results.map(it => it.withdrawal).reduce((a, b) => a + b);
    const totalInterest = results.map(it => it.interestPayment).reduce((a, b) => a + b);
    const endBalance = results[results.length - 1].endBalance;

    return {
        calculationResults: results,
        outputResults: {
            main: `Monthly Income: ${currencyFormat(income)}`,
            smallA: `Total Withdrawn: ${currencyFormat(totalWithdrawn)}, End Balance: ${currencyFormat(endBalance)}`,
            smallB: `Total Interest: ${currencyFormat(totalInterest)}`,
        }
    }
}

/** @type {CalcFunc} */
function calculateAnnuityTerm(
    principal,
    annuityTerm,
    interestRate,
    compound,
    monthlyIncome,
    annualIncrease,
) {
    if (
        principal === null ||
        interestRate === null ||
        monthlyIncome === null ||
        annualIncrease === null
    ) {
        input.error([], CRITICAL_ERROR_MESSAGE, true);
        throw new Error("Invalid state");
    }
    const { results, actualTerm } = calculateResult(
        principal,
        annuityTerm,
        interestRate,
        compound,
        monthlyIncome,
        annualIncrease,
    );

    const totalWithdrawn = results.map(it => it.withdrawal).reduce((a, b) => a + b);
    const totalInterest = results.map(it => it.interestPayment).reduce((a, b) => a + b);
    const endBalance = results[results.length - 1].endBalance;

    return {
        calculationResults: results,
        outputResults: {
            main: `Annuity Term: ${actualTerm.toFixed(1)} years`,
            smallA: `Total Withdrawn: ${currencyFormat(totalWithdrawn)}, End Balance: ${currencyFormat(endBalance)}`,
            smallB: `Total Interest: ${currencyFormat(totalInterest)}`,
        }
    }
}

/** @type {CalcFunc} */
function calculateStartingPrincipal(
    principal,
    annuityTerm,
    interestRate,
    compound,
    monthlyIncome,
    annualIncrease,
) {
    if (
        annuityTerm === null ||
        interestRate === null ||
        monthlyIncome === null ||
        annualIncrease === null
    ) {
        input.error([], CRITICAL_ERROR_MESSAGE, true);
        throw new Error("Invalid state");
    }

    const principalRequired = findMoneyParameter((p) => {
        const { actualTerm } = calculateResult(
            p,
            annuityTerm,
            interestRate,
            compound,
            monthlyIncome,
            annualIncrease,
        );
        return annuityTerm / actualTerm;
    }, monthlyIncome, monthlyIncome);

    const { results } = calculateResult(
        principalRequired,
        annuityTerm,
        interestRate,
        compound,
        monthlyIncome,
        annualIncrease,
    );

    const totalWithdrawn = results.map(it => it.withdrawal).reduce((a, b) => a + b);
    const totalInterest = results.map(it => it.interestPayment).reduce((a, b) => a + b);
    const endBalance = results[results.length - 1].endBalance;

    return {
        calculationResults: results,
        outputResults: {
            main: `Principal: ${currencyFormat(principalRequired)}`,
            smallA: `Total Withdrawn: ${currencyFormat(totalWithdrawn)}, End Balance: ${currencyFormat(endBalance)}`,
            smallB: `Total Interest: ${currencyFormat(totalInterest)}`,
        }
    }
}

/** @type {CalcFunc} */
function calculateInterestRate(
    principal,
    annuityTerm,
    interestRate,
    compound,
    monthlyIncome,
    annualIncrease,
) {
    if (
        principal == null ||
        annuityTerm === null ||
        monthlyIncome === null ||
        annualIncrease === null
    ) {
        input.error([], CRITICAL_ERROR_MESSAGE, true);
        throw new Error("Invalid state");
    }

    const rate = findParameter((r) => {
        const { actualTerm } = calculateResult(
            principal,
            annuityTerm,
            r,
            compound,
            monthlyIncome,
            annualIncrease,
        );
        return annuityTerm / actualTerm;
    }, 1, 0);

    const { results } = calculateResult(
        principal,
        annuityTerm,
        rate,
        compound,
        monthlyIncome,
        annualIncrease,
    );

    const totalWithdrawn = results.map(it => it.withdrawal).reduce((a, b) => a + b);
    const totalInterest = results.map(it => it.interestPayment).reduce((a, b) => a + b);
    const endBalance = results[results.length - 1].endBalance;

    return {
        calculationResults: results,
        outputResults: {
            main: `Interest Rate: ${rate.toFixed(3)}% `,
            smallA: `Total Withdrawn: ${currencyFormat(totalWithdrawn)}, End Balance: ${currencyFormat(endBalance)}`,
            smallB: `Total Interest: ${currencyFormat(totalInterest)}`,
        }
    }
}

/** @param {?number} compoundIndex */
function getCompoundFromIndex(compoundIndex) {
    switch (compoundIndex) {
        case 0:
            return 12;
        case 1:
            return 2;
        case 2:
            return 4;
        case 3:
            return 24;
        case 4:
            return 26;
        case 5:
            return 52;
        case 6:
            return 365;
        default:
            input.error([], CRITICAL_ERROR_MESSAGE, true);
            throw new Error(`Invalid compound index: ${compoundIndex}`);
    }
}

/** 
 * @param {?number} calcTypeIndex 
 * @returns {CalcFunc}
 */
function getCalcFuncFromIndex(calcTypeIndex) {
    switch (calcTypeIndex) {
        case 0: return calculateMonthlyIncome;
        case 1: return calculateAnnuityTerm;
        case 2: return calculateStartingPrincipal;
        case 3: return calculateInterestRate;
        default:
            input.error([], CRITICAL_ERROR_MESSAGE, true);
            throw new Error(`Invalid calculation type index: ${calcTypeIndex}`);
    }
}

const customDataLabels = {
    id: 'customDataLabel',
    afterDatasetDraw(chart, args, pluginOptions) {
        const {
            ctx,
            data
        } = chart;
        ctx.save();

        data.datasets[0].data.forEach((datapoint, index) => {
            const { x, y } = chart.getDatasetMeta(0).data[index].tooltipPosition();

            ctx.textAlign = 'center';
            ctx.font = '14px Inter';
            ctx.fillStyle = '#fff';
            ctx.textBaseline = 'middle';
            let toolTipText = datapoint != '0' ? datapoint + '%' : '';
            ctx.fillText(toolTipText, x, y);
        });
    },
};

const colors = {
    primary: '#162953',
    primaryLight: '#25468d',
    secondary: '#00ABD0'
};

const tooltip = {
    enabled: false,
    external: function (context) {
        let tooltipEl = document.getElementById('chartjs-tooltip');

        // Create element on first render
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'chartjs-tooltip';
            tooltipEl.innerHTML = '<table></table>';
            document.body.appendChild(tooltipEl);
        }

        // Hide if no tooltip
        const tooltipModel = context.tooltip;
        if (tooltipModel.opacity === 0) {
            tooltipEl.style.opacity = '0';
            return;
        }

        // Set caret Position
        tooltipEl.classList.remove('above', 'below', 'no-transform');
        if (tooltipModel.yAlign) {
            tooltipEl.classList.add(tooltipModel.yAlign);
        } else {
            tooltipEl.classList.add('no-transform');
        }

        function getBody(bodyItem) {
            return bodyItem.lines;
        }

        if (tooltipModel.body) {
            const bodyLines = tooltipModel.body.map(getBody);

            let innerHtml = '<thead>';

            let year = +(Number(tooltipModel.title) * 12).toFixed(0);
            let months = +(year % 12).toFixed(0);
            let yearText = `Year ${(year - months) / 12}`;
            let monthText = months === 0 ? '' : `, Month ${months}`;
            innerHtml += '<tr><th class="loan-chart__title">' + yearText + monthText + '</th></tr>';

            innerHtml += '</thead><tbody>';
            bodyLines.forEach(function (body, i) {
                innerHtml += '<tr><td class="loan-chart__text">' + body + '</td></tr>';
            });
            innerHtml += '</tbody>';

            const tableRoot = tooltipEl.querySelector('table');
            if (tableRoot) {
                tableRoot.innerHTML = innerHtml;
            }
        }

        const position = context.chart.canvas.getBoundingClientRect();

        // Display, position, and set styles for font
        tooltipEl.style.opacity = '1';
        tooltipEl.style.position = 'absolute';
        tooltipEl.style.left = position.left + window.scrollX + tooltipModel.caretX - tooltipEl.clientWidth / 2 + 'px';
        tooltipEl.style.top = position.top + window.scrollY + tooltipModel.caretY - tooltipEl.clientHeight / 2 + 'px';
        tooltipEl.classList.add('loan-chart');
    },
};

const secondaryChartData = [
    {
        data: [10, 60, 30],
        backgroundColor: [colors.primary, colors.primaryLight, colors.secondary],
        borderColor: colors.primary,
        borderWidth: 0.5,
    },
];

const primaryChartData = {
    labels: [
        1
    ],
    datasets: [
        {
            label: 'Ending Balance',
            data: [
                5000,
            ],
            stack: "1",
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        {
            label: 'Total Interest',
            data: [
                6000,
            ],
            stack: "2",
            backgroundColor: colors.primaryLight,
            borderColor: colors.primaryLight,
        },
        {
            label: 'Total Withdrawn',
            data: [
                681,
            ],
            stack: "3",
            backgroundColor: colors.secondary,
            borderColor: colors.secondary,
        }
    ],
};

const $errorBox = /** @type {HTMLElement} */ (document.getElementById('error-box'));
const $errorList = /** @type {HTMLElement} */ (document.getElementById('error-list'));
const $annualResultsTable = /** @type {HTMLElement} */ (document.getElementById('annual-results'));
const $monthlyResultsTable = /** @type {HTMLElement} */ (document.getElementById('monthly-results'));

const $secondaryChart = /** @type {HTMLCanvasElement} */ (document.getElementById('secondary-chart'));
const $primaryChart = /** @type {HTMLCanvasElement} */ (document.getElementById('primary-chart'));
const $calculationType = /** @type {HTMLSelectElement} */ (document.getElementById('calc-type'));
const $calculateBtn = /** @type {HTMLButtonElement} */ (document.getElementById('calculate-btn'));

const calcInputs = /** @type {Record<number, ElementList>} */ ({
    0: {
        $startingPrincipal: document.getElementById('starting-principal-0'),
        $annuityTerm: document.getElementById('annuity-term-0'),
        $interestRate: document.getElementById('interest-rate-0'),
        $compound: document.getElementById('compound-0'),
        $annualIncrease: document.getElementById('annual-increase-0'),
    },
    1: {
        $startingPrincipal: document.getElementById('starting-principal-1'),
        $interestRate: document.getElementById('interest-rate-1'),
        $compound: document.getElementById('compound-1'),
        $monthlyIncome: document.getElementById('monthly-income-1'),
        $annualIncrease: document.getElementById('annual-increase-1'),
    },
    2: {
        $annuityTerm: document.getElementById('annuity-term-2'),
        $interestRate: document.getElementById('interest-rate-2'),
        $compound: document.getElementById('compound-2'),
        $monthlyIncome: document.getElementById('monthly-income-2'),
        $annualIncrease: document.getElementById('annual-increase-2'),
    },
    3: {
        $startingPrincipal: document.getElementById('starting-principal-3'),
        $annuityTerm: document.getElementById('annuity-term-3'),
        $compound: document.getElementById('compound-3'),
        $monthlyIncome: document.getElementById('monthly-income-3'),
        $annualIncrease: document.getElementById('annual-increase-3'),
    }
});

const calcOutputs = /** @type {Record<number, ElementList>} */ ({
    0: {
        $main: document.getElementById('result-main-0'),
        $smallA: document.getElementById('result-small-A-0'),
        $smallB: document.getElementById('result-small-B-0'),
    },
    1: {
        $main: document.getElementById('result-main-1'),
        $smallA: document.getElementById('result-small-A-1'),
        $smallB: document.getElementById('result-small-B-1'),
    },
    2: {
        $main: document.getElementById('result-main-2'),
        $smallA: document.getElementById('result-small-A-2'),
        $smallB: document.getElementById('result-small-B-2'),
    },
    3: {
        $main: document.getElementById('result-main-3'),
        $smallA: document.getElementById('result-small-A-3'),
        $smallB: document.getElementById('result-small-B-3'),
    },
})

const input = {
    value: /** @type {*} */ (null),
    elementId: "",
    shown: false,
    processed: false,
    silent: false,
    reset: function () {
        this.shown = false;
        $errorBox.classList.remove('calculator-result--error-active');
        document.querySelectorAll('.input-field--error')?.forEach(el => el.classList.remove('input-field--error'))
        document.querySelectorAll('.calculator-result:not(.calculator-result--error)').forEach(el => el.classList.remove('calculator-result--hidden'))
    },
    error: function (inputId, message = `Incorrect value for "${inputId}"`, last = false) {
        if (this.silent) return;
        if (this.processed) this.reset();
        if (!Array.isArray(inputId)) inputId = [inputId];
        for (const inputIdItem of inputId) {
            const wrapperElement = /** @type {?HTMLElement} */ (document.getElementById(inputIdItem)?.parentNode);
            wrapperElement?.classList.add('input-field--error');
        }
        if (!this.shown) {
            this.processed = false;
            this.shown = true;
            $errorList.innerHTML = '';
            $errorBox.classList.add('calculator-result--error-active');
            document.querySelectorAll('.calculator-result:not(.calculator-result--error)').forEach(el => el.classList.add('calculator-result--hidden'))
        }
        const element = document.createElement('p');
        element.classList.add('calculator-error__item');
        element.innerHTML = message;
        $errorList.append(element);
        if (last) this.processed = true;
    },
    valid: function () {
        if (!this.shown || this.processed) this.reset();
        this.processed = true;
        this.silent = false;
        return !this.shown;
    },
    get: function (elementId) {
        this.elementId = elementId;
        let element = /** @type {HTMLInputElement} */ (document.getElementById(elementId));
        this.silent = false;
        if (element == null) {
            this.value = null;
        } else {
            this.value = element.value;
        }
        return this;
    },
    index: function () {
        const element = /** @type {?HTMLSelectElement} */ (document.getElementById(this.elementId));
        this.value = element?.selectedIndex;
        return this;
    },
    checked: function (elementId) {
        const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId))
        this.value = element?.checked;
        return this;
    },
    split: function (separator) {
        this.value = this.value.split(separator);
        return this;
    },
    replace: function (pattern, replacement) {
        this.value = this.value.replace(pattern, replacement);
        return this;
    },
    default: function (value) {
        if (!this.value) this.value = value;
        return this;
    },
    optional: function (value) {
        if (!this.value) this.silent = true;
        return this;
    },
    gt: function (compare = 0, errorText = `The ${this.elementId} must be greater than ${compare}.`) {
        if (isNaN(compare)) {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) <= compare) this.error(this.elementId, errorText);
        return this;
    },
    gte: function (compare = 0, errorText = `The ${this.elementId} must be greater than or equal to ${compare}.`) {
        if (isNaN(compare)) {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) < compare) this.error(this.elementId, errorText);
        return this;
    },
    lt: function (compare = 0, errorText = `The ${this.elementId} must be less than ${compare}.`) {
        if (isNaN(compare)) {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) >= compare) this.error(this.elementId, errorText);
        return this;
    },
    lte: function (compare = 0, errorText = `The ${this.elementId} must be less than or equal to ${compare}.`) {
        if (isNaN(compare)) {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) > compare) this.error(this.elementId, errorText);
        return this;
    },
    integer: function (errorText = `The ${this.elementId
        } must be integer number (-3, -2, -1, 0, 1, 2, 3, ...).`) {
        if (!this.value.match(/^-?(0|[1-9]\d*)$/)) this.error(this.elementId, errorText);
        return this;
    },
    _naturalRegexp: /^([1-9]\d*)$/,
    natural: function (errorText = `The ${this.elementId} must be a natural number(1, 2, 3, ...).`) {
        if (!this.value.match(this._naturalRegexp)) this.error(this.elementId, errorText);
        return this;
    },
    natural_numbers: function (errorText = `The ${this.elementId} must be a set of natural numbers(1, 2, 3, ...).`) {
        this.split(/[ ,]+/);
        if (!this.value.every(value => value.match(this._naturalRegexp))) this.error(this.elementId, errorText);
        return this;
    },
    _mixedRegexp: /^(0|-?[1-9]\d*|-?[1-9]\d*\/[1-9]\d*|-?[1-9]\d*\s[1-9]\d*\/[1-9]\d*)$/,
    mixed: function (errorText = `The ${this.elementId} must be an integer / fraction / mixed number(1, 2 / 3, 4 5 / 6, ...).`) {
        if (!this.value.match(this._mixedRegexp)) this.error(this.elementId, errorText);
        return this;
    },
    mixed_numbers: function (errorText = `The ${this.elementId} must be a set of integer / fraction / mixed numbers(1, 2 / 3, 4 5 / 6, ...).`) {
        this.split(/,\s*/);
        if (!this.value.every(value => value.match(this._mixedRegexp))) this.error(this.elementId, errorText);
        return this;
    },
    number: function (errorText = `The "${this.elementId}" must be a number.`) {
        if (this.value === '' || isNaN(Number(this.value))) this.error(this.elementId, errorText);
        return this;
    },
    probability: function (errorText = `The "${this.elementId}" must be a number between 0 and 1.`) {
        if (this.value === '' || isNaN(Number(this.value)) || Number(this.value) < 0 || Number(this.value) > 1)
            this.error(this.elementId, errorText);
        return this;
    },
    percentage: function (errorText = `The "${this.elementId}" must be a number between 0 and 100.`) {
        if (this.value === '' || isNaN(Number(this.value)) || Number(this.value) < 0 || Number(this.value) > 100)
            this.error(this.elementId, errorText);
        return this;
    },
    numbers: function (errorText = `The ${this.elementId} must be a set of numbers.`) {
        if (this.value.filter(value => isNaN(Number(value))).length) this.error(this.elementId, errorText);
        return this;
    },
    whole: function (errorText = `The ${this.elementId} must be a whole number.`) {
        if (!this.value.match(/^(0|[1-9]\d*)$/)) this.error(this.elementId, errorText);
        return this;
    },
    positive: function (errorText = `The ${this.elementId} must be greater than 0.`) {
        this.gt(0, errorText);
        return this;
    },
    nonZero: function (errorText = `The ${this.elementId} must be non - zero.`) {
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else
            if (Number(this.value) == 0) this.error(this.elementId, errorText);
        return this;
    },
    nonNegative: function (errorText = `The ${this.elementId} must be greater than or equal to 0.`) {
        this.gte(0, errorText);
        return this;
    },
    negative: function (errorText = `The ${this.elementId} must be less than 0.`) {
        this.lt(0, errorText);
        return this;
    },
    bool: function () {
        return !!this.value;
    },
    val: function () {
        if (this.value === '' || this.value === null) return null;
        return Number(this.value);
    },
    vals: function () {
        return this.value.map(value => Number(value));
    },
    raw: function () {
        return this.value;
    }
}

/** @param {ResultList} annualResults */
const displayAnnualResultsTable = (annualResults) => {
    let annualResultsHtml = '';
    annualResults.forEach((r, index) => {
        annualResultsHtml += `<tr>
            <td class="text-center">${index + 1}</td>
            <td>${currencyFormat(r.startBalance)}</td>
            <td>${currencyFormat(r.withdrawal)}</td>
            <td>${currencyFormat(r.interestPayment)}</td>
            <td>${currencyFormat(r.endBalance)}</td>
        </tr>`;
    });

    $annualResultsTable.innerHTML = annualResultsHtml;
}

/** @param {ResultList} monthlyResults */
const displayMonthlyResultsTable = (monthlyResults) => {
    let monthlyResultsHtml = '';
    monthlyResults.forEach((item, index) => {
        monthlyResultsHtml += `<tr>
            <td class="text-center">${index + 1}</td>
            <td>${currencyFormat(item.startBalance)}</td>
            <td>${currencyFormat(item.withdrawal)}</td>
            <td>${currencyFormat(item.interestPayment)}</td>
            <td>${currencyFormat(item.endBalance)}</td>
        </tr>`;

        if ((index + 1) % 12 === 0 || (index + 1) === monthlyResults.length) {
            const year = Math.ceil((index + 1) / 12);
            const title = `Year #${year} End`;
            monthlyResultsHtml += `<th class="white text-center" colspan="5">${title}</th>`;
        }
    });

    $monthlyResultsTable.innerHTML = monthlyResultsHtml;
}

/**
 * @param {ResultList} annualResults
 * @param {Chart} barChart
 */
const displayPrimaryResultsChart = (annualResults, barChart) => {
    barChart.data.labels = annualResults.map((_, idx) => idx + 1);
    barChart.data.datasets[0].data = annualResults.map(it => it.endBalance);
    barChart.data.datasets[1].data = annualResults.map(it => it.totalInterest);
    barChart.data.datasets[2].data = annualResults.map(it => it.totalWithdrawn);
    barChart.update()
}

const calculateInputs = () => {
    const calcTypeIndex = $calculationType.selectedIndex;
    const calcFunc = getCalcFuncFromIndex(calcTypeIndex);
    const {
        $startingPrincipal,
        $annuityTerm,
        $interestRate,
        $compound,
        $monthlyIncome,
        $annualIncrease
    } = calcInputs[calcTypeIndex];

    input.reset();
    const principal = input.get($startingPrincipal?.id).val();
    const annuityTerm = input.get($annuityTerm?.id).val();
    const interestRate = input.get($interestRate?.id).val();
    const compoundIdx = input.get($compound?.id).index().val();
    const monthlyIncome = input.get($monthlyIncome?.id).val();
    const annualIncrease = input.get($annualIncrease?.id).val();

    const compound = getCompoundFromIndex(compoundIdx);

    if (!input.valid()) throw new Error("Invalid State");

    console.warn("Calculate called: ", principal, annuityTerm, interestRate, compound, monthlyIncome, annualIncrease);

    const {
        outputResults: {
            main,
            smallA,
            smallB
        },
        calculationResults
    } = calcFunc(
        principal,
        annuityTerm,
        interestRate,
        compound,
        monthlyIncome,
        annualIncrease
    );

    const {
        $main,
        $smallA,
        $smallB
    } = calcOutputs[calcTypeIndex];

    $main && ($main.innerHTML = main);
    $smallA && ($smallA.innerHTML = smallA);
    $smallB && ($smallB.innerHTML = smallB);

    return calculationResults;
}

/**
 * @param {Chart} primaryChart 
 * @param {Chart} secondaryChart 
 */
const runApp = (primaryChart, secondaryChart) => {
    const monthlyResults = calculateInputs();
    const annualResults = getAnnualResults(monthlyResults);

    displayMonthlyResultsTable(monthlyResults);
    displayAnnualResultsTable(annualResults);
    displayPrimaryResultsChart(annualResults, primaryChart);
}

$calculationType.addEventListener('change', toggleRelatedInputs);

Object.values(calcInputs).forEach(({
    $startingPrincipal,
    $annuityTerm,
    $interestRate,
    $monthlyIncome,
    $annualIncrease,
}) => {
    [
        $startingPrincipal,
        $annuityTerm,
        $interestRate,
        $monthlyIncome,
        $annualIncrease,
    ].forEach(input => input?.addEventListener('input', forceNumeric));
});

import("./lib/chartjs/chart.js").then(({ Chart, registerables }) => {
    Chart.register(...registerables);

    const secondaryChart = new Chart($secondaryChart, {
        type: 'pie',
        data: {
            datasets: secondaryChartData,
        },
        options: {
            rotation: 0,
            hover: { mode: null },
            responsive: false,
            layout: {
                padding: 30,
            },
            plugins: {
                tooltip: {
                    enabled: false,
                },
                legend: {
                    display: false,
                },
            },
        },
        plugins: [customDataLabels],
    });

    const primaryChart = new Chart($primaryChart, {
        type: 'line',
        data: primaryChartData,
        options: {
            response: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: tooltip,
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    stacked: true,
                    ticks: {
                        callback: (it) => currencyFormat(it, ' '),
                    },
                },
                x: {
                    stacked: true,
                    ticks: {
                        callback: function (value, index, ticks) {
                            return value + 1;
                        }
                    },
                    grid: {
                        display: false
                    },
                },
            },
        }
    });

    $calculationType.addEventListener('change', () => runApp(primaryChart, secondaryChart));
    $calculateBtn.addEventListener('click', () => runApp(primaryChart, secondaryChart));
})
