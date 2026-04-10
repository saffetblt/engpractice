import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import vocabularyData from './data/vocabulary_extracted_all.json'
import phrasePracticeData from './data/practice_phrases_extracted_all.json'
import prepositionPlusExercisesData from './data/preposition_plus_exercises.json'
import locationTimeExercisesData from './data/location_time_exercises.json'
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
const SUBJECT_PRONOUNS = ['I', 'You', 'He', 'She', 'It', 'We', 'You', 'They']
const OBJECT_PRONOUNS = ['me', 'you', 'him', 'her', 'it', 'us', 'you', 'them']
const POSSESSIVE_ADJECTIVES = ['my', 'your', 'his', 'her', 'its', 'our', 'your', 'their']
const POSSESSIVE_PRONOUNS = ['mine', 'yours', 'his', 'hers', 'its', 'ours', 'yours', 'theirs']
const SPEECH_PROPER_NAME_TOKENS = new Set([
  'ali',
  'ayse',
  'ankara',
  'antalya',
  'bodrum',
  'istanbul',
  'turkey',
  'turkiye',
  'anatolia',
  'europe',
  'america',
  'russia',
  'italy',
  'greece',
  'france',
  'bayram',
  'marmaray',
  'facebook',
  'instagram',
  'tiktok',
])
const SPEECH_PROPER_NAME_ALIASES = Object.freeze({
  ayse: ['i shit', 'i she', 'ai she', 'a she', 'aisha', 'aysha', 'asia', 'ay she'],
  ali: ['allie', 'ally', 'alley', 'elli'],
  ankara: ['angara', 'ankora', 'an cara'],
  antalya: ['antalia', 'antalia'],
  istanbul: ['istanbull', 'is tan bul'],
  turkiye: ['turkey', 'turkiye'],
  bodrum: ['bodrumm', 'boardroom'],
  marmaray: ['marmara'],
})
const MODE_LABELS = {
  vocabulary: 'Kelime Çalışması',
  drill: 'Ağız Alıştırma',
  translation: 'Türkçe → İngilizce Yazma',
  pronounDrill: 'Zamir Kalıp Alıştırma',
  prepositionPack: 'Edat + Cümle Alıştırmaları',
  locationPack: 'Am Is Are Alıştırması',
}
const STUDY_MODES = [
  'vocabulary',
  'drill',
  'translation',
  'pronounDrill',
  'prepositionPack',
  'locationPack',
]
const STUDY_MODE_SET = new Set(STUDY_MODES)
const MODES = ['home', ...STUDY_MODES, 'profile']
const MODE_SET = new Set(MODES)
const STATS_STORAGE_KEY = 'engpractice-stats-v1'
const VOCAB_MEMORY_STORAGE_KEY = 'engpractice-vocab-memory-v1'
const TRANSLATION_SMART_STORAGE_KEY = 'engpractice-translation-smart-v1'
const SPEECH_ASSIST_STORAGE_KEY = 'engpractice-speech-assist-v1'
const OPENAI_TRANSCRIPT_FIX_MODEL = 'gpt-4.1-mini'
const AUTO_NEXT_DELAY_MS = 100
const MEMORY_FILTER_LABELS = {
  all: 'Tümü',
  new: 'Yeni',
  learning: 'Çalışılacak',
  mastered: 'Öğrendim',
}
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
  pronounDrill: 0,
  prepositionPack: 0,
  locationPack: 0,
})
const EMPTY_MODE_VISITS = Object.freeze({
  vocabulary: 0,
  drill: 0,
  translation: 0,
  pronounDrill: 0,
  prepositionPack: 0,
  locationPack: 0,
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
    pronounDrill: toSafeNumber(source.pronounDrill),
    prepositionPack: toSafeNumber(source.prepositionPack),
    locationPack: toSafeNumber(source.locationPack),
  }
}

function normalizeModeVisits(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    vocabulary: toSafeNumber(source.vocabulary),
    drill: toSafeNumber(source.drill),
    translation: toSafeNumber(source.translation),
    pronounDrill: toSafeNumber(source.pronounDrill),
    prepositionPack: toSafeNumber(source.prepositionPack),
    locationPack: toSafeNumber(source.locationPack),
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

function createDefaultSpeechAssistSettings() {
  return {
    enabled: false,
    apiKey: '',
  }
}

function resolveOpenAiApiKey(value) {
  const directValue = typeof value === 'string' ? value.trim() : ''
  if (directValue) {
    return directValue
  }
  if (typeof import.meta !== 'undefined') {
    const envValue = String(import.meta.env.VITE_OPENAI_API_KEY ?? '').trim()
    if (envValue) {
      return envValue
    }
  }
  return ''
}

function normalizeSpeechAssistSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  return {
    enabled: Boolean(source.enabled),
    apiKey: typeof source.apiKey === 'string' ? source.apiKey.trim().slice(0, 200) : '',
  }
}

function loadSpeechAssistSettings() {
  if (typeof window === 'undefined') {
    return createDefaultSpeechAssistSettings()
  }

  try {
    const raw = window.localStorage.getItem(SPEECH_ASSIST_STORAGE_KEY)
    if (!raw) {
      return createDefaultSpeechAssistSettings()
    }
    return normalizeSpeechAssistSettings(JSON.parse(raw))
  } catch {
    return createDefaultSpeechAssistSettings()
  }
}

function useSpeechAssistSettings() {
  const [settings, setSettings] = useState(() => loadSpeechAssistSettings())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(SPEECH_ASSIST_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const setEnabled = useCallback((nextEnabled) => {
    setSettings((prev) => ({
      ...prev,
      enabled: Boolean(nextEnabled),
    }))
  }, [])

  const setApiKey = useCallback((nextApiKey) => {
    setSettings((prev) => ({
      ...prev,
      apiKey: typeof nextApiKey === 'string' ? nextApiKey.trim().slice(0, 200) : '',
    }))
  }, [])

  return {
    ...settings,
    setEnabled,
    setApiKey,
  }
}

function createVocabularyWordId(item, fallbackIndex) {
  const english = normalizeAnswer(item.english).replace(/\s+/g, '-')
  const turkish = String(item.turkish ?? '').toLowerCase().replace(/\s+/g, '-')
  const page = item.source_page ?? fallbackIndex + 1
  return `${page}-${english}-${turkish}`
}

function createPhrasePracticeId(item, fallbackIndex) {
  const sourceId = Number.isFinite(Number(item.id)) ? Number(item.id) : fallbackIndex + 1
  const english = normalizeAnswer(item.english).replace(/\s+/g, '-')
  return `phrase-${sourceId}-${english.slice(0, 50)}`
}

function normalizeMemoryStatus(value) {
  if (value === 'learning' || value === 'mastered') {
    return value
  }
  return 'new'
}

function loadVocabularyMemory() {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(VOCAB_MEMORY_STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    const normalized = {}
    Object.entries(parsed).forEach(([wordId, value]) => {
      if (!value || typeof value !== 'object') {
        return
      }
      normalized[wordId] = {
        status: normalizeMemoryStatus(value.status),
        lastReviewedAt: typeof value.lastReviewedAt === 'string' ? value.lastReviewedAt : '',
      }
    })
    return normalized
  } catch {
    return {}
  }
}

function useVocabularyMemory() {
  const [memoryMap, setMemoryMap] = useState(() => loadVocabularyMemory())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(VOCAB_MEMORY_STORAGE_KEY, JSON.stringify(memoryMap))
  }, [memoryMap])

  const getStatus = useCallback(
    (wordId) => {
      return memoryMap[wordId]?.status ?? 'new'
    },
    [memoryMap],
  )

  const setStatus = useCallback((wordId, nextStatus) => {
    const normalizedStatus = normalizeMemoryStatus(nextStatus)
    const nowIso = new Date().toISOString()

    setMemoryMap((prev) => {
      if (normalizedStatus === 'new') {
        const next = { ...prev }
        delete next[wordId]
        return next
      }

      return {
        ...prev,
        [wordId]: {
          status: normalizedStatus,
          lastReviewedAt: nowIso,
        },
      }
    })
  }, [])

  const resetAll = useCallback(() => {
    setMemoryMap({})
  }, [])

  return {
    memoryMap,
    getStatus,
    setStatus,
    resetAll,
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function createEmptyTranslationSmartState() {
  return {
    enabled: false,
    statsById: {},
  }
}

function createEmptyTranslationSmartEntry() {
  return {
    attemptCount: 0,
    wrongCount: 0,
    revealCount: 0,
    totalResponseMs: 0,
    lastSeenAt: '',
  }
}

function normalizeTranslationSmartEntry(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    attemptCount: toSafeNumber(source.attemptCount),
    wrongCount: toSafeNumber(source.wrongCount),
    revealCount: toSafeNumber(source.revealCount),
    totalResponseMs: toSafeNumber(source.totalResponseMs),
    lastSeenAt: typeof source.lastSeenAt === 'string' ? source.lastSeenAt : '',
  }
}

