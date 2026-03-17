import { useCallback, useEffect, useRef, useState } from 'react'
import vocabularyData from './data/vocabulary_extracted_all.json'
import phrasePracticeData from './data/practice_phrases_extracted_all.json'
import './App.css'

const SINGULAR_FRAMES = ['a', 'the', 'this', 'that', 'my', 'your']
const PLURAL_FRAMES = ['the', '2', '3', '4', 'these', 'those', 'my', 'your']
const PREPOSITIONS = [
  'OF',
  'TO',
  'FOR',
  'FROM',
  'WITH',
  'WITHOUT',
  'AFTER',
  'BEFORE',
  'ABOUT',
  'BECAUSE OF',
  'IN',
  'ON',
  'AT',
]
const MODE_LABELS = {
  vocabulary: 'Kelime Çalışması',
  drill: 'Ağız Alıştırma',
  translation: 'Türkçe → İngilizce Yazma',
}
const STUDY_MODES = ['vocabulary', 'drill', 'translation']
const STUDY_MODE_SET = new Set(STUDY_MODES)
const MODES = ['home', ...STUDY_MODES, 'profile']
const MODE_SET = new Set(MODES)
const STATS_STORAGE_KEY = 'engpractice-stats-v1'
const EMPTY_ACTIONS = Object.freeze({
  next: 0,
  prev: 0,
  shuffle: 0,
  checks: 0,
  correct: 0,
  wrong: 0,
  reveal: 0,
})
const EMPTY_MODE_SECONDS = Object.freeze({
  vocabulary: 0,
  drill: 0,
  translation: 0,
})
const EMPTY_MODE_VISITS = Object.freeze({
  vocabulary: 0,
  drill: 0,
  translation: 0,
})

function getDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateKeyFromOffset(offsetDays) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - offsetDays)
  return getDateKey(date)
}

function getLastDateKeys(daysCount) {
  return Array.from({ length: daysCount }, (_, index) => getDateKeyFromOffset(index))
}

function dateKeyToUtcDayIndex(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

function formatDateLabel(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)

  if (hours === 0 && minutes === 0) {
    return `${safeSeconds} sn`
  }
  if (hours === 0) {
    return `${minutes} dk`
  }
  if (minutes === 0) {
    return `${hours} sa`
  }
  return `${hours} sa ${minutes} dk`
}

function formatHours(seconds) {
  return `${(Math.max(0, seconds) / 3600).toFixed(2)} saat`
}

function toSafeNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function createEmptyActions() {
  return { ...EMPTY_ACTIONS }
}

function createEmptyModeSeconds() {
  return { ...EMPTY_MODE_SECONDS }
}

function createEmptyModeVisits() {
  return { ...EMPTY_MODE_VISITS }
}

function createDailyStats() {
  return {
    studySeconds: 0,
    sessions: 0,
    modeSeconds: createEmptyModeSeconds(),
    actions: createEmptyActions(),
  }
}

function createEmptyProfileStats() {
  const nowIso = new Date().toISOString()
  return {
    profileName: '',
    createdAt: nowIso,
    updatedAt: nowIso,
    totals: {
      studySeconds: 0,
      sessions: 0,
      modeSeconds: createEmptyModeSeconds(),
      modeVisits: createEmptyModeVisits(),
      actions: createEmptyActions(),
    },
    daily: {},
  }
}

function normalizeActions(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    next: toSafeNumber(source.next),
    prev: toSafeNumber(source.prev),
    shuffle: toSafeNumber(source.shuffle),
    checks: toSafeNumber(source.checks),
    correct: toSafeNumber(source.correct),
    wrong: toSafeNumber(source.wrong),
    reveal: toSafeNumber(source.reveal),
  }
}

function normalizeModeSeconds(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    vocabulary: toSafeNumber(source.vocabulary),
    drill: toSafeNumber(source.drill),
    translation: toSafeNumber(source.translation),
  }
}

function normalizeModeVisits(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    vocabulary: toSafeNumber(source.vocabulary),
    drill: toSafeNumber(source.drill),
    translation: toSafeNumber(source.translation),
  }
}

