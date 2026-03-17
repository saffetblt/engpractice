import { useEffect, useRef, useState } from 'react'
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
      </div>
    </section>
  )
}

function HeaderBar({ title, subtitle, onHome }) {
  return (
    <header className="topbar">
      <button type="button" className="back-btn" onClick={onHome}>
        ← Ana Sayfa
      </button>
      <div className="title-wrap">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  )
}

function VocabularyStudy({ onHome }) {
  const { current, total, index, goNext, goPrev, reshuffle } = useShuffledDeck(vocabularyData)

  return (
    <section className="study-shell">
      <HeaderBar
        title="Kelime Çalışması"
        subtitle="Rastgele gelen kelimeyi incele ve tekrar et."
        onHome={onHome}
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
        <button type="button" className="nav-btn" onClick={goPrev}>
          ← Geri
        </button>
        <span className="counter">
          {index + 1} / {total}
        </span>
        <button type="button" className="nav-btn" onClick={goNext}>
          İleri →
        </button>
      </div>

      <button type="button" className="shuffle-btn" onClick={reshuffle}>
        Yeni Rastgele Sıra
      </button>
    </section>
  )
}

function PhraseDrillStudy({ onHome }) {
  const { current, total, index, goNext, goPrev, reshuffle } = useShuffledDeck(vocabularyData)
  const [selectedPreposition, setSelectedPreposition] = useState(PREPOSITIONS[0])

  const baseWord = normalizePracticeWord(current.english)

  return (
    <section className="study-shell">
      <HeaderBar
        title="Ağız Alıştırma"
        subtitle="Kalıpları sabit tekrar et, ardından kelimeyi sen ekleyerek sesli söyle."
        onHome={onHome}
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
            <button type="button" className="nav-btn" onClick={goPrev}>
              ← Geri
            </button>
            <span className="counter">
              {index + 1} / {total}
            </span>
            <button type="button" className="nav-btn" onClick={goNext}>
              İleri →
            </button>
          </div>

          <button type="button" className="shuffle-btn" onClick={reshuffle}>
            Yeni Rastgele Sıra
          </button>
        </article>
      </div>
    </section>
  )
}

function TurkishToEnglishStudy({ onHome }) {
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
  }

  function goPrevWithReset() {
    resetResult()
    goPrev()
  }

  function reshuffleWithReset() {
    resetResult()
    reshuffle()
  }

  function checkAnswer() {
    if (!normalizeAnswer(answer)) {
      setResult(null)
      setRevealAnswer(false)
      clearAutoNextTimer()
      return
    }

    const analysis = analyzeAnswer(answer, current.english)
    setResult(analysis.isMatch ? { type: 'correct', analysis } : { type: 'wrong', analysis })
    if (analysis.isMatch) {
      setRevealAnswer(false)
      scheduleAutoNext()
    } else {
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
        onHome={onHome}
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
            onClick={() => setRevealAnswer(true)}
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

function App() {
  const [mode, setMode] = useState('home')

  return (
    <main className="page">
      <div className="ambient" />

      <div className="app-shell">
        {mode === 'home' && <HomePage onSelect={setMode} />}
        {mode === 'vocabulary' && <VocabularyStudy onHome={() => setMode('home')} />}
        {mode === 'drill' && <PhraseDrillStudy onHome={() => setMode('home')} />}
        {mode === 'translation' && <TurkishToEnglishStudy onHome={() => setMode('home')} />}
      </div>
    </main>
  )
}

export default App
