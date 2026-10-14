require('dotenv').config({ quiet: true });
const { createBunnyStreamAdapter, bunnyConfigFromEnv } = require('../src/services/bunnyStreamAdapter');

async function main() {
  const config = bunnyConfigFromEnv();
  const configured = {
    library: Boolean(config.libraryId), apiKey: Boolean(config.apiKey),
    tokenKey: Boolean(config.tokenKey), webhookSigningKey: Boolean(config.webhookSigningKey),
  };
  if (process.argv[2] === '--check-config' && process.argv.length === 3) {
    console.log(JSON.stringify({ configured, liveRequestMade: false }, null, 2));
    return;
  }
  if (process.argv[2] !== '--video-id' || !process.argv[3] || process.argv.length !== 4) {
    throw new Error('Use --check-config or --video-id <existing-video-guid>.');
  }
  const video = await createBunnyStreamAdapter(config).getVideo(process.argv[3]);
  console.log(JSON.stringify({ liveRequestMade: true, operation: 'read-only',
    libraryMatches: String(video.videoLibraryId) === String(config.libraryId),
    providerStatus: video.status, durationSeconds: video.length,
    note: 'Provider metadata only; browser playback/upload have not been tested by this command.' }, null, 2));
}

main().catch(error => {
  console.error(error.code || 'BUNNY_PROBE_INVALID_ARGUMENTS');
  process.exitCode = 1;
});
