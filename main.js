// App entry point: registers each screen with the router and boots it.
Router.register("intro", {
  onEnter: () => console.log("[intro] entered"),
  onExit: () => console.log("[intro] exited"),
});

Router.register("map", {
  onEnter: () => console.log("[map] entered"),
  onExit: () => console.log("[map] exited"),
});

Router.register("case", {
  onEnter: () => console.log("[case] entered"),
  onExit: () => console.log("[case] exited"),
});

Router.register("simulator", {
  onEnter: () => console.log("[simulator] entered"),
  onExit: () => console.log("[simulator] exited"),
});

Router.register("boss", {
  onEnter: () => console.log("[boss] entered"),
  onExit: () => console.log("[boss] exited"),
});

Router.setDefault("intro");
Router.init();

// 캐릭터 생성 UI (intro 화면)
(() => {
  const genderLabels = { male: "남", female: "여", other: "기타" };

  const form = document.getElementById("character-form");
  const nameInput = document.getElementById("character-name");
  const genderButtons = document.querySelectorAll(".gender-btn");
  const resultEl = document.getElementById("character-result");

  let selectedGender = null;

  genderButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      genderButtons.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedGender = btn.dataset.gender;
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = nameInput.value.trim();

    if (!name) {
      resultEl.textContent = "이름을 입력해주세요.";
      resultEl.hidden = false;
      return;
    }

    if (!selectedGender) {
      resultEl.textContent = "성별을 선택해주세요.";
      resultEl.hidden = false;
      return;
    }

    resultEl.textContent = `캐릭터 생성 완료: ${name} (${genderLabels[selectedGender]})`;
    resultEl.hidden = false;
  });
})();
