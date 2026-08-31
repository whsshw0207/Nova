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
  const interactionEl = document.getElementById("case-interaction");
  const fillBlankEl = document.getElementById("fill-blank-interaction");
  const typingEl = document.getElementById("typing-interaction");
  const predictionEl = document.getElementById("prediction-interaction");

  let index = 0;

  function render() {
    lineEl.textContent = lines[index];
  }

  function advance() {
    if (index >= lines.length - 1) {
      console.log("브리핑 종료");
      nextBtn.hidden = true;
      interactionEl.hidden = false;
      fillBlankEl.hidden = false;
      typingEl.hidden = false;
      predictionEl.hidden = false;
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
      nextBtn.hidden = false;
      interactionEl.hidden = true;
      fillBlankEl.hidden = true;
      typingEl.hidden = true;
      predictionEl.hidden = true;
      FillBlankInteraction.reset();
      TypingInteraction.reset();
      PredictionInteraction.reset();
      render();
    },
    onExit: () => console.log("[case] exited"),
  };
})();

// 카드 순서 배치 인터랙션 (case 화면, 브리핑 종료 후)
const CardOrderInteraction = (() => {
  const list = document.getElementById("order-card-list");
  const cards = Array.from(list.querySelectorAll(".order-card"));

  let draggingCard = null;

  function getDragAfterElement(y) {
    const candidates = cards.filter((card) => card !== draggingCard);

    return candidates.reduce(
      (closest, card) => {
        const box = card.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: card };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }

  function logOrder() {
    const order = Array.from(list.querySelectorAll(".order-card")).map(
      (card) => card.dataset.value
    );
    console.log("카드 순서:", order);
  }

  cards.forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      draggingCard = card;
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.value);
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      draggingCard = null;
      logOrder();
    });
  });

  list.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!draggingCard) return;

    const afterElement = getDragAfterElement(event.clientY);
    if (afterElement == null) {
      list.appendChild(draggingCard);
    } else {
      list.insertBefore(draggingCard, afterElement);
    }
  });

  list.addEventListener("drop", (event) => {
    event.preventDefault();
  });
})();

// 빈칸 채우기 인터랙션 (case 화면, 브리핑 종료 후)
const FillBlankInteraction = (() => {
  const wordCards = Array.from(document.querySelectorAll(".word-card"));
  const blankZone = document.getElementById("blank-drop-zone");
  const answer = blankZone.dataset.answer;

  function reset() {
    blankZone.textContent = "";
    blankZone.classList.remove("correct", "incorrect");
  }

  wordCards.forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.value);
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
    });
  });

  blankZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    blankZone.classList.add("drag-over");
  });

  blankZone.addEventListener("dragleave", () => {
    blankZone.classList.remove("drag-over");
  });

  blankZone.addEventListener("drop", (event) => {
    event.preventDefault();
    blankZone.classList.remove("drag-over");

    const value = event.dataTransfer.getData("text/plain");
    blankZone.textContent = value;

    const isCorrect = value === answer;
    blankZone.classList.toggle("correct", isCorrect);
    blankZone.classList.toggle("incorrect", !isCorrect);

    console.log(isCorrect ? `정답: ${value}` : `오답: ${value} (정답: ${answer})`);
  });

  return { reset };
})();

// 타이핑 입력 인터랙션 (case 화면, 브리핑 종료 후)
const TypingInteraction = (() => {
  const ANSWER = "모델";

  const form = document.getElementById("typing-form");
  const input = document.getElementById("typing-answer-input");
  const hintBtn = document.getElementById("typing-hint-btn");
  const hintList = document.getElementById("typing-hint-list");

  function reset() {
    input.value = "";
    input.classList.remove("correct", "incorrect");
    hintList.hidden = true;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const value = input.value.trim();
    const isCorrect = value === ANSWER;
    input.classList.toggle("correct", isCorrect);
    input.classList.toggle("incorrect", !isCorrect);

    console.log(isCorrect ? `정답: ${value}` : `오답: ${value} (정답: ${ANSWER})`);
  });

  hintBtn.addEventListener("click", () => {
    hintList.hidden = !hintList.hidden;
  });

  return { reset };
})();

// 가설 예측 인터랙션 (case 화면, 브리핑 종료 후)
const PredictionInteraction = (() => {
  const ANSWER = "70% 이상";
  const EXPLANATION = "충분한 양의 학습 데이터와 검증 과정을 거친 모델은 일반적으로 70% 이상의 정확도를 보인다.";

  const options = Array.from(document.querySelectorAll(".prediction-option"));
  const resultEl = document.getElementById("prediction-result");
  const resultAnswerEl = document.getElementById("prediction-result-answer");
  const resultDescEl = document.getElementById("prediction-result-desc");

  function reset() {
    resultEl.hidden = true;
    resultAnswerEl.textContent = "";
    resultDescEl.textContent = "";
    options.forEach((btn) => {
      btn.disabled = false;
      btn.classList.remove("correct", "incorrect");
    });
  }

  options.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.value;
      const isCorrect = value === ANSWER;

      options.forEach((b) => {
        b.disabled = true;
        if (b.dataset.value === ANSWER) {
          b.classList.add("correct");
        } else if (b === btn) {
          b.classList.add("incorrect");
        }
      });

      resultAnswerEl.textContent = `정답: ${ANSWER}`;
      resultDescEl.textContent = EXPLANATION;
      resultEl.hidden = false;

      console.log(`선택: ${value} / 정답: ${ANSWER}`);
    });
  });

  return { reset };
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
