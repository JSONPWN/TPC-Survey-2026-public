Chart.register(ChartDataLabels);

async function loadResponses() {
    try {
const requests = [
    fetch("./data/responses.json"),
    fetch("./data/questions.json")
];

if (pageGroup == "philosophy") {
    requests.push(fetch(encodeURI("./data/philpapers-survey-2020 (1).json")));
}

const [responseResult, questionResult, philpapersResult] = await Promise.all(requests);

if (!responseResult.ok) {
    throw new Error("Couldn't load responses.json");
}

if (!questionResult.ok) {
    throw new Error("Couldn't load questions.json");
}

const data = await responseResult.json();
const questionGroups = await questionResult.json();
let philpapersData = null;

if (pageGroup == "philosophy" && philpapersResult && philpapersResult.ok) {
    philpapersData = await philpapersResult.json();
}

const compareToggle = document.getElementById("comparePhilPapers");

// filters: { question -> Set(selected values) }; compare mirrors the PhilPapers
// toggle; chartType is "bar" or "pie"; valueMode is "percent" or "count".
const state = { filters: {}, compare: false, chartType: "bar", valueMode: "percent" };

function render() {
    // Canvas text isn't styled by CSS, so pull the theme's text colour and give
    // it to Chart.js (keeps axis/legend labels legible in dark & pink themes).
    Chart.defaults.color = getComputedStyle(document.body).getPropertyValue("--text").trim() || "#1f2937";

    const filtered = applyDemographicFilters(data, state.filters);
    updateFilterSummary(data.length, filtered.length, state.filters);

    const dashboard = document.getElementById("dashboard");

    if (data.length > 0 && filtered.length === 0) {
        const respondentCount = document.getElementById("respondentCount");
        if (respondentCount) respondentCount.textContent = "0";
        dashboard.innerHTML =
            `<div class="alert alert-warning">No respondents match the selected demographic filters.</div>`;
        return;
    }

    generateCharts(filtered, questionGroups, philpapersData, state.compare, state.chartType, state.valueMode);
}

// Only show the filter bar on pages that actually render charts.
const questionsForPage = questionGroups[pageGroup] || [];
const demographicQuestions = questionGroups.demographics || [];

if (questionsForPage.length > 0 && demographicQuestions.length > 0) {
    buildFilterBar(demographicQuestions, data, state, render);
}

// Bar/Pie + %/Count switches (shown on any page that renders charts).
if (questionsForPage.length > 0) {
    buildChartTypeToggle(state, render);
}

// Re-render charts when the theme toggle changes body's class, so the canvas
// text colour follows the theme.
new MutationObserver(render).observe(document.body, {
    attributes: true,
    attributeFilter: ["class"]
});

if (compareToggle) {
    compareToggle.checked = false;
    state.compare = false;
    compareToggle.addEventListener("change", () => {
        state.compare = compareToggle.checked;
        render();
    });
}

render();

} catch (err) {

document.getElementById("dashboard").innerHTML =
    `<div class="alert alert-danger">${err.message}</div>`;

}
}

// Questions whose answers are comma-separated multi-selects (split, don't count whole).
const multiSelectQuestions = [
"Which fields of non-philosophical study or formal knowledge would you say that you have at least undergraduate level knowledge in?",
"In what ways do you engage in philosophy in your daily life?",
"Which fields of Philosophy do you consider to be your strengths?\n\nThis list is non-exhaustive. Enter your specific subfield into Others.",
"Which areas of philosophy have you actively engaged with/are you most interested in?"
];

// "Favorite philosopher" is free text, so answers vary by spacing, case, and
// last-name-vs-full-name. We canonicalize it at render time (raw data untouched).
const FAVORITE_PHILOSOPHER_Q = "Who is your favorite philosopher?";

// Normalized key: NFKC, single-spaced, lowercased, trailing dots/spaces stripped.
function philKey(s) {
    return String(s).normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase().replace(/[.\s]+$/, "");
}

