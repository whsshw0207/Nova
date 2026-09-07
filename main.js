// App entry point: registers each screen with the router and boots it.

// 대화 선택지에서 사용하는 호감도 전역 변수
let affinity = 0;

// 획득한 개념 카드를 저장하는 전역 배열
let deckCards = [];

// intro 화면에서 입력한 플레이어 이름
let playerName = "";

// case 화면에서 어떤 Day의 퀴즈를 불러올지 결정하는 전역 변수
let currentDay = 1;

// 응답 앞뒤에 마크다운 코드펜스(```json ... ```)가 섞여 오는 퀴즈 파일이 있어 제거 후 파싱한다
function parseQuizJson(text) {
  const stripped = text.trim().replace(/^```json/i, "").replace(/```$/i, "").trim();
  return JSON.parse(stripped);
}

// quiz/nova{day}.json을 fetch로 불러와 퀴즈 배열로 반환
async function loadQuizData(day) {
  const res = await fetch(`quiz/nova${day}.json`);
  const text = await res.text();
  return parseQuizJson(text);
}

// 하단 플레이어 대화창에 쓰이는 더미 대사
const PLAYER_DUMMY_LINE = "음... 알겠어.";

// 하단 플레이어 대화창에 이름과 대사를 표시 (text 생략 시 더미 대사 사용)
function showPlayerLine(barEl, text = PLAYER_DUMMY_LINE) {
  barEl.hidden = false;
  barEl.querySelector(".player-dialogue-name").textContent = playerName || "플레이어";
  barEl.querySelector(".player-dialogue-text").textContent = text;
}

// { speaker: 'nova' | 'player', text } 한 줄을 상단 NOVA 영역 / 하단 플레이어 영역에 배타적으로 표시
function renderDialogueLine(line, novaTextEl, bottomBarEl) {
  if (line.speaker === "player") {
    novaTextEl.textContent = "";
    showPlayerLine(bottomBarEl, line.text);
  } else {
    novaTextEl.textContent = line.text;
    bottomBarEl.hidden = true;
  }
}

// 케이스 클리어 시 지급할 더미 카드 풀
const DUMMY_CARD_POOL = [
  { id: "card_1", name: "머신러닝 기초", desc: "데이터로 패턴을 학습한다" },
  { id: "card_2", name: "경사하강법", desc: "오차를 줄이는 최적화 방법" },
];

// 컷씬 화면 로직 (cutscene)
const CutsceneScreen = (() => {
  const dialogue = [
    { speaker: "nova", text: "이곳은 대체 어디지..." },
    { speaker: "player", text: "여기는... 처음 보는 곳인데." },
    { speaker: "nova", text: "정신을 차려보니 낯선 공간에 서 있었다." },
    { speaker: "nova", text: "저 앞에 무언가 움직이는 것 같다." },
  ];

  const stage = document.getElementById("cutscene-stage");
  const lineEl = document.getElementById("cutscene-line");
  const bottomBarEl = document.getElementById("cutscene-bottom-bar");

  let index = 0;

  function render() {
    renderDialogueLine(dialogue[index], lineEl, bottomBarEl);
  }

  function advance() {
    if (index >= dialogue.length - 1) {
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
    { speaker: "nova", text: "브리핑을 시작하겠다." },
    { speaker: "player", text: "네, 알겠습니다." },
    { speaker: "nova", text: "이번 사건은 실종자 관련 건이다." },
    { speaker: "nova", text: "목격자 진술에 따르면 마지막 위치는 항구 근처였다." },
    { speaker: "player", text: "항구 쪽을 확인해보겠습니다." },
    { speaker: "nova", text: "단서를 수집하고 현장을 조사하도록." },
    { speaker: "nova", text: "질문 있나?" },
  ];

  const quizOrder = ["order", "blank", "typing", "prediction"];

  // 화면 단계 이름 -> 퀴즈 JSON의 type 값
  const QUIZ_TYPE_BY_PHASE = {
    order: "card_order",
    blank: "blank_drag",
    typing: "typing",
    prediction: "hypothesis",
  };

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
  const bottomBarEl = document.getElementById("case-bottom-bar");

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

  // currentDay의 퀴즈 전체 목록과, 이번 판에서 단계별로 뽑힌 퀴즈
  let quizPool = [];
  let roundQuizzes = {};
  let quizDataPromise = null;

  function pickRoundQuizzes() {
    quizOrder.forEach((name) => {
      const type = QUIZ_TYPE_BY_PHASE[name];
      const candidates = quizPool.filter((quiz) => quiz.type === type);
      roundQuizzes[name] = pickRandom(candidates);
    });
  }

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
    explanationEl.hidden = true;
    nextBtn.hidden = false;
    renderDialogueLine(dialogueLines[dialogueIndex], dialogueBubble, bottomBarEl);
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

  const interactionLoaders = {
    order: (quiz) => OrderInteraction.load(quiz),
    blank: (quiz) => FillBlankInteraction.load(quiz),
    typing: (quiz) => TypingInteraction.load(quiz),
    prediction: (quiz) => PredictionInteraction.load(quiz),
  };

  function showQuizPhase(name) {
    hideAllBubbles();
    hideAllPhases();
    resetCharacterState();

    const quiz = roundQuizzes[name];
    if (name !== "blank") {
      bubbles[name].textContent = quiz.question;
    }
    interactionLoaders[name](quiz);

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
        Promise.resolve(quizDataPromise).then(() => {
          mode = "quiz";
          roundQueue = [...quizOrder];
          quizIndex = 0;
          pickRoundQuizzes();
          showQuizPhase(roundQueue[quizIndex]);
        });
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

      showPlayerLine(bottomBarEl);

      const nextCard = DUMMY_CARD_POOL[deckCards.length % DUMMY_CARD_POOL.length];
      deckCards.push({ ...nextCard });
      console.log("deckCards:", deckCards);

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

      quizDataPromise = loadQuizData(currentDay)
        .then((data) => {
          quizPool = data;
        })
        .catch((err) => {
          console.error(`퀴즈 데이터를 불러오지 못했습니다 (Day ${currentDay}):`, err);
        });

      showDialogueLine();
    },
    onExit: () => {
      hideTimer();
      console.log("[case] exited");
    },
  };
})();

