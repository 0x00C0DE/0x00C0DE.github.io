function processImage(context, width, height) {
    const imageData = context.getImageData(0, 0, width, height).data;
    const ascii = " _.,-=+:;cba!?0123456789$W#@Ñ";
    const asciiArtLines = [];
    for (let j = 0; j < height; j++) {
        let asciiArtLine = "";
        for (let i = 0; i < width; i++) {
            const index = (i + j * width) * 4;
            let brightness = (imageData[index] + imageData[index + 1] + imageData[index + 2]) / 3;
            brightness = Math.floor((brightness * ascii.length) / 256);
            asciiArtLine += ascii[brightness];
        }
        asciiArtLines.push(asciiArtLine);
    }
    return asciiArtLines;
}