// Curated last-name <-> full-name merges (both key forms map to one display name).
const philosopherAliases = {
    "hume": "David Hume",
    "david hume": "David Hume",
    "heidegger": "Martin Heidegger",
    "martin heidegger": "Martin Heidegger",
    "korsgaard": "Christine Korsgaard",
    "christine korsgaard": "Christine Korsgaard"
};

// Build a raw -> canonical-display mapper. For non-aliased names, display uses
// the most common original spelling in the data (so we don't invent casing).
function buildPhilosopherCanon(dataset, question) {
    const byKey = {};
    dataset.forEach(p => {
        const v = p[question];
        if (v == null || v === "") return;
        const raw = String(v).normalize("NFKC").replace(/\s+/g, " ").trim();
        const k = philKey(raw);
        (byKey[k] = byKey[k] || {})[raw] = (byKey[k][raw] || 0) + 1;
    });

    const majority = {};
    Object.entries(byKey).forEach(([k, spellings]) => {
        majority[k] = Object.entries(spellings)
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    });

    return function (raw) {
        const clean = String(raw).normalize("NFKC").replace(/\s+/g, " ").trim();
        const k = philKey(clean);
        return philosopherAliases[k] || majority[k] || clean;
    };
}

// Maps TPC question text -> key in the PhilPapers 2020 dataset (only mappable questions).
const philpapersQuestionMap = {
"A priori knowledge (Knowledge which can be justified without appeal to experience) : Yes or No? ": "a_priori_knowledge",
"Aesthetic value: Objective or Subjective? ": "aesthetic_value",
"Atheism (No belief in God(-s))\n\nOr \n\nTheism (Belief in God(-s))": "god",
"What is your perspective on the question \"What is the meaning of life\"": "meaning_of_life",
"Meta-ethics": "meta_ethics",
"Aim of philosophy (which is most important?): wisdom, understanding, truth/knowledge, happiness, or goodness/justice? ": "aim_of_philosophy",
"Is the mind:\nNon-physical (like a soul, which is\nseparate from the body, and can survive the body's death is) \n\nor\n\nPhysical (the mind is the brain or the mind is a physical thing that fits the right criteria such as the right functional organisation)": "mind",
"Free will: \n\nlibertarianism, no free will, or compatibilism?": "free_will",
"Is it permissible to eat animals and/or animal products in ordinary circumstances?: \n\nVeganism (no and no), omnivorism (yes and yes), or vegetarianism (no and yes)": "eating_animals_and_animal_products",
"Empiricism (True knowledge comes from sensory experience and empirical evidence)\n\nor\n\nRationalism (Knowledge can be derived from reason; Reason is the chef source of knowledge)": "knowledge",
"Which Political Philosophy do you agree with?: \nLibertarianism (Individual liberty is paramount)\n\nor\n\nEgalitarianism (Equality is paramount)\n\nor \n\nCommunitarianism (Human identities are shaped by their constitutive communities/social relations)?": "political_philosophy",
"Is gender: \nunreal, social, psychological, or biological?": "gender",
"Normative ethics: virtue ethics, deontology, or consequentialism?": "normative_ethics",
"The Trolley Problem": "trolley_problem",
"The Experience Machine: The Experience Machine (Internet Encyclopedia of Philosophy)\n\nImagine a machine that could give you any experience (or sequence of experiences) you might desire. \n\nYou can program your experiences for tomorrow, or this week, or this year, or even for the rest of your life.  You can live your fondest dreams “from the inside.” \n\nOnce you enter, you will not remember choosing to do so. Will you choose to enter the machine for the rest of your life?": "experience_machine",
"What is your preferred interpretation of probability?\n\nBayesian (The probability of an event is interpreted as reasonable expectation and updated as information updates)\n\nor\n\nFrequentist (The probability of an event is its relative frequency over time)": "probability"
};

function getPhilpapersCountsForQuestion(question, philpapersData) {
if (!philpapersData || !question) return null;

const key = philpapersQuestionMap[question];
if (!key || !philpapersData[key]) return null;

return philpapersData[key];
}

// --- Demographic filtering -------------------------------------------------

