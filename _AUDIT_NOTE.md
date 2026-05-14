# Audit Apply Note — AiPersonalizedTutor

Source: `_AUDIT/reports/batch_06.md` section 16.

## Discrepancy with Audit
The audit reported "0 routes and 0 AI endpoints" but `backend/src/index.js` is a 3940-line app with **162 endpoints**, including AI features:
- `POST /api/ai/ask`
- `POST /api/ai/stream-chat`
- `POST /api/learning-style/ai-assess`
- `POST /api/quiz-generator/generate`
- `POST /api/concept-explainer/explain`
- `POST /api/flashcard-generator/generate`
- (Many more)

This is a substantive project, not a skeleton.

## Original Recommendations
Audit listed: adaptive quiz engine, parent insights, content recommendation, automated tutoring, progress prediction.
Most are already implemented: quiz-generator, concept-explainer, flashcard-generator, ai/ask streaming chat, learning-style assess, and learning paths persistence.

## Implemented (this pass)
None. Substantive project per the apply guideline; AI surface is already large.

## Backlog
| Item | Tag |
|---|---|
| `/ai/progress-predict` (forward-looking exam outcome) | MECHANICAL |
| `/ai/learning-style-content-recommend` | MECHANICAL |
| Parent dashboard insights (server-rendered) | NEEDS-PRODUCT-DECISION |
| External LMS integration (Canvas, Schoology) | NEEDS-CREDS |
| Mobile push notifications | NEEDS-CREDS |
| Voice-tutor real-time streaming | NEEDS-PRODUCT-DECISION |

## Apply pass 3 (frontend)

- **Status:** FE already wired — no changes.
- **Stack:** Vite + React + Tailwind (single-file `App.jsx`, 5809 lines).
- **Verification:** `App.jsx` includes pages/components for `LearningStyleDetector` (`/learning-style/ai-assess`, `/learning-style/analyze`), `QuizGenerator` (`/quiz-generator/generate`), `ConceptExplainer` (`/concept-explainer/explain`), `FlashcardGenerator` (`/flashcard-generator/generate`), and an AI chat hitting `/ai/ask`. Each is wrapped with `ProtectedRoute`; `apiFetch` helper attaches JWT bearer from `localStorage`.
- **No FE changes made** (idempotence rule).

## Apply pass 4 (mechanical backlog)

Implemented backlog item `/ai/learning-style-content-recommend` (MECHANICAL).

**Skipped** backlog item `/ai/progress-predict` — already covered by `POST /api/progress-predictor/predict` (line 1902 in `backend/src/index.js`) with FE page `ProgressPredictor`. Adding `/ai/progress-predict` would duplicate working code.

**Backend** (`backend/src/index.js`):
- `POST /api/ai/learning-style-content-recommend` — accepts `{ subject, topic?, difficulty?, content_kinds?, dominant_style?, scores? }`. Looks up the user's most recent row in `learning_style_results` for VARK style; falls back to body-supplied `dominant_style`/`scores`. Returns structured `{ recommendations[], study_plan[], rationale }` (videos, articles, podcasts, hands-on, quizzes, flashcards, interactive). Reuses existing `callOpenRouterAI`, `authenticateToken`, and `pool`. Path is covered by the existing `AI_PATH_PREFIXES` rate limit. Returns 503 when `OPENROUTER_API_KEY` is unset; 400 if `subject` missing or no learning style is on file and none was provided in the body.

**Frontend** (Vite + React + Tailwind):
- `frontend/src/pages/LearningStyleContentRecommend.jsx` — new self-contained page using a local `apiFetch` (so 503 surfaces, unlike the global helper that swallows non-ok responses). Matches existing Tailwind styling. JWT bearer from `localStorage.getItem('token')`. Explicit 503 handling.
- `frontend/src/App.jsx` — registered `/learning-style-recommendations` behind `ProtectedRoute` and added a sidebar entry "Style-Tailored Content" right after the existing Learning Style item.

**Smoke test (with `OPENROUTER_API_KEY=""`):**
- pkill → start backend on 3502 → `GET /api/health` → 200 (`{"status":"ok"}`).
- `POST /api/auth/register smoke4@tutor.com` → token returned.
- `POST /api/ai/learning-style-content-recommend` (Bearer, body `{subject, topic, dominant_style:"visual"}`) → HTTP 503 with `{ error: "AI not configured: OPENROUTER_API_KEY is missing" }`.
- Cleanup → port clear.

**Backlog still deferred:** Parent dashboard insights, LMS integration, mobile push, voice tutor (NEEDS-PRODUCT-DECISION / NEEDS-CREDS).
