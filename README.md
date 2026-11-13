# StudyTrack — Syllabus Checklist for Students

Paste a syllabus copy → it is split into topics → tick topics off → live % completed, topics still to cover, days left, and topics/day needed to hit the deadline.

## Run
```bash
npm install
npm run build     # builds frontend into dist/
npm start         # API + app at http://localhost:4000
```
Dev mode (hot reload): `npm run dev` → http://localhost:5173

**Demo login:** `demo@study.track` / `demo123` (pre-filled on the sign-in screen)

## Features
- **Auth** — JWT register/login (bcrypt-hashed passwords), protected routes, 7-day sessions
- **Syllabus parser** — paste text or upload `.txt/.md`; `Unit/Module/Chapter` lines become sections, bullets/numbering are stripped, duplicates removed, long lists split. Preview & remove topics before creating.
- **Full CRUD** — checklists (create blank / import, edit title/subject/deadline, delete) and topics (add, edit title/section/notes, delete, toggle)
- **Progress engine** — per-checklist & overall % completed, topics remaining, deadline countdown / overdue state, pace guidance (topics/day needed)
- **Dashboard + sidebar** — stats cards, progress ring per checklist, search across checklists & topics, Completed view
- **UX polish** — optimistic topic toggles (rollback + toast on failure), skeleton loading, empty states, toasts, responsive layout with collapsible mobile sidebar
- **Persistence** — JSON database at `data/db.json` (auto-seeded with 3 realistic checklists for the demo user; new accounts get a starter checklist)

## API (all `/api`, Bearer JWT except auth)
`POST /auth/register|login`, `GET /auth/me`, `GET|POST /checklists`, `GET|PUT|DELETE /checklists/:id`, `POST /checklists/:id/topics`, `PUT|DELETE /checklists/:id/topics/:topicId`, `PATCH .../toggle`, `POST /parse`, `POST /import`, `GET /health`
