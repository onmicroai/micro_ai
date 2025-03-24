export default function myLoader({ src, width, height, quality }) {
    let imageParams = [];

    if (width !== undefined) {
        imageParams.push(`w=${width}`);
    }

    if (height !== undefined) {
        imageParams.push(`h=${height}`);
    }

    if (quality !== undefined) {
        imageParams.push(`q=${quality}`);
    }

    const queryString = imageParams.length > 0 ? `?${imageParams.join('&')}` : '';

    return `${src}${queryString}`;
}