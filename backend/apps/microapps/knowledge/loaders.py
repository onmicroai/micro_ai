"""
Loaders turn a knowledge source into plain-text documents ready for chunking.

A source yields one document per logical unit (a file, a pasted text, a web
page), so chunks never span two pages of a website.
"""
import os
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional

from . import web_fetch
from .web_fetch import FetchError


class LoadError(Exception):
    """Loading failed. The message is safe to show to users."""


@dataclass
class Document:
    text: str
    metadata: Dict[str, str] = field(default_factory=dict)


@dataclass
class LoadResult:
    documents: List[Document]
    # New display name for the source (e.g. the page title), if the loader found one.
    name: Optional[str] = None
    warning: Optional[str] = None
    # Website only: pages that could not be read.
    failed_pages: List[Dict[str, str]] = field(default_factory=list)


ProgressCallback = Callable[[int, int], None]


class Loader:
    def load(self, progress: Optional[ProgressCallback] = None) -> LoadResult:
        raise NotImplementedError

    def cleanup(self) -> None:
        """Release anything the loader holds (temp files). Always called after load()."""


class FileLoader(Loader):
    """An uploaded file saved to a temporary path."""

    def __init__(self, temp_path: str):
        self.temp_path = temp_path

    def load(self, progress=None) -> LoadResult:
        from apps.microapps.document_parser import DocumentProcessor

        text = DocumentProcessor().extract_text(self.temp_path)
        if not text or text.startswith("Error:") or text == "Unsupported file format":
            raise LoadError(text or "No text could be extracted from file")
        return LoadResult(documents=[Document(text=text)])

    def cleanup(self) -> None:
        try:
            os.unlink(self.temp_path)
        except OSError:
            pass


class TextLoader(Loader):
    """Text pasted by the user."""

    def __init__(self, text: str):
        self.text = text

    def load(self, progress=None) -> LoadResult:
        return LoadResult(documents=[Document(text=self.text)])


class WebPageLoader(Loader):
    """A single web page."""

    def __init__(self, url: str):
        self.url = url

    def load(self, progress=None) -> LoadResult:
        session = web_fetch.new_session()
        try:
            fetched = web_fetch.fetch(self.url, session=session)
            if not web_fetch.RobotsRules(session).allowed(fetched.url):
                raise LoadError("This site's robots.txt does not allow automated access to this page.")
            page = web_fetch.extract_page(fetched)
        except FetchError as exc:
            raise LoadError(str(exc))
        finally:
            session.close()

        if not page.text:
            raise LoadError(
                "No readable text was found on this page. It may need JavaScript to display its content."
            )
        warning = web_fetch.THIN_PAGE_WARNING if len(page.text) < web_fetch.THIN_PAGE_CHARS else None
        return LoadResult(
            documents=[Document(text=page.text, metadata={"url": page.url, "title": page.title})],
            name=page.title,
            warning=warning,
        )


class WebsiteLoader(Loader):
    """A site: the starting page plus the pages found from it."""

    def __init__(self, url: str, max_pages: int = web_fetch.MAX_SITE_PAGES):
        self.url = url
        self.max_pages = max_pages

    def load(self, progress=None) -> LoadResult:
        try:
            crawl = web_fetch.crawl_site(self.url, max_pages=self.max_pages, progress=progress)
        except FetchError as exc:
            raise LoadError(str(exc))

        if not crawl.pages:
            raise LoadError(
                "No readable text was found on this site. It may need JavaScript to display its content."
            )

        warning = None
        total_chars = sum(len(page.text) for page in crawl.pages)
        if crawl.truncated:
            warning = "Only the first %d pages were added; the site has more." % len(crawl.pages)
        elif total_chars < web_fetch.THIN_PAGE_CHARS:
            warning = web_fetch.THIN_PAGE_WARNING

        return LoadResult(
            documents=[
                Document(text=page.text, metadata={"url": page.url, "title": page.title})
                for page in crawl.pages
            ],
            name=crawl.pages[0].title,
            warning=warning,
            failed_pages=crawl.failed,
        )
