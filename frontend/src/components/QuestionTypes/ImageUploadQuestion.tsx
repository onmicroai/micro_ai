"use client";

import React, { useState, useCallback } from "react";
import { ErrorObject, Element, Answers, setInputValue, Base64Images } from "@/app/(authenticated)/app/types";
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';
import Image from 'next/image';

interface ImageUploadQuestionProps {
  element: Element;
  setInputValue: setInputValue;
  setImages: (updater: (prev: Base64Images) => Base64Images) => void;
  errors: ErrorObject[];
  disabled: boolean;
  completedPhase?: boolean;
  answers: Answers;
}

const ImageUploadQuestion = ({
  element,
  setInputValue,
  setImages,
  errors = [],
  disabled,
  completedPhase,
}: ImageUploadQuestionProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([""]);

  const maxFiles = element.multiple ? (element.maxFiles || 5) : 1;
  const maxSize = (element.maxFileSize || 5) * 1024 * 1024; // Convert MB to bytes
  const acceptedTypes = element.allowedFileTypes || ['image/jpeg', 'image/png', 'image/webp'];

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const getTotalItemsCount = useCallback(() => {
    const validUrls = imageUrls.filter(url => isValidUrl(url));
    return files.length + validUrls.length;
  }, [files.length, imageUrls]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Handle maximum files limit considering both uploads and URLs
    const totalItems = getTotalItemsCount() + acceptedFiles.length;
    if (totalItems > maxFiles) {
      alert(`Maximum ${maxFiles} total items allowed (including both uploads and URLs)`);
      return;
    }

    try {
      // Convert files to base64 and create filename->base64 mapping
      const base64Promises = acceptedFiles.map(async file => {
        const base64String = await convertToBase64(file);
        return { [file.name]: base64String };
      });
      
      const base64Results = await Promise.all(base64Promises);
      
      // Merge the new base64 mappings
      const newBase64Mapping = base64Results.reduce((acc, curr) => ({
        ...acc,
        ...curr
      }), {});

      // Update previews for display
      setPreviews(prev => [...prev, ...Object.values(newBase64Mapping)]);
      setFiles(prev => [...prev, ...acceptedFiles]);

      // Update images store with new structure
      setImages(prev => ({
        ...prev,
        [element.name]: {
          ...(prev[element.name] || {}),
          ...newBase64Mapping
        }
      }));

      // Update filenames as before
      const newFilenames = acceptedFiles.map(file => file.name).join(', ');
      const existingFilenames = files.map(file => file.name).join(', ');
      const allFilenames = existingFilenames ? `${existingFilenames}, ${newFilenames}` : newFilenames;
      
      setInputValue(element.name, allFilenames, "", "imageUpload");
    } catch (error) {
      console.error('Error converting files to base64:', error);
    }
  }, [element.name, files, maxFiles, setInputValue, setImages, getTotalItemsCount]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize,
    disabled: disabled || getTotalItemsCount() >= maxFiles,
    multiple: element.multiple,
  });

  const removeFile = (index: number) => {
    const fileToRemove = files[index];
    
    setFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      const filenames = newFiles.map(file => file.name).join(', ');
      setInputValue(element.name, filenames, "", "imageUpload");
      return newFiles;
    });

    setPreviews(prev => prev.filter((_, i) => i !== index));

    // Remove the image from the images store
    setImages(prev => {
      const currentImages = { ...(prev[element.name] || {}) };
      delete currentImages[fileToRemove.name];
      return {
        ...prev,
        [element.name]: currentImages
      };
    });
  };

  const getErrorMessage = (elementName: string): string | null => {
    const error = errors.find((error) => error.element === elementName);
    return error ? error.error : null;
  };

  const errorMessage = getErrorMessage(element.name);
  const hasError = !!errorMessage;

  const handleUrlChange = (index: number, value: string) => {
    setImageUrls(prev => {
      const newUrls = [...prev];
      const oldUrl = newUrls[index];
      newUrls[index] = value;
      
      // If we're clearing a URL, remove it from the images store
      if (oldUrl && isValidUrl(oldUrl) && !value) {
        setImages(prev => {
          const currentImages = { ...(prev[element.name] || {}) };
          // Find and remove the old URL entry
          Object.entries(currentImages).forEach(([key, val]) => {
            if (val === oldUrl) {
              delete currentImages[key];
            }
          });
          return {
            ...prev,
            [element.name]: currentImages
          };
        });
      }
      
      // Check total items count before adding new input
      const validUrlsCount = newUrls.filter(url => isValidUrl(url)).length;
      const totalItems = files.length + validUrlsCount;
      
      // Only add new input if we haven't reached the max
      if (value && 
          isValidUrl(value) && 
          index === newUrls.length - 1 && 
          totalItems < maxFiles) {
        newUrls.push("");
      }

      // Clean up empty fields at the end (except keep one empty field)
      while (newUrls.length > 1 && !newUrls[newUrls.length - 1] && !newUrls[newUrls.length - 2]) {
        newUrls.pop();
      }

      return newUrls;
    });

    // Only process if we have a valid URL
    if (isValidUrl(value)) {
      const filename = `url-image-${Date.now()}-${index}.jpg`;
      
      // Update images store
      setImages(prev => ({
        ...prev,
        [element.name]: {
          ...(prev[element.name] || {}),
          [filename]: value
        }
      }));

      // Update input value with all valid URLs and files
      const validUrls = imageUrls
        .filter((url, i) => i !== index && isValidUrl(url))
        .map((_, i) => `url-image-${Date.now()}-${i}.jpg`);
      
      const allFilenames = [...files.map(f => f.name), ...validUrls, filename].join(', ');
      setInputValue(element.name, allFilenames, "", "imageUpload");
    } else {
      // Update input value without the cleared URL
      const validUrls = imageUrls
        .filter((url, i) => i !== index && isValidUrl(url))
        .map((_, i) => `url-image-${Date.now()}-${i}.jpg`);
      
      const allFilenames = [...files.map(f => f.name), ...validUrls].join(', ');
      setInputValue(element.name, allFilenames, "", "imageUpload");
    }
  };

  return (
    <div className="space-y-2">
      {element.label && (
        <label className="block text-sm font-medium text-gray-700">
          {element.label}
          {element.isRequired && <span className="text-red-500 ml-1">*</span>}
          <span className="ml-2 text-gray-500">
            ({getTotalItemsCount()}/{maxFiles})
          </span>
        </label>
      )}
      
      {element.description && (
        <p className="text-sm text-gray-500">{element.description}</p>
      )}

      {!disabled && (
        <>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300'}
              ${hasError ? 'border-red-500' : ''}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              {isDragActive
                ? "Drop the files here..."
                : `Drag & drop ${element.multiple ? 'files' : 'a file'} here, or click to select`}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {`Maximum file size: ${element.maxFileSize || 5}MB`}
            </p>
          </div>

          <div className="space-y-2 mt-4">
            {imageUrls.map((url, index) => (
              <div key={index} className="relative">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => handleUrlChange(index, e.target.value)}
                  disabled={disabled || getTotalItemsCount() >= maxFiles}
                  placeholder="Paste image URL here"
                  className={`
                    w-full px-3 py-2 pr-8 rounded-md border
                    ${hasError 
                      ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    }
                    ${disabled || getTotalItemsCount() >= maxFiles ? 'bg-gray-50 text-gray-500' : 'bg-white'}
                    shadow-sm
                    focus:outline-none focus:ring-2
                    transition duration-150 ease-in-out
                  `}
                />
                {url && !disabled && (
                  <button
                    type="button"
                    onClick={() => handleUrlChange(index, '')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Clear URL"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mt-4 sm:grid-cols-3 lg:grid-cols-4">
          {previews.map((preview, index) => (
            <div key={preview} className="relative group">
              <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                <Image
                  src={preview}
                  alt={`Upload ${index + 1}`}
                  fill
                  className="object-cover"
                />
              </div>
              {!disabled && !completedPhase && (
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full 
                    opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {hasError && (
        <p className="text-sm text-red-500 mt-1">{errorMessage}</p>
      )}
    </div>
  );
};

export default ImageUploadQuestion;