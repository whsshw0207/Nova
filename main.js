// App entry point: registers each screen with the router and boots it.

// 컷씬 화면 로직 (cutscene)
const CutsceneScreen = (() => {
  const lines = [
    "이곳은 대체 어디지...",
    "정신을 차려보니 낯선 공간에 서 있었다.",
    "저 앞에 무언가 움직이는 것 같다.",
  ];

  const stage = document.getElementById("cutscene-stage");
  const lineEl = document.getElementById("cutscene-line");

  let index = 0;

  function render() {
    lineEl.textContent = lines[index];
  }

  function advance() {
    if (index >= lines.length - 1) {
      console.log("컷씬 종료");
      return;
    }
    index += 1;
    render();
  }

  stage.addEventListener("click", advance);

  return {
    onEnter: () => {
      console.log("[cutscene] entered");
      index = 0;
      render();
    },
    onExit: () => console.log("[cutscene] exited"),
  };
})();

// 브리핑 화면 로직 (case)
const BriefingScreen = (() => {
  const lines = [
    "브리핑을 시작하겠다.",
    "이번 사건은 실종자 관련 건이다.",
    "목격자 진술에 따르면 마지막 위치는 항구 근처였다.",
    "단서를 수집하고 현장을 조사하도록.",
    "질문 있나?",
  ];

  const lineEl = document.getElementById("briefing-line");
  const nextBtn = document.getElementById("briefing-next");

  let index = 0;

  function render() {
    lineEl.textContent = lines[index];
  }

  function advance() {
    if (index >= lines.length - 1) {
      console.log("브리핑 종료");
      return;
    }
    index += 1;
    render();
  }

  nextBtn.addEventListener("click", advance);

  return {
    onEnter: () => {
      console.log("[case] entered");
      index = 0;
      render();
    },
    onExit: () => console.log("[case] exited"),
  };
})();

Router.register("intro", {
  onEnter: () => console.log("[intro] entered"),
  onExit: () => console.log("[intro] exited"),
});

Router.register("map", {
  onEnter: () => console.log("[map] entered"),
  onExit: () => console.log("[map] exited"),
});

Router.register("case", BriefingScreen);

Router.register("simulator", {
  onEnter: () => console.log("[simulator] entered"),
  onExit: () => console.log("[simulator] exited"),
});

Router.register("boss", {
  onEnter: () => console.log("[boss] entered"),
  onExit: () => console.log("[boss] exited"),
});

Router.register("cutscene", CutsceneScreen);

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

// 케이스 카드 (map 화면)
document.querySelectorAll(".case-card").forEach((card) => {
  card.addEventListener("click", () => {
    console.log(`${card.textContent.trim()} 진입`);
    Router.navigate("case");
  });
});