// 카드 순서 배치 인터랙션 (case 화면, 문제 1: card_order)
const OrderInteraction = (() => {
  const list = document.getElementById("order-card-list");
  const confirmBtn = document.getElementById("order-confirm-btn");

  let currentQuiz = null;
  let draggingCard = null;

  function shuffledIndexes(count) {
    const result = Array.from({ length: count }, (_, i) => i);
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function attachCardEvents(card) {
    card.addEventListener("dragstart", () => {
      draggingCard = card;
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      draggingCard = null;
    });
  }

  function load(quiz) {
    currentQuiz = quiz;
    list.innerHTML = "";
    shuffledIndexes(quiz.items.length).forEach((itemIndex) => {
      const card = document.createElement("li");
      card.className = "order-card";
      card.draggable = true;
      card.dataset.index = String(itemIndex);
      card.textContent = quiz.items[itemIndex];
      attachCardEvents(card);
      list.appendChild(card);
    });
  }

  function getDragAfterElement(y) {
    const candidates = Array.from(list.querySelectorAll(".order-card")).filter((card) => card !== draggingCard);

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

  function currentOrder() {
    return Array.from(list.querySelectorAll(".order-card")).map((card) => Number(card.dataset.index));
  }

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
    if (!currentQuiz) return;

    const order = currentOrder();
    const isCorrect = order.join(",") === currentQuiz.correct_order.join(",");
    const correctText = currentQuiz.correct_order.map((i) => currentQuiz.items[i]).join(" ");

    console.log(isCorrect ? "정답" : "오답", "카드 순서:", order);
    CaseScreen.submitAnswer(
      "order",
      isCorrect,
      isCorrect ? "정답입니다!" : `오답입니다. (정답: ${correctText})`,
      isCorrect ? currentQuiz.nova_dialogue.correct : currentQuiz.nova_dialogue.wrong
    );
  });

  return { load };
})();