// Answer -> array of values: multi-selects split on commas, blanks -> ["No Response"].
function answerValues(person, question) {
let answer = person[question];

if (answer == null || answer === "") {
    return ["No Response"];
}

answer = String(answer);

if (multiSelectQuestions.includes(question)) {
    return answer.split(",").map(p => p.trim()).filter(p => p.length > 0);
}

return [answer];
}

// Keep people matching every active demographic: OR within a demographic, AND across them.
function applyDemographicFilters(data, filters) {
const active = Object.entries(filters).filter(([, set]) => set && set.size > 0);

if (active.length === 0) return data;

return data.filter(person =>
    active.every(([question, set]) =>
        answerValues(person, question).some(v => set.has(v))
    )
);
}

// Distinct values for a question, ordered by frequency, "No Response" last.
function distinctValues(data, question) {
const counts = {};

data.forEach(person => {
    answerValues(person, question).forEach(v => {
        counts[v] = (counts[v] || 0) + 1;
    });
});

return Object.entries(counts)
    .sort((a, b) => {
        if (a[0] === "No Response") return 1;
        if (b[0] === "No Response") return -1;
        return b[1] - a[1];
    });
}

// First line of a long question, trimmed to fit the dropdown button.
function shortLabel(question) {
let label = question.split("\n")[0].replace(/\?\s*$/, "").trim();
if (label.length > 42) label = label.slice(0, 40).trim() + "…";
return label;
}

function updateFilterSummary(total, shown, filters) {
const summary = document.getElementById("filterSummary");
if (!summary) return;

const activeCount = Object.values(filters).filter(set => set && set.size > 0).length;

if (activeCount === 0) {
    summary.textContent = `Showing all ${total} respondents`;
} else {
    summary.textContent = `Showing ${shown} of ${total} respondents · ${activeCount} filter${activeCount === 1 ? "" : "s"} active`;
}
}

