import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

ffmpeg('C:/Users/papil/Downloads/short laugh.wav')
  .toFormat('mp3')
  .save('public/success.mp3')
  .on('end', () => console.log('Conversion finished'))
  .on('error', (err) => console.error('Error:', err));
