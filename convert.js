import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

ffmpeg('C:/Users/papil/Downloads/Thunder_000.ogg')
  .toFormat('mp3')
  .save('public/thunder.mp3')
  .on('end', () => console.log('Conversion finished'))
  .on('error', (err) => console.error('Error:', err));
