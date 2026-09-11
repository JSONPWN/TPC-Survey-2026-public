const themes = ["light", "dark", "pink"];

let currentTheme = localStorage.getItem("theme") || "light";

applyTheme(currentTheme);

const themeButton = document.getElementById("themeToggle");

if (themeButton) {
    
    updateThemeButton();

    themeButton.addEventListener("click", () => {
        const currentIndex = themes.indexOf(currentTheme);
        currentTheme = themes[(currentIndex + 1) % themes.length];
        applyTheme(currentTheme);
        localStorage.setItem("theme", currentTheme);
        updateThemeButton();
    });
}

function applyTheme(theme) {
    document.body.classList.remove("theme-dark", "theme-pink");
    if (theme === "dark") document.body.classList.add("theme-dark");
    if (theme === "pink") document.body.classList.add("theme-pink");
}

function updateThemeButton() {
    if (currentTheme === "light") themeButton.textContent = "🌞";
    if (currentTheme === "dark") themeButton.textContent = "🌙";
    if (currentTheme === "pink") themeButton.textContent = "🌸";
}

