"""
Tests for the app knowledge base: sources, ingestion, chunk listing, the
retrieval test query, permissions, and URL safety.

No test touches the network: embeddings, page fetching and background
threads are all replaced.
"""
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.microapps.knowledge import web_fetch
from apps.microapps.knowledge.ingest import ingest_source
from apps.microapps.knowledge.loaders import LoadError, TextLoader
from apps.microapps.knowledge.sources import resolve_attached_sources, serialize_source
from apps.microapps.knowledge.url_safety import UnsafeURLError, is_public_ip, validate_public_url
from apps.microapps.models import AppFileReference, DocumentChunk, FileSource, Microapp, MicroAppUserJoin
from apps.microapps.rag_service import EMBEDDING_DIMS
from apps.microapps.views.run_views import RunList

KEYWORDS = ["apple", "banana", "cherry", "durian"]


def fake_embed(texts):
    """One dimension per keyword, so similarity follows keyword overlap."""
    vectors = []
    for text in texts:
        vector = [0.0] * EMBEDDING_DIMS
        for position, keyword in enumerate(KEYWORDS):
            vector[position] = float(text.lower().count(keyword))
        vector[len(KEYWORDS)] = 0.01  # never a zero vector
        vectors.append(vector)
    return vectors


def run_inline(source_id, loader):
    ingest_source(source_id, loader)


def paragraph(keyword, repeat=120):
    return (f"This sentence is about {keyword}. " * repeat).strip()


