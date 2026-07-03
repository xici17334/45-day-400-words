const DAY_COUNT = 45;
const STORAGE_KEY = "word400-plan-v1";

const DAYS = [];
let cursor = 0;
for (let day = 1; day <= DAY_COUNT; day += 1) {
  const count = day <= 40 ? 9 : 8;
  DAYS.push(WORDS.slice(cursor, cursor + count));
  cursor += count;
}

const $ = (selector) => document.querySelector(selector);
const elements = {
  wordGrid: $("#wordGrid"),
  template: $("#wordCardTemplate"),
  dayLabel: $("#dayLabel"),
  dayRange: $("#dayRange"),
  studyTitle: $("#studyTitle"),
  prevDay: $("#prevDay"),
  nextDay: $("#nextDay"),
  dayButton: $("#dayButton"),
  dayDialog: $("#dayDialog"),
  dayMap: $("#dayMap"),
  settingsDialog: $("#settingsDialog"),
  openSettings: $("#openSettings"),
  voiceSelect: $("#voiceSelect"),
  rateInput: $("#rateInput"),
  rateOutput: $("#rateOutput"),
  startDate: $("#startDate"),
  todayHint: $("#todayHint"),
  goToday: $("#goToday"),
  searchInput: $("#searchInput"),
  searchNotice: $("#searchNotice"),
  playAll: $("#playAll"),
  dictationMode: $("#dictationMode"),
  dictationDialog: $("#dictationDialog"),
  dictationDay: $("#dictationDay"),
  dictationCounter: $("#dictationCounter"),
  dictationSpeak: $("#dictationSpeak"),
  revealWord: $("#revealWord"),
  dictationAnswer: $("#dictationAnswer"),
  dictationPrev: $("#dictationPrev"),
  dictationNext: $("#dictationNext"),
  masteredCount: $("#masteredCount"),
  progressRing: $("#progressRing"),
  progressBar: $("#progressBar"),
  progressMessage: $("#progressMessage"),
  dayMastered: $("#dayMastered"),
  markDayDone: $("#markDayDone"),
};

const defaultState = {
  currentDay: 1,
  mastered: [],
  startDate: new Date().toISOString().slice(0, 10),
  audioMode: "bundled",
  voiceURI: "",
  rate: 0.85,
};

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      ...defaultState,
      ...stored,
      mastered: Array.isArray(stored?.mastered) ? stored.mastered : [],
    };
  } catch {
    return { ...defaultState };
  }
}

let state = loadState();
let voices = [];
let speakingAll = false;
let currentAudio = null;
let dictationWords = [];
let dictationIndex = 0;

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getDayRange(dayNumber) {
  const before = DAYS.slice(0, dayNumber - 1).reduce((sum, day) => sum + day.length, 0);
  return { start: before + 1, end: before + DAYS[dayNumber - 1].length };
}

function getWordDay(wordId) {
  return wordId <= 360 ? Math.ceil(wordId / 9) : 40 + Math.ceil((wordId - 360) / 8);
}

function isMastered(id) {
  return state.mastered.includes(id);
}

function setMastered(id, mastered) {
  const ids = new Set(state.mastered);
  if (mastered) ids.add(id);
  else ids.delete(id);
  state.mastered = [...ids].sort((a, b) => a - b);
  saveState();
}

function renderDay() {
  stopSpeaking();
  const words = DAYS[state.currentDay - 1];
  const range = getDayRange(state.currentDay);

  elements.dayLabel.textContent = `第 ${state.currentDay} 天`;
  elements.dayRange.textContent = `单词 ${range.start}–${range.end}`;
  elements.studyTitle.textContent = `今天学习 ${words.length} 个词`;
  elements.prevDay.disabled = state.currentDay === 1;
  elements.nextDay.disabled = state.currentDay === DAY_COUNT;
  elements.wordGrid.innerHTML = "";

  words.forEach((item) => {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    card.dataset.id = item.id;
    card.querySelector(".word-number").textContent = String(item.id).padStart(3, "0");
    card.querySelector(".word-text").textContent = item.word;
    card.querySelector(".meaning").textContent = item.meaning;
    card.querySelector(".word-day").textContent = `45天计划 · 第 ${state.currentDay} 天`;

    const masterButton = card.querySelector(".master-button");
    const mastered = isMastered(item.id);
    card.classList.toggle("mastered", mastered);
    masterButton.setAttribute("aria-label", mastered ? `取消掌握 ${item.word}` : `标记 ${item.word} 为已掌握`);
    masterButton.addEventListener("click", () => {
      setMastered(item.id, !isMastered(item.id));
      renderDay();
    });

    card.querySelector(".word-speak").addEventListener("click", () => speakWord(item.word, card));
    elements.wordGrid.append(card);
  });

  renderProgress();
  renderDayMap();
}

