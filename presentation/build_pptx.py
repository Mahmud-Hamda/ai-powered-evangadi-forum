#!/usr/bin/env python3
"""Build the Evangadi Forum presentation as a .pptx using only the stdlib."""

import html
import zipfile
from pathlib import Path

EMU = 914400
SW, SH = 12192000, 6858000

OUT = Path(__file__).resolve().parent / "Evangadi-Forum.pptx"


def e(inches):
    return int(inches * EMU)


def esc(text):
    return html.escape(text, quote=False)


SECTIONS = [
    {
        "n": 1,
        "key": "request",
        "title": "How a request travels",
        "minutes": 5,
        "color": "2563EB",
        "soft": "E8F2FF",
        "ink": "1E3A8A",
        "action": "Open the library",
        "click": "Click Knowledge Base. The PDF list appears.",
        "page": "RagDocuments.jsx — loadDocuments inside the useEffect that runs once.",
        "service": "listDocuments in rag.service.js.",
        "route": "GET /api/rag/documents",
        "table": "documents",
        "show": "In api.client.js, the request interceptor reads token from localStorage and sets Authorization: Bearer.",
        "say": "The page stores the list, the service calls the route, the header carries the token, and the rows come from documents.",
    },
    {
        "n": 2,
        "key": "auth",
        "title": "Authentication",
        "minutes": 4,
        "color": "10A06E",
        "soft": "E6F8F1",
        "ink": "065F46",
        "action": "Log in",
        "click": "Submit the login form with email and password.",
        "page": "Auth.jsx — login({ email, password }).",
        "service": "login in auth.service.js. It stores token and user in localStorage.",
        "route": "POST /api/auth/login",
        "table": "users — the password column is a bcrypt hash.",
        "show": "ProtectedRoute. A later page renders only when that token exists.",
        "say": "Login checks users, returns a JWT, and every later request sends that token.",
    },
    {
        "n": 3,
        "key": "forum",
        "title": "Forum data",
        "minutes": 5,
        "color": "2563EB",
        "soft": "E8F2FF",
        "ink": "1E3A8A",
        "action": "Post a reply",
        "click": "On a thread, submit the reply form. Do not open Check draft fit.",
        "page": "QuestionDetail.jsx — handleReply.",
        "service": "postAnswer in answer.service.js. Body: { questionId, content }.",
        "route": "POST /api/answers",
        "table": "answers",
        "show": "This block is ordinary create. Stay on the reply form and the new row.",
        "say": "The thread page posts the reply, and the new row is stored in answers. The author cannot answer their own question.",
    },
    {
        "n": 4,
        "key": "ai",
        "title": "Forum AI",
        "minutes": 6,
        "color": "7C3AED",
        "soft": "F3E8FF",
        "ink": "5B21B6",
        "action": "AI Search",
        "click": "In the navbar, type at least 5 characters and click AI Search. The URL becomes /dashboard?semantic=...",
        "page": "Navbar.jsx navigates. Dashboard.jsx reads semantic and calls the service.",
        "service": "searchQuestionsSemantic in question.service.js. threshold = 0.75.",
        "route": "GET /api/questions/search?query=...",
        "table": "question_vectors",
        "show": "The query is embedded and ranked with cosine similarity against vectors saved when questions were posted.",
        "say": "Related Questions, draft coach, and Check draft fit are the other AI buttons. Do not open them.",
    },
    {
        "n": 5,
        "key": "kb",
        "title": "Knowledge Base",
        "minutes": 6,
        "color": "F59E0B",
        "soft": "FFF7E6",
        "ink": "92400E",
        "action": "Search one PDF",
        "click": "Select a PDF whose badge says ready. Type at least 3 characters and click Search. Scores and excerpts appear.",
        "page": "RagDocuments.jsx — handleSearch. Search stays disabled until status is ready.",
        "service": "searchInDocument in rag.service.js.",
        "route": "GET /api/rag/documents/:documentId/search?query=...",
        "table": "document_chunks and document_chunk_vectors",
        "show": "Upload stores the file at uploads/rag/<userId>/<uuid>.pdf and writes those chunk rows. Ask uses the same chunks, then the text model.",
        "say": "Search ranks passages from this PDF only. The page, the service, and the chunk tables are the whole path.",
    },
    {
        "n": 6,
        "key": "demo",
        "title": "Demo and close",
        "minutes": 5,
        "color": "0F766E",
        "soft": "E6FFFB",
        "ink": "115E59",
        "action": "Click the path",
        "click": "Log in, post a reply, run AI Search, open Knowledge Base, search the PDF. Stop on the scores.",
        "page": "No new page. Reuse the screens already shown.",
        "service": "No new service. Do not open extra files.",
        "route": "No new route.",
        "table": "No new table.",
        "show": "A PDF must already be uploaded, and a question must already be posted.",
        "say": "AI Search needs saved question vectors. A PDF cannot be searched until its status is ready.",
    },
]