function buildFilterBar(demographicQuestions, data, state, render) {
const dashboard = document.getElementById("dashboard");
if (!dashboard) return;

const bar = document.createElement("section");
bar.id = "demographicFilters";
bar.className = "filter-bar card mb-4";

const controls = demographicQuestions.map((question, qi) => {
    const values = distinctValues(data, question);
    if (values.length === 0) return "";

    const checkboxes = values.map(([value, count], vi) => {
        const id = `filter-${qi}-${vi}`;
        const safeValue = value.replace(/"/g, "&quot;");
        return `
        <div class="form-check">
            <input class="form-check-input filter-checkbox" type="checkbox"
                   id="${id}" data-question-index="${qi}" data-value="${safeValue}">
            <label class="form-check-label" for="${id}">
                ${value} <span class="text-muted">(${count})</span>
            </label>
        </div>`;
    }).join("");

    return `
    <div class="dropdown filter-dropdown" data-question-index="${qi}">
        <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button"
                data-bs-toggle="dropdown" data-bs-auto-close="outside"
                title="${question.replace(/"/g, "&quot;").replace(/\n/g, " ")}">
            ${shortLabel(question)}
            <span class="badge filter-badge rounded-pill bg-primary ms-1 d-none">0</span>
        </button>
        <div class="dropdown-menu filter-menu p-2">
            ${checkboxes}
        </div>
    </div>`;
}).join("");

bar.innerHTML = `
<div class="card-body">
    <div class="filter-bar-header">
        <span class="filter-bar-title"><i class="fa-solid fa-filter me-2"></i>Filter by demographics</span>
        <span class="filter-bar-meta">
            <span id="filterSummary" class="text-muted me-3"></span>
            <button id="filterReset" type="button" class="btn btn-sm btn-outline-secondary">Reset filters</button>
        </span>
    </div>
    <div class="filter-controls">
        ${controls}
    </div>
</div>`;

dashboard.parentNode.insertBefore(bar, dashboard);

// One selection Set per demographic.
demographicQuestions.forEach(question => {
    if (!state.filters[question]) state.filters[question] = new Set();
});

function updateBadge(qi) {
    const question = demographicQuestions[qi];
    const set = state.filters[question];
    const dropdown = bar.querySelector(`.filter-dropdown[data-question-index="${qi}"]`);
    if (!dropdown) return;
    const badge = dropdown.querySelector(".filter-badge");
    if (set.size > 0) {
        badge.textContent = set.size;
        badge.classList.remove("d-none");
    } else {
        badge.classList.add("d-none");
    }
}

bar.querySelectorAll(".filter-checkbox").forEach(cb => {
    cb.addEventListener("change", () => {
        const qi = Number(cb.dataset.questionIndex);
        const question = demographicQuestions[qi];
        const set = state.filters[question];
        if (cb.checked) {
            set.add(cb.dataset.value);
        } else {
            set.delete(cb.dataset.value);
        }
        updateBadge(qi);
        render();
    });
});

bar.querySelector("#filterReset").addEventListener("click", () => {
    bar.querySelectorAll(".filter-checkbox").forEach(cb => { cb.checked = false; });
    demographicQuestions.forEach((question, qi) => {
        state.filters[question] = new Set();
        updateBadge(qi);
    });
    render();
});
}

// --- Charts ----------------------------------------------------------------

// Sort answers by count; if more than 4, keep the top 3 and roll the rest into "Other".
function buildChartEntries(counts) {
let entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
let hiddenAnswers = [];
let isExpanded = false;
const fullEntries = entries;

if (entries.length > 4) {
hiddenAnswers = entries.slice(3);
const otherTotal = hiddenAnswers.reduce((sum, item) => sum + item[1], 0);
entries = [
    ...entries.slice(0, 3),
    ["Other", otherTotal]
];
}

return { entries, hiddenAnswers, isExpanded, fullEntries };
}

// Concise axis labels for a few very long answer options. The full text is kept
// for the tooltip (shown on hover); only the chart axis uses the short form.
const answerShortLabels = {
    "What is the highest level of formal training you have in philosophy?": {
        "I'm an autodidact (self-study)": "Autodidact (self-study)",
        "I'm in an undergraduate program in philosophy, or have an undergraduate degree in philosophy": "Undergrad — philosophy",
        "I'm in a graduate program in philosophy, or have a graduate degree in philosophy": "Grad — philosophy",
        "I'm in an undergraduate program in something other than philosophy, or have an undergraduate degree in something other than philosophy": "Undergrad — other field",
        "I'm in a graduate program in something other than philosophy, or have a graduate degree in something other than philosophy": "Grad — other field",
        "I'm involved in academic philosophy professionally (including adjuncts, teaching professors, research professors, tenure track etc.)": "Professional academic"
    }
};

function displayLabel(question, full) {
    const map = answerShortLabels[question];
    return (map && map[full]) || full;
}

// Word-wrap a long axis label into lines.
const MAX_CHARS_PER_LINE = 26;

function wrapLabel(label) {
    label = String(label);
    if (label.length <= MAX_CHARS_PER_LINE) return [label];

    const words = label.split(" ");
    const lines = [];
    let currentLine = "";

    words.forEach(word => {
        if ((currentLine + " " + word).trim().length > MAX_CHARS_PER_LINE) {
            if (currentLine) lines.push(currentLine.trim());
            currentLine = word;
        } else {
            currentLine = (currentLine + " " + word).trim();
        }
    });

    if (currentLine) lines.push(currentLine.trim());
    return lines;
}

// Height per bar row, sized to the label with the most wrapped lines so tall
// multi-line labels never overlap their neighbours.
function rowHeightFor(labels) {
    const maxLines = labels.reduce((m, l) => Math.max(m, wrapLabel(l).length), 1);
    return Math.max(55, maxLines * 15 + 24);
}

function createQuestionCard(question, dataset, options = {}) {
const {
sourceLabel = "2026 TPC Survey",
allowToggle = true,
isComparison = false,
includeHeader = true,
chartType = "bar",
valueMode = "percent"
} = options;

const isPie = chartType === "pie";

// PhilPapers data is percentages only (no raw counts), so it always shows %.
// Otherwise honour the %/Count toggle for the data label on each bar/slice.
function dataLabelText(value, context) {
    if (valueMode === "count" && !isPercentDataset) {
        return values[context.dataIndex];
    }
    return value + "%";
}

// Map full answer labels to their short display form (for the y-axis only).
const toDisplay = ls => ls.map(l => displayLabel(question, l));

// Array = raw respondents (tally them); object = pre-computed percentages (PhilPapers).
const counts = {};

if (Array.isArray(dataset)) {
const isMultiSelect = multiSelectQuestions.includes(question);
const canonicalize = (question === FAVORITE_PHILOSOPHER_Q)
    ? buildPhilosopherCanon(dataset, question)
    : null;

dataset.forEach(person => {
    let answer = person[question];

    if (answer == null || answer == undefined || answer == "") {
        counts["No Response"] = (counts["No Response"] || 0) + 1;
        return;
    }

    answer = String(answer);

    if (isMultiSelect) {
        const parts = answer.split(",").map(p => p.trim()).filter(p => p.length > 0);
        parts.forEach(part => {
            counts[part] = (counts[part] || 0) + 1;
        });
    } else {
        const label = canonicalize ? canonicalize(answer) : answer;
        counts[label] = (counts[label] || 0) + 1;
    }
});
} else {
Object.entries(dataset || {}).forEach(([label, value]) => {
    counts[label] = Number(value);
});
}

const { entries, hiddenAnswers, fullEntries } = buildChartEntries(counts);
let labels = entries.map(e => e[0]);
let values = entries.map(e => e[1]);
const isPercentDataset = !Array.isArray(dataset);
let total = values.reduce((a, b) => a + b, 0);
let percentages;

if (isPercentDataset) {
    percentages = values.map(v => Number(v).toFixed(1));
} else {
    percentages = values.map(v => ((v / total) * 100).toFixed(1));
}


const card = document.createElement("div");

if (isComparison) {
    card.className = "comparison-chart-panel h-100";
} else {
    card.className = "card mb-4 h-100";
}

let headerMarkup;

if (includeHeader) {
    headerMarkup = `
    <small class="d-block text-muted mb-2">${sourceLabel}</small>
    <h5 class="card-title">${question}</h5>
    `;
} else {
    headerMarkup = `
    <small class="d-block text-muted mb-2">${sourceLabel}</small>
    `;
}

card.innerHTML = `
<div class="card-body">
    ${headerMarkup}
    <div style="height:${isPie ? 360 : Math.max(labels.length * rowHeightFor(toDisplay(labels)), 220)}px">
        <canvas></canvas>
    </div>
    ${allowToggle ? '<small class="toggle-text text-muted" style="cursor:pointer; text-decoration:underline;">Click "Other" (or this text) to view all options</small>' : ''}
</div>
`;

const ctx = card.querySelector("canvas");
const heightDiv = card.querySelector(".card-body > div");
const toggleText = card.querySelector(".toggle-text");

const colors = [
"#4E79A7",
"#59A14F",
"#F28E2B",
"#E15759",
"#76B7B2",
"#EDC948",
"#B07AA1",
"#FF9DA7",
"#9C755F",
"#BAB0AC"
];

// Shared between bar and pie: hover shows full label + response count/percent.
const tooltipCallbacks = {
    // Show the full (un-shortened) answer text on hover.
    title: function(items) {
        return items.length ? labels[items[0].dataIndex] : "";
    },
    label: function(context) {
        if (isPercentDataset) {
            return `${Number(values[context.dataIndex]).toFixed(1)}%`;
        }
        return `${values[context.dataIndex]} responses (${percentages[context.dataIndex]}%)`;
    }
};

let chartConfig;

if (isPie) {
    chartConfig = {
        type: "pie",
        data: {
            labels: toDisplay(labels),
            datasets: [{
                data: percentages,
                backgroundColor: labels.map((_, i) => colors[i % colors.length]),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: "bottom",
                    labels: { boxWidth: 12, padding: 10 }
                },
                datalabels: {
                    color: "#ffffff",
                    font: { weight: "bold" },
                    // Only label slices big enough to fit the text.
                    display: function(context) {
                        return Number(context.dataset.data[context.dataIndex]) >= 5;
                    },
                    formatter: dataLabelText
                },
                tooltip: { callbacks: tooltipCallbacks }
            }
        }
    };
} else {
    chartConfig = {
        type: "bar",
        data: {
            labels: toDisplay(labels),
            datasets: [{
                data: percentages,
                backgroundColor: labels.map((_, i) => colors[i % colors.length]),
                borderRadius: 8,
                categoryPercentage: 0.7,
                barPercentage: 0.9
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: "#ffffff",
                    font: { weight: "bold" },
                    formatter: dataLabelText
                },
                tooltip: { callbacks: tooltipCallbacks }
            },
            scales: {
                x: {
                    display: false,
                    max: 100
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        autoSkip: false,
                        // Word-wrap long answer labels (row height adapts to fit them).
                        callback: function(value) {
                            return wrapLabel(this.getLabelForValue(value));
                        }
                    },
                    // Reserve a minimum width so wrapped labels aren't cramped.
                    afterFit: function(scale) {
                        scale.width = Math.max(scale.width, 150);
                    }
                }
            }
        }
    };
}

const chart = new Chart(ctx, chartConfig);

// Expand/collapse the "Other" bucket. Only charts with hidden answers can expand.
if (allowToggle && (!isComparison || sourceLabel == "2026 TPC Survey")) {
let isExpanded = false;

// Nothing was bucketed into "Other" -> the hint is misleading, so hide it.
if (toggleText && hiddenAnswers.length === 0) {
    toggleText.style.display = "none";
}

// Re-render the chart for the current expanded/collapsed state.
function renderExpanded() {
    const nextEntries = isExpanded
        ? fullEntries
        : [
            ...fullEntries.slice(0, 3),
            ["Other", hiddenAnswers.reduce((sum, item) => sum + item[1], 0)]
        ];

    labels = nextEntries.map(e => e[0]);
    values = nextEntries.map(e => e[1]);
    percentages = values.map(v => ((v / values.reduce((a, b) => a + b, 0)) * 100).toFixed(1));

    chart.data.labels = toDisplay(labels);
    chart.data.datasets[0].data = percentages;
    chart.data.datasets[0].backgroundColor = labels.map((_, i) => colors[i % colors.length]);

    const newHeight = isPie ? 360 : Math.max(labels.length * rowHeightFor(toDisplay(labels)), 220);
    heightDiv.style.height = `${newHeight}px`;

    requestAnimationFrame(() => {
        chart.resize(heightDiv.clientWidth, newHeight);
        chart.update();
    });

    toggleText.textContent = isExpanded
        ? 'Click to collapse'
        : 'Click "Other" (or this text) to view all options';
}

// Wire the hint text so clicking it toggles (it looks like a link).
if (toggleText && hiddenAnswers.length > 0) {
    toggleText.onclick = function() {
        isExpanded = !isExpanded;
        renderExpanded();
    };
}

// Also toggle when the "Other" bar itself is clicked (or any bar to collapse).
ctx.onclick = function(event) {
    const points = chart.getElementsAtEventForMode(
        event, "nearest", { intersect: true }, true
    );

    if (!points.length) return;

    const clickedOther = labels[points[0].index] == "Other";
    if (!clickedOther && !isExpanded) return;
    if (hiddenAnswers.length === 0) return;

    isExpanded = !isExpanded;
    renderExpanded();
};
}

return card;
}