function renderProgress() {
  const total = state.mastered.length;
  const percentage = (total / WORDS.length) * 100;
  const dayWords = DAYS[state.currentDay - 1];
  const completedToday = dayWords.filter((item) => isMastered(item.id)).length;
  const allDone = completedToday === dayWords.length;

  elements.masteredCount.textContent = total;
  elements.progressRing.style.setProperty("--progress", percentage.toFixed(2));
  elements.progressBar.style.width = `${percentage}%`;
  elements.progressMessage.textContent =
    total === 400 ? "太棒了，400个词已经全部点亮！" :
    total >= 300 ? "最后一段路，稳稳走完。" :
    total >= 150 ? "积累已经开始变成实力。" :
    total > 0 ? `已完成 ${Math.round(percentage)}%，继续保持。` :
    "今天就从第一个词开始吧。";
  elements.dayMastered.textContent = `本日已掌握 ${completedToday} / ${dayWords.length}`;
  elements.markDayDone.textContent = allDone ? "撤销本日掌握 →" : "本日全部掌握 →";
}

function changeDay(day) {
  state.currentDay = Math.max(1, Math.min(DAY_COUNT, day));
  saveState();
  renderDay();
  window.scrollTo({ top: document.querySelector(".control-panel").offsetTop - 20, behavior: "smooth" });
}

function renderDayMap() {
  elements.dayMap.innerHTML = "";
  DAYS.forEach((words, index) => {
    const day = index + 1;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = day;
    button.title = `第 ${day} 天 · ${words.length} 个词`;
    button.classList.toggle("active", day === state.currentDay);
    button.classList.toggle("done", words.every((item) => isMastered(item.id)));
    button.addEventListener("click", () => {
      elements.dayDialog.close();
      changeDay(day);
    });
    elements.dayMap.append(button);
  });
}

function rankVoice(voice) {
  const text = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  let score = 0;
  if (voice.lang.toLowerCase() === "en-us") score += 100;
  else if (voice.lang.toLowerCase().startsWith("en")) score += 50;
  if (/natural|online/.test(text)) score += 40;
  if (/aria|jenny|guy|google us english|samantha|zira/.test(text)) score += 25;
  if (/microsoft|google|apple/.test(text)) score += 10;
  if (voice.localService) score += 3;
  return score;
}

function loadVoices() {
  elements.voiceSelect.innerHTML = "";
  const bundledOption = document.createElement("option");
  bundledOption.value = "bundled";
  bundledOption.textContent = "内置美式发音（兼容模式，推荐）";
  elements.voiceSelect.append(bundledOption);

  if ("speechSynthesis" in window) {
    voices = speechSynthesis.getVoices()
      .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
      .sort((a, b) => rankVoice(b) - rankVoice(a));

    voices.forEach((voice) => {
      const option = document.createElement("option");
      option.value = `browser:${voice.voiceURI}`;
      option.textContent = `浏览器音色：${voice.name} (${voice.lang})`;
      elements.voiceSelect.append(option);
    });
  }

  const browserValue = `browser:${state.voiceURI}`;
  const hasSavedVoice = voices.some((voice) => browserValue === `browser:${voice.voiceURI}`);
  elements.voiceSelect.value =
    state.audioMode === "browser" && hasSavedVoice ? browserValue : "bundled";
}

function selectedVoice() {
  return voices.find((voice) => voice.voiceURI === state.voiceURI) || voices[0] || null;
}

function clearSpeakingCards() {
  document.querySelectorAll(".word-card.speaking").forEach((card) => card.classList.remove("speaking"));
}

