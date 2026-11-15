"""
Fetching and reading public web pages for the knowledge base.

Everything here goes through SafeHTTPAdapter, follows redirects by hand so each
hop is validated, and caps how much is downloaded. No Django dependency.
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Set, Tuple
from urllib import robotparser
from urllib.parse import urljoin, urlsplit, urlunsplit

import requests

from .url_safety import SafeHTTPAdapter, UnsafeURLError, validate_public_url

USER_AGENT = "OnMicroAI-KnowledgeBot/1.0"
CONNECT_TIMEOUT = 5
READ_TIMEOUT = 15
MAX_RESPONSE_BYTES = 5 * 1024 * 1024
MAX_REDIRECTS = 5

HTML_TYPES = ("text/html", "application/xhtml+xml")
PAGE_TYPES = HTML_TYPES + ("text/plain",)
XML_TYPES = ("application/xml", "text/xml", "text/plain")

# A page with less text than this is probably rendered by JavaScript.
THIN_PAGE_CHARS = 200
THIN_PAGE_WARNING = "Very little text was found. This page may need JavaScript to display its content."

MAX_SITE_PAGES = 50
MAX_SITE_DEPTH = 3
SITE_TIME_BUDGET_SECONDS = 300
CRAWL_DELAY_SECONDS = 0.3
MAX_SITEMAP_FILES = 5

SKIPPED_EXTENSIONS = (
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico", ".bmp", ".tiff",
    ".zip", ".gz", ".tar", ".rar", ".7z", ".mp3", ".mp4", ".mov", ".avi", ".wav",
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".csv", ".json", ".xml", ".rss",
    ".css", ".js", ".woff", ".woff2", ".ttf", ".exe", ".dmg",
)


class FetchError(Exception):
    """A page could not be fetched or read. The message is safe to show to users."""


@dataclass
class FetchedResponse:
    url: str
    content_type: str
    text: str


@dataclass
class Page:
    url: str
    title: str
    text: str
    links: List[str] = field(default_factory=list)


@dataclass
class SiteCrawl:
    pages: List[Page]
    failed: List[Dict[str, str]]
    truncated: bool


def new_session() -> requests.Session:
    session = requests.Session()
    # Ignore proxy settings from the environment: a proxy would do its own DNS
    # lookup and bypass the address checks.
    session.trust_env = False
    adapter = SafeHTTPAdapter(max_retries=0)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        "Accept-Language": "en;q=0.9,*;q=0.5",
    })
    return session


def fetch(url: str, session: Optional[requests.Session] = None,
          allowed_types: Tuple[str, ...] = PAGE_TYPES) -> FetchedResponse:
    """GET a public URL and return its decoded body."""
    own_session = session is None
    session = session or new_session()
    try:
        current = url
        for _ in range(MAX_REDIRECTS + 1):
            try:
                current = validate_public_url(current)
            except UnsafeURLError as exc:
                raise FetchError(str(exc))

            try:
                response = session.get(
                    current,
                    timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),
                    allow_redirects=False,
                    stream=True,
                )
            except requests.exceptions.SSLError:
                raise FetchError("The site's security certificate could not be verified.")
            except requests.exceptions.Timeout:
                raise FetchError("The site took too long to respond.")
            except requests.exceptions.RequestException:
                raise FetchError("The site could not be reached.")

            try:
                if response.is_redirect or response.is_permanent_redirect:
                    location = response.headers.get("Location")
                    if not location:
                        raise FetchError("The site returned an invalid redirect.")
                    current = urljoin(current, location)
                    continue

                if response.status_code in (401, 403):
                    raise FetchError("The site refused access to this page (it may require a login).")
                if response.status_code == 404:
                    raise FetchError("This page was not found (404).")
                if response.status_code >= 400:
                    raise FetchError("The site returned an error (HTTP %d)." % response.status_code)

                content_type = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
                if content_type not in allowed_types:
                    raise FetchError(
                        "This URL does not point to a readable web page (it is %s)."
                        % (content_type or "an unknown type")
                    )

                body = _read_capped(response)
                encoding = response.encoding or "utf-8"
                if "charset" not in response.headers.get("Content-Type", "").lower():
                    encoding = _sniff_charset(body) or "utf-8"
                try:
                    text = body.decode(encoding, errors="replace")
                except LookupError:
                    text = body.decode("utf-8", errors="replace")
                return FetchedResponse(url=current, content_type=content_type, text=text)
            finally:
                response.close()

        raise FetchError("The site redirected too many times.")
    finally:
        if own_session:
            session.close()


def _read_capped(response: requests.Response) -> bytes:
    chunks = []
    total = 0
    try:
        for chunk in response.iter_content(chunk_size=65536):
            total += len(chunk)
            if total > MAX_RESPONSE_BYTES:
                raise FetchError("This page is too large to add (over 5 MB).")
            chunks.append(chunk)
    except requests.exceptions.RequestException:
        raise FetchError("The connection was interrupted while reading the page.")
    return b"".join(chunks)


def _sniff_charset(body: bytes) -> Optional[str]:
    match = re.search(br'<meta[^>]+charset=["\']?\s*([a-zA-Z0-9_\-]+)', body[:4096], re.I)
    return match.group(1).decode("ascii", errors="ignore") if match else None


# Reading a page

def extract_page(fetched: FetchedResponse) -> Page:
    """Pull the readable text, title and links out of a fetched response."""
    if fetched.content_type == "text/plain":
        return Page(url=fetched.url, title=_fallback_title(fetched.url), text=fetched.text.strip())

    import trafilatura

    html = fetched.text
    text = trafilatura.extract(
        html,
        url=fetched.url,
        include_comments=False,
        include_tables=True,
        favor_recall=True,
    ) or ""
    if len(text.strip()) < THIN_PAGE_CHARS:
        # Main-content detection found little; fall back to all visible text.
        everything = trafilatura.html2txt(html) or ""
        if len(everything.strip()) > len(text.strip()):
            text = everything

    return Page(
        url=fetched.url,
        title=_html_title(html) or _fallback_title(fetched.url),
        text=text.strip(),
        links=_html_links(html, fetched.url),
    )


def fetch_page(url: str, session: Optional[requests.Session] = None) -> Page:
    return extract_page(fetch(url, session=session))


def _html_title(html: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    if not match:
        return ""
    from html import unescape
    return re.sub(r"\s+", " ", unescape(match.group(1))).strip()[:255]


def _fallback_title(url: str) -> str:
    parts = urlsplit(url)
    return (parts.netloc + parts.path.rstrip("/"))[:255]


def _html_links(html: str, base_url: str) -> List[str]:
    try:
        import lxml.html
        tree = lxml.html.fromstring(html)
    except Exception:
        return []
    links = []
    for href in tree.xpath("//a/@href"):
        href = (href or "").strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
            continue
        try:
            links.append(urljoin(base_url, href))
        except ValueError:
            continue
    return links


# Crawling a site

def normalize_link(url: str) -> Optional[str]:
    """Canonical form used to de-duplicate pages: no fragment, lower-case host."""
    try:
        parts = urlsplit(url)
    except ValueError:
        return None
    if parts.scheme.lower() not in ("http", "https") or not parts.netloc:
        return None
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path or "/", parts.query, ""))


def _dedupe_key(url: str) -> str:
    parts = urlsplit(url)
    host = parts.netloc[4:] if parts.netloc.startswith("www.") else parts.netloc
    return host + (parts.path.rstrip("/") or "/") + ("?" + parts.query if parts.query else "")


def _site_scope(start_url: str) -> Tuple[str, str]:
    """(host without www, path prefix) that a page must match to belong to the site."""
    parts = urlsplit(start_url)
    host = parts.netloc.lower()
    host = host[4:] if host.startswith("www.") else host
    path = parts.path or "/"
    prefix = path if path.endswith("/") else path.rsplit("/", 1)[0] + "/"
    return host, prefix


def _in_scope(url: str, scope: Tuple[str, str]) -> bool:
    parts = urlsplit(url)
    host = parts.netloc.lower()
    host = host[4:] if host.startswith("www.") else host
    path = parts.path or "/"
    if host != scope[0]:
        return False
    if path.lower().endswith(SKIPPED_EXTENSIONS):
        return False
    return path.startswith(scope[1]) or path + "/" == scope[1]


class RobotsRules:
    """robots.txt rules per origin, fetched once each. A missing file allows everything."""

    def __init__(self, session: requests.Session):
        self._session = session
        self._parsers: Dict[str, Optional[robotparser.RobotFileParser]] = {}

    def allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        origin = "%s://%s" % (parts.scheme, parts.netloc)
        if origin not in self._parsers:
            self._parsers[origin] = self._load(origin)
        parser = self._parsers[origin]
        return True if parser is None else parser.can_fetch(USER_AGENT, url)

    def _load(self, origin: str) -> Optional[robotparser.RobotFileParser]:
        try:
            fetched = fetch(origin + "/robots.txt", session=self._session, allowed_types=("text/plain",))
        except FetchError:
            return None
        parser = robotparser.RobotFileParser()
        parser.parse(fetched.text.splitlines())
        return parser


def sitemap_urls(start_url: str, session: requests.Session, scope: Tuple[str, str]) -> List[str]:
    """In-scope page URLs listed in the site's sitemap.xml, following one level of sitemap index."""
    parts = urlsplit(start_url)
    pending = ["%s://%s/sitemap.xml" % (parts.scheme, parts.netloc)]
    found: List[str] = []
    files_read = 0
    while pending and files_read < MAX_SITEMAP_FILES:
        sitemap = pending.pop(0)
        files_read += 1
        try:
            fetched = fetch(sitemap, session=session, allowed_types=XML_TYPES)
        except FetchError:
            continue
        locations = [
            loc.strip().replace("&amp;", "&")
            for loc in re.findall(r"<loc>\s*(.*?)\s*</loc>", fetched.text, re.I | re.S)
        ]
        if re.search(r"<sitemapindex", fetched.text, re.I):
            if files_read == 1:
                pending.extend(locations)
            continue
        for location in locations:
            normalized = normalize_link(location)
            if normalized and _in_scope(normalized, scope):
                found.append(normalized)
    return found