PAGES = {
    1: [
        ("bullets", {
            "kicker": "PRESENTER 1  ·  THEORY",
            "title": "Why the page never calls MySQL",
            "bullets": [
                "The React page only keeps what the screen needs: the list, the selected id, and an error string. That is useState. A useEffect with [] runs loadDocuments once, when Knowledge Base opens.",
                "The page does not know the server URL or the token. It calls listDocuments(). The service builds the HTTP call. api.client.js adds Authorization: Bearer from localStorage.",
                "Express receives GET /api/rag/documents, reads the user from the token, and selects that user’s rows from documents. The JSON comes back. The page calls setDocuments and React draws the list.",
                "A failed request does not clear a list that was never loaded. The service throws an Error, and the page stores error.message in listError.",
            ],
        }),
        ("flow", None),
        ("code", {
            "kicker": "PRESENTER 1  ·  FRONTEND CODE",
            "title": "Page, then service",
            "lines": [
                "useEffect(() => { loadDocuments(); }, []);",
                "",
                "const loadDocuments = async () => {",
                "  const rows = await listDocuments();",
                "  setDocuments(rows);",
                "};",
                "",
                "export async function listDocuments() {",
                "  const response = await apiClient.get(",
                "    '/api/rag/documents');",
                "  return response.data.data.map(mapDocument);",
                "}",
            ],
            "caption": "RagDocuments.jsx calls the service. rag.service.js calls Axios. The page only stores the result.",
        }),
        ("code", {
            "kicker": "PRESENTER 1  ·  THE HEADER",
            "title": "What leaves the browser",
            "lines": [
                "apiClient.interceptors.request.use(config => {",
                "  const token = localStorage.getItem('token');",
                "  if (token) {",
                "    config.headers.Authorization =",
                "      `Bearer ${token}`;",
                "  }",
                "  return config;",
                "});",
                "",
                "GET http://localhost:3777/api/rag/documents",
            ],
            "caption": "Same client for every feature. Base URL is VITE_API_BASE_URL, or http://localhost:3777.",
        }),
    ],
    2: [
        ("bullets", {
            "kicker": "PRESENTER 2  ·  THEORY",
            "title": "Password, token, and the guard",
            "bullets": [
                "Register hashes the password with bcrypt before it is stored. The users table never holds the plain password. Login compares the typed password with that hash.",
                "A match returns a JWT. auth.service.js writes token and user into localStorage. The token is the session. Closing the tab does not log the user out, because localStorage stays.",
                "ProtectedRoute reads AuthContext. While the session is loading, it shows a spinner. If there is no user, it sends the browser to /auth. Forum pages render only after that check.",
                "A later API call that returns 401 clears token and user and sends the browser to /auth. Login and register are excluded, so a wrong password stays on the form.",
            ],
        }),
        ("flow", None),
        ("code", {
            "kicker": "PRESENTER 2  ·  FRONTEND CODE",
            "title": "Login stores the session",
            "lines": [
                "async function login(credentials) {",
                "  const response = await apiClient.post(",
                "    '/api/auth/login', credentials);",
                "  const { user, token } = response.data;",
                "  localStorage.setItem('token', token);",
                "  localStorage.setItem('user',",
                "    JSON.stringify(user));",
                "  return { user, token };",
                "}",
            ],
            "caption": "Auth.jsx calls login({ email, password }). The route is POST /api/auth/login. The table is users.",
        }),
        ("code", {
            "kicker": "PRESENTER 2  ·  ROUTE GUARD",
            "title": "ProtectedRoute",
            "lines": [
                "if (loading) return <Spinner />;",
                "",
                "if (!isAuthenticated) {",
                "  return <Navigate to='/auth'",
                "    state={{ from: location }} replace />;",
                "}",
                "",
                "return children;",
            ],
            "caption": "Knowledge Base, Dashboard, and a thread all sit inside this guard. No token, no page.",
        }),
    ],
    3: [
        ("bullets", {
            "kicker": "PRESENTER 3  ·  THEORY",
            "title": "A reply is ordinary create",
            "bullets": [
                "This block does not call Gemini. A thread already exists in questions. The reply is a new row in answers, linked by question id, with the signed-in user as the author.",
                "The form lives in React state. reply is the textarea. handleReply checks the length first. ANSWER_MIN is 20. A shorter reply never leaves the browser.",
                "postAnswer sends { questionId, content } to POST /api/answers. On success the page appends the created answer to the answers array, clears the box, and clears any fit result.",
                "The author of the question cannot answer their own thread. That rule is on the server. If the insert fails, the list on screen stays as it was and replyError is set.",
            ],
        }),
        ("flow", None),
        ("code", {
            "kicker": "PRESENTER 3  ·  FRONTEND CODE",
            "title": "handleReply",
            "lines": [
                "const handleReply = async event => {",
                "  event.preventDefault();",
                "  if (trimmedReply.length < ANSWER_MIN) return;",
                "  const created = await postAnswer({",
                "    questionId: question.id,",
                "    content: trimmedReply,",
                "  });",
                "  setAnswers(answers => [...answers, created]);",
                "  setReply('');",
                "};",
            ],
            "caption": "QuestionDetail.jsx. Do not click Check draft fit in this section. That button is a different AI call.",
        }),
        ("code", {
            "kicker": "PRESENTER 3  ·  SERVICE",
            "title": "postAnswer",
            "lines": [
                "export async function postAnswer({",
                "  questionId, content }) {",
                "  const response = await apiClient.post(",
                "    '/api/answers',",
                "    { questionId, content });",
                "  return response.data.data;",
                "}",
            ],
            "caption": "The service returns the new answer. The page puts it on the thread. The insert is in the answers table.",
        }),
    ],
    4: [
        ("bullets", {
            "kicker": "PRESENTER 4  ·  THEORY",
            "title": "Search by meaning, not by keywords",
            "bullets": [
                "Posting a question also embeds its text and stores the vector in question_vectors. AI Search does not write an answer. It embeds the query and ranks existing questions.",
                "Ranking uses cosine similarity. The frontend sends threshold 0.75. A thread below that score is left out. Keyword search on the same box is a different request: it uses ?q=, not ?semantic=.",
                "The navbar does not call the API. It only navigates to /dashboard?semantic=... Dashboard reads that query string and calls searchQuestionsSemantic.",
                "Related Questions, the draft coach, and Check draft fit are separate. Fit asks the text model for strong, partial, or weak. This section opens only AI Search.",
            ],
        }),
        ("flow", None),
        ("code", {
            "kicker": "PRESENTER 4  ·  FRONTEND CODE",
            "title": "Navbar, then Dashboard",
            "lines": [
                "const handleSemanticSearch = e => {",
                "  const trimmed = searchTerm.trim();",
                "  if (trimmed.length < 5) return;",
                "  navigate(`/dashboard?semantic=${",
                "    encodeURIComponent(trimmed)}`);",
                "};",
                "",
                "searchQuestionsSemantic(query, {",
                "  k: 10, threshold: 0.75 })",
                "GET /api/questions/search?query=...",
            ],
            "caption": "The query must be at least 5 characters. The service waits up to 60 seconds because embedding the query takes time.",
        }),
        ("bullets", {
            "kicker": "PRESENTER 4  ·  BACKEND",
            "title": "What the search route does",
            "bullets": [
                "GET /api/questions/search reads the query, calls Gemini’s embedding model with task type RETRIEVAL_QUERY, and loads ready rows from question_vectors.",
                "cosine similarity compares the query vector with each stored question vector. Results at or above 0.75 come back with a score. The dashboard renders that list.",
                "If no question was embedded yet, the search has nothing useful to rank. That is why the demo needs a question posted before AI Search.",
                "This path does not use document_chunks. Those tables belong to the Knowledge Base.",
            ],
        }),
    ],
    5: [
        ("bullets", {
            "kicker": "PRESENTER 5  ·  THEORY",
            "title": "A private PDF, then passages",
            "bullets": [
                "Upload saves the file on disk at uploads/rag/<userId>/<uuid>.pdf and one row in documents. The original filename is the title. The disk name is a UUID so two uploads do not overwrite each other.",
                "The server splits the text into chunks, embeds each chunk, and stores them in document_chunks and document_chunk_vectors. status becomes ready only after that work finishes. Search stays disabled until then.",
                "Semantic search embeds the user’s words and ranks chunks of the selected PDF. It returns a score and an excerpt. It does not write a paragraph.",
                "Ask uses those same top chunks, then asks the text model to answer only from them. Delete removes that user’s document. Other users never see the library.",
            ],
        }),
        ("flow", None),
        ("code", {
            "kicker": "PRESENTER 5  ·  FRONTEND CODE",
            "title": "handleSearch",
            "lines": [
                "const canUseSelected =",
                "  selected?.status === 'ready';",
                "",
                "const handleSearch = async event => {",
                "  event.preventDefault();",
                "  if (!canUseSelected || !selectedId) return;",
                "  const data = await searchInDocument(",
                "    selectedId, searchQuery.trim());",
                "  setSearchHits(data?.results || []);",
                "};",
            ],
            "caption": "The query must be at least 3 characters. searchInDocument calls GET /api/rag/documents/:documentId/search.",
        }),
        ("bullets", {
            "kicker": "PRESENTER 5  ·  BACKEND",
            "title": "From the route to the chunk tables",
            "bullets": [
                "The route checks that this user owns the document and that status is ready. It loads that document’s chunk vectors, embeds the query, and ranks with cosine similarity.",
                "The response is excerpts plus scores. The page maps them into the hit list. The PDF bytes are not sent on this request. Preview is a separate GET .../file as a blob.",
                "Ask is POST /api/rag/documents/:id/query. It reuses the same retrieval, then generateAnswer. Show that only if time remains.",
                "If the badge says failed or processing, do not click Search. The button is disabled on purpose.",
            ],
        }),
    ],
    6: [
        ("bullets", {
            "kicker": "PRESENTER 6  ·  RUN OF SHOW",
            "title": "Click only, in this order",
            "bullets": [
                "1. Log in. That stores the token. Every later request needs it.",
                "2. Open a thread and post a reply. That writes answers. Skip Check draft fit.",
                "3. Run AI Search from the navbar with at least 5 characters. Stop when the dashboard list appears.",
                "4. Open Knowledge Base, select a PDF marked ready, search it, and stop on the scores.",
            ],
        }),
        ("flow", None),
        ("bullets", {
            "kicker": "PRESENTER 6  ·  CLOSE",
            "title": "Two limits, then stop",
            "bullets": [
                "Prepare before the talk: one account that can log in, one question that already has a vector, and one PDF whose status is already ready.",
                "AI Search has nothing useful to rank until questions have rows in question_vectors. Posting the question is what creates that vector.",
                "A PDF cannot be searched while status is processing or failed. Search and Ask read document_chunks only after the upload has finished embedding.",
                "Do not open draft coach, Check draft fit, or Ask unless a question asks for them. End on the search scores.",
            ],
        }),
    ],
}


