/**
 * FormImage Component
 * Embed image from form definition resources into a form
 */

import React from 'react';

export interface FormImageProps {
  /** Form identity override (alt text) */
  altText?: string;
  /** File type "image" or "source" */
  fileType?: 'image' | 'source';
  /** File name of image to show */
  filename?: string;
  /** Override props of html img tag */
  imgProps?: React.ImgHTMLAttributes<HTMLImageElement>;
}

/**
 * FormImage
 * Embed image from form definition resources into a form
 */
export const FormImage: React.FC<FormImageProps> = ({
  altText,
  fileType = 'image',
  filename = 'no image.png',
  imgProps,
}) => {
  // Build the image path from filename
  // Images are stored in /img/ folder in public
  const imagePath = `/img/${filename}`;

  return (
    <img
      src={imagePath}
      alt={altText || filename}
      data-file-type={fileType}
      style={{
        maxWidth: '100%',
        height: 'auto',
      }}
      {...imgProps}
    />
  );
};

export default FormImage;
