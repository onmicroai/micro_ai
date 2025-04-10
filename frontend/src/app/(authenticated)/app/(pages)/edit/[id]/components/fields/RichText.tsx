import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { useState, useCallback, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { 
  Bold, 
  Italic, 
  Link as LinkIcon, 
  Image as ImageIcon,
  List, 
  ListOrdered,
  Palette,
  X
} from 'lucide-react';
import { createImageUploader } from "@/utils/imageUpload";
import { useDropzone } from 'react-dropzone';

/**
 * Maximum file size allowed for image uploads (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes 

/**
 * Props interface for the RichText editor component
 */
interface EditorProps {
  /**
   * Callback function triggered when editor content changes
   * @param {string} html - The new HTML content
   */
  onChange?: (html: string) => void;
  /**
   * Initial HTML content for the editor
   */
  value?: string;

  /**
   * The ID of the microapp
   */
  microappId: string;
}

/**
 * Props for the LinkInput component
 */
interface LinkInputProps {
  /**
   * Current URL value for the link input
   */
  linkUrl: string;
  /**
   * Handler for URL value changes
   */
  onLinkUrlChange: (url: string) => void;
  /**
   * Handler for link submission
   */
  onSubmit: (url: string) => void;
  /**
   * Handler to close the dialog
   */
  onClose: () => void;
}

/**
 * Component for inserting links into the rich text editor
 */
const LinkInput = ({ linkUrl, onLinkUrlChange, onSubmit, onClose }: LinkInputProps) => {
  return (
    <div 
      className="fixed inset-0 bg-gray-400 bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Insert Link</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URL
          </label>
          <input
            type="text"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => onLinkUrlChange(e.target.value)}
            className="w-full p-2 border border-gray-200 rounded mb-4"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit(linkUrl)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={!linkUrl}
            >
              Add Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Props for the ImageDialog component
 */
interface ImageDialogProps {
  /**
   * Current image URL value
   */
  imageUrl: string;
  /**
   * Handler for image URL changes
   */
  onImageUrlChange: (url: string) => void;
  /**
   * Handler for image URL submission
   */
  onImageUrlSubmit: () => void;
  /**
   * Handler for image file upload
   */
  onImageUpload: (file: File) => void;
  /**
   * Handler to close the dialog
   */
  onClose: () => void;
  /**
   * Loading state for upload
   */
  isUploading: boolean;
}

/**
 * Component for inserting images into the rich text editor
 */
const ImageDialog = ({ imageUrl, onImageUrlChange, onImageUrlSubmit, onImageUpload, onClose, isUploading }: ImageDialogProps) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles?.[0]) {
        onImageUpload(acceptedFiles[0]);
      }
    },
    accept: {
      'image/*': []
    },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: isUploading
  });

  return (
    <div 
      className="fixed inset-0 bg-gray-400 bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg/6 font-medium text-gray-900">Insert Image</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm/6 font-medium text-gray-900 mb-1">
              Image URL
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => onImageUrlChange(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="block w-full mt-2 items-center rounded-md px-3 py-1.5 outline-1 -outline-offset-1 outline outline-gray-300 sm:text-sm/6 
                placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600
                transition duration-150 ease-in-out"
            />
            <button
              onClick={onImageUrlSubmit}
              disabled={!imageUrl}
              className="mt-2 w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 
                focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add Image from URL
            </button>
          </div>
          
          <div className="border-t border-gray-200 pt-6">
            <label className="block text-sm/6 font-medium text-gray-900 mb-1">
              Upload Image
            </label>
            <div
              {...getRootProps()}
              className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md relative cursor-pointer
                ${isDragActive ? 'border-primary-400 bg-primary-50' : isUploading ? 'border-primary-300 bg-primary-50' : 'border-gray-300 hover:border-primary-600'}
                ${isUploading ? 'cursor-not-allowed' : 'cursor-pointer'}
                transition-colors duration-150 ease-in-out`}
            >
              <input {...getInputProps()} />
              <div className="space-y-1 text-center">
                <ImageIcon className={`mx-auto h-12 w-12 ${isDragActive || isUploading ? 'text-primary-400' : 'text-gray-400'}`} />
                <div className="flex text-sm text-gray-600">
                  <span className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-700">
                    {isDragActive ? "Drop the image here" : "Upload a file"}
                  </span>
                  {!isDragActive && <p className="pl-1">or drag and drop</p>}
                </div>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF up to 10MB
                </p>
              </div>
              {isUploading && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                    <span className="text-sm text-gray-600">Uploading...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Rich text editor component with formatting controls and image/link insertion capabilities
 * @param {EditorProps} props - Component props
 * @returns {JSX.Element | null} The rendered editor component or null if editor isn't initialized
 */
export const RichText = ({ value, onChange, microappId }: EditorProps) => {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [customColor, setCustomColor] = useState('#000000');
  const [isUploading, setIsUploading] = useState(false);
  const imageUploader = createImageUploader(microappId);
  

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link,
      TextStyle,
      Color,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose max-w-none p-4 focus:outline-none bg-white h-full min-h-[400px] overflow-y-auto',
      },
    },
  });

  /**
   * Handles ESC key press to close all modal dialogs
   */
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowLinkInput(false);
        setShowColorPicker(false);
        setShowImageDialog(false);
        setLinkUrl('');
        setImageUrl('');
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  /**
   * Handles image file uploads, validates size and converts to data URL
   * @param {File} file - The image file to upload
   */
  const handleImageUpload = useCallback(async (file: File) => {
    if (!file || file.size > MAX_FILE_SIZE) {
      alert('File size must be less than 10MB');
      return;
    }

    try {
      setIsUploading(true);
      const result = await imageUploader.uploadFile(file);
      if (result.url) {
        editor?.chain().focus().setImage({ src: result.url }).run();
        setShowImageDialog(false);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to process image');
    } finally {
      setIsUploading(false);
    }
  }, [editor, imageUploader, microappId]);

  /**
   * Handles submission of image URLs to insert into the editor
   */
  const handleImageUrlSubmit = () => {
    if (imageUrl) {
      editor?.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
      setShowImageDialog(false);
    }
  };

  /**
   * Handles color changes in the text color picker
   * @param {string} color - The selected hex color value
   */
  const handleColorChange = (color: string) => {
    setCustomColor(color);
    editor?.chain().focus().setColor(color).run();
  };

  if (!editor) return null;

  return (
    <div className="border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="border-b border-gray-200 p-2 flex flex-wrap gap-2 bg-white">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('bold') ? 'bg-gray-100' : ''}`}
        >
          <Bold size={20} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('italic') ? 'bg-gray-100' : ''}`}
        >
          <Italic size={20} />
        </button>
        <button
          onClick={() => setShowLinkInput(!showLinkInput)}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('link') ? 'bg-gray-100' : ''}`}
        >
          <LinkIcon size={20} />
        </button>
        <button
          onClick={() => setShowImageDialog(true)}
          className="p-2 rounded hover:bg-gray-100"
        >
          <ImageIcon size={20} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('bulletList') ? 'bg-gray-100' : ''}`}
        >
          <List size={20} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-gray-100 ${editor.isActive('orderedList') ? 'bg-gray-100' : ''}`}
        >
          <ListOrdered size={20} />
        </button>
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="p-2 rounded hover:bg-gray-100"
          >
            <Palette size={20} />
          </button>
          {showColorPicker && (
            <div 
              className="fixed inset-0 bg-gray-400 bg-opacity-50 flex items-start justify-center items-center z-50"
              onClick={() => setShowColorPicker(false)}
            >
              <div 
                className="bg-white rounded-lg p-4 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Choose Color</h3>
                  <button
                    onClick={() => setShowColorPicker(false)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="mb-2">
                  <HexColorPicker color={customColor} onChange={handleColorChange} />
                </div>
                <input
                  type="text"
                  value={customColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded text-sm font-mono"
                  pattern="^#[0-9A-Fa-f]{6}$"
                  placeholder="#000000"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {showLinkInput && (
        <LinkInput
          linkUrl={linkUrl}
          onLinkUrlChange={setLinkUrl}
          onSubmit={(url) => {
            if (url) {
              editor?.chain().focus().setLink({ href: url }).run();
              setLinkUrl('');
              setShowLinkInput(false);
            }
          }}
          onClose={() => {
            setShowLinkInput(false);
            setLinkUrl('');
          }}
        />
      )}

      {showImageDialog && (
        <ImageDialog
          imageUrl={imageUrl}
          onImageUrlChange={setImageUrl}
          onImageUrlSubmit={handleImageUrlSubmit}
          onImageUpload={handleImageUpload}
          onClose={() => {
            setShowImageDialog(false);
            setImageUrl('');
          }}
          isUploading={isUploading}
        />
      )}

      <div className="flex-1 overflow-hidden">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
};