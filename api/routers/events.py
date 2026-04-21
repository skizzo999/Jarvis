import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime
import sqlite3, requests, re
from requests.auth import HTTPBasicAuth

from config import DB_PATH, RADICALE_PASS, RADICALE_URL, RADICALE_USER

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/events", tags=["events"])

RADICALE_AUTH = HTTPBasicAuth(RADICALE_USER, RADICALE_PASS) if RADICALE_PASS else None


def get_db():
    return sqlite3.connect(DB_PATH)

class EventIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    start: datetime
    end: datetime | None = None
    description: str | None = Field(None, max_length=1000)

class ReminderIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    remind_at: datetime

def parse_ical_value(ical_text: str, key: str) -> str:
    """Extract a value from iCal text, handling folded lines."""
    pattern = rf"^{key}[^:]*:(.+?)(?=\r?\n[^\s]|\Z)"
    match = re.search(pattern, ical_text, re.MULTILINE | re.DOTALL)
    if not match:
        return ""
    # Unfold: remove newlines followed by whitespace
    value = re.sub(r"\r?\n[ \t]", "", match.group(1)).strip()
    return value

def parse_dt(dt_str: str) -> str | None:
    """Parse iCal datetime string to ISO format."""
    dt_str = dt_str.strip()
    # Remove TZID prefix if present (e.g., TZID=Europe/Rome:20260101T100000)
    if ":" in dt_str:
        dt_str = dt_str.split(":")[-1]
    try:
        if "T" in dt_str:
            if dt_str.endswith("Z"):
                return datetime.strptime(dt_str, "%Y%m%dT%H%M%SZ").isoformat()
            else:
                return datetime.strptime(dt_str[:15], "%Y%m%dT%H%M%S").isoformat()
        else:
            return datetime.strptime(dt_str[:8], "%Y%m%d").isoformat()
    except Exception:
        return dt_str

def fetch_all_ics() -> list[dict]:
    """Fetch all events from Radicale using CalDAV REPORT."""
    body = """<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT"/>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>"""

    r = requests.request(
        "REPORT",
        RADICALE_URL,
        data=body,
        auth=RADICALE_AUTH,
        headers={"Content-Type": "application/xml; charset=utf-8", "Depth": "1"}
    )

    if r.status_code not in [200, 207]:
        return []

    # Extract calendar-data blocks from XML response
    ical_blocks = re.findall(
        r"<[^:]+:calendar-data[^>]*>(.*?)</[^:]+:calendar-data>",
        r.text,
        re.DOTALL
    )

    events = []
    for block in ical_blocks:
        # Decode XML entities
        block = block.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")

        # Extract VEVENT section
        vevent_match = re.search(r"BEGIN:VEVENT(.*?)END:VEVENT", block, re.DOTALL)
        if not vevent_match:
            continue
        vevent = vevent_match.group(0)

        uid = parse_ical_value(vevent, "UID")
        summary = parse_ical_value(vevent, "SUMMARY")
        dtstart_raw = parse_ical_value(vevent, r"DTSTART(?:;[^:]*)?")
        dtend_raw = parse_ical_value(vevent, r"DTEND(?:;[^:]*)?")
        description = parse_ical_value(vevent, "DESCRIPTION")

        if not uid or not summary:
            continue

        events.append({
            "uid": uid,
            "title": summary,
            "start": parse_dt(dtstart_raw) if dtstart_raw else None,
            "end": parse_dt(dtend_raw) if dtend_raw else None,
            "description": description or None,
        })

    # Sort by start date
    events.sort(key=lambda e: e["start"] or "")
    return events


@router.get("/list")
def list_events():
    """Return all upcoming events from Radicale CalDAV."""
    try:
        events = fetch_all_ics()
        logger.info("events/list → %d eventi", len(events))
        return events
    except Exception as e:
        logger.error("events/list fallito: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{uid}")
def delete_event(uid: str):
    """Delete an event from Radicale by UID."""
    # Sanitize uid - no path traversal, only safe iCal UID chars
    if not re.match(r"^[\w\-.@]+$", uid) or len(uid) > 200:
        raise HTTPException(status_code=400, detail="Invalid UID")

    url = RADICALE_URL + uid + ".ics"
    r = requests.delete(url, auth=RADICALE_AUTH)

    if r.status_code in [200, 204]:
        logger.info("evento eliminato uid=%s", uid)
        return {"status": "ok", "uid": uid}
    elif r.status_code == 404:
        raise HTTPException(status_code=404, detail="Event not found")
    else:
        logger.error("Radicale DELETE error uid=%s status=%d", uid, r.status_code)
        raise HTTPException(status_code=500, detail=f"Radicale error: {r.status_code}")


@router.post("/")
def create_event(event: EventIn):
    end = event.end or datetime.fromtimestamp(event.start.timestamp() + 3600)
    uid = datetime.now().strftime("%Y%m%dT%H%M%S") + "@jarvis"
    ical = f"""BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:{uid}
SUMMARY:{event.title}
DTSTART:{event.start.strftime("%Y%m%dT%H%M%S")}
DTEND:{end.strftime("%Y%m%dT%H%M%S")}
DESCRIPTION:{event.description or ""}
END:VEVENT
END:VCALENDAR"""

    requests.request("MKCOL", RADICALE_URL, auth=RADICALE_AUTH)

    r = requests.put(
        RADICALE_URL + uid + ".ics",
        data=ical,
        auth=RADICALE_AUTH,
        headers={"Content-Type": "text/calendar"}
    )
    if r.status_code not in [201, 204]:
        logger.error("Radicale PUT error uid=%s status=%d", uid, r.status_code)
        raise HTTPException(status_code=500, detail=f"Radicale error: {r.status_code}")
    logger.info("evento creato uid=%s title=%s", uid, event.title)
    return {"status": "ok", "uid": uid, "title": event.title, "start": event.start}

@router.post("/reminders")
def create_reminder(reminder: ReminderIn):
    con = get_db()
    cur = con.cursor()
    cur.execute("INSERT INTO reminders (title, remind_at) VALUES (?, ?)",
                (reminder.title, reminder.remind_at.isoformat()))
    con.commit()
    con.close()
    return {"status": "ok", "title": reminder.title, "remind_at": reminder.remind_at}

@router.get("/reminders/pending")
def get_pending_reminders():
    con = get_db()
    cur = con.cursor()
    now = datetime.now().isoformat()
    cur.execute("SELECT id, title, remind_at FROM reminders WHERE sent=0 AND remind_at <= ?", (now,))
    rows = cur.fetchall()
    con.close()
    return [{"id": r[0], "title": r[1], "remind_at": r[2]} for r in rows]

@router.post("/reminders/{reminder_id}/sent")
def mark_sent(reminder_id: int):
    con = get_db()
    cur = con.cursor()
    cur.execute("UPDATE reminders SET sent=1 WHERE id=?", (reminder_id,))
    con.commit()
    con.close()
    return {"status": "ok"}