def runs(paragraphs, anchor="t", face="Calibri", before=400):
    """paragraphs: list of list of (text, size_pt, bold, color)."""
    body = [f'<a:bodyPr wrap="square" rtlCol="0" anchor="{anchor}" lIns="100000" tIns="60000" rIns="100000" bIns="60000"><a:spAutoFit/></a:bodyPr>', "<a:lstStyle/>"]
    for i, parts in enumerate(paragraphs):
        spc = "" if i == 0 else f'<a:spcBef><a:spcPts val="{before}"/></a:spcBef>'
        segs = []
        for text, size, bold, color in parts:
            b = ' b="1"' if bold else ""
            segs.append(
                "<a:r>"
                f'<a:rPr lang="en-US" sz="{int(size * 100)}" dirty="0"{b}>'
                f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill>'
                f'<a:latin typeface="{face}"/>'
                "</a:rPr>"
                f"<a:t>{esc(text)}</a:t>"
                "</a:r>"
            )
        body.append(f"<a:p><a:pPr>{spc}</a:pPr>{''.join(segs)}</a:p>")
    return "<p:txBody>" + "".join(body) + "</p:txBody>"


def shape(sid, name, x, y, w, h, fill, paragraphs, anchor="t", geom="rect", link=None, face="Calibri", before=400):
    hlink = ""
    if link:
        hlink = f'<a:hlinkClick r:id="{link}"/>'
    nv = (
        "<p:nvSpPr>"
        f'<p:cNvPr id="{sid}" name="{esc(name)}">{hlink}</p:cNvPr>'
        "<p:cNvSpPr/><p:nvPr/>"
        "</p:nvSpPr>"
    )
    sp = (
        "<p:spPr>"
        "<a:xfrm>"
        f'<a:off x="{x}" y="{y}"/>'
        f'<a:ext cx="{w}" cy="{h}"/>'
        "</a:xfrm>"
        f'<a:prstGeom prst="{geom}"><a:avLst/></a:prstGeom>'
        f'<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>'
        "<a:ln><a:noFill/></a:ln>"
        "</p:spPr>"
    )
    return "<p:sp>" + nv + sp + runs(paragraphs, anchor, face, before) + "</p:sp>"


