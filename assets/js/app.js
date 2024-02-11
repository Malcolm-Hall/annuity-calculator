'use strict'

console.log('Script is OK! ༼ つ ◕_◕ ༽つ');

// Types
/** @typedef {import('./lib/chartjs/chart.js').Chart} Chart */

// DIALOG TABLE
if (document.querySelector('.result-table__dialog')) {
    import('./dialog-table.js').then(e => {
        console.log("Dialog table loaded (づ ◕‿◕ )づ")
    }).catch(e => {
        console.log("Sorry, dialog tables not loaded (ಥ﹏ಥ)", e)
    })
}

/** @param {Event} event */
function toggleRelatedInputs(event) {
    const element = event.target;
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
    event.target.value = event.target.value
        .replace(/[^0-9.]/g, '')
        .replace(/(\..*?)\..*/g, '$1');
}

/**
 * @param {number} num
 * @param {number} decimals
 * @returns {number}
 */
function roundTo(num, decimals = 5) {
    if (typeof num !== 'number' || !isFinite(num)) return num;
    if (num.toString().includes('e')) {
        const splitted = num.toString().split('e');
        return roundTo(+splitted[0], decimals) + `e${splitted[1]}`;
    };
    return +(Math.round(num + `e+${decimals}`) + `e-${decimals}`);
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
 * @param {number} num
 * @returns {number}
 */
function roundDown2Dp(num) {
    return Math.floor(num * 100) / 100;
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
            tooltipEl.style.opacity = 0;
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

            let tableRoot = tooltipEl.querySelector('table');
            tableRoot.innerHTML = innerHtml;
        }

        const position = context.chart.canvas.getBoundingClientRect();

        // Display, position, and set styles for font
        tooltipEl.style.opacity = 1;
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

/** @type {HTMLCanvasElement} */
const $chartDonut = document.getElementById('chart-donut');
/** @type {HTMLCanvasElement} */
const $chartLoan = document.getElementById('chart-loan');
/** @type {HTMLSelectElement} */
const $calculationType = document.getElementById('calc-type');
/** @type {HTMLButtonElement} */
const $calculateBtn = document.getElementById('calculate-btn');

// Calculation Inputs 0
/** @type {HTMLInputElement} */
const $startingPrincipal = document.getElementById('starting-principal');
/** @type {HTMLInputElement} */
const $annuityTerm = document.getElementById('annuity-term');
/** @type {HTMLInputElement} */
const $interestRate = document.getElementById('interest-rate');
/** @type {HTMLSelectElement} */
const $compound = document.getElementById('compound');
/** @type {HTMLInputElement} */
const $annualIncrease = document.getElementById('annual-increase');

// Calculation Inputs 1
/** @type {HTMLInputElement} */
const $startingPrincipal1 = document.getElementById('starting-principal-1');
/** @type {HTMLInputElement} */
const $interestRate1 = document.getElementById('interest-rate-1');
/** @type {HTMLSelectElement} */
const $compound1 = document.getElementById('compound-1');
/** @type {HTMLInputElement} */
const $monthlyIncome1 = document.getElementById('monthly-income-1');
/** @type {HTMLInputElement} */
const $annualIncrease1 = document.getElementById('annual-increase-1');

const calculateAnnuity = () => {
    console.warn("Calculate annuity called");
}

/**
 * @param {Chart} pieChart 
 * @param {Chart} barChart 
 */
const runApp = (pieChart, barChart) => {
    $calculationType.addEventListener('change', calculateAnnuity);
    $calculateBtn.addEventListener('click', calculateAnnuity);
}

$calculationType.addEventListener('change', toggleRelatedInputs);
[
    // 0
    $startingPrincipal,
    $annuityTerm,
    $interestRate,
    $annualIncrease,
    // 1
    $startingPrincipal1,
    $interestRate1,
    $monthlyIncome1,
    $annualIncrease1,
].forEach(input => input.addEventListener('input', forceNumeric));



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
