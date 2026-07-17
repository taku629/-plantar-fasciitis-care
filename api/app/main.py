"""足底腱膜炎ケア手帳 API — 匿名テレメトリ収集 + 最新情報フィード."""
import json
import sqlite3
import time
import urllib.request
import urllib.parse
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB = Path(__file__).parent / "telemetry.db"
FEED_CACHE_TTL = 6 * 3600

app = FastAPI(title="足底腱膜炎ケア手帳 API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def db():
    conn = sqlite3.connect(DB)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS daily (
            anon_id TEXT NOT NULL,
            date TEXT NOT NULL,
            morning_pain INTEGER,
            evening_pain INTEGER,
            steps INTEGER,
            standing TEXT,
            shoes TEXT,
            ex_done INTEGER,
            ex_total INTEGER,
            PRIMARY KEY (anon_id, date)
        )"""
    )
    return conn


class DailyStat(BaseModel):
    anon_id: str = Field(min_length=8, max_length=64)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    morning_pain: int | None = Field(default=None, ge=0, le=10)
    evening_pain: int | None = Field(default=None, ge=0, le=10)
    steps: int | None = Field(default=None, ge=0, le=200000)
    standing: str | None = None
    shoes: list[str] = []
    ex_done: int = Field(default=0, ge=0)
    ex_total: int = Field(default=0, ge=0)


@app.post("/telemetry")
def post_telemetry(stat: DailyStat):
    conn = db()
    with conn:
        conn.execute(
            """INSERT OR REPLACE INTO daily
               (anon_id, date, morning_pain, evening_pain, steps, standing, shoes, ex_done, ex_total)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                stat.anon_id, stat.date, stat.morning_pain, stat.evening_pain,
                stat.steps, stat.standing, json.dumps(stat.shoes, ensure_ascii=False),
                stat.ex_done, stat.ex_total,
            ),
        )
    conn.close()
    return {"ok": True}


@app.get("/insights")
def insights():
    """Anonymous population-level aggregates — the app's 'learning' view."""
    conn = db()
    users = conn.execute("SELECT COUNT(DISTINCT anon_id) FROM daily").fetchone()[0]
    avg_m = conn.execute(
        "SELECT AVG(morning_pain) FROM daily WHERE morning_pain IS NOT NULL"
    ).fetchone()[0]
    shoe_pain: dict[str, list[float]] = {}
    for shoes_json, pain in conn.execute(
        "SELECT shoes, morning_pain FROM daily WHERE morning_pain IS NOT NULL"
    ):
        for s in json.loads(shoes_json or "[]"):
            shoe_pain.setdefault(s, []).append(pain)
    conn.close()
    shoe_stats = [
        {"shoe": s, "n": len(v), "avg_pain": round(sum(v) / len(v), 2)}
        for s, v in sorted(shoe_pain.items(), key=lambda x: -len(x[1]))[:5]
    ]
    return {
        "users": users,
        "avg_morning_pain": round(avg_m, 2) if avg_m is not None else None,
        "shoe_stats": shoe_stats,
    }


# ---------- feed ----------
CURATED = [
    {
        "title": "朝イチストレッチが効く理由",
        "summary": "睡眠中に足底筋膜は縮みます。起きてすぐ足をつく前にストレッチすると、つっぱり感と痛みを抑えられます。",
        "url": "",
        "source": "ケア手帳 編集",
        "kind": "tip",
    },
    {
        "title": "高負荷ストレッチ(ヒールレイズ)の研究",
        "summary": "段差でのヒールレイズを週3回行うプログラムで、3ヶ月後の痛み改善がストレッチのみより大きかった報告があります(Rathleffら 2015)。",
        "url": "https://pubmed.ncbi.nlm.nih.gov/25145882/",
        "source": "研究紹介",
        "kind": "tip",
    },
    {
        "title": "靴とインソール",
        "summary": "土踏まずを支えるインソールやクッション性のある靴は痛み軽減に有効とされています。薄い靴・裸足は避けましょう。",
        "url": "",
        "source": "ケア手帳 編集",
        "kind": "tip",
    },
]

_feed_cache = {"at": 0.0, "items": []}


def pubmed_items(limit=5):
    q = urllib.parse.quote("plantar fasciitis")
    try:
        req = urllib.request.Request(
            f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={q}&sort=pubdate&retmax={limit}&retmode=json",
            headers={"User-Agent": "sokutei-care-app/1.0"},
        )
        ids = json.loads(urllib.request.urlopen(req, timeout=10).read())["esearchresult"]["idlist"]
        if not ids:
            return []
        req = urllib.request.Request(
            f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={','.join(ids)}&retmode=json",
            headers={"User-Agent": "sokutei-care-app/1.0"},
        )
        data = json.loads(urllib.request.urlopen(req, timeout=10).read())["result"]
        out = []
        for pmid in ids:
            r = data.get(pmid, {})
            out.append({
                "title": r.get("title", "").rstrip("."),
                "summary": (r.get("source") or "") + " " + (r.get("pubdate") or ""),
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                "source": "PubMed 最新論文",
                "kind": "research",
            })
        return out
    except Exception:
        return []


@app.get("/feed")
def feed():
    if time.time() - _feed_cache["at"] < FEED_CACHE_TTL and _feed_cache["items"]:
        return {"items": _feed_cache["items"]}
    items = CURATED + pubmed_items()
    _feed_cache.update(at=time.time(), items=items)
    return {"items": items}


@app.get("/")
def root():
    return {"ok": True, "service": "sokutei-care-api"}
