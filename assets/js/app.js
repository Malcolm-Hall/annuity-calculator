// @ts-check
'use strict'

console.log('Script is OK! ༼ つ ◕_◕ ༽つ');

// Types
/** @typedef {import('./lib/chartjs/chart.js').Chart} Chart */
/**
 * @typedef {object} CalculatorInputs
 * @property {?HTMLInputElement} [$startingPrincipal]
 * @property {?HTMLInputElement} [$annuityTerm]
 * @property {?HTMLInputElement} [$interestRate]
 * @property {?HTMLSelectElement} [$compound]
 * @property {?HTMLInputElement} [$monthlyIncome]
 * @property {?HTMLInputElement} [$annualIncrease]
 */

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

const pieChartData = [
    {
        data: [10, 60, 30],
        backgroundColor: [colors.primary, colors.primaryLight, colors.secondary],
        borderColor: colors.primary,
        borderWidth: 0.5,
    },
];

const barChartData = {
    labels: [
        1
    ],
    datasets: [
        {
            label: 'Placeholder 1',
            data: [
                5000,
            ],
            order: 1,
            backgroundColor: colors.primary,
            fill: true,
        },
        {
            label: 'Placeholder 2',
            data: [
                6000,
            ],
            order: 2,
            backgroundColor: colors.primaryLight,
            fill: true,
        },
        {
            label: 'Placeholder 3',
            data: [
                681,
            ],
            order: 3,
            backgroundColor: colors.secondary,
            fill: true,
        }
    ],
};

const $chartDonut = /** @type {HTMLCanvasElement} */ (document.getElementById('chart-donut'));

const $chartLoan = /** @type {HTMLCanvasElement} */ (document.getElementById('chart-loan'));

const $calculationType = /** @type {HTMLSelectElement} */ (document.getElementById('calc-type'));

const $calculateBtn = /** @type {HTMLButtonElement} */ (document.getElementById('calculate-btn'));

const calcInputs = /** @type {Record<number, CalculatorInputs>} */ ({
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

const calculateAnnuity = () => {
    console.warn("Calculate annuity called");
}

/**
 * @param {Chart} pieChart 
 * @param {Chart} barChart 
 */
const runApp = (pieChart, barChart) => {
    $calculationType.addEventListener('change', calculateAnnuity);
    $calculateBtn?.addEventListener('click', calculateAnnuity);
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

    const pieChart = new Chart($chartDonut, {
        type: 'pie',
        data: {
            datasets: pieChartData,
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

    const barChart = new Chart($chartLoan, {
        type: 'bar',
        data: barChartData,
        options: {
            response: true,
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

    runApp(pieChart, barChart);
})
