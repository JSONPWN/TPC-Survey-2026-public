async function loadFreeResponses() {
    try {
        const [responseResult, questionResult] = await Promise.all([
            fetch("./data/responses.json"),
            fetch("./data/questions.json")
        ]);

        const data = await responseResult.json();
        const questionGroups = await questionResult.json();
        const questions = questionGroups[pageGroup] || [];

        document.getElementById("respondentCount").textContent = data.length;
        document.getElementById("questionCount").textContent = questions.length;

        const select = document.getElementById("questionSelect");
        questions.forEach((question, i) => {
            const option = document.createElement("option");
            option.value = i;
            option.textContent = question.split("\n")[0]; // first line only, in case of long multi-line questions
            select.appendChild(option);
        });

        function renderQuestion(index) {
            const question = questions[index];
            const dashboard = document.getElementById("dashboard");
            dashboard.innerHTML = "";

            const answers = data
                .map(person => person[question])
                .filter(answer => answer !== null && answer !== undefined && String(answer).trim() !== "");

            if (answers.length === 0) {
                dashboard.innerHTML = `<p class="text-muted">No responses yet.</p>`;
                return;
            }

            const list = document.createElement("div");
            list.className = "list-group";

            answers.forEach(answer => {
                const item = document.createElement("div");
                item.className = "response-item mb-2";
                item.style.whiteSpace = "pre-wrap";
                item.textContent = answer;
                list.appendChild(item);
            });

            dashboard.appendChild(list);
        }

        select.addEventListener("change", () => renderQuestion(select.value));

        if (questions.length > 0) {
            renderQuestion(0);
        }

    } catch (err) {
        document.getElementById("dashboard").innerHTML =
            `<div class="alert alert-danger">${err.message}</div>`;
    }
}

loadFreeResponses();