function speakWithBrowser(word, card = null, onEnd = null) {
  if (!("speechSynthesis" in window)) {
    alert("音频加载失败，请检查网络后重试。");
    return;
  }
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = Number(state.rate);
  utterance.pitch = 1;
  utterance.volume = 1;
  const voice = selectedVoice();
  if (voice) utterance.voice = voice;
  utterance.onend = () => {
    if (card) card.classList.remove("speaking");
    if (onEnd) onEnd();
  };
  utterance.onerror = () => {
    if (card) card.classList.remove("speaking");
    stopSpeaking();
  };
  speechSynthesis.speak(utterance);
}

function speakWord(word, card = null, onEnd = null) {
  stopCurrentSound();
  clearSpeakingCards();
  if (card) card.classList.add("speaking");

  if (state.audioMode === "browser") {
    speakWithBrowser(word, card, onEnd);
    return;
  }

  const fileName = `${word.toLowerCase()}.mp3`;
  const audio = new Audio(`audio/${encodeURIComponent(fileName)}`);
  currentAudio = audio;
  audio.preload = "auto";
  audio.playbackRate = Number(state.rate);
  audio.onended = () => {
    currentAudio = null;
    if (card) card.classList.remove("speaking");
    if (onEnd) onEnd();
  };
  audio.onerror = () => {
    currentAudio = null;
    speakWithBrowser(word, card, onEnd);
  };
  audio.play().catch(() => {
    currentAudio = null;
    speakWithBrowser(word, card, onEnd);
  });
}

function stopCurrentSound() {
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    currentAudio.load();
    currentAudio = null;
  }
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

function stopSpeaking() {
  stopCurrentSound();
  speakingAll = false;
  clearSpeakingCards();
  elements.playAll.classList.remove("playing");
  elements.playAll.innerHTML = "<span>▶</span> 逐词朗读";
}

function playDay() {
  if (speakingAll) {
    stopSpeaking();
    return;
  }
  speakingAll = true;
  elements.playAll.classList.add("playing");
  elements.playAll.innerHTML = "<span>■</span> 停止朗读";
  const words = DAYS[state.currentDay - 1];
  let index = 0;

  const next = () => {
    if (!speakingAll || index >= words.length) {
      stopSpeaking();
      return;
    }
    const item = words[index];
    const card = elements.wordGrid.querySelector(`[data-id="${item.id}"]`);
    index += 1;
    speakWord(item.word, card, () => {
      if (!speakingAll) return;
      window.setTimeout(next, 320);
    });
  };
  next();
}

function searchWords(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    elements.searchNotice.hidden = true;
    elements.searchNotice.innerHTML = "";
    return [];
  }
  const matches = WORDS.filter((item) =>
    item.word.toLowerCase().includes(normalized) || item.meaning.includes(query.trim())
  ).slice(0, 8);

  elements.searchNotice.hidden = false;
  if (!matches.length) {
    elements.searchNotice.textContent = "没有找到这个词，试试更短的英文或中文关键词。";
    return [];
  }

  elements.searchNotice.innerHTML = matches.map((item) =>
    `<button class="text-button search-result" type="button" data-id="${item.id}"><strong>${item.word}</strong> · ${item.meaning} · 第${getWordDay(item.id)}天</button>`
  ).join("　");
  return matches;
}