def slide_xml(shapes):
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        "<p:cSld><p:spTree>"
        '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
        '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
        '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
        + "".join(shapes)
        + "</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>"
    )


def team_slide():
    shapes = []
    sid = 2
    shapes.append(shape(sid, "header", 0, 0, SW, e(1.45), "0D172A", [
        [("Meet the Team", 32, True, "FFFFFF")],
        [("6 sections  ·  31 minutes", 16, False, "94A3B8")],
    ], anchor="ctr"))
    sid += 1
    gap = e(0.12)
    margin = e(0.28)
    top = e(1.68)
    card_w = int((SW - margin * 2 - gap * 5) / 6)
    card_h = e(5.45)
    for i, sec in enumerate(SECTIONS):
        x = margin + i * (card_w + gap)
        shapes.append(shape(sid, f"card{i}", x, top, card_w, card_h, sec["soft"], []))
        sid += 1
        shapes.append(shape(sid, f"bar{i}", x, top, card_w, e(0.42), sec["color"], [
            [(f"Presenter {sec['n']}", 12, True, "FFFFFF")],
        ], anchor="ctr", link="rIdTeam"))
        sid += 1
        # circle
        d = e(0.72)
        cx = x + (card_w - d) // 2
        shapes.append(shape(sid, f"dot{i}", cx, top + e(0.85), d, d, sec["color"], [], geom="ellipse"))
        sid += 1
        shapes.append(shape(sid, f"label{i}", x + e(0.08), top + e(1.85), card_w - e(0.16), e(2.3), sec["soft"], [
            [(sec["title"], 16, True, sec["ink"])],
            [(sec["action"], 13, False, "334155")],
            [(f"{sec['minutes']} min", 12, True, sec["color"])],
        ], anchor="t", link="rIdTeam"))
        sid += 1
    return slide_xml(shapes)