def crawl_site(
    start_url: str,
    max_pages: int = MAX_SITE_PAGES,
    max_depth: int = MAX_SITE_DEPTH,
    time_budget: float = SITE_TIME_BUDGET_SECONDS,
    progress: Optional[Callable[[int, int], None]] = None,
    delay: float = CRAWL_DELAY_SECONDS,
) -> SiteCrawl:
    """
    Read up to max_pages pages of a site: the starting page, pages listed in its
    sitemap, then pages reached by following links, staying on the same host and
    under the starting path.
    """
    session = new_session()
    try:
        robots = RobotsRules(session)
        first = fetch(start_url, session=session)
        if not robots.allowed(first.url):
            raise FetchError("This site's robots.txt does not allow automated access to this page.")
        first_page = extract_page(first)

        scope = _site_scope(first.url)
        deadline = time.monotonic() + time_budget
        pages: List[Page] = []
        failed: List[Dict[str, str]] = []
        seen: Set[str] = {_dedupe_key(first.url)}
        queue: List[Tuple[str, int]] = []
        truncated = False

        def enqueue(links: List[str], depth: int) -> None:
            if depth > max_depth:
                return
            for link in links:
                normalized = normalize_link(link)
                if not normalized or not _in_scope(normalized, scope):
                    continue
                key = _dedupe_key(normalized)
                if key not in seen:
                    seen.add(key)
                    queue.append((normalized, depth))

        if first_page.text:
            pages.append(first_page)
        enqueue(sitemap_urls(first.url, session, scope), 1)
        enqueue(first_page.links, 1)

        while queue:
            if len(pages) >= max_pages or time.monotonic() > deadline:
                truncated = True
                break
            if progress:
                progress(len(pages), min(max_pages, len(pages) + len(queue)))

            url, depth = queue.pop(0)
            if not robots.allowed(url):
                failed.append({"url": url, "error": "Blocked by the site's robots.txt."})
                continue
            time.sleep(delay)
            try:
                fetched = fetch(url, session=session)
            except FetchError as exc:
                failed.append({"url": url, "error": str(exc)})
                continue

            # A redirect may have led off-site or to a page we already have.
            final = normalize_link(fetched.url) or fetched.url
            final_key = _dedupe_key(final)
            if final_key != _dedupe_key(url):
                if not _in_scope(final, scope) or final_key in seen:
                    continue
                seen.add(final_key)

            page = extract_page(fetched)
            if page.text:
                pages.append(page)
            else:
                failed.append({"url": url, "error": "No readable text was found."})
            enqueue(page.links, depth + 1)

        return SiteCrawl(pages=pages, failed=failed, truncated=truncated)
    finally:
        session.close()