function jumpToWord(item) {
  const day = getWordDay(item.id);
  state.currentDay = day;
  saveState();
  renderDay();
  requestAnimationFrame(() => {
    const card = elements.wordGrid.querySelector(`[data-id="${item.id}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.animate(
      [{ outlineColor: "rgba(240,168,60,0)" }, { outlineColor: "rgba(240,168,60,.9)" }, { outlineColor: "rgba(240,168,60,0)" }],
      { duration: 1500, iterations: 1 }
    );
  });
}

function currentPlanDay() {
  const start = new Date(`${state.startDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const elapsed = Math.floor((today - start) / 86400000) + 1;
  return Math.max(1, Math.min(DAY_COUNT, elapsed));
}

function updateTodayHint() {
  const planDay = currentPlanDay();
  const today = new Date();
  const start = new Date(`${state.startDate}T00:00:00`);
  today.setHours(0, 0, 0, 0);
  if (today < start) {
    elements.todayHint.textContent = `计划尚未开始；到开始日期后将自动计算学习日。`;
  } else {
    elements.todayHint.textContent = `按此日期计算，今天对应第 ${planDay} 天。`;
  }
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function openDictation() {
  stopSpeaking();
  dictationWords = shuffle(DAYS[state.currentDay - 1]);
  dictationIndex = 0;
  elements.dictationDay.textContent = state.currentDay;
  renderDictation();
  elements.dictationDialog.showModal();
}

function renderDictation() {
  const item = dictationWords[dictationIndex];
  elements.dictationCounter.textContent = `第 ${dictationIndex + 1} / ${dictationWords.length} 个`;
  elements.dictationAnswer.hidden = true;
  elements.dictationAnswer.innerHTML = "";
  elements.revealWord.textContent = "显示答案";
  elements.dictationPrev.disabled = dictationIndex === 0;
  elements.dictationNext.textContent = dictationIndex === dictationWords.length - 1 ? "重新开始" : "下一个";
  speakWord(item.word);
}

function revealDictation() {
  const item = dictationWords[dictationIndex];
  elements.dictationAnswer.innerHTML = `<strong>${item.word}</strong><span>${item.meaning}</span>`;
  elements.dictationAnswer.hidden = false;
  elements.revealWord.textContent = "再次朗读";
}

elements.prevDay.addEventListener("click", () => changeDay(state.currentDay - 1));
elements.nextDay.addEventListener("click", () => changeDay(state.currentDay + 1));
elements.dayButton.addEventListener("click", () => elements.dayDialog.showModal());
elements.openSettings.addEventListener("click", () => {
  elements.startDate.value = state.startDate;
  updateTodayHint();
  elements.settingsDialog.showModal();
});
elements.playAll.addEventListener("click", playDay);
elements.dictationMode.addEventListener("click", openDictation);

elements.markDayDone.addEventListener("click", () => {
  const words = DAYS[state.currentDay - 1];
  const allDone = words.every((item) => isMastered(item.id));
  words.forEach((item) => setMastered(item.id, !allDone));
  renderDay();
});

elements.searchInput.addEventListener("input", (event) => searchWords(event.target.value));
elements.searchInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const matches = searchWords(elements.searchInput.value);
  if (matches[0]) jumpToWord(matches[0]);
});
elements.searchNotice.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) return;
  const item = WORDS.find((word) => word.id === Number(button.dataset.id));
  if (item) jumpToWord(item);
});

elements.voiceSelect.addEventListener("change", () => {
  const value = elements.voiceSelect.value;
  state.audioMode = value === "bundled" ? "bundled" : "browser";
  if (value.startsWith("browser:")) state.voiceURI = value.slice(8);
  saveState();
  speakWord("Welcome");
});
elements.rateInput.addEventListener("input", () => {
  state.rate = Number(elements.rateInput.value);
  elements.rateOutput.textContent = `${state.rate.toFixed(2)}×`;
  saveState();
});
elements.startDate.addEventListener("change", () => {
  state.startDate = elements.startDate.value || defaultState.startDate;
  saveState();
  updateTodayHint();
});
elements.goToday.addEventListener("click", () => {
  elements.settingsDialog.close();
  changeDay(currentPlanDay());
});

elements.dictationSpeak.addEventListener("click", () => speakWord(dictationWords[dictationIndex].word));
elements.revealWord.addEventListener("click", () => {
  if (elements.dictationAnswer.hidden) revealDictation();
  else speakWord(dictationWords[dictationIndex].word);
});
elements.dictationPrev.addEventListener("click", () => {
  if (dictationIndex > 0) {
    dictationIndex -= 1;
    renderDictation();
  }
});
elements.dictationNext.addEventListener("click", () => {
  if (dictationIndex === dictationWords.length - 1) {
    dictationWords = shuffle(dictationWords);
    dictationIndex = 0;
  } else {
    dictationIndex += 1;
  }
  renderDictation();
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    stopSpeaking();
    document.getElementById(button.dataset.close).close();
  });
});

document.querySelector(".brand").addEventListener("click", (event) => {
  event.preventDefault();
  changeDay(currentPlanDay());
});

elements.rateInput.value = state.rate;
elements.rateOutput.textContent = `${Number(state.rate).toFixed(2)}×`;
elements.startDate.value = state.startDate;
renderDay();
loadVoices();
if ("speechSynthesis" in window) {
  speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
  window.speechSynthesis.onvoiceschanged = loadVoices;
}