function normalizeDailyMap(value) {
  const source = value && typeof value === 'object' ? value : {}
  const normalized = {}

  Object.entries(source).forEach(([dateKey, dayStats]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return
    }
    const day = dayStats && typeof dayStats === 'object' ? dayStats : {}
    normalized[dateKey] = {
      studySeconds: toSafeNumber(day.studySeconds),
      sessions: toSafeNumber(day.sessions),
      modeSeconds: normalizeModeSeconds(day.modeSeconds),
      actions: normalizeActions(day.actions),
    }
  })

  return normalized
}

function normalizeProfileStats(raw) {
  const fallback = createEmptyProfileStats()
  if (!raw || typeof raw !== 'object') {
    return fallback
  }

  return {
    profileName: typeof raw.profileName === 'string' ? raw.profileName.slice(0, 60) : '',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : fallback.createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : fallback.updatedAt,
    totals: {
      studySeconds: toSafeNumber(raw.totals?.studySeconds),
      sessions: toSafeNumber(raw.totals?.sessions),
      modeSeconds: normalizeModeSeconds(raw.totals?.modeSeconds),
      modeVisits: normalizeModeVisits(raw.totals?.modeVisits),
      actions: normalizeActions(raw.totals?.actions),
    },
    daily: normalizeDailyMap(raw.daily),
  }
}

function calculateCurrentStreak(daily) {
  let streak = 0
  let offset = 0

  while (true) {
    const dateKey = getDateKeyFromOffset(offset)
    const studySeconds = daily[dateKey]?.studySeconds ?? 0
    if (studySeconds <= 0) {
      break
    }
    streak += 1
    offset += 1
  }

  return streak
}

function calculateLongestStreak(daily) {
  const activeKeys = Object.keys(daily).filter((dateKey) => (daily[dateKey]?.studySeconds ?? 0) > 0)
  if (activeKeys.length === 0) {
    return 0
  }

  activeKeys.sort()

  let longest = 1
  let current = 1

  for (let i = 1; i < activeKeys.length; i += 1) {
    const prevIndex = dateKeyToUtcDayIndex(activeKeys[i - 1])
    const currentIndex = dateKeyToUtcDayIndex(activeKeys[i])
    if (currentIndex - prevIndex === 1) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 1
    }
  }

  return longest
}

function loadStoredStats() {
  if (typeof window === 'undefined') {
    return createEmptyProfileStats()
  }

  try {
    const raw = window.localStorage.getItem(STATS_STORAGE_KEY)
    if (!raw) {
      return createEmptyProfileStats()
    }
    return normalizeProfileStats(JSON.parse(raw))
  } catch {
    return createEmptyProfileStats()
  }
}

function normalizeMode(mode) {
  return MODE_SET.has(mode) ? mode : 'home'
}

function modeToHash(mode) {
  const safeMode = normalizeMode(mode)
  return safeMode === 'home' ? '#/' : `#/${safeMode}`
}

function hashToMode(hash) {
  const cleanHash = hash.replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '').toLowerCase()
  if (!cleanHash) {
    return 'home'
  }
  return normalizeMode(cleanHash)
}

function getModeFromUrl() {
  if (typeof window === 'undefined') {
    return 'home'
  }
  return hashToMode(window.location.hash)
}

