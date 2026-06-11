import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { TextToSpeechGeneratorHomeCopy } from './text-to-speech-home-copy';
import { TextToSpeechGeneratorWorkbench } from './text-to-speech-workbench';

const copy = {
  sampleText: 'Read this aloud.',
  textLabel: 'Text',
  languageLabel: 'Language',
  voiceLabel: 'Voice',
  speedLabel: 'Playback speed',
  characters: 'characters',
  generatePreview: 'Generate Preview',
  generatingPreview: 'Generating...',
  previewReady: 'Preview ready.',
  previewError: 'Preview generation failed.',
  downloadMp3: 'Download MP3',
  signInToDownload: 'Sign in to download',
  quotaTitle: 'Monthly quota',
  quotaRemaining: 'remaining',
  extraCredits: 'extra credits',
  resets: 'resets',
  previewsPerDay: 'previews per day',
  recentHistory: 'Recent history',
  historyEmpty: 'Recent previews will appear here.',
  audioTitle: 'Audio preview',
  audioEmpty: 'Preview audio appears here after generation.',
  samplePrompt: 'Try a sample:',
  previewHint: 'Preview is free.',
  generateFirst: 'Generate first',
  saveInHistory: 'Save in your history',
  nextCycle: 'Next cycle',
  previewOnly: 'Preview only',
  samplePresets: [],
} satisfies TextToSpeechGeneratorHomeCopy['generator'];

test('text to speech workbench associates the text area with its visible label', () => {
  const html = renderToStaticMarkup(
    <TextToSpeechGeneratorWorkbench copy={copy} turnstileSiteKey="" />
  );

  assert.match(html, /<label[^>]*for="tts-generator-text"/);
  assert.match(html, /<textarea[^>]*id="tts-generator-text"/);
});