// 빈칸 채우기 인터랙션 (case 화면, 문제 2: blank_drag)
const FillBlankInteraction = (() => {
  const wordList = document.getElementById("word-card-list");
  const blankZone = document.getElementById("blank-drop-zone");
  const beforeEl = document.getElementById("blank-before");
  const afterEl = document.getElementById("blank-after");

  let currentQuiz = null;

  function shuffle(list) {
    const result = list.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function attachCardEvents(card) {
    card.addEventListener("dragstart", (event) => {
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.value);
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
    });
  }

  function load(quiz) {
    currentQuiz = quiz;
    const answer = quiz.blanks[0];
    const [before = "", after = ""] = quiz.question.split("___");

    beforeEl.textContent = before;
    afterEl.textContent = after;
    blankZone.textContent = "";
    blankZone.dataset.answer = answer;
    blankZone.classList.remove("correct", "incorrect", "drag-over");

    wordList.innerHTML = "";
    shuffle([answer, ...quiz.wrong_options]).forEach((value) => {
      const card = document.createElement("li");
      card.className = "word-card";
      card.draggable = true;
      card.dataset.value = value;
      card.textContent = value;
      attachCardEvents(card);
      wordList.appendChild(card);
    });
  }

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
    if (!currentQuiz) return;

    const value = event.dataTransfer.getData("text/plain");
    blankZone.textContent = value;

    const answer = currentQuiz.blanks[0];
    const isCorrect = value === answer;
    blankZone.classList.toggle("correct", isCorrect);
    blankZone.classList.toggle("incorrect", !isCorrect);

    console.log(isCorrect ? `정답: ${value}` : `오답: ${value} (정답: ${answer})`);
    CaseScreen.submitAnswer(
      "blank",
      isCorrect,
      isCorrect ? `정답: ${value}` : `오답: ${value} (정답: ${answer})`,
      isCorrect ? currentQuiz.nova_dialogue.correct : currentQuiz.nova_dialogue.wrong
    );
  });

  return { load };
})();

// 타이핑 입력 인터랙션 (case 화면, 문제 3: typing)
const TypingInteraction = (() => {
  const form = document.getElementById("typing-form");
  const input = document.getElementById("typing-answer-input");
  const hintBtn = document.getElementById("typing-hint-btn");
  const hintList = document.getElementById("typing-hint-list");

  let currentQuiz = null;

  function load(quiz) {
    currentQuiz = quiz;
    input.value = "";
    input.classList.remove("correct", "incorrect");

    hintList.innerHTML = "";
    quiz.hint.forEach((word) => {
      const item = document.createElement("li");
      item.className = "typing-hint-item";
      item.textContent = word;
      hintList.appendChild(item);
    });
    hintList.hidden = true;
    hintBtn.hidden = quiz.hint.length === 0;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!currentQuiz) return;

    const value = input.value.trim();
    const answer = currentQuiz.blanks[0];
    const isCorrect = value === answer;
    input.classList.toggle("correct", isCorrect);
    input.classList.toggle("incorrect", !isCorrect);

    console.log(isCorrect ? `정답: ${value}` : `오답: ${value} (정답: ${answer})`);
    CaseScreen.submitAnswer(
      "typing",
      isCorrect,
      isCorrect ? `정답: ${value}` : `오답: ${value} (정답: ${answer})`,
      isCorrect ? currentQuiz.nova_dialogue.correct : currentQuiz.nova_dialogue.wrong
    );
  });

  hintBtn.addEventListener("click", () => {
    hintList.hidden = !hintList.hidden;
  });

  return { load };
})();

// 가설 예측 인터랙션 (case 화면, 문제 4: hypothesis)
const PredictionInteraction = (() => {
  const container = document.getElementById("prediction-options");

  let currentQuiz = null;

  function load(quiz) {
    currentQuiz = quiz;
    container.innerHTML = "";
    quiz.options.forEach((label, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "prediction-option";
      btn.dataset.index = String(index);
      btn.textContent = label;
      container.appendChild(btn);
    });
  }

  container.addEventListener("click", (event) => {
    const btn = event.target.closest(".prediction-option");
    if (!btn || !currentQuiz || btn.disabled) return;

    const index = Number(btn.dataset.index);
    const isCorrect = index === currentQuiz.correct;
    const answerText = currentQuiz.options[currentQuiz.correct];

    Array.from(container.querySelectorAll(".prediction-option")).forEach((option) => {
      option.disabled = true;
      if (Number(option.dataset.index) === currentQuiz.correct) {
        option.classList.add("correct");
      } else if (option === btn) {
        option.classList.add("incorrect");
      }
    });

    console.log(`선택: ${btn.textContent} / 정답: ${answerText}`);
    CaseScreen.submitAnswer(
      "prediction",
      isCorrect,
      `정답: ${answerText}`,
      isCorrect ? currentQuiz.nova_dialogue.correct : currentQuiz.nova_dialogue.wrong
    );
  });

  return { load };
})();

