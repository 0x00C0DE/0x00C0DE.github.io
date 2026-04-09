import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
    buildPostMediaPickerOptions,
    buildSequentialPostMediaPickerPlan,
    collectExactPostMediaFiles,
    collectIncrementalPostMediaFiles,
    collectSequentialPostMediaFiles
} from '../blog-upload-core.mjs';

const SAMPLE_MEDIA_FIXTURES = [
    {
        name: 'spongebob1.jpg',
        path: 'E:/Downloads/spongebob1.jpg',
        type: 'image/jpeg'
    },
    {
        name: 'patrick2.jpg',
        path: 'E:/Downloads/patrick2.jpg',
        type: 'image/jpeg'
    },
    {
        name: 'plankton1.jpg',
        path: 'E:/Downloads/plankton1.jpg',
        type: 'image/jpeg'
    }
];

function createExpectedPickerPlan(totalSelections) {
    return Array.from({ length: totalSelections }, (_, index) => ({
        accept: 'image/*,video/mp4',
        exactCount: 1,
        multiple: false,
        selectionIndex: index,
        totalSelections
    }));
}

function createExpectedExactPickerOptions(exactCount) {
    return {
        accept: 'image/*,video/mp4',
        exactCount,
        multiple: exactCount > 1
    };
}

function createExpectedIncrementalPickerPlan(totalSelections) {
    return Array.from({ length: totalSelections }, (_, index) => {
        const remaining = totalSelections - index;
        return {
            accept: 'image/*,video/mp4',
            exactCount: remaining,
            multiple: remaining > 1
        };
    });
}

async function loadSampleMediaFiles() {
    return Promise.all(SAMPLE_MEDIA_FIXTURES.map(async fixture => {
        const bytes = await readFile(fixture.path);
        return new File([bytes], fixture.name, { type: fixture.type });
    }));
}

test('buildSequentialPostMediaPickerPlan creates one single-file picker step per placeholder', () => {
    assert.deepEqual(
        buildSequentialPostMediaPickerPlan(3, { accept: 'image/*,video/mp4' }),
        createExpectedPickerPlan(3)
    );

    assert.deepEqual(
        buildSequentialPostMediaPickerPlan(1, { accept: 'image/*,video/mp4' }),
        createExpectedPickerPlan(1)
    );

    assert.deepEqual(
        buildSequentialPostMediaPickerPlan(4, { accept: 'image/*,video/mp4' }),
        createExpectedPickerPlan(4)
    );
});

test('buildPostMediaPickerOptions preserves the exact multi-select count for multi-media posts', () => {
    assert.deepEqual(
        buildPostMediaPickerOptions(3, { accept: 'image/*,video/mp4' }),
        createExpectedExactPickerOptions(3)
    );

    assert.deepEqual(
        buildPostMediaPickerOptions(1, { accept: 'image/*,video/mp4' }),
        createExpectedExactPickerOptions(1)
    );
});

test('collectExactPostMediaFiles accepts three selected files from one multi-select picker interaction', async () => {
    const sampleFiles = await loadSampleMediaFiles();
    const pickerCalls = [];

    const result = await collectExactPostMediaFiles(async pickerOptions => {
        pickerCalls.push(pickerOptions);
        return sampleFiles;
    }, 3, {
        accept: 'image/*,video/mp4'
    });

    assert.equal(pickerCalls.length, 1);
    assert.deepEqual(pickerCalls[0], createExpectedExactPickerOptions(3));
    assert.equal(result.ok, true);
    assert.equal(result.files.length, 3);
    assert.deepEqual(
        result.files.map(file => file.name),
        ['spongebob1.jpg', 'patrick2.jpg', 'plankton1.jpg']
    );
});

test('collectIncrementalPostMediaFiles keeps reopening the picker until all requested media files are selected', async () => {
    const sampleFiles = await loadSampleMediaFiles();
    const pickerCalls = [];

    const result = await collectIncrementalPostMediaFiles(async pickerOptions => {
        pickerCalls.push(pickerOptions);
        return [sampleFiles[pickerCalls.length - 1]];
    }, 3, {
        accept: 'image/*,video/mp4'
    });

    assert.equal(result.ok, true);
    assert.equal(result.files.length, 3);
    assert.deepEqual(result.pickerPlan, createExpectedIncrementalPickerPlan(3));
    assert.deepEqual(pickerCalls, createExpectedIncrementalPickerPlan(3));
    assert.deepEqual(
        result.files.map(file => file.name),
        ['spongebob1.jpg', 'patrick2.jpg', 'plankton1.jpg']
    );
});

test('collectSequentialPostMediaFiles accepts the three sample jpg fixtures across three picker interactions', async () => {
    const sampleFiles = await loadSampleMediaFiles();
    const pickerCalls = [];

    const result = await collectSequentialPostMediaFiles(async pickerOptions => {
        pickerCalls.push(pickerOptions);
        return [sampleFiles[pickerOptions.selectionIndex]];
    }, 3, {
        accept: 'image/*,video/mp4'
    });

    assert.equal(pickerCalls.length, 3);
    assert.deepEqual(pickerCalls, createExpectedPickerPlan(3));
    assert.equal(result.ok, true);
    assert.equal(result.files.length, 3);
    assert.deepEqual(
        result.files.map(file => file.name),
        ['spongebob1.jpg', 'patrick2.jpg', 'plankton1.jpg']
    );
});

test('collectSequentialPostMediaFiles stays generic across 1 through 4 and 10 requested media slots', async () => {
    const sampleFiles = await loadSampleMediaFiles();

    for (const requestedCount of [1, 2, 3, 4, 10]) {
        const pickerCalls = [];
        const result = await collectSequentialPostMediaFiles(async pickerOptions => {
            pickerCalls.push(pickerOptions);
            return [sampleFiles[pickerOptions.selectionIndex % sampleFiles.length]];
        }, requestedCount, {
            accept: 'image/*,video/mp4'
        });

        assert.equal(result.ok, true);
        assert.equal(result.files.length, requestedCount);
        assert.equal(pickerCalls.length, requestedCount);
        assert.deepEqual(pickerCalls, createExpectedPickerPlan(requestedCount));
    }
});

test('collectSequentialPostMediaFiles rejects incomplete multi-image selections without hanging', async () => {
    const [singleFile] = await loadSampleMediaFiles();
    let callCount = 0;

    const result = await collectSequentialPostMediaFiles(async pickerOptions => {
        callCount += 1;
        return pickerOptions.selectionIndex === 0 ? [singleFile] : [];
    }, 3, {
        accept: 'image/*,video/mp4'
    });

    assert.equal(callCount, 2);
    assert.equal(result.ok, false);
    assert.equal(
        result.error,
        'post: upload cancelled; expected 3 media items but received 1'
    );
});