function generateCharts(data, questionGroups, philpapersData, compareEnabled = false, chartType = "bar", valueMode = "percent") {
const dashboard = document.getElementById("dashboard");
dashboard.innerHTML = "";

const questions = questionGroups[pageGroup] || [];

const respondentCount = document.getElementById("respondentCount");
if (respondentCount) {
respondentCount.textContent = data.length;
}

const questionCount = document.getElementById("questionCount");
if (questionCount) {
questionCount.textContent = questions.length;
    }

// Compare mode: TPC (filtered) vs PhilPapers 2020 side by side; single panel if unmapped.
if (pageGroup == "philosophy" && compareEnabled && philpapersData) {
questions.forEach(question => {
    const comparisonCard = document.createElement("div");
    comparisonCard.className = "card mb-4";

    const comparisonBody = document.createElement("div");
    comparisonBody.className = "card-body";

    const questionTitle = document.createElement("h5");
    questionTitle.className = "card-title mb-3";
    questionTitle.textContent = question;
    comparisonBody.appendChild(questionTitle);

    const comparisonRow = document.createElement("div");
    comparisonRow.className = "row g-4";

    const leftCol = document.createElement("div");
    leftCol.className = "col-lg-6";
    leftCol.appendChild(createQuestionCard(question, data, {
        sourceLabel: "2026 TPC Survey",
        allowToggle: true,
        isComparison: true,
        includeHeader: false,
        chartType: chartType,
        valueMode: valueMode
    }));

    const philpapersCounts = getPhilpapersCountsForQuestion(question, philpapersData);

    if (philpapersCounts) {
        const rightCol = document.createElement("div");
        rightCol.className = "col-lg-6";
        rightCol.appendChild(createQuestionCard(question, philpapersCounts, {
            sourceLabel: "PhilPapers 2020",
            allowToggle: false,
            isComparison: true,
            includeHeader: false,
            chartType: chartType,
            valueMode: valueMode
        }));
        comparisonRow.appendChild(leftCol);
        comparisonRow.appendChild(rightCol);
    } else {
        leftCol.className = "col-12";
        comparisonRow.appendChild(leftCol);
    }
    comparisonBody.appendChild(comparisonRow);
    comparisonCard.appendChild(comparisonBody);
    dashboard.appendChild(comparisonCard);
});

return;
}

questions.forEach(question => {
dashboard.appendChild(createQuestionCard(question, data, {
    sourceLabel: "2026 TPC Survey",
    allowToggle: true,
    isComparison: false,
    chartType: chartType,
    valueMode: valueMode
}));
});
}

