from django.db import models

from wagtail.models import Page
from wagtail.fields import StreamField
from wagtail.admin.panels import FieldPanel
from wagtail import blocks
from wagtail.images.blocks import ImageChooserBlock

class ContentBlock(blocks.StreamBlock):
    heading = blocks.CharBlock(label="Heading")
    paragraph = blocks.RichTextBlock(
        label="Paragraph",
        features=['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'bold', 'italic', 'link', 
                  'ol', 'ul', 'hr', 'blockquote', 'code', 'superscript', 'subscript', 
                  'strikethrough', 'image', 'embed']
    )
    bullet_list = blocks.ListBlock(
        blocks.RichTextBlock(
            label="Bullet",
            features=['bold', 'italic', 'link', 'image']
        )
    )
    image = ImageChooserBlock(label="Image")
    tile = blocks.StructBlock([
        ('image', ImageChooserBlock(label="Tile Image")),
        ('title', blocks.CharBlock(label="Tile Title")),
        ('description', blocks.TextBlock(label="Tile Description")),
        ('url', blocks.URLBlock(label="Target URL", required=False)),
    ], label="Tile")
    faq = blocks.StructBlock([
        ('question', blocks.CharBlock(label="Question")),
        ('answer', blocks.RichTextBlock(
            label="Answer",
            features=['bold', 'italic', 'link', 'ol', 'ul']
        )),
    ], label="FAQ Item")

class HomePage(Page):
    content = StreamField(
        ContentBlock(),
        use_json_field=True,
        blank=True
    )

    content_panels = Page.content_panels + [
        FieldPanel('content'),
    ]

    subpage_types = ['SampleAppsPage']

class SampleAppsPage(Page):
    intro = models.TextField(
        help_text="Introduction text to display at the top of the page",
        blank=True
    )
    
    apps = StreamField([
        ('app', blocks.StructBlock([
            ('image', ImageChooserBlock(label="App Screenshot")),
            ('title', blocks.CharBlock(label="App Title")),
            ('description', blocks.TextBlock(label="App Description")),
            ('url', blocks.URLBlock(label="App URL")),
        ]))
    ], use_json_field=True)

    content_panels = Page.content_panels + [
        FieldPanel('intro'),
        FieldPanel('apps'),
    ]

    class Meta:
        verbose_name = "Sample Apps Library"