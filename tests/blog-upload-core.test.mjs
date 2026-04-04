import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
    buildSequentialPostMediaPickerPlan,
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

async function loadSampleMediaFiles() {
    return Promise.all(SAMPLE_MEDIA_FIXTURES.map(async fixture => {
        const bytes = await readFile(fixture.path);
        return new File([bytes], fixture.name, { type: fixture.type });
    }));
}

test('buildSequentialPostMediaPickerPlan creates one single-file picker step per placeholder', () => {
    assert.deepEqual(
        buildSequentialPostMediaPickerPlan(3, { accept: 'image/*,video/mp4' }),
        [
            {
                accept: 'image/*,video/mp4',
                exactCount: 1,
                multiple: false,
                selectionIndex: 0,
                totalSelections: 3
            },
            {
                accept: 'image/*,video/mp4',
                exactCount: 1,
                multiple: false,
                selectionIndex: 1,
                totalSelections: 3
            },
            {
                accept: 'image/*,video/mp4',
                exactCount: 1,
                multiple: false,
                selectionIndex: 2,
                totalSelections: 3
            }
        ]
    );

    assert.deepEqual(
        buildSequentialPostMediaPickerPlan(1, { accept: 'image/*,video/mp4' }),
        [
            {
                accept: 'image/*,video/mp4',
                exactCount: 1,
                multiple: false,
                selectionIndex: 0,
                totalSelections: 1
            }
        ]
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
    assert.deepEqual(pickerCalls, [
        {
            accept: 'image/*,video/mp4',
            exactCount: 1,
            multiple: false,
            selectionIndex: 0,
            totalSelections: 3
        },
        {
            accept: 'image/*,video/mp4',
            exactCount: 1,
            multiple: false,
            selectionIndex: 1,
            totalSelections: 3
        },
        {
            accept: 'image/*,video/mp4',
            exactCount: 1,
            multiple: false,
            selectionIndex: 2,
            totalSelections: 3
        }
    ]);
    assert.equal(result.ok, true);
    assert.equal(result.files.length, 3);
    assert.deepEqual(
        result.files.map(file => file.name),
        ['spongebob1.jpg', 'patrick2.jpg', 'plankton1.jpg']
    );
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
