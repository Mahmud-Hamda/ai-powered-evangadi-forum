# Contributing to AI-Powered Evangadi Forum

This guide covers everything you need to start contributing: local setup, branch conventions, code style, and how to open a pull request.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Local Setup](#local-setup)
3. [Project Structure](#project-structure)
4. [Branch & Commit Conventions](#branch--commit-conventions)
5. [Backend Conventions](#backend-conventions)
6. [Frontend Conventions](#frontend-conventions)
7. [Shared Files — Coordination Required](#shared-files--coordination-required)
8. [Opening a Pull Request](#opening-a-pull-request)
9. [PR Checklist](#pr-checklist)

---

## Tech Stack

| Layer           | Technology                       |
| --------------- | -------------------------------- |
| Backend runtime | Node.js (ESM), Express 5         |
| Database        | MySQL 2                          |
| Auth            | JWT (`jsonwebtoken`), `bcryptjs` |
| Validation      | `express-validator`              |
| AI / Embeddings | Google Gemini (`@google/genai`)  |
| PDF processing  | `pdf-parse`, `multer`            |
| Frontend        | React 19, Vite, React Router v7  |
| HTTP client     | Axios                            |
| Animations      | Framer Motion                    |
| Frontend tests  | Vitest + Testing Library         |

---

## Local Setup

### Prerequisites

- Node.js 20+
- MySQL running locally
- A Google Gemini API key

### 1. Clone and install

```bash
git clone <repo-url>
cd ai-powered-forum-project

# Backend
cd backend
npm install

# Frontend (separate terminal)
cd ../frontend
npm install
```

### 2. Configure environment variables

```bash
# In /backend — copy the example and fill in your values
cp .env.example .env
```

Required values to set in `backend/.env`:

```
PORT=3777
DB_USER=your_db_user
DB_PASS=your_db_password
DB_HOST=127.0.0.1
DB_NAME=your_db_name
JWT_SECRET=any_long_random_string
GEMINI_API_KEY=your_gemini_api_key
```

The rest of the `.env` variables have safe defaults and can be left as-is during development.

### 3. Run the servers

```bash
# Backend (from /backend)
npm run dev        # starts on http://localhost:3777

# Frontend (from /frontend)
npm run dev        # starts on http://localhost:5173
```

### 4. Verify the backend is up

```
GET http://localhost:3777/health
→ { "status": "ok", "timestamp": "..." }
```

---

## Project Structure

```
├── backend/
│   ├── index.js                        # Server entry point
│   └── src/
│       ├── api/
│       │   ├── routes.js               # Central router — mounts all feature routers
│       │   ├── auth/
│       │   │   ├── controller/
│       │   │   ├── routes/
│       │   │   ├── service/
│       │   │   └── validations/
│       │   ├── question/
│       │   │   ├── controller/
│       │   │   ├── routes/
│       │   │   ├── service/
│       │   │   └── validators/
│       │   ├── answewr/                # Note: folder name is "answewr" — keep consistent
│       │   │   ├── validation/         # Note: validation/ not validations/
│       │   │   ├── routes/
│       │   │   └── service/
│       │   └── rag/
│       │       ├── controller/
│       │       ├── routes/
│       │       └── service/
│       ├── middleware/
│       └── utils/
└── frontend/
    └── src/
        ├── App.jsx                     # Route definitions
        ├── components/                 # Shared, reusable components
        ├── contexts/                   # React context providers
        ├── pages/                      # One folder per page/route
        └── services/                   # API call wrappers, one folder per domain
            ├── core/api.client.js      # Axios instance — import this, do not create new ones
            ├── auth/auth.service.js
            ├── question/question.service.js
            ├── answer/answer.service.js
            └── rag/rag.service.js
```

---

## Branch & Commit Conventions

### Branch names

Follow the pattern from `TEAM_TASKS.md`:

```
feature/<task-id>-<short-description>
```

Examples:

```
feature/T-09-T-10-questions-core
feature/T-12-answers
feature/FE-dashboard-post-question
```

### Commit messages

```
[T-XX] Short imperative description of what this commit does
```

Examples:

```
[T-09] Implement POST /api/questions with vector embedding
[T-12] Add answer service and prevent self-answering
[FE] Build Dashboard page with keyword and semantic search
```

- One logical change per commit.
- Keep the subject line under 72 characters.
- If a commit touches multiple task IDs, list them: `[T-09][T-10]`.

---

## Backend Conventions

### Layer responsibilities

| Layer      | File              | Responsibility                                           |
| ---------- | ----------------- | -------------------------------------------------------- |
| Route      | `*.routes.js`     | Wire URL + middleware + controller. No logic.            |
| Controller | `*.controller.js` | Extract from `req`, call service, send response. No SQL. |
| Service    | `*.service.js`    | All business logic and database queries.                 |
| Validation | `*.validation.js` | `express-validator` chains + `validationErrorHandler`.   |

### Controller shape

Every controller must follow this exact pattern — no exceptions:

```js
export const exampleController = async (req, res, next) => {
  try {
    const result = await exampleService(req.body);
    res.status(StatusCodes.OK).json({ success: true, data: result });
  } catch (error) {
    next(error); // always pass to the global error handler
  }
};
```

Never call `res.status(500)` directly — throw an error and let the global `errorHandler` middleware in `src/middleware/error-handler.js` handle it.

### Custom errors

Use the helpers from `src/utils/errors/index.js`:

```js
import { NotFoundError, BadRequestError } from "../../../utils/errors/index.js";

// Throw these from service functions
throw new NotFoundError("Question not found");
throw new BadRequestError("You cannot answer your own question");
```

### Validation shape

```js
import { body } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";

export const createXyzValidation = [
  body("field").notEmpty().withMessage("Field is required"),
  // ...more rules
  validationErrorHandler, // must be last in the array
];
```

### Route registration

Every new feature router must be added to `backend/src/api/routes.js`. See the [Shared Files](#shared-files--coordination-required) section for coordination notes.

```js
// routes.js pattern
import xyzRoutes from "./xyz/routes/xyz.routes.js";
mainRouter.use("/xyz", xyzRoutes);
```

### Protected routes

Any route that requires a logged-in user must use the `authenticateUser` middleware:

```js
import { authenticateUser } from "../../../middleware/authentication.js";

router.post("/", authenticateUser, myValidation, myController);
```

After this middleware runs, `req.user` contains `{ id, email, firstName, lastName }`.

### Response format

Always return JSON in this shape:

```js
// Success
{ success: true, message: 'Optional message.', data: { ... } }

// Error (handled automatically by errorHandler)
{ msg: 'Human-readable error message' }
```

---

## Frontend Conventions

### API calls

**Always use `apiClient`** from `src/services/core/api.client.js`. Never create a new Axios instance.

```js
import { apiClient } from "../core/api.client.js";
```

The client automatically attaches the JWT token from `localStorage` to every request.

### Service files

Each domain gets one service file under `src/services/<domain>/`. A service function:

- Calls one endpoint
- Returns the useful data directly (unwraps `response.data`)
- Throws a plain `Error` with a user-readable message on failure

```js
export async function getQuestions({ search } = {}) {
  try {
    const params = search ? { q: search } : {};
    const response = await apiClient.get("/api/questions", { params });
    return response.data.data;
  } catch (error) {
    throw new Error(error.response?.data?.msg || "Failed to load questions.");
  }
}
```

### Page components

- One folder per page under `src/pages/<PageName>/`.
- Each folder contains `<PageName>.jsx` and optionally `<PageName>.module.css`.
- Pages manage their own `isLoading`, `error`, and data state.
- Always render loading, error, and empty states — never assume data is present.

```jsx
if (isLoading) return <p>Loading...</p>;
if (error) return <p>{error}</p>;
if (!data.length) return <p>No results found.</p>;
```

### Route registration

New pages must be added to `src/App.jsx`. Authenticated pages must be wrapped in `<ProtectedRoute>`.

```jsx
<Route
  path="/new-page"
  element={
    <ProtectedRoute>
      <NewPage />
    </ProtectedRoute>
  }
/>
```

### Styling

- Use CSS Modules (`*.module.css`) — no global class names.
- Import styles as `import styles from './Page.module.css'` and apply as `className={styles.container}`.

---

## Shared Files — Coordination Required

Two files will be edited by multiple people. Coordinate before merging.

### `backend/src/api/routes.js`

Person 1, 3, and 4 each add one import + one `mainRouter.use()` line. To avoid conflicts:

1. Each person adds their line on a **separate commit**.
2. The second person to merge must rebase on `main` first to pick up the first person's line.

### `frontend/src/App.jsx`

Persons 6, 7, and 4 each add new `<Route>` elements. Same rule — rebase before pushing if another person's PR has already merged.

---

## Opening a Pull Request

1. Make sure your branch is up to date:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
2. Run a quick sanity check:

   ```bash
   # Backend
   cd backend && npm run dev   # should start with no errors

   # Frontend
   cd frontend && npm run lint && npm run test
   ```

3. Push your branch and open a PR against `main`:
   ```bash
   git push origin feature/your-branch-name
   ```
4. Title format: `[T-XX] Short description`
5. In the PR body, paste the checklist below and tick each item.
6. Request a review from at least one teammate before merging.

---

## PR Checklist

Paste this into every PR description:

```markdown
- [ ] `npm run dev` starts cleanly with no errors (backend)
- [ ] All endpoints in this task tested manually in Postman (backend tasks)
- [ ] No console errors in the browser (frontend tasks)
- [ ] Loading, error, and empty states are handled (frontend tasks)
- [ ] All acceptance criteria from the task file are met
- [ ] File paths match exactly what is listed in the task file
- [ ] Branch is rebased on the latest `main`
- [ ] No `.env` files or secrets committed
```