function useProfileStats(currentMode) {
  const [stats, setStats] = useState(() => loadStoredStats())
  const previousModeRef = useRef('home')
  const timerRef = useRef(null)

  const addStudySeconds = useCallback((mode, deltaSeconds = 1) => {
    if (!STUDY_MODE_SET.has(mode) || deltaSeconds <= 0) {
      return
    }

    const dayKey = getDateKey()
    const nowIso = new Date().toISOString()

    setStats((prev) => {
      const dayStats = prev.daily[dayKey] ?? createDailyStats()
      return {
        ...prev,
        updatedAt: nowIso,
        totals: {
          ...prev.totals,
          studySeconds: prev.totals.studySeconds + deltaSeconds,
          modeSeconds: {
            ...prev.totals.modeSeconds,
            [mode]: prev.totals.modeSeconds[mode] + deltaSeconds,
          },
        },
        daily: {
          ...prev.daily,
          [dayKey]: {
            ...dayStats,
            studySeconds: dayStats.studySeconds + deltaSeconds,
            modeSeconds: {
              ...dayStats.modeSeconds,
              [mode]: dayStats.modeSeconds[mode] + deltaSeconds,
            },
          },
        },
      }
    })
  }, [])

  const markSessionStart = useCallback((mode) => {
    if (!STUDY_MODE_SET.has(mode)) {
      return
    }

    const dayKey = getDateKey()
    const nowIso = new Date().toISOString()

    setStats((prev) => {
      const dayStats = prev.daily[dayKey] ?? createDailyStats()
      return {
        ...prev,
        updatedAt: nowIso,
        totals: {
          ...prev.totals,
          sessions: prev.totals.sessions + 1,
          modeVisits: {
            ...prev.totals.modeVisits,
            [mode]: prev.totals.modeVisits[mode] + 1,
          },
        },
        daily: {
          ...prev.daily,
          [dayKey]: {
            ...dayStats,
            sessions: dayStats.sessions + 1,
          },
        },
      }
    })
  }, [])

  const trackAction = useCallback((actionKey, mode) => {
    if (!STUDY_MODE_SET.has(mode)) {
      return
    }
    if (!Object.prototype.hasOwnProperty.call(EMPTY_ACTIONS, actionKey)) {
      return
    }

    const dayKey = getDateKey()
    const nowIso = new Date().toISOString()

    setStats((prev) => {
      const dayStats = prev.daily[dayKey] ?? createDailyStats()
      return {
        ...prev,
        updatedAt: nowIso,
        totals: {
          ...prev.totals,
          actions: {
            ...prev.totals.actions,
            [actionKey]: prev.totals.actions[actionKey] + 1,
          },
        },
        daily: {
          ...prev.daily,
          [dayKey]: {
            ...dayStats,
            actions: {
              ...dayStats.actions,
              [actionKey]: dayStats.actions[actionKey] + 1,
            },
          },
        },
      }
    })
  }, [])

  const updateProfileName = useCallback((nextName) => {
    const safeName = typeof nextName === 'string' ? nextName.slice(0, 60) : ''
    setStats((prev) => ({
      ...prev,
      profileName: safeName,
      updatedAt: new Date().toISOString(),
    }))
  }, [])

  const resetStats = useCallback(() => {
    setStats(createEmptyProfileStats())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats))
  }, [stats])

  useEffect(() => {
    const previousMode = previousModeRef.current
    const isStudyMode = STUDY_MODE_SET.has(currentMode)
    let sessionTimerId = null

    if (previousMode !== currentMode && isStudyMode) {
      sessionTimerId = setTimeout(() => {
        markSessionStart(currentMode)
      }, 0)
    }
    previousModeRef.current = currentMode

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (isStudyMode) {
      timerRef.current = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) {
          return
        }
        addStudySeconds(currentMode, 1)
      }, 1000)
    }

    return () => {
      if (sessionTimerId) {
        clearTimeout(sessionTimerId)
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [currentMode, addStudySeconds, markSessionStart])

  return {
    stats,
    trackAction,
    updateProfileName,
    resetStats,
  }
}

function shuffleArray(list) {
  const items = [...list]
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = items[i]
    items[i] = items[j]
    items[j] = temp
  }
  return items
}

function useShuffledDeck(items) {
  const [deck, setDeck] = useState(() => shuffleArray(items))
  const [index, setIndex] = useState(0)

  function goNext() {
    setIndex((prev) => (prev + 1) % deck.length)
  }

  function goPrev() {
    setIndex((prev) => (prev - 1 + deck.length) % deck.length)
  }

  function reshuffle() {
    const nextDeck = shuffleArray(items)
    setDeck(nextDeck)
    setIndex(0)
  }

  return {
    deck,
    index,
    current: deck[index],
    total: deck.length,
    goNext,
    goPrev,
    reshuffle,
  }
}

function normalizePracticeWord(english) {
  return english.replace(/^THE\s+/i, '').trim()
}