class KnowledgeTestCase(TestCase):
    def setUp(self):
        cache.clear()
        patcher = mock.patch("apps.microapps.rag_service._embed_via_litellm", side_effect=fake_embed)
        patcher.start()
        self.addCleanup(patcher.stop)
        for target in (
            "apps.microapps.views.knowledge_views.start_ingestion",
            "apps.microapps.views.media_views.start_ingestion",
        ):
            patcher = mock.patch(target, side_effect=run_inline)
            patcher.start()
            self.addCleanup(patcher.stop)

        User = get_user_model()
        self.owner = User.objects.create_user(username="owner", email="owner@example.com", password="x")
        self.stranger = User.objects.create_user(username="stranger", email="stranger@example.com", password="x")
        self.app = self.make_app(self.owner)
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def make_app(self, user, **kwargs):
        app = Microapp.objects.create(title="KB App", app_json=kwargs.pop("app_json", {}), **kwargs)
        MicroAppUserJoin.objects.create(ma_id=app, user_id=user, role=MicroAppUserJoin.OWNER)
        return app

    def url(self, name, app=None, **kwargs):
        return reverse(name, kwargs={"pk": (app or self.app).id, **kwargs})

    def add_text(self, title="Notes", text=None, app=None):
        response = self.client.post(
            self.url("knowledge-source-text", app=app),
            {"title": title, "text": text or paragraph("apple")},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()["data"]

    def clone_references(self, user):
        """Mimic CloneMicroApp: a new app that references the same sources."""
        clone = self.make_app(user, app_json=self.app.app_json)
        AppFileReference.objects.bulk_create([
            AppFileReference(app=clone, file_source=ref.file_source)
            for ref in AppFileReference.objects.filter(app=self.app)
        ])
        return clone


class PastedTextTests(KnowledgeTestCase):
    def test_create_text_source_is_chunked_in_order(self):
        text = paragraph("apple") + "\n\n" + paragraph("banana")
        data = self.add_text(text=text)

        self.assertEqual(data["type"], "text")
        source = FileSource.objects.get(id=data["id"])
        self.assertEqual(source.status, FileSource.READY)
        self.assertEqual(source.raw_text, text)
        chunks = list(DocumentChunk.objects.filter(file_source=source))
        self.assertGreater(len(chunks), 1)
        self.assertEqual([c.chunk_index for c in chunks], list(range(len(chunks))))
        self.assertEqual(source.chunk_count, len(chunks))
        self.assertIn("apple", chunks[0].content)
        self.assertIn("banana", chunks[-1].content)

    def test_empty_and_oversized_text_rejected(self):
        url = self.url("knowledge-source-text")
        self.assertEqual(self.client.post(url, {"title": "t", "text": "   "}, format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {"title": "t", "text": "a" * 200_001}, format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {"text": "hello"}, format="json").status_code, 400)

    def test_detail_returns_text_and_edit_replaces_chunks(self):
        data = self.add_text(text=paragraph("apple"))
        detail_url = self.url("knowledge-source-detail", source_id=data["id"])
        self.assertEqual(self.client.get(detail_url).json()["data"]["text"], paragraph("apple"))

        response = self.client.patch(detail_url, {"title": "Renamed", "text": paragraph("cherry", 5)}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["data"]["id"], data["id"])

        source = FileSource.objects.get(id=data["id"])
        self.assertEqual(source.file_name, "Renamed")
        self.assertEqual(source.status, FileSource.READY)
        contents = list(DocumentChunk.objects.filter(file_source=source).values_list("content", flat=True))
        self.assertEqual(len(contents), 1)
        self.assertIn("cherry", contents[0])

    def test_title_only_edit_does_not_reprocess(self):
        data = self.add_text()
        chunk_ids = set(DocumentChunk.objects.filter(file_source_id=data["id"]).values_list("id", flat=True))
        response = self.client.patch(
            self.url("knowledge-source-detail", source_id=data["id"]), {"title": "New title"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(FileSource.objects.get(id=data["id"]).file_name, "New title")
        self.assertEqual(
            set(DocumentChunk.objects.filter(file_source_id=data["id"]).values_list("id", flat=True)), chunk_ids
        )

    def test_only_text_sources_can_be_edited(self):
        source = FileSource.objects.create(file_name="a.pdf", status=FileSource.READY)
        AppFileReference.objects.create(app=self.app, file_source=source)
        response = self.client.patch(
            self.url("knowledge-source-detail", source_id=source.id), {"text": "x"}, format="json"
        )
        self.assertEqual(response.status_code, 400)


class ChunkAndSearchTests(KnowledgeTestCase):
    def test_chunks_are_paginated_filtered_and_scoped_to_the_app(self):
        first = self.add_text("First", paragraph("apple", 400))
        second = self.add_text("Second", paragraph("banana", 5))
        other_app = self.make_app(self.owner)
        foreign = self.add_text("Foreign", paragraph("durian", 5), app=other_app)

        url = self.url("knowledge-chunks")
        body = self.client.get(url, {"page_size": 2}).json()
        self.assertEqual(
            body["count"],
            DocumentChunk.objects.filter(file_source_id__in=[first["id"], second["id"]]).count(),
        )
        self.assertEqual(len(body["results"]), 2)
        self.assertTrue(body["has_more"])
        self.assertNotIn("embedding", body["results"][0])
        self.assertEqual([r["chunk_index"] for r in body["results"]], [0, 1])
        self.assertEqual(body["results"][0]["source_name"], "First")

        only_second = self.client.get(url, {"source_ids": str(second["id"])}).json()
        self.assertEqual(only_second["count"], 1)
        self.assertIn("banana", only_second["results"][0]["content"])

        # Asking for another app's source returns nothing.
        leaked = self.client.get(url, {"source_ids": str(foreign["id"])}).json()
        self.assertEqual(leaked["count"], 0)

    def test_search_ranks_by_similarity_and_matches_what_a_run_retrieves(self):
        apple = self.add_text("Apple notes", paragraph("apple", 5))
        banana = self.add_text("Banana notes", paragraph("banana", 5))
        self.app.app_json = {"attachedFiles": [
            {"source_id": apple["id"], "original_filename": "Apple notes", "type": "text"},
            {"source_id": banana["id"], "original_filename": "Banana notes", "type": "text",
             "description": "All about bananas"},
        ]}
        self.app.save()

        response = self.client.post(self.url("knowledge-search"), {"query": "tell me about banana"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        results = response.json()["results"]
        self.assertEqual(results[0]["source_id"], banana["id"])
        self.assertGreater(results[0]["similarity"], results[-1]["similarity"])

        messages = RunList()._inject_rag_context(
            [{"role": "user", "content": "hi"}], self.app, "tell me about banana"
        )
        self.assertEqual(len(messages), 2)
        context = messages[0]["content"]
        self.assertTrue(context.startswith("Context Documents:"))
        self.assertIn("Text: Banana notes\nDescription: All about bananas", context)
        for result in results:
            self.assertIn(result["content"], context)

    def test_search_can_be_limited_to_selected_sources(self):
        apple = self.add_text("Apple notes", paragraph("apple", 5))
        self.add_text("Banana notes", paragraph("banana", 5))
        response = self.client.post(
            self.url("knowledge-search"), {"query": "banana", "source_ids": [apple["id"]]}, format="json"
        )
        self.assertEqual({r["source_id"] for r in response.json()["results"]}, {apple["id"]})

    def test_run_resolves_legacy_entries_by_name(self):
        data = self.add_text("handbook.pdf", paragraph("cherry", 5))
        entries = [
            {"original_filename": "handbook.pdf"},              # no id: older apps
            {"original_filename": "missing.pdf"},               # not in the knowledge base
        ]
        resolved = resolve_attached_sources(self.app, entries)
        self.assertEqual([source.id for _, source in resolved], [data["id"]])

        stale = [{"source_id": 999999, "original_filename": "handbook.pdf"}]
        self.assertEqual([s.id for _, s in resolve_attached_sources(self.app, stale)], [data["id"]])

        self.app.app_json = {"attachedFiles": entries}
        self.app.save()
        messages = RunList()._inject_rag_context([], self.app, "cherry")
        self.assertIn("Text: handbook.pdf", messages[0]["content"])

    def test_run_ignores_sources_missing_from_app_json(self):
        self.add_text("Unlisted", paragraph("apple", 5))
        self.app.app_json = {"attachedFiles": []}
        self.app.save()
        self.assertEqual(RunList()._inject_rag_context([], self.app, "apple"), [])


class WebSourceTests(KnowledgeTestCase):
    def setUp(self):
        super().setUp()
        # Host names in these tests do not exist; skip DNS in the view.
        patcher = mock.patch(
            "apps.microapps.views.knowledge_views.validate_public_url", side_effect=lambda url: url
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def page(self, url, title, keyword, repeat=40):
        return web_fetch.Page(url=url, title=title, text=paragraph(keyword, repeat))

    def test_add_web_page(self):
        page = self.page("https://docs.test/intro", "Intro to apples", "apple")
        with mock.patch.object(web_fetch, "fetch", return_value=mock.Mock(url=page.url)), \
                mock.patch.object(web_fetch, "extract_page", return_value=page), \
                mock.patch.object(web_fetch.RobotsRules, "allowed", return_value=True):
            response = self.client.post(
                self.url("knowledge-source-web"), {"url": "https://docs.test/intro"}, format="json"
            )
        self.assertEqual(response.status_code, 201, response.content)

        source = FileSource.objects.get(id=response.json()["data"]["id"])
        self.assertEqual(source.source_type, FileSource.WEBPAGE)
        self.assertEqual(source.status, FileSource.READY)
        self.assertEqual(source.file_name, "Intro to apples")
        self.assertIsNotNone(source.last_fetched_at)
        chunk = DocumentChunk.objects.filter(file_source=source).first()
        self.assertEqual(chunk.metadata, {"url": "https://docs.test/intro", "title": "Intro to apples"})

    def test_page_blocked_by_robots_fails_with_a_clear_message(self):
        with mock.patch.object(web_fetch, "fetch", return_value=mock.Mock(url="https://docs.test/x")), \
                mock.patch.object(web_fetch.RobotsRules, "allowed", return_value=False):
            response = self.client.post(self.url("knowledge-source-web"), {"url": "https://docs.test/x"}, format="json")
        source = FileSource.objects.get(id=response.json()["data"]["id"])
        self.assertEqual(source.status, FileSource.FAILED)
        self.assertIn("robots.txt", source.error)

    def test_add_website_records_pages_and_failures(self):
        crawl = web_fetch.SiteCrawl(
            pages=[
                self.page("https://docs.test/", "Docs home", "apple"),
                self.page("https://docs.test/b", "Bananas", "banana"),
            ],
            failed=[{"url": "https://docs.test/c", "error": "This page was not found (404)."}],
            truncated=False,
        )
        with mock.patch.object(web_fetch, "crawl_site", return_value=crawl):
            response = self.client.post(
                self.url("knowledge-source-web"), {"url": "https://docs.test/", "mode": "site"}, format="json"
            )
        self.assertEqual(response.status_code, 201, response.content)

        listed = self.client.get(self.url("knowledge-sources")).json()["data"]
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["type"], "website")
        self.assertEqual(listed[0]["name"], "Docs home")
        self.assertEqual(listed[0]["page_count"], 2)
        self.assertEqual(len(listed[0]["failed_pages"]), 1)

        urls = set(
            DocumentChunk.objects.filter(file_source_id=listed[0]["id"]).values_list("metadata__url", flat=True)
        )
        self.assertEqual(urls, {"https://docs.test/", "https://docs.test/b"})

        self.app.app_json = {"attachedFiles": [{"source_id": listed[0]["id"], "original_filename": "Docs home"}]}
        self.app.save()
        context = RunList()._inject_rag_context([], self.app, "banana")[0]["content"]
        self.assertIn("Website: Docs home (https://docs.test/)", context)
        self.assertIn("Page: https://docs.test/b", context)

    def test_failed_refresh_keeps_previous_content(self):
        page = self.page("https://docs.test/intro", "Intro", "apple")
        with mock.patch.object(web_fetch, "fetch", return_value=mock.Mock(url=page.url)), \
                mock.patch.object(web_fetch, "extract_page", return_value=page), \
                mock.patch.object(web_fetch.RobotsRules, "allowed", return_value=True):
            source_id = self.client.post(
                self.url("knowledge-source-web"), {"url": page.url}, format="json"
            ).json()["data"]["id"]
        before = list(DocumentChunk.objects.filter(file_source_id=source_id).values_list("content", flat=True))

        with mock.patch.object(web_fetch, "fetch", side_effect=web_fetch.FetchError("The site could not be reached.")):
            response = self.client.post(self.url("knowledge-source-refresh", source_id=source_id))
        self.assertEqual(response.status_code, 200, response.content)

        data = self.client.get(self.url("knowledge-source-detail", source_id=source_id)).json()["data"]
        self.assertEqual(data["status"], "ready")
        self.assertIn("could not be reached", data["warning"])
        after = list(DocumentChunk.objects.filter(file_source_id=source_id).values_list("content", flat=True))
        self.assertEqual(before, after)

    def test_refresh_only_for_web_sources(self):
        data = self.add_text()
        response = self.client.post(self.url("knowledge-source-refresh", source_id=data["id"]))
        self.assertEqual(response.status_code, 400)

    def test_refresh_in_a_clone_leaves_the_original_untouched(self):
        old = self.page("https://docs.test/intro", "Intro", "apple")
        with mock.patch.object(web_fetch, "fetch", return_value=mock.Mock(url=old.url)), \
                mock.patch.object(web_fetch, "extract_page", return_value=old), \
                mock.patch.object(web_fetch.RobotsRules, "allowed", return_value=True):
            original_id = self.client.post(
                self.url("knowledge-source-web"), {"url": old.url}, format="json"
            ).json()["data"]["id"]
        clone = self.clone_references(self.owner)

        new = self.page("https://docs.test/intro", "Intro", "durian")
        with mock.patch.object(web_fetch, "fetch", return_value=mock.Mock(url=new.url)), \
                mock.patch.object(web_fetch, "extract_page", return_value=new), \
                mock.patch.object(web_fetch.RobotsRules, "allowed", return_value=True):
            response = self.client.post(self.url("knowledge-source-refresh", app=clone, source_id=original_id))
        self.assertEqual(response.status_code, 200, response.content)
        clone_source_id = response.json()["data"]["id"]

        self.assertNotEqual(clone_source_id, original_id)
        original_text = " ".join(
            DocumentChunk.objects.filter(file_source_id=original_id).values_list("content", flat=True)
        )
        clone_text = " ".join(
            DocumentChunk.objects.filter(file_source_id=clone_source_id).values_list("content", flat=True)
        )
        self.assertIn("apple", original_text)
        self.assertNotIn("durian", original_text)
        self.assertIn("durian", clone_text)
        self.assertEqual(
            list(AppFileReference.objects.filter(app=self.app).values_list("file_source_id", flat=True)),
            [original_id],
        )
        self.assertEqual(
            list(AppFileReference.objects.filter(app=clone).values_list("file_source_id", flat=True)),
            [clone_source_id],
        )


class UnsafeUrlRequestTests(KnowledgeTestCase):
    def test_internal_addresses_are_rejected_before_anything_is_created(self):
        for url in ("http://127.0.0.1:8000/", "http://10.1.2.3/", "http://169.254.169.254/latest/meta-data/",
                    "ftp://93.184.216.34/", "http://93.184.216.34:5432/", "http://user:pw@93.184.216.34/"):
            response = self.client.post(self.url("knowledge-source-web"), {"url": url}, format="json")
            self.assertEqual(response.status_code, 400, url)
        self.assertEqual(FileSource.objects.count(), 0)


class FileUploadTests(KnowledgeTestCase):
    def upload(self, name="guide.txt", text=None, app=None):
        with mock.patch(
            "apps.microapps.document_parser.DocumentProcessor.extract_text",
            return_value=text or paragraph("apple", 5),
        ):
            return self.client.post(
                self.url("microapp-upload-file", app=app),
                {
                    "file": SimpleUploadedFile(name, b"ignored", content_type="text/plain"),
                    "filename": name,
                    "content_type": "text/plain",
                },
                format="multipart",
            )

    def test_upload_returns_id_and_reupload_replaces_content(self):
        response = self.upload()
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()["data"]
        self.assertEqual(data["original_filename"], "guide.txt")
        source = FileSource.objects.get(id=data["id"])
        self.assertEqual((source.source_type, source.status), (FileSource.FILE, FileSource.READY))

        again = self.upload(text=paragraph("banana", 5)).json()["data"]
        self.assertEqual(again["id"], data["id"])
        contents = list(DocumentChunk.objects.filter(file_source=source).values_list("content", flat=True))
        self.assertEqual(len(contents), 1)
        self.assertIn("banana", contents[0])

    def test_reupload_in_a_clone_leaves_the_original_untouched(self):
        original_id = self.upload().json()["data"]["id"]
        clone = self.clone_references(self.owner)

        clone_id = self.upload(text=paragraph("durian", 5), app=clone).json()["data"]["id"]
        self.assertNotEqual(clone_id, original_id)
        self.assertIn("apple", DocumentChunk.objects.get(file_source_id=original_id).content)
        self.assertIn("durian", DocumentChunk.objects.get(file_source_id=clone_id).content)

    def test_unreadable_file_is_marked_failed(self):
        response = self.upload(text="Error: could not read file")
        source = FileSource.objects.get(id=response.json()["data"]["id"])
        self.assertEqual(source.status, FileSource.FAILED)
        self.assertIn("could not read file", source.error)

    def test_delete_keeps_a_source_other_apps_still_use(self):
        source_id = self.upload().json()["data"]["id"]
        clone = self.clone_references(self.owner)

        response = self.client.delete(self.url("knowledge-source-detail", source_id=source_id))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(FileSource.objects.filter(id=source_id).exists())
        self.assertFalse(AppFileReference.objects.filter(app=self.app).exists())

        response = self.client.delete(self.url("knowledge-source-detail", app=clone, source_id=source_id))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(FileSource.objects.filter(id=source_id).exists())
        self.assertFalse(DocumentChunk.objects.filter(file_source_id=source_id).exists())

    def test_legacy_delete_by_filename_still_works(self):
        self.upload()
        response = self.client.delete(self.url("microapp-delete-file"), {"filename": "guide.txt"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(FileSource.objects.count(), 0)


class PermissionTests(KnowledgeTestCase):
    def test_only_app_admins_and_owners_reach_the_knowledge_base(self):
        source_id = self.add_text()["id"]
        requests = [
            ("get", self.url("knowledge-sources"), None),
            ("post", self.url("knowledge-source-web"), {"url": "http://93.184.216.34/"}),
            ("post", self.url("knowledge-source-text"), {"title": "t", "text": "x"}),
            ("get", self.url("knowledge-source-detail", source_id=source_id), None),
            ("patch", self.url("knowledge-source-detail", source_id=source_id), {"title": "t"}),
            ("delete", self.url("knowledge-source-detail", source_id=source_id), None),
            ("post", self.url("knowledge-source-refresh", source_id=source_id), None),
            ("get", self.url("knowledge-chunks"), None),
            ("post", self.url("knowledge-search"), {"query": "apple"}),
            ("post", self.url("microapp-upload-file"), {"filename": "a.txt", "content_type": "text/plain"}),
            ("delete", self.url("microapp-delete-file"), {"filename": "Notes"}),
            ("get", self.url("microapp-file-status"), None),
        ]

        for user in (self.stranger, None):
            client = APIClient()
            if user:
                client.force_authenticate(user)
            for method, url, body in requests:
                response = getattr(client, method)(url, body, format="json")
                self.assertIn(response.status_code, (401, 403), f"{method} {url} as {user}")
        self.assertTrue(FileSource.objects.filter(id=source_id).exists())

    def test_app_id_in_the_body_cannot_redirect_the_check(self):
        own_app = self.make_app(self.stranger)
        client = APIClient()
        client.force_authenticate(self.stranger)
        response = client.post(
            self.url("knowledge-source-text"), {"title": "t", "text": "x", "app_id": own_app.id}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_role_is_allowed(self):
        MicroAppUserJoin.objects.create(ma_id=self.app, user_id=self.stranger, role=MicroAppUserJoin.ADMIN)
        client = APIClient()
        client.force_authenticate(self.stranger)
        self.assertEqual(client.get(self.url("knowledge-sources")).status_code, 200)


class SourceStatusTests(KnowledgeTestCase):
    def test_interrupted_processing_is_reported_as_failed(self):
        source = FileSource.objects.create(file_name="slow.pdf", status=FileSource.PROCESSING)
        AppFileReference.objects.create(app=self.app, file_source=source)
        self.assertEqual(serialize_source(source)["status"], "processing")

        FileSource.objects.filter(id=source.id).update(updated_at=timezone.now() - timedelta(minutes=20))
        source.refresh_from_db()
        data = serialize_source(source)
        self.assertEqual(data["status"], "failed")
        self.assertIn("interrupted", data["error"])

    def test_unexpected_errors_are_not_shown_verbatim(self):
        source = FileSource.objects.create(file_name="x", status=FileSource.PENDING)

        class Exploding(TextLoader):
            def load(self, progress=None):
                raise RuntimeError("secret internal detail")

        ingest_source(source.id, Exploding("x"))
        source.refresh_from_db()
        self.assertEqual(source.status, FileSource.FAILED)
        self.assertNotIn("secret", source.error)

    def test_load_errors_are_shown(self):
        source = FileSource.objects.create(file_name="x", status=FileSource.PENDING)

        class Failing(TextLoader):
            def load(self, progress=None):
                raise LoadError("This page was not found (404).")

        ingest_source(source.id, Failing("x"))
        source.refresh_from_db()
        self.assertEqual(source.error, "This page was not found (404).")


class UrlSafetyTests(SimpleTestCase):
    def test_non_public_addresses(self):
        for address in ("127.0.0.1", "10.0.0.1", "172.16.5.4", "192.168.0.1", "169.254.169.254",
                        "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1",
                        "224.0.0.1", "not-an-ip"):
            self.assertFalse(is_public_ip(address), address)
        self.assertTrue(is_public_ip("93.184.216.34"))

    def test_rejected_urls(self):
        for url in ("", "http://127.0.0.1/", "http://[::1]/", "http://2130706433/", "file:///etc/passwd",
                    "gopher://93.184.216.34/", "http://93.184.216.34:22/", "http://u:p@93.184.216.34/",
                    "http://" + "a" * 3000 + ".com/"):
            with self.assertRaises(UnsafeURLError, msg=url):
                validate_public_url(url)

    def test_normalises_accepted_urls(self):
        self.assertEqual(validate_public_url("http://93.184.216.34/a?b=1#frag"), "http://93.184.216.34/a?b=1")
        self.assertEqual(validate_public_url("93.184.216.34"), "https://93.184.216.34/")
