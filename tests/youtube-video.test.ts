import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseYouTubeVideoUrl,
  publicYouTubeVideo,
  youtubeEmbedUrl,
} from '../src/lib/video/youtube';

const VIDEO_ID = 'aqz-KE-bpKQ';

test('parses canonical YouTube watch URLs and normalizes stored metadata', () => {
  assert.deepEqual(
    parseYouTubeVideoUrl(`https://www.youtube.com/watch?v=${VIDEO_ID}&feature=share`),
    { videoId: VIDEO_ID, canonicalUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}` }
  );
  assert.deepEqual(
    parseYouTubeVideoUrl(`https://youtube.com/watch?v=${VIDEO_ID}`),
    { videoId: VIDEO_ID, canonicalUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}` }
  );
});

test('parses the supported youtu.be short URL', () => {
  assert.deepEqual(
    parseYouTubeVideoUrl(`https://youtu.be/${VIDEO_ID}?si=test`),
    { videoId: VIDEO_ID, canonicalUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}` }
  );
});

test('rejects lookalike domains, unsupported paths, and malformed IDs', () => {
  for (const value of [
    `https://youtube.example/watch?v=${VIDEO_ID}`,
    `https://www.youtube.com.evil.test/watch?v=${VIDEO_ID}`,
    `https://www.youtube.com/embed/${VIDEO_ID}`,
    'https://youtu.be/not-valid',
    `https://youtu.be/${VIDEO_ID}/extra`,
  ]) assert.throws(() => parseYouTubeVideoUrl(value), /invalid_youtube_url/);
});

test('rejects non-HTTPS and script/data URL schemes', () => {
  for (const value of [
    `http://www.youtube.com/watch?v=${VIDEO_ID}`,
    'javascript:alert(1)',
    'data:text/html,test',
  ]) assert.throws(() => parseYouTubeVideoUrl(value), /invalid_youtube_url/);
});

test('disabled or missing records are unavailable publicly', () => {
  assert.deepEqual(publicYouTubeVideo(null), { status: 'unavailable' });
  assert.deepEqual(publicYouTubeVideo({ youtube_video_id: VIDEO_ID, enabled: 0 }), { status: 'unavailable' });
  assert.deepEqual(publicYouTubeVideo({ youtube_video_id: 'invalid', enabled: 1 }), { status: 'unavailable' });
});

test('enabled records expose only a validated ID', () => {
  assert.deepEqual(
    publicYouTubeVideo({ youtube_video_id: VIDEO_ID, youtube_url: 'ignored', enabled: 1 }),
    { status: 'ready', videoId: VIDEO_ID }
  );
});

test('iframe URLs are constructed only on the privacy-enhanced YouTube host', () => {
  assert.equal(youtubeEmbedUrl(VIDEO_ID), `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?rel=0`);
  assert.throws(() => youtubeEmbedUrl('javascript'), /invalid_youtube_video_id/);
});