def divider_slide(sec):
    shapes = []
    shapes.append(shape(2, "bg", 0, 0, SW, SH, "0D172A", []))
    shapes.append(shape(3, "rail", 0, 0, e(0.18), SH, sec["color"], []))
    shapes.append(shape(4, "badge", e(0.7), e(1.55), e(1.7), e(0.42), sec["color"], [
        [(f"SECTION {sec['n']:02d}", 12, True, "FFFFFF")],
    ], anchor="ctr"))
    shapes.append(shape(5, "title", e(0.7), e(2.15), e(8.2), e(1.3), "0D172A", [
        [(sec["title"], 40, True, "FFFFFF")],
    ], anchor="b"))
    shapes.append(shape(6, "sub", e(0.7), e(3.55), e(8.2), e(0.7), "0D172A", [
        [(sec["action"], 20, False, "67E8F9")],
    ]))
    shapes.append(shape(7, "who", e(0.7), e(6.35), e(7), e(0.45), "0D172A", [
        [(f"Presenter {sec['n']}    ·    {sec['minutes']} minutes", 14, False, "94A3B8")],
    ]))
    shapes.append(shape(8, "back", e(10.3), e(0.35), e(2.6), e(0.7), sec["color"], [
        [("←  Back to Team", 14, True, "FFFFFF")],
    ], anchor="ctr", link="rIdBack"))
    shapes.append(shape(9, "block", e(10.55), e(4.55), e(2.35), e(2.15), "16324F", []))
    return slide_xml(shapes)


