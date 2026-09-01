// App entry point: registers each screen with the router and boots it.

// 대화 선택지에서 사용하는 호감도 전역 변수
let affinity = 0;

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

// 사건 화면 진행 제어 (브리핑 대사 + 문제 4종을 한 화면에 순서대로 표시)
const CaseScreen = (() => {
  const dialogueLines = [
    "브리핑을 시작하겠다.",
    "이번 사건은 실종자 관련 건이다.",
    "목격자 진술에 따르면 마지막 위치는 항구 근처였다.",
    "단서를 수집하고 현장을 조사하도록.",
    "질문 있나?",
  ];

  const quizOrder = ["order", "blank", "typing", "prediction"];

  const TIMER_SECONDS = 20;
  const MAX_TIMEOUTS = 5;
  const TIMEOUT_ADVANCE_DELAY = 1200;

  const CORRECT_REACTIONS = ["역시! 정확해.", "좋은 판단이야.", "완벽하게 맞혔어."];
  const WRONG_REACTIONS = ["음... 다시 생각해보자.", "아쉽네, 틀렸어.", "다른 답이 필요할 것 같은데."];
  const TIMEOUT_REACTIONS = ["시간 초과! 너무 늦었어.", "이런, 시간이 다 됐어.", "다음엔 더 서둘러보자."];

  const dialogueBubble = document.getElementById("briefing-line");
  const bubbles = {
    order: document.getElementById("order-question"),
    blank: document.getElementById("blank-question"),
    typing: document.getElementById("typing-question"),
    prediction: document.getElementById("prediction-question"),
  };

  const phases = {
    order: document.getElementById("phase-order"),
    blank: document.getElementById("phase-blank"),
    typing: document.getElementById("phase-typing"),
    prediction: document.getElementById("phase-prediction"),
  };

  const explanationEl = document.getElementById("case-explanation");
  const explanationAnswerEl = document.getElementById("case-explanation-answer");
  const explanationDescEl = document.getElementById("case-explanation-desc");
  const nextBtn = document.getElementById("case-next-btn");

  const characterEl = document.getElementById("case-character");
  const reactionTextEl = document.getElementById("case-reaction-text");
  const timerEl = document.getElementById("case-timer");
  const timerValueEl = document.getElementById("case-timer-value");

  const choicePhaseEl = document.getElementById("phase-choice");
  const choiceButtons = Array.from(document.querySelectorAll(".choice-option"));
  const CHOICE_LINE = "수고했어요. 오늘 어땠어요?";

  let dialogueIndex = 0;
  let mode = "dialogue"; // "dialogue" | "quiz" | "retry-dialogue" | "choice"
  let roundQueue = [];
  let quizIndex = -1;
  let wrongSet = [];
  let timeoutCount = 0;
  let timerId = null;
  let timeLeft = TIMER_SECONDS;
  let awaitingNext = false;

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function shuffle(list) {
    const result = list.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function hideAllBubbles() {
    dialogueBubble.hidden = true;
    Object.values(bubbles).forEach((el) => {
      el.hidden = true;
    });
  }

  function hideAllPhases() {
    Object.values(phases).forEach((el) => {
      el.hidden = true;
    });
    choicePhaseEl.hidden = true;
  }

  function resetCharacterState() {
    characterEl.classList.remove("correct", "incorrect");
    reactionTextEl.hidden = true;
    reactionTextEl.textContent = "";
  }

  function showReaction(state, text) {
    characterEl.classList.remove("correct", "incorrect");
    characterEl.classList.add(state);
    reactionTextEl.textContent = text;
    reactionTextEl.hidden = false;
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function hideTimer() {
    stopTimer();
    timerEl.hidden = true;
    timerEl.classList.remove("warning");
  }

  function startTimer(quizName) {
    stopTimer();
    timeLeft = TIMER_SECONDS;
    timerEl.hidden = false;
    timerEl.classList.remove("warning");
    timerValueEl.textContent = String(timeLeft);

    timerId = setInterval(() => {
      timeLeft -= 1;
      timerValueEl.textContent = String(Math.max(timeLeft, 0));
      if (timeLeft <= 5) {
        timerEl.classList.add("warning");
      }
      if (timeLeft <= 0) {
        stopTimer();
        handleTimeout(quizName);
      }
    }, 1000);
  }

  function showDialogueLine() {
    hideTimer();
    hideAllBubbles();
    hideAllPhases();
    resetCharacterState();
    dialogueBubble.hidden = false;
    dialogueBubble.textContent = dialogueLines[dialogueIndex];
    explanationEl.hidden = true;
    nextBtn.hidden = false;
  }

  function showRetryDialogue() {
    hideTimer();
    hideAllBubbles();
    hideAllPhases();
    resetCharacterState();
    dialogueBubble.hidden = false;
    dialogueBubble.textContent = "오답으로 처리된 문제를 다시 풀어보자.";
    explanationEl.hidden = true;
    nextBtn.hidden = false;
  }

  function showChoicePhase() {
    hideTimer();
    hideAllBubbles();
    hideAllPhases();
    resetCharacterState();
    dialogueBubble.hidden = false;
    dialogueBubble.textContent = CHOICE_LINE;
    choicePhaseEl.hidden = false;
    explanationEl.hidden = true;
    nextBtn.hidden = true;
  }

  const interactionResetters = {
    order: () => OrderInteraction.reset(),
    blank: () => FillBlankInteraction.reset(),
    typing: () => TypingInteraction.reset(),
    prediction: () => PredictionInteraction.reset(),
  };

  function showQuizPhase(name) {
    hideAllBubbles();
    hideAllPhases();
    resetCharacterState();
    interactionResetters[name]();
    bubbles[name].hidden = false;
    phases[name].hidden = false;
    explanationEl.hidden = true;
    nextBtn.hidden = true;
    awaitingNext = false;
    startTimer(name);
  }

  function showExplanation(answerText, descText, isCorrect = true) {
    explanationAnswerEl.textContent = answerText || "";
    explanationAnswerEl.hidden = !answerText;
    explanationAnswerEl.classList.toggle("incorrect", isCorrect === false);
    explanationDescEl.textContent = descText || "";
    explanationEl.hidden = false;
    nextBtn.hidden = false;
  }

  function currentQuizName() {
    return roundQueue[quizIndex] || null;
  }

  function submitAnswer(quizName, isCorrect, answerText, descText) {
    if (mode !== "quiz" || awaitingNext) return;
    if (quizName !== currentQuizName()) return;

    awaitingNext = true;
    hideTimer();

    if (!isCorrect && wrongSet.indexOf(quizName) === -1) {
      wrongSet.push(quizName);
    }

    showReaction(isCorrect ? "correct" : "incorrect", pickRandom(isCorrect ? CORRECT_REACTIONS : WRONG_REACTIONS));
    showExplanation(answerText, descText, isCorrect);
  }

  function handleTimeout(quizName) {
    if (mode !== "quiz" || awaitingNext) return;
    if (quizName !== currentQuizName()) return;

    awaitingNext = true;

    if (wrongSet.indexOf(quizName) === -1) {
      wrongSet.push(quizName);
    }
    timeoutCount += 1;

    showReaction("incorrect", pickRandom(TIMEOUT_REACTIONS));
    // 타임아웃은 설명 없이 리액션만 보여주고 자동으로 다음 문제로 넘어간다.
    explanationEl.hidden = true;
    nextBtn.hidden = true;

    if (timeoutCount >= MAX_TIMEOUTS) {
      setTimeout(() => Router.navigate("gameover"), TIMEOUT_ADVANCE_DELAY);
      return;
    }

    setTimeout(() => {
      awaitingNext = false;
      moveToNextQuizOrRound();
    }, TIMEOUT_ADVANCE_DELAY);
  }

  function moveToNextQuizOrRound() {
    quizIndex += 1;

    if (quizIndex < roundQueue.length) {
      showQuizPhase(roundQueue[quizIndex]);
      return;
    }

    if (wrongSet.length > 0) {
      roundQueue = shuffle(wrongSet);
      wrongSet = [];
      quizIndex = -1;
      mode = "retry-dialogue";
      showRetryDialogue();
    } else {
      mode = "choice";
      showChoicePhase();
    }
  }

  function advance() {
    if (mode === "dialogue") {
      if (dialogueIndex >= dialogueLines.length - 1) {
        console.log("브리핑 종료");
        mode = "quiz";
        roundQueue = [...quizOrder];
        quizIndex = 0;
        showQuizPhase(roundQueue[quizIndex]);
      } else {
        dialogueIndex += 1;
        showDialogueLine();
      }
      return;
    }

    if (mode === "retry-dialogue") {
      mode = "quiz";
      quizIndex = 0;
      showQuizPhase(roundQueue[quizIndex]);
      return;
    }

    if (mode === "quiz") {
      if (!awaitingNext) return;
      moveToNextQuizOrRound();
    }
  }

  nextBtn.addEventListener("click", advance);

  choiceButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (mode !== "choice") return;
      affinity += Number(btn.dataset.affinity);
      console.log("affinity:", affinity);
      Router.navigate("cutscene");
    });
  });

  return {
    submitAnswer,
    onEnter: () => {
      console.log("[case] entered");
      dialogueIndex = 0;
      mode = "dialogue";
      roundQueue = [];
      quizIndex = -1;
      wrongSet = [];
      timeoutCount = 0;
      awaitingNext = false;
      affinity = 0;
      hideTimer();
      resetCharacterState();
      showDialogueLine();
    },
    onExit: () => {
      hideTimer();
      console.log("[case] exited");
    },
  };
})();

