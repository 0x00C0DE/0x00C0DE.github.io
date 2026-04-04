function normalizeRequiredMediaCount(requiredCount) {
    return Number.isInteger(requiredCount) && requiredCount > 0
        ? requiredCount
        : 1;
}

function normalizeSelectedFiles(files) {
    return Array.isArray(files)
        ? files.filter(Boolean)
        : [];
}

export function buildPostMediaPickerOptions(requiredCount, options = {}) {
    const exactCount = normalizeRequiredMediaCount(requiredCount);
    return {
        accept: typeof options.accept === 'string' && options.accept.trim()
            ? options.accept.trim()
            : 'image/*,video/mp4',
        exactCount,
        multiple: exactCount > 1
    };
}

export function validateExactPostMediaFiles(files, requiredCount) {
    const exactCount = normalizeRequiredMediaCount(requiredCount);
    const normalizedFiles = normalizeSelectedFiles(files);

    if (normalizedFiles.length === 0) {
        return {
            error: 'post: no media selected',
            files: [],
            ok: false
        };
    }

    if (normalizedFiles.length !== exactCount) {
        return {
            error: `post: upload cancelled; expected ${exactCount} media item${exactCount === 1 ? '' : 's'} but received ${normalizedFiles.length}`,
            files: normalizedFiles,
            ok: false
        };
    }

    return {
        files: normalizedFiles,
        ok: true
    };
}

export async function collectExactPostMediaFiles(openPicker, requiredCount, options = {}) {
    if (typeof openPicker !== 'function') {
        throw new TypeError('openPicker must be a function');
    }

    const pickerOptions = buildPostMediaPickerOptions(requiredCount, options);
    const files = await openPicker(pickerOptions);
    const result = validateExactPostMediaFiles(files, pickerOptions.exactCount);

    return {
        ...result,
        pickerOptions
    };
}