def detail_slide(sec):
    shapes = []
    shapes.append(shape(2, "bg", 0, 0, SW, SH, "F8FAFC", []))
    shapes.append(shape(3, "bar", 0, 0, SW, e(0.12), sec["color"], []))
    shapes.append(shape(4, "kicker", e(0.35), e(0.22), e(8), e(0.28), "F8FAFC", [
        [(f"PRESENTER {sec['n']}   ·   {sec['minutes']} MIN", 12, True, sec["color"])],
    ]))
    shapes.append(shape(5, "title", e(0.35), e(0.46), e(8.5), e(0.48), "F8FAFC", [
        [(sec["action"], 26, True, "0F172A")],
    ]))
    shapes.append(shape(6, "click", e(0.35), e(1.02), e(12.6), e(0.62), "FFFFFF", [
        [(sec["click"], 14, False, "334155")],
    ], anchor="ctr"))
    boxes = [
        ("1  Page", sec["page"]),
        ("2  Service", sec["service"]),
        ("3  Route", sec["route"]),
        ("4  Table", sec["table"]),
    ]
    margin = e(0.32)
    arrow_w = e(0.38)
    bh = e(2.35)
    y = e(1.82)
    bw = int((SW - margin * 2 - arrow_w * 3) / 4)
    sid = 7
    for i, (label, text) in enumerate(boxes):
        x = margin + i * (bw + arrow_w)
        shapes.append(shape(sid, label, x, y, bw, bh, "FFFFFF", [
            [(label, 13, True, sec["color"])],
            [(text, 12, False, "0F172A")],
        ]))
        sid += 1
        if i < 3:
            shapes.append(shape(
                sid, f"arrow{i}",
                x + bw, y + (bh - e(0.36)) // 2, arrow_w, e(0.36),
                sec["color"], [], geom="rightArrow",
            ))
            sid += 1
    shapes.append(shape(sid, "show", e(0.32), e(4.35), e(12.68), e(1.25), sec["soft"], [
        [("Show", 12, True, sec["ink"])],
        [(sec["show"], 14, False, "0F172A")],
    ]))
    sid += 1
    shapes.append(shape(sid, "say", e(0.32), e(5.75), e(12.68), e(1.4), "0D172A", [
        [("Say", 12, True, "67E8F9")],
        [(sec["say"], 15, False, "FFFFFF")],
    ]))
    return slide_xml(shapes)


