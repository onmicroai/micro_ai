import React, { useRef, useEffect, useCallback, useState } from "react";
import { Badge } from "../ui/badge";
import { FieldType } from "../../types";
import "./styles.scss";

interface Tag {
  id: string;
  label: string;
}

interface TagEditorProps {
  field: FieldType;
  fields: FieldType[];
  initialContent?: string;
  onChange?: (fieldId: string, content: string) => void;
}

export default function PromptField({
  field,
  fields,
  onChange,
}: TagEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(field.text || "");
  const lastRangeRef = useRef<Range | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [previewElement, setPreviewElement] = useState<HTMLElement | null>(null);

  /**
   * Converts text with {tag_name} placeholders to rich text with interactive tag elements.
   * 
   * @param text - The text containing placeholders to convert
   * @returns The HTML string with placeholders converted to styled tag elements
   * 
   * This method is essential for the visual representation of field references within
   * prompts and instructions. It transforms simple text placeholders into interactive,
   * visually distinct elements that clearly indicate dynamic content insertion points.
   * This visual distinction helps form creators easily identify which parts of their
   * text will be replaced with user input during form execution.
   */
  const convertPlaceholdersToTags = useCallback(
    (text: string): string => {
      // First, preserve any existing non-breaking spaces
      const preservedText = text.replace(/\u00A0/g, '___NBSP___');
      
      // Then do the tag conversion
      const convertedText = preservedText.replace(/\{([^}]+)\}/g, (match, tagName) => {
        const field = fields.find(
          (f) => f.name === tagName || f.id === tagName
        );
        if (!field) return match;

        return `<span contenteditable="false" draggable="true" class="inline-flex items-center align-baseline px-2 py-0.5 rounded-full text-sm text-white cursor-move bg-primary-600" style="margin: 0 0.25em;">${
          field.name || field.id
        }</span>`;
      });
      
      // Finally, restore the non-breaking spaces
      return convertedText.replace(/___NBSP___/g, ' ');
    },
    [fields]
  );

  useEffect(() => {
    if (field.text && field.text !== content) {
      setContent(field.text);
    }
  }, [field.text, content]);

    /**
   * Determines if the editor content is empty and updates state accordingly.
   * 
   * @param element - The editor DOM element to check
   * 
   * Empty state detection is important for displaying appropriate placeholder text
   * and preventing submission of empty content. This method helps provide visual
   * feedback to users about the content status, improving the overall usability
   * of the editor by clearly indicating when input is required.
   */
    const checkIfEmpty = useCallback((element: HTMLDivElement) => {
      const contentText = element.textContent?.trim() || "";
      setIsEmpty(contentText === "");
    }, []);

  useEffect(() => {
    if (editorRef.current) {
      // Save current selection before updating content
      saveSelection();
      
      // Get current cursor position
      const selection = window.getSelection();
      const hadFocus = document.activeElement === editorRef.current;
      const cursorPosition = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      
      // Convert text with placeholders to rich text when component mounts or content changes
      const richText = convertPlaceholdersToTags(content);
      
      // Preserve the exact HTML content to maintain spaces
      // Only update innerHTML if content has actually changed to avoid cursor jumps
      if (editorRef.current.innerHTML !== richText) {
        // Store the current HTML before updating to preserve exact spacing
        const prevHTML = editorRef.current.innerHTML;
        
        // Update the content
        editorRef.current.innerHTML = richText;
        checkIfEmpty(editorRef.current);
        
        // Restore cursor position if editor had focus
        if (hadFocus && cursorPosition) {
          try {
            // Check if we're just adding spaces by comparing non-space characters
            const prevTextNoSpaces = prevHTML.replace(/<[^>]*>|\s+/g, '');
            const newTextNoSpaces = richText.replace(/<[^>]*>|\s+/g, '');
            
            const isOnlySpaceChange = prevTextNoSpaces === newTextNoSpaces;
            
            if (isOnlySpaceChange) {
              // Create a new range at the appropriate position
              const range = document.createRange();
              const textNode = editorRef.current.lastChild;
              
              if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                // If we have a text node, place cursor in it
                const textLength = textNode.textContent?.length || 0;
                range.setStart(textNode, textLength);
                range.setEnd(textNode, textLength);
              } else {
                // Otherwise place at the end of the editor
                range.selectNodeContents(editorRef.current);
                range.collapse(false);
              }
              
              selection?.removeAllRanges();
              selection?.addRange(range);
            } else {
              // For other changes, try to restore the selection
              restoreSelection();
            }
          } catch {
            // If restoring fails, place cursor at the end
            const range = document.createRange();
            range.selectNodeContents(editorRef.current);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        }
      }
    }
  }, [content, convertPlaceholdersToTags, checkIfEmpty]);

  /**
   * Converts rich text with tag elements back to text with {tag_name} placeholders.
   * 
   * @param html - The HTML string containing tag elements
   * @returns The text with tag elements converted back to placeholders
   * 
   * This method is the counterpart to convertPlaceholdersToTags, ensuring that the
   * visual representation in the editor can be converted back to a format suitable
   * for storage and processing. It maintains the integrity of field references when
   * saving content, allowing the system to correctly process and replace these
   * placeholders with actual field values during form execution.
   */
  const convertTagsToPlaceholders = useCallback((html: string): string => {
    // Create a temporary div to work with the HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    // Process tag elements
    const tagElements = tempDiv.querySelectorAll(
      'span[contenteditable="false"]'
    );
    tagElements.forEach((element) => {
      const tagName = element.textContent?.trim() || "";
      const field = fields.find((f) => f.name === tagName || f.id === tagName);
      if (field) {
        element.replaceWith(`{${field.name || field.id}}`);
      }
    });

    // Get the result, preserving non-breaking spaces
    return tempDiv.innerHTML;
  }, [fields]);

  /**
   * Saves the current text selection/cursor position in the editor.
   * 
   * This method is crucial for maintaining a smooth editing experience by preserving
   * the user's cursor position during content updates. Without this functionality,
   * the cursor would reset to the beginning of the editor after each content change,
   * severely disrupting the user's workflow and making complex edits nearly impossible.
   */
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      // Only save the selection if it's within this editor
      const range = selection.getRangeAt(0);
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        lastRangeRef.current = range.cloneRange();
      }
    }
  };

  /**
   * Restores the previously saved text selection/cursor position.
   * 
   * Working in tandem with saveSelection, this method ensures that users can
   * continue editing exactly where they left off after content updates. This
   * seamless cursor position management is essential for creating a professional
   * editing experience that feels natural and responsive, particularly when
   * working with dynamic content that changes frequently.
   */
  const restoreSelection = () => {
    if (lastRangeRef.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(lastRangeRef.current);
    }
  };

  /**
   * Handles input events from the rich text editor.
   * 
   * @param event - The input event from the contentEditable div
   * 
   * This method is the core event handler for all user edits in the prompt editor.
   * It manages the complex process of capturing user input, preserving cursor position,
   * checking content state, and converting visual tags to storage format. This seamless
   * handling of rich text editing is essential for providing a professional editing
   * experience while maintaining the structured data format needed for dynamic content.
   */
  const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    
    // No need to replace spaces with &nbsp; as we're using CSS to preserve spaces
    const newContent = target.innerHTML;
    
    saveSelection();
    checkIfEmpty(target);
    
    const placeholderContent = convertTagsToPlaceholders(newContent);
    
    if (placeholderContent !== content) {
      setContent(placeholderContent);
      onChange?.(field.id, placeholderContent);
    }
  };

  /**
   * Creates a styled tag element with the specified label.
   * 
   * @param label - The text to display inside the tag
   * @returns A DOM element representing the styled tag
   * 
   * Consistent visual representation of field references is crucial for usability.
   * This method creates standardized, visually distinct elements that clearly indicate
   * dynamic content insertion points. The styling and behavior of these elements help
   * users immediately recognize field references and understand their purpose within
   * the prompt text.
   */
  const createTagElement = (label: string): HTMLElement => {
    const tagElement = document.createElement("span");
    tagElement.contentEditable = "false";
    tagElement.draggable = true;
    tagElement.className =
      "inline-flex items-center align-baseline px-2 py-0.5 rounded-full text-sm text-white cursor-move bg-primary-600";
    tagElement.style.margin = "0 0.25em";
    tagElement.textContent = label;
    return tagElement;
  };

  /**
   * Inserts a DOM node at the specified range and updates the selection.
   * 
   * @param node - The DOM node to insert
   * @param range - The range where the node should be inserted
   * 
   * This method handles the precise DOM manipulation required for inserting content
   * at the current cursor position. It's essential for maintaining a natural editing
   * flow when adding field references, ensuring that tags appear exactly where the
   * user expects them and that the cursor position updates appropriately after insertion.
   */
  const insertNodeAndUpdateSelection = (node: Node, range: Range) => {
    // Add a space before the tag if there isn't one already
    const beforeText = range.startContainer.textContent?.substring(0, range.startOffset) || '';
    if (beforeText.length > 0 && !beforeText.endsWith(' ')) {
      const spaceBeforeNode = document.createTextNode(' ');
      range.insertNode(spaceBeforeNode);
      range.setStartAfter(spaceBeforeNode);
    }
    
    // Insert the tag
    range.insertNode(node);
    
    // Add a space after the tag
    const spaceAfterNode = document.createTextNode(' ');
    range.setStartAfter(node);
    range.insertNode(spaceAfterNode);
    
    // Set the cursor after the space
    range.setStartAfter(spaceAfterNode);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  /**
   * Retrieves the current selection range or restores the last saved range.
   * 
   * @returns The current selection range or null if no selection exists
   * 
   * Accurate cursor position management is critical for a professional editing experience.
   * This method ensures that operations like tag insertion have access to the correct
   * cursor position, even if the editor has temporarily lost focus. This reliability
   * is essential for maintaining user trust in the editing interface.
   */
  const getCurrentRange = (): Range | null => {
    restoreSelection();
    const selection = window.getSelection();
    if (!selection?.rangeCount) return null;
    return selection.getRangeAt(0);
  };

  /**
   * Inserts a field reference tag at the current cursor position or specified range.
   * 
   * @param tag - The tag object containing id and label
   * @param range - Optional range where the tag should be inserted
   * 
   * This method provides the core functionality for adding field references to prompts.
   * It handles all the complex DOM operations needed to insert a tag at the cursor
   * position while maintaining editor state. This capability is fundamental to the
   * prompt editor's purpose, allowing users to create dynamic content that incorporates
   * user input from other form fields.
   */
  const insertTag = (tag: Tag, range?: Range) => {
    if (!editorRef.current) return;

    // Get the insertion range
    const insertionRange = range || getCurrentRange();
    if (!insertionRange) return;

    // Create and insert the tag
    const tagElement = createTagElement(tag.label);
    
    insertNodeAndUpdateSelection(tagElement, insertionRange);
    saveSelection();
    updateEditorContent();
    editorRef.current.focus();
    restoreSelection();
  };

  /**
   * Handles the start of a drag operation for tags in the tag palette.
   * 
   * @param event - The drag start event
   * @param tag - The tag object being dragged
   * 
   * This method initiates the drag-and-drop workflow for adding field references
   * from the palette to the editor. It stores the necessary tag data in the drag
   * event, enabling a seamless drag-and-drop experience that feels natural and
   * intuitive. This interaction pattern is essential for efficient prompt creation,
   * allowing users to quickly incorporate field references without disrupting their
   * writing flow.
   */
  const handleDragStart = (event: React.DragEvent, tag: Tag) => {
    event.dataTransfer.setData("tag", JSON.stringify(tag));
  };

  /**
   * Handles the start of a drag operation for tags already in the editor.
   * 
   * @param event - The drag start event
   * 
   * This method enables repositioning of existing field references within the editor.
   * It identifies draggable tag elements, stores their data, and applies visual feedback
   * during the drag operation. This capability is crucial for refining prompts without
   * having to delete and recreate tags, significantly improving the editing efficiency
   * and user experience.
   */
  const handleEditorTagDragStart = useCallback((event: DragEvent) => {
    const target = event.target as HTMLElement;
    if (target.getAttribute("contenteditable") === "false") {
      event.dataTransfer?.setData("editor-tag", target.outerHTML);
      target.classList.add("opacity-50");
    }
  }, []);

  /**
   * Handles the end of a drag operation for tags in the editor.
   * 
   * @param event - The drag end event
   * 
   * This method ensures proper cleanup after a drag operation, removing any visual
   * indicators that were applied during dragging. This attention to detail in the
   * interaction design helps maintain a clean, professional interface and prevents
   * visual artifacts that could confuse users about the current state of the editor.
   */
  const handleEditorTagDragEnd = useCallback((event: DragEvent) => {
    const target = event.target as HTMLElement;
    if (target.getAttribute("contenteditable") === "false") {
      // Remove opacity class
      target.classList.remove("opacity-50");
      
      // Check if the drag ended outside the editor
      if (event.dataTransfer?.dropEffect === "none") {
        // The tag was dropped outside a valid drop target
        target.remove();
        // Update editor content after removing the tag
        if (editorRef.current) {
          const newContent = editorRef.current.innerHTML;
          const placeholderContent = convertTagsToPlaceholders(newContent);
          if (placeholderContent !== content) {
            setContent(placeholderContent);
            onChange?.(field.id, placeholderContent);
          }
        }
      }
    }
  }, [content, onChange, field.id, convertTagsToPlaceholders]);

  /**
   * Processes the dropping of a new tag from the tag palette.
   * 
   * @param tagData - The serialized tag data
   * @param dropPosition - The position where the tag should be inserted
   * 
   * This method completes the drag-and-drop workflow for adding new field references,
   * deserializing the tag data and inserting it at the precise drop location. This
   * precision in placement is essential for creating well-structured prompts where
   * field references appear exactly where intended within the surrounding text.
   */
  const handleNewTagDrop = (tagData: string, dropPosition: Range) => {
    const tag = JSON.parse(tagData) as Tag;
    if (editorRef.current) {
      insertTag(tag, dropPosition);
    }
  };

  /**
   * Removes elements that were being dragged but not successfully dropped.
   * 
   * This cleanup method is crucial for maintaining the integrity of the editor content
   * during drag operations. It ensures that any visual indicators or temporary states
   * are properly removed, preventing orphaned or duplicate elements that could corrupt
   * the editor content and confuse users about what actually happened during the operation.
   */
  const removeDraggedElements = () => {
    if (!editorRef.current) return;
    const draggedElements = editorRef.current.querySelectorAll('.opacity-50');
    draggedElements.forEach(el => el.remove());
  };

  /**
   * Creates a tag element from an HTML string.
   * 
   * @param tagHTML - The HTML representation of the tag
   * @returns The created DOM element
   * 
   * This utility method supports the drag-and-drop functionality by reconstructing
   * tag elements from their serialized HTML representation. It ensures that tags
   * maintain their structure and styling when moved within the editor, providing
   * a consistent visual experience regardless of how tags are added or repositioned.
   */
  const createTagFromHTML = (tagHTML: string): HTMLElement => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = tagHTML;
    return tempDiv.firstChild as HTMLElement;
  };

  /**
   * Adjusts the drop position to prevent dropping inside another tag.
   * 
   * @param dropPosition - The initial drop position
   * @returns The adjusted drop position
   * 
   * This method prevents invalid nesting of field references by ensuring tags are
   * always inserted at valid positions in the document. This structural integrity
   * check is essential for maintaining a clean, parseable document structure that
   * can be correctly processed when generating the final prompt text with field
   * value substitutions.
   */
  const adjustDropPosition = (dropPosition: Range): Range => {
    let currentNode = dropPosition.startContainer;
    while (currentNode && currentNode !== editorRef.current) {
      if (currentNode.nodeType === Node.ELEMENT_NODE) {
        const element = currentNode as HTMLElement;
        if (element.getAttribute('contenteditable') === 'false') {
          dropPosition.setStartAfter(element);
          dropPosition.setEndAfter(element);
          break;
        }
      }
      currentNode = currentNode.parentNode as Node;
      if (!currentNode) break;
    }
    return dropPosition;
  };

  /**
   * Updates the selection after inserting a tag element.
   * 
   * @param dropPosition - The position where the tag was inserted
   * @param tagElement - The tag element that was inserted
   * 
   * Maintaining proper cursor position after content changes is essential for a
   * professional editing experience. This method ensures that after a tag is inserted,
   * the cursor is positioned correctly after the tag, allowing users to continue
   * typing or performing additional operations without manual repositioning. This
   * attention to selection management creates a seamless editing flow that feels
   * natural and responsive.
   */
  const updateSelectionAfterDrop = (dropPosition: Range, tagElement: HTMLElement) => {
    // Add a space before the tag if there isn't one already
    const beforeText = dropPosition.startContainer.textContent?.substring(0, dropPosition.startOffset) || '';
    if (beforeText.length > 0 && !beforeText.endsWith(' ')) {
      const spaceBeforeNode = document.createTextNode(' ');
      dropPosition.insertNode(spaceBeforeNode);
      dropPosition.setStartAfter(spaceBeforeNode);
    }
    
    // Insert the tag
    dropPosition.insertNode(tagElement);
    
    // Add a space after the tag
    const spaceAfterNode = document.createTextNode(' ');
    dropPosition.setStartAfter(tagElement);
    dropPosition.insertNode(spaceAfterNode);
    
    // Set the cursor after the space
    dropPosition.setStartAfter(spaceAfterNode);
    dropPosition.collapse(true);

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(dropPosition);
    }
  };

  /**
   * Handles dropping a tag that was dragged from within the editor.
   * 
   * @param tagHTML - The HTML of the tag being moved
   * @param dropPosition - The position where the tag should be placed
   * 
   * This method completes the workflow for repositioning existing tags within the editor.
   * It removes the original tag, creates a new instance at the drop location, and updates
   * the selection appropriately. This capability for precise positioning of field references
   * is crucial for refining prompts and instructions without disrupting the overall
   * structure or requiring complete rewrites.
   */
  const handleEditorTagDrop = (tagHTML: string, dropPosition: Range) => {
    if (!editorRef.current) return;

    removeDraggedElements();
    const tagElement = createTagFromHTML(tagHTML);
    const adjustedPosition = adjustDropPosition(dropPosition);
    updateSelectionAfterDrop(adjustedPosition, tagElement);
    updateEditorContent();
  };

  /**
   * Updates the editor content and notifies parent components of changes.
   * 
   * This method synchronizes the visual state of the editor with the underlying
   * data model, ensuring that all changes are properly captured and propagated.
   * It's essential for maintaining data integrity between the rich visual editing
   * experience and the structured data format needed for storage and processing.
   * This synchronization ensures that what users see in the editor accurately
   * reflects what will be used when the form is executed.
   */
  const updateEditorContent = () => {
    if (!editorRef.current) return;
    
    saveSelection();
    
    const newContent = editorRef.current.innerHTML;
    const placeholderContent = convertTagsToPlaceholders(newContent);
    
    checkIfEmpty(editorRef.current);
    
    if (placeholderContent !== content) {
      setContent(placeholderContent);
      onChange?.(field.id, placeholderContent);
    }
  };

  /**
   * Determines the precise drop position from a drag event.
   * 
   * @param event - The drag event containing position information
   * @returns A range object representing the drop position or null if position cannot be determined
   * 
   * Accurate positioning is critical for drag-and-drop operations to feel natural and
   * predictable. This method uses browser APIs to convert screen coordinates to a precise
   * document position, with fallbacks for different browser implementations. This precision
   * ensures that field references appear exactly where users intend, creating a reliable
   * and satisfying editing experience.
   */
  const getDropPosition = (event: React.DragEvent): Range | null => {
    const { clientX, clientY } = event;

    // Modern browsers
    if (document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(clientX, clientY);
      if (!position || !position.offsetNode) return null;

      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }

    // Fallback for WebKit-based browsers
    if (document.caretRangeFromPoint) {
      return document.caretRangeFromPoint(clientX, clientY);
    }

    return null;
  };

  /**
   * Creates a visual preview element for drag operations.
   * 
   * @returns A DOM element representing the drag preview
   * 
   * Visual feedback during drag operations is essential for a polished user experience.
   * This method creates a lightweight placeholder element that shows users where their
   * dragged content will be inserted, providing immediate visual feedback that helps
   * users make precise positioning decisions. This preview mechanism significantly
   * improves the usability and predictability of the drag-and-drop interaction.
   */
  const createPreviewElement = (): HTMLElement => {
    const preview = document.createElement('span');
    preview.className = 'tag-preview inline-flex items-center align-baseline rounded-full bg-gray-200 opacity-50 pointer-events-none text-sm';
    preview.style.width = '80px'; 
    preview.style.margin = '0 0.25em';
    preview.style.padding = '0.125rem 0.5rem'; 
    preview.style.height = '1.25rem'; 
    preview.innerHTML = '  ';
    return preview;
  };

  /**
   * Removes all preview elements from the editor.
   * 
   * This cleanup method ensures that temporary visual elements don't persist
   * after they're no longer needed. It's crucial for maintaining a clean editor
   * state and preventing visual clutter that could confuse users or interfere
   * with editing operations. This attention to cleanup details contributes to
   * a professional, polished user experience.
   */
  const removeAllPreviews = () => {
    if (!editorRef.current) return;
    const previews = editorRef.current.querySelectorAll('.tag-preview');
    previews.forEach(preview => preview.remove());
  };

  /**
   * Updates the position of the preview element during drag operations.
   * 
   * @param event - The drag event containing position information
   * 
   * Real-time visual feedback is essential for precise positioning during drag operations.
   * This method continuously updates the preview element's position as users move their
   * cursor, with performance optimizations to prevent excessive updates. This dynamic
   * feedback helps users understand exactly where content will be placed, significantly
   * improving the accuracy and efficiency of drag-and-drop operations.
   */
  const updatePreviewPosition = (event: React.DragEvent) => {
    if (!editorRef.current || !previewElement) return;

    const dropPosition = getDropPosition(event);
    if (!dropPosition) return;

    // Only update if position has changed significantly
    const { clientX, clientY } = event;
    if (
      previewElement.dataset.lastX && 
      previewElement.dataset.lastY &&
      Math.abs(Number(previewElement.dataset.lastX) - clientX) < 5 &&
      Math.abs(Number(previewElement.dataset.lastY) - clientY) < 5
    ) {
      return;
    }

    // Store last position
    previewElement.dataset.lastX = clientX.toString();
    previewElement.dataset.lastY = clientY.toString();

    // Remove all existing previews first
    removeAllPreviews();

    // Insert preview at drop position
    const adjustedPosition = adjustDropPosition(dropPosition.cloneRange());
    adjustedPosition.insertNode(previewElement);
  };

  /**
   * Handles the dragover event during drag operations.
   * 
   * @param event - The drag over event
   * 
   * This method provides essential real-time visual feedback during drag operations
   * by creating and positioning preview elements. It prevents the default browser
   * behavior to enable custom drop handling and implements performance optimizations
   * through requestAnimationFrame. This continuous visual feedback is critical for
   * a responsive, professional drag-and-drop experience that helps users precisely
   * position field references.
   */
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    
    // Create preview element if it doesn't exist
    if (!previewElement) {
      const preview = createPreviewElement();
      setPreviewElement(preview);
      // Initial removal of any stale previews
      removeAllPreviews();
    }

    // Throttle preview updates
    requestAnimationFrame(() => {
      updatePreviewPosition(event);
    });
  };

  /**
   * Handles the dragleave event during drag operations.
   * 
   * @param event - The drag leave event
   * 
   * This method ensures proper cleanup of visual feedback elements when a drag
   * operation moves outside the editor area. By removing preview elements when
   * they're no longer relevant, it maintains a clean interface and prevents
   * visual artifacts that could confuse users. This attention to edge cases
   * in the interaction flow contributes to a polished, professional user experience.
   */
  const handleDragLeave = (event: React.DragEvent) => {
    // Only remove preview if leaving the editor
    if (event.target === editorRef.current) {
      removeAllPreviews();
      setPreviewElement(null);
    }
  };

  /**
   * Handles the drop event that completes a drag-and-drop operation.
   * 
   * @param event - The drop event
   * 
   * This method is the culmination of the drag-and-drop workflow, processing
   * the dropped content based on its source and type. It handles both new tags
   * from the palette and repositioned tags from within the editor, ensuring
   * proper cleanup of temporary visual elements and precise placement of the
   * dropped content. This comprehensive drop handling is essential for a complete
   * and reliable drag-and-drop implementation.
   */
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();

    // Clean up all previews
    removeAllPreviews();
    setPreviewElement(null);

    const dropPosition = getDropPosition(event);
    if (!dropPosition) return;

    // Handle new tag drop
    const tagData = event.dataTransfer.getData("tag");
    if (tagData) {
      handleNewTagDrop(tagData, dropPosition);
      return;
    }

    // Handle editor tag drop
    const editorTagHTML = event.dataTransfer.getData("editor-tag");
    if (editorTagHTML) {
      handleEditorTagDrop(editorTagHTML, dropPosition);
    }
  };

  /**
   * Handles focus events when the editor receives focus.
   * 
   * This method ensures proper cursor positioning when the editor gains focus,
   * either restoring the previous selection or placing the cursor at the end
   * of the content. This attention to focus management creates a predictable
   * editing experience where users can seamlessly resume editing exactly where
   * they expect. This consistency in cursor behavior is essential for a
   * professional editing interface that feels natural and responsive.
   */
  const handleFocus = () => {
    // Clear any existing selections in other editors
    const allEditors = document.querySelectorAll('[id^="prompt-editor"]');
    allEditors.forEach(editor => {
      if (editor !== editorRef.current) {
        const selection = window.getSelection();
        if (selection && selection.containsNode(editor, true)) {
          selection.removeAllRanges();
        }
      }
    });

    // If there's a saved selection for this editor, restore it
    if (lastRangeRef.current && editorRef.current?.contains(lastRangeRef.current.commonAncestorContainer)) {
      try {
        restoreSelection();
      } catch {
        // If restoring fails, place cursor at the end
        if (editorRef.current) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          saveSelection();
        }
      }
    } 
    // If no saved selection, place cursor at the end
    else if (editorRef.current) {
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      saveSelection();
    }
  };

  /**
   * Determines the appropriate placeholder text based on field type.
   * 
   * @returns The placeholder text to display when the editor is empty
   * 
   * Clear guidance through placeholder text is essential for helping users
   * understand the purpose of each editor type. This method provides contextual
   * hints that vary based on the specific field type, helping form creators
   * understand what kind of content is expected. These tailored prompts improve
   * usability by reducing confusion and guiding users toward appropriate content
   * creation for each editor variant.
   */
  const getPlaceholderText = () => {
    switch (field.type) {
      case "aiInstructions":
        return "Enter instructions for the AI...";
      case "prompt":
        return "Enter prompt...";
      default:
        return "Enter a fixed response that will be shown to the user exactly as written.";
    }
  };

  useEffect(() => {
    if (editorRef.current) {
      checkIfEmpty(editorRef.current);
    }
  }, [checkIfEmpty]);

  useEffect(() => {
    const editorElement = editorRef.current;
    if (editorElement) {
      editorElement.addEventListener("dragstart", handleEditorTagDragStart);
      editorElement.addEventListener("dragend", handleEditorTagDragEnd);
  
      // Add document-level handlers for drag operations that end outside the editor
      const handleDocumentDragEnd = () => {
        removeAllPreviews();
        setPreviewElement(null);
      };

      const handleDocumentDrop = (e: DragEvent) => {
        // Only handle drops outside the editor
        if (e.target !== editorElement && !editorElement.contains(e.target as Node)) {
          removeAllPreviews();
          setPreviewElement(null);
        }
      };

      document.addEventListener("dragend", handleDocumentDragEnd);
      document.addEventListener("drop", handleDocumentDrop);
  
      return () => {
        editorElement.removeEventListener("dragstart", handleEditorTagDragStart);
        editorElement.removeEventListener("dragend", handleEditorTagDragEnd);
        document.removeEventListener("dragend", handleDocumentDragEnd);
        document.removeEventListener("drop", handleDocumentDrop);
      };
    }
  }, [handleEditorTagDragStart, handleEditorTagDragEnd]);

  /**
   * Handles click events inside the editor.
   * 
   * This method captures and saves the selection whenever users click within
   * the editor, ensuring that subsequent operations have access to the correct
   * cursor position. This continuous tracking of selection state is essential
   * for operations like tag insertion that need to know precisely where the
   * user is working. This attention to selection management creates a reliable
   * editing experience where operations consistently occur where users expect.
   */
  const handleClick = () => {
    // Save the selection when clicking inside the editor
    saveSelection();
  };

  /**
   * Handles keyboard events inside the editor.
   * 
   * This method ensures that selection state is properly tracked during keyboard
   * navigation and editing. By using requestAnimationFrame, it captures the selection
   * after the browser has processed the key event, ensuring accurate cursor position
   * information. This reliable selection tracking is fundamental to creating a
   * professional editing experience where the system always knows where the user
   * is working.
   */
  const handleKeyDown = () => {
    // Save the selection when using keyboard navigation
    // Use requestAnimationFrame to ensure the selection is saved after the key event is processed
    requestAnimationFrame(() => {
      saveSelection();
    });
  };

  return (
    <div className="space-y-4">
      <div
        id="prompt-editor"
        data-placeholder={getPlaceholderText()}
        ref={editorRef}
        contentEditable
        className={`min-h-[200px] p-4 bg-white rounded-lg shadow-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          ${
            isEmpty ? "empty-editor" : ""
          } before:content-[attr(data-placeholder)] before:text-gray-400 before:pointer-events-none`}
        onInput={handleInput}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={saveSelection}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        suppressContentEditableWarning
      />

      <div className="flex flex-wrap gap-2">
        {fields.map((sourceField) => {
          const fieldIdentifier = sourceField.name || sourceField.id;
          const tagData = {
            id: sourceField.id,
            label: sourceField.name || "",
          };
          return (
            <Badge
              key={sourceField.id}
              draggable="true"
              onDragStart={(event) => handleDragStart(event, tagData)}
              onClick={() => insertTag(tagData)}
              variant="default"
              className={`cursor-move bg-primary-600 align-baseline`}
              style={{ margin: "0 0.25em" }}
            >
              {fieldIdentifier}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