function normalizeAnswer(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıİ]/g, 'i')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function analyzeAnswer(userRaw, expectedRaw) {
  const user = normalizeAnswer(userRaw)
  const expected = normalizeAnswer(expectedRaw)

  const userChars = [...user]
  const expectedChars = [...expected]

  const dp = Array.from({ length: userChars.length + 1 }, () =>
    Array(expectedChars.length + 1).fill(0),
  )

  for (let i = userChars.length - 1; i >= 0; i -= 1) {
    for (let j = expectedChars.length - 1; j >= 0; j -= 1) {
      if (userChars[i] === expectedChars[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  const segments = []
  let i = 0
  let j = 0
  let extraCount = 0
  let missingCount = 0

  while (i < userChars.length && j < expectedChars.length) {
    if (userChars[i] === expectedChars[j]) {
      segments.push({ char: userChars[i], status: 'ok' })
      i += 1
      j += 1
      continue
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      segments.push({ char: userChars[i], status: 'wrong' })
      extraCount += 1
      i += 1
    } else {
      missingCount += 1
      j += 1
    }
  }

  while (i < userChars.length) {
    segments.push({ char: userChars[i], status: 'wrong' })
    extraCount += 1
    i += 1
  }

  while (j < expectedChars.length) {
    missingCount += 1
    j += 1
  }

  const lcsLength = dp[0][0]
  const accuracy = expectedChars.length === 0 ? 1 : lcsLength / expectedChars.length

  return {
    user,
    expected,
    isMatch: user === expected,
    segments,
    extraCount,
    missingCount,
    accuracy,
  }
}

function HomePage({ onSelect }) {
  return (
    <section className="home-panel">
      <p className="eyebrow">EngPractice</p>
      <h1 className="main-title">Çalışma Modunu Seç</h1>
      <p className="home-text">
        İstediğin çalışma tipini seç ve doğrudan o alıştırma ekranına geç.
      </p>

      <div className="mode-grid">
        <button type="button" className="mode-card" onClick={() => onSelect('vocabulary')}>
          <p className="mode-index">1. Çalışma</p>
          <h2>Kelime Çalışması</h2>
          <p>Rastgele kelime kartlarıyla İngilizce, telaffuz ve Türkçe karşılığı tekrar et.</p>
        </button>

        <button type="button" className="mode-card" onClick={() => onSelect('drill')}>
          <p className="mode-index">2. Çalışma</p>
          <h2>Ağız Alıştırma</h2>
          <p>
            Soldaki kelimeyi ortadaki tekil ve sağdaki çoğul kalıplarla tekrar ederek dili alıştır.
          </p>
        </button>

        <button type="button" className="mode-card" onClick={() => onSelect('translation')}>
          <p className="mode-index">3. Çalışma</p>
          <h2>Türkçe → İngilizce Yazma</h2>
          <p>Türkçe ifadeyi gör, İngilizce karşılığını yaz ve anında doğru/yanlış kontrolü al.</p>
        </button>

        <button type="button" className="mode-card profile-card-button" onClick={() => onSelect('profile')}>
          <p className="mode-index">Profil</p>
          <h2>İstatistiklerim</h2>
          <p>Toplam süre, günlük çalışma saatleri, doğruluk oranı ve çalışma geçmişini incele.</p>
        </button>
      </div>
    </section>
  )
}

function HeaderBar({ title, subtitle, onBack }) {
  return (
    <header className="topbar">
      <button type="button" className="back-btn" onClick={onBack}>
        ← Geri
      </button>
      <div className="title-wrap">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  )
}

function VocabularyStudy({ onBack, onAction }) {
  const { current, total, index, goNext, goPrev, reshuffle } = useShuffledDeck(vocabularyData)

  return (
    <section className="study-shell">
      <HeaderBar
        title="Kelime Çalışması"
        subtitle="Rastgele gelen kelimeyi incele ve tekrar et."
        onBack={onBack}
      />

      <article className="word-card">
        <p className="label">English</p>
        <h2 className="english-word">{current.english}</h2>

        <div className="divider" />

        <div className="detail">
          <p className="label">Türkçe Telaffuz</p>
          <p className="value pronunciation">{current.pronunciation_tr}</p>
        </div>

        <div className="detail">
          <p className="label">Türkçe Karşılık</p>
          <p className="value meaning">{current.turkish}</p>
        </div>

        <p className="page-info">Kaynak sayfa: {current.source_page}</p>
      </article>

      <div className="controls">
        <button
          type="button"
          className="nav-btn"
          onClick={() => {
            goPrev()
            onAction('prev', 'vocabulary')
          }}
        >
          ← Geri
        </button>
        <span className="counter">
          {index + 1} / {total}
        </span>
        <button
          type="button"
          className="nav-btn"
          onClick={() => {
            goNext()
            onAction('next', 'vocabulary')
          }}
        >
          İleri →
        </button>
      </div>

      <button
        type="button"
        className="shuffle-btn"
        onClick={() => {
          reshuffle()
          onAction('shuffle', 'vocabulary')
        }}
      >
        Yeni Rastgele Sıra
      </button>
    </section>
  )
}

function PhraseDrillStudy({ onBack, onAction }) {
  const { current, total, index, goNext, goPrev, reshuffle } = useShuffledDeck(vocabularyData)
  const [selectedPreposition, setSelectedPreposition] = useState(PREPOSITIONS[0])

  const baseWord = normalizePracticeWord(current.english)

  return (
    <section className="study-shell">
      <HeaderBar
        title="Ağız Alıştırma"
        subtitle="Kalıpları sabit tekrar et, ardından kelimeyi sen ekleyerek sesli söyle."
        onBack={onBack}
      />

      <div className="drill-grid">
        <article className="drill-column">
          <p className="column-title">Edatlar</p>
          <ul className="prep-list">
            {PREPOSITIONS.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className={`prep-btn ${selectedPreposition === item ? 'active' : ''}`}
                  onClick={() => setSelectedPreposition(item)}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="drill-column">
          <p className="column-title">Tekiller</p>
          <ul className="phrase-list">
            {SINGULAR_FRAMES.map((frame) => (
              <li key={frame}>
                <span className="frame">{frame.toUpperCase()}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="drill-column">
          <p className="column-title">Çoğullar</p>
          <ul className="phrase-list">
            {PLURAL_FRAMES.map((frame) => (
              <li key={frame}>
                <span className="frame">{frame.toUpperCase()}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="drill-column focus">
          <p className="label">Rastgele Kelime</p>
          <p className="selected-preposition">Seçili edat: {selectedPreposition}</p>
          <h2 className="english-word">{baseWord}</h2>
          <p className="value pronunciation">{current.pronunciation_tr}</p>
          <p className="value meaning">{current.turkish}</p>

          <div className="controls compact">
            <button
              type="button"
              className="nav-btn"
              onClick={() => {
                goPrev()
                onAction('prev', 'drill')
              }}
            >
              ← Geri
            </button>
            <span className="counter">
              {index + 1} / {total}
            </span>
            <button
              type="button"
              className="nav-btn"
              onClick={() => {
                goNext()
                onAction('next', 'drill')
              }}
            >
              İleri →
            </button>
          </div>

          <button
            type="button"
            className="shuffle-btn"
            onClick={() => {
              reshuffle()
              onAction('shuffle', 'drill')
            }}
          >
            Yeni Rastgele Sıra
          </button>
        </article>
      </div>
    </section>
  )
}

function TurkishToEnglishStudy({ onBack, onAction }) {
  const { current, total, index, goNext, goPrev, reshuffle } = useShuffledDeck(phrasePracticeData)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [revealAnswer, setRevealAnswer] = useState(false)
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false)
  const autoNextTimerRef = useRef(null)

  function clearAutoNextTimer() {
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current)
      autoNextTimerRef.current = null
    }
    setIsAutoAdvancing(false)
  }

  useEffect(() => {
    return () => {
      clearAutoNextTimer()
    }
  }, [])

  function scheduleAutoNext() {
    clearAutoNextTimer()
    setIsAutoAdvancing(true)
    autoNextTimerRef.current = setTimeout(() => {
      autoNextTimerRef.current = null
      goNextWithReset()
    }, 2000)
  }

  function resetResult() {
    clearAutoNextTimer()
    setAnswer('')
    setResult(null)
    setRevealAnswer(false)
  }

  function goNextWithReset() {
    resetResult()
    goNext()
    onAction('next', 'translation')
  }

  function goPrevWithReset() {
    resetResult()
    goPrev()
    onAction('prev', 'translation')
  }

  function reshuffleWithReset() {
    resetResult()
    reshuffle()
    onAction('shuffle', 'translation')
  }

  function checkAnswer() {
    if (!normalizeAnswer(answer)) {
      setResult(null)
      setRevealAnswer(false)
      clearAutoNextTimer()
      return
    }

    onAction('checks', 'translation')
    const analysis = analyzeAnswer(answer, current.english)
    setResult(analysis.isMatch ? { type: 'correct', analysis } : { type: 'wrong', analysis })
    if (analysis.isMatch) {
      onAction('correct', 'translation')
      setRevealAnswer(false)
      scheduleAutoNext()
    } else {
      onAction('wrong', 'translation')
      clearAutoNextTimer()
    }
  }

  function handleAnswerChange(nextValue) {
    setAnswer(nextValue)

    if (!result) {
      return
    }

    if (!normalizeAnswer(nextValue)) {
      setResult(null)
      setRevealAnswer(false)
      clearAutoNextTimer()
      return
    }

    const analysis = analyzeAnswer(nextValue, current.english)
    setResult(analysis.isMatch ? { type: 'correct', analysis } : { type: 'wrong', analysis })
    if (analysis.isMatch) {
      if (result?.type !== 'correct') {
        onAction('correct', 'translation')
      }
      setRevealAnswer(false)
      scheduleAutoNext()
    } else {
      clearAutoNextTimer()
    }
  }

  return (
    <section className="study-shell">
      <HeaderBar
        title="Türkçe → İngilizce Yazma"
        subtitle="Türkçe ifadeyi gör, İngilizcesini yaz ve doğru/yanlış kontrol et."
        onBack={onBack}
      />

      <article className="word-card qa-card">
        <p className="label">Türkçe İfade</p>
        <h2 className="english-word">{current.turkish}</h2>

        <div className="divider" />

        <label className="label" htmlFor="answer-input">
          İngilizce Karşılık
        </label>
        <div
          className={`answer-shell ${
            result?.type === 'correct' ? 'success' : result?.type === 'wrong' ? 'error' : ''
          }`}
        >
          {result?.type === 'wrong' && (
            <div className="answer-overlay" aria-hidden="true">
              {result.analysis.segments.map((seg, idx) => (
                <span key={`${seg.char}-${idx}`} className={`analysis-char ${seg.status}`}>
                  {seg.char === ' ' ? '\u00A0' : seg.char}
                </span>
              ))}
            </div>
          )}

          <input
            id="answer-input"
            className="answer-input"
            type="text"
            value={answer}
            disabled={isAutoAdvancing}
            onChange={(event) => handleAnswerChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                checkAnswer()
              }
            }}
            placeholder="Cevabı buraya yaz..."
          />
        </div>

        <button type="button" className="check-btn" onClick={checkAnswer} disabled={isAutoAdvancing}>
          Cevabı Kontrol Et
        </button>

        {result?.type === 'correct' && (
          <p className="feedback success loading">
            <span className="spinner" aria-hidden="true" />
            Doğru. Sonraki soru hazırlanıyor...
          </p>
        )}

        {result?.type === 'wrong' && !revealAnswer && (
          <button
            type="button"
            className="reveal-btn"
            onClick={() => {
              setRevealAnswer(true)
              onAction('reveal', 'translation')
            }}
            disabled={isAutoAdvancing}
          >
            Cevabı Göster
          </button>
        )}

        {revealAnswer && (
          <p className="feedback neutral">Doğru cevap: {current.english}</p>
        )}

        <p className="page-info">Kaynak sayfa: {current.source_page}</p>
      </article>

      <div className="controls">
        <button type="button" className="nav-btn" onClick={goPrevWithReset} disabled={isAutoAdvancing}>
          ← Geri
        </button>
        <span className="counter">
          {index + 1} / {total}
        </span>
        <button type="button" className="nav-btn" onClick={goNextWithReset} disabled={isAutoAdvancing}>
          İleri →
        </button>
      </div>

      <button type="button" className="shuffle-btn" onClick={reshuffleWithReset} disabled={isAutoAdvancing}>
        Yeni Rastgele Sıra
      </button>
    </section>
  )
}

function ProfilePage({ onBack, stats, onProfileNameChange, onResetStats }) {
  const todayKey = getDateKey()
  const today = stats.daily[todayKey] ?? createDailyStats()
  const recentDateKeys = getLastDateKeys(14)
  const totalSeconds = stats.totals.studySeconds
  const totalSessions = stats.totals.sessions
  const totalChecks = stats.totals.actions.checks
  const totalCorrect = stats.totals.actions.correct
  const totalAccuracy = totalChecks > 0 ? Math.round((totalCorrect / totalChecks) * 100) : 0

  const weeklySeconds = getLastDateKeys(7).reduce(
    (sum, dayKey) => sum + (stats.daily[dayKey]?.studySeconds ?? 0),
    0,
  )
  const activeDays = Object.values(stats.daily).filter((day) => day.studySeconds > 0).length
  const averageDailySeconds = activeDays > 0 ? totalSeconds / activeDays : 0
  const averageSessionSeconds = totalSessions > 0 ? totalSeconds / totalSessions : 0
  const currentStreak = calculateCurrentStreak(stats.daily)
  const longestStreak = calculateLongestStreak(stats.daily)

  return (
    <section className="study-shell profile-shell">
      <HeaderBar
        title="Profil ve İstatistikler"
        subtitle="Toplam süre, günlük çalışma ve doğruluk verilerini tek ekranda takip et."
        onBack={onBack}
      />

      <article className="profile-card">
        <label className="label" htmlFor="profile-name">
          Kullanıcı Adı
        </label>
        <input
          id="profile-name"
          className="profile-input"
          type="text"
          value={stats.profileName}
          onChange={(event) => onProfileNameChange(event.target.value)}
          placeholder="Adını yaz..."
        />
        <p className="profile-note">İstatistikler yalnızca bu tarayıcıda saklanır.</p>
      </article>

      <div className="stats-grid">
        <article className="stat-card">
          <p className="stat-label">Toplam Çalışma</p>
          <p className="stat-value">{formatDuration(totalSeconds)}</p>
          <p className="stat-subvalue">{formatHours(totalSeconds)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Bugün</p>
          <p className="stat-value">{formatDuration(today.studySeconds)}</p>
          <p className="stat-subvalue">{formatHours(today.studySeconds)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Son 7 Gün</p>
          <p className="stat-value">{formatDuration(weeklySeconds)}</p>
          <p className="stat-subvalue">{formatHours(weeklySeconds)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Toplam Seans</p>
          <p className="stat-value">{totalSessions}</p>
          <p className="stat-subvalue">Ortalama: {formatDuration(averageSessionSeconds)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Aktif Gün</p>
          <p className="stat-value">{activeDays}</p>
          <p className="stat-subvalue">Ortalama: {formatDuration(averageDailySeconds)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Doğruluk</p>
          <p className="stat-value">%{totalAccuracy}</p>
          <p className="stat-subvalue">
            {totalCorrect} / {totalChecks || 0} kontrol
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Mevcut Seri</p>
          <p className="stat-value">{currentStreak} gün</p>
          <p className="stat-subvalue">Kesintisiz çalışma</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">En Uzun Seri</p>
          <p className="stat-value">{longestStreak} gün</p>
          <p className="stat-subvalue">Tüm zamanlar</p>
        </article>
      </div>

      <article className="profile-card">
        <div className="section-head">
          <h2>Çalışma Modu Dağılımı</h2>
          <p>Hangi çalışmaya ne kadar zaman ayırdın.</p>
        </div>
        <div className="mode-breakdown">
          {STUDY_MODES.map((modeKey) => {
            const modeSeconds = stats.totals.modeSeconds[modeKey] ?? 0
            const ratio = totalSeconds > 0 ? Math.round((modeSeconds / totalSeconds) * 100) : 0
            return (
              <div key={modeKey} className="mode-row">
                <div className="mode-row-head">
                  <span>{MODE_LABELS[modeKey]}</span>
                  <span>%{ratio}</span>
                </div>
                <div className="mode-progress">
                  <span className="mode-progress-fill" style={{ width: `${ratio}%` }} />
                </div>
                <p className="mode-row-meta">
                  {formatDuration(modeSeconds)} • {stats.totals.modeVisits[modeKey] || 0} giriş
                </p>
              </div>
            )
          })}
        </div>
      </article>

      <article className="profile-card">
        <div className="section-head">
          <h2>Son 14 Gün</h2>
          <p>Gün bazında çalışma süresi, seans ve doğruluk durumu.</p>
        </div>
        <div className="daily-table-wrap">
          <table className="daily-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Süre</th>
                <th>Seans</th>
                <th>Doğruluk</th>
              </tr>
            </thead>
            <tbody>
              {recentDateKeys.map((dateKey) => {
                const day = stats.daily[dateKey] ?? createDailyStats()
                const checks = day.actions.checks
                const correct = day.actions.correct
                const accuracy = checks > 0 ? Math.round((correct / checks) * 100) : 0

                return (
                  <tr key={dateKey}>
                    <td>{formatDateLabel(dateKey)}</td>
                    <td>{formatDuration(day.studySeconds)}</td>
                    <td>{day.sessions}</td>
                    <td>{checks > 0 ? `%${accuracy} (${correct}/${checks})` : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className="danger-btn"
          onClick={() => {
            const confirmed = window.confirm(
              'Tüm profil istatistiklerini sıfırlamak istediğine emin misin?',
            )
            if (confirmed) {
              onResetStats()
            }
          }}
        >
          İstatistikleri Sıfırla
        </button>
      </article>
    </section>
  )
}

function App() {
  const [mode, setMode] = useState(() => getModeFromUrl())
  const { stats, trackAction, updateProfileName, resetStats } = useProfileStats(mode)

  useEffect(() => {
    const initialMode = getModeFromUrl()
    const existingDepth =
      typeof window.history.state?.appDepth === 'number' ? window.history.state.appDepth : 0

    window.history.replaceState(
      { mode: initialMode, appDepth: existingDepth },
      '',
      modeToHash(initialMode),
    )

    function handlePopState(event) {
      const stateMode = event.state?.mode
      const nextMode = normalizeMode(stateMode ?? getModeFromUrl())
      setMode(nextMode)
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  function navigateMode(nextMode) {
    const safeNextMode = normalizeMode(nextMode)
    if (safeNextMode === mode) {
      return
    }

    const currentDepth =
      typeof window.history.state?.appDepth === 'number' ? window.history.state.appDepth : 0
    const nextDepth = currentDepth + 1

    window.history.pushState(
      { mode: safeNextMode, appDepth: nextDepth },
      '',
      modeToHash(safeNextMode),
    )
    setMode(safeNextMode)
  }

  function goBack() {
    if (mode === 'home') {
      return
    }

    const depth = typeof window.history.state?.appDepth === 'number' ? window.history.state.appDepth : 0
    if (depth > 0) {
      window.history.back()
      return
    }

    navigateMode('home')
  }

  return (
    <main className="page">
      <div className="ambient" />

      <div className="app-shell">
        {mode === 'home' && <HomePage onSelect={navigateMode} />}
        {mode === 'vocabulary' && <VocabularyStudy onBack={goBack} onAction={trackAction} />}
        {mode === 'drill' && <PhraseDrillStudy onBack={goBack} onAction={trackAction} />}
        {mode === 'translation' && <TurkishToEnglishStudy onBack={goBack} onAction={trackAction} />}
        {mode === 'profile' && (
          <ProfilePage
            onBack={goBack}
            stats={stats}
            onProfileNameChange={updateProfileName}
            onResetStats={resetStats}
          />
        )}
      </div>
    </main>
  )
}

export default App