function normalizeTranslationSmartMap(value) {
  const source = value && typeof value === 'object' ? value : {}
  const normalized = {}

  Object.entries(source).forEach(([phraseId, entry]) => {
    if (!phraseId) {
      return
    }
    normalized[phraseId] = normalizeTranslationSmartEntry(entry)
  })

  return normalized
}

function normalizeTranslationSmartState(raw) {
  if (!raw || typeof raw !== 'object') {
    return createEmptyTranslationSmartState()
  }

  return {
    enabled: Boolean(raw.enabled),
    statsById: normalizeTranslationSmartMap(raw.statsById),
  }
}

function loadTranslationSmartState() {
  if (typeof window === 'undefined') {
    return createEmptyTranslationSmartState()
  }

  try {
    const raw = window.localStorage.getItem(TRANSLATION_SMART_STORAGE_KEY)
    if (!raw) {
      return createEmptyTranslationSmartState()
    }
    return normalizeTranslationSmartState(JSON.parse(raw))
  } catch {
    return createEmptyTranslationSmartState()
  }
}

function summarizeTranslationDifficulty(entry) {
  const attemptCount = toSafeNumber(entry?.attemptCount)
  if (attemptCount <= 0) {
    return {
      score: 0,
      attemptCount: 0,
      avgResponseSeconds: 0,
      wrongPerAttempt: 0,
      revealRate: 0,
    }
  }

  const safeAttempts = Math.max(1, attemptCount)
  const avgResponseSeconds = toSafeNumber(entry.totalResponseMs) / 1000 / safeAttempts
  const wrongPerAttempt = toSafeNumber(entry.wrongCount) / safeAttempts
  const revealRate = toSafeNumber(entry.revealCount) / safeAttempts

  const responseRatio = clamp((avgResponseSeconds - 2) / 18, 0, 1)
  const wrongRatio = clamp(wrongPerAttempt / 2, 0, 1)
  const revealRatio = clamp(revealRate, 0, 1)

  return {
    score: Math.round((responseRatio * 0.34 + wrongRatio * 0.41 + revealRatio * 0.25) * 100),
    attemptCount,
    avgResponseSeconds,
    wrongPerAttempt,
    revealRate,
  }
}

function formatResponseSeconds(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  if (safeSeconds < 10) {
    return `${safeSeconds.toFixed(1)} sn`
  }
  return `${Math.round(safeSeconds)} sn`
}

function getNowTimestamp() {
  return new Date().getTime()
}

function useTranslationSmart(translationItems) {
  const [smartState, setSmartState] = useState(() => loadTranslationSmartState())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(TRANSLATION_SMART_STORAGE_KEY, JSON.stringify(smartState))
  }, [smartState])

  const setEnabled = useCallback((nextValue) => {
    setSmartState((prev) => ({
      ...prev,
      enabled: Boolean(nextValue),
    }))
  }, [])

  const recordAttempt = useCallback(({ phraseId, responseMs, wrongCount, revealUsed }) => {
    if (!phraseId) {
      return
    }

    const safeResponseMs = Math.min(120000, Math.round(toSafeNumber(responseMs)))
    const safeWrongCount = Math.round(toSafeNumber(wrongCount))
    const revealIncrement = revealUsed ? 1 : 0
    const nowIso = new Date().toISOString()

    setSmartState((prev) => {
      const previousEntry = prev.statsById[phraseId] ?? createEmptyTranslationSmartEntry()
      return {
        ...prev,
        statsById: {
          ...prev.statsById,
          [phraseId]: {
            attemptCount: previousEntry.attemptCount + 1,
            wrongCount: previousEntry.wrongCount + safeWrongCount,
            revealCount: previousEntry.revealCount + revealIncrement,
            totalResponseMs: previousEntry.totalResponseMs + safeResponseMs,
            lastSeenAt: nowIso,
          },
        },
      }
    })
  }, [])

  const getSummaryById = useCallback(
    (phraseId) => {
      return summarizeTranslationDifficulty(smartState.statsById[phraseId])
    },
    [smartState.statsById],
  )

  const pickNextPhraseId = useCallback(
    ({ excludeId, recentIds = [] } = {}) => {
      if (translationItems.length === 0) {
        return null
      }

      const preferredItems = translationItems.filter((item) => item.practiceId !== excludeId)
      const candidates = preferredItems.length > 0 ? preferredItems : translationItems
      const recentSet = new Set(recentIds.slice(-3))

      let totalWeight = 0
      const weighted = candidates.map((item) => {
        const entry = smartState.statsById[item.practiceId]
        const summary = summarizeTranslationDifficulty(entry)
        let weight = 1

        if (!entry || summary.attemptCount === 0) {
          weight += 0.9
        } else {
          weight += summary.score / 16
        }

        if (recentSet.has(item.practiceId)) {
          weight *= 0.35
        }

        const safeWeight = Math.max(0.12, weight)
        totalWeight += safeWeight
        return { phraseId: item.practiceId, weight: safeWeight }
      })

      let pick = Math.random() * totalWeight
      for (let i = 0; i < weighted.length; i += 1) {
        pick -= weighted[i].weight
        if (pick <= 0) {
          return weighted[i].phraseId
        }
      }
      return weighted[weighted.length - 1]?.phraseId ?? null
    },
    [translationItems, smartState.statsById],
  )

  const hardestPhrases = useMemo(() => {
    return translationItems
      .map((item) => {
        const entry = smartState.statsById[item.practiceId]
        const summary = summarizeTranslationDifficulty(entry)
        if (summary.attemptCount === 0) {
          return null
        }
        return {
          ...item,
          score: summary.score,
          attemptCount: summary.attemptCount,
          avgResponseSeconds: summary.avgResponseSeconds,
          wrongPerAttempt: summary.wrongPerAttempt,
          revealRate: summary.revealRate,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || b.attemptCount - a.attemptCount || a.turkish.localeCompare(b.turkish))
      .slice(0, 12)
  }, [translationItems, smartState.statsById])

  return {
    enabled: smartState.enabled,
    setEnabled,
    recordAttempt,
    getSummaryById,
    pickNextPhraseId,
    hardestPhrases,
  }
}

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') {
    return null
  }
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function getSpeechRecognitionErrorMessage(errorCode) {
  switch (errorCode) {
    case 'no-speech':
      return 'Ses algılanamadı. Mikrofonu açıp tekrar dene.'
    case 'audio-capture':
      return 'Mikrofon bulunamadı veya erişilemiyor.'
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Mikrofon izni verilmedi. Tarayıcı ayarından izin ver.'
    case 'network':
      return 'Ses tanıma sırasında ağ hatası oluştu.'
    default:
      return 'Sesli cevap alınamadı. Tekrar deneyebilirsin.'
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
    if (deck.length === 0) {
      return
    }
    setIndex((prev) => (prev + 1) % deck.length)
  }

  function goPrev() {
    if (deck.length === 0) {
      return
    }
    setIndex((prev) => (prev - 1 + deck.length) % deck.length)
  }

  function resetWithItems(nextItems = items) {
    setDeck(shuffleArray(nextItems))
    setIndex(0)
  }

  function reshuffle() {
    resetWithItems(items)
  }

  return {
    deck,
    index,
    current: deck[index],
    total: deck.length,
    goNext,
    goPrev,
    reshuffle,
    resetWithItems,
  }
}

function createInitialSmartQueue(items) {
  if (!items.length) {
    return { history: [], cursor: 0 }
  }
  const firstIndex = Math.floor(Math.random() * items.length)
  return {
    history: [items[firstIndex].practiceId],
    cursor: 0,
  }
}

function normalizePracticeWord(english) {
  return english.replace(/^THE\s+/i, '').trim()
}