// 카드 순서 배치 인터랙션 (case 화면, 문제 1)
const OrderInteraction = (() => {
  const EXPLANATION = "정확한 순서로 배치해야 사건의 흐름을 올바르게 파악할 수 있다.";

  const list = document.getElementById("order-card-list");
  const cards = Array.from(list.querySelectorAll(".order-card"));
  const confirmBtn = document.getElementById("order-confirm-btn");
  const correctOrder = cards.map((card) => card.dataset.value);

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

  function reset() {
    const shuffled = cards.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    shuffled.forEach((card) => list.appendChild(card));
  }

  function currentOrder() {
    return Array.from(list.querySelectorAll(".order-card")).map((card) => card.dataset.value);
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

  confirmBtn.addEventListener("click", () => {
    const order = currentOrder();
    const isCorrect = order.join(",") === correctOrder.join(",");

    console.log(isCorrect ? "정답" : "오답", "카드 순서:", order);
    CaseScreen.submitAnswer(
      "order",
      isCorrect,
      isCorrect ? "정답입니다!" : `오답입니다. (정답 순서: ${correctOrder.join(", ")})`,
      EXPLANATION
    );
  });

  return { reset };
})();

// 빈칸 채우기 인터랙션 (case 화면, 문제 2)
const FillBlankInteraction = (() => {
  const EXPLANATION = "인공지능은 대량의 데이터를 통해 패턴을 학습한다.";

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
    CaseScreen.submitAnswer(
      "blank",
      isCorrect,
      isCorrect ? `정답: ${value}` : `오답: ${value} (정답: ${answer})`,
      EXPLANATION
    );
  });

  return { reset };
})();

