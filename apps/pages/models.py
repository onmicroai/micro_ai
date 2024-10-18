from django.db import models

from wagtail.models import Page
from wagtail.fields import StreamField
from wagtail.admin.panels import FieldPanel
from wagtail import blocks

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

class HomePage(Page):
    content = StreamField(
        ContentBlock(),
        use_json_field=True,
        blank=True
    )

    content_panels = Page.content_panels + [
        FieldPanel('content'),
    ]