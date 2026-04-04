import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
    buildPostMediaPickerOptions,
    collectExactPostMediaFiles
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

test('buildPostMediaPickerOptions uses one exact-count multi-select picker for multiple placeholders', () => {
    assert.deepEqual(
        buildPostMediaPickerOptions(3, { accept: 'image/*,video/mp4' }),
        {
            accept: 'image/*,video/mp4',
            exactCount: 3,
            multiple: true
        }
    );

    assert.deepEqual(
        buildPostMediaPickerOptions(1, { accept: 'image/*,video/mp4' }),
        {
            accept: 'image/*,video/mp4',
            exactCount: 1,
            multiple: false
        }
    );
});

test('collectExactPostMediaFiles accepts the three sample jpg fixtures in one picker interaction', async () => {
    const sampleFiles = await loadSampleMediaFiles();
    const pickerCalls = [];

    const result = await collectExactPostMediaFiles(async pickerOptions => {
        pickerCalls.push(pickerOptions);
        return sampleFiles;
    }, 3, {
        accept: 'image/*,video/mp4'
    });

    assert.equal(pickerCalls.length, 1);
    assert.deepEqual(pickerCalls[0], {
        accept: 'image/*,video/mp4',
        exactCount: 3,
        multiple: true
    });
    assert.equal(result.ok, true);
    assert.equal(result.files.length, 3);
    assert.deepEqual(
        result.files.map(file => file.name),
        ['spongebob1.jpg', 'patrick2.jpg', 'plankton1.jpg']
    );
});

test('collectExactPostMediaFiles rejects incomplete multi-image selections without hanging', async () => {
    const [singleFile] = await loadSampleMediaFiles();
    let callCount = 0;

    const result = await collectExactPostMediaFiles(async pickerOptions => {
        callCount += 1;
        assert.deepEqual(pickerOptions, {
            accept: 'image/*,video/mp4',
            exactCount: 3,
            multiple: true
        });
        return [singleFile];
    }, 3, {
        accept: 'image/*,video/mp4'
    });

    assert.equal(callCount, 1);
    assert.equal(result.ok, false);
    assert.equal(
        result.error,
        'post: upload cancelled; expected 3 media items but received 1'
    );
});