// 타이핑 입력 인터랙션 (case 화면, 문제 3)
const TypingInteraction = (() => {
  const ANSWER = "모델";
  const EXPLANATION = "학습을 마친 알고리즘의 결과물을 모델이라고 부른다.";

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
    CaseScreen.submitAnswer(
      "typing",
      isCorrect,
      isCorrect ? `정답: ${value}` : `오답: ${value} (정답: ${ANSWER})`,
      EXPLANATION
    );
  });

  hintBtn.addEventListener("click", () => {
    hintList.hidden = !hintList.hidden;
  });

  return { reset };
})();

// 가설 예측 인터랙션 (case 화면, 문제 4)
const PredictionInteraction = (() => {
  const ANSWER = "70% 이상";
  const EXPLANATION = "충분한 양의 학습 데이터와 검증 과정을 거친 모델은 일반적으로 70% 이상의 정확도를 보인다.";

  const options = Array.from(document.querySelectorAll(".prediction-option"));

  function reset() {
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

      console.log(`선택: ${value} / 정답: ${ANSWER}`);
      CaseScreen.submitAnswer("prediction", isCorrect, `정답: ${ANSWER}`, EXPLANATION);
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

Router.register("case", CaseScreen);

Router.register("gameover", {
  onEnter: () => console.log("[gameover] entered"),
  onExit: () => console.log("[gameover] exited"),
});

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

// game over 화면 버튼
document.getElementById("gameover-restart-btn").addEventListener("click", () => {
  Router.navigate("case");
});

document.getElementById("gameover-map-btn").addEventListener("click", () => {
  Router.navigate("map");
});