// Bar/Pie + %/Count switches inserted above the dashboard; re-render on change.
function buildChartTypeToggle(state, render) {
const dashboard = document.getElementById("dashboard");
if (!dashboard || document.getElementById("chartTypeControls")) return;

const wrap = document.createElement("div");
wrap.id = "chartTypeControls";
wrap.className = "d-flex align-items-center flex-wrap gap-3 mb-4";
wrap.innerHTML = `
    <span class="d-flex align-items-center gap-2">
        <span class="text-muted small">Chart type:</span>
        <span class="btn-group btn-group-sm" role="group" aria-label="Chart type">
            <input type="radio" class="btn-check" name="chartType" id="chartTypeBar" autocomplete="off" checked>
            <label class="btn btn-outline-secondary" for="chartTypeBar">Bar</label>
            <input type="radio" class="btn-check" name="chartType" id="chartTypePie" autocomplete="off">
            <label class="btn btn-outline-secondary" for="chartTypePie">Pie</label>
        </span>
    </span>
    <span class="d-flex align-items-center gap-2">
        <span class="text-muted small">Values:</span>
        <span class="btn-group btn-group-sm" role="group" aria-label="Value mode">
            <input type="radio" class="btn-check" name="valueMode" id="valuePercent" autocomplete="off" checked>
            <label class="btn btn-outline-secondary" for="valuePercent">%</label>
            <input type="radio" class="btn-check" name="valueMode" id="valueCount" autocomplete="off">
            <label class="btn btn-outline-secondary" for="valueCount">Count</label>
        </span>
    </span>`;

dashboard.parentNode.insertBefore(wrap, dashboard);

wrap.querySelectorAll('input[name="chartType"]').forEach(input => {
    input.addEventListener("change", () => {
        state.chartType = document.getElementById("chartTypePie").checked ? "pie" : "bar";
        render();
    });
});

wrap.querySelectorAll('input[name="valueMode"]').forEach(input => {
    input.addEventListener("change", () => {
        state.valueMode = document.getElementById("valueCount").checked ? "count" : "percent";
        render();
    });
});
}

loadResponses();