function canonicalizeBeForms(value) {
  return value
    .replace(/\bi\s*'\s*m\b/g, 'i am')
    .replace(/\byou\s*'\s*re\b/g, 'you are')
    .replace(/\bhe\s*'\s*s\b/g, 'he is')
    .replace(/\bshe\s*'\s*s\b/g, 'she is')
    .replace(/\bit\s*'\s*s\b/g, 'it is')
    .replace(/\bwe\s*'\s*re\b/g, 'we are')
    .replace(/\bthey\s*'\s*re\b/g, 'they are')
    .replace(/\baren\s*'\s*t\b/g, 'are not')
    .replace(/\bis\s*'\s*t\b/g, 'is not')
}

function normalizeAnswer(value) {
  const normalizedBase = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıİ]/g, 'i')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  return canonicalizeBeForms(normalizedBase)
    .replace(/[^a-z0-9' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshteinDistance(a, b) {
  if (a === b) {
    return 0
  }

  const rows = a.length + 1
  const cols = b.length + 1
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0))

  for (let i = 0; i < rows; i += 1) {
    dp[i][0] = i
  }
  for (let j = 0; j < cols; j += 1) {
    dp[0][j] = j
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
    }
  }

  return dp[rows - 1][cols - 1]
}

function isLikelyProperNameMatch(spokenToken, targetToken) {
  if (!spokenToken || !targetToken) {
    return false
  }
  if (spokenToken === targetToken) {
    return true
  }

  const maxLength = Math.max(spokenToken.length, targetToken.length)
  if (maxLength < 3) {
    return false
  }

  if (
    (spokenToken.startsWith(targetToken) || targetToken.startsWith(spokenToken)) &&
    Math.abs(spokenToken.length - targetToken.length) <= 2
  ) {
    return true
  }

  const distance = levenshteinDistance(spokenToken, targetToken)
  if (maxLength <= 5) {
    return distance <= 1
  }
  if (maxLength <= 9) {
    return distance <= 2
  }
  return distance <= 3
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function correctSpeechTranscriptForExpected(transcriptRaw, expectedRaw) {
  const normalizedTranscript = normalizeAnswer(transcriptRaw)
  const normalizedExpected = normalizeAnswer(expectedRaw)

  if (!normalizedTranscript || !normalizedExpected) {
    return transcriptRaw
  }

  const expectedTokens = normalizedExpected.split(' ')
  const targetNameTokens = expectedTokens.filter((token) => SPEECH_PROPER_NAME_TOKENS.has(token))
  if (targetNameTokens.length === 0) {
    return transcriptRaw
  }

  let workingTranscript = normalizedTranscript
  const uniqueTargetTokens = Array.from(new Set(targetNameTokens))

  uniqueTargetTokens.forEach((targetToken) => {
    const aliases = SPEECH_PROPER_NAME_ALIASES[targetToken] ?? []
    aliases.forEach((aliasRaw) => {
      const normalizedAlias = normalizeAnswer(aliasRaw)
      if (!normalizedAlias || normalizedAlias === targetToken) {
        return
      }

      const aliasPattern = new RegExp(
        `\\b${normalizedAlias
          .split(' ')
          .map((token) => escapeRegExp(token))
          .join('\\s+')}\\b`,
        'g',
      )
      workingTranscript = workingTranscript.replace(aliasPattern, targetToken)
    })
  })

  const transcriptTokens = workingTranscript.split(' ')
  const correctedTokens = transcriptTokens.map((spokenToken) => {
    if (targetNameTokens.includes(spokenToken)) {
      return spokenToken
    }

    for (let i = 0; i < targetNameTokens.length; i += 1) {
      const targetToken = targetNameTokens[i]
      if (isLikelyProperNameMatch(spokenToken, targetToken)) {
        return targetToken
      }
    }

    return spokenToken
  })

  return correctedTokens.join(' ')
}

function extractOpenAiResponseText(payload) {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  if (typeof payload.output_text === 'string') {
    return payload.output_text
  }

  const outputItems = Array.isArray(payload.output) ? payload.output : []
  for (let i = 0; i < outputItems.length; i += 1) {
    const contentItems = Array.isArray(outputItems[i]?.content) ? outputItems[i].content : []
    for (let j = 0; j < contentItems.length; j += 1) {
      const item = contentItems[j]
      if (item?.type === 'output_text' && typeof item.text === 'string') {
        return item.text
      }
    }
  }

  return ''
}

async function refineTranscriptWithOpenAi({ transcriptRaw, expectedRaw, apiKey }) {
  const resolvedApiKey = resolveOpenAiApiKey(apiKey)
  if (!resolvedApiKey) {
    return {
      transcript: transcriptRaw,
      error: '',
      usedOpenAi: false,
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, 9000)

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resolvedApiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_TRANSCRIPT_FIX_MODEL,
        input: [
          {
            role: 'system',
            content:
              'You fix noisy speech-to-text output. Return only the corrected English sentence with no explanation.',
          },
          {
            role: 'user',
            content: `Expected sentence: ${expectedRaw}\nHeard transcript: ${transcriptRaw}\nReturn corrected sentence only.`,
          },
        ],
        max_output_tokens: 80,
      }),
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        transcript: transcriptRaw,
        error: payload?.error?.message || 'OpenAI isteği başarısız oldu.',
        usedOpenAi: true,
      }
    }

    const candidate = extractOpenAiResponseText(payload).replace(/\s+/g, ' ').trim()
    if (!candidate) {
      return {
        transcript: transcriptRaw,
        error: 'OpenAI boş yanıt döndürdü.',
        usedOpenAi: true,
      }
    }

    return {
      transcript: candidate,
      error: '',
      usedOpenAi: true,
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return {
        transcript: transcriptRaw,
        error: 'OpenAI yanıtı zaman aşımına uğradı.',
        usedOpenAi: true,
      }
    }

    return {
      transcript: transcriptRaw,
      error: 'OpenAI düzeltmesi sırasında bağlantı hatası oldu.',
      usedOpenAi: true,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function resolveSpeechTranscript({ transcriptRaw, expectedRaw, speechAssist }) {
  const locallyCorrected = correctSpeechTranscriptForExpected(transcriptRaw, expectedRaw)
  if (!speechAssist?.enabled) {
    return {
      transcript: locallyCorrected,
      error: '',
      usedOpenAi: false,
    }
  }

  const refined = await refineTranscriptWithOpenAi({
    transcriptRaw: locallyCorrected,
    expectedRaw,
    apiKey: speechAssist.apiKey,
  })

  const finalTranscript = correctSpeechTranscriptForExpected(refined.transcript, expectedRaw)
  return {
    transcript: finalTranscript || locallyCorrected,
    error: refined.error,
    usedOpenAi: refined.usedOpenAi,
  }
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

        <button type="button" className="mode-card" onClick={() => onSelect('pronounDrill')}>
          <p className="mode-index">4. Çalışma</p>
          <h2>Zamir Kalıp Alıştırma</h2>
          <p>
            Edat + zamir tablolarını sabit tekrar et, sadece isim kısmını random değiştirerek
            kalıpları oturt.
          </p>
        </button>

        <button type="button" className="mode-card" onClick={() => onSelect('prepositionPack')}>
          <p className="mode-index">5. Çalışma</p>
          <h2>Edat + Cümle Alıştırmaları</h2>
          <p>
            Geniş çeviri listesini yazma + ses modunda çalış.
          </p>
        </button>

        <button type="button" className="mode-card" onClick={() => onSelect('locationPack')}>
          <p className="mode-index">6. Çalışma</p>
          <h2>Am Is Are Alıştırması</h2>
          <p>
            Yeni verdiğin konum/zaman ağırlıklı cümle listesini aynı yazma + ses akışıyla tekrar et.
          </p>
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
  const vocabularyItems = useMemo(() => {
    return vocabularyData.map((item, index) => ({
      ...item,
      id: createVocabularyWordId(item, index),
    }))
  }, [])

  const vocabularyById = useMemo(() => {
    const map = new Map()
    vocabularyItems.forEach((item) => {
      map.set(item.id, item)
    })
    return map
  }, [vocabularyItems])

  const { current, total, index, goNext, goPrev, reshuffle } = useShuffledDeck(vocabularyItems)
  const { memoryMap, setStatus, resetAll } = useVocabularyMemory()

  const [studyView, setStudyView] = useState('classic')
  const [memoryPanel, setMemoryPanel] = useState('cards')
  const [memoryFilter, setMemoryFilter] = useState('all')
  const [memoryQueue, setMemoryQueue] = useState(() => shuffleArray(vocabularyItems.map((item) => item.id)))
  const [memoryHistory, setMemoryHistory] = useState([])
  const [reviewSearch, setReviewSearch] = useState('')
  const [dragX, setDragX] = useState(0)

  const dragStartRef = useRef(null)
  const dragOffsetRef = useRef(0)

  function getWordStatus(wordId) {
    return memoryMap[wordId]?.status ?? 'new'
  }

  function matchesMemoryFilter(status, filter) {
    if (filter === 'new') {
      return status === 'new'
    }
    if (filter === 'learning') {
      return status === 'learning'
    }
    if (filter === 'mastered') {
      return status === 'mastered'
    }
    return true
  }

  function buildQueue(filter = memoryFilter) {
    return shuffleArray(
      vocabularyItems
        .filter((item) => matchesMemoryFilter(getWordStatus(item.id), filter))
        .map((item) => item.id),
    )
  }

  function resetMemoryQueue(filter = memoryFilter) {
    setMemoryQueue(buildQueue(filter))
    setDragX(0)
    dragOffsetRef.current = 0
  }

  function handleMemoryFilterChange(nextFilter) {
    setMemoryFilter(nextFilter)
    resetMemoryQueue(nextFilter)
  }

  const memoryCounts = vocabularyItems.reduce(
    (counts, item) => {
      counts[getWordStatus(item.id)] += 1
      return counts
    },
    { new: 0, learning: 0, mastered: 0 },
  )

  const filteredQueue = memoryQueue.filter((wordId) =>
    matchesMemoryFilter(getWordStatus(wordId), memoryFilter),
  )

  const memoryCurrentWord = filteredQueue.length > 0 ? vocabularyById.get(filteredQueue[0]) : null

  const learningWords = vocabularyItems.filter((item) => getWordStatus(item.id) === 'learning')

  const query = reviewSearch.trim().toLowerCase()
  const filteredLearningWords = query
    ? learningWords.filter((item) => {
        return (
          item.english.toLowerCase().includes(query) ||
          item.turkish.toLowerCase().includes(query) ||
          item.pronunciation_tr.toLowerCase().includes(query)
        )
      })
    : learningWords

  function handleMemorySwipe(nextStatus) {
    if (!memoryCurrentWord) {
      return
    }

    const wordId = memoryCurrentWord.id
    const previousStatus = getWordStatus(wordId)

    setStatus(wordId, nextStatus)
    setMemoryHistory((prev) =>
      [{ wordId, previousStatus, nextStatus }, ...prev].slice(0, 60),
    )

    setMemoryQueue((prevQueue) => {
      const withoutCurrent = prevQueue.filter((id) => id !== wordId)
      const shouldRequeue =
        (nextStatus === 'learning' && memoryFilter !== 'new') ||
        (nextStatus === 'mastered' && memoryFilter === 'mastered')
      return shouldRequeue ? [...withoutCurrent, wordId] : withoutCurrent
    })

    setDragX(0)
    dragOffsetRef.current = 0

    if (nextStatus === 'mastered') {
      onAction('next', 'vocabulary')
    } else {
      onAction('prev', 'vocabulary')
    }
  }

  function undoMemorySwipe() {
    if (memoryHistory.length === 0) {
      return
    }

    const [lastAction, ...rest] = memoryHistory
    setMemoryHistory(rest)
    setStatus(lastAction.wordId, lastAction.previousStatus)
    setMemoryQueue((prevQueue) => [lastAction.wordId, ...prevQueue.filter((id) => id !== lastAction.wordId)])
    setDragX(0)
    dragOffsetRef.current = 0
  }

  function startLearningPractice(focusWordId) {
    const learningIds = vocabularyItems
      .filter((item) => getWordStatus(item.id) === 'learning')
      .map((item) => item.id)

    if (learningIds.length === 0) {
      return
    }

    const orderedQueue = focusWordId
      ? [focusWordId, ...shuffleArray(learningIds.filter((wordId) => wordId !== focusWordId))]
      : shuffleArray(learningIds)

    setStudyView('memory')
    setMemoryPanel('cards')
    setMemoryFilter('learning')
    setMemoryQueue(orderedQueue)
    setDragX(0)
    dragOffsetRef.current = 0
  }

  function resetMemoryProgress() {
    const confirmed = window.confirm(
      'Ezberleme modundaki tüm kaydırma verilerini sıfırlamak istediğine emin misin?',
    )
    if (!confirmed) {
      return
    }

    resetAll()
    setMemoryFilter('all')
    setMemoryQueue(shuffleArray(vocabularyItems.map((item) => item.id)))
    setMemoryHistory([])
    setReviewSearch('')
    setDragX(0)
    dragOffsetRef.current = 0
  }

  function handleCardPointerDown(event) {
    if (!memoryCurrentWord) {
      return
    }
    dragStartRef.current = event.clientX
    dragOffsetRef.current = 0
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  function handleCardPointerMove(event) {
    if (dragStartRef.current === null) {
      return
    }
    const nextOffset = event.clientX - dragStartRef.current
    dragOffsetRef.current = nextOffset
    setDragX(nextOffset)
  }

  function finalizeCardSwipe(event) {
    if (dragStartRef.current === null) {
      return
    }

    if (event.currentTarget.releasePointerCapture) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        // ignore
      }
    }

    dragStartRef.current = null
    const offset = dragOffsetRef.current

    if (offset > 120) {
      handleMemorySwipe('mastered')
      return
    }
    if (offset < -120) {
      handleMemorySwipe('learning')
      return
    }

    setDragX(0)
    dragOffsetRef.current = 0
  }

  return (
    <section className="study-shell">
      <HeaderBar
        title="Kelime Çalışması"
        subtitle="Klasik kart veya kaydırmalı ezberleme modunu kullan."
        onBack={onBack}
      />

      <div className="study-mode-toggle">
        <button
          type="button"
          className={`study-toggle-btn ${studyView === 'classic' ? 'active' : ''}`}
          onClick={() => setStudyView('classic')}
        >
          Klasik Mod
        </button>
        <button
          type="button"
          className={`study-toggle-btn ${studyView === 'memory' ? 'active' : ''}`}
          onClick={() => {
            setStudyView('memory')
            setMemoryPanel('cards')
            if (memoryQueue.length === 0) {
              resetMemoryQueue(memoryFilter)
            }
          }}
        >
          Ezberleme Modu
        </button>
      </div>

      {studyView === 'classic' && (
        <>
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
        </>
      )}

      {studyView === 'memory' && (
        <div className="memory-shell">
          <article className="memory-summary-card">
            <div className="memory-counter-row">
              <span className="memory-counter new">Yeni: {memoryCounts.new}</span>
              <span className="memory-counter learning">Çalışılacak: {memoryCounts.learning}</span>
              <span className="memory-counter mastered">Öğrendim: {memoryCounts.mastered}</span>
            </div>

            <div className="memory-panel-toggle">
              <button
                type="button"
                className={`memory-mini-btn ${memoryPanel === 'cards' ? 'active' : ''}`}
                onClick={() => setMemoryPanel('cards')}
              >
                Kart Çalışması
              </button>
              <button
                type="button"
                className={`memory-mini-btn ${memoryPanel === 'review' ? 'active' : ''}`}
                onClick={() => setMemoryPanel('review')}
              >
                Çalışmak İstediklerim
              </button>
            </div>

            <div className="memory-filter-row">
              {Object.entries(MEMORY_FILTER_LABELS).map(([filterKey, label]) => (
                <button
                  key={filterKey}
                  type="button"
                  className={`memory-filter-btn ${memoryFilter === filterKey ? 'active' : ''}`}
                  onClick={() => handleMemoryFilterChange(filterKey)}
                >
                  {label}
                </button>
              ))}
            </div>
          </article>

          {memoryPanel === 'cards' && (
            <>
              <div className="memory-controls-row">
                <p className="memory-queue-info">Sıradaki kart: {filteredQueue.length}</p>
                <div className="memory-controls-actions">
                  <button type="button" className="memory-mini-btn" onClick={() => resetMemoryQueue(memoryFilter)}>
                    Yeni Kart Sırası
                  </button>
                  <button
                    type="button"
                    className="memory-mini-btn"
                    onClick={undoMemorySwipe}
                    disabled={memoryHistory.length === 0}
                  >
                    Son Kararı Geri Al
                  </button>
                </div>
              </div>

              {memoryCurrentWord ? (
                <article
                  className={`memory-card ${dragX > 40 ? 'right' : dragX < -40 ? 'left' : ''}`}
                  style={{ transform: `translateX(${dragX}px) rotate(${dragX / 28}deg)` }}
                  onPointerDown={handleCardPointerDown}
                  onPointerMove={handleCardPointerMove}
                  onPointerUp={finalizeCardSwipe}
                  onPointerCancel={finalizeCardSwipe}
                >
                  <p className="memory-swipe-hint">Sola kaydır: Çalışmak İstiyorum • Sağa kaydır: Öğrendim</p>
                  <p className="label">English</p>
                  <h2 className="english-word">{memoryCurrentWord.english}</h2>
                  <div className="divider" />

                  <div className="detail">
                    <p className="label">Türkçe Telaffuz</p>
                    <p className="value pronunciation">{memoryCurrentWord.pronunciation_tr}</p>
                  </div>
                  <div className="detail">
                    <p className="label">Türkçe Karşılık</p>
                    <p className="value meaning">{memoryCurrentWord.turkish}</p>
                  </div>

                  <div className="memory-card-actions">
                    <button
                      type="button"
                      className="memory-decision-btn left"
                      onClick={() => handleMemorySwipe('learning')}
                    >
                      ← Çalışmak İstiyorum
                    </button>
                    <button
                      type="button"
                      className="memory-decision-btn right"
                      onClick={() => handleMemorySwipe('mastered')}
                    >
                      Öğrendim →
                    </button>
                  </div>
                </article>
              ) : (
                <article className="memory-empty-card">
                  <h3>Bu filtre için kart kalmadı.</h3>
                  <p>Filtreyi değiştir, yeni sıra üret veya çalışmak istediklerini tekrar başlat.</p>
                  <div className="memory-controls-actions">
                    <button type="button" className="memory-mini-btn" onClick={() => handleMemoryFilterChange('all')}>
                      Tüm Kartlara Dön
                    </button>
                    <button
                      type="button"
                      className="memory-mini-btn"
                      onClick={() => startLearningPractice()}
                      disabled={learningWords.length === 0}
                    >
                      Çalışılacakları Çalış
                    </button>
                  </div>
                </article>
              )}
            </>
          )}

          {memoryPanel === 'review' && (
            <article className="memory-review-card">
              <div className="memory-review-head">
                <div>
                  <h3>Çalışmak İstediklerim ({learningWords.length})</h3>
                  <p>Sola kaydırdığın kelimeler burada. İstersen sadece bunları tekrar çalış.</p>
                </div>
                <button
                  type="button"
                  className="memory-mini-btn active"
                  onClick={() => startLearningPractice()}
                  disabled={learningWords.length === 0}
                >
                  Bu Listeyi Kartta Çalış
                </button>
              </div>

              <input
                type="text"
                className="profile-input memory-search-input"
                placeholder="Kelime ara..."
                value={reviewSearch}
                onChange={(event) => setReviewSearch(event.target.value)}
              />

              {filteredLearningWords.length === 0 ? (
                <p className="profile-note">Henüz çalışılacak kelime yok veya aramaya uygun sonuç bulunamadı.</p>
              ) : (
                <ul className="memory-review-list">
                  {filteredLearningWords.map((item) => (
                    <li key={item.id} className="memory-review-item">
                      <div className="memory-review-main">
                        <p className="memory-review-word">{item.english}</p>
                        <p className="memory-review-meta">
                          {item.pronunciation_tr} • {item.turkish}
                        </p>
                      </div>
                      <div className="memory-review-actions">
                        <button
                          type="button"
                          className="memory-mini-btn"
                          onClick={() => startLearningPractice(item.id)}
                        >
                          Kartta Aç
                        </button>
                        <button
                          type="button"
                          className="memory-mini-btn success"
                          onClick={() => setStatus(item.id, 'mastered')}
                        >
                          Öğrendim
                        </button>
                        <button
                          type="button"
                          className="memory-mini-btn"
                          onClick={() => setStatus(item.id, 'new')}
                        >
                          Listeden Çıkar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <button type="button" className="danger-btn" onClick={resetMemoryProgress}>
                Ezberleme Verisini Sıfırla
              </button>
            </article>
          )}
        </div>
      )}
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

function PronounDrillStudy({ onBack, onAction }) {
  const nounPool = useMemo(() => {
    const seen = new Set()
    const words = []

    vocabularyData.forEach((item) => {
      const baseWord = normalizePracticeWord(item.english)
        .toLowerCase()
        .replace(/[^a-z0-9' -]/g, '')
        .trim()

      if (!baseWord || seen.has(baseWord)) {
        return
      }

      seen.add(baseWord)
      words.push(baseWord)
    })

    return words.length > 0 ? words : ['car']
  }, [])

  const { current, total, index, goNext, goPrev, reshuffle } = useShuffledDeck(nounPool)
  const [selectedPreposition, setSelectedPreposition] = useState(PREPOSITIONS[0])

  const randomWord = current || 'car'

  return (
    <section className="study-shell">
      <HeaderBar
        title="Zamir Kalıp Alıştırma"
        subtitle="Edat + zamir tablolarını sabit tekrar et, ismi random değiştirerek pratiği artır."
        onBack={onBack}
      />

      <div className="pronoun-grid">
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
          <p className="column-title">1. Sıra · Zamir · İşi Yapan</p>
          <ul className="phrase-list">
            {SUBJECT_PRONOUNS.map((item, indexKey) => (
              <li key={`${item}-${indexKey}`}>
                <span className="word">{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="drill-column">
          <p className="column-title">2. Sıra · Zamir · Başına İş Gelen</p>
          <ul className="phrase-list">
            {OBJECT_PRONOUNS.map((item, indexKey) => (
              <li key={`${item}-${indexKey}`}>
                <span className="word">{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="drill-column">
          <p className="column-title">3. Sıra · Sıfat · Sahibiyet</p>
          <ul className="phrase-list">
            {POSSESSIVE_ADJECTIVES.map((item, indexKey) => (
              <li key={`${item}-${indexKey}`}>
                <span className="word">{item} {randomWord}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="drill-column">
          <p className="column-title">4. Sıra · Zamir · Sahibiyet</p>
          <ul className="phrase-list">
            {POSSESSIVE_PRONOUNS.map((item, indexKey) => (
              <li key={`${item}-${indexKey}`}>
                <span className="word">{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="word-card pronoun-focus-card">
        <p className="label">Rastgele İsim</p>
        <h2 className="english-word">{randomWord}</h2>
        <p className="selected-preposition">Seçili edat: {selectedPreposition}</p>

        <div className="controls compact">
          <button
            type="button"
            className="nav-btn"
            onClick={() => {
              goPrev()
              onAction('prev', 'pronounDrill')
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
              onAction('next', 'pronounDrill')
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
            onAction('shuffle', 'pronounDrill')
          }}
        >
          Yeni Rastgele Sıra
        </button>
      </article>
    </section>
  )
}

function TurkishToEnglishStudy({ onBack, onAction, translationItems, translationSmart, speechAssist }) {
  const { current: classicCurrent, total: classicTotal, index: classicIndex, goNext: goClassicNext, goPrev: goClassicPrev, reshuffle: reshuffleClassic } =
    useShuffledDeck(translationItems)
  const translationById = useMemo(() => {
    const map = new Map()
    translationItems.forEach((item) => {
      map.set(item.practiceId, item)
    })
    return map
  }, [translationItems])

  const [smartQueue, setSmartQueue] = useState(() => createInitialSmartQueue(translationItems))
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [revealAnswer, setRevealAnswer] = useState(false)
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')

  const autoNextTimerRef = useRef(null)
  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')
  const skipVoiceEvaluationRef = useRef(false)
  const questionMetricsRef = useRef({
    startedAt: 0,
    checkCount: 0,
    wrongChecks: 0,
    revealUsed: false,
    finalized: false,
  })

  const speechRecognitionSupported = Boolean(getSpeechRecognitionConstructor())
  const speechSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const smartEnabled = translationSmart.enabled

  const smartCurrentId = smartQueue.history[smartQueue.cursor]
  const smartCurrent = translationById.get(smartCurrentId) ?? translationItems[0]
  const current = smartEnabled ? smartCurrent : classicCurrent
  const total = smartEnabled ? translationItems.length : classicTotal
  const counterLabel = smartEnabled ? `Soru ${smartQueue.cursor + 1}` : `${classicIndex + 1} / ${total}`
  const currentSummary = translationSmart.getSummaryById(current?.practiceId)
  const difficultyLevel =
    currentSummary.score >= 70 ? 'high' : currentSummary.score >= 40 ? 'medium' : 'low'

  useEffect(() => {
    setSmartQueue(createInitialSmartQueue(translationItems))
  }, [translationItems])

  useEffect(() => {
    questionMetricsRef.current = {
      startedAt: getNowTimestamp(),
      checkCount: 0,
      wrongChecks: 0,
      revealUsed: false,
      finalized: false,
    }
  }, [current?.practiceId])

  function stopSpeaking() {
    if (!speechSynthesisSupported) {
      return
    }
    window.speechSynthesis.cancel()
  }

  function stopListening(skipEvaluation = false) {
    if (!recognitionRef.current) {
      setIsListening(false)
      return
    }

    skipVoiceEvaluationRef.current = skipEvaluation
    try {
      recognitionRef.current.stop()
    } catch {
      recognitionRef.current = null
      setIsListening(false)
      skipVoiceEvaluationRef.current = false
    }
  }

  function clearAutoNextTimer() {
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current)
      autoNextTimerRef.current = null
    }
    setIsAutoAdvancing(false)
  }

  function resetResult() {
    stopListening(true)
    stopSpeaking()
    clearAutoNextTimer()
    setAnswer('')
    setResult(null)
    setRevealAnswer(false)
    setVoiceStatus('')
  }

  function recordCurrentSmartAttemptIfNeeded({ force = false, responseMs } = {}) {
    if (!smartEnabled || !current?.practiceId) {
      return
    }

    const metrics = questionMetricsRef.current
    if (metrics.finalized) {
      return
    }

    const hasInteraction = metrics.checkCount > 0 || metrics.wrongChecks > 0 || metrics.revealUsed
    if (!force && !hasInteraction) {
      return
    }

    const elapsedMs = Math.max(0, Math.round(responseMs ?? getNowTimestamp() - metrics.startedAt))
    translationSmart.recordAttempt({
      phraseId: current.practiceId,
      responseMs: elapsedMs,
      wrongCount: metrics.wrongChecks,
      revealUsed: metrics.revealUsed,
    })
    metrics.finalized = true
  }

  function goNextInSmartQueue() {
    setSmartQueue((prev) => {
      if (prev.history.length === 0) {
        return createInitialSmartQueue(translationItems)
      }

      if (prev.cursor < prev.history.length - 1) {
        return {
          ...prev,
          cursor: prev.cursor + 1,
        }
      }

      const currentId = prev.history[prev.cursor]
      const recentIds = prev.history.slice(Math.max(0, prev.cursor - 4), prev.cursor + 1)
      const pickedId = translationSmart.pickNextPhraseId({
        excludeId: currentId,
        recentIds,
      })
      const nextId = pickedId ?? currentId

      return {
        history: [...prev.history, nextId],
        cursor: prev.cursor + 1,
      }
    })
  }

  function goPrevInSmartQueue() {
    setSmartQueue((prev) => {
      if (prev.cursor <= 0) {
        return prev
      }
      return {
        ...prev,
        cursor: prev.cursor - 1,
      }
    })
  }

  function reshuffleSmartQueue() {
    setSmartQueue(createInitialSmartQueue(translationItems))
  }

  function goNextWithReset() {
    recordCurrentSmartAttemptIfNeeded()
    resetResult()
    if (smartEnabled) {
      goNextInSmartQueue()
    } else {
      goClassicNext()
    }
    onAction('next', 'translation')
  }

  function goPrevWithReset() {
    recordCurrentSmartAttemptIfNeeded()
    resetResult()
    if (smartEnabled) {
      goPrevInSmartQueue()
    } else {
      goClassicPrev()
    }
    onAction('prev', 'translation')
  }

  function reshuffleWithReset() {
    recordCurrentSmartAttemptIfNeeded()
    resetResult()
    if (smartEnabled) {
      reshuffleSmartQueue()
    } else {
      reshuffleClassic()
    }
    onAction('shuffle', 'translation')
  }

  function scheduleAutoNext() {
    clearAutoNextTimer()
    setIsAutoAdvancing(true)
    autoNextTimerRef.current = setTimeout(() => {
      autoNextTimerRef.current = null
      goNextWithReset()
    }, AUTO_NEXT_DELAY_MS)
  }

  useEffect(() => {
    return () => {
      stopListening(true)
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      clearAutoNextTimer()
    }
  }, [])

  function checkAnswerWithValue(nextAnswer) {
    if (!normalizeAnswer(nextAnswer)) {
      setResult(null)
      setRevealAnswer(false)
      clearAutoNextTimer()
      return
    }

    questionMetricsRef.current.checkCount += 1
    onAction('checks', 'translation')
    const analysis = analyzeAnswer(nextAnswer, current.english)
    setResult(analysis.isMatch ? { type: 'correct', analysis } : { type: 'wrong', analysis })
    if (analysis.isMatch) {
      recordCurrentSmartAttemptIfNeeded({
        force: true,
        responseMs: getNowTimestamp() - questionMetricsRef.current.startedAt,
      })
      onAction('correct', 'translation')
      setRevealAnswer(false)
      scheduleAutoNext()
    } else {
      questionMetricsRef.current.wrongChecks += 1
      onAction('wrong', 'translation')
      clearAutoNextTimer()
    }
  }

  function checkAnswer() {
    checkAnswerWithValue(answer)
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
        recordCurrentSmartAttemptIfNeeded({
          force: true,
          responseMs: getNowTimestamp() - questionMetricsRef.current.startedAt,
        })
        onAction('correct', 'translation')
      }
      setRevealAnswer(false)
      scheduleAutoNext()
    } else {
      clearAutoNextTimer()
    }
  }

  function startListening() {
    if (!speechRecognitionSupported) {
      setVoiceStatus('Tarayıcı sesli cevap özelliğini desteklemiyor.')
      return
    }
    if (isAutoAdvancing || isListening) {
      return
    }

    const SpeechRecognition = getSpeechRecognitionConstructor()
    if (!SpeechRecognition) {
      setVoiceStatus('Tarayıcı sesli cevap özelliğini desteklemiyor.')
      return
    }

    transcriptRef.current = ''
    skipVoiceEvaluationRef.current = false

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.continuous = false

    recognition.onstart = () => {
      setIsListening(true)
      setVoiceStatus('Dinleniyor... İngilizce cevabı sesli söyle.')
    }

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((resultItem) => resultItem[0]?.transcript ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      transcriptRef.current = transcript
      setAnswer(transcript)
    }

    recognition.onerror = (event) => {
      setVoiceStatus(getSpeechRecognitionErrorMessage(event.error))
      setIsListening(false)
    }

    recognition.onend = async () => {
      const transcript = transcriptRef.current.trim()
      const skipEvaluation = skipVoiceEvaluationRef.current
      const expectedAnswer = current.english

      recognitionRef.current = null
      setIsListening(false)
      transcriptRef.current = ''
      skipVoiceEvaluationRef.current = false

      if (skipEvaluation) {
        return
      }

      if (!transcript) {
        setVoiceStatus('Ses algılanamadı. Tekrar dene.')
        return
      }

      if (speechAssist?.enabled) {
        setVoiceStatus('Ses analizi yapılıyor...')
      }

      const resolved = await resolveSpeechTranscript({
        transcriptRaw: transcript,
        expectedRaw: expectedAnswer,
        speechAssist,
      })

      if (resolved.transcript !== transcript) {
        setAnswer(resolved.transcript)
      }
      if (resolved.error) {
        setVoiceStatus(`Ses düzeltme yedek moda geçti: ${resolved.error}`)
      } else {
        setVoiceStatus('')
      }
      checkAnswerWithValue(resolved.transcript)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      setIsListening(false)
      setVoiceStatus('Mikrofon başlatılamadı. Tarayıcı iznini kontrol et.')
    }
  }

  function toggleListening() {
    if (isListening) {
      stopListening(false)
      return
    }
    startListening()
  }

  function playCorrectAnswerAudio() {
    if (!speechSynthesisSupported) {
      setVoiceStatus('Tarayıcı sesli oynatma özelliğini desteklemiyor.')
      return
    }

    stopSpeaking()
    const utterance = new SpeechSynthesisUtterance(current.english)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.onstart = () => {
      setVoiceStatus('Doğru cevap sesli oynatılıyor...')
    }
    utterance.onend = () => {
      setVoiceStatus('')
    }
    utterance.onerror = () => {
      setVoiceStatus('Sesli oynatma sırasında hata oluştu.')
    }
    window.speechSynthesis.speak(utterance)
  }

  function toggleSmartMode() {
    if (smartEnabled) {
      recordCurrentSmartAttemptIfNeeded()
    } else if (current?.practiceId) {
      setSmartQueue({
        history: [current.practiceId],
        cursor: 0,
      })
    }
    resetResult()
    translationSmart.setEnabled(!smartEnabled)
  }

  if (!current) {
    return (
      <section className="study-shell">
        <HeaderBar
          title="Türkçe → İngilizce Yazma"
          subtitle="Çalışma listesi yüklenemedi."
          onBack={onBack}
        />
      </section>
    )
  }

  return (
    <section className="study-shell">
      <HeaderBar
        title="Türkçe → İngilizce Yazma"
        subtitle="Türkçe ifadeyi gör, İngilizcesini yaz ve doğru/yanlış kontrol et."
        onBack={onBack}
      />

      <div className="translation-smart-row">
        <button
          type="button"
          className={`study-toggle-btn ${smartEnabled ? 'active' : ''}`}
          onClick={toggleSmartMode}
        >
          Akıllı Tekrar: {smartEnabled ? 'Açık' : 'Kapalı'}
        </button>
        <p className="translation-smart-note">
          Açıkken cevaplama süresi, hata sayısı ve “cevabı göster” kullanımına göre zorlandığın
          çeviriler daha sık gelir.
        </p>
      </div>

      <article className="word-card qa-card">
        <p className="label">Türkçe İfade</p>
        <h2 className="english-word">{current.turkish}</h2>

        <div className="translation-insight-row">
          <span className={`difficulty-pill ${difficultyLevel}`}>Zorluk: {currentSummary.score}/100</span>
          <span className="translation-insight-meta">
            Deneme: {currentSummary.attemptCount} • Ortalama süre:{' '}
            {formatResponseSeconds(currentSummary.avgResponseSeconds)} • Hata/deneme:{' '}
            {currentSummary.wrongPerAttempt.toFixed(2)} • Cevabı göster: %
            {Math.round(currentSummary.revealRate * 100)}
          </span>
        </div>

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

        <div className="voice-actions">
          <button
            type="button"
            className={`voice-btn ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
            disabled={isAutoAdvancing || !speechRecognitionSupported}
          >
            {isListening ? 'Dinlemeyi Durdur' : 'Mikrofonla Cevapla'}
          </button>
          <button
            type="button"
            className="voice-btn secondary"
            onClick={playCorrectAnswerAudio}
            disabled={isAutoAdvancing || !speechSynthesisSupported}
          >
            Doğru Cevabı Sesli Dinle
          </button>
        </div>

        {voiceStatus && <p className="voice-status">{voiceStatus}</p>}

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
              questionMetricsRef.current.revealUsed = true
              setRevealAnswer(true)
              onAction('reveal', 'translation')
            }}
            disabled={isAutoAdvancing}
          >
            Cevabı Göster
          </button>
        )}

        {revealAnswer && <p className="feedback neutral">Doğru cevap: {current.english}</p>}

        <p className="page-info">Kaynak sayfa: {current.source_page}</p>
      </article>

      <div className="controls">
        <button type="button" className="nav-btn" onClick={goPrevWithReset} disabled={isAutoAdvancing}>
          ← Geri
        </button>
        <span className="counter">{counterLabel}</span>
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

function SentencePairStudy({
  onBack,
  onAction,
  modeKey,
  title,
  subtitle,
  inputId,
  items,
  speechAssist,
}) {
  const { current, total, index, goNext, goPrev, reshuffle } = useShuffledDeck(items)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [revealAnswer, setRevealAnswer] = useState(false)
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [continuousMicEnabled, setContinuousMicEnabled] = useState(false)

  const autoNextTimerRef = useRef(null)
  const restartListeningTimerRef = useRef(null)
  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')
  const skipVoiceEvaluationRef = useRef(false)
  const autoAdvancingRef = useRef(false)
  const continuousMicRef = useRef(false)
  const currentPromptRef = useRef('')
  const startListeningCycleRef = useRef(null)

  const speechRecognitionSupported = Boolean(getSpeechRecognitionConstructor())
  const speechSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const counterLabel = `${index + 1} / ${total}`

  useEffect(() => {
    continuousMicRef.current = continuousMicEnabled
  }, [continuousMicEnabled])

  useEffect(() => {
    currentPromptRef.current = current ? `${current.id}-${current.turkish}-${current.english}` : ''
  }, [current])

  function setAutoAdvance(nextValue) {
    autoAdvancingRef.current = nextValue
    setIsAutoAdvancing(nextValue)
  }

  function clearListeningRestartTimer() {
    if (restartListeningTimerRef.current) {
      clearTimeout(restartListeningTimerRef.current)
      restartListeningTimerRef.current = null
    }
  }

  function stopSpeaking() {
    if (!speechSynthesisSupported) {
      return
    }
    window.speechSynthesis.cancel()
  }

  function stopListening(skipEvaluation = false) {
    clearListeningRestartTimer()
    if (!recognitionRef.current) {
      setIsListening(false)
      return
    }

    skipVoiceEvaluationRef.current = skipEvaluation
    try {
      recognitionRef.current.stop()
    } catch {
      recognitionRef.current = null
      setIsListening(false)
      skipVoiceEvaluationRef.current = false
    }
  }

  function clearAutoNextTimer() {
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current)
      autoNextTimerRef.current = null
    }
    setAutoAdvance(false)
  }

  function resetInteraction() {
    stopListening(true)
    stopSpeaking()
    clearAutoNextTimer()
    setAnswer('')
    setResult(null)
    setRevealAnswer(false)
    setVoiceStatus('')
  }

  function scheduleListeningRestart() {
    clearListeningRestartTimer()

    restartListeningTimerRef.current = setTimeout(() => {
      restartListeningTimerRef.current = null
      if (
        !continuousMicRef.current ||
        autoAdvancingRef.current ||
        recognitionRef.current ||
        !currentPromptRef.current
      ) {
        return
      }
      startListeningCycleRef.current?.()
    }, 220)
  }

  useEffect(() => {
    if (!continuousMicEnabled || isAutoAdvancing) {
      return
    }

    clearListeningRestartTimer()
    restartListeningTimerRef.current = setTimeout(() => {
      restartListeningTimerRef.current = null
      if (
        !continuousMicRef.current ||
        autoAdvancingRef.current ||
        recognitionRef.current ||
        !currentPromptRef.current
      ) {
        return
      }
      startListeningCycleRef.current?.()
    }, 220)
  }, [continuousMicEnabled, isAutoAdvancing, current?.id, current?.turkish, current?.english])

  useEffect(() => {
    return () => {
      setContinuousMicEnabled(false)
      continuousMicRef.current = false
      autoAdvancingRef.current = false
      skipVoiceEvaluationRef.current = true
      if (autoNextTimerRef.current) {
        clearTimeout(autoNextTimerRef.current)
        autoNextTimerRef.current = null
      }
      if (restartListeningTimerRef.current) {
        clearTimeout(restartListeningTimerRef.current)
        restartListeningTimerRef.current = null
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
        recognitionRef.current = null
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  function scheduleAutoNext() {
    clearAutoNextTimer()
    stopListening(true)
    setAutoAdvance(true)

    autoNextTimerRef.current = setTimeout(() => {
      autoNextTimerRef.current = null
      goNextWithReset()
    }, AUTO_NEXT_DELAY_MS)
  }

  function goNextWithReset() {
    const shouldResumeMic = continuousMicRef.current
    resetInteraction()
    goNext()
    onAction('next', modeKey)
    if (shouldResumeMic) {
      scheduleListeningRestart()
    }
  }

  function goPrevWithReset() {
    const shouldResumeMic = continuousMicRef.current
    resetInteraction()
    goPrev()
    onAction('prev', modeKey)
    if (shouldResumeMic) {
      scheduleListeningRestart()
    }
  }

  function reshuffleWithReset() {
    const shouldResumeMic = continuousMicRef.current
    resetInteraction()
    reshuffle()
    onAction('shuffle', modeKey)
    if (shouldResumeMic) {
      scheduleListeningRestart()
    }
  }

  function checkAnswerWithValue(nextAnswer) {
    if (!current) {
      return
    }

    if (!normalizeAnswer(nextAnswer)) {
      setResult(null)
      setRevealAnswer(false)
      clearAutoNextTimer()
      return
    }

    onAction('checks', modeKey)
    const analysis = analyzeAnswer(nextAnswer, current.english)
    setResult(analysis.isMatch ? { type: 'correct', analysis } : { type: 'wrong', analysis })

    if (analysis.isMatch) {
      onAction('correct', modeKey)
      setRevealAnswer(false)
      scheduleAutoNext()
    } else {
      onAction('wrong', modeKey)
      clearAutoNextTimer()
    }
  }

  function checkAnswer() {
    checkAnswerWithValue(answer)
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
        onAction('correct', modeKey)
      }
      setRevealAnswer(false)
      scheduleAutoNext()
    } else {
      clearAutoNextTimer()
    }
  }

  function startListeningCycle() {
    if (!speechRecognitionSupported || !current) {
      return
    }
    if (autoAdvancingRef.current || recognitionRef.current) {
      return
    }

    const SpeechRecognition = getSpeechRecognitionConstructor()
    if (!SpeechRecognition) {
      setVoiceStatus('Tarayıcı sesli cevap özelliğini desteklemiyor.')
      return
    }

    transcriptRef.current = ''
    skipVoiceEvaluationRef.current = false

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.continuous = false

    recognition.onstart = () => {
      setIsListening(true)
      setVoiceStatus(
        continuousMicRef.current
          ? 'Mikrofon açık. Sorular geçse de dinleme devam eder.'
          : 'Dinleniyor... İngilizce cevabı sesli söyle.',
      )
    }

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((resultItem) => resultItem[0]?.transcript ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      transcriptRef.current = transcript
      setAnswer(transcript)
    }

    recognition.onerror = (event) => {
      setVoiceStatus(getSpeechRecognitionErrorMessage(event.error))
      setIsListening(false)
      recognitionRef.current = null

      const blockedErrors = new Set(['not-allowed', 'service-not-allowed', 'audio-capture'])
      if (continuousMicRef.current && !blockedErrors.has(event.error)) {
        scheduleListeningRestart()
      }
    }

    recognition.onend = async () => {
      const transcript = transcriptRef.current.trim()
      const skipEvaluation = skipVoiceEvaluationRef.current
      const expectedAnswer = current.english

      recognitionRef.current = null
      setIsListening(false)
      transcriptRef.current = ''
      skipVoiceEvaluationRef.current = false

      if (!skipEvaluation) {
        if (!transcript) {
          if (!continuousMicRef.current) {
            setVoiceStatus('Ses algılanamadı. Tekrar dene.')
          }
        } else {
          if (speechAssist?.enabled) {
            setVoiceStatus('Ses analizi yapılıyor...')
          }

          const resolved = await resolveSpeechTranscript({
            transcriptRaw: transcript,
            expectedRaw: expectedAnswer,
            speechAssist,
          })

          if (resolved.transcript !== transcript) {
            setAnswer(resolved.transcript)
          }
          if (resolved.error) {
            setVoiceStatus(`Ses düzeltme yedek moda geçti: ${resolved.error}`)
          } else {
            setVoiceStatus('')
          }
          checkAnswerWithValue(resolved.transcript)
        }
      }

      if (continuousMicRef.current && !skipEvaluation && !autoAdvancingRef.current) {
        scheduleListeningRestart()
      }
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      setIsListening(false)
      setVoiceStatus('Mikrofon başlatılamadı. Tarayıcı iznini kontrol et.')
      setContinuousMicEnabled(false)
      continuousMicRef.current = false
    }
  }

  useEffect(() => {
    startListeningCycleRef.current = startListeningCycle
  })

  function toggleContinuousListening() {
    if (!speechRecognitionSupported) {
      setVoiceStatus('Tarayıcı sesli cevap özelliğini desteklemiyor.')
      return
    }

    if (continuousMicRef.current) {
      setContinuousMicEnabled(false)
      continuousMicRef.current = false
      stopListening(true)
      setVoiceStatus('')
      return
    }

    setContinuousMicEnabled(true)
    continuousMicRef.current = true
    scheduleListeningRestart()
  }

  function playCorrectAnswerAudio() {
    if (!speechSynthesisSupported || !current) {
      setVoiceStatus('Tarayıcı sesli oynatma özelliğini desteklemiyor.')
      return
    }

    stopSpeaking()
    const utterance = new SpeechSynthesisUtterance(current.english)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.onstart = () => {
      setVoiceStatus('Doğru cevap sesli oynatılıyor...')
    }
    utterance.onend = () => {
      if (continuousMicRef.current) {
        setVoiceStatus('Mikrofon açık. Sorular geçse de dinleme devam eder.')
      } else {
        setVoiceStatus('')
      }
    }
    utterance.onerror = () => {
      setVoiceStatus('Sesli oynatma sırasında hata oluştu.')
    }
    window.speechSynthesis.speak(utterance)
  }

  if (!current && total === 0) {
    return (
      <section className="study-shell">
        <HeaderBar title={title} subtitle={subtitle} onBack={onBack} />
        <article className="memory-empty-card">
          <h3>Alıştırma listesi boş görünüyor.</h3>
          <p>Veri dosyasını kontrol edip tekrar deneyebilirsin.</p>
        </article>
      </section>
    )
  }

  return (
    <section className="study-shell">
      <HeaderBar title={title} subtitle={`${subtitle} Toplam: ${total}`} onBack={onBack} />

      <article className="word-card qa-card">
        <p className="label">Türkçe İfade</p>
        <h2 className="english-word">{current.turkish}</h2>

        <div className="divider" />

        <label className="label" htmlFor={inputId}>
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
            id={inputId}
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

        <div className="voice-actions">
          <button
            type="button"
            className={`voice-btn ${continuousMicEnabled || isListening ? 'listening' : ''}`}
            onClick={toggleContinuousListening}
            disabled={!speechRecognitionSupported}
          >
            {continuousMicEnabled ? 'Mikrofonu Kapat' : 'Mikrofonu Açık Tut'}
          </button>
          <button
            type="button"
            className="voice-btn secondary"
            onClick={playCorrectAnswerAudio}
            disabled={isAutoAdvancing || !speechSynthesisSupported}
          >
            Doğru Cevabı Sesli Dinle
          </button>
        </div>

        {voiceStatus && <p className="voice-status">{voiceStatus}</p>}

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
              onAction('reveal', modeKey)
            }}
            disabled={isAutoAdvancing}
          >
            Cevabı Göster
          </button>
        )}

        {revealAnswer && <p className="feedback neutral">Doğru cevap: {current.english}</p>}
      </article>

      <div className="controls">
        <button type="button" className="nav-btn" onClick={goPrevWithReset} disabled={isAutoAdvancing}>
          ← Geri
        </button>
        <span className="counter">{counterLabel}</span>
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

function PrepositionPackStudy({ onBack, onAction, speechAssist }) {
  return (
    <SentencePairStudy
      onBack={onBack}
      onAction={onAction}
      modeKey="prepositionPack"
      title="Edat + Cümle Alıştırmaları"
      subtitle="Yazma + ses modunda tüm listeyle pratik yap."
      inputId="preposition-answer-input"
      items={prepositionPlusExercisesData}
      speechAssist={speechAssist}
    />
  )
}

function LocationPackStudy({ onBack, onAction, speechAssist }) {
  return (
    <SentencePairStudy
      onBack={onBack}
      onAction={onAction}
      modeKey="locationPack"
      title="Am Is Are Alıştırması"
      subtitle="Yazma + ses modunda konum/zaman cümlelerini tekrar et."
      inputId="location-answer-input"
      items={locationTimeExercisesData}
      speechAssist={speechAssist}
    />
  )
}

function ProfilePage({
  onBack,
  stats,
  onProfileNameChange,
  onResetStats,
  hardestTranslations,
  speechAssist,
  onSpeechAssistEnabledChange,
  onSpeechAssistApiKeyChange,
}) {
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
  const hasSpeechAssistKey = Boolean(resolveOpenAiApiKey(speechAssist.apiKey))

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

      <article className="profile-card">
        <div className="section-head">
          <h2>Gelişmiş Ses Düzeltme</h2>
          <p>
            Tarayıcı ses tanıma çıktısını OpenAI ile düzeltir. Ayşe, Ankara, Ali gibi özel isimleri
            daha doğru yakalamak için kullanılabilir.
          </p>
        </div>

        <div className="study-mode-toggle">
          <button
            type="button"
            className={`study-toggle-btn ${speechAssist.enabled ? 'active' : ''}`}
            onClick={() => onSpeechAssistEnabledChange(true)}
          >
            OpenAI Düzeltme Açık
          </button>
          <button
            type="button"
            className={`study-toggle-btn ${!speechAssist.enabled ? 'active' : ''}`}
            onClick={() => onSpeechAssistEnabledChange(false)}
          >
            Kapalı
          </button>
        </div>

        <label className="label" htmlFor="openai-api-key">
          OpenAI API Key
        </label>
        <input
          id="openai-api-key"
          className="profile-input"
          type="password"
          value={speechAssist.apiKey}
          onChange={(event) => onSpeechAssistApiKeyChange(event.target.value)}
          placeholder="sk-..."
          autoComplete="off"
          spellCheck="false"
        />

        <div className="profile-inline-actions">
          <button
            type="button"
            className="voice-btn secondary"
            onClick={() => onSpeechAssistApiKeyChange('')}
          >
            Anahtarı Temizle
          </button>
        </div>

        <p className="profile-note">
          Bu özellik OpenAI API kullandığı için ücretlidir. Maliyet kullanım miktarına göre oluşur.
        </p>
        {speechAssist.enabled && !hasSpeechAssistKey && (
          <p className="profile-note warning">
            Açık kullanmak için API key girmen gerekiyor. Key yoksa sistem mevcut ücretsiz tanıma ile devam eder.
          </p>
        )}
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
          <h2>En Çok Zorlandığın Çeviriler</h2>
          <p>Akıllı çeviri skoruna göre daha fazla tekrar edilmesi gereken ifadeler.</p>
        </div>
        {hardestTranslations.length === 0 ? (
          <p className="profile-note">Henüz akıllı çeviri verisi oluşmadı. Translation modunda birkaç deneme yap.</p>
        ) : (
          <div className="daily-table-wrap">
            <table className="daily-table difficult-table">
              <thead>
                <tr>
                  <th>Türkçe</th>
                  <th>İngilizce</th>
                  <th>Zorluk</th>
                  <th>Ortalama Süre</th>
                  <th>Hata/Deneme</th>
                  <th>Cevabı Göster</th>
                </tr>
              </thead>
              <tbody>
                {hardestTranslations.map((item) => (
                  <tr key={item.practiceId}>
                    <td>{item.turkish}</td>
                    <td>{item.english}</td>
                    <td>
                      <span className="difficulty-pill table">{item.score}/100</span>
                    </td>
                    <td>{formatResponseSeconds(item.avgResponseSeconds)}</td>
                    <td>{item.wrongPerAttempt.toFixed(2)}</td>
                    <td>%{Math.round(item.revealRate * 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
  const translationItems = useMemo(() => {
    return phrasePracticeData.map((item, index) => ({
      ...item,
      practiceId: createPhrasePracticeId(item, index),
    }))
  }, [])
  const translationSmart = useTranslationSmart(translationItems)
  const speechAssist = useSpeechAssistSettings()
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
        {mode === 'translation' && (
          <TurkishToEnglishStudy
            onBack={goBack}
            onAction={trackAction}
            translationItems={translationItems}
            translationSmart={translationSmart}
            speechAssist={speechAssist}
          />
        )}
        {mode === 'pronounDrill' && <PronounDrillStudy onBack={goBack} onAction={trackAction} />}
        {mode === 'prepositionPack' && (
          <PrepositionPackStudy onBack={goBack} onAction={trackAction} speechAssist={speechAssist} />
        )}
        {mode === 'locationPack' && (
          <LocationPackStudy onBack={goBack} onAction={trackAction} speechAssist={speechAssist} />
        )}
        {mode === 'profile' && (
          <ProfilePage
            onBack={goBack}
            stats={stats}
            onProfileNameChange={updateProfileName}
            onResetStats={resetStats}
            hardestTranslations={translationSmart.hardestPhrases}
            speechAssist={speechAssist}
            onSpeechAssistEnabledChange={speechAssist.setEnabled}
            onSpeechAssistApiKeyChange={speechAssist.setApiKey}
          />
        )}
      </div>
    </main>
  )
}

export default App
