/**
 * Opens the camera and accepts the check only when a face stays visible.
 * A covered lens is dark and is rejected before Windows Hello can offer a PIN.
 */

const COVERED_BRIGHTNESS = 18;
const FACE_HITS_REQUIRED = 3;
const COVERED_FRAMES_REQUIRED = 8;
const WARMUP_MS = 2000;
const CHECK_MS = 12000;
const FRAME_MS = 200;

let detectorPromise;

/**
 * @param {ImageData} imageData - A downscaled camera frame.
 * @returns {number} Average brightness from 0 to 255.
 */
export function averageBrightness(imageData) {
  const { data } = imageData;
  let total = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 16) {
    total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    count += 1;
  }
  return count === 0 ? 0 : total / count;
}

/**
 * Decides whether this frame is a covered lens, a visible face, or still waiting.
 *
 * @param {Object} frame - One camera sample.
 * @param {number} frame.brightness - Average brightness from 0 to 255.
 * @param {number} frame.faceCount - Faces found in this frame.
 * @param {number} frame.darkFrames - Consecutive covered frames so far.
 * @param {number} frame.hits - Consecutive frames that contained a face.
 * @returns {{ done: boolean, ok?: boolean, error?: 'covered', darkFrames: number, hits: number }}
 */
export function judgeFrame({ brightness, faceCount, darkFrames, hits }) {
  if (brightness < COVERED_BRIGHTNESS) {
    const nextDark = darkFrames + 1;
    if (nextDark >= COVERED_FRAMES_REQUIRED) {
      return { done: true, error: 'covered', darkFrames: nextDark, hits: 0 };
    }
    return { done: false, darkFrames: nextDark, hits: 0 };
  }

  if (faceCount > 0) {
    const nextHits = hits + 1;
    if (nextHits >= FACE_HITS_REQUIRED) {
      return { done: true, ok: true, darkFrames: 0, hits: nextHits };
    }
    return { done: false, darkFrames: 0, hits: nextHits };
  }

  return { done: false, darkFrames: 0, hits: 0 };
}

/**
 * @param {number} ms - How long to wait.
 * @returns {Promise<void>}
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Loads the on-device face detector once.
 *
 * @returns {Promise<import('@mediapipe/tasks-vision').FaceDetector>}
 */
const loadDetector = () => {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import(
        '@mediapipe/tasks-vision'
      );
      const fileset = await FilesetResolver.forVisionTasks('/mediapipe');
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: '/models/blaze_face_short_range.tflite',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.65,
      });
    })().catch(error => {
      detectorPromise = null;
      throw error;
    });
  }
  return detectorPromise;
};

/**
 * @param {HTMLVideoElement} video - The live preview element.
 * @returns {number} Average brightness of the current frame.
 */
const readBrightness = video => {
  const canvas =
    readBrightness.canvas ||
    (readBrightness.canvas = document.createElement('canvas'));
  const ctx =
    readBrightness.ctx ||
    (readBrightness.ctx = canvas.getContext('2d', { willReadFrequently: true }));
  canvas.width = 80;
  canvas.height = 60;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return averageBrightness(ctx.getImageData(0, 0, canvas.width, canvas.height));
};

/**
 * Stops every track on a camera stream and clears the preview.
 *
 * @param {MediaStream | null} stream - The open camera stream.
 * @param {HTMLVideoElement | null} video - The preview element.
 * @returns {void}
 */
const releaseCamera = (stream, video) => {
  stream?.getTracks().forEach(track => track.stop());
  if (video) {
    video.srcObject = null;
  }
};

/**
 * Waits until the camera shows a face, then releases the camera.
 * Windows Hello runs after this so it can use the camera itself.
 *
 * @param {HTMLVideoElement} video - A mounted preview element.
 * @param {Object} [options] - Progress callback.
 * @param {(status: string) => void} [options.onStatus] - Short status line.
 * @returns {Promise<void>}
 */
export async function confirmLiveFace(video, { onStatus } = {}) {
  if (!video) {
    throw new Error('The camera preview is not ready. Try again.');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser cannot use the camera. Use the email code.');
  }

  onStatus?.('Opening the camera...');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch (error) {
    const name = error?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new Error(
        'Camera permission was blocked. Allow the camera, or use the email code.',
      );
    }
    throw new Error('This device has no usable camera. Use the email code.');
  }

  video.srcObject = stream;
  video.muted = true;
  try {
    await video.play();
  } catch {
    releaseCamera(stream, video);
    throw new Error('The camera could not start. Use the email code.');
  }

  let sawFace = false;
  try {
    onStatus?.('Looking for your face...');
    let detector;
    try {
      detector = await loadDetector();
    } catch {
      throw new Error('The face check could not start. Use the email code.');
    }

    const started = performance.now();
    let hits = 0;
    let darkFrames = 0;
    while (performance.now() - started < CHECK_MS) {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const brightness = readBrightness(video);
        const warmingUp =
          performance.now() - started < WARMUP_MS &&
          brightness < COVERED_BRIGHTNESS;
        if (!warmingUp) {
          let faceCount = 0;
          if (brightness >= COVERED_BRIGHTNESS) {
            try {
              faceCount =
                detector.detectForVideo(video, performance.now()).detections
                  ?.length ?? 0;
            } catch {
              faceCount = 0;
            }
          }
          const verdict = judgeFrame({
            brightness,
            faceCount,
            darkFrames,
            hits,
          });
          darkFrames = verdict.darkFrames;
          hits = verdict.hits;
          if (verdict.error === 'covered') {
            throw new Error(
              'The camera looks covered. Uncover it so your face is visible, or use the email code.',
            );
          }
          if (verdict.ok) {
            sawFace = true;
            onStatus?.('Face seen.');
            break;
          }
          onStatus?.(
            brightness < COVERED_BRIGHTNESS
              ? 'The camera looks covered. Uncover it and look at it.'
              : 'Looking for your face...',
          );
        }
      }
      await delay(FRAME_MS);
    }
  } finally {
    releaseCamera(stream, video);
  }

  if (!sawFace) {
    throw new Error(
      'The camera did not see your face. Look straight at it, or use the email code.',
    );
  }

  await delay(400);
}