// 보스 화면: 진입 시 글리치 연출 후 시뮬레이터 영역(슬라이더 + 드래그 노드) 노출
const BossScreen = (() => {
  const GLITCH_DURATION = 900;
  const NODE_SIZE = 32;

  const deckSelectionEl = document.getElementById("boss-deck-selection");
  const deckListEl = document.getElementById("boss-deck-list");
  const deckConfirmBtn = document.getElementById("boss-deck-confirm-btn");

  const glitchEl = document.getElementById("boss-glitch");
  const contentEl = document.getElementById("boss-content");
  const startBtn = document.getElementById("boss-start-btn");
  const simulatorEl = document.getElementById("boss-simulator");

  const slider = document.getElementById("boss-slider");
  const sliderValueEl = document.getElementById("boss-slider-value");

  const nodeArea = document.getElementById("boss-node-area");
  const node = document.getElementById("boss-node");

  const clearBtn = document.getElementById("boss-clear-btn");

  const ENDING_LINES_HIGH = [
    { speaker: "nova", text: "결과가 예상보다 좋군. 신뢰할 수 있겠어." },
    { speaker: "player", text: "감사합니다." },
    { speaker: "nova", text: "네 판단력은 이 사건 내내 흔들리지 않았다." },
    { speaker: "nova", text: "덕분에 사건의 핵심에 가까이 다가섰다." },
    { speaker: "player", text: "최선을 다했습니다." },
    { speaker: "nova", text: "이 정도면 다음 단계를 맡겨도 되겠어." },
    { speaker: "nova", text: "수고했다. 오늘은 여기까지 하지." },
  ];
  const ENDING_LINES_MID = [
    { speaker: "nova", text: "그럭저럭 넘어갔군." },
    { speaker: "player", text: "죄송합니다. 다음엔 더 잘하겠습니다." },
    { speaker: "nova", text: "수고했다. 오늘은 여기까지 하지." },
  ];
  const ENDING_LINES_LOW = [{ speaker: "nova", text: "...더 할 말은 없다. 오늘은 여기까지." }];

  let currentEndingLines = ENDING_LINES_MID;

  const endingEl = document.getElementById("boss-ending");
  const endingLineEl = document.getElementById("boss-ending-line");
  const endingNextBtn = document.getElementById("boss-ending-next-btn");

  const endingChoiceEl = document.getElementById("boss-ending-choice");
  const accuseBtn = document.getElementById("boss-accuse-btn");
  const silenceBtn = document.getElementById("boss-silence-btn");

  const endingResultEl = document.getElementById("boss-ending-result");
  const endingResultTextEl = document.getElementById("boss-ending-result-text");
  const ENDING_RESULT_TEXTS = {
    accuse: "당신은 진실을 선택했습니다. END A",
    silence: "당신은 침묵을 선택했습니다. END B",
  };

  const bottomBarEl = document.getElementById("boss-bottom-bar");

  let glitchTimeoutId = null;
  let dragging = false;
  let areaRect = null;
  let endingIndex = 0;

  function renderDeckSelection() {
    deckListEl.innerHTML = "";

    if (deckCards.length === 0) {
      const emptyEl = document.createElement("p");
      emptyEl.className = "boss-deck-empty";
      emptyEl.textContent = "보유 카드 없음";
      deckListEl.appendChild(emptyEl);
      return;
    }

    deckCards.forEach((card, index) => {
      const cardEl = document.createElement("label");
      cardEl.className = "boss-deck-card";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.className = "boss-deck-card-checkbox";
      checkbox.dataset.index = String(index);

      const infoEl = document.createElement("div");
      infoEl.className = "boss-deck-card-info";

      const nameEl = document.createElement("div");
      nameEl.className = "boss-deck-card-name";
      nameEl.textContent = card.name;

      const descEl = document.createElement("div");
      descEl.className = "boss-deck-card-desc";
      descEl.textContent = card.desc;

      infoEl.appendChild(nameEl);
      infoEl.appendChild(descEl);

      cardEl.appendChild(checkbox);
      cardEl.appendChild(infoEl);
      deckListEl.appendChild(cardEl);
    });
  }

  function showDeckSelection() {
    contentEl.hidden = true;
    deckSelectionEl.hidden = false;
    renderDeckSelection();
  }

  function confirmDeckSelection() {
    const selectedCards = Array.from(deckListEl.querySelectorAll(".boss-deck-card-checkbox"))
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => deckCards[Number(checkbox.dataset.index)]);

    console.log("선택된 덱 카드:", selectedCards);

    deckSelectionEl.hidden = true;
    playGlitch();
  }

  function playGlitch() {
    contentEl.hidden = true;
    glitchEl.classList.remove("playing");
    void glitchEl.offsetWidth; // 애니메이션 재시작을 위한 강제 리플로우
    glitchEl.classList.add("playing");

    glitchTimeoutId = setTimeout(() => {
      glitchEl.classList.remove("playing");
      contentEl.hidden = false;
    }, GLITCH_DURATION);
  }

  function resetSimulator() {
    simulatorEl.hidden = true;
    startBtn.hidden = false;
    endingEl.hidden = true;
    endingChoiceEl.hidden = true;
    endingResultEl.hidden = true;
    bottomBarEl.hidden = true;

    slider.value = "50";
    sliderValueEl.textContent = slider.value;
  }

  function pickEndingLines() {
    if (affinity >= 5) return ENDING_LINES_HIGH;
    if (affinity >= 0) return ENDING_LINES_MID;
    return ENDING_LINES_LOW;
  }

  function renderEndingLine() {
    renderDialogueLine(currentEndingLines[endingIndex], endingLineEl, bottomBarEl);
  }

  function showEndingScene() {
    contentEl.hidden = true;
    currentEndingLines = pickEndingLines();
    endingIndex = 0;
    endingEl.hidden = false;
    renderEndingLine();
  }

  function showEndingChoice() {
    endingEl.hidden = true;
    endingChoiceEl.hidden = false;
  }

  function showEndingResult(key) {
    endingChoiceEl.hidden = true;
    endingResultTextEl.textContent = ENDING_RESULT_TEXTS[key];
    endingResultEl.hidden = false;
    showPlayerLine(bottomBarEl);
  }

  function advanceEnding() {
    if (endingIndex >= currentEndingLines.length - 1) {
      console.log("보스 씬 종료");
      showEndingChoice();
      return;
    }
    endingIndex += 1;
    renderEndingLine();
  }

  function centerNode() {
    const rect = nodeArea.getBoundingClientRect();
    node.style.left = `${rect.width / 2 - NODE_SIZE / 2}px`;
    node.style.top = `${rect.height / 2 - NODE_SIZE / 2}px`;
  }

  function setNodePosition(clientX, clientY) {
    const rect = areaRect || nodeArea.getBoundingClientRect();
    let x = clientX - rect.left - NODE_SIZE / 2;
    let y = clientY - rect.top - NODE_SIZE / 2;
    x = Math.max(0, Math.min(x, rect.width - NODE_SIZE));
    y = Math.max(0, Math.min(y, rect.height - NODE_SIZE));

    node.style.left = `${x}px`;
    node.style.top = `${y}px`;

    console.log(`노드 위치: (${Math.round(x)}, ${Math.round(y)})`);
  }

  startBtn.addEventListener("click", () => {
    console.log("시뮬레이터 시작");
    startBtn.hidden = true;
    simulatorEl.hidden = false;
    centerNode();
  });

  slider.addEventListener("input", () => {
    sliderValueEl.textContent = slider.value;
    console.log("슬라이더 값:", slider.value);
  });

  node.addEventListener("pointerdown", (event) => {
    dragging = true;
    areaRect = nodeArea.getBoundingClientRect();
    node.setPointerCapture(event.pointerId);
  });

  node.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    setNodePosition(event.clientX, event.clientY);
  });

  node.addEventListener("pointerup", (event) => {
    dragging = false;
    areaRect = null;
    node.releasePointerCapture(event.pointerId);
  });

  clearBtn.addEventListener("click", () => {
    console.log("보스 클리어");
    showEndingScene();
  });

  deckConfirmBtn.addEventListener("click", confirmDeckSelection);

  endingNextBtn.addEventListener("click", advanceEnding);

  accuseBtn.addEventListener("click", () => showEndingResult("accuse"));
  silenceBtn.addEventListener("click", () => showEndingResult("silence"));

  return {
    onEnter: () => {
      console.log("[boss] entered");
      resetSimulator();
      showDeckSelection();
    },
    onExit: () => {
      clearTimeout(glitchTimeoutId);
      glitchEl.classList.remove("playing");
      dragging = false;
      areaRect = null;
      deckSelectionEl.hidden = true;
      console.log("[boss] exited");
    },
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

Router.register("case", CaseScreen);

Router.register("gameover", {
  onEnter: () => console.log("[gameover] entered"),
  onExit: () => console.log("[gameover] exited"),
});

Router.register("simulator", {
  onEnter: () => console.log("[simulator] entered"),
  onExit: () => console.log("[simulator] exited"),
});

Router.register("boss", BossScreen);

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

    playerName = name;

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