def content_types(slide_count):
    overrides = [
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
        '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
        '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
        '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    ]
    for i in range(1, slide_count + 1):
        overrides.append(
            f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        + "".join(overrides)
        + "</Types>"
    )


def rels(pairs):
    body = "".join(
        f'<Relationship Id="{rid}" Type="{typ}" Target="{target}"/>'
        for rid, typ, target in pairs
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + body
        + "</Relationships>"
    )


NS_REL_SLIDE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
NS_REL_LAYOUT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"
NS_REL_MASTER = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster"
NS_REL_THEME = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme"
NS_REL_PRES = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
NS_REL_CORE = "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties"
NS_REL_EXT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties"


THEME = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Evangadi">
  <a:themeElements>
    <a:clrScheme name="Evangadi">
      <a:dk1><a:srgbClr val="0D172A"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1E293B"/></a:dk2>
      <a:lt2><a:srgbClr val="F8FAFC"/></a:lt2>
      <a:accent1><a:srgbClr val="2563EB"/></a:accent1>
      <a:accent2><a:srgbClr val="10A06E"/></a:accent2>
      <a:accent3><a:srgbClr val="7C3AED"/></a:accent3>
      <a:accent4><a:srgbClr val="F59E0B"/></a:accent4>
      <a:accent5><a:srgbClr val="0F766E"/></a:accent5>
      <a:accent6><a:srgbClr val="67E8F9"/></a:accent6>
      <a:hlink><a:srgbClr val="2563EB"/></a:hlink>
      <a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Calibri">
      <a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/>
  <a:extraClrSchemeLst/>
</a:theme>
"""

MASTER = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
  </p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>
"""

LAYOUT = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
  </p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>
"""


def presentation_xml(slide_count):
    ids = []
    for i in range(1, slide_count + 1):
        ids.append(f'<p:sldId id="{255 + i}" r:id="rId{i}"/>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst>'
        f'<p:sldIdLst>{"".join(ids)}</p:sldIdLst>'
        f'<p:sldSz cx="{SW}" cy="{SH}" type="screen16x9"/>'
        '<p:notesSz cx="6858000" cy="9144000"/>'
        "</p:presentation>"
    )


def bullet_slide(sec, kicker, title, bullets):
    shapes = [
        shape(2, "bg", 0, 0, SW, SH, "F8FAFC", []),
        shape(3, "bar", 0, 0, SW, e(0.12), sec["color"], []),
        shape(4, "kicker", e(0.4), e(0.28), e(12), e(0.32), "F8FAFC", [
            [(kicker, 12, True, sec["color"])],
        ]),
        shape(5, "title", e(0.4), e(0.58), e(12.2), e(0.55), "F8FAFC", [
            [(title, 26, True, "0F172A")],
        ]),
    ]
    sid = 6
    top = e(1.35)
    for text in bullets:
        shapes.append(shape(sid, f"b{sid}", e(0.4), top, e(12.5), e(1.15), "FFFFFF", [
            [(text, 16, False, "0F172A")],
        ], anchor="ctr"))
        sid += 1
        top += e(1.28)
    return slide_xml(shapes)


def code_slide(sec, kicker, title, lines, caption):
    shapes = [
        shape(2, "bg", 0, 0, SW, SH, "F8FAFC", []),
        shape(3, "bar", 0, 0, SW, e(0.12), sec["color"], []),
        shape(4, "kicker", e(0.4), e(0.22), e(12), e(0.28), "F8FAFC", [
            [(kicker, 12, True, sec["color"])],
        ]),
        shape(5, "title", e(0.4), e(0.48), e(12.2), e(0.42), "F8FAFC", [
            [(title, 22, True, "0F172A")],
        ]),
        shape(6, "code", e(0.4), e(1.05), e(12.5), e(5.15), "0D172A", [
            [(line, 13, False, "E2E8F0")] for line in lines
        ], anchor="t", face="Consolas", before=80),
        shape(7, "cap", e(0.4), e(6.35), e(12.5), e(0.85), sec["soft"], [
            [(caption, 14, False, sec["ink"])],
        ], anchor="ctr"),
    ]
    return slide_xml(shapes)


def build():
    slides = [team_slide()]
    divider_indexes = []
    for sec in SECTIONS:
        divider_indexes.append(len(slides) + 1)
        slides.append(divider_slide(sec))
        for kind, payload in PAGES[sec["n"]]:
            if kind == "bullets":
                slides.append(bullet_slide(sec, payload["kicker"], payload["title"], payload["bullets"]))
            elif kind == "flow":
                slides.append(detail_slide(sec))
            elif kind == "code":
                slides.append(code_slide(sec, payload["kicker"], payload["title"], payload["lines"], payload["caption"]))

    # Team card links currently all say rIdTeam. Point each presenter label/bar
    # at its divider. Rebuild team slide relationships instead of rewriting XML:
    # six cards use the same rIdTeam, so one link cannot hit six slides.
    # Regenerate team slide with per-card relationship ids.
    slides[0] = team_slide_linked(divider_indexes)

    files = {
        "[Content_Types].xml": content_types(len(slides)),
        "_rels/.rels": rels([
            ("rId1", NS_REL_PRES, "ppt/presentation.xml"),
            ("rId2", NS_REL_CORE, "docProps/core.xml"),
            ("rId3", NS_REL_EXT, "docProps/app.xml"),
        ]),
        "docProps/core.xml": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/">'
            "<dc:title>Evangadi Forum</dc:title>"
            "<dc:subject>How a request travels, auth, forum data, forum AI, knowledge base, demo</dc:subject>"
            "<dc:creator>Evangadi Forum team</dc:creator>"
            "</cp:coreProperties>"
        ),
        "docProps/app.xml": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">'
            "<Application>Evangadi Forum</Application></Properties>"
        ),
        "ppt/theme/theme1.xml": THEME,
        "ppt/slideMasters/slideMaster1.xml": MASTER,
        "ppt/slideMasters/_rels/slideMaster1.xml.rels": rels([
            ("rId1", NS_REL_LAYOUT, "../slideLayouts/slideLayout1.xml"),
            ("rId2", NS_REL_THEME, "../theme/theme1.xml"),
        ]),
        "ppt/slideLayouts/slideLayout1.xml": LAYOUT,
        "ppt/slideLayouts/_rels/slideLayout1.xml.rels": rels([
            ("rId1", NS_REL_MASTER, "../slideMasters/slideMaster1.xml"),
        ]),
        "ppt/presentation.xml": presentation_xml(len(slides)),
    }

    pres_rels = [("rIdMaster", NS_REL_MASTER, "slideMasters/slideMaster1.xml")]
    for i in range(1, len(slides) + 1):
        pres_rels.append((f"rId{i}", NS_REL_SLIDE, f"slides/slide{i}.xml"))
    files["ppt/_rels/presentation.xml.rels"] = rels(pres_rels)

    for i, xml in enumerate(slides, start=1):
        files[f"ppt/slides/slide{i}.xml"] = xml
        pairs = [("rId1", NS_REL_LAYOUT, "../slideLayouts/slideLayout1.xml")]
        if i == 1:
            for n, div in enumerate(divider_indexes, start=1):
                pairs.append((f"rIdP{n}", NS_REL_SLIDE, f"slide{div}.xml"))
        elif i in divider_indexes:
            pairs.append(("rIdBack", NS_REL_SLIDE, "slide1.xml"))
        files[f"ppt/slides/_rels/slide{i}.xml.rels"] = rels(pairs)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, data in files.items():
            zf.writestr(name, data.encode("utf-8"))
    print(OUT)


def team_slide_linked(divider_indexes):
    shapes = []
    sid = 2
    shapes.append(shape(sid, "header", 0, 0, SW, e(1.45), "0D172A", [
        [("Meet the Team", 32, True, "FFFFFF")],
        [("6 sections  ·  31 minutes", 16, False, "94A3B8")],
    ], anchor="ctr"))
    sid += 1
    gap = e(0.36)
    margin = e(0.22)
    top = e(1.68)
    card_w = int((SW - margin * 2 - gap * 5) / 6)
    card_h = e(5.45)
    for i, sec in enumerate(SECTIONS):
        link = f"rIdP{i + 1}"
        x = margin + i * (card_w + gap)
        shapes.append(shape(sid, f"card{i}", x, top, card_w, card_h, sec["soft"], [], link=link))
        sid += 1
        shapes.append(shape(sid, f"bar{i}", x, top, card_w, e(0.42), sec["color"], [
            [(f"Presenter {sec['n']}", 11, True, "FFFFFF")],
        ], anchor="ctr", link=link))
        sid += 1
        d = e(0.62)
        cx = x + (card_w - d) // 2
        shapes.append(shape(sid, f"dot{i}", cx, top + e(0.7), d, d, sec["color"], [], geom="ellipse"))
        sid += 1
        shapes.append(shape(sid, f"label{i}", x + e(0.04), top + e(1.55), card_w - e(0.08), e(3.5), sec["soft"], [
            [(sec["title"], 14, True, sec["ink"])],
            [(sec["action"], 12, False, "334155")],
            [(f"{sec['minutes']} min", 12, True, sec["color"])],
        ], anchor="t", link=link))
        sid += 1
        if i < 5:
            nxt = SECTIONS[i + 1]["color"]
            shapes.append(shape(
                sid, f"flow{i}",
                x + card_w + e(0.02), top + e(2.4), gap - e(0.04), e(0.32),
                nxt, [], geom="rightArrow",
            ))
            sid += 1
    return slide_xml(shapes)


if __name__ == "__main__":
    build()